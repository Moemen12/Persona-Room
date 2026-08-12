# Persona Room — Project Guidance

This file defines persistent repository instructions for contributors working in Persona Room.

## How to Use This Repository Guidance

Keep this file practical, specific, and short enough to stay readable. It records repeatable project expectations, while one-off task workflows belong in dedicated documentation. Make the change directly when the requirements are clear, and explain meaningful security, product, or maintenance tradeoffs when they affect the result.

## Working Style and Worktree Safety

Build with a senior engineering mindset: explicit, reliable, bounded, maintainable, and free of speculative abstractions. Keep modules focused and split crowded files by responsibility rather than accumulating conditions. Reusable named types belong in nearby `*.types.ts` files when they have a clearer boundary outside a component, hook, service, or repository.

The worktree can contain user changes. Never overwrite or revert user work without explicit permission. If unexpected changes appear in files being edited and make intent ambiguous, stop and surface the conflict.

## Architecture

Persona Room is a **Next.js App Router** application with a `src/` root. Keep pages and route handlers in `src/app`, domain behavior in `src/features`, infrastructure adapters and validated configuration in `src/infrastructure`, shared helpers in `src/lib`, and UI components and browser-facing hooks in `src/presentation`.

Keep correctness-sensitive business logic on the server or in feature repository/service layers. Components should stay presentational where practical; move orchestration into focused hooks or services. Prefer server components by default and add `"use client"` only where interactivity, browser APIs, client state, or client-only libraries actually require it.

Centralize application and API paths in `src/infrastructure/config/routes.ts`. Centralize product constants such as message limits, cache TTLs, rate limits, and budget caps in `src/lib/config/app.ts`. Do not scatter hardcoded routes or runtime thresholds through feature and presentation code.

## Non-Negotiable Stack and Platform Rules

Use **Next.js 16 App Router**, React 19, TypeScript, Tailwind CSS, npm, Supabase, Upstash Redis, Zod, and Gemini through `@google/genai`. Keep `package-lock.json` authoritative: use npm commands and never introduce pnpm or AWS SDK/storage packages. Do not add OpenAI dependencies or OpenAI API calls; Gemini is the AI provider for this MVP.

Use Supabase Auth and Postgres as the authoritative identity and durable data boundary. Use Supabase Realtime for live room synchronization and Upstash only for cache, rate limits, transient tallies/presence, and request-cap coordination. Never use a browser fingerprint as the source of truth for loading a user’s conversation or authorizing an action.

Apply a **free-first rule** to every feature: prefer browser-native Web APIs, local computation, open-source packages, and existing free-tier services before proposing any paid provider. Do not add a paid API, paid SDK, subscription service, or usage-billed integration when a reliable free alternative can satisfy the MVP requirement. If a paid provider is ever genuinely necessary, explain the cost and ask for approval first. For voice, keep synthesis server-side behind the replaceable voice feature boundary so the browser downloads only a small audio response; use Edge Neural for English, Korean, and Arabic, and browser Speech Synthesis as the final fallback. Never ship a large neural model to the client for the MVP. Remote free-provider adapters must remain server-only, treated as best-effort infrastructure, paired with caching and a graceful fallback, and clearly disclosed as outbound provider calls; never expose provider credentials or make the UI depend on undocumented provider guarantees.

## React and Frontend Standards

Favor intentional, premium, accessible UI over generic SaaS boilerplate. The product must work on desktop and mobile, with mobile prioritizing the main information and primary action. Preserve visible focus states and keyboard access.

Do not call `useEffect` directly in normal component code. Prefer derived render state, event handlers, server patterns, and remount semantics. Mount-only synchronization is permitted only for genuine external synchronization such as a browser subscription or third-party lifecycle; use a small named helper with cleanup when repeated. For async client synchronization, use `AbortController` cleanup and never commit results after the signal is aborted.

Use declarative React patterns. When related client-state fields represent one interaction flow, prefer a reducer or one structured state object rather than many loosely coordinated state setters.

## Data Fetching, Mutations, and API Contracts

Prefer React Server Components for server-side reads and direct feature-service calls. Put internal mutations in `src/actions` as Server Actions and use client-side libraries or Route Handlers only when a browser-owned live interaction or an external consumer genuinely requires them. Do not make client components call the app’s own read endpoints through repetitive `fetch` calls when the data can be provided by a Server Component.

Route Handlers are explicit API boundaries, not a default replacement for Server Actions. Every API response must use the same envelope: successful operations return `{ data: ... }`, and failures return `{ error: { code, message, details? } }`. Validate every path, query, header, and body input with Zod or an equivalent typed boundary. Unsupported methods and unknown API paths must return a clear JSON error with the correct HTTP status, while unhandled infrastructure details remain generic and server-side only.

