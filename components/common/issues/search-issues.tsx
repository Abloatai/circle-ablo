'use client';

import { useCycles, useIssues } from '@/hooks/use-workspace-data';
import type { HydratedIssue } from '@/lib/data/hydrate';
import { useSearchStore } from '@/store/search-store';
import { useEffect, useMemo, useState } from 'react';
import { IssueLine } from './issue-line';

export function SearchIssues() {
   const [searchResults, setSearchResults] = useState<HydratedIssue[]>([]);
   const issues = useIssues();
   const cycles = useCycles();
   const cyclesById = useMemo(() => new Map(cycles.map((cycle) => [cycle.id, cycle])), [cycles]);
   const { searchQuery, isSearchOpen } = useSearchStore();

   useEffect(() => {
      if (searchQuery.trim() === '') {
         setSearchResults([]);
         return;
      }

      const query = searchQuery.toLowerCase();
      setSearchResults(
         issues.filter(
            (issue) =>
               issue.title.toLowerCase().includes(query) ||
               issue.identifier.toLowerCase().includes(query)
         )
      );
   }, [searchQuery, issues]);

   if (!isSearchOpen) {
      return null;
   }

   return (
      <div className="w-full">
         {searchQuery.trim() !== '' && (
            <div>
               {searchResults.length > 0 ? (
                  <div className="border rounded-md mt-4">
                     <div className="py-2 px-4 border-b bg-muted/50">
                        <h3 className="text-sm font-medium">Results ({searchResults.length})</h3>
                     </div>
                     <div className="divide-y">
                        {searchResults.map((issue) => (
                           <IssueLine
                              key={issue.id}
                              issue={issue}
                              layoutId={false}
                              cycleName={cyclesById.get(issue.cycleId)?.name}
                           />
                        ))}
                     </div>
                  </div>
               ) : (
                  <div className="text-center py-8 text-muted-foreground">
                     No results found for &quot;{searchQuery}&quot;
                  </div>
               )}
            </div>
         )}
      </div>
   );
}
