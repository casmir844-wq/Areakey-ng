import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);

// ---------- Plain-language messages ----------
const PLAIN = [
  [/invalid login credentials/i, "Email or password is not correct."],
  [/email not confirmed/i, "Your email is not confirmed yet. Check your inbox, or ask the site owner to turn off email confirmation for testing."],
  [/user already registered/i, "An account with this email already exists. Try logging in."],
  [/password should be at least/i, "Password must be at least 8 characters."],
  [/row-level security|row level security|violates row/i, "You do not have permission to do that, or the database is not set up yet."],
  [/relation .* does not exist|could not find the table|schema cache/i, "The database tables are missing. The site owner needs to run the database setup (schema.sql)."],
  [/invalid or expired code/i, "That invitation code is wrong, expired or was cancelled."],
  [/not signed in/i, "Please log in first."],
  [/failed to fetch|network/i, "Cannot reach the server. Check your internet connection and try again."],
  [/duplicate key/i, "That already exists."],
  [/check constraint|violates check/i, "One of the fields is not in the correct format. Check the lengths and characters."],
];
function plain(err) {
  const raw = (err && (err.message || err.error_description || err.details)) || "";
  const hit = PLAIN.find(([re]) => re.test(raw));
  return hit ? hit[1] : "Something went wrong. Please try again. (Details: " + raw + ")";
}

// ---------- Status line ----------
function say(text, kind = "info") {
  const el = $("msg");
  el.textContent = text;
  el.className = kind; // info | ok | error
}

// ---------- Config check ----------
const configOk = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR-PROJECT")
  && SUPABASE_KEY.startsWith("sb_publishable_") && !SUPABASE_KEY.includes("YOUR-PUBLISHABLE");
const db = configOk ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const checks = { config: $("chk-config"), tables: $("chk-tables"), account: $("chk-account") };
function tick(el, ok, label) {
  el.textContent = (ok ? "✔ " : "✖ ") + label;
  el.className = ok ? "pass" : "fail";
}
async function setupCheck() {
  tick(checks.config, configOk, configOk ? "Configuration file is filled in" : "Configuration file is not filled in (config.js)");
  if (!db) { tick(checks.tables, false, "Database not checked"); tick(checks.account, false, "Account not checked"); return; }
  const { error } = await db.from("areas").select("id").limit(1);
  tick(checks.tables, !error, error ? "Database tables not reachable: " + plain(error) : "Database tables are ready");
  const { data } = await db.auth.getSession();
  tick(checks.account, true, data.session ? "Signed in" : "Not signed in yet");
}

// ---------- Auth ----------
async function refresh() {
  if (!db) { $("auth").hidden = true; $("app").hidden = true; say("The site is not connected yet. Fill in config.js.", "error"); await setupCheck(); return; }
  const { data } = await db.auth.getSession();
  const signedIn = !!data.session;
  $("auth").hidden = signedIn; $("app").hidden = !signedIn; $("logout").hidden = !signedIn;
  if (signedIn) { say("You are logged in.", "ok"); await loadAll(); }
  else say("Please log in or create an account to continue.", "info");
  await setupCheck();
}

$("signup").onclick = async () => {
  if (!db) return;
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || password.length < 8) return say("Enter an email and a password of at least 8 characters.", "error");
  say("Creating your account…");
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) return say(plain(error), "error");
  if (data.session) { say("Account created and you are logged in.", "ok"); return refresh(); }
  say("Account created. Email confirmation is still on, so check your inbox before logging in. (Site owner: turn off Confirm email in Supabase for testing.)", "ok");
};

$("login").onclick = async () => {
  if (!db) return;
  say("Logging in…");
  const { error } = await db.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  if (error) return say(plain(error), "error");
  await refresh();
};

$("logout").onclick = async () => { await db.auth.signOut(); await refresh(); };

// ---------- Loading (RLS decides what each user sees) ----------
function fill(sel, rows, text) {
  $(sel).innerHTML = "";
  if (!rows.length) { const o = document.createElement("option"); o.textContent = "(none yet)"; o.value = ""; $(sel).append(o); return; }
  rows.forEach((r) => { const o = document.createElement("option"); o.value = r.id; o.textContent = text(r); $(sel).append(o); });
}
async function loadAll() {
  const [areas, houses, help] = await Promise.all([
    db.from("areas").select("id,name,postcode,postcode_verified"),
    db.from("houses").select("id,label"),
    db.from("help_requests").select("title,details,status,created_at").order("created_at", { ascending: false }),
  ]);
  if (areas.error) return say(plain(areas.error), "error");
  fill("area-select", areas.data, (a) => `${a.name} (${a.postcode}, ${a.postcode_verified ? "verified" : "not verified"})`);
  fill("house-select", houses.data || [], (h) => h.label);
  const list = $("help-list"); list.innerHTML = "";
  (help.data || []).forEach((r) => {
    const li = document.createElement("li");
    li.textContent = `${r.title} [${r.status}]${r.details ? " – " + r.details : ""}`;
    list.append(li);
  });
  if (!help.data?.length) list.innerHTML = "<li>No requests yet.</li>";
}

// ---------- Actions ----------
async function act(label, fn, okText) {
  say(label + "…");
  try { await fn(); say(okText, "ok"); await loadAll(); }
  catch (e) { say(plain(e), "error"); }
}

$("create-area").onclick = () => {
  const postcode = $("area-postcode").value.trim().toUpperCase();
  const name = $("area-name").value.trim();
  if (name.length < 3) return say("Neighbourhood name must be at least 3 characters.", "error");
  if (!/^[A-Z0-9]{11}$/.test(postcode)) return say("Postcode must be exactly 11 letters or numbers, for example EK01A03FK01.", "error");
  return act("Saving neighbourhood", async () => {
    const { error } = await db.from("areas").insert({ name, postcode });
    if (error) throw error;
  }, "Neighbourhood created. Its postcode is saved as NOT verified, because NIPOST checking is not connected yet.");
};

$("create-house").onclick = () => act("Registering house", async () => {
  const { data: u } = await db.auth.getUser();
  const { data: house, error } = await db.from("houses")
    .insert({ area_id: $("area-select").value, label: $("house-label").value.trim() })
    .select("id").single();
  if (error) throw error;
  const { error: e2 } = await db.from("house_members")
    .insert({ house_id: house.id, user_id: u.user.id, display_name: $("my-name").value.trim() });
  if (e2) throw e2;
}, "House registered. You are a member of it.");

$("make-invite").onclick = async () => {
  say("Creating invitation code…");
  const { data, error } = await db.from("invitations").insert({ house_id: $("house-select").value }).select("code,expires_at").single();
  if (error) return say(plain(error), "error");
  $("invite-out").textContent = `Code: ${data.code} (valid until ${new Date(data.expires_at).toLocaleString()}). Share it only with the person you want to invite.`;
  say("Invitation code created.", "ok");
};

$("join").onclick = () => act("Joining house", async () => {
  const { error } = await db.rpc("redeem_invitation", { p_code: $("join-code").value, p_name: $("join-name").value });
  if (error) throw error;
}, "You joined the house.");

$("post-help").onclick = () => {
  const title = $("help-title").value.trim();
  if (title.length < 3) return say("Please describe what you need in at least 3 characters.", "error");
  return act("Posting request", async () => {
    const { error } = await db.from("help_requests").insert({
      area_id: $("area-select").value, title, details: $("help-details").value.trim() || null,
    });
    if (error) throw error;
    $("help-title").value = ""; $("help-details").value = "";
  }, "Request posted.");
};

refresh();
