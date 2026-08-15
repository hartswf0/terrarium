# CIVIC NATURALISM — the governing design law

> field notebook × cutaway ant farm × WPA instructional poster × primitive glyph system ×
> systems simulation

This document **supersedes** the original hard rules where they conflict. It is the highest
authority in the project after the client. Read it before `CONTRACT.md`.

---

## 0. THE DEPICTION LAW

Every aesthetic choice must answer one question:

> ### What fact does this allow me not to write?

If a flood stain says the chamber flooded, **delete the flood label**.
If six ants crowd a doorway, **delete the congestion meter**.
If a different trail pattern says a worker is a different lineage, **delete the lineage badge**.
If a scar says something failed here before, **delete the history panel**.
If the queen is distressed because the brood is starving, **do not write "colony health low."**

The goal is **not less information. It is more information embodied in the world.**

A build is judged by how much text it *deleted by depicting instead*. Adding a picture next to
the sentence is a failure. Replacing the sentence is the work.

---

## 1. TWO REGISTERS, AND ONLY TWO

> **THE COLONY IS HUMAN. THE INSTRUMENTATION IS PRECISE.**

**The colony** — tunnels, chambers, ants, brood, food, water, debris, scars, trails, weather,
crowding, gestures, small environmental incidents. Tactile, illustrated, warm, hand-made,
slightly funny. Imperfect lines. Organic forms. This is most of the screen, most of the time.

**The instrumentation** — spare, diagrammatic, near-scientific. Tiny mono numerals, marks,
stamps, rails, primitive glyphs. Rectilinear. Never decorative.

Rigor is not thrown away. **Rigor is moved out of the foreground.** The severity of the old
build was correct discipline applied to the wrong layer.

Nothing lives in both registers. If you cannot say which register an element belongs to, it is
wrong.

---

## 2. PALETTE

Colour is split by register, and that split is the discipline that replaces the old six-colour
rule. `build.js` enforces the allowlist.

### MATERIAL — the world. Never signal. Never means anything.
```
--paper    #f5efe3   surface, cards, sky
--paper-2  #e9e0cd   secondary paper, card edges
--sand     #e2d3b4   chamber floors, excavated ground
--sand-2   #d3bf99   chamber shadow, packed earth
--soil     #9d5130   earth
--soil-2   #82401f   deeper earth
--soil-3   #6b3318   shadow, unexcavated
--ink      #17150f   ants, marks, type, drawn line
--ink-2    #4a4335   secondary line, texture
```

### SIGNAL — the instrumentation. Appears ONLY when it means something.
```
--teal   #19e6c8   institution · answered · resolved · held
--amber  #ffd23f   attention · this is asking for you · the fuse
--red    #ff2e2e   damage · it landed · scar
--blue   #3b82f6   information · trail · knowledge · what is known
```

**The rule that survives from the old system, strengthened:** if something is one of the four
signal colours, it means something and the player can learn what. If it is warm or earthen, it
is material and means nothing. A player must be able to trust that completely.

Never tint the world with a signal colour for mood. Never render an instrument in soil brown.

---

## 3. TYPOGRAPHY

**IBM Plex Mono remains the only face**, already subsetted and embedded. It is now the voice of
the *instrumentation* register: small, precise, uppercase for labels, tabular for numerals.

The colony's own voice — the paper tags, the field guide, the narrator — may use Plex Mono at
comfortable reading size with generous leading. It reads as a naturalist's typewriter, which is
exactly right. Do not add a second typeface.

Type is a last resort, not a layout tool. Every string on screen must have survived the
Depiction Law.

---

## 4. THE FOUR FAMILIES BECOME FOUR RECOGNIZABLE PHENOMENA

Not four headings to memorize. Four things you *see happening* in a colony.

