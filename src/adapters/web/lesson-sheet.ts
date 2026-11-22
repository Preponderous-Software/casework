// The lesson sheet: one question in a bottom sheet, with the explanation and sources after.
import { isCorrect, type Lesson } from "../../kernel/lessons.ts";
import { button, el } from "./dom.ts";

/** Show a lesson. `onAnswer` runs once with whether it was right; `onClose` when it's dismissed
 * (answered or not). */
export function openLesson(l: Lesson, onAnswer: (right: boolean) => void, onClose: (answered: boolean) => void): void {
  document.querySelector(".sheet-back")?.remove();
  const back = el("div", { class: "sheet-back" });
  const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": `Lesson: ${l.title}` });
  let answered = false;
  const close = () => {
    back.remove();
    onClose(answered);
  };
  sheet.append(el("p", { class: "eyebrow" }, `Lesson · ${l.title}`), el("p", { class: "prompt" }, l.prompt));
  const opts = el("div", { class: "opts" });
  const later = button("Not now", close, "btn ghost", "lesson-later");
  l.options.forEach((o, i) => {
    const b = button(o, () => {
      if (answered) return;
      answered = true;
      const right = isCorrect(l, i);
      opts.querySelectorAll("button").forEach((x, j) => {
        (x as HTMLButtonElement).disabled = true;
        if (j === l.answer) x.classList.add("right");
        else if (j === i) x.classList.add("wrong");
      });
      const ex = el("div", { class: "explain" });
      ex.append(el("p", {}, `${right ? "Correct." : "Not quite."} ${l.explain}`));
      const src = el("details", { class: "src" });
      src.append(el("summary", {}, "Sources"), ...l.sources.map((s) => el("p", {}, s.cite)));
      ex.append(src);
      later.remove();
      sheet.append(
        ex,
        el("p", { class: "fine" }, right ? "Skill learned. It comes back tomorrow as a review card." : "You learn this skill at novice level, so its evidence is less precise. Pass its review card to improve it."),
        button("Continue", close, "btn go", "lesson-done"),
      );
      onAnswer(right);
      (sheet.querySelector("#lesson-done") as HTMLButtonElement | null)?.focus({ preventScroll: true });
    }, "opt", `opt-${l.id}-${i}`);
    opts.append(b);
  });
  sheet.append(opts, later);
  back.append(sheet);
  back.addEventListener("click", (e) => {
    if (e.target === back) close();
  });
  document.body.append(back);
  (opts.querySelector("button") as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