## Error Handling and Security

Use typed application errors for predictable failure modes and shared JSON response helpers for routes. Do not leak server, provider, or runtime details to the UI. Broken invariants are internal failures, not normal empty states.

Client-side UI never grants permission. Authorize sensitive actions on the server. Keep the Supabase service-role key and Gemini API key server-only. The browser may use only the Supabase publishable key and a short-lived authenticated access token.

## Supabase, Upstash, and Data

Use Supabase deliberately: Auth for anonymous identity, Postgres for authoritative durable data, Realtime for room synchronization and presence, and Edge Functions only where they are a cleaner boundary than a Next.js route handler. Redis may accelerate or coordinate, but Postgres remains the persisted source of truth.

Use Upstash Redis for cache-aside reads, short-lived vote limits, room tallies, transient presence information, and daily Gemini request-cap tracking. Do not force Redis into persisted relational state. Use append-only Supabase migrations for SQL-specific behavior, RLS, grants, triggers, and functions. Keep TypeScript database types in step with migration changes.

## Realtime and Transcript Rules

The public room must use Supabase Realtime broadcast subscriptions for live events. Server delivery must use the explicit Realtime HTTP delivery method, and browser subscriptions must be cleaned up when the room changes or unmounts. Persisted Supabase Postgres data remains the source of truth; realtime events are delivery signals and must be safe to deduplicate.

All message lists must be ordered deterministically by `created_at` ascending and then numeric `id` ascending. Fetching the latest window must order both keys descending before applying the limit, then reverse or normalize the result to oldest-to-newest. Client event merges must deduplicate by message id and reapply the same ordering helper. On initial render, after initial data arrives, after a companion changes, and after every new realtime message, the active transcript must scroll to its bottom so the latest message is visible. This behavior belongs in a focused hook rather than duplicated inside large presentation components.

## Persona Room Product Rules

Use the exact product name **Persona Room** and persona name **Rina**. The public experience is a chat-first homepage at `/` and a phone-friendly live audience room at `/room/[id]`.

Rina’s supported expressions are exactly `neutral`, `happy`, `surprised`, and `sad/thoughtful`. She speaks in one to three natural, playful, warm sentences; never uses corporate language or says “As an AI”; responds visibly to the user’s emotional tone; occasionally recalls durable user memories; and reacts in-character to audience votes. She must not provide programming, coding, debugging, or other technical-help answers; she should stay in character and gently redirect those requests to conversation.

The UI must keep route-specific loading, error, and not-found states product-centric, cinematic, mobile-friendly, and consistent with the active companion. It must not show a stale default companion during room loading or rely on users clearing browser storage to recover. Validate and safely fall back from malformed local storage rather than allowing runtime exceptions.

## Critical UX & Ordering Rules (MANDATORY)

1. **Deterministic Message Ordering**: All message lists (both private chat and public rooms) must guarantee deterministic multi-key sorting (`created_at` timestamp + numeric `id`) so messages never appear out of order.
2. **Auto-Scroll to Bottom**: Whenever a page loads, initial data arrives, or a new real-time message is appended, the transcript container must immediately auto-scroll to the bottom so the latest message is visible without manual scrolling.
3. **Strict Feature Boundaries**: Feature components must reside under `src/presentation/features` and export strictly via public `index.ts` boundaries.
4. **Focused Presentation Responsibilities**: Global reusable UI belongs in `src/presentation/components`; feature-specific UI belongs in `src/presentation/features/{feature}`; browser subscriptions and synchronization belong in focused hooks under `src/presentation/hooks`.
5. **Server Action Placement**: Server Actions belong under `src/actions`, not inside `src/features`. Features expose domain types and service/repository behavior through public barrels; infrastructure dependencies flow inward and must remain replaceable.
6. **No Legacy or Duplicate App Structures**: Do not create unused `pages/` folders, duplicate route trees, or empty placeholder files. Keep Tailwind utilities and shared design tokens in the existing global stylesheet instead of replacing the design system with scattered component CSS.
7. **Interaction State Discipline**: Use React 19 declarative patterns, structured state or reducers for related interaction fields, and focused hooks for genuine external synchronization. Avoid giant mixed-responsibility components and imperative fetch chains.

## Validation Before Finishing

Run linting, TypeScript checks, and a production build after meaningful changes when feasible. Add focused tests for domain logic and server routes where they materially protect behavior. If verification cannot run, document the reason and the observable impact.

Do not add broad abstractions without a clear payoff, invent provider guarantees, or assume documentation is applied automatically. Keep implementation and documentation aligned with the behavior users can observe.
