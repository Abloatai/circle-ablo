'use client';

import { Filter } from './filter';

/**
 * The Members page's filter bar.
 *
 * It used to carry a "Display" button with no handler. There is no members display
 * control to wire it to, so it is gone rather than pretending.
 */
export default function HeaderOptions() {
   return (
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
         <Filter />
      </div>
   );
}