| family | becomes | what the player actually sees |
|---|---|---|
| **COORDINATION** | **TRAFFIC** | Two ants squeeze through one passage. Workers arrive with incompatible loads. A tunnel jams. A crumb is occupied but nobody moves it. Queues. Collisions. Dropped loads. |
| **CONFORMITY** | **SAMENESS** | Every ant on one trail while another food source rots. Whole groups turning together. Visual variety draining out of the colony until every ant looks alike. |
| **EPISTEMICS** | **PERCEPTION** | Broken scent trails. Contradictory markers. Ants confidently marching to an empty chamber. Information physically failing to travel down a tunnel. |
| **GOALS / POWER** | **POSSESSION** | Hoarding. A body blocking a doorway. Two ants fighting over one crumb. Guarding a pile. Quietly dismantling finished work. |
| **META (causes)** | **WEATHER** | Machine speed is visibly frantic movement. Monoculture is the colony losing its variety. Missing institutions is architecture literally absent — no arch, no stone, no marks. Missing mental models is darkness: trails you cannot see. |

This is **information compression through depiction**. The taxonomy is unchanged underneath;
only its presentation moves from label to phenomenon.

---

## 5. THE SIX INSTITUTIONS BECOME FOLK TECHNOLOGY

The mechanic is already right — CHARTER arbitrates, VARY decorrelates, LEDGER remembers, LENS
reveals, SLOW brakes, EJECT excludes. Give each a physical form in the ant world **whose shape
teaches its function.**

| system | world-form | what appears when used |
|---|---|---|
| **CHARTER** | meeting stone / marked arch | ants queue; ownership becomes visible; one claimant remains |
| **VARY** | branching seed / many-coloured trail marker | ants begin taking different routes; variety returns |
| **LEDGER** | tally wall / trail cairn | past actions leave durable marks on the wall |
| **LENS** | lantern / eye-marker | intention trails become visible in the dark |
| **SLOW** | bell / gate / water-clock | frantic motion becomes readable |
| **EJECT** | boundary / guarded threshold | one destructive actor can no longer enter |

The silhouette is the teaching. **Charter is always arch/circle. Ledger is always stack/tally.
Lens is always eye/ray. Slow is always bell/gate. Vary is always branch. Eject is always
threshold.** A player learns six silhouettes, and after that the icon needs no label.

The primitive glyph grammar is for **institutions, warnings, remembered events and chamber
signs** — not a generic icon pack. A newcomer should gradually learn to read the colony the way
one learns to read archaeological notation.

---

## 6. INCIDENT GRAMMAR — the single most important change

The old chain the player had to walk:

> red thing → code → sentence → table → concept → answer

The new chain:

> ### incident → recognition → intervention

Worked example, `Lo` (a worker holds a job and does not work it):

1. **The incident has a body.** An ant sits beside the crumb. Another approaches. It cannot
   take it. A third arrives. A queue forms. The crumb is untouched. *Nothing is written.*
2. **Recognition.** One small paper tag, on the field, near the thing:

   > **STUCK CLAIM**
   > *Someone claimed it and stopped.*

   **No `Lo` headline. No trigger/effect/counter. No code.**
3. **Intervention.** One contextual action appears. `MEETING STONE`. That is the whole surface.
4. **Afterwards**, quietly, the field guide records `Lo · stale lock`.

**Theory is the reward for comprehension, not the prerequisite for play.**

### Hard consequences of this grammar
- **Never two explanations of the same event on screen at once.** The current build shows an
  amber instruction, a red fire line, a narrator line and an open detail card simultaneously —
  three of them saying the same thing, and the card describing a *different* failure. That is
  the defining bug this document exists to kill.
- **Only ever one message region.** One tag at a time. If two incidents are live, the tag names
  the one being asked about, and the other is legible from its bodies alone.
- **The two-letter code never appears during play.** It lives in the field guide.

---

## 7. THE FIELD GUIDE — where the 28 survive

All 28 detectors stay. They are the intellectually strongest part of the project and they are
real simulation detectors, not lesson cards. What dies is the permanent 28-cell matrix on
screen — overwhelming even to the person who designed it.

They become a **naturalist's collection**, opened between episodes or from a quiet corner mark,
never during a decision. One card each:

