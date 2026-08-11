export const appRoutes = {
  home: "/",
  room: (sessionId: string) => `/room/${sessionId}`,
  api: {
    chat: "/api/chat",
    session: "/api/session",
    room: (sessionId: string) => `/api/rooms/${sessionId}`,
    vote: (sessionId: string) => `/api/rooms/${sessionId}/vote`,
  },
} as const;
