# HLIÐARENDI

## The Dog at the Threshold

A body. A dog. A dwelling. A place. A relationship with consequences.

HLIÐARENDI is a research-through-design game prototype investigating a
deceptively simple question:

**What changes when a game character can choose whether to respond to you?**

The first character is Argos, an autonomous artificial dog.

The project is not trying to make a chatbot with a dog body, nor a pet
animation system in which every player command is eventually obeyed. It asks
whether attachment can emerge from something harder to manufacture:
recognition, partial understanding, accumulated history, and voluntary
response.

A player may call Argos.

That does not mean Argos comes.

The call enters his world. He perceives it. His present state matters. His
motives matter. His previous interactions with this player matter. Other
opportunities in the world matter. A behavior becomes more or less likely.

Then the dog acts through a body.

That gap between request and response is the project.

## Research Question

Most contemporary discussion of relationships with AI characters
concentrates on increasingly capable conversation:

```text
PLAYER
  ↓
LANGUAGE
  ↓
MODEL
  ↓
RESPONSE
```

HLIÐARENDI asks what happens when relationship is distributed across a world:

```text
PLAYER ACTS
    ↓
ARGOS PERCEIVES
    ↓
ACTION ACQUIRES MEANING
    ↓
MOTIVATIONS + STATE + HISTORY
    ↓
BEHAVIORS COMPETE
    ↓
ARGOS CHOOSES
    ↓
BODY ORGANIZES
    ↓
WORLD RESISTS / SUPPORTS
    ↓
PLAYER INTERPRETS
    ↓
SHARED HISTORY CHANGES
```

The resulting research question is:

**Can attachment to an artificial character become stronger or qualitatively
different when the character remains understandable enough to relate to, but
autonomous enough to refuse, hesitate, misinterpret, surprise, and choose?**

The project therefore treats noncompliance as a possible condition of
relationship, rather than automatically treating it as an AI failure.

## Why a Dog?

The dog is not a skin applied to an agent architecture.

Dogs occupy a recurring cultural position at the boundary between complete
otherness and complete controllability. They live with humans, read humans,
remember humans, communicate without sharing human language, and
nevertheless retain their own motivations.

HLIÐARENDI draws on four dogs as a conceptual and technical lineage.

### ARGOS — identity

From *The Odyssey*.

**Who are you?**

Odysseus returns disguised and altered. Argos recognizes him anyway.

The dog poses the problem of recognition beneath representation.

### SÁMR — intention

From *Njáls saga*.

**What do you intend?**

Sámr is described as capable of distinguishing Gunnar's friends from his
enemies and judging whether someone means Gunnar well or ill.

The dog poses the problem of social interpretation.

### GOODYEAR — trust

From *Finch*.

**Should I trust you?**

The robot Jeff can be programmed to care for Goodyear, but Goodyear is not
programmed to accept Jeff. The relationship is completed only when the dog
voluntarily changes his behavior toward him.

The dog poses the problem of relationship as something the other party must
also grant.

### SILAS T. DOG — autonomy

Bruce Blumberg and colleagues' work on autonomous synthetic characters at
the MIT Media Lab provides the project's most important computational
precedent.

**How can an autonomous creature act with us without becoming our puppet?**

Silas combined perception, internal variables, motivations, competing
behaviors, motor skills, expression, and several levels of external
direction.

The dog poses the implementation problem of directability without the
destruction of autonomy.

Together:

```text
ARGOS       → Who are you?
SÁMR        → What do you intend?
GOODYEAR    → Should I trust you?
SILAS       → How can I act with you without becoming your puppet?
```

HLIÐARENDI asks whether one artificial creature can begin to make all four
questions operational.

## The Dog at the Threshold

Across these stories the dog repeatedly appears at a boundary:

```text
home        / outside
friend      / stranger
safe        / dangerous
known       / changed
request     / command
trust       / compliance
puppet      / agent
presence    / absence
continuity  / rupture
```

This gives the project its central figure:

**The dog is the sensory membrane of the relationship.**

Argos makes changes in the world socially interpretable.

He can notice who returned. He can remember who fed him. He can respond
differently to familiar and unfamiliar people. He can become wary. He can
learn expectations. He can decide whether a ball is worth retrieving. He can
come home.

## HLIÐARENDI

The project takes its name from Gunnar Hámundarson's home in *Njáls saga*.

Gunnar is sentenced to leave Iceland. He begins to depart, looks back at
Hlíðarendi—his farm, fields, home, and worked landscape—and chooses to
remain.

