## Browser verification — 2026-08-13

The local sandbox browser could not initialize the app because its environment is missing required public configuration. The console reports `ConfigurationError: This room is not configured yet.` from `getSupabaseBrowserClient()` during `ChatExperience` initialization. The visible shell therefore renders a fallback setup error and cannot open the companion picker; this is an environment issue in the sandbox, not evidence that the picker interaction itself is broken.

The supplied screen recording was analyzed separately. It shows the assistant reply appearing after text generation, then disappearing when `Preparing voice...` begins, and reappearing after audio is ready. The transcript gate must therefore remain active from the submitted turn until playback starts or voice fallback/timeout completes.
