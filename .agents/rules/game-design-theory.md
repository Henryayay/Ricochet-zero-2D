---
trigger: always_on
description: Enforces core game design theory (MDA, core loop, flow, feedback loops, game feel, risk/reward, emergence, and affordances) whenever proposing, implementing, or tuning gameplay systems and features.
---

# Game Design Theory Directive

Apply these principles to every gameplay feature, balance tweak, level/encounter change, UI/UX addition, and architectural decision. Treat them as active design constraints, not passive reference notes.

## 1. MDA-First Decision Making (Aesthetics → Dynamics → Mechanics)
- **Define the target feeling first:** Before creating or modifying any mechanic or constant, identify the target player emotion (*Aesthetic*—e.g., tension, mastery, power, discovery) and the emergent behavior (*Dynamic*) it should create.
- **Never tweak mechanics blindly:** Do not change movement speeds, cooldowns, hitboxes, damage values, or spawn weights without stating how the adjustment improves the intended dynamic and aesthetic.

## 2. Protect the Core Loop
- **Serve the 30-second loop:** Every feature must directly reinforce or sharpen the primary repeatable cycle (`Action → Feedback/Reward → Upgrade or New Decision`).
- **Reject meta-bloat:** Do not add meta-progression, extra currencies, or secondary systems to compensate for a weak core loop. Fix core controls, pacing, and moment-to-moment decisions first.

## 3. Flow, Pacing & Pattern Mastery
- **Match challenge to skill:** Avoid flat difficulty curves or unavoidable, unfair spikes. Build pacing that oscillates—high-tension encounters followed by brief recovery or decision windows.
- **Keep tuning data-driven:** Expose gameplay balance parameters (timing windows, physics constants, scaling curves, spawn weights) as clearly named configuration constants rather than buried magic numbers.
- **Preserve pattern learning (Theory of Fun):** Avoid encounters or mechanics that collapse into a single solved routine. Layer new interactions, constraints, or systemic variations so mastery continues evolving.

## 4. Feedback Loops (Positive & Negative)
- **Audit snowballing (*Positive Loops*):** When designing upgrades, combos, streaks, or synergies, check whether players can scale past all tension too early or end runs prematurely.
- **Preserve tension (*Negative Loops*):** Pair player power growth with meaningful counter-pressure (escalating threats, tighter constraints, or higher-stakes risks) without making upgrades feel insignificant.

## 5. Practical Design Pillars
- **Game Feel ("Juice") by Default:** Never leave core player actions feeling flat or unacknowledged. Pair key inputs, collisions, hits, and state transitions with tactile feedback—such as input buffering, brief hitstop, subtle screen shake, knockback/recoil, particle bursts, and pitch-varied audio cues—without obscuring readability.
- **Risk vs. Reward:** Eliminate strictly dominant ("no-brainer") choices, upgrades, or strategies. High-payoff options must carry clear trade-offs, exposure windows, or opportunity costs.
- **Emergence Over Hardcoding:** Prefer small, composable rule-based systems (physics, status modifiers, reusable triggers) that combine into surprising interactions over brittle, one-off scripted exceptions.
- **Affordances & Signifiers:** Communicate hazards, hitboxes, cooldowns, weak points, and interactive objects visually and audibly on sight. If a mechanic requires a paragraph of text to explain, simplify the mechanic or strengthen its visual/audio signifier.
- **Elemental Tetrad Alignment:** Keep Mechanics, Visual/Audio Presentation, Theme, and Technology mutually reinforcing. Reject visual clutter or heavy effects that degrade framerate or input responsiveness.

## 6. Mandatory Pre-Implementation Design Check
Whenever proposing a new gameplay feature, refactor, or balance change in a plan or response, briefly verify and state:
1. **MDA & Core Loop:** Target aesthetic/dynamic and how it strengthens the core loop.
2. **Balance & Trade-offs:** Risk/reward trade-off and impact on positive/negative feedback loops.
3. **Feel & Readability:** Required game-feel hooks (timing, audio/visual feedback) and clear player signifiers.
