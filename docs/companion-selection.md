# Companion selection and interface refinement

## Interaction model

The private-room entry point will offer two equal companion choices before the conversation becomes active. **Rina** is the existing female virtual artist: playful, luminous, and a little mischievous. **Joon** is a new male night-radio artist: warm, observant, and quietly confident. The choice controls the visible portrait, the assistant name and introductory copy, and the server-side system instruction. It does not infer the visitor’s gender or impose gender stereotypes; the selected companion keeps boundaries, warmth, and playful tone regardless of the visitor.

The user can return to this choice from the profile rail through a clear “change companion” control. A selection is persisted on the active server-owned session, so refreshes, streaming requests, and audience context agree on the same persona.

## Technical boundary

The `sessions` table receives a constrained `companion_id` column through an append-only migration. The authenticated `/api/session` route exposes and updates this selection only after resolving the supplied Supabase access token and verifying that its user owns the target session. The Gemini chat service reads the selection from the persisted session rather than trusting a browser-provided model instruction.

## Interface refinements

The transcript and composer use one shared thin, rounded scrollbar treatment. The composer gains a visible field label, stronger placeholder contrast, a predictable auto-growing text area capped at a compact height, and metadata positioned beneath the field rather than over the text. Profile presence and mood information are grouped and vertically centred as one profile-status stack.
