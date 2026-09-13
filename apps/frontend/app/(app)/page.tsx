import { serverApi } from "@/lib/server-api";
import type { EventDto } from "@/lib/types";
import { EventsView } from "./events-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Reihenfolge kommt vom Backend (neueste zuerst).
  const { events } = await serverApi<{ events: EventDto[] }>("/events");
  return <EventsView initialEvents={events} />;
}
