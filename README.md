# Edge Engine — Architecture & Gemini Integration Plan

## How the Prediction Actually Works

### The Core Insight
We're not predicting exact numbers. We're predicting **red or black** — a near coin-flip (47.4% each, 5.2% green on American).
A real coin flip is unpredictable. But roulette with a **live human dealer** is not a coin flip — it's a physics system with a repeatable human input. The dealer's arm is the signal source.

Even a **tiny edge** — 52% instead of 47.4% — is profitable over hundreds of bets. That's what we're chasing.

---

## Layer 1: Heuristic Signals (engine.js — runs every spin, zero latency)

| Signal | Weight | What It Measures | When It Fires |
|--------|--------|-----------------|---------------|
| **DEALER** | 2.0x | Physical distance the ball travels between consecutive spins. A human throws with similar force repeatedly (muscle memory). Projects next landing sector from the average arc. **Now directly influenced by Flight Timing CV to tighten/widen landing zone.** | Dealer σ < 6 (READABLE or MODERATE) |
| **SECTOR** | 0.8x | Whether the ball clusters in one physical quadrant of the wheel (table tilt, imperfection). Votes the dominant color of the hot quadrant. | After 8+ spins, one quadrant hits >30% above expected |
| **FREQ** | 0.7x | Z-score test on red vs black distribution. Detects if one color is statistically over-hitting beyond random variance. | After 12+ spins, z-score > 0.8 |
| **FLOW** | 0.6x | Markov transition probabilities — what color tends to follow what color with this specific dealer. | After 10+ spins, transition bias > 8% |

### How They Vote
Each signal independently votes RED, BLACK, or PASS. Votes are weighted and summed. If the total weighted agreement exceeds a threshold, the engine predicts. Otherwise: **PASS**.

PASS is the most important output. It means "don't bet — no exploitable pattern right now."

### Safety Mechanisms
- **Flight Timing Telemetry**: Uses spacebar or UI tap to track exact ball flight duration. Consistent throws tighten the prediction zone; erratic throws suppress it.
- **5-Spin Priming Phase**: The system requires 5 live entries + timings before going "hot" to ensure data calibration without forcing premature bets.
- **Self-Correcting Weights**: The engine tracks which signals are actually predicting correctly and dynamically boosts/suppresses them (e.g., if DEALER keeps missing, its weight drops).
- **Undo / Cancel**: Allows precise operational control during high-speed live sessions.

---

## Layer 2: Gemini Tactical Manager (gemini_v2.js)

### Why Gemini Adds Value
The heuristic signals are fast but dumb — they compute simple statistics. Gemini manages the **bankroll and risk**:

1. **Meta-Learning**: It reviews the last 10 outcomes.
2. **Momentum Tracking**: It tracks your win/loss streak and win rate.
3. **Bet Sizing Directive**: It responds with MAX, BASE, HALF, or PASS based on how hot the engine currently is.

### What We Send to Gemini
A strict, plain-text prompt (no JSON to prevent parsing errors):
- Total spins tracked
- Engine's current prediction and confidence
- Player's W/L record and active streak
- Flight timing consistency stats
- A log of recent outcomes (e.g., Predicted RED → Actual BLACK = LOSS)

### What Gemini Returns
A plain-text, single-line directive:
`[MAX] - The engine is on a 3-win streak and timing is locked in, push the advantage.`

---

## File Structure

```
CASINO/
├── index.html      ← UI Shell, Telemetry Strip, Input Handling
├── style.css       ← All styling
├── engine.js       ← Heuristic signals, physics, rendering, timing logic
├── gemini_v2.js    ← Gemini API integration
└── README.md       ← This document
```

### Expected Performance (Live Dealer)
- **Accuracy target**: 51-54% on red/black (vs 47.4% baseline)
- **Edge**: 3-7% over house
- **Key**: The PASS signal prevents betting on noise. You're only betting when the signals agree.

---

## Array Ingestion Protocol
When updating the `preSeed` array in `engine.js` from a new "LAST 500" statistics screenshot, follow this strict protocol to maintain chronological integrity:

1. **The Source Grid**: The roulette app's statistics grid reads left-to-right, top-to-bottom. The **top-left number is the absolute newest spin**. The bottom-right is the oldest.
2. **Finding the Overlap**: Compare the new screenshot to the end of the current `preSeed` array to find where they overlap.
3. **Appending Logic**: The `preSeed` array is stored chronologically (oldest spins first, newest spins last). Therefore, you must extract the new spins from the screenshot and append them **in reverse order**.
4. **Example Workflow**: 
   - Identify the oldest *new* spin (the one immediately following the last known spin).
   - Read the screenshot backwards (right-to-left, bottom-to-top) from that point.
   - Append those numbers to the end of `preSeed` so that the absolute newest spin (top-left of the screenshot) becomes the very last element in the array.