The important unit is therefore not an isolated person or an isolated
building.

It is:

```text
PERSON
  ↕
DWELLING
  ↕
ANIMAL
  ↕
PLACE
```

HLIÐARENDI treats inhabitation as a relationship rather than a collection of
assets.

## The First Experiment

The initial scenario is deliberately ordinary.

```text
A human wakes inside the trailer.

Argos is nearby.

The human finds food.
The human opens the can.
The human fills the bowl.

Argos perceives the event.

Argos may approach.
Argos eats.

The human takes a ball.
They leave the trailer.

The human throws.

Argos sees or hears the ball.

FETCH competes with whatever else Argos currently wants.

Argos chooses.

If he fetches:
    paws must contact the terrain
    the body must actually locomote
    the mouth must reach the same ball
    the dog must recognize the player
    the dog must physically return

The player crouches.
The player reaches.
The player receives the ball.

They walk home.

SAVE.

RELOAD.

The place, actors, objects, and relationship history remain.
```

This is not a scripted fetch animation.

It is a tiny experiment in mutual consequence.

## What Counts as Success?

Not:

*Did the fetch animation play?*

Instead:

- Did Argos perceive what happened?
- Did the player have to act through a body?
- Did the dog possess an alternative?
- Did previous interaction alter the likelihood of response?
- Did the same ball exist for player, dog, physics, and renderer?
- Did the terrain constrain both bodies?
- Did the dwelling constrain movement?
- Did the interaction leave history?
- When they returned, was it still their home?
- Did the player interpret the dog's behavior as something more than a
  triggered animation?

The long-term target is:

**Believable continuity between beings and world.**

## Architecture

HLIÐARENDI consists of four authoritative components.

```text
                         HLIÐARENDI
                              │
             ┌────────────────┼────────────────┐
             │                │                │
           PLACE          STRUCTURE          ACTORS
             │                │             ┌──┴──┐
         TERRARIUM           INGOLD        HERO   DOG
           world             trailer     EVERYBODY ARGOS
             │                │             │     │
             └────────────────┴─────────────┴─────┘
                              │
                          ONE WORLD
```

### HERO — Everybody

The player's embodied human. Movement is not camera translation. Walking
requires feet. Reaching propagates through hand, elbow, shoulder, torso,
balance, and support. The body makes intention costly and visible.

### DOG — Argos

The autonomous companion. Argos owns: perception, internal state,
motivations, relationship variables, behavioral arbitration, locomotion,
posture, gaze, ears, tail, mouth, sound, and memory relevant to behavior.

The host may supply opportunities and requests. It does not directly specify
the final pose.

### STRUCTURE — Ingold

The trailer is not scenery. Its walls, openings, fixtures, supports, and
relationships remain operative data. A door is traversable because the
structure contains an opening. A counter can be reached because the counter
actually exists there. Rendered geometry, semantic structure, and collision
geometry should refer to the same underlying thing.

### PLACE — Terrarium

Terrarium supplies the standing world. There is one answer to:

- What is here?
- How high is the ground?
- What occupies this point?
- Can this body move here?
- What did this ray hit?
- Where did the ball land?

Everybody's foot asks the same world that Argos's paw asks.

## Two Laws

**1. Never solve the same physical question twice.**

If the terrain says the ground is here, neither Argos nor Everybody invents
another floor. If the structure says the door is here, the game does not
create a second invisible doorway trigger. If the ball is here, there is not
a separate "AI ball position."

Views may differ. Reality may not.

**2. Contact drives motion.**

For Everybody:

```text
foot → surface → support → balance → locomotion
```

For Argos:

```text
paw → surface → contact → traction → permitted root movement
```

No paws down means no magical dog translation.

Embodiment is not an animation style. It is a constraint on action.

## Argos Behavior Model

Start small. Argos does not need hundreds of behaviors to become
interesting.

Initial behavioral repertoire:

```text
REST · OBSERVE · ORIENT · APPROACH · AVOID · FOLLOW · EAT · INVESTIGATE ·
FETCH · CARRY · RETURN · WAIT · SEEK_HUMAN
```

These behaviors compete using signals such as:

```text
hunger · fatigue · arousal · curiosity · fear · social interest · distance ·
novelty · recent reward · familiarity · trust · current object interest
```

A simplified conceptual form is:

```text
behavior_value =
    opportunity
  × motivation
  × context
  × relationship_bias
  × inhibition
```

