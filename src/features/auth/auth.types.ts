import type { CompanionId, PersonaMood } from "@/features/persona/persona.types";

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
