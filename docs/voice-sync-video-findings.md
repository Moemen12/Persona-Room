# Voice Synchronization Video Findings

Source: `/home/ubuntu/upload/Screencastfrom2026-08-1219-48-48.mp4`

The assistant response appears as a complete text block at approximately 00:07. Voice preparation is visible, and audio begins around 00:08, creating an approximately one-second delay after the full text is already exposed. The key issue is not missing streaming text; it is that the entire response becomes readable before narration begins, so the visual content is ahead of the listening experience.

Recommended behavior: use a first-sentence gate. Keep the assistant bubble in a preparing/typing state while the response is streaming and before the first complete sentence is ready. Once the first sentence's audio playback actually starts, reveal that sentence and then reveal the rest of the text progressively as speech chunks begin. Do not wait for the entire response, because that would reintroduce the long latency that the sentence-streamed voice system was designed to remove.

Implementation implication: the voice hook needs an explicit playback-start notification or readiness state, and the chat transcript needs a separate visible-text projection rather than rendering the raw streamed message immediately. The gate must have a safe fallback: if voice is disabled, unsupported, or synthesis fails, reveal the text without waiting for audio.
