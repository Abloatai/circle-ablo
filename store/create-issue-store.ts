import { Status } from '@/lib/domain/status';
import { create } from 'zustand';

/**
 * Tab-local state for the "new issue" dialog: whether it is open and what it
 * should be seeded with. The issue itself is written through Ablo when the
 * dialog is submitted — nothing about the issue lives here.
 */
interface CreateIssueState {
   isOpen: boolean;
   defaultStatus: Status | null;
   /** Set when the dialog is opened from a cycle view. */
   defaultCycleId: string | null;
   /** Set when the dialog was opened from an issue's "Add sub-issue". */
   parentIssueId: string | null;

   // Actions
   openModal: (status?: Status, parentIssueId?: string, cycleId?: string) => void;
   closeModal: () => void;
   setDefaultStatus: (status: Status | null) => void;
}

export const useCreateIssueStore = create<CreateIssueState>((set) => ({
   // Initial state
   isOpen: false,
   defaultStatus: null,
   defaultCycleId: null,
   parentIssueId: null,

   // Actions
   openModal: (status, parentIssueId, cycleId) =>
      set({
         isOpen: true,
         defaultStatus: status || null,
         defaultCycleId: cycleId ?? null,
         parentIssueId: parentIssueId ?? null,
      }),
   closeModal: () => set({ isOpen: false, defaultCycleId: null, parentIssueId: null }),
   setDefaultStatus: (status) => set({ defaultStatus: status }),
}));
