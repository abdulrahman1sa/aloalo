import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface Message {
    id: string;
    text: string;
    sender: string;
    avatar: string | null;
    channel_id: string;
    created_at: string;
}

export interface Channel {
    id: string;
    name: string;
    type: "text" | "voice";
    server_id: string;
    created_at: string;
}
