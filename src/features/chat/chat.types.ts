import type * as chatRepository from "./chat.repository";

export type ChatServiceDependencies = {
  findMemoriesByUserId: typeof chatRepository.findMemoriesByUserId;
  saveMemories: typeof chatRepository.saveMemories;
  deleteMemoriesByIds: typeof chatRepository.deleteMemoriesByIds;
  findOldMemoriesForCleanup: typeof chatRepository.findOldMemoriesForCleanup;
  saveConversations: typeof chatRepository.saveConversations;
  findConversationHistory: typeof chatRepository.findConversationHistory;
  getProfileCache: typeof chatRepository.getProfileCache;
  setProfileCache: typeof chatRepository.setProfileCache;
  getLastVoteCache: typeof chatRepository.getLastVoteCache;
  incrementGeminiRequestCount: typeof chatRepository.incrementGeminiRequestCount;
};

export interface StoredConversation {
  role: "user" | "assistant";
  content: string;
}
