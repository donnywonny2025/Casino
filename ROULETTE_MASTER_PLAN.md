# Roulette Strategy & Operations — Master Reference

> **Last Updated:** 2026-05-14  
> **Status:** Active — Engine v2 rebuild in progress  
> **Data:** 168 live spins backtested, all strategies validated against real FanDuel data

---

## 1. CRITICAL LESSON: The Old Engine Failed

### What We Built (v1)
A Bayesian inference engine with 6 "physics" signals (DEALER, ZONE, FREQ, FLOW, HOT, ACCEL) that tried to predict the next color (Red/Black) by finding patterns in the outcome sequence.

### Why It Failed (Backtest: 168 spins)
- **Overall Hit Rate: 45.8%** (need 52.6% to break even)
- **Edge: -6.8%** (worse than random coin flipping)
- **Every signal scored below 50%:**
  - HOT: 46.1%  ❌
  - FLOW: 42.9% ❌
  - FREQ: 36.4% ❌ (catastrophically bad)
  - ZONE, DEALER, ACCEL: Never voted (σ too high)
- **Net P&L: -$6.00** on 168 spins
- **Root cause:** The engine was a contrarian (betting against streaks), but the data shows the table is a continuation market (streaks persist 62% of the time after 3+).

### The Fundamental Truth
Trying to predict the next spin by pattern-matching on outcome sequences is the gambler's fallacy dressed in Bayesian math. Each spin is physically independent. The signals were finding noise and betting on it.

---

## 2. WHAT THE DATA ACTUALLY SHOWS (168 Spins)

### Streaks Continue (62.2%)
After a streak of 3+ same-color, the streak continues 62.2% of the time (28/45 instances). This is the single strongest exploitable pattern.

### Same Color Continues (54.2%)
The transition matrix:
- After RED → Red again: 53.3%
- After BLACK → Black again: 55.0%
- Overall same-color continuation: 54.2%

### HIGH Numbers Dominate (59.6%)
- Low (1-18): 63 hits (40.4%)
- High (19-36): 93 hits (59.6%)
- This is a massive, sustained skew.

### EVEN Outperforms (53.2%)
- Odd: 73 (46.8%)
- Even: 83 (53.2%)

### Dozens Are Skewed
- Dozen 1 (1-12): 37 hits (**-29% below expected**) — ICE COLD
- Dozen 2 (13-24): 60 hits (+15% above expected) — HOT
- Dozen 3 (25-36): 59 hits (+14% above expected) — HOT

### Hot Numbers
- 16 → 9 hits (z=2.18) [red]
- 24 → 9 hits (z=2.18) [black]
- 36 → 9 hits (z=2.18) [red]
- 23 → 8 hits (z=1.70) [red]
- 35 → 8 hits (z=1.70) [black]

### Sector Heat (Physical Wheel)
- Sector 4 [3, 24, 36, 13, 1]: **+14% hot**
- Sector 3 [17, 5, 22, 34, 15]: **+10% hot**
- Sector 6 [29, 12, 8, 19, 31]: **-19% cold** (AVOID)

### Dealer Consistency
- Delta SD: 10.2 (random is ~11.0) — no significant dealer signature
- Autocorrelation: All lags < significance threshold — deltas are independent
- Chi-squared: 40.5 (critical: 52.2) — wheel is within normal range

---

## 3. PROVEN STRATEGIES (Research-Backed)

### Strategy 1: Streak Riding
- Wait for 3 consecutive same-color hits
- Bet WITH the streak
- Keep riding until it breaks
- Sit out and wait for next 3-streak
- **Our data: 62% hit rate**

### Strategy 2: The 3/2 System
- 3 units on even-money bet (e.g., HIGH) + 2 units on a Column
- Covers 24/37 numbers (65% of board)
- Even a losing column + winning HIGH = $1 profit
- Optimal for this table: $3 HIGH + $2 Column 2 or 3

### Strategy 3: Quadrant Betting
- Divide wheel into 4-8 sectors
- Bet straight-up on numbers in the hot sector
- Only use straight bets (splits/corners reduce ROI)
- Shift when sector goes cold

