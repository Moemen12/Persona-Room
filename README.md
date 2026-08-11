# Persona Room

> **A live virtual persona experience built as a hiring demo for Aria Studios.**

Persona Room lets a visitor chat with **Rina**, a warm, mischievous virtual artist who streams replies, remembers durable details, visibly shifts mood, and reacts in real time to an anonymous audience room.

| Layer | Technology |
| --- | --- |
| Application | Next.js App Router, React, TypeScript, Tailwind CSS |
| Identity and data | Supabase Anonymous Auth, Postgres, Realtime |
| Fast state | Upstash Redis and rate limiting |
| Persona intelligence | Google Gen AI SDK (`@google/genai`) with Gemini `gemini-2.5-flash-lite` |
| Deployment | Vercel |

## Run locally

Use **npm**, not pnpm. Copy `.env.example` to `.env.local`, fill in your Supabase, Upstash, and Gemini values, enable **Anonymous** sign-in in Supabase Auth, and apply `supabase/migrations/20260811143000_persona_room.sql` through the Supabase CLI or SQL editor. Create the server-only `GEMINI_API_KEY` in Google AI Studio and keep the default `GEMINI_MODEL=gemini-2.5-flash-lite` and Redis daily request cap for a bounded demo. Then run `npm install` followed by `npm run dev`.

The primary chat lives at `/`; the Share button exposes the room link at `/room/[id]`. See [`docs/architecture.md`](docs/architecture.md) for the detailed architecture and the three manual wow-moment checks.
