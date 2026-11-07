// Opt-in settings entry point. Other modules import ONLY from here.
import { db } from "../shared/client.js";
import { register, t } from "../shared/i18n.js";
import { STRINGS } from "./strings.js";
import * as api from "./optin.js";
register(STRINGS);
export * from "./optin.js";

export async function mountOptIn(root) {
  if (!db) { root.hidden = true; return; }
  root.innerHTML = await (await fetch(new URL("./optin.html", import.meta.url))).text();
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = new URL("./optin.css", import.meta.url); document.head.append(css);
  const $ = (id) => root.querySelector("#" + id);
  let rows = [];
  const status = (txt, bad) => { $("oi-status").textContent = txt; $("oi-status").style.color = bad ? "var(--oi-error-text)" : "var(--oi-saved-text)"; };
  function draw() {
    root.querySelectorAll("[data-i]").forEach((el) => { el.textContent = t(el.dataset.i); });
    const ul = $("oi-list"); ul.innerHTML = "";
    if (!rows.length) { const li = document.createElement("li"); li.textContent = t("optin.none"); ul.append(li); return; }
    rows.forEach((r) => {
      const li = document.createElement("li"), label = document.createElement("label"), box = document.createElement("input");
      box.type = "checkbox"; box.checked = r.on;
      box.onchange = async () => {
        try { await api.setAlerts(db, r.id, box.checked); r.on = box.checked; status(t("optin.saved")); }
        catch { box.checked = r.on; status(t("optin.error"), true); }
      };
      const text = document.createElement("span"); text.textContent = t("optin.switch") + " " + r.name;
      label.append(box, text); li.append(label); ul.append(li);
    });
  }
  async function sync() {
    const { data } = await db.auth.getSession(); root.hidden = !data.session;
    if (!data.session) return;
    try { rows = await api.listSettings(db); draw(); } catch { status(t("optin.error"), true); }
  }
  window.addEventListener("ak-language", draw);
  db.auth.onAuthStateChange(() => { sync(); });
  await sync();
}