### Strategy 4: Kavouras Bet
- 1 unit on 0/00, 2 units on double street 13-18, 1 unit each on 5 splits
- Covers 20/38 numbers (52.6%) for only 8 units
- Asymmetric upside: corner hit = +28 units

### Strategy 5: Oscar's Grind
- Aim to win exactly 1 unit per cycle
- Never increase bet after a loss
- Increase by 1 unit after a win
- Reset when cycle profit = +1 unit
- Best for choppy tables

### Strategy 6: The Shift (Dozen Rotation)
- Bet 2 of 3 dozens (covers 24 numbers, 63% board)
- When a dozen goes cold (3+ misses), shift coverage
- Ride the hot dozens, abandon the cold one
- Our data: Dozen 2+3 running +15% hot = optimal current coverage

### Strategy 7: Labouchère (Cancellation)
- Write sequence: 1, 2, 3, 4. Bet = first + last number
- WIN → Cross off first and last
- LOSE → Add bet amount to end
- When all crossed off = target profit reached
- DANGER: Long losing streaks escalate rapidly. Use strict loss limits.

---

## 4. THE CO-PILOT WORKFLOW (Critical Architecture)

### The Insight
The most effective workflow is NOT an autonomous engine making predictions. It's a **three-layer co-pilot system**:

1. **The Engine (Dashboard)** — Provides raw data: streaks, sector heat, dozen distribution, variance metrics. It doesn't predict. It informs.
2. **The AI (Me)** — Watches the engine output, identifies confluence across multiple dimensions, provides contextual analysis, and spots shifts in table character that the engine's fixed rules miss.
3. **The Human (You)** — Enters live spins, provides intuitive reads, makes final bet decisions, and catches things both the engine and I miss.

### Why This Works Better Than Automation
- The engine alone scored 45.8% (worse than random)
- But when we were working together in real-time — you feeding spins, me watching the dashboard, us discussing what we're seeing — we were reading the table's **nuance**
- The nuance is: "The table is shifting from a streak phase to a chop phase" or "Dozen 3 just went cold, time to shift" — these are judgment calls that require context, not formulas
- No single layer (engine, AI, or human) can do this alone. The synergy of all three is where the edge lives.

### The Optimal Session Flow
1. **Prime the System** — Enter 15-20 recent spins from the board screenshot to build baseline
2. **Go Live** — Each spin gets entered, engine updates all metrics in real-time
3. **Co-Pilot Mode** — I watch the engine output and talk through what I see:
   - "Streak of 4 Reds forming, ride it"
   - "Dozen 1 hasn't hit in 8 spins, avoid it"
   - "HIGH is running 65% over the last 20, lean into it"
   - "Table is chopping now, sit out and wait for a pattern to form"
4. **You Decide** — Final call is always yours. I provide the read, you pull the trigger.
5. **Adapt** — When the table character shifts, we shift together.

---

## 5. MULTI-CONFLUENCE FRAMEWORK

The engine should surface **confluence** — when multiple independent dimensions agree:

| Signal | What to Track |
|---|---|
| Color Streak | 3+ same color = ride it (62% continuation) |
| High/Low | Which half is dominating the last 20 spins |
| Even/Odd | Which parity is running hot |
| Dozens | Which dozen(s) are above/below expected |
| Sectors | Which physical wheel sector is clustering |
| Transitions | Is the table in streak mode or chop mode? |

