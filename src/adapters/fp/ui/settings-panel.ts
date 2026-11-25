// The settings panel, shared by the title screen and the pause menu. Every change is saved at once
// (saveSettings tells the audio, HUD and engine through onSettingsChange). Choices are on-page
// controls, not native popups, so they work the same with a thumb, a mouse, a keyboard or a gamepad.
import { FP_ICONS, type FpIcon } from "./icons.ts";
import { RANGES, defaultSettings, loadSettings, saveSettings, type FpSettings } from "./settings.ts";

const THEME_KEY = "casework.theme";
type Theme = "dark" | "light" | "system";

function storedTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "system" ? t : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(t: Theme): void {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage blocked */
  }
}

let serial = 0;

export function settingsPanel(onBack?: () => void): HTMLElement {
  const s: FpSettings = loadSettings();
  const id = `fps${++serial}`;
  const sync: (() => void)[] = [];
  const changed = () => saveSettings(s);

  const wrap = document.createElement("div");
  wrap.className = "fp-settings";
  const head = document.createElement("div");
  head.className = "fp-settings-head";
  if (onBack) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fp-icon-btn";
    b.setAttribute("aria-label", "Back");
    b.dataset.fpBack = "";
    b.innerHTML = FP_ICONS.back;
    b.addEventListener("click", onBack);
    head.append(b);
  }
  const h = document.createElement("h2");
  h.textContent = "Settings";
  head.append(h);
  wrap.append(head);

  const row = (icon: FpIcon, label: string, control: HTMLElement, out?: HTMLElement) => {
    const r = document.createElement("div");
    r.className = "fp-set";
    const ic = document.createElement("span");
    ic.className = "fp-set-ic";
    ic.innerHTML = FP_ICONS[icon];
    const l = document.createElement("label");
    l.textContent = label;
    l.htmlFor = control.id;
    r.append(ic, l);
    if (out) r.append(out);
    r.append(control);
    if (control.getAttribute("role") === "switch") r.classList.add("switch-row");
    return r;
  };
  const range = (key: "sensitivity" | "fov" | "volume", icon: FpIcon, label: string, fmt: (v: number) => string) => {
    const [min, max, step] = RANGES[key];
    const i = document.createElement("input");
    i.type = "range";
    i.id = `${id}-${key}`;
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    const out = document.createElement("output");
    out.htmlFor.add(i.id);
    const show = () => {
      out.textContent = fmt(Number(i.value));
      i.style.setProperty("--fill", `${((Number(i.value) - min) / (max - min)) * 100}%`);
    };
    i.addEventListener("input", () => {
      s[key] = Number(i.value);
      show();
      changed();
    });
    sync.push(() => {
      i.value = String(s[key]);
      show();
    });
    return row(icon, label, i, out);
  };
  const toggle = (key: "invertY" | "reducedMotion" | "muted", icon: FpIcon, label: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `${id}-${key}`;
    b.className = "fp-switch";
    b.setAttribute("role", "switch");
    b.innerHTML = "<i></i>";
    const paint = () => b.setAttribute("aria-checked", String(s[key]));
    b.addEventListener("click", () => {
      s[key] = !s[key];
      paint();
      changed();
    });
    sync.push(paint);
    return row(icon, label, b);
  };

  const group = (title: string, ...rows: HTMLElement[]) => {
    const f = document.createElement("fieldset");
    f.className = "fp-group";
    const lg = document.createElement("legend");
    lg.textContent = title;
    f.append(lg, ...rows);
    return f;
  };

  // theme: the same switch as the rest of Casework (casework.theme)
  const themeRow = document.createElement("div");
  themeRow.className = "fp-set";
  themeRow.innerHTML = `<span class="fp-set-ic">${FP_ICONS.sun}</span><span class="fp-set-l" id="${id}-theme-l">Theme</span>`;
  const seg = document.createElement("div");
  seg.className = "fp-seg";
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-labelledby", `${id}-theme-l`);
  const themes: [Theme, string][] = [["dark", "Dark"], ["light", "Light"], ["system", "Auto"]];
  const tbtns = themes.map(([t, l]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.v = t;
    b.textContent = l;
    b.addEventListener("click", () => {
      applyTheme(t);
      paintTheme();
    });
    return b;
  });
  const paintTheme = () => {
    const cur = storedTheme();
    for (const b of tbtns) b.setAttribute("aria-checked", String(b.dataset.v === cur));
  };
  seg.append(...tbtns);
  themeRow.append(seg);
  paintTheme();

  wrap.append(
    group(
      "Looking",
      range("sensitivity", "eye", "Look speed", (v) => `${v.toFixed(2)}×`),
      range("fov", "fov", "Field of view", (v) => `${v}°`),
      toggle("invertY", "invert", "Invert up and down"),
    ),
    group(
      "Sound",
      range("volume", "volume", "Volume", (v) => (v === 0 ? "Off" : `${Math.round(v * 100)}%`)),
      toggle("muted", "mute", "Mute"),
    ),
    group("Comfort", toggle("reducedMotion", "motion", "Reduce motion"), themeRow),
  );
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "fp-link-btn";
  reset.textContent = "Reset to defaults";
  reset.addEventListener("click", () => {
    Object.assign(s, defaultSettings());
    sync.forEach((f) => f());
    changed();
  });
  wrap.append(reset);
  sync.forEach((f) => f());
  return wrap;
}