```
   [primitive glyph]

   THE STALE CLAIM
   [tiny diagram: two ants, one crumb, blocked tunnel]

   One worker claimed the work and stopped.

   Lo · Lockout                    small type, bottom
   Seen 3 · Answered 2
```

A card is **blank until first witnessed** — a plate you have not collected. Witnessing draws
it. Answering it stamps it. The taxonomy becomes *knowledge you discovered about a species*,
not documentation shipped with the software.

---

## 8. SCREEN ARCHITECTURE — abolish the permanent HUD

**TOP** — very quiet persistent state. `17 / 117`, food, colony strain. Small, mono, low
contrast, no boxes shouting.

**CENTRE** — almost entirely colony. When nothing requires the player's judgement, **the colony
owns the screen.**

**BOTTOM** — appears **only when there is a decision**, then disappears:

> **THE TUNNEL IS JAMMED**
> *Everyone chose the same route.*
>
> `OPEN ANOTHER PATH`

**No permanent six-button toolbar. No permanent explanation panel. No permanent taxonomy.**

---

## 9. INFORMATION MIGRATION TABLE

What used to be text, and where it now lives. This table is the build's to-do list.

| was | becomes |
|---|---|
| coloured family boxes | **colour → family**: trail marks, chamber edge pigment, incident symbols |
| tool button labels | **shape → institution**: learned silhouettes |
| severity numbers | **motion → severity**: awkward, then queueing, then collisions and dropped loads |
| workload meters | **density → workload**: a visibly overwhelmed chamber |
| history panel | **architecture → history**: successful interventions physically alter the nest |
| failure log | **wear → memory**: scratches, collapsed edges, patched tunnels, flood stains |
| `idle: 7` | **behaviour → state**: seven ants visibly wandering, doing nothing |
| epistemics chart | **trails → information flow** |
| speed / pressure meters | **weather → global pressure**: frantic motion, flooding, scarcity, crowding as *conditions* |

**The colony itself becomes the dashboard.**

---

## 10. HUMAN DOES NOT MEAN CUTE

No Pixar personalities. No dialogue balloons scattered across the field. **Personality comes
from behaviour**, and behaviour is already simulated.

Give workers tiny legible differences: gait, antenna shape, carrying posture, markings,
hesitation, confidence, following, wandering, protecting, hoarding, helping.

The target is a player saying, unprompted:

> *"That one keeps following the others."*
> *"Why are all five trying to carry the same thing?"*

That is where the abstract multiagent argument becomes emotionally intelligible — and it
protects the thesis, which the source research states plainly and the ending already says:
**no individual worker needs to be stupid or evil for the colony to fail.** The visual design
should make the player *feel* that before the game ever explains it.

---

## 11. WHAT IS RETIRED, AND WHAT STILL STANDS

**RETIRED** (superseded by this document):
- ~~black and white plus four colours only~~ → replaced by the material/signal split in §2,
  which is a stricter rule, not a looser one.
- ~~no border-radius anywhere~~ → organic chambers, tunnels and paper cards are the point.
  **But the instrumentation register stays rectilinear**: rails, stamps, numerals, marks.
- ~~the permanent 28-cell periodic table~~ → the field guide, §7.
- ~~the permanent six-button tool bar~~ → contextual action only, §8.

**STILL STANDS, unchanged:**
- **One HTML file.** Self-contained, no network.
- **All 28 elements remain real detectors with real effects and working counters.** Explicitly
  reaffirmed by the client. `audit.js` still gates this.
- **No emoji. Drawn marks only** — now more true than before, since the world is drawn.
- **IBM Plex Mono**, as the instrumentation voice, §3.
- **The core loop** — incident, fuse, right instrument in the right place, visible resolution,
  real damage on a miss. Mechanically good; only its presentation changes.
- **The ten laws** in `REFERENCE-EOT.md`, with L10 highest. The Depiction Law does not replace
  them; it is how L3 (the causal beat) and L4 (tiny interaction surface) get satisfied.
