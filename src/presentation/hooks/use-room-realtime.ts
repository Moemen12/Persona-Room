"use client";

import { useEffect, useEffectEvent } from "react";

import type { RoomBroadcast } from "@/features/audience";
import { getSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

interface UseRoomRealtimeOptions {
  roomId?: string;
  onEvent: (event: RoomBroadcast) => void;
  onViewerCount: (count: number) => void;
}

/** Synchronizes a Supabase room channel, which is an external browser subscription. */
export function useRoomRealtime({ roomId, onEvent, onViewerCount }: UseRoomRealtimeOptions) {
  const onRoomEvent = useEffectEvent(onEvent);
  const onPresenceChange = useEffectEvent(onViewerCount);

  useEffect(() => {
    if (!roomId) return;

    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`room:${roomId}`)
      .on("broadcast", { event: "room-event" }, ({ payload }) => {
        onRoomEvent(payload as RoomBroadcast);
      })
      .on("presence", { event: "sync" }, () => {
        onPresenceChange(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ joinedAt: new Date().toISOString() });
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [roomId]);
}
