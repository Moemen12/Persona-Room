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

## Kokoro.js Evaluation and Final Decision

Kokoro.js was evaluated as a free local English TTS option. Its official package documentation lists English voices and browser execution through Transformers.js with WebGPU/WASM. It does not provide the Korean or Arabic voices required by Persona Room, and its browser model download was observed to reach roughly 195 MB in the local development environment and remain incomplete for many minutes.

The local-model approach was rejected for the MVP because the download cost and first-use latency damage the product experience. Persona Room instead keeps neural synthesis server-side through the existing `/api/voice` boundary: the browser receives a small MP3 response, Edge Neural selects English, Korean, or Arabic voices, Upstash caches repeated audio, and browser Speech Synthesis remains the final fallback. The application does not ship Kokoro.js or a large neural model to browsers.

Sources:
- https://www.npmjs.com/package/kokoro-js
- https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- https://huggingface.co/posts/Xenova/503648859052804
