# AGENTS.md — Persona Room Project Guidelines

This file defines persistent repository instructions for development in this project.

## Working Style

**Prefer making the change directly instead of stopping at analysis.** Explain tradeoffs clearly when a decision has hidden product, security, or maintenance consequences.

**Code from a senior software engineer mindset:** explicit, reliable, bounded, and maintainable. Do not code like a junior or a vibe coder. Avoid speculative abstractions, "just in case" state, and unclear control flow.

**Keep code simple and maintainable;** avoid cleverness unless it clearly reduces complexity.

## Architecture

**Hybrid Clean + Feature-Based Structure:**

```
src/
  app/                    # Route composition, layouts, route handlers
  features/               # Domain slices: chat, persona, audience, auth
    chat/
      actions.ts          # Server actions / tRPC entry points
      service.ts          # Business logic orchestration
      repository.ts       # Data access layer
      schemas.ts          # Zod validation schemas
    persona/
      ...
    audience/
      ...
    auth/
      ...
  lib/                    # Cross-cutting utilities, shared helpers
    errors.ts             # Typed domain errors
    trpc.ts               # tRPC client setup
    utils.ts              # General utilities
  infrastructure/         # Framework config, DB schema, env
    database/
      schema.ts           # Drizzle schema
    config/
      env.ts              # Environment validation
  presentation/           # UI components, hooks, styles
    components/
    hooks/
    styles/
```

**Feature modules own their domain logic.** Presentation components consume features via tRPC procedures. Infrastructure provides framework adapters and database access.

**No framework APIs in features.** Next.js navigation, headers, cache APIs belong in `app/` routes or explicit server adapters. Feature code must be framework-light and testable.

## Code Standards

### React & Hooks

**Do not call useEffect directly in normal component code.** Prefer:
- Deriving state during render instead of syncing into local state
- Event handlers for imperative work instead of "set flag → effect runs → reset flag"
- Data-fetching libraries and server patterns instead of effect-based fetching
- React remount semantics with `key` when the real requirement is "start fresh"

**Only use mount-only effect for true external synchronization:**
- DOM integration
- Browser subscriptions
- Third-party widget lifecycle

**Treat direct useEffect as a smell** that requires justification, not a default tool.

### Error Handling

**Prefer typed application/domain errors over raw Error** for predictable failures.

```ts
// ✅ Good: Typed domain error
export class ConversationNotFoundError extends Error {
  constructor(public conversationId: string) {
    super(`Conversation ${conversationId} not found`);
    this.name = 'ConversationNotFoundError';
  }
}

// ❌ Bad: Untyped throw
throw new Error('Something went wrong');
```

**Treat broken invariants as internal failures, not normal empty states.**

**Do not leak internal server/runtime error details** directly into user-facing UI.

### tRPC & Data Management

**All backend communication must go through tRPC procedures.** No ad-hoc API routes for business logic.

```ts
// ✅ Good: tRPC procedure
export const chatRouter = router({
  sendMessage: protectedProcedure
    .input(z.object({ message: z.string() }))
    .mutation(({ ctx, input }) => {
      // Business logic here
    }),
});

// ❌ Bad: Direct API route for business logic
// app/api/chat/send/route.ts
```

**Use optimistic updates for instant feedback** on list operations, toggles, profile edits. For critical operations (auth, payments), use `invalidate` with explicit loading states.

### Validation

**All inputs must be validated with Zod at the boundary.** Procedures validate input schemas; features validate business rules.

```ts
// ✅ Good: Zod validation at boundary
export const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid(),
});

export async function sendMessage(input: z.infer<typeof sendMessageSchema>) {
  // Validated input, safe to use
}
```

### Database & Drizzle

**Tables, columns, enums, and FK structure in TypeScript schema.**

**Triggers, functions, RLS, and database-specific logic in manual SQL migrations.**

**Migrations are append-only.** Never rewrite or reuse an old applied migration version.

**Keep TypeScript schema and actual database structure in sync.**

## Supabase & Realtime

**Use Supabase Realtime for live subscriptions** (audience transcript, vote tallies).

**Use Supabase RLS policies** to enforce row-level access control.

**Use admin/service-role access only for true internal server-side operations** that must bypass RLS.

**Prefer database-enforced correctness** for concurrency-sensitive invariants.

## Redis & Upstash

**Use Redis for ephemeral state:**
- Active session presence
- Live vote counts
- Mood/expression broadcast
- Cache-aside pattern for hot reads

**Postgres remains the final authority** for persisted state.

## UI & Styling

**Desktop and mobile both matter;** do not ship a layout that only works on one.

**For mobile, prioritize the primary action and primary information first.** Reduce vertical waste aggressively.

**Prefer declarative React patterns** over synchronization code.

**Use shadcn/ui components** for consistent, modern interactions.

**Preserve design tokens:** keep `@layer base` rules in CSS. Utilities like `border-border` and `font-sans` depend on them.

**Consistent design language:** use spacing, radius, shadows, and typography via tokens. Extract shared UI into `components/` for reuse.

**Accessibility and responsiveness:** keep visible focus rings and ensure keyboard reachability; design mobile-first with thoughtful breakpoints.

## Persona Room Specifics

**Product names are exact:**
- "Persona Room" (not "PersonaRoom", "Persona-Room", or "persona room")
- "Rina" (not "rina", "RINA", or "the persona")

**Mood variants are exactly:**
- neutral
- happy
- surprised
- sad/thoughtful

**Rina's voice rules:**
- Speaks in short, natural sentences (1–3 sentences per reply)
- Playful, curious, warm. Never corporate. Never says "As an AI..."
- Reacts visibly to emotion: softens when user is sad, matches energy when excited
- Occasionally references memories of the user
- Reacts in-character to audience votes within 1–2 sentences

## Do Not

- Do not add broad new abstractions without clear payoff
- Do not hide important product or security tradeoffs
- Do not invent database state, model behavior, or framework guarantees
- Do not assume a random docs file will be auto-applied as instructions; repository expectations belong here
- Do not create spaghetti by combining unrelated responsibilities in one file
- Do not store file bytes in database columns; use S3 + metadata instead
- Do not create nested routes without escape routes (no back button, no sidebar nav)
- Do not force every concern into plain table reads; use Supabase capabilities intentionally

## Validation Before Finishing

**Run TypeScript and lint checks** after meaningful code changes when feasible.

**If you cannot run verification, say so explicitly.**

**When changing behavior, explain the observable outcome,** not only the implementation.

**Write vitest tests** for tRPC procedures and domain logic.
