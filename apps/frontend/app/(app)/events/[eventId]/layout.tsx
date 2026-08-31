import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/server-api";
import type { EventDto } from "@/lib/types";
import { EventNav } from "@/components/event-nav";
import { Crumb } from "@/components/crumb";

export const dynamic = "force-dynamic";

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  let event: EventDto;
  try {
    ({ event } = await serverApi<{ event: EventDto }>(`/events/${eventId}`));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  const isManager = event.myRole === "manager" || event.myRole === "admin";

  return (
    <div>
      <Crumb href="/" label="Alle Events" context={event.name} />
      <EventNav eventId={eventId} isManager={isManager} />
      {children}
    </div>
  );
}
