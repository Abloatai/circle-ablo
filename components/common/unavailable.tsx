'use client';

import { cn } from '@/lib/utils';

/**
 * Marks a control as not built.
 *
 * These are the buttons that imply infrastructure Circle does not have — an
 * API-key system, an OAuth integration directory, a desktop build. Leaving them
 * live is how someone demos a feature that does not exist; removing them
 * loses the shape of the product. Disabling them says both true things at once:
 * this is planned, and it does not work yet.
 *
 * The cursor is the part that needs care. `disabled` on a button sets
 * `pointer-events: none`, which means the browser shows **no** cursor change at
 * all — the control reads as merely faded. The wrapper keeps pointer events so
 * `not-allowed` actually appears, and carries the tooltip explaining why.
 */
export function Unavailable({
   children,
   reason = 'Not available yet',
   className,
}: {
   children: React.ReactNode;
   /** Shown on hover. Say what is missing, not just "coming soon". */
   reason?: string;
   className?: string;
}) {
   return (
      <span
         title={reason}
         aria-disabled="true"
         className={cn('inline-flex cursor-not-allowed', className)}
      >
         {children}
      </span>
   );
}

/**
 * The same idea for a menu item, which cannot be wrapped — Radix needs the item
 * to be a direct child of the menu content to keep keyboard navigation working.
 *
 * `pointer-events-auto` is forced back on because the menu's own disabled style
 * turns them off, which would take the cursor with it.
 */
export const unavailableItemClass =
   'pointer-events-auto! cursor-not-allowed opacity-50 focus:bg-transparent';
