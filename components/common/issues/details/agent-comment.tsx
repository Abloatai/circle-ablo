'use client';

import { memo, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { blocksToMarkdown } from '@/lib/data/content-blocks';
import type { ContentBlock } from '@/lib/domain/issue-details';

const DISALLOWED_ELEMENTS = ['img'] as const;
const LINK_SAFETY = { enabled: true } as const;

/**
 * Agent findings are authored as Markdown, even though comments are persisted
 * in Circle's ordinary block envelope. Streamdown restores that structure for
 * display while static mode skips work intended only for token-by-token output.
 */
export const AgentComment = memo(function AgentComment({ blocks }: { blocks: ContentBlock[] }) {
   const markdown = useMemo(() => blocksToMarkdown(blocks), [blocks]);

   return (
      <Streamdown
         mode="static"
         skipHtml
         disallowedElements={DISALLOWED_ELEMENTS}
         linkSafety={LINK_SAFETY}
         className="min-w-0 text-sm leading-6 text-foreground/90 [&_a]:break-words [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-2 [&_pre]:my-3 [&_table]:my-3 [&_ul]:my-2"
      >
         {markdown}
      </Streamdown>
   );
});
