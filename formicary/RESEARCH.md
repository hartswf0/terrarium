# RESEARCH GROUNDING

## Sourcing note — read this first

`https://www.anthropic.com/research/multiagent-systems` is **blocked by this container's egress
proxy** (403 from the tunnel; same for `ncase.me`). I could not read it, and I will not
paraphrase a taxonomy I have not seen. **If you paste that page's contents into the session, I
will re-derive the element table against it directly.**

What follows is what can be verified from reachable sources, plus the honest provenance of the
28-element table as it currently stands.

---

## 1. What the 28 elements actually are

They are **Watson Hartsoe's construction**, organised into four families plus four higher-order
causes. That construction is the design's own claim, not a citation. It stands on its own as a
playable model, and the build should treat it that way rather than implying it reproduces a
published table.

| family | elements |
|---|---|
| COORDINATION | Co Si Mc Dp Ow Pt |
| CONFORMITY | Cf Lv Sf Fl Cl Im |
| EPISTEMICS | Gu Cs Hi Tc Di Rp |
| GOALS / POWER | Tw Sa Lo My Es Cr |
| META (causes) | Mo In Sp Mm |

## 2. Verified adjacent research

**MAST — "Why Do Multi-Agent LLM Systems Fail?"** (Cemri, Pan, Yang et al., arXiv:2503.13657;
NeurIPS 2025). The first empirically grounded taxonomy of multi-agent LLM failure, built from
1,600+ annotated execution traces. **14 failure modes in three root categories:**

1. **Specification issues** — ambiguous or under-specified roles and tasks.
2. **Inter-agent misalignment** — communication breakdown, conflicting objectives, duplicated
   work, coordination failure.
3. **Task verification failures** — missing validation, unchecked output, error propagation
   down agent chains.

Reported production failure rates of **41–86.7%**, with specification issues and inter-agent
misalignment together accounting for the large majority of breakdowns.

**How FORMICARY's families map onto MAST:**

| MAST category | FORMICARY |
|---|---|
| Specification issues | `In` institution gap, `Mm` missing mental models, `Dp` dependency failure, `Ow` excessive ownership |
| Inter-agent misalignment | the entire COORDINATION and CONFORMITY columns; `Tw` `Es` `Cl` from GOALS/POWER |
| Task verification failures | `Mc` merge conflicts, `Hi` hidden information, `Cs` premature consensus, `Rp` no reputation, `Sa` sabotage |

FORMICARY's genuinely additional contributions beyond MAST are the **population-level** modes
— `Mo` monoculture, `Lv` low variance, `Sf` synchronized failure, `Im` identical moves — and
`Sp` machine speed. MAST annotates traces of small orchestrator-worker systems; FORMICARY is
about what happens at *colony* scale, where correlated failure and interaction rate dominate.
That is the design's real argument and the build should make it playable, not just assert it.

**Anthropic, "How we built our multi-agent research system"** (engineering blog, 2025) —
reachable in search results, blocked for full fetch. The lessons that are directly relevant and
already modelled here: orchestrator-worker separation, agents **duplicating each other's work**
when task boundaries are vague (`Co`), coordination cost scaling faster than agent count
(`In`), and the difficulty of *evaluating* multi-agent systems at all — which is precisely the
argument for a legibility instrument like the LENS.

## 3. What this means for the build

The design's thesis is one sentence and every chapter should be pressure-testing it:

> **You do not fix an agent ecology by fixing agents. You fix the space between them — and you
> have to do it faster than they interact.**

That is why the six interventions are institutions (charter, ledger, lens, variance, brake,
exclusion) rather than agent-level patches, and why `Sp` machine speed sits in the meta row:
it is the variable that makes every other failure ungovernable.

## Sources

- Cemri, Pan, Yang et al., *Why Do Multi-Agent LLM Systems Fail?* — https://arxiv.org/pdf/2503.13657
- Anthropic, *How we built our multi-agent research system* — https://www.anthropic.com/engineering/multi-agent-research-system
- **Not read (blocked):** https://www.anthropic.com/research/multiagent-systems
