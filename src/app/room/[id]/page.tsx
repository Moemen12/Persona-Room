import { notFound } from "next/navigation";

import { AudienceExperience } from "@/presentation/components/audience-experience";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) notFound();
  return <AudienceExperience roomId={id} />;
}
