// Shared row types mirroring the database schema (supabase/migrations/0001_init.sql).

export type ContactSource = "paste" | "stuntlisting" | "manual";

export interface Contact {
  id: string;
  email: string;
  name: string | null;
  source: ContactSource;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  position: number;
  send_weekday: number | null; // 0=Sun .. 6=Sat
  send_time: string; // 'HH:MM:SS'
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  contact_id: string;
  position: number;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  event_date: string; // 'YYYY-MM-DD'
  event_time: string | null;
  location: string | null;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
  google_event_id: string | null;
  created_at: string;
}

export type SignupStatus = "invited" | "yes" | "no";

export interface Signup {
  id: string;
  session_id: string;
  contact_id: string;
  group_id: string | null;
  token: string;
  status: SignupStatus;
  invited_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface Settings {
  id: boolean;
  reminder_weekday: number;
  reminder_time: string;
  admin_email: string | null;
  timezone: string;
  updated_at: string;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
