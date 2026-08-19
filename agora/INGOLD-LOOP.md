# The Ingold loop

The correspondence loop asks: **does it look like the photograph?**
This one asks: **can a body get in, stand up and stay; can hands build it; will
it survive being towed?**

```
READ     agora/inhabit.js — collisions, envelope, headroom, floor, door, step,
         light, load path, towing envelope. Pure geometry. No renderer, no
         reference, no model.
WORST    one failure, ordered  unbuildable > illegal > unusable > uncomfortable
REPAIR   one deterministic gesture
RE-READ  and again — until nothing fails, which is NOT CURRENTLY UNINHABITABLE
```

Run it: `node agora/ingold-loop.mjs agora/trailer-finished.json out.json`

## What the tests are, and what they cost to state

Every threshold is a citation, so it can be argued with rather than believed.

| test | standard |
| --- | --- |
| towing width / height | 2.591 m × 4.115 m — the US 8'6" × 13'6" envelope |
| stair riser / tread | IRC R311.7 — 197 mm max riser, 254 mm min tread |
| door clear opening | IRC R311.2 — 813 × 1981 mm |
| headroom | IRC R305.1 — 2134 mm, relaxed 2032 mm over part |
| glazing | IRC R303.1 — not less than 8% of floor area |
| body clearance | 250 mm radius, 559 mm passage |

Collisions are tiered rather than thresholded: sheathing lapping a stud by a
millimetre is a modelling tolerance, a gable 80% inside a wall plate is two
objects in one place. Gross (>25%), moderate (5–25%), tolerance (<5%).

The towing envelope measures **what travels** — steps and treads are exempt,
because a step is unbolted and thrown in the back.

## What it found

Read on the trailer as the correspondence loop left it (44 parts, suck 98):

```
  collisions   0 gross · 10 moderate · 12 within tolerance
  envelope     0 m³ enclosed — outside air reaches 39.08 m³ of what should be indoors
  wheels       0/4 on the road · lowest sits 0.215m up
  load path    0/44 parts reach the ground
  road         3.06 × 3.25 × 7.32 m — 0.47 m over the towing width
  VERDICT      7 failures
```

**The whole trailer floats 21.5 cm above the ground, wheels included.** Nothing
in seven cycles of correspondence, twelve API calls and 28 MB of input ever
mentioned it, because a photograph taken from outside cannot tell you what a
thing is standing on.

## What the loop did

Seventeen cycles on the completed trailer, 7 failures → 5:

| cycle | failure | repair |
| ---: | --- | --- |
| 1–2 | INTERPENETRATION | separated both wall plates from the gables they were 80% inside |
| 3 | WHEELS_OFF_GROUND | **set the whole assembly down 0.215 m so the wheels reach the road** |
| 4 | OVER_WIDTH | brought 12 elements inboard, narrowed the roof planes ×0.63 |
| 6 | OVER_WIDTH | **REFUSED** |
| 7 | UNCLIMBABLE | replaced one 0.71 m step with **4 risers of 165 mm and 280 mm treads** |
| 8 | INTERPENETRATION | separated the top tread from the deck |
| 9 | DOOR_TOO_SMALL | widened the door to **843 × 1991 mm** and pulled the flanking cladding with it |
| 10–13 | NOT_ENCLOSED | eave blocking, twice |
| 14–16 | — | **REFUSED, three times** |

Measured: wheels 0/4 → **4/4 on the road**. Step **fails → passes**. Door
**fails → passes**. Towing height 4.11 → 3.90 m.

## What it refused, and why the refusals are the output

> **OVER_WIDTH** — the widest element in transit is `wheel-1`, locked chassis
> geometry at 3.06 m across against a 2.591 m limit. The given trailer is over
> width before anything is built on it. That is a finding about the premise, and
> no repair here can reach it.

> **INTERPENETRATION** — `roof-front` and `eave-block-front` have already been
> separated once and are overlapping again. Moving either one drives it into the
> other. Two parts want the same place and a repair cannot decide which of them
> is wrong.

