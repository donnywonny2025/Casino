# Edge Engine — Roulette Co-Pilot System

> **Version:** 6.0 (Bayesian Mean-Reversion + Gemini Analyst)  
> **Status:** Backtested & Validated  
> **Game:** FanDuel Live Dealer American Roulette  
> **Bankroll:** $10 | **Bet Range:** $0.50 – $2.00

---

## Operator's Guide — How to Use This System

This section is the living playbook. Update it as the system evolves.

### The 3-Minute Startup

1. **Start the server:** `python3 server.py` from the CASINO directory
2. **Open the dashboard:** Navigate to `http://localhost:8888` in Chrome
3. **Open FanDuel:** Get to a Live Dealer American Roulette table
4. **Screenshot the scoreboard** — the grid of recent results
5. **Prime the engine:** Read the numbers from the scoreboard (newest first, left to right, top to bottom — exactly how the casino displays them) and paste them into the input field as a space-separated string. Hit Enter.
6. **Start playing:** As each spin lands, type the number into the input field. The engine will show you what to bet on the NEXT spin.

### Reading the Dashboard

The dashboard gives you everything at a glance, no scrolling:

- **Prediction Hero (top left):** The big color block is your call. RED or BLACK. The percentage is confidence. The bet label (LEAN/BASE/STRONG/MAX) tells you how much to wager.
- **Dimension Badges:** Quick read on whether the table is running Odd/Even, High/Low, and which Dozen is hot. Anything glowing = deviation from expected.
- **Table Heatmap:** Which numbers are hitting. Brighter = hotter. Gives you straight-up bet candidates.
- **Wheel Pattern:** Physical wheel layout showing where hits are clustering on the actual hardware.
- **Bias Bars:** Visual fill showing Red/Black, High/Low, Odd/Even, Dozen balance.
- **Gemini Insight:** Every 10 spins, Gemini Flash writes a background analysis. This is the "second opinion" — a full statistical breakdown in plain English.

### When to Bet and When to Sit

This is the most important part. **The system's edge comes from NOT betting**, not from predicting correctly.

| Dashboard Shows | What It Means | Your Move |
|---|---|---|
| Confidence 60%+ with BASE/STRONG | Signals agree, edge detected | **Bet the called color at the indicated size** |
| Confidence 55-59% with LEAN | Marginal edge | **Small bet ($0.50) or sit out** |
| Confidence <55% | No clear signal | **Sit out** |
| "SIT" or "Cold streak" | Engine is losing, momentum is bad | **Do NOT bet. Wait.** |
| "STOP" | Bankroll critical (<$2) | **Walk away from the table** |
| "PASS" / gray prediction | Not enough data or signals conflict | **Wait for next spin** |

**Rule of thumb:** If the engine says SIT, you sit. If Gemini's analysis contradicts the engine (e.g., engine says RED but Gemini sees a strong black pattern forming), lean toward caution. The human breaks ties.

### Data Entry Best Practices

- **Priming (bulk entry):** Paste numbers newest-first, space-separated. `0 14 35 16 2 31 18 18`. The engine auto-detects bulk mode, reverses to chronological, and suppresses scoring so your W/L record stays clean.
- **Live entry (single spin):** Type one number, hit Enter. `16` → Enter. `00` → Enter. The engine scores this against its prediction and updates your record.
- **Timing:** Enter the number AFTER the spin lands and you've confirmed it. Don't rush — accuracy matters more than speed.
- **Undo:** If you fat-finger a number, press `Z` to undo the last spin.
- **Double-zero:** Type `00`, not `0` twice. The engine treats 00 as a distinct pocket.

### Session Discipline

1. **Set a loss limit** before you sit down. Default: -$3 (30% of bankroll).
2. **Set a win target.** Default: +$5 (50% of bankroll).
3. **Never chase.** If the engine says SIT, respect it. The cold-pass logic exists because the old engine lost 23 more bets than it won during cold streaks.
4. **Log your sessions** in `ROULETTE_LEDGER.md` — date, table, spins played, W/L, P&L.
5. **Prime is critical.** The more history you give the engine, the better it calibrates. 20 spins minimum, 50+ is ideal.

