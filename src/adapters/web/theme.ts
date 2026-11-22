// The theme switch: Dark (default), Light, or Auto (follow the device). The choice is remembered in
// this browser. Each page's <head> applies the stored choice before first paint (see THEME_BOOT in
// the HTML), so there's no flash of the wrong theme.
const KEY = "casework.theme";
type Theme = "dark" | "light" | "system";
const LABEL: Record<Theme, string> = { dark: "Dark", light: "Light", system: "Auto" };

function stored(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "system" ? t : "dark";
  } catch {
    return "dark";
  }
}

function apply(t: Theme): void {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}

export function mountThemeSwitch(): void {
  if (document.querySelector(".theme-switch")) return;
  const box = document.createElement("div");
  box.className = "theme-switch";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Colour theme");
  const buttons = (["dark", "light", "system"] as Theme[]).map((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `theme-${t}`;
    b.textContent = LABEL[t];
    b.addEventListener("click", () => {
      apply(t);
      sync(t);
    });
    return b;
  });
  const sync = (cur: Theme) => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.id === `theme-${cur}`)));
  box.append(...buttons);
  document.body.append(box);
  const cur = stored();
  apply(cur);
  sync(cur);
}
