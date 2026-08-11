# Visual review notes

The private-chat shell renders successfully at desktop width and confirms the intended two-column composition: a contained Rina identity rail on the left and an enlarged conversation stage on the right. The shell has visible ambient lighting, compact top controls, and a single composed primary interaction.

The sandbox audience URL cannot render a live room because required Supabase environment variables are intentionally absent in the local verification environment. The failure is configuration-related rather than an audience-layout regression. The audience component remains covered by linting, TypeScript validation, and the production build; it will be visually rechecked against a configured local or deployment environment.

## Above-the-fold room fix

A configured local preview confirms the primary **Your turn** vote panel now renders fully in the first desktop viewport beside the compact Rina status card. The transcript remains a bounded scroll region beneath the status card rather than forcing users to scroll through it before voting.

The browser console no longer reports the prior server/client `disabled` attribute hydration mismatch. The only preview-console error is expected: the intentionally placeholder Supabase project rejects the demo room request as unavailable, so no live snapshot can load in this credential-free verification environment.

## Composer and profile refinement review

The configured local preview confirms the profile signals now sit together as a centred, consistent stack above the dedicated companion-change control. The composer label is now visually separate from the textarea, placeholder contrast is materially stronger, and keyboard guidance sits on the field’s header rather than overlapping typed content. The first preview load retained its browser-local companion-choice confirmation as designed; that local flag was reset for a dedicated picker verification next.

## Companion-flow preview limitation

The local placeholder configuration cannot create an anonymous Supabase session, so the browser correctly does not render the authenticated companion picker; it stops at the configuration error before an identity exists. The new picker remains covered by TypeScript and production-build validation. The preview console also reports the expected anonymous-session failure and a hydration notice that needs a separate source review before release; the placeholder session failure is not a production-flow result.