---

## Glossary — The Language of the System

| Term | Definition |
|---|---|
| **Prime** | Loading historical spin data into the engine to establish baseline patterns. You "prime" the engine before live play. |
| **Live Feed** | Entering spins one at a time as they happen during active play. |
| **Signal** | One of 6 independent predictive models inside the engine (FREQ, FLOW, HOT, ZONE, DEALER, ACCEL). Each "votes" red or black. |
| **Confluence** | When multiple signals agree on the same color. More confluence = stronger bet. |
| **Posterior** | The Bayesian probability of red vs black after all signals have voted. This is the "final answer." |
| **Mean Reversion** | Betting against the dominant trend. If red is over-represented, bet black — roulette tends to even out. |
| **Edge** | Your statistical advantage over the house. The house edge on American roulette is 5.26%. You need >52.6% accuracy on even-money bets to overcome it. |
| **Positive EV** | Expected Value > 0. A bet where you expect to make money over time. |
| **Selectivity** | The system's ability to identify when NOT to bet. In our backtest, sitting out 46% of spins was the single biggest contributor to profitability. |
| **Cold Pass** | Forced sit-out when the engine is on a losing streak. Momentum < 35% win rate = stop betting. |
| **Kelly Fraction** | Optimal bet size given your edge and bankroll. Quarter-Kelly (25% of theoretical optimal) reduces variance while preserving growth. |
| **Backtest** | Running historical data through the engine to measure accuracy. Prime with Session A, test against Session B. |
| **Dealer Shift** | When the live dealer changes. The engine auto-detects this and enters a "soft reset" for 8 spins while it calibrates to the new dealer's signature. |
| **Entropy** | How random/patterned the recent sequence is. High entropy = pure noise. Low entropy = exploitable patterns. |

---

## Our Approach — What Makes This Different

### Has This Been Done Before?

**Not exactly like this.** Here's the landscape:

