# Edge TTS Research Notes

## Sources

- https://www.npmjs.com/package/edge-tts-universal
- https://github.com/travisvn/openai-edge-tts
- https://jsr.io/@ericc/edge-tts

## Verified findings

The npm package `edge-tts-universal` version 1.4.0 supports Node.js 18.17+, 20.9+, and 22+, and exposes a Node-oriented `EdgeTTS` class. Its `EdgeTTS(text, voice, options).synthesize()` method returns a Blob-like audio result plus subtitle word boundaries. The package README states that direct browser connections are limited by a custom WebSocket header requirement and are reliable on the server side; Chrome, Firefox, and Safari browser-direct use is blocked in v1.4.0. Therefore Persona Room should synthesize on the Next.js Node.js server and return audio to the browser.

The package documents voice identifiers including `en-US-AvaMultilingualNeural`, `en-US-AriaNeural`, `en-US-GuyNeural`, `en-US-JennyNeural`, `ko-KR-SunHiNeural`, and `ko-KR-InJoonNeural`. A local smoke test successfully synthesized `en-US-AvaMultilingualNeural` audio with 14,400 bytes and 6 subtitle word boundaries.

The GitHub project `travisvn/openai-edge-tts` is a separate GPL-3.0 licensed self-hosted service that uses Microsoft Edge TTS. It requires a persistent Python/Docker service and is not being used for the current Next.js integration.

## Implementation decision

Use `edge-tts-universal` as a server-side dependency, protect `/api/voice` with the existing Supabase access-token/session checks, synthesize companion-specific voices on the server, and cache short MP3 responses in Upstash Redis. Keep all paid ElevenLabs APIs out of the MVP.

## Local smoke-check

The local homepage loaded successfully with the new voice control rendered in the chat header. In the sandbox browser, Supabase environment settings were unavailable, so the session bootstrap failed and the control correctly displayed `Browser voice is unavailable`; this is an environment/configuration state, not a TypeScript or build failure. The production build includes `/api/voice` successfully.

## Kokoro.js and Hybrid Voice Findings

Verified from the official `kokoro-js` package documentation and the ONNX model card: Kokoro.js runs locally through Transformers.js, supports WebGPU/WASM, and offers English voices such as `af_bella` and `am_michael`. The documented voice list is English (American and British) and does not include Korean or Arabic voices. The quantized model is approximately 92 MB; the full fp32 model is substantially larger. The package supports streaming generation, but local browser generation should be isolated in a Web Worker and loaded only after voice opt-in or during idle time.

Persona Room therefore uses a hybrid policy: Kokoro local neural synthesis for English, Edge Neural server synthesis for Korean/Arabic, and browser Speech Synthesis as the final fallback. The local model is not downloaded during initial page render, respects `navigator.connection.saveData` and slow-network signals, and chooses WebGPU when available or quantized WASM otherwise.

Sources:
- https://www.npmjs.com/package/kokoro-js
- https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- https://huggingface.co/posts/Xenova/503648859052804
