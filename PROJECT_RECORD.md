# AreaKey – Project Record (handoff)

**What:** Concept prototype of a neighbourhood platform built on Nigeria's National Digital Postcode. Independent project, not a government agency. Audience: NIPOST / government innovation bodies. Test data only.

**Rules from the product owner**
- One module at a time, explain before big changes, don't touch unrelated modules.
- Vanilla HTML/CSS/JS, no Tailwind/Bootstrap. Simple, formal, Nigerian-government-site look.
- Never fake NIPOST responses, never invent endpoints. Postcode and invitation codes are NOT proof of identity or residence.
- Privacy (NDPA 2023): only house members see their resident list; area owners/admins cannot. Invitations expire and can be revoked. Secrets stay server-side.
- Emergency Help is out of the prototype (later: signposting to official channels only, no claim of being an emergency service).

**Stack:** Supabase (Postgres + Auth + RLS), static frontend on Vercel.

**Built (core)**
- `supabase/schema.sql`: areas, houses, house_members, invitations, help_requests + RLS + `redeem_invitation()`.
- `public/`: signup/login, create area, register house, create invitation, join by code, post/list help requests.

**Not built / pending**
- NIPOST validation: needs credentials and official docs. Plan: a server-side function (Vercel function or Supabase Edge Function) holds the key, calls the official API, and is the only thing allowed to set `postcode_verified = true` (no client policy permits it).
- Proposed later modules: Area Home, Emergency Help, Local Services, Administration, Request Tracking.

**Setup**
1. Create Supabase project (nearest region), run `supabase/schema.sql`.
2. Put project URL + publishable key in `public/config.js` (never the secret key).
3. Deploy `public/` to Vercel. Check Supabase email-confirmation settings for sign-up.

**Open questions**
- NIPOST access level, terms, API docs.
- How residents add houses to an existing area (currently only the area owner registers houses).
- Moderation/admin roles that do not expose household lists.
- Identity verification route (decision for the partner agency).
- Privacy notice text, NDPC registration check, data hosting region.

**Status:** Core written, untested against a live Supabase project.
