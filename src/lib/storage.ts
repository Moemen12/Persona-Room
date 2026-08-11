import { z } from "zod";
import { COMPANION_IDS, type CompanionId } from "@/features/persona";

const chatAuthStorageSchema = z.object({
  sessionId: z.uuid(),
  accessToken: z.string().min(1),
  companionId: z.enum(COMPANION_IDS).optional(),
});

export type SafeChatAuth = z.infer<typeof chatAuthStorageSchema>;

export function getSafeChatAuth(storageKey: string): SafeChatAuth | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const result = chatAuthStorageSchema.safeParse(parsed);
    if (!result.success) {
      window.sessionStorage.removeItem(storageKey);
      return undefined;
    }
    return result.data;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return undefined;
  }
}

export function setSafeChatAuth(storageKey: string, auth: SafeChatAuth) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(auth));
  } catch {
    // ignore quota or storage disabled errors
  }
}

export function getSafeCompanionHint(storageKey: string): CompanionId | undefined {
  const auth = getSafeChatAuth(storageKey);
  return auth?.companionId;
}
