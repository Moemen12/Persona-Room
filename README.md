# Persona Room

> **A live virtual persona experience built as a hiring demo for Aria Studios.**

Persona Room lets a visitor choose **Rina** or **Joon** for a private, streaming conversation. Each companion has a distinct portrait, voice, and private history; both remember durable details, visibly shift mood, and react in real time to an anonymous audience room.

| Layer | Technology |
| --- | --- |
| Application | Next.js App Router, React, TypeScript, Tailwind CSS |
| Identity and data | Supabase Anonymous Auth, Postgres, Realtime |
| Fast state | Upstash Redis and rate limiting |
| Persona intelligence | Google Gen AI SDK (`@google/genai`) with Gemini `gemini-2.5-flash-lite` |
| Deployment | Vercel |

## Run locally

Use **npm**, not pnpm. Copy `.env.example` to `.env.local`, fill in your Supabase, Upstash, and Gemini values, enable **Anonymous** sign-in in Supabase Auth, and apply both `supabase/migrations/20260811143000_persona_room.sql` and `supabase/migrations/20260811153000_add_session_companion.sql` through the Supabase CLI or SQL editor. Create the server-only `GEMINI_API_KEY` in Google AI Studio and keep the default `GEMINI_MODEL=gemini-2.5-flash-lite` and Redis daily request cap for a bounded demo. Then run `npm install` followed by `npm run dev`.

The primary chat lives at `/`; the first room entry presents the companion choice and the profile card lets the visitor change it later. The Share button exposes the room link at `/room/[id]`. See [`docs/architecture.md`](docs/architecture.md) for the detailed architecture and [`docs/companion-selection.md`](docs/companion-selection.md) for the selection boundary and UI rationale.
