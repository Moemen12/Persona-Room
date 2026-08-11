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

## React and Frontend Standards

Favor intentional, premium, accessible UI over generic SaaS boilerplate. The product must work on desktop and mobile, with mobile prioritizing the main information and primary action. Preserve visible focus states and keyboard access.

Do not call `useEffect` directly in normal component code. Prefer derived render state, event handlers, server patterns, and remount semantics. Mount-only synchronization is permitted only for genuine external synchronization such as a browser subscription or third-party lifecycle; use a small named helper with cleanup when repeated. For async client synchronization, use `AbortController` cleanup and never commit results after the signal is aborted.

Use declarative React patterns. When related client-state fields represent one interaction flow, prefer a reducer or one structured state object rather than many loosely coordinated state setters.

## Error Handling and Security

Use typed application errors for predictable failure modes and shared JSON response helpers for routes. Do not leak server, provider, or runtime details to the UI. Broken invariants are internal failures, not normal empty states.

Client-side UI never grants permission. Authorize sensitive actions on the server. Keep the Supabase service-role key and Gemini API key server-only. The browser may use only the Supabase publishable key and a short-lived authenticated access token.

## Supabase, Upstash, and Data

Use Supabase deliberately: Auth for anonymous identity, Postgres for authoritative durable data, Realtime for room synchronization and presence, and Edge Functions only where they are a cleaner boundary than a Next.js route handler. Redis may accelerate or coordinate, but Postgres remains the persisted source of truth.

Use Upstash Redis for cache-aside reads, short-lived vote limits, room tallies, transient presence information, and daily Gemini request-cap tracking. Do not force Redis into persisted relational state. Use append-only Supabase migrations for SQL-specific behavior, RLS, grants, triggers, and functions. Keep TypeScript database types in step with migration changes.

## Persona Room Product Rules

Use the exact product name **Persona Room** and persona name **Rina**. The public experience is a chat-first homepage at `/` and a phone-friendly live audience room at `/room/[id]`.

Rina’s supported expressions are exactly `neutral`, `happy`, `surprised`, and `sad/thoughtful`. She speaks in one to three natural, playful, warm sentences; never uses corporate language or says “As an AI”; responds visibly to the user’s emotional tone; occasionally recalls durable user memories; and reacts in-character to audience votes.

## Validation Before Finishing

Run linting, TypeScript checks, and a production build after meaningful changes when feasible. Add focused tests for domain logic and server routes where they materially protect behavior. If verification cannot run, document the reason and the observable impact.

Do not add broad abstractions without a clear payoff, invent provider guarantees, or assume documentation is applied automatically. Keep implementation and documentation aligned with the behavior users can observe.
