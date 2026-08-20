import { create } from 'zustand';

/**
 * Which conversation this tab is looking at. That is all it holds.
 *
 * It used to hold the conversations themselves, with replies produced by
 * `getAgentReply()` — keyword-matched canned text streamed word by word to look
 * like thinking. The real agent was working the whole time, reachable by
 * assigning an issue to it, while this page answered from a fixture.
 *
 * The transcript is `agentRun` and `agentMessage` rows now, read live through
 * `useAgentChats`. Which chat is open is genuinely tab-local — two tabs can
 * read different conversations — so it stays here, the way
 * `store/notifications-store.ts` keeps a selection and nothing else.
 */
interface AgentChatSelection {
   activeChatId: string | null;
   setActiveChat: (chatId: string | null) => void;
   startNewChat: () => void;
}

export const useAgentChatStore = create<AgentChatSelection>((set) => ({
   activeChatId: null,
   setActiveChat: (chatId) => set({ activeChatId: chatId }),
   // A new chat has no row until the first message is sent, so "new" is simply
   // nothing selected.
   startNewChat: () => set({ activeChatId: null }),
}));
