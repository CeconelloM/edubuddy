import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);

export type Profile = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  email: string | null;
  english_level: string | null;
  daily_goal: number | null;
  messages_sent_today: number | null;
  current_streak: number | null;
  last_message_date: string | null;
  created_at: string;
  role: string;
};