> **NOT_ENCLOSED** — two attempts at closing the shell have not reduced the leak
> below 49 m³. The gap spans the whole length — this is a missing design
> decision about how wall meets roof, not a gap to plug.

> **LOW_HEADROOM** — headroom cannot be judged until the shell is closed.

A loop that repairs everything is a loop that has not noticed when the problem
is upstream of it. Three of those four are not defects in the build; they are
questions the build never answered, and a deterministic repair has no business
answering them.

## Two mistakes this loop made, both already in the record

The first `OVER_WIDTH` repair trimmed every part that happened to exceed the
limit while the actual widest element was a locked wheel — shaving a window sill
to 5% of its width and never touching the problem. **Six cycles, no progress: the
castle session's grind, reproduced in a program with no model in it at all.** The
stall detector caught it. The fix was to let the widest element decide.

The first `CLOSE_ENVELOPE` gave every attempt a fresh id, so three rounds of
sealing produced three stacked blocks that collided with each other and with the
roof — **the genie's `ENCLOSE_CAVITY` mistake, made again**, by different code,
three days of reasoning later. One block per wall, updated in place, and it has
to show progress or it refuses.

Both failure modes were in `ANTBAT-GENIE.md` before this loop was written. Having
them written down did not prevent them. Having a test that fires did.

---

## The body test

`trailer-fit.html` — a dimensioned figure, put inside the thing, at real scale.

**The model.** Not a downloaded mannequin: a rigged mesh looks like a person and
has dimensions nobody can cite, and for a fit study the dimensions *are* the
model. The figure is a link-segment body whose every limb is a published fraction
of stature — Winter, *Biomechanics and Motor Control of Human Movement* 4th ed.,
Table 4.1, after Drillis & Contini. Cross-checked against Dreyfuss, *The Measure
of Man and Woman*: this model puts overhead grip reach at **2140 mm** for an
1829 mm male where Dreyfuss gives the 95th-percentile male **2134 mm**.

Stature 1829 mm is 6 ft 0 in, about the 90th percentile US male (ANSUR II 2012:
50th 1756 mm, 95th 1855 mm). Change the stature and every clearance, every work
height and every verdict moves with it — which is the point of deriving rather
than looking up.

| | mm |
| --- | ---: |
| eye height | 1712 |
| shoulder height | 1496 |
| elbow height | 1152 |
| knuckle height | 860 |
| shoulder width | 474 |
| forward functional reach | 805 |
| overhead grip reach | 2140 |
| clear headroom needed | 1864 |

**What it found, standing on the deck**

```
floor under foot     deck
head clearance       3250 mm   (needs 1864)
nearest obstruction   727 mm
within arm's reach        1
```

Room to stand, and **one bare surface within arm's reach**. No counter, no table,
no bed, no switch, no shelf. Move 900 mm toward the long wall and the nearest
obstruction is **73 mm** — a body of 474 mm shoulder width cannot stand there,
because the `OVER_WIDTH` repair moved both walls 470 mm inboard to get under the
towing limit and nobody measured what that did to the room. It narrowed the
interior from 2.50 m to about 1.56 m. **A legal fix that made the space a
corridor.**

And the work heights say the rest. A standard 900 mm counter sits **152 mm below
this man's elbow**; a 750 mm table is **139 mm below** his seated elbow rest.
Those are the sink and the table, before either exists.

**Seeing it.** Systems cycle solid → ghost → hidden, shift-click to solo, with
presets for *peel the envelope* and *bones only*. A section plane cuts along x or
z. And *stand inside* puts the camera at 1712 mm behind the figure's eyes with a
clip plane on the eye — ghosting a wall you are 50 mm from still fills the frame,
so the half-space behind the eye is cut away outright, which is what "look
inside" has always meant on a drawing.

The verdict from in there, in the program's own words:

> Room to stand, and one bare surface within arm's reach. No counter, no table,
> no bed, no switch, no shelf. The body has nowhere to put its hands and nothing
> to sit on: this is a shed with a door.
