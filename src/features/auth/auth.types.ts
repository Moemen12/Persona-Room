import type { CompanionId, PersonaMood } from "@/features/persona/persona.types";
import type * as authRepository from "./auth.repository";

export type AuthServiceDependencies = {
  findUserBySupabaseId: typeof authRepository.findUserBySupabaseId;
  createUser: typeof authRepository.createUser;
  findLatestSessionByUserId: typeof authRepository.findLatestSessionByUserId;
  createSession: typeof authRepository.createSession;
  updateSessionCompanion: typeof authRepository.updateSessionCompanion;
  findSessionWithUserById: typeof authRepository.findSessionWithUserById;
  findConversationsByUserIdAndCompanionId: typeof authRepository.findConversationsByUserIdAndCompanionId;
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
}
