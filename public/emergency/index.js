// Emergency module entry point. Other modules import ONLY from here.
import { db } from "../shared/client.js";
import { register, t } from "../shared/i18n.js";
import { STRINGS } from "./strings.js";
import { NUMBERS } from "./numbers.js";
import * as api from "./emergency.js";
register(STRINGS);
export * from "./emergency.js";

export async function mountEmergency(root) {
  if (!db) { root.hidden = true; return; }
  root.innerHTML = await (await fetch(new URL("./emergency.html", import.meta.url))).text();
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = new URL("./emergency.css", import.meta.url); document.head.append(css);
  const $ = (id) => root.querySelector("#" + id);
  let houses = [], timer = null;
  const status = (txt, bad) => { $("em-status").textContent = txt; $("em-status").style.color = bad ? "#9b1c1c" : "#14622e"; };
  const labels = () => {
    root.querySelectorAll("[data-i]").forEach((el) => { el.textContent = t(el.dataset.i); });
    const keep = $("em-kind").value;
    $("em-kind").innerHTML = "";
    ["fire", "safety", "medical", "other"].forEach((k) => { const o = document.createElement("option"); o.value = k; o.textContent = t("emergency.kind." + k); $("em-kind").append(o); });
    if (keep) $("em-kind").value = keep;
    $("em-nums").innerHTML = ""; NUMBERS.forEach((n) => { const a = document.createElement("a"); a.href = "tel:" + n; a.textContent = n; $("em-nums").append(a); });
  };
  const current = () => houses.find((h) => h.id === $("em-house").value);
  async function renderAlerts() {
    try {
      const rows = await api.fetchAlerts(db), ul = $("em-list"); ul.innerHTML = "";
      if (!rows.length) { const li = document.createElement("li"); li.textContent = t("emergency.none"); ul.append(li); return; }
      rows.forEach((r) => {
        const li = document.createElement("li"); li.className = r.level;
        const p = document.createElement("strong"); p.textContent = t(r.level === "red" ? "emergency.red" : "emergency.normal"); li.append(p);
        if (r.kind) { const d = document.createElement("div"); d.textContent = t("emergency.kind." + r.kind) + (r.note ? ": " + r.note : ""); li.append(d); }
        const when = document.createElement("div"); when.textContent = new Date(r.created_at).toLocaleString(); li.append(when);
        if (r.mine) {
          [["emergency.resolve", api.resolveAlert], ["emergency.delete", api.deleteAlert]].forEach(([k, fn]) => {
            const b = document.createElement("button"); b.textContent = t(k);
            b.onclick = async () => { try { await fn(db, r.id); renderAlerts(); } catch { status(t("emergency.error"), true); } };
            li.append(b);
          });
        }
        ul.append(li);
      });
    } catch { status(t("emergency.error"), true); }
  }
  async function load() {
    houses = await api.myHouses(db);
    $("em-house").innerHTML = ""; houses.forEach((h) => { const o = document.createElement("option"); o.value = h.id; o.textContent = h.label; $("em-house").append(o); });
    $("em-form").hidden = !houses.length;
    if (!houses.length) status(t("emergency.nohouse"));
    if (houses.length) $("em-optin").checked = await api.getOptIn(db, current().areaId);
    await renderAlerts();
  }
  $("em-house").onchange = async () => { $("em-optin").checked = await api.getOptIn(db, current().areaId); };
  $("em-optin").onchange = async () => {
    try { await api.setOptIn(db, current().areaId, $("em-optin").checked); status(t("emergency.optin_saved")); }
    catch { status(t("emergency.error"), true); }
  };
  $("em-raise").onclick = async () => {
    const h = current(); if (!h) return;
    try { await api.raiseEmergency(db, { houseId: h.id, areaId: h.areaId, kind: $("em-kind").value, note: $("em-note").value.trim() }); $("em-note").value = ""; status(t("emergency.sent")); renderAlerts(); }
    catch (e) { status(t(/row-level|policy/i.test(e.message) ? "emergency.blocked" : "emergency.error"), true); }
  };
  async function sync() {
    const { data } = await db.auth.getSession(); root.hidden = !data.session; clearInterval(timer);
    if (data.session) { labels(); try { await load(); } catch { status(t("emergency.error"), true); } timer = setInterval(() => { if (!document.hidden) renderAlerts(); }, 20000); }
  }
  window.addEventListener("ak-language", () => { labels(); renderAlerts(); });
  db.auth.onAuthStateChange(() => { sync(); });
  await sync();
}
