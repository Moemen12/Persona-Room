# Persona Room architecture

## Objective

Persona Room is being rebuilt as a single **Next.js App Router** application operated with **npm**. It keeps the product flow specified for Rina while adopting MindArena’s project conventions: a `src/` root, server-component-first pages, a clean `app`/`features`/`infrastructure`/`presentation` split, validated runtime configuration, and Supabase migrations stored in source control.

## Technology decisions

| Concern | Implementation |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Package manager | npm with `package-lock.json`; no pnpm lockfile or pnpm metadata |
| Identity and durable data | Supabase anonymous authentication and Postgres |
| Live room behavior | Supabase Realtime broadcast and presence channels, scoped as `room:{sessionId}` |
| Cache and rate limiting | Upstash Redis and Upstash rate limiter |
| Model interaction | Vercel AI SDK plus OpenAI `gpt-4o-mini`, invoked server-side only |
| Deployment target | Vercel, with all privileged credentials configured as server-only environment variables |

AWS SDK/S3, Vite, Express, Wouter, MySQL, Gemini, and the old Manus-template runtime are intentionally removed. No client code receives a service-role key or an OpenAI key.

## Project layout

```text
src/
  app/
    api/chat/route.ts                # token-streaming persona response
    api/rooms/[id]/route.ts          # room bootstrap data
    api/rooms/[id]/vote/route.ts     # validated, rate-limited vote
    room/[id]/page.tsx               # audience room route
    layout.tsx
    page.tsx                          # primary Persona Room chat experience
  features/
    auth/                             # anonymous identity helpers
    chat/                             # schemas, prompt builder, server orchestration
    audience/                         # vote schemas and room service
    persona/                          # Rina moods/types and UI-to-model mapping
  infrastructure/
    config/routes.ts                 # central route helpers
    shared/env.ts                     # Zod runtime validation
    supabase/                         # browser and server/admin clients
    redis/                            # Upstash client and cache helpers
  lib/
    config/app.ts                    # shared product constants
    errors.ts                         # typed application errors
    utils.ts                          # small shared helpers
  presentation/
    components/                       # focused chat, avatar, audience components
    hooks/                            # external browser/realtime synchronization
    styles/globals.css
supabase/
  migrations/                         # append-only schema and RLS SQL
public/rina/                          # four generated expression portraits
```

## Server request flow

The browser authenticates anonymously with Supabase, then sends its short-lived access token to the Next.js chat route along with the Vercel AI SDK UI message history and the active session ID. The route verifies the token, resolves the internal Persona Room user, reads the Redis profile cache, and falls back to Supabase Postgres on a miss. It makes a small structured emotion classification request, updates Rina’s mood cache, and streams the persona reply from `gpt-4o-mini`.

Once the streamed response finishes, the server writes both durable conversation rows, extracts at most two user facts, prunes memories to six, refreshes the profile cache, and broadcasts an assistant-message event to the room. This server-owned write path is deliberately more secure and reliable than asking a browser to persist conversation data after a stream.

## Audience and vote flow

The audience page creates a local anonymous fingerprint but does not require Supabase sign-in. A vote passes through a validated route that applies a five-second Redis sliding-window limit to the fingerprint and room pair, writes the durable vote with the service-role client, increments the short-lived Redis tally, and broadcasts an updated tally to the room channel. The endpoint also creates a brief in-character reaction for Rina and broadcasts it so the owner’s chat and the audience transcript update in seconds.

Presence is tracked on the same Supabase Realtime channel. The chat and audience UIs subscribe to room broadcasts and use the channel presence state to display a live viewer count. Realtime is a delivery accelerator; PostgreSQL remains the durable source of truth.

## Security and operational limits

The database schema uses a random internal user ID plus the Supabase `auth.users` ID. RLS policies check ownership through `users.supabase_auth_id = auth.uid()`, rather than incorrectly comparing the two distinct IDs. Server-only routes use the service-role client only for operations that cannot be safely performed by the public client. The chat route checks a Redis daily budget key before calling the model and responds gracefully when service dependencies are unavailable.

## Required environment variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
OPENAI_API_KEY=
```

## Verification plan

The migration will be verified with `npm run lint`, `npm run check`, and `npm run build`. The project cannot make real Supabase, Upstash, or OpenAI requests until valid user-owned environment variables are supplied; the code will nevertheless include the complete schema, guards, routes, and setup documentation needed for deployment.
