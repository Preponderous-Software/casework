# Casework design

## Core loop

Nested loops:

| Loop | Length | What happens |
|---|---|---|
| Moment | ~30 s | Pick a finding and interpret it. A missing skill opens a one-question lesson in place. |
| Case | 5–10 min | Intake → Examine (spend hours) → Interpret → Certify → Debrief. |
| Shift | 15–20 min | Short spaced review, then 2–3 cases against an 8-hour clock and a lab budget. Toxicology returns next shift, so "pending" is a real choice. |
| Career | weeks | Accuracy builds reputation; reputation unlocks equipment; equipment adds procedures, findings and skills. |

## What the drill looks like

The milestone-1 drill on a desktop browser: the evidence bars from four skills, their overlap (dashed),
and the player's window (red). Rigor is a novice skill here, so its bar is wider.

![Evidence chart on desktop](media/desktop-3-evidence.png)

After signing, the real time appears as a line and the debrief explains each bar:

![Debrief on desktop](media/desktop-4-debrief.png)

## Rules

1. Every interpretation is a lesson-backed decision: findings are facts, interpretations need skills.
2. Teach just in time, then reinforce with spaced review.
3. Reward calibration: time of death is a window, scored on right and tight.
4. Time and money are the resources.
5. Respectful and non-graphic.
6. Skill level sets precision: novice skills give wider evidence bars; mastery narrows them.

## Decisions

| Question | Decision |
|---|---|
| Hosting | Standalone game on the arcade first. |
| Exam view | 3D exam room (Strata) by default from 0.1; 2D body map fallback; text list for screen readers. |
| Stack | TypeScript core and web UI; Strata renders the exam room. |
| Interpret on a phone | Tap to link an interpretation to a certificate line. No dragging. |
| Core structure | Ports and adapters; pure reducer `(state, command) → (state, events)`; versioned snapshot saves. |
| Content | Drafted with sources cited; no AI at runtime. Code MIT, content CC BY-SA 4.0. |
| Tone | Clinical, non-graphic, no child deaths in 0.1, content note at first launch. |

## Keeping options open

Casework may later become one game in a collection of educational games. Cheap habits so that stays
possible without building it now:

- `src/kernel` never imports Casework or adapters (tested).
- Lessons and cases are data packs with a manifest.
- Skill ids are namespaced, e.g. `forensics.algor-mortis`.
- Progress can be exported and imported as a file.

## Milestones

1. **Spike and drill toy.** Strata exam-room spike (go/no-go). Learning kernel plus a generated
   time-of-death drill. Gate: is the mechanic fun?
2. **Case 1 end to end.** Reducer core, tap-to-link board, 3D exam room with 2D fallback, CLI
   adapter, AI playtest.
3. **Casework 0.1.** Shift loop, 8 cases covering all five manners plus "pending", morning review,
   versioned save.
4. **Tuning.** Scoring from playtests, accuracy pass, first equipment upgrade.
