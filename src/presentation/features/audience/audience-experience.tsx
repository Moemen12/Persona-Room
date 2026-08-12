import { getRoomSnapshot } from "@/features/audience/audience.service";

import { AudienceRoomLive } from "./audience-room-live";

interface AudienceExperienceProps {
  roomId: string;
}

export async function AudienceExperience({ roomId }: AudienceExperienceProps) {
  const snapshot = await getRoomSnapshot(roomId);
  return <AudienceRoomLive roomId={roomId} initialSnapshot={snapshot} />;
}
