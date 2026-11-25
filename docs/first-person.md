# Casework in first person

You are the new medical examiner at the Alder County Medical Examiner's Office. You walk the
building, pick up the day's case, ride out to the scene, examine the body at the table, send blood
to the lab, read lessons off the reference shelf, and sign the certificate at your desk terminal.

First person is a new way to drive the same case engine as the classic pages: the reducer in
`src/casework/case/play.ts`, its scoring, lessons and skills are the source of truth. Play it at
`play.html` (the home page's **Play in first person** button).

Contents: [Play guide](#play-guide) · [Controls](#controls) · [Settings and saves](#settings-and-saves) ·
[For developers](#for-developers)

Screenshots are from a phone (390 × 844) and a desktop browser, both in the dark theme, made by
`tools/fp-shots.cjs` (see [Screenshots](#screenshots)).

## Play guide

### The title screen

**New game** walks you into the office (it becomes **Continue** once there's a save). **Settings**
opens the same settings as the pause menu. The two links lead to the classic case pages and the
time-of-death drill.

<p>
<img src="media/fp-title-phone.png" alt="Phone title screen: the Casework wordmark, a New game tile, a Settings tile, and links to classic case mode and the drill" width="220">
<img src="media/fp-title-desktop.png" alt="Desktop title screen with the Casework wordmark, New game and Settings tiles, and the two classic links" width="560">
</p>

### Monday: orientation

You arrive at the front door. The **NEXT** line at the top of the screen always says what to do,
and a prompt appears in the middle when you look at something you can use.

<p>
<img src="media/fp-lobby-phone.png" alt="Phone view of the lobby: a noticeboard, the corridor ahead, and the NEXT line: Read the welcome letter at the front desk" width="220">
<img src="media/fp-lobby-desktop.png" alt="Desktop view of the lobby: waiting chairs, a noticeboard, the corridor ahead and the front desk to the right" width="560">
</p>

The welcome letter is on the front desk. Things you read open in the dialogue box; press E (or tap)
to move on.

<p>
<img src="media/fp-welcome-letter-phone.png" alt="Phone: the welcome letter from Dr. Achterberg in the dialogue box, over a view of the lobby" width="220">
</p>

Dr. Miriam Achterberg, your mentor for the week, is in the exam room. She sends you to meet Ray
Delgado in the garage and Priya Natarajan in the lab. The time-of-death poster by the exam table is
worth reading too.

<p>
<img src="media/fp-mentor-monday-phone.png" alt="Phone: Dr. Miriam Achterberg standing in the exam room, saying: You must be our new examiner. Miriam Achterberg. Welcome." width="220">
<img src="media/fp-mentor-monday-desktop.png" alt="Desktop: Dr. Achterberg greets you in the exam room" width="560">
</p>

On a phone, the touch controls show as soon as you touch the screen: a ring for the left thumb's
stick, a round button with the verb of whatever you're looking at (here, **Read**), the notebook
button and the pause button.

<p>
<img src="media/fp-touch-controls-phone.png" alt="Phone at the front desk: the stick ring lower left, a round Read button on the right, the notebook button below it and the pause button top right" width="220">
</p>

A note on your desk ends the day.

### Each morning: the voicemail and the intake board

From Tuesday, the light on your desk phone is blinking. The voicemail says what came in overnight.

<p>
<img src="media/fp-voicemail-phone.png" alt="Phone: Tuesday's voicemail from Ray in the dialogue box, about a man found in bed on Cutler Lane" width="220">
<img src="media/fp-voicemail-desktop.png" alt="Desktop: your office with the desk and phone, and the voicemail in the dialogue box" width="560">
</p>

The intake board in the lobby holds the day's folder. **Take this case** puts it on your desk.

<p>
<img src="media/fp-intake-board-phone.png" alt="Phone: the intake board panel with a content note and the Night shift folder, Adult male, 58, found in bed at 07:40 by a neighbor, and a Take this case button" width="220">
<img src="media/fp-intake-board-desktop.png" alt="Desktop: the intake board panel over the lobby with the Night shift folder" width="560">
</p>

### The van and the scene

Ray is in the garage. Use the van to drive to the scene.

<p>
<img src="media/fp-van-phone.png" alt="Phone: the garage, close to the side of the white van with its teal stripe, and a toast with the case summary" width="220">
<img src="media/fp-van-desktop.png" alt="Desktop: the side of the white county van with a teal stripe in the garage" width="560">
</p>

Each case has its own walkable scene. Talk to whoever found the person, then look at everything
worth a close look; each one goes into your notebook as a finding. The NEXT line counts them.

<p>
<img src="media/fp-scene-night-shift-phone.png" alt="Phone: the bedroom at the Hale house, with the neighbor Walt Brennan saying he has a key and they look out for each other" width="220">
<img src="media/fp-scene-night-shift-desktop.png" alt="Desktop: the bedroom scene with a sofa and lamp, and the neighbor talking in the dialogue box" width="560">
</p>

<p>
<img src="media/fp-scene-kitchen-floor-phone.png" alt="Phone: the Voss house, with Ruth Alder saying: I'm Ruth. Her daughter." width="220">
<img src="media/fp-scene-basement-stairs-phone.png" alt="Phone: the Ortiz house, stairs behind, with Lena Ortiz saying: I'm Lena. His wife." width="220">
</p>
<p>
<img src="media/fp-scene-kitchen-floor-desktop.png" alt="Desktop: the Voss house living room with the daughter, Ruth Alder, talking" width="420">
<img src="media/fp-scene-basement-stairs-desktop.png" alt="Desktop: the Ortiz house hall, the stairs behind, with the wife, Lena Ortiz, talking" width="420">
</p>

Wednesday's and Thursday's scenes: the daughter at the Voss house, and the wife at the Ortiz house.

### The notebook

Tab or N (or the notebook button) opens the case notebook anywhere: when the person was found,
shift hours and lab budget left, which procedures are done, and every finding so far, each with a
**Learn** link when you don't yet have the skill to interpret it.

<p>
<img src="media/fp-notebook-phone.png" alt="Phone: the case notebook for Night shift: found at 07:40, 7 h shift and $600 lab budget left, procedures with Scene investigation done, and the first findings" width="220">
<img src="media/fp-notebook-desktop.png" alt="Desktop: the case notebook panel for Night shift" width="560">
</p>

### The exam table

Back at the office, step up to the exam table. Look at a region (it lights up) and press E, tap it,
or use the region buttons. **Turn over** (T) shows the back; **Step back** (Q) leaves the table. The
body is a faceless mannequin and every finding is in words.

<p>
<img src="media/fp-exam-phone.png" alt="Phone: the faceless mannequin on the exam table with the abdomen highlighted, the prompt Examine the abdomen, and the region buttons Head to Right leg" width="220">
<img src="media/fp-exam-desktop.png" alt="Desktop: the mannequin on the exam table with the abdomen highlighted, and the exam bar with Turn over, Step back and the regions" width="560">
</p>

### The autopsy station, the X-ray and the lab

Procedures run where their machines are: the autopsy station beside the exam table, the X-ray unit,
and the toxicology analyzer in Priya's lab. Each costs shift hours and lab budget, and some need
others first. A toast says when results reach your notebook.

<p>
<img src="media/fp-lab-phone.png" alt="Phone: the lab, with Priya at the far bench and a toast: Toxicology (rush) done, 1 new finding in your notebook" width="220">
<img src="media/fp-lab-desktop.png" alt="Desktop: the lab with its central table, chairs and benches, Priya at the far end, and the toxicology toast" width="560">
</p>

### The reference shelf

The shelf in your office holds one book per skill. Each is a one-question lesson; the books this
case needs are marked. Learning a skill lets you interpret findings that need it, and better skills
give tighter time-of-death evidence.

<p>
<img src="media/fp-shelf-phone.png" alt="Phone: the reference shelf panel listing Algor mortis, Rigor mortis, Livor mortis, Gastric contents, Scene conditions, Coronary disease and Manner of death, each not learned and marked this case" width="220">
<img src="media/fp-shelf-desktop.png" alt="Desktop: the reference shelf panel with a tile for each skill" width="560">
</p>

<p>
<img src="media/fp-lesson-phone.png" alt="Phone: a lesson sheet on algor mortis: how much does a clothed adult cool per hour in a 70 °F room, with three answers" width="220">
<img src="media/fp-lesson-desktop.png" alt="Desktop: the algor mortis lesson sheet over the reference shelf" width="560">
</p>

<p>
<img src="media/fp-lesson-answered-phone.png" alt="Phone: the same lesson answered correctly, About 1.5 °F, with the explanation, a Sources link and a note that the skill comes back tomorrow as a review card" width="220">
<img src="media/fp-lesson-answered-desktop.png" alt="Desktop: the algor mortis lesson answered correctly, with its explanation" width="560">
</p>

### The desk terminal: certificate

The desk terminal is where the case is decided. Interpret each finding (a lesson opens in place if
you lack the skill), link findings as evidence for Time, Cause or Manner, set the time-of-death
window on the evidence chart, choose cause and manner, and sign. Every line needs support before you
can sign.

<p>
<img src="media/fp-certificate-phone.png" alt="Phone: the certificate: the evidence chart with last seen, cooling, rigor, livor and stomach bars, the earliest and latest sliders, and the cause of death choices" width="220">
<img src="media/fp-certificate-desktop.png" alt="Desktop: the certificate panel with the evidence chart, window sliders and cause of death choices" width="560">
</p>

### The debrief and the mentor's review

Signing shows the debrief: time (right and tight), cause, manner, reasoning and efficiency, out of 12,
with who the person was and what happened.

<p>
<img src="media/fp-debrief-phone.png" alt="Phone: the debrief, 12 of 12, with 3/3 time, cause and manner, 2/2 reasoning and 1/1 efficiency, and a paragraph about the person" width="220">
<img src="media/fp-debrief-desktop.png" alt="Desktop: the signed debrief, 12 of 12, over the office" width="560">
</p>

Then find Dr. Achterberg. She has read your certificate and says what the case was about, and the
note on your desk ends the day.

<p>
<img src="media/fp-mentor-review-phone.png" alt="Phone: Dr. Achterberg in the exam room: I've read your certificate for Marcus Hale. 12 out of 12." width="220">
<img src="media/fp-mentor-review-desktop.png" alt="Desktop: Dr. Achterberg reviewing your certificate in the exam room" width="560">
</p>

<p>
<img src="media/fp-desk-note-phone.png" alt="Phone: your desk with its lamp and monitor, and Ray's note in the dialogue box" width="220">
<img src="media/fp-desk-note-desktop.png" alt="Desktop: your office desk and Ray's note in the dialogue box" width="560">
</p>

### The week

| Day | Case | What it asks of you |
|---|---|---|
| Monday | none | Orientation: the welcome letter, your mentor, Ray, Priya and the poster |
| Tuesday | Night shift | A man of 58, found in bed by a neighbor. What was the room like overnight? |
| Wednesday | The kitchen floor | A woman of 81, found by her daughter. What did she take every day, and why? |
| Thursday | The basement stairs | A man of 45 at the foot of the stairs. Work out a window from the body alone, then set his wife's account beside it |
| Friday | none | The week reviewed; every folder can be worked again from the intake board |

Thursday is the one the week builds to: compare the window the body gives with the time the
account gives before you sign. When the two disagree, find out why.

<p>
<img src="media/fp-mentor-review-basement-stairs-phone.png" alt="Phone: Dr. Achterberg in the exam room: I've read your certificate for Tomás Ortiz. 12 out of 12." width="220">
</p>

## Controls

| | Keyboard and mouse | Touch | Gamepad (standard mapping) |
|---|---|---|---|
| Walk | W A S D or arrow keys; hold Shift to run | Left thumb: the stick appears where your thumb lands; push to the rim to run | Left stick; click it or push it all the way to run |
| Look | Mouse (click the view to capture the pointer), or drag | Drag on the right half | Right stick |
| Use | E, Enter or Space | The round button that appears with a prompt | A |
| Next line of dialogue | E | Tap | A |
| Notebook | Tab or N | Notebook button | Y |
| Pause; close a panel | Esc | Pause button | Start; B closes a panel |
| Exam table | Look and press E, or click a region; T turns the body; Q steps back | Tap a region or its button; Turn over, Step back | A examines; B steps back |

Panels (intake board, certificate, shelf, lessons) are ordinary page buttons: click, tap, or Tab to
them. Menus (title, pause, settings) also work with the d-pad, A, B and Start.

## Settings and saves

<p>
<img src="media/fp-pause-phone.png" alt="Phone: the pause menu with Resume, Settings, Back to title (your progress is saved), and the classic links" width="220">
<img src="media/fp-settings-phone.png" alt="Phone: settings with look speed, field of view, invert up and down, volume, mute, reduce motion and a Dark, Light, Auto theme switch" width="220">
</p>
<p>
<img src="media/fp-pause-desktop.png" alt="Desktop: the pause menu over the dimmed office" width="420">
<img src="media/fp-settings-desktop.png" alt="Desktop: the settings card over the dimmed office" width="420">
</p>

- **Look speed**, **field of view**, **invert up and down**, **volume**, **mute**, **reduce motion**
  (no head bob, no fades, dialogue appears whole) and the **theme**. Every change saves at once, in
  this browser under `casework.fp.settings`; a broken record falls back to defaults.
- **Saves** are automatic, under `casework.fp.save` (versioned): where you stand, the case on your
  desk, each case's reducer state, which scene findings you've looked at, and the story. A save that
  can't be read is set aside, never overwritten. Skills, review cards and best scores are in the
  shared profile, `casework.profile`, which the classic pages use too.

## For developers

### Layers

The layer rule (`tests/layers.test.ts`) holds here too: `src/kernel` → `src/casework` →
`src/adapters`. Everything under `src/casework/` is pure (no DOM), so it runs under `node --test`.

| Layer | Files | What it does |
|---|---|---|
| World (pure) | `src/casework/world/types.ts` | The contract: `Location`, `Prop`, `Interactable`, `Action`, `Spawn`. Metres, Y up, yaw 0 looks along −Z |
| | `walk.ts` | Walking: eased velocity, sliding along walls (ported from Frozen Star) |
| | `interact.ts` | Which interactable you're aiming at, from eye, look direction and reach |
| | `location.ts` | Validating location JSON (`parseLocation`), prop footprints to solid boxes, a placeholder scene for cases without one |
| | `layout-check.ts` | `layoutProblems` and `renderTopDown` for authoring scenes |
| Story (pure) | `src/casework/story/` | "First week": a reducer over story events (`storyStep`), `objective` for the NEXT line, `talk`, `readText`, `availableCases`, `NPCS`. Words come from the pack |
| Engine (adapter) | `src/adapters/fp/game.ts` | Turns the world into case-reducer commands: walking, aiming, doors, scenes, exam, procedures, panels, save |
| | `main.ts`, `view.ts`, `props.ts` | Entry for `play.html`; the Strata renderer (Tangle's static-room host); meshes for props, figures and the mannequin |
| | `controls.ts`, `panels.ts`, `rules.ts`, `save.ts` | Keyboard and mouse; intake board, notebook, desk, shelf and debrief panels (reusing the classic page's chart and lesson sheet); first-person rules over the reducer; the versioned save |
| Feel (adapter) | `src/adapters/fp/ui/` | `hud.ts` (crosshair, prompt, NEXT line, toasts, arrival card, dialogue), `dialogue.ts`, `menu.ts` (title and pause), `settings.ts` + `settings-panel.ts`, `touch.ts`, `pad.ts`, `stick.ts`, `input-mode.ts`, `icons.ts`; `demo.ts` drives `fp-ui-demo.html` |
| | `src/adapters/fp/audio/audio.ts` | Procedural WebAudio ambiences (office, morgue, house day/night, basement) and effects; no sample files |

Styles for the HUD, menus and touch controls are in `fp.css`; `play.html` holds the engine's own
overlay styles.

### Content files

All in `packs/forensics-core/` (CC BY-SA 4.0, like the cases and lessons):

| File | What it holds |
|---|---|
| `world/office.json` | The office: lobby and intake board, your office (desk terminal, reference shelf, phone, note, case folder), the corridor, the exam room (table, autopsy station, X-ray, poster, mentor), the lab (tox analyzer, Priya) and the garage (van, logbook, Ray). Spawns `start`, `garage`, `desk` |
| `world/scenes/scene-<caseId>.json` | One walkable scene per case: a `finding` interactable for every scene finding, a `talk` for the witness, and a door back to `{ "to": "office", "spawn": "garage" }` |
| `story/week.json` | The days, each case's person and witness, and every spoken line: arrival, day starts, case starts, procedures, the Thursday turn, mentor dialogue, reviews by score, and the end of the week |
| `story/texts.json` | Things you read: the welcome letter, poster, logbook, voicemails, desk notes, case folders and personal effects (with per-day and per-case variants) |

### Adding a scene

1. Write `packs/forensics-core/world/scenes/scene-<caseId>.json` against `types.ts`: `id`
   `scene-<caseId>`, `caseId`, `bounds`, `walls`, `props`, `lights`, an `ambience`, a spawn `start` by
   the front door, the door interactable back to the garage, one `finding` interactable for each of
   the case's `procedure: "scene"` findings, and a `talk` interactable for the witness (whose npc id
   the story defines). Every non-door interactable carries the `caseId`.
2. Check it with `layoutProblems(loc, { findings })`: boxes well formed, spawns clear of anything
   solid, and every interactable reachable from `start` by a player of radius 0.28 m without looking
   through a wall. Print `renderTopDown(loc)` to see the plan. `tests/scenes-layout.test.ts` runs both
   for every scene and prints the plan when one fails; add the new case id to its list.
3. A case with no scene file still plays: `placeholderScene` in `location.ts` generates a plain room.

`renderTopDown` draws −Z at the top: `#` wall, letters for props (`B` bed, `@` body, `S` sofa, `T`
table, `h` chair, `c` cabinet, `|` shelf, `=` counter, `F` fridge, `o` stove, `~` sink, `.` rug, `^`
stairs, `l` lamp, `x` box, `D` desk, `_` paper), `!` interactables, `>` the door, `*` spawns.

**scene-night-shift** (the Hale house):

```text
###########!#################################
#                  # ~~~     # xxxxx        #
#                  # ~~~     # xxxxx        #
#cc                #         # xxxxx      ||#
#!l              cc#      xxx# xxxxx      ||#
#                cc#      xxx#            ||#
#BBBBBBBBBB      cc#      xxx#            ||#
#BBBBBBBBBB      cc#      xxx#            ||#
#BBBBBBBBBB      cc#      xxx#            ||#
#B@@@@@@@@@        #      xxx#            ||#
#B@@@@@@@@@        #      xxx#            ||#
#B@@@@@@@@@      hh#      xxx#            ||#
#BBBBBBBBBB      hh#         #            ||#
#BBBBBBBBBB      hh#         #              #
#  ........        #         #              #
#  ........        #         #    DDDDDD    #
#  ........        #         #    DDDDDD    #
#  ........        #         #    DDDDDD    #
#                  #         #              #
##############     ####   #########    ######
#                          #                #
#   SSSSSSSSSS             #             FFF#
#ll SSSSSSSSSS             #             FFF#
#ll SSSSSSSSSS             #     hhh     FFF#
#   SSSSSSSSSS             #     hhh     ===#
#  ............            #     hhh     ===#
#  ............                 TTTTT    ===#
#  ....TTTTT...                 TTTTT    ===#
#  ....TTTTT...                 TTTTT    ===#
#hhhh..TTTTT...                 TTTTT    ===#
#hhhh..........                  hhh     ===#
#hhhh..........                  hhh     ===#
#hhhh..........            #     hhh     ===#
#                          #             ===#
#                 !        #             ===#
#                          #             ~~~#
#         *                #  oooo       ~~~#
#             TT_T ||||||| #  oooo       ~~~#
#             TT!T ||||||| #  oooo       ~~~#
########  > #################################
```

**scene-kitchen-floor** (the Voss house):

```text
#############################################
#        ccc            # xxx    ~~!        #
# BBBBBBBccc            # xxx    ~~~        #
# BBBBBBB            ccc# xxx               #
# BBBBBBB            ccc#                xxx#
# BBBBBBB            ccc#                xxx#
# BBBBBBB            ccc#                xxx#
# BBBBBBB            ccc#                xxx#
# BBBBBBB            ccc#                xxx#
# BBBBBBB               #                xxx#
# BBBBBBB               #                xxx#
# BBBBBBB               #                xxx#
#                       #                   #
#                       #                   #
#                       #                   #
#                       #                   #
#                       #                   #
################    ########    #############
#        ||||||||     #                  FFF#
#        ||||||||     #                  FFF#
# ll                  #                  FFF#
# ll                  #           @@     FFF#
#|| hhhhh             #           @@     ===#
#|| hhhhh             #           @@     ===#
#|| hhhhh             #           @@     ===#
#|| hhhhh                         @@     ===#
#|| hhhhh.........                @@     ===#
#|| hhhhh.........                @@     ~~~#
#||    ...........              ..@@..   ~~~#
#||    ...TTTTT...    #         ......   ~~~#
#      ...TTTTT...    #         ..!...   ~~~#
#      ...........!   #   hh    ......   ooo#
#      ...........    #   hh    ......   ooo#
#      ...........    #   hh             ooo#
#                     #  TTTT            ooo#
#         SSSSSSSSSS  !  TTTThhh         ===#
#pp    *  SSSSSSSSSS  #  TTTThhh         ===#
#pp       SSSSSSSSSS  #  TTTT            ===#
#pp       SSSSSSSSSS  #                  ===#
#####  > ####################################
```

**scene-basement-stairs** (the Ortiz house):

```text
#############################################
#^^^^^     TTTTTTTTT       ||#   xxxxxxx ~~~#
#^^^^^     TTTTTTTTT       ||#   xxxxxxx ~~~#
#^^^^^     TTTTTTTTT       ||#   xxxxxxx ~~~#
#^^^^^                     ||#              #
#^^^^^                     ||#              #
#^^^^^                       #              #
#^^^^^                       #              #
#^^^^^                       #              #
#^^^^^                       #            ||#
#^^^^^                                    ||#
#^^^!^                    ccc             ||#
#^^^^^                    ccc             ||#
#^^^^^                    ccc             ||#
#^^^^^                       #            ||#
#                            #              #
# @@@                        #              #
# @@@                        ################
# @@@                        #              #
# @@@                        #              #
# @@@           SSSSSSSSSS   #            ||#
# @@@        TTTSSSSSSSSSS   #            ||#
# @@@        T!TSSSSSSSSSS   #            ||#
# @@@        TTTSSSSSSSSSS                ||#
# @@@          .SSSSSSSSSS.               ||#
#              ............               ||#
#              ............               ||#
#          !   ............  #            ||#
#              ............  #            ||#
#              ............  # xxxxx      ||#
# xxxxxx       ............  # xxxxx      ||#
# xxxxxx     * ............  # xxxxx      ||#
# xxxxxx                   ll# xxxxx        #
# xxxxxx                     # xxxxx        #
###########  > ##############################
```

To print them yourself (Node 22.18+ runs the TypeScript directly):

```sh
node -e '
  const { readFileSync } = require("node:fs");
  import("./src/casework/world/layout-check.ts").then(({ renderTopDown, layoutProblems }) => {
    const loc = JSON.parse(readFileSync("packs/forensics-core/world/scenes/scene-night-shift.json", "utf8"));
    console.log(layoutProblems(loc), "\n" + renderTopDown(loc));
  });'
```

### Screenshots

`tools/fp-shots.cjs` plays the whole week in a real browser (Playwright, software WebGL): title,
Monday's orientation, then each day's case through the intake board, van, scene and witness, exam
table (tapping a region on the phone), lab, certificate and debrief. It walks for real with the
keyboard, checks the crosshair is on each thing before using it, and fails on console errors,
horizontal overflow or any step that doesn't land.

```sh
npm run build
python3 -m http.server 8770 --bind 127.0.0.1 &
node tools/fp-shots.cjs http://127.0.0.1:8770 shots                       # phone, 390 x 844
node tools/fp-shots.cjs http://127.0.0.1:8770 shots --desktop             # desktop, 1440 x 900
node tools/fp-shots.cjs http://127.0.0.1:8770 shots --cases=night-shift   # stop after one case
```

Shots are named `fp-<n>-<what>.png` (phone) and `desktop-fp-<n>-<what>.png`. The desktop run takes
around 15 minutes under software rendering, so `--cases` helps while iterating. The images in this
guide were shrunk for the repo (phones to 540 px wide, desktops to 1280, 256-colour PNG).

<p>
<img src="media/fp-clip-office.gif" alt="Animation: walking in from the front door of the county office, down the lobby, and turning to face the intake board" width="420">
<img src="media/fp-clip-witness.gif" alt="Animation: walking from the hall into the Hale house front room up to the neighbor, who turns as his first lines type out in the dialogue box" width="420">
</p>

The clips are also MP4s: [walking in](media/fp-clip-office.mp4) and [the witness](media/fp-clip-witness.mp4). They were captured frame by frame with Playwright and encoded with [darkroom](https://github.com/Preponderous-Software/darkroom)'s GIF and MP4 encoders.
