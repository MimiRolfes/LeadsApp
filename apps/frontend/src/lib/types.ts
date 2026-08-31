import type {
  ConsentStatus,
  EventStatus,
  LeadPriority,
  LegalBasis,
} from "@humatter-leads/shared";

/** Antwort-Formen des Backends (nur die im Frontend genutzten Felder). */

export interface EventDto {
  id: string;
  name: string;
  location: string | null;
  startsOn: string | null;
  endsOn: string | null;
  status: EventStatus;
  retentionDays: number | null;
  myRole?: string | null;
}

export interface QuestionDto {
  id: string;
  prompt: string;
  type:
    | "text"
    | "textarea"
    | "single_select"
    | "multi_select"
    | "boolean"
    | "number";
  options: { value: string; label: string }[] | null;
  position: number;
  required: boolean;
  archivedAt: string | null;
}

export interface LeadDto {
  id: string;
  eventId: string;
  ownerId: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  priority: LeadPriority | null;
  leadScore: number | null;
  legalBasis: LegalBasis;
  consentStatus: ConsentStatus;
  version: number;
  createdAt: string;
}

export interface LeadDetailDto {
  lead: LeadDto;
  answers: { questionId: string; value: unknown }[];
  notes: {
    id: string;
    body: string;
    authorId: string | null;
    createdAt: string;
  }[];
  tags: string[];
}

export interface EventMemberDto {
  userId: string;
  email: string;
  displayName: string;
  eventRole: "manager" | "member" | "readonly";
}

export interface EventStatsDto {
  leads: {
    total: number;
    hot: number;
    warm: number;
    cold: number;
    unrated: number;
    qualified: number;
    withConsent: number;
    anonymized: number;
  };
  followups: { open: number; done: number; overdue: number };
  teamSize: number;
  byOwner: {
    userId: string | null;
    displayName: string | null;
    count: number;
  }[];
  byDay: { day: string; count: number }[];
}