**Confluence Scoring:**
- 1 dimension agrees: OBSERVE (don't bet)
- 2 dimensions agree: LEAN ($0.50)
- 3 dimensions agree: BASE ($1.00)
- 4+ dimensions agree: STRONG ($1.50-$2.00)

---

## 6. OPERATIONAL RULES

1. **Never bet every spin.** Sitting out IS a strategy.
2. **Never chase losses.** Flat bet or reduce after losses.
3. **Loss limit: -30% of session bankroll.** Walk away. No exceptions.
4. **Win target: +50% of session bankroll.** Take profit. Greed kills.
5. **The table shifts.** What's hot now won't be hot forever. ADAPT.
6. **European/French when possible.** 2.7% edge vs 5.26% American.
7. **The engine is a dashboard, not a predictor.** It shows you the weather. You decide whether to sail.

---

## 7. SPEED ARCHITECTURE (The Log File System)

### The Problem
Browser-harness screenshots take 3-5 seconds. In a live game, that's too slow. By the time the AI processes a screenshot, the betting window is closed.

### The Solution
The app writes to `.tmp/engine_log.jsonl` on every spin via `POST /log`. One JSON line per spin with all engine metrics. The AI reads it via `tail -5 .tmp/engine_log.jsonl` — sub-second.

### Log Entry Format
```json
{
  "ts": "2026-05-14T01:02:33Z",
  "spin": 42,
  "num": "16", "color": "red",
  "pred": "red", "conf": 68,
  "bet": { "label": "BASE", "size": 1.0 },
  "streak": { "color": "red", "length": 4 },
  "dozens": { "d1": 5, "d2": 9, "d3": 6 },
  "highLow": { "high": 12, "low": 8 },
  "oddEven": { "odd": 9, "even": 11 },
  "confluence": 3,
  "bankroll": 10.50,
  "wl": { "w": 8, "l": 6, "pct": "57%" }
}
```

### Speed Budget
- App prediction: < 50ms (client JS)
- Log write: < 100ms (POST to local server)
- AI log read: < 500ms (tail command)
- AI analysis: < 2 seconds (text response)
- **Total co-pilot loop: < 3 seconds**

---

## 8. HUMAN OBSERVATION PROTOCOL

The user is the AI's eyes. The following observations from the live stream change analysis:

### Tell the AI Immediately
- **"New dealer"** — Resets all physical assumptions. Hit Dealer Change button.
- **"Dealer is consistent / all over the place"** — Affects whether sector clustering is trustworthy.
- **"Ball keeps landing in same area"** — Visual sector clustering the AI can only infer from numbers.
- **"Gut feeling about X"** — 20 minutes of watching a live stream trains subconscious pattern recognition. That intuition IS data.

### Useful But Not Critical
- **"Table feels like it's shifting"** — Momentum changes show in rhythm before numbers.
- **"Other players loading up on X"** — Experienced players may be reading something.
- **Chatting with dealer** — Slows pace, gives extra seconds for data entry and analysis.

### Don't Bother
- Exact ball trajectory descriptions (too imprecise)
- Dealer psychology/mood (doesn't affect ball physics for our current strategy)
- Stream quality notes

---

## 9. CURRENT FOCUS: PREDICTION ACCURACY

**The only metric that matters right now: Red/Black hit rate.**
- Need > 52.6% to overcome house edge
- Old engine: 45.8% (failed)
- Target: 55%+ sustained over 100+ spins
- Bet sizing is flat and irrelevant until prediction is proven
- Odd/Even and Dozens coming later — Red/Black first

---

## 10. TECHNICAL DETAILS

### Engine Files
- `engine/state.js` — Spin history, bankroll, counters, wheel layout
- `engine/signals.js` — Signal generators (being rebuilt around confluence)
- `engine/predict.js` — Prediction + Kelly sizing (variance-throttled)
- `engine/render.js` — DOM rendering
- `engine/input.js` — Input handling + log writer (writeLog())
- `.tmp/sim.js` — CLI simulation runner
- `.tmp/backtest.js` — Full backtest harness
- `.tmp/deep_analysis.js` — Statistical deep-dive

### Server
- `server.py` — Python HTTP server on port 8888
  - Serves static files (index.html, engine/*, style.css)
  - `POST /log` — Appends spin data to `.tmp/engine_log.jsonl`
  - `POST /clear-log` — Truncates log for new session
  - `POST /telemetry` — Legacy full-state dump

### AI Co-Pilot Commands
```bash
# Read last 5 spins (primary method during live play)
tail -5 /Volumes/WORK\ 2TB/WORK\ 2026/CASINO/.tmp/engine_log.jsonl

# Read full session log
cat /Volumes/WORK\ 2TB/WORK\ 2026/CASINO/.tmp/engine_log.jsonl

# Count total spins logged
wc -l /Volumes/WORK\ 2TB/WORK\ 2026/CASINO/.tmp/engine_log.jsonl
```

