export const appRoutes = {
  home: "/",
  room: (sessionId: string) => `/room/${sessionId}`,
  api: {
    chat: "/api/chat",
    voice: "/api/voice",
    voiceStream: "/api/voice/stream",
    voiceTranscribe: "/api/voice/transcribe",
    session: "/api/session",
    room: (sessionId: string) => `/api/rooms/${sessionId}`,
    vote: (sessionId: string) => `/api/rooms/${sessionId}/vote`,
  },
} as const;
