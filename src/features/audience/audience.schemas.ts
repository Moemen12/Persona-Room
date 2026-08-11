import { z } from "zod";

import { VOTE_OPTIONS } from "@/lib/config/app";

export const voteRequestSchema = z.object({
  option: z.enum(VOTE_OPTIONS.map((option) => option.value)),
  fingerprint: z.string().min(12).max(160),
});
