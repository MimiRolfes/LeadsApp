import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/server-api";
import type { EventDto, LeadDetailDto, QuestionDto } from "@/lib/types";
import { LeadDetail } from "@/components/lead-detail";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  let detail: LeadDetailDto;
  try {
    detail = await serverApi<LeadDetailDto>(`/leads/${leadId}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  const [{ event }, questionsRes] = await Promise.all([
    serverApi<{ event: EventDto }>(`/events/${detail.lead.eventId}`),
    serverApi<{ questions: QuestionDto[] }>(
      `/events/${detail.lead.eventId}/questions?archived=true`,
    ),
  ]);
  const isManager = event.myRole === "manager" || event.myRole === "admin";

  return (
    <LeadDetail
      initial={detail}
      questions={questionsRes.questions}
      eventName={event.name}
      isManager={isManager}
    />
  );
}
