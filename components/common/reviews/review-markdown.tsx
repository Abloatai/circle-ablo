'use client';

import { memo } from 'react';
import { Streamdown } from 'streamdown';

const DISALLOWED_ELEMENTS = ['img'] as const;
const LINK_SAFETY = { enabled: true } as const;

export const ReviewMarkdown = memo(function ReviewMarkdown({ children }: { children: string }) {
   return (
      <Streamdown
         mode="static"
         skipHtml
         disallowedElements={DISALLOWED_ELEMENTS}
         linkSafety={LINK_SAFETY}
         className="min-w-0 text-sm leading-6 [&_a]:break-words [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-2 [&_pre]:my-3 [&_table]:my-3 [&_ul]:my-2"
      >
         {children}
      </Streamdown>
   );
});
