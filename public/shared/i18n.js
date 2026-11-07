// Shared language service (like a Godot autoload). Modules register their own text and ask by key.
const strings = {};
const NAMES = { en: "English", ha: "Hausa", yo: "Yorùbá", ig: "Igbo", pcm: "Pidgin" };
let lang = "en";
try { lang = localStorage.getItem("ak-lang") || "en"; } catch {}
export const register = (dict) => { for (const l in dict) strings[l] = { ...(strings[l] || {}), ...dict[l] }; };
export const t = (key) => strings[lang]?.[key] ?? strings.en?.[key] ?? key; // falls back to English
export const getLang = () => lang;
export function setLang(l) {
  lang = l; try { localStorage.setItem("ak-lang", l); } catch {}
  document.documentElement.lang = l; window.dispatchEvent(new Event("ak-language"));
}
export function mountLanguageSwitcher(el) {
  el.innerHTML = ""; const s = document.createElement("select"); s.setAttribute("aria-label", "Language");
  Object.keys(strings).forEach((l) => { const o = document.createElement("option"); o.value = l; o.textContent = NAMES[l] || l; s.append(o); });
  s.value = lang in strings ? lang : "en"; s.onchange = () => setLang(s.value); el.append(s);
}
