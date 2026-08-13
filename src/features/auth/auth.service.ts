import { APP_CONFIG } from "@/lib/config/app";
import { NotFoundError } from "@/lib/errors";

import * as authRepository from "./auth.repository";
import type { PersonaSession, SessionBootstrap, AuthServiceDependencies } from "./auth.types";
import type { CompanionId, ConversationLanguage, PersonalityId } from "@/features/persona";

function guestName() {
  return `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
}

const defaultDependencies: AuthServiceDependencies = {
  findUserBySupabaseId: authRepository.findUserBySupabaseId,
  createUser: authRepository.createUser,
  findLatestSessionByUserId: authRepository.findLatestSessionByUserId,
  createSession: authRepository.createSession,
  updateSessionConfiguration: authRepository.updateSessionConfiguration,
  findSessionWithUserById: authRepository.findSessionWithUserById,
  findConversationsByUserIdAndSessionId: authRepository.findConversationsByUserIdAndSessionId,
  findMemoriesByUserId: authRepository.findMemoriesByUserId,
};

export async function ensurePersonaUserAndSession(
  supabaseAuthId: string,
  dependencies: AuthServiceDependencies = defaultDependencies,
) {
  let user = await dependencies.findUserBySupabaseId(supabaseAuthId);
  if (!user) {
    user = await dependencies.createUser(supabaseAuthId, guestName());
  }

  const existingSession = await dependencies.findLatestSessionByUserId(user.id);
  if (existingSession) return { user, session: existingSession };

  const session = await dependencies.createSession(user.id, "rina", "en", "playful");
  return { user, session };
}

export async function getSessionBootstrap(
  supabaseAuthId: string,
  dependencies: AuthServiceDependencies = defaultDependencies,
): Promise<SessionBootstrap> {
  const { user, session } = await ensurePersonaUserAndSession(supabaseAuthId, dependencies);
  const [messages, memories] = await Promise.all([
    dependencies.findConversationsByUserIdAndSessionId(
      user.id,
      session.id,
      session.companionId,
      APP_CONFIG.conversationHistoryLimit,
    ),
    dependencies.findMemoriesByUserId(user.id),
  ]);

  return {
    user,
    session,
    mood: "neutral",
    messages,
    memories,
  };
}

export async function updateSessionConfiguration(
  sessionId: string,
  supabaseAuthId: string,
  configuration: {
    companionId: CompanionId;
    language: ConversationLanguage;
    personalityId: PersonalityId;
  },
  dependencies: AuthServiceDependencies = defaultDependencies,
): Promise<PersonaSession> {
  const { session, user } = await dependencies.findSessionWithUserById(sessionId);
  if (user.supabaseAuthId !== supabaseAuthId) throw new NotFoundError("Room");

  if (
    session.companionId === configuration.companionId &&
    session.language === configuration.language &&
    session.personalityId === configuration.personalityId
  ) {
    return session;
  }

  return dependencies.updateSessionConfiguration(sessionId, configuration);
}

export async function getInternalUserForSession(
  sessionId: string,
  dependencies: AuthServiceDependencies = defaultDependencies,
) {
  return dependencies.findSessionWithUserById(sessionId);
}