This is not intended as a claim that affection can be reduced to one numeric
score. It is machinery for creating a character whose actions depend on a
history larger than the latest instruction.

## Relationship Is Not a Meter

HLIÐARENDI should resist reducing the entire relationship to:

```text
LOVE = 73
```

Relationship state should instead influence several things independently:
approach distance, attention, willingness to follow, willingness to
relinquish objects, response to calling, recovery after startling events,
proximity seeking, greeting behavior, persistence near the player, play
initiation, confidence in unfamiliar situations, remembered expectations.

The player should infer the relationship primarily through behavior, not
through a visible affection score.

## Language

Language can become part of the system without becoming the system.

A player might say: *Come here, Argos.*

The correct implementation is not:

```text
speech → LLM → COME animation
```

It is closer to:

```text
speech
→ interpreted social event
→ perception
→ context
→ motivation
→ behavioral arbitration
→ motor intent
→ embodied action
```

An LLM may help interpret ambiguous language, infer semantic events, or
maintain higher-level reflection. It should not run the inner locomotion
loop.

The language model proposes meaning. The creature still has to live with it.

## Why This Matters for AI Characters

Generative characters make responsiveness increasingly cheap. A character
can answer almost anything. It can praise the player. Remember facts.
Generate affectionate language. Mirror conversational style. Call the player
by name.

But unlimited responsiveness creates another problem:

**If a character can always produce the relationship the player requests,
what evidence is there that a relationship has occurred?**

HLIÐARENDI explores a different design space.

The artificial character has limits. The player cannot completely inspect
its state. The player cannot guarantee compliance. Understanding accumulates
through repeated interaction. Misinterpretation remains possible.
Recognition matters. Absence matters. Return matters. The character can
surprise the player without becoming random.

The goal is not to make the player believe that Argos is secretly conscious.
The goal is to investigate how game systems make another being interpretable
as someone with whom a history is possible.

## Research Through Design

HLIÐARENDI functions simultaneously as:

1. a playable prototype,
2. an artificial-life experiment,
3. an instrument for studying character interpretation, and
4. a design argument about attachment.

Potential study questions include:

- When do players begin referring to the dog in intentional rather than
  mechanical language?
- How much noncompliance can a character exhibit before autonomy becomes
  interpreted as broken AI?
- Does remembered interaction increase attachment?
- Does behavioral ambiguity invite richer interpretation or merely
  confusion?
- Can players distinguish state-driven variation from randomness?
- Does voluntary return produce a different emotional response from
  guaranteed return?
- What kinds of behavior make players believe that their previous actions
  mattered?
- Does a shared persistent place increase perceived continuity of
  relationship?
- What happens emotionally when Argos fails to recognize, trust, or follow
  the player?

## Workshop Contribution

For *Love in Games: Exploring Emotional Connections with Characters*,
HLIÐARENDI contributes a deliberately non-romantic case of love with an AI
character.

It proposes that game-character attachment may be studied not only through
dialogue, representation, narrative arcs, or explicit romance systems, but
through:

```text
recognition + repetition + embodiment + memory + place + partial opacity +
voluntary response
```

The central proposition is deliberately testable:

**A character that always obeys can demonstrate responsiveness. A character
that could refuse but chooses to return may produce something closer to
relationship.**

## Current Milestone

### HLIÐARENDI 0.1

The first milestone is complete when:

- Everybody and Argos inhabit one authoritative Terrarium world.
- The Ingold trailer is an operative structure rather than decorative
  scenery.
- Both actors use the same terrain and collision facts.
- Everybody can feed Argos.
- Argos can perceive the feeding event.
- Both can exit through the actual trailer door.
- The player can throw one physical ball.
- Argos can perceive that ball.
- Fetch is chosen behavior rather than mandatory animation.
- Argos locomotes through grounded paw contact.
- Argos can carry and return the same ball.
- The player physically receives it.
- Both actors can return through the same entrance.
- World and relationship state survive save/reload.

That is enough.

Not a metaverse. Not an omniscient AI. Not forty menus.

One person. One dog. One dwelling. One place.

And enough memory for yesterday to matter today.

## North Star

```text
Did the foot find the ground?

Did the dog see what happened?

Did the structure constrain the action?

Did the animal have some choice?

Did the human have to use their body?

Did their previous interaction matter?

Did the world remember?

When they came home,
was it still their home?
```

HLIÐARENDI is an experiment in making the answer yes.
