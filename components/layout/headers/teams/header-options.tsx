'use client';

import { Filter } from './filter';

/**
 * The Teams page's filter bar.
 *
 * It used to carry a "Display" button with no handler. `TeamsDisplayOptions` is already rendered
 * on the page itself, so this was a second, dead copy of it.
 */
export default function HeaderOptions() {
   return (
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
         <Filter />
      </div>
   );
}