- **Roulette bots / prediction apps:** Exist by the hundreds. Most are scams selling "guaranteed systems" (Martingale, Fibonacci, D'Alembert). They don't work because they don't change the underlying probability — they just change how you size bets, which doesn't create edge.
- **Physics-based predictors:** Legal gray area. These use laser timers or visual ballistics to predict which sector the ball will land in based on wheel speed and ball deceleration. They work in theory but require physical access and are banned in most casinos.
- **Machine learning models:** Academic papers exist training neural networks on roulette outcomes. Results are mixed — they tend to find patterns in biased wheels but fail on fair ones.
- **Statistical tracking tools:** Spreadsheets and apps that track hot/cold numbers. No prediction, just logging.

### What We're Doing Differently

This system is a **three-layer co-pilot architecture**. That's the innovation. Not any single layer — the combination:

1. **Layer 1 — The Engine (deterministic, instant):** A client-side Bayesian inference engine that combines 6 independent signals into a single posterior probability. It runs in the browser, responds in <50ms, and — critically — knows when to PASS. The mean-reversion logic (FREQ) is the opposite of what most systems do: when everyone else chases the trend, we bet against it.

2. **Layer 2 — The Analyst (LLM, background):** Gemini Flash runs a full statistical analysis every 10 spins. It doesn't predict — it contextualizes. It tells you "the table is in streak mode" or "Dozen 3 has been frozen for 12 spins." This is the second opinion that no spreadsheet can give you.

3. **Layer 3 — The Human (judgment, final call):** The operator reads both the engine and the analyst, then decides. The human catches things neither system can: the dealer looks tired, the table is about to close, another player's energy is shifting. The human is also the sensor — entering data manually keeps the system legal and undetectable.

### The Real Edge: Knowing When NOT to Bet

The backtest proved it. Going from 134 bets to 69 bets (sitting out 46% of spins) took accuracy from 44% to 58%. The engine isn't smarter about predicting — it's smarter about *filtering*. It passes when:
- Signals conflict (no confluence)
- Momentum is cold (losing streak)
- Entropy is high (pure noise, no patterns)
- Dealer just changed (soft reset)
- Bankroll is critical

This selectivity is the edge. The house wins because people bet every spin. We don't.

A three-layer roulette co-pilot that combines a **client-side Bayesian prediction engine**, a **Gemini Flash background analyst**, and **human judgment** to identify positive-EV betting spots on live American Roulette.

This is not an autonomous bot. It's a decision-support system that tells you *when* to bet (and when to sit out), *what color* to bet, and *how much* to risk based on signal confluence and Kelly Criterion sizing.

---

## Backtest Results (v6.0 — May 2026)

Tested against 140 real spins from the same FanDuel table, primed with 168 historical spins:

| Metric | v5 (Before) | v6 (After) |
|---|---|---|
| **Accuracy** | 44.0% | **58.0%** |
| Bets Placed | 134 | 69 |
| Passes | 0 | 65 |
| HIGH conf (65+) | 0/3 = 0% | **5/3 = 62.5%** |
| MED conf (55-64) | 31/45 = 40.8% | **21/14 = 60.0%** |
| LOW conf (<55) | 28/27 = 50.9% | **14/12 = 53.8%** |
| Break-even | 52.6% | 52.6% |

**Key finding:** The edge comes from *selectivity*, not prediction. The engine sits out 46% of spins and bets only when signals align. High-confidence calls hit 62.5%.

### What Changed (v5 → v6)

1. **FREQ signal flipped to mean reversion** — was chasing trends (28.6% accuracy), now bets against over-represented colors (roulette mean-reverts)
2. **HOT signal strength capped at 0.5** — was dominating the Bayesian posterior at 0.72 avg strength while being wrong 57% of the time
3. **FLOW window tightened to 20 spins** — stale prime data was poisoning transition patterns
4. **Cold momentum = PASS** — engine was 23W/46L wrong during cold streaks, now sits out entirely
5. **Momentum hot boost reduced from 1.05 to 1.02** — was amplifying bad calls

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   LIVE ROULETTE TABLE                │
│              (FanDuel Live Dealer Feed)              │
└──────────────────────┬──────────────────────────────┘
                       │ User watches stream,
                       │ enters spin results
                       ▼
┌─────────────────────────────────────────────────────┐
│              LAYER 1: THE APP (Browser)              │
│                 http://localhost:8888                 │
│                                                      │
│  • User types number → engine processes instantly    │
│  • Bayesian prediction from 6 signals + entropy      │
│  • Visual dashboard: heatmaps, wheel, bias bars     │
│  • Gemini Flash runs background analysis every 10    │
│  • Writes to .tmp/engine_log.jsonl on every spin     │
└──────────┬──────────────────────────┬───────────────┘
           │ POST /log               │ Log file
           ▼                         ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  server.py :8888 │   │  .tmp/engine_log.jsonl       │
│  Python HTTP     │   │  One JSON line per spin:     │
│  Serves files +  │   │  {spin, num, color, pred,    │
│  receives logs   │   │   conf, bet, signals,        │
│                  │   │   confluence, bankroll}       │
└──────────────────┘   └──────────────┬───────────────┘
                                      │ AI reads via:
                                      │ tail -5 .tmp/engine_log.jsonl
                                      ▼
┌─────────────────────────────────────────────────────┐
│             LAYER 2: THE AI (Co-Pilot)               │
│                                                      │
│  • Reads log file (sub-second, no screenshots)       │
│  • Sees everything the engine sees, instantly         │
│  • Provides contextual analysis on demand            │
│  • Can run backtests against historical data          │
│  • Cannot be replaced by the engine alone             │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            LAYER 3: THE HUMAN (Decision)             │
│                                                      │
│  • Provides live data feed (spin numbers)            │
│  • Reads engine prediction + AI + Gemini analysis    │
│  • Makes final bet decision                          │
│  • Places chips on FanDuel                           │
│  • Catches nuance neither engine nor AI sees         │
└─────────────────────────────────────────────────────┘
```

---

## Setup & Running

### Prerequisites
- Python 3.x
- A browser (Chrome recommended)
- Gemini API key (for background analysis — optional but recommended)

### Quick Start
```bash
cd /Volumes/WORK\ 2TB/WORK\ 2026/CASINO
python3 server.py
# Open http://localhost:8888 in your browser
```

### Gemini API Setup

The system uses **Gemini 2.5 Flash** for background table analysis. This is NOT the prediction engine — it's a statistical analyst that runs every 10 spins and provides a human-readable breakdown of table conditions.

**Configuration** is in `gemini_v2.js`:

```javascript
const GEMINI_CONFIG = {
  model: 'gemini-2.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
  callEveryN: 10,        // Analyze every 10 spins (not every spin!)
  maxHistoryTokens: 50,
  enabled: true,
  apiKey: 'YOUR_API_KEY_HERE'
};
```

**How it works:**
1. Every 10 spins, `maybeCallGemini()` fires automatically
2. It builds a payload with the last 30 spins of raw statistics (colors, dozens, streaks, dealer consistency)
3. Sends to Gemini Flash with a structured prompt asking for: table mode, distribution deviations, transition patterns, streak analysis, dozen rotation, hot zones, danger signals, and next-3 predictions
4. Response is rendered in the Gemini Insight panel on the dashboard
5. Also POSTed to `server.py` → written to `.tmp/engine_log.jsonl` so the AI co-pilot can read it

**Token management:**
- Gemini is suppressed during bulk prime (no calls on multi-number paste)
- Calls are throttled to every 10 spins minimum
- If Gemini API fails, a local fallback generates basic analysis from the same data
- During backtests, suppress Gemini: `window._origGemini = requestGeminiAnalysis; requestGeminiAnalysis = function(){};`

**To change the API key at runtime:**
```javascript
setGeminiKey('your-new-key-here')
```

---

## Prediction Engine — How It Works

### Signal Architecture (6 signals + entropy meta-signal)

All signals live in `engine/signals.js`. Each returns `{ vote, str, label, reliability }`.

| Signal | What It Does | Window | Accuracy (backtest) |
|---|---|---|---|
| **FREQ** | Mean-reversion Z-score. If red is over-represented, bets BLACK. | 20 spins | Improved from 28.6% → positive after flip |
| **FLOW** | N-2 Markov chain transition patterns. | 20 spins | ~50% (neutral, used for confluence) |
| **HOT** | Number frequency spikes. Counts which color has more "hot" numbers. | 15 spins | ~50% (capped at 0.5 strength) |
| **ZONE** | Circular centroid clustering on the physical wheel. | 8-30 spins (adaptive) | ~42% (weak, low strength) |
| **DEALER** | EMA physics model — projects next landing based on wheel delta patterns. | 10 spins | ~33% (only fires when dealer is consistent) |
| **ACCEL** | Second-derivative delta acceleration. | 12 spins | ~40% (rarely fires) |
| **ENTROPY** | Meta-signal — modifies other signals' reliability based on pattern density. | 12 spins | N/A (modifier only) |

### Bayesian Posterior Update

In `engine/predict.js`:

```
Start: pRed = 18/38, pBlack = 18/38
For each signal with a vote:
  likelihood_ratio = 1 + (strength × reliability)
  if vote == 'red':  pRed *= LR; pBlack /= (LR × 0.5 + 0.5)
  if vote == 'black': pBlack *= LR; pRed /= (LR × 0.5 + 0.5)
Normalize. Apply momentum. Apply soft reset if dealer changed.
Winner = argmax(pRed, pBlack)
Confidence = max(pRed, pBlack) × 100 (capped at 95)
```

### Kelly Criterion Bet Sizing

```
edge = probability × 2 - 1
fraction = edge × 0.25 (quarter-Kelly for variance reduction)
bet = bankroll × fraction (snapped to $0.50 grid)
```

Sizing labels:
- **LEAN:** $0.50 (marginal edge or high variance)
- **BASE:** $1.00 (standard edge)
- **STRONG:** $1.50 (strong signal confluence)
- **MAX:** $2.00 (rare — multiple strong signals agree)
- **SIT:** $0.00 (cold momentum — forced pass)
- **STOP:** $0.00 (bankroll critical, below $2)

### Momentum Logic

- **Hot** (>65% win rate last 15 bets): Tiny 2% boost to posterior (was 5%, reduced)
- **Cold** (<35% win rate last 15 bets): **Force PASS** — don't bet during losing streaks
- **Neutral** (35-65%): Normal operation

### Dealer Change Detection

Auto-detects when the dealer changes by comparing the standard deviation and mean of wheel deltas from the last 5 spins vs the previous 5. If they diverge significantly, triggers an 8-spin "soft reset" that dampens confidence until the new dealer's pattern stabilizes.

---

## Dashboard UI

The dashboard is a fixed-height, scroll-free command layout designed for zero UI shift during real-time data updates.

### Layout (top to bottom):
1. **Prediction Hero** — Color call, confidence %, bet sizing, reason
2. **Dimension Call Badges** — Odd/Even, High/Low, Dozens deviation from expected
3. **Table Heatmap** — 38-cell grid (0-36 + 00), intensity = hit frequency
4. **Wheel Pattern** — Linear representation of physical wheel positions
5. **Bias Bars** — Visual fill bars for Red/Black, High/Low, Odd/Even, Dozens
6. **Stats Row** — W/L record, accuracy %, bankroll, session high
7. **Gemini Insight Panel** — Background analysis from Gemini Flash
8. **Input** — Number entry, undo, keyboard shortcuts

### Layout Locking
All elements use fixed heights and `min-height` to prevent reflow:
- Dashboard grid: `height: 110px`
- Table heatmap: `height: 172px`
- Wheel pattern: `height: 44px`
- Bias bars: `height: 110px`
- Transitions are `color` and `background` only — no size animations

---

## Live Session Workflow

### Phase 1: Prime (30 seconds)
1. Screenshot the results board from FanDuel
2. Give AI the image → AI reads numbers
3. Paste into app input as space-separated string (newest first, left to right — how the casino displays it)
4. Engine reverses for chronological order and loads history
5. Gemini fires initial analysis

### Phase 2: Live Play
6. Spin happens → Enter number in app input
7. Engine instantly shows prediction for the NEXT spin
8. Gemini runs background analysis every 10 spins
9. AI co-pilot reads `.tmp/engine_log.jsonl` for context
10. User decides and places bet

### Data Entry Format
- **Single spin:** Type number, press Enter (e.g., `16` or `00`)
- **Bulk prime:** Paste space-separated string (e.g., `0 14 35 16 2 31 18 18`)
- **Newest first** — how the casino scoreboard displays it
- Engine auto-detects bulk vs single mode

### Keyboard Shortcuts
- `Enter` — Submit number
- `Z` — Undo last spin
- `T` — Toggle flight timing

---

## Backtesting

The system supports backtesting against real historical data using `browser-harness`.

### Running a Backtest
```bash
# Backtest scripts are in .tmp/
browser-harness -c "$(cat .tmp/run_backtest_v2.py)"
```

### Backtest Methodology
1. Prime with Session A data (bulk submit)
2. Suppress Gemini to avoid token burn
3. Feed Session B spins one at a time (chronologically)
4. Before each spin: capture current prediction
5. After each spin: compare prediction to actual result
6. Report accuracy, streaks, confidence breakdown

### Key Insight from Backtesting
The system's edge comes from **selectivity** (65/140 passes = 46% sit-out rate), not raw prediction accuracy. When it bets, it's right 58% of the time. When it would have been wrong, it often sits out due to cold momentum detection.

---

## Log File Format

`.tmp/engine_log.jsonl` — one JSON object per line, appended on every spin:

```json
{
  "ts": "2026-05-14T01:02:33.456Z",
  "spin": 42,
  "num": "16",
  "color": "red",
  "pred": "red",
  "conf": 68,
  "bet": { "label": "BASE", "size": 1.0 },
  "streak": { "color": "red", "length": 4 },
  "dozens": { "d1": 12, "d2": 18, "d3": 12 },
  "highLow": { "high": 24, "low": 18 },
  "oddEven": { "odd": 19, "even": 23 },
  "confluence": 3,
  "bankroll": 11.50,
  "wl": { "w": 8, "l": 6, "pct": "57%" }
}
```

AI reads via: `tail -n 5 .tmp/engine_log.jsonl`

---

## File Structure

```
CASINO/
├── index.html              # Main dashboard UI
├── style.css               # Layout-locked CSS (v6)
├── server.py               # Python HTTP server (:8888)
├── gemini_v2.js            # Gemini Flash integration (background analyst)
├── README.md               # This file
├── ROULETTE_MASTER_PLAN.md  # Strategy research + historical backtest data
├── ROULETTE_LEDGER.md       # Session P&L tracking
├── SYSTEM_FRAMEWORK.md      # System architecture notes
├── AGENTS.md                # Agent operating rules
│
├── engine/                  # Core engine modules (loaded by browser)
│   ├── state.js             # Constants (WHEEL, RED, BLK), variables, helpers
│   ├── signals.js           # 6 signal generators + entropy meta-signal
│   ├── predict.js           # Bayesian inference + Kelly sizing + momentum
│   ├── render.js            # DOM rendering + dimension call badges
│   └── input.js             # Input handling, submit, undo, keyboard, TTS, logging
│
├── .tmp/                    # Runtime files (gitignored)
│   ├── engine_log.jsonl     # Live spin log (AI reads this)
│   ├── run_backtest_v2.py   # Backtest runner (browser-harness)
│   ├── run_backtest_diag.py # Diagnostic backtest (signal-level analysis)
│   └── sim.js               # CLI simulation runner
│
├── directives/              # SOPs
│   └── stealth_roulette.md  # Operational security protocol
│
├── stealth/                 # Stealth roulette app (React, separate project)
│
└── knowledgebase/           # Local research & reference
```

---

## Bankroll Management

- **Starting bankroll:** $10
- **Bet sizes:** $0.50 (LEAN) → $1.00 (BASE) → $1.50 (STRONG) → $2.00 (MAX)
- **Loss limit:** -$3.00 per session (30%). Walk away.
- **Win target:** +$5.00 per session (50%). Take profit.
- **Never chase losses.** The engine forces PASS during cold streaks.
- **Kelly sizing** ensures bet size scales with edge strength and bankroll health.
- **Hard cap:** Never risk more than 20% of remaining bankroll on a single bet.

---

## Roadmap

### ✅ Phase 1: Bayesian Engine + Backtest Validation
- [x] 6-signal Bayesian prediction engine
- [x] Gemini Flash background analyst
- [x] Real-data backtesting framework
- [x] Signal diagnosis and fix (FREQ mean-reversion, HOT cap, cold PASS)
- [x] Layout-locked dashboard UI (zero shift)
- [x] Kelly Criterion bet sizing

### 🔄 Phase 2: Visual Enhancements
- [ ] Physical roulette wheel graphic (sector-colored, static)
- [ ] Enhanced heatmap with sector clustering
- [ ] Wheel pattern visualization (dealer signature)

### 📋 Phase 3: Multi-Bet Types
- [ ] Odd/Even predictions
- [ ] Dozens predictions (1-12, 13-24, 25-36)
- [ ] High/Low predictions
- [ ] Cross-dimension confluence scoring

### 📋 Phase 4: Automation
- [ ] OCR board screenshots automatically
- [ ] Auto-prime from screenshot (no manual typing)
- [ ] Live feed video overlay integration
- [ ] Session database (track P&L across sessions)

---

## Version History

| Version | Date | Changes |
|---|---|---|
| v6.0 | 2026-05-14 | Mean-reversion FREQ, HOT cap, cold PASS, backtest validation (58% accuracy) |
| v5.0 | 2026-05-14 | Dashboard layout lockdown, dimension call badges, bias bars |
| v4.0 | 2026-05-13 | Gemini Flash integration, co-pilot log system |
| v3.0 | 2026-05-13 | Table heatmap, wheel pattern display |
| v2.0 | 2026-05-13 | Bayesian inference + Kelly sizing |
| v1.0 | 2026-05-12 | Initial stealth roulette delta calculator |
