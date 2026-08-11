# Persona Room TODO

## Architecture & Setup
- [x] Configure hybrid clean + feature-based folder structure (features/, lib/, infrastructure/)
- [x] Set up Supabase database schema (users, conversations, memories, sessions, votes)
- [x] Configure Upstash Redis for ephemeral state
- [x] Set up Gemini API integration via server-side tRPC
- [x] Create AGENTS.md with project guidelines

## Core Features
- [x] Implement Manus OAuth authentication flow
- [x] Build landing page with CTA to chat and audience room
- [x] Implement protected chat page with streaming responses
- [x] Implement Rina mood analysis from Gemini responses
- [x] Build mood/expression avatar system (4 variants: neutral, happy, surprised, sad/thoughtful)
- [x] Implement conversation memory persistence
- [x] Build audience room with live transcript (no auth required)
- [x] Implement real-time voting system with vote tally
- [ ] Integrate Supabase Realtime for live updates
- [x] Implement Redis caching for session state and vote counts

## Domain Features
- [x] Chat feature: message streaming, history, context injection
- [x] Persona feature: mood analysis, avatar expression, memory extraction
- [x] Audience feature: voting, transcript broadcast, presence tracking
- [x] Auth feature: Manus OAuth integration, protected routes

## UI Components
- [x] Landing page layout with hero and CTAs
- [x] Chat interface with message history and input
- [x] Avatar component with mood expression crossfade
- [x] Audience room transcript viewer
- [x] Vote buttons and tally display
- [x] Loading states and error handling

## Testing & Validation
- [ ] Write vitest tests for tRPC procedures
- [ ] Test mood analysis accuracy
- [ ] Test realtime updates (Supabase + Redis)
- [ ] Test authentication flow
- [ ] Manual QA: memory persistence across sessions
- [ ] Manual QA: mood expression changes
- [ ] Manual QA: audience voting latency

## Deployment & Delivery
- [ ] Generate Rina avatar images (4 mood variants)
- [ ] Write comprehensive README
- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Test live deployment
