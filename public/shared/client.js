// Shared Supabase client. Every module imports db from here.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";
const ok = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR-PROJECT")
  && SUPABASE_KEY.startsWith("sb_publishable_") && !SUPABASE_KEY.includes("YOUR-PUBLISHABLE");
export const db = ok ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
