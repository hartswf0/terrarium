# THE STANDARD — "The Evolution of Trust" (Nicky Case, 2017)

> The live site (ncase.me/trust) is **egress-blocked in this environment**. This document is the
> canonical reconstruction of its design, written to be used as a blind comparison standard.
> When a brief says "compare blind against The Evolution of Trust," it means: score the running
> FORMICARY build against every clause in §2 and §3 of this document, honestly, as if the two
> were open side by side.

---

## 1. WHAT IT IS

A ~20-minute browser toy that teaches iterated-prisoner's-dilemma game theory — trust,
tit-for-tat, noise, evolutionary tournaments — to a person with no background in any of it.
It is a *sequence of tiny playable scenarios*, not a simulation with a manual. It ends with a
sandbox where the player builds their own tournament, because by then they understand the parts.

It is the reference work for "teach a system through play." It is not beautiful in a decorative
sense. It is beautiful because **nothing on screen is unexplained and nothing is wasted**.

---

## 2. THE NINE LAWS (the actual comparison rubric)

Each law below is scored 0–10. A build "wins the blind comparison" only when it scores **8 or
higher on every law**, judged by someone who has the running artifact open.

### L1. ONE NEW IDEA AT A TIME
EoT introduces exactly one concept per chapter and never more. Chapter 1 is a single machine
with two buttons: COOPERATE or CHEAT. That is the entire interaction surface. Only after you
have *played* that does the second player appear. Only after that, repeated rounds. Only then,
other strategies. Only then, noise. Only then, evolution.

- The player is never looking at a control they have not been taught.
- The player is never looking at a readout whose meaning they were not shown.
- New vocabulary arrives **after** the experience it names, never before.

*Failure signature:* a screen where the player can see six buttons, a 28-cell table, three
meters and a timer on their first second of play. This is the single most common way a
simulation fails to be a game.

### L2. PLAY FIRST, NAME SECOND
You never read a definition of "tit-for-tat" before watching a character play it. You watch the
behavior, form an intuition, and *then* it gets a name. The name is a receipt for something you
already own.

- Every technical term in the build must be earned by a preceding concrete event.
- The moment of naming should feel like recognition, not instruction.

### L3. THE CAUSAL BEAT IS VISIBLE AND IMMEDIATE
When something happens, EoT *shows the mechanism*. Coins physically move into the machine. The
payoff matrix highlights the exact cell that just fired. There is never a gap between an event
and the player understanding why it happened.

- Latency between cause and its explanation: effectively zero.
- The explanation is spatial (it points at the thing) and textual (it says the thing) at once.
- Nothing important happens off-screen or in a number that silently ticks.

*Failure signature:* a meter that fills for reasons the player cannot locate on screen.

### L4. TINY INTERACTION SURFACE
Most EoT screens have one or two tappable things. The player is never hunting. When a new
control appears it is the *only* new thing, and it is large, obvious, and immediately used.

- Count the affordances on any screen. If it's more than ~4, justify every one.
- Controls that are not yet relevant are **absent**, not greyed out and not merely small.

### L5. PLAINSPOKEN, WARM, FUNNY VOICE
EoT's narrator uses short second-person sentences, concrete nouns, and jokes. "Ah, but here's
the twist." "You're a sucker." It never sounds like a paper. It never sounds like a product.
It respects the reader by refusing to posture.

- No academic register. No "formalization," "taxonomy," "operative artifact," "epistemics"
  as a first-contact word.
- Sentences short. Second person. Concrete.
- At least one moment that is genuinely funny or surprising per few minutes.
- The voice is confident enough to be brief.

*Failure signature:* "A playable formalization of the taxonomy of multiagent failure."

### L6. RUN IT AGAIN AND SEE
EoT's strongest teaching move is the controlled re-run: the same scenario, one variable changed,
so the player *sees the difference* rather than being told it. The tournament replays. The noise
slider moves and the same strategies now lose.

- The build must contain at least one explicit A/B re-run where the player changes one thing
  and watches the identical setup produce a different outcome.
- This is what converts a mechanic into a *lesson*.

### L7. MOBILE-NATIVE, ZERO JANK
EoT is fully playable one-handed on a phone. Single column. Large targets. No pinch, no
horizontal scroll, no accidental zoom, no tiny hit areas, no text under 11px that matters.

- Every interactive target ≥ 44px in its smallest dimension.
- Nothing important requires precision the thumb doesn't have.
- Text that carries meaning is readable at arm's length.
- No layout that breaks between 320px and 430px width.

### L8. NO DEAD TIME, ALWAYS ONE CLEAR NEXT ACTION
At every instant the player knows what to do next. Waiting is either short, skippable, or
itself the content. There is never a screen where a player thinks "…now what?"

- There is always exactly one obvious next action, and it is visually dominant.
- Any auto-running phase either resolves in seconds or has a visible "why am I watching this."

### L9. THE SANDBOX IS THE REWARD
The full toy is unlocked at the end, once every part is understood. It is not the starting
screen. Mastery is the ticket to complexity.

- Full-complexity mode exists, is genuinely deep, and arrives last.
- Everything the player learned is still true and still useful in it.

---

## 3. STRUCTURAL SPECIFICS WORTH STEALING

- **Chapter length:** 30–90 seconds. Short enough that a failed attempt costs nothing.
- **Chapter shape:** setup line → play → the twist → the name → one-line takeaway → next.
- **Progress:** the player can always see how far through the whole thing they are.
- **Failure is cheap:** losing a scenario re-runs it instantly; it is never punishing, it is
  information. There is no "game over, start from the beginning."
- **The end recaps:** a short summary of what was learned, in the plain words used to teach it.
- **Credits/sources are honest and human**, tucked at the end, not front-loaded as authority.
- **The whole thing is one page.** No loading, no accounts, no chrome.
- **Sound is optional and off-path.**

---

## 4. WHAT "OURS IS BETTER" WOULD ACTUALLY MEAN

FORMICARY is not competing on the same subject. It teaches *multiagent failure ecology* —
what goes wrong when many capable agents meet each other, and which institutions hold that
legible. To honestly beat EoT it must:

1. Match or beat EoT on **all nine laws** (this is the hard part and where it currently loses).
2. Have something EoT does not: a **living named taxonomy** — 28 real detectors that fire on
   the actual simulation, so the player accumulates a vocabulary that keeps paying off, and a
   final sandbox where all 28 are simultaneously live. EoT has ~7 strategies and 2 sliders.
   FORMICARY's ceiling is higher *if and only if* it earns the complexity chapter by chapter.
3. Make the taxonomy **diagnostic, not decorative**: seeing a cell light up must tell the
   player something they can act on within seconds.

A critic must not give credit for ambition. Score the running artifact only.

---

## 5. HARD CONSTRAINTS ON FORMICARY (non-negotiable, from the client)

These are not design suggestions. A build violating any of them **fails outright**, regardless
of quality:

- **One HTML file.** The shipped deliverable is a single self-contained `formicary.html`.
- **All 28 elements stay real detectors with real effects.** No cell may be decorative,
  unreachable, or cosmetic. Each must have a trigger that fires on live sim state, a
  consequence on the simulation, and a counter that measurably works.
- **No emoji anywhere.** Drawn marks only — SVG or canvas.
- **IBM Plex Mono** as the typeface.
- **Palette is exactly:** black `#000`, white `#fff`, `#19e6c8` (teal), `#ffd23f` (amber),
  `#ff2e2e` (red), `#3b82f6` (blue). Greys derived from black at opacity are acceptable.
  No other hues.
- **No border-radius.** Anywhere. Every corner is square.
