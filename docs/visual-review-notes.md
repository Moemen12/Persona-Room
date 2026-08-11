# Visual review notes

The private-chat shell renders successfully at desktop width and confirms the intended two-column composition: a contained Rina identity rail on the left and an enlarged conversation stage on the right. The shell has visible ambient lighting, compact top controls, and a single composed primary interaction.

The sandbox audience URL cannot render a live room because required Supabase environment variables are intentionally absent in the local verification environment. The failure is configuration-related rather than an audience-layout regression. The audience component remains covered by linting, TypeScript validation, and the production build; it will be visually rechecked against a configured local or deployment environment.

## Above-the-fold room fix

A configured local preview confirms the primary **Your turn** vote panel now renders fully in the first desktop viewport beside the compact Rina status card. The transcript remains a bounded scroll region beneath the status card rather than forcing users to scroll through it before voting.

The browser console no longer reports the prior server/client `disabled` attribute hydration mismatch. The only preview-console error is expected: the intentionally placeholder Supabase project rejects the demo room request as unavailable, so no live snapshot can load in this credential-free verification environment.
