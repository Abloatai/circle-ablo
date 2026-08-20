import type { ContentBlock } from '@/lib/domain/issue-details';

/**
 * Descriptions are stored as block JSON, but people edit text. These two
 * functions are the bridge, and they are deliberately a matched pair:
 * `markdownToBlocks(blocksToMarkdown(x))` gives back `x`.
 *
 * Most blocks have an obvious Markdown spelling. Three do not — an image, a
 * video and an issue reference carry fields no Markdown syntax holds — so they
 * are written out as a fenced `circle-block` with their JSON inside. That is
 * visible and slightly ugly in the editor, which is the point: the alternative
 * is opening a seeded description, saving it, and silently throwing those
 * blocks away.
 */

const FENCE = 'circle-block';

export function blocksToMarkdown(blocks: ContentBlock[]): string {
   return blocks.map(blockToMarkdown).join('\n\n');
}

function blockToMarkdown(block: ContentBlock): string {
   switch (block.type) {
      case 'heading':
         return `${'#'.repeat(block.level ?? 1)} ${block.text}`;
      case 'paragraph':
         return block.text;
      case 'bullet-list':
         return block.items.map((item) => `- ${item}`).join('\n');
      case 'numbered-list':
         return block.items.map((item, index) => `${index + 1}. ${item}`).join('\n');
      case 'checklist':
         return block.items
            .map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
            .join('\n');
      case 'code':
         return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
      case 'quote':
         return block.author ? `> ${block.text}\n> — ${block.author}` : `> ${block.text}`;
      case 'divider':
         return '---';
      default:
         // image / video / issue-ref: no Markdown spelling, so carry the block.
         return `\`\`\`${FENCE}\n${JSON.stringify(block)}\n\`\`\``;
   }
}

export function markdownToBlocks(markdown: string): ContentBlock[] {
   const lines = markdown.replace(/\r\n/g, '\n').split('\n');
   const blocks: ContentBlock[] = [];

   let index = 0;
   while (index < lines.length) {
      const line = lines[index];

      if (line.trim() === '') {
         index += 1;
         continue;
      }

      // Fenced code — including the carried blocks above.
      const fence = /^```(\S*)\s*$/.exec(line);
      if (fence) {
         const language = fence[1] ?? '';
         const body: string[] = [];
         index += 1;
         while (index < lines.length && !/^```\s*$/.test(lines[index])) {
            body.push(lines[index]);
            index += 1;
         }
         index += 1; // closing fence

         if (language === FENCE) {
            const carried = safeParseBlock(body.join('\n'));
            if (carried) {
               blocks.push(carried);
               continue;
            }
         }
         blocks.push({ type: 'code', language, code: body.join('\n') });
         continue;
      }

      if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
         blocks.push({ type: 'divider' });
         index += 1;
         continue;
      }

      const heading = /^(#{1,2})\s+(.*)$/.exec(line);
      if (heading) {
         // `level` is left off for h1: the renderer only branches on level 2,
         // so omitting it is the same document and keeps the round-trip exact
         // for the many blocks that were written without one.
         const level = heading[1].length;
         blocks.push({
            type: 'heading',
            text: heading[2].trim(),
            ...(level === 2 ? { level: 2 as const } : {}),
         });
         index += 1;
         continue;
      }

      // A checklist is a bullet list whose items are boxes, so it has to be
      // tested first — every checklist item also matches the bullet pattern.
      if (/^\s*[-*]\s+\[[ xX]\]\s/.test(line)) {
         const items: { text: string; checked: boolean }[] = [];
         while (index < lines.length) {
            const match = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(lines[index]);
            if (!match) break;
            items.push({ text: match[2].trim(), checked: match[1].toLowerCase() === 'x' });
            index += 1;
         }
         blocks.push({ type: 'checklist', items });
         continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
         const items = takeList(lines, index, /^\s*[-*]\s+(.*)$/);
         blocks.push({ type: 'bullet-list', items: items.values });
         index = items.next;
         continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
         const items = takeList(lines, index, /^\s*\d+[.)]\s+(.*)$/);
         blocks.push({ type: 'numbered-list', items: items.values });
         index = items.next;
         continue;
      }

      if (/^>\s?/.test(line)) {
         const quoted: string[] = [];
         while (index < lines.length && /^>\s?/.test(lines[index])) {
            quoted.push(lines[index].replace(/^>\s?/, ''));
            index += 1;
         }
         // A trailing "— name" line is an attribution, not part of the quote.
         const last = quoted[quoted.length - 1] ?? '';
         const attribution = /^—\s*(.+)$/.exec(last.trim());
         if (attribution && quoted.length > 1) {
            quoted.pop();
            blocks.push({
               type: 'quote',
               text: quoted.join('\n').trim(),
               author: attribution[1].trim(),
            });
         } else {
            blocks.push({ type: 'quote', text: quoted.join('\n').trim() });
         }
         continue;
      }

      // Anything else is a paragraph, running to the next blank line.
      const paragraph: string[] = [];
      while (index < lines.length && lines[index].trim() !== '' && !startsNewBlock(lines[index])) {
         paragraph.push(lines[index]);
         index += 1;
      }
      if (paragraph.length > 0) {
         blocks.push({ type: 'paragraph', text: paragraph.join('\n').trim() });
      } else {
         index += 1;
      }
   }

   return blocks;
}

/** Lines that end a paragraph even without a blank line between them. */
function startsNewBlock(line: string): boolean {
   return (
      /^```/.test(line) ||
      /^(-{3,}|\*{3,})\s*$/.test(line) ||
      /^#{1,2}\s+/.test(line) ||
      /^\s*[-*]\s+/.test(line) ||
      /^\s*\d+[.)]\s+/.test(line) ||
      /^>\s?/.test(line)
   );
}

function takeList(
   lines: string[],
   start: number,
   pattern: RegExp
): { values: string[]; next: number } {
   const values: string[] = [];
   let index = start;
   while (index < lines.length) {
      const match = pattern.exec(lines[index]);
      if (!match) break;
      values.push(match[1].trim());
      index += 1;
   }
   return { values, next: index };
}

function safeParseBlock(json: string): ContentBlock | null {
   try {
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' && 'type' in parsed
         ? (parsed as ContentBlock)
         : null;
   } catch {
      return null;
   }
}
