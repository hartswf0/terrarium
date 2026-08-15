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

### L10. THERE IS A CORE LOOP, AND IT IS A GAME
**This law was added after the first playtest verdict: "not very playable."** It is now the
highest-priority law in this document, because a build can satisfy L1–L9 and still be a
documentary rather than a game.

EoT's core loop is small and relentless: you are shown a situation, you make a choice, you
immediately see the payoff, the situation changes, repeat — every few seconds, for twenty
minutes. The loop is the product. Everything else is packaging.

A build passes L10 only if all five are true:

1. **A decision arrives every few seconds.** Not a meter to watch — a thing to answer. If the
   player can look away for thirty seconds and lose nothing, there is no loop.
2. **The decision has a right answer the player can work out.** Not a guess, not a slider.
   Reading the situation correctly is a *skill that improves*. A player on their tenth minute
   must be measurably better than on their first, and must feel it.
3. **The consequence is immediate, visible, and located.** Correct answers visibly resolve the
   thing. Wrong answers visibly fail, and teach why they were wrong.
4. **There is real time pressure, and it is answerable.** The window must be short enough to
   create urgency and long enough that a competent player makes it. Pressure that cannot be
   answered is just a losing animation.
5. **Something accumulates.** The player ends a session with more than a score: mastery,
   vocabulary, a filled-in table — visible evidence of what they now know.

*Failure signature:* the player taps a button, a toast appears, and nothing on screen changes.
This is the exact failure of the FORMICARY baseline, and no amount of chapter structure or
visual polish fixes it.

### L11. THE DEPICTION LAW
**Added after the client played the working build and said: "hard to understand what to do…
too many popups and competing elements for my attention."** Governed in full by
`AESTHETIC.md`, which supersedes the original hard rules.

> **What fact does this allow me not to write?**

The build is scored on how much text it **deleted by depicting instead**. Putting a picture
next to the sentence earns nothing. Replacing the sentence is the work.

A build passes L11 only if all five are true:

1. **At most one message on screen at any instant.** One paper tag, or one action prompt —
   never both saying the same thing, and never two describing different incidents. The
   failing build showed an amber instruction, a red fire line, a narrator line and an open
   detail card simultaneously, three of them paraphrasing each other, with the open card
   describing a *different* failure than the one burning.
2. **The incident has a body before it has a name.** incident → recognition → intervention.
   An ant sits on a crumb, a queue forms, nothing moves — *then* a small tag says STUCK CLAIM.
   Not: red ring → code → sentence → table → concept → answer.
3. **No taxonomy during play.** The two-letter code appears only in the field guide. Theory is
   the reward for comprehension, not the prerequisite for it.
4. **No permanent HUD.** No permanent tool bar, no permanent explanation panel, no permanent
   28-cell table. When nothing needs judgement, the colony owns the screen.
5. **State is legible from the world.** Seven idle ants are visibly wandering, not `idle: 7`.
   Congestion is a crowd at a doorway, not a meter. History is wear on the architecture, not a
   log. Lineage is trail pattern, not a badge.

*Failure signature:* a screen where the player must read three things to find out which one
thing they are being asked about.

Scoring note: like L10, **a build that fails L11 cannot receive a `win` verdict on any piece.**

---

## 2B. THE ANSWER FOR THIS BUILD — THE OUTBREAK LOOP

The mechanic that makes 28 detectors into a game rather than a taxonomy:

> A detector fires. Instead of silently warming a table cell, it opens an **OUTBREAK**: drawn
> on the field at the exact place it happened, named in one plain sentence, with a visible
> fuse of a few seconds. While it burns it does real damage. The player reads *which failure
> this is* and answers it with the right institution, in the right place, before the fuse
> runs out.
>
> - **Right institution, in time** → the outbreak visibly closes, strain is refunded, and the
>   element's table cell is marked as one the player has personally answered.
> - **Wrong institution** → it does not resolve, the budget is spent, and the game tells you
>   plainly why that tool does not address this failure.
> - **Fuse expires** → the damage lands — work rolls back, workers are stunned, strain spikes
>   — and it leaves a scar.

This satisfies L10 completely: a decision every few seconds (1), with a knowable right answer
that rewards learning the taxonomy (2), immediate located consequence (3), a real and
answerable clock (4), and a table that fills in with elements you have personally diagnosed (5).

It also makes the *subject matter* playable rather than illustrated. The player is not watching
multiagent failure; they are doing the actual job — triage under time pressure, with
institutional instruments, faster than machine speed. `Sp` machine speed becomes the difficulty
curve itself: as interaction rate rises, fuses get shorter and outbreaks arrive in pairs, until
a human genuinely cannot keep up. **That is the argument of the whole piece, delivered as a
mechanic instead of a sentence.**

Scoring note for critics: L10 is worth 10 points like the others, but a build that fails L10
cannot receive a `win` verdict on any piece, regardless of its other scores.

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
