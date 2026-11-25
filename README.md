# Casework

A medical examiner game where the forensic science is real. You are the new examiner at a county
office: walk the building in first person, ride out to the scene, examine the body, learn what each
finding means at the moment you need it, and sign the death certificate: cause, manner, and a
time-of-death window that scores best when it is both right and tight.

> **Status:** early development, playable. **First person** is the main way to play: a five-day
> first week in the county office with **three cases** (a natural death, an accident and a homicide
> whose timeline doesn't match the story), each with its own scene to walk. The **classic case
> pages**, an endless **time-of-death drill** and a **terminal** mode still work.

<p>
  <img src="docs/media/fp-clip-office.gif" alt="Animation: walking in from the front door of the county office, down the lobby, and turning to face the intake board" width="420">
  <img src="docs/media/fp-scene-night-shift-phone.png" alt="Phone view of a bedroom scene: the neighbor who found the body, a faceless figure, talking in the dialogue box" width="150">
</p>

The same walk as a video: [fp-clip-office.mp4](docs/media/fp-clip-office.mp4).

## Play in first person

Open `play.html` (the home page's **Play in first person** button). It runs in the browser on a
phone or a desktop; the phone gets on-screen controls. Every case is the same reducer as the classic
pages, so scores, skills and lessons are shared between them.

<table>
  <tr><th>Step</th><th>Phone</th><th>Desktop</th></tr>
  <tr>
    <td><b>1. Title</b><br>New game, Continue, Settings, or the classic pages.</td>
    <td><img src="docs/media/fp-title-phone.png" alt="Phone title screen: the Casework wordmark, New game and Settings tiles, and links to classic case mode and the time-of-death drill" width="180"></td>
    <td><img src="docs/media/fp-title-desktop.png" alt="Desktop title screen with the Casework wordmark, New game and Settings, and links to classic case mode and the drill" width="420"></td>
  </tr>
  <tr>
    <td><b>2. Lobby</b><br>Walk in. The NEXT line at the top always says what to do.</td>
    <td><img src="docs/media/fp-lobby-phone.png" alt="Phone view of the lobby: grey tiled floor, a noticeboard and a corridor ahead, with the NEXT line asking you to read the welcome letter" width="180"></td>
    <td><img src="docs/media/fp-lobby-desktop.png" alt="Desktop view of the lobby: waiting chairs, a noticeboard, the corridor ahead and the front desk on the right" width="420"></td>
  </tr>
  <tr>
    <td><b>3. Intake board</b><br>Take the day's folder.</td>
    <td><img src="docs/media/fp-intake-board-phone.png" alt="Phone: the intake board panel with a content note and the Night shift folder, Adult male, 58, with a Take this case button" width="180"></td>
    <td><img src="docs/media/fp-intake-board-desktop.png" alt="Desktop: the intake board panel over the lobby, showing the Night shift folder and Take this case" width="420"></td>
  </tr>
  <tr>
    <td><b>4. The van</b><br>Ray drives you to the scene.</td>
    <td><img src="docs/media/fp-van-phone.png" alt="Phone: the garage, the side of the white van with a teal stripe, and a toast with the case summary" width="180"></td>
    <td><img src="docs/media/fp-van-desktop.png" alt="Desktop: the garage with the side of the white county van and its teal stripe" width="420"></td>
  </tr>
  <tr>
    <td><b>5. Scene and witness</b><br>Talk to whoever found them; look at each thing worth a close look.</td>
    <td><img src="docs/media/fp-scene-night-shift-phone.png" alt="Phone: a bedroom scene with the neighbor, a faceless figure, saying he has a key and they look out for each other" width="180"></td>
    <td><img src="docs/media/fp-scene-night-shift-desktop.png" alt="Desktop: the bedroom scene, with the neighbor talking in the dialogue box at the bottom" width="420"></td>
  </tr>
  <tr>
    <td><b>6. Exam table</b><br>Look at a region and examine it. Turn the body to see the back.</td>
    <td><img src="docs/media/fp-exam-phone.png" alt="Phone: a faceless mannequin on the exam table, the abdomen highlighted, the prompt Examine the abdomen, and region buttons below" width="180"></td>
    <td><img src="docs/media/fp-exam-desktop.png" alt="Desktop: the mannequin on the exam table with the abdomen highlighted and the region bar with Turn over and Step back" width="420"></td>
  </tr>
  <tr>
    <td><b>7. Lab and tox</b><br>Autopsy, X-ray and toxicology run where their machines are.</td>
    <td><img src="docs/media/fp-lab-phone.png" alt="Phone: the lab with benches, chairs and Priya at the far counter, and a toast that toxicology is done with one new finding" width="180"></td>
    <td><img src="docs/media/fp-lab-desktop.png" alt="Desktop: the lab with its central table and Priya at the far bench, and a toast that toxicology is done" width="420"></td>
  </tr>
  <tr>
    <td><b>8. Desk certificate</b><br>Interpret, link evidence, set the window, choose cause and manner, sign.</td>
    <td><img src="docs/media/fp-certificate-phone.png" alt="Phone: the certificate at the desk terminal: the time-of-death evidence chart, the window sliders and cause of death choices" width="180"></td>
    <td><img src="docs/media/fp-certificate-desktop.png" alt="Desktop: the certificate panel with the evidence chart, window sliders and cause of death choices" width="420"></td>
  </tr>
  <tr>
    <td><b>9. Debrief</b><br>See the truth and your score.</td>
    <td><img src="docs/media/fp-debrief-phone.png" alt="Phone: the debrief, 12 of 12, with time, cause, manner, reasoning and efficiency scores and a line about the person" width="180"></td>
    <td><img src="docs/media/fp-debrief-desktop.png" alt="Desktop: the signed debrief, 12 of 12, over the office" width="420"></td>
  </tr>
  <tr>
    <td><b>10. Mentor review</b><br>Your mentor reads the certificate and says what the case was about.</td>
    <td><img src="docs/media/fp-mentor-review-phone.png" alt="Phone: Dr. Miriam Achterberg in the exam room saying she has read your certificate, 12 out of 12" width="180"></td>
    <td><img src="docs/media/fp-mentor-review-desktop.png" alt="Desktop: Dr. Achterberg in the exam room reviewing your certificate" width="420"></td>
  </tr>
</table>

The full walkthrough, with a screenshot at every stop, is in [docs/first-person.md](docs/first-person.md).

### Your first week

- **Monday.** Orientation. A welcome letter waits at the front desk. Dr. Miriam Achterberg, the
  senior forensic pathologist, is in the exam room; Ray Delgado, who drives the van and runs scenes,
  is in the garage; Priya Natarajan runs the lab. Read the time-of-death poster by the exam table.
  A note on your desk ends the day.
- **Tuesday: Night shift.** A man of 58, found in bed by his neighbor. Ask what the room was like
  overnight.
- **Wednesday: The kitchen floor.** A woman of 81, found by her daughter. Find out what she took
  every day.
- **Thursday: The basement stairs.** A man of 45 at the foot of the stairs, and his wife's account of
  when he fell. Work out a window from the body alone, then set the account beside it.
- **Friday.** The board is quiet, Dr. Achterberg reviews the week, and every folder can be worked
  again.

Each morning starts with a voicemail on your desk phone; each evening ends with your mentor's review
and a note on your desk. The tone stays clinical and non-graphic: a faceless mannequin, injuries in
words, and a respectful line about each person.

<table>
  <tr>
    <td><img src="docs/media/fp-mentor-monday-phone.png" alt="Dr. Miriam Achterberg standing in the exam room, saying: You must be our new examiner. Miriam Achterberg. Welcome." width="180"></td>
    <td><img src="docs/media/fp-voicemail-phone.png" alt="The office with the desk phone; the dialogue box plays Tuesday's voicemail from Ray about a man found in bed on Cutler Lane" width="180"></td>
    <td><img src="docs/media/fp-notebook-phone.png" alt="The case notebook for Night shift: when he was found, shift hours and lab budget left, procedures done, and the scene findings so far" width="180"></td>
    <td><img src="docs/media/fp-lesson-answered-phone.png" alt="A lesson from the reference shelf on algor mortis, answered correctly with About 1.5 °F per hour, and an explanation" width="180"></td>
  </tr>
  <tr>
    <td>Monday: meet your mentor</td>
    <td>A voicemail each morning</td>
    <td>The notebook (Tab or N)</td>
    <td>Lessons on the reference shelf</td>
  </tr>
</table>

### Controls

| | Keyboard and mouse | Touch | Gamepad (standard mapping) |
|---|---|---|---|
| Walk | W A S D or arrow keys; hold Shift to run | Left thumb: a stick appears where your thumb lands; push to the rim to run | Left stick (click it, or push it all the way, to run) |
| Look | Mouse (click the view to capture the pointer), or drag | Drag on the right half of the screen | Right stick |
| Use what you're looking at | E, Enter or Space | The round button that appears with each prompt | A |
| Next line of dialogue | E | Tap | A |
| Notebook | Tab or N | Notebook button (lower right) | Y |
| Pause, close a panel | Esc | Pause button (upper right) | Start; B closes a panel |
| At the exam table | Look at a region and press E, or click it; T turns the body; Q steps back | Tap a region or its button; Turn over and Step back buttons | A examines; B steps back |

Panels (intake board, certificate, shelf, lessons) are ordinary buttons: click, tap, or Tab to them.

<table>
  <tr>
    <td><img src="docs/media/fp-touch-controls-phone.png" alt="Phone at the front desk: the touch stick ring in the lower left, a round Read button on the right, the notebook button below it and the pause button at the top right" width="180"></td>
    <td><img src="docs/media/fp-pause-phone.png" alt="The pause menu: Resume, Settings, Back to title (your progress is saved), and links to classic case mode and the drill" width="180"></td>
    <td><img src="docs/media/fp-settings-phone.png" alt="Settings: look speed, field of view, invert up and down, volume, mute, reduce motion, and a Dark, Light, Auto theme switch" width="180"></td>
  </tr>
  <tr>
    <td>Touch controls</td>
    <td>Pause menu</td>
    <td>Settings</td>
  </tr>
</table>

### Settings and saves

- **Settings** (title screen or pause menu): look speed, field of view, invert up and down, volume,
  mute, reduce motion (no head bob or fades) and the Dark / Light / Auto theme. They are kept in this
  browser under `casework.fp.settings`.
- **Saves** are automatic: where you stand, the case on your desk, each case's progress and the
  week so far are kept in this browser under `casework.fp.save` (versioned; a save that can't be read
  is set aside, never overwritten). Skills, review cards and best scores live in the shared profile
  (`casework.profile`), so lessons learned in first person count on the classic pages too.
  **Continue** on the title screen picks up where you left off; **New game** starts the week over.

## Classic case mode

The original case pages (`index.html` → a case) play the same three cases as panels around a 3D exam
room, without walking.

### How a case plays

<table>
  <tr>
    <td><img src="docs/media/case-2-exam-room.png" alt="The 3D exam room: a faceless mannequin on an exam table, with Turn the body and region buttons" width="200"></td>
    <td><img src="docs/media/case-4-findings.png" alt="Interpreted findings, each with Time, Cause and Manner buttons to use it as evidence" width="200"></td>
    <td><img src="docs/media/case-5-certificate.png" alt="The death certificate: time-of-death evidence chart with the player's window, and cause of death choices" width="200"></td>
    <td><img src="docs/media/case-6-debrief.png" alt="The debrief: 12 of 12, with time, cause, manner, reasoning and efficiency scores and a line about the person" width="200"></td>
  </tr>
  <tr>
    <td>Examine the body in 3D</td>
    <td>Interpret and link findings</td>
    <td>Fill in the certificate</td>
    <td>Sign and see the truth</td>
  </tr>
</table>

- **Procedures:** spend shift hours and lab budget on the scene investigation, external exam,
  autopsy and toxicology. Some need others first, and some cases have tests you don't need.
- **Examine:** the external exam opens a 3D exam room (Strata, in the browser). Tap a region of the
  body to examine it, and turn the body over to check the back. Where 3D can't run, the same regions
  are buttons.
- **Interpret:** turning a finding into evidence needs a skill. If you don't have it yet, a
  one-question lesson opens right there. Your skill level sets how precise timing evidence is.
- **Link:** tap Time, Cause or Manner on an interpreted finding to use it as evidence on the
  certificate. Every line needs support before you can sign.
- **Sign and debrief:** set the time-of-death window, choose cause and manner, sign. The debrief
  scores time (right and tight), cause, manner, reasoning (did your links hold?) and efficiency,
  shows who the person was and what happened, and turns mistakes into review cards.

On a wide screen the exam room and procedures stay on the left while the findings, certificate and
debrief fill the right:

<img src="docs/media/desktop-case-6-debrief.png" alt="A signed case on a desktop: the 3D exam room and procedures on the left, the certificate and a 12 of 12 debrief on the right" width="820">

Every page opens in dark mode, with a Dark / Light / Auto switch in the corner that's remembered
in the browser.

The tone is clinical and non-graphic: a stylized, faceless mannequin, injuries described in words,
and a respectful line about each person.

### The time-of-death drill

An endless practice mode: a generated body, the early signs of death, and a window to set.

<table>
  <tr>
    <td><img src="docs/media/phone-1-findings.png" alt="A drill body's findings as tiles: body temperature, room, stiffness, skin on the back and stomach contents, each with a Learn link" width="200"></td>
    <td><img src="docs/media/phone-2-lesson.png" alt="A one-question lesson on algor mortis, answered correctly, with an explanation and sources" width="200"></td>
    <td><img src="docs/media/phone-3-evidence.png" alt="The evidence chart: cooling, rigor, livor and stomach bars, their overlap, and the player's window sliders" width="200"></td>
    <td><img src="docs/media/phone-4-debrief.png" alt="The debrief: right and tight, 3 of 3 points, with what each bar said" width="200"></td>
  </tr>
  <tr>
    <td>1. Read the body</td>
    <td>2. Learn what a finding means</td>
    <td>3. Weigh the evidence</td>
    <td>4. Sign and see the truth</td>
  </tr>
</table>

Each skill's colour shows how well you know it: amber for novice (a wider bar), teal for practiced, green for mastered.

### In a terminal

Every case can also be played as text, for people, AI playtesters and scripted checks:

```sh
npm run play -- night-shift          # type "help" for commands
npm run play -- night-shift < moves.txt
```

## Design

- [docs/design.md](docs/design.md): core loop, decisions and milestones.
- Case data format, scoring and milestones: [docs/design.md](docs/design.md). Cases are JSON in
  `packs/forensics-core/cases/`; `tests/cases.test.ts` checks each one is valid and that an expert
  can score 12/12 using only what the case shows.
- First person: [docs/first-person.md](docs/first-person.md) (play guide, layers, content files, how
  to add a scene). Its screenshots are made by `tools/fp-shots.cjs`, which plays the week end to end.
- Screenshots are made by `npm run shots` (see `tools/shots.cjs`), which plays one drill with a
  fixed seed (`?seed=99`) at phone and desktop sizes and fails on console errors or overflow.
- Architecture: ports and adapters. `src/kernel` (skills, lessons, review: reusable by other
  games), `src/casework` (the game rules), `src/adapters` (web UI, storage, Strata 3D). The layer
  rule is enforced by `tests/layers.test.ts`.

## Development

Requires Node 22.18 or newer (runs TypeScript tests directly).

```sh
npm install
npm test          # unit tests, including the layer rule
npm run typecheck
npm run build     # compiles src/ to dist/ for the browser
```

To play locally, build and then serve the repo root with any static server, for example
`python3 -m http.server 8770`, and open http://localhost:8770/ (or http://localhost:8770/play.html
for first person).

The 3D exam room spike is `spike/exam-room.html` (serve the repo root after `npm run build`). Its
engine in `engine/` is [Tangle](https://github.com/Preponderous-Software/tangle)'s prebuilt Strata
host (MIT), reused unchanged.

## Accuracy

Lessons cite published sources, and teaching approximations (such as the 1.5 °F per hour cooling
rule) are labelled as approximations. Casework teaches the reasoning; it is not a reference for real
casework. Corrections are welcome as issues.

## License

Code: [MIT](LICENSE). Lessons, cases and other content in `packs/`: [CC BY-SA 4.0](LICENSE-CONTENT.md).
