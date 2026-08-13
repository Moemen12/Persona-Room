import type {
  CompanionId,
  ConversationLanguage,
  PersonaMood,
  PersonalityId,
} from "@/features/persona/persona.types";
import type * as authRepository from "./auth.repository";
import type { PersonaMemory } from "@/features/persona";

export type AuthServiceDependencies = {
  findUserBySupabaseId: typeof authRepository.findUserBySupabaseId;
  createUser: typeof authRepository.createUser;
  findLatestSessionByUserId: typeof authRepository.findLatestSessionByUserId;
  createSession: typeof authRepository.createSession;
  updateSessionConfiguration: typeof authRepository.updateSessionConfiguration;
  findSessionWithUserById: typeof authRepository.findSessionWithUserById;
  findConversationsByUserIdAndSessionId: typeof authRepository.findConversationsByUserIdAndSessionId;
  findMemoriesByUserId: typeof authRepository.findMemoriesByUserId;
};

export interface PersonaUser {
  id: string;
  supabaseAuthId: string;
  displayName: string;
}

export interface PersonaSession {
  id: string;
  userId: string;
  audienceEnabled: boolean;
  companionId: CompanionId;
  language: ConversationLanguage;
  personalityId: PersonalityId;
  createdAt: string;
}

export interface InitialChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface SessionBootstrap {
  session: PersonaSession;
  user: PersonaUser;
  mood: PersonaMood;
  messages: InitialChatMessage[];
  memories: PersonaMemory[];
}
