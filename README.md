# Edge Engine — Roulette Co-Pilot System

> **Version:** 2.0 (Confluence + Co-Pilot Architecture)  
> **Status:** Active Development  
> **Bankroll:** $10  
> **Bet Range:** $0.50 - $2.00  
> **Game:** FanDuel Live Dealer American Roulette (Red/Black only, for now)

---

## Architecture

This is a **three-layer co-pilot system**, not an autonomous predictor.

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
│  • Visual dashboard: prediction, streaks, heatmaps   │
│  • Writes to .tmp/engine_log.jsonl on every spin     │
│  • User sees prediction on-screen immediately        │
└──────────┬──────────────────────────┬───────────────┘
           │ POST /log               │ Log file
           ▼                         ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  server.py :8888 │   │  .tmp/engine_log.jsonl       │
│  Serves files +  │   │  One JSON line per spin:     │
│  receives logs   │   │  {spin, num, color, pred,    │
│                  │   │   streak, dozens, high_low,  │
│                  │   │   conf, bet, signals,        │
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
│  • Provides contextual analysis on top:              │
│    - "Streak of 4 Reds, ride it"                     │
│    - "Dozen 3 just went cold, shift"                 │
│    - "3 dimensions agree — strong play"              │
│    - "Table is chopping, sit this one out"            │
│  • Cannot be replaced by the engine alone             │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            LAYER 3: THE HUMAN (Decision)             │
│                                                      │
│  • Provides live data feed (spin numbers)            │
│  • Reads AI analysis + engine prediction             │
│  • Makes final bet decision                          │
│  • Places chips on FanDuel                           │
│  • Catches nuance neither engine nor AI sees         │
└─────────────────────────────────────────────────────┘
```

---

## Live Session Workflow

### Phase 1: Prime (30 seconds)
1. Screenshot the results board from FanDuel
2. Give AI the image → AI OCR's numbers into an array
3. Paste array into the app input → engine loads history
4. AI loads the same array via `sim.js` → both systems synced

### Phase 2: Catch Up (1-2 minutes)
5. Enter the last few live spins one at a time to sync with stream
6. AI receives same numbers in chat
7. Both systems are now real-time

### Phase 3: Co-Pilot (Active Play)
8. Spin happens → User enters number in app AND chat
9. App instantly shows prediction → User sees it on screen
10. App writes to `engine_log.jsonl` → AI reads it via `tail`
11. AI provides one-line read: "Engine says Red, 3 confluences, ride the streak"
12. User decides and places bet
13. Repeat from step 8

### Inference Speed Requirements
- **App prediction:** < 50ms (JavaScript, client-side)
- **AI log read:** < 500ms (`tail` command)
- **AI analysis:** < 2 seconds (text response)
- **Total co-pilot loop:** < 3 seconds from spin to recommendation

---

## Engine Philosophy (v2)

### What Failed (v1)
The old engine used 6 "physics" signals (DEALER, ZONE, FREQ, FLOW, HOT, ACCEL) to predict Red/Black via Bayesian inference. **Backtest result: 45.8% hit rate** — worse than random. Every signal scored below 50%. The engine was a contrarian betting against streaks in a continuation market.

### What Works (v2) — Data-Proven
Based on 168-spin backtest of live FanDuel data:

| Signal | Finding | Edge |
|---|---|---|
| **Streak Continuation** | After 3+ same color, continues 62.2% | +9.6% |
| **Same-Color Transition** | Same color continues 54.2% overall | +1.6% |
| **HIGH Dominance** | HIGH (19-36) running at 59.6% | +7.0% |
| **Dozen Skew** | Dozen 2+3 running +15% above expected | +12.4% |
| **EVEN Bias** | EVEN at 53.2% vs ODD 46.8% | +0.6% |

### Core Principle: Follow the Table
- **Don't predict reversals.** Ride what's running.
- **Don't bet every spin.** Wait for confluence.
- **Don't fight the streak.** After 3+, bet WITH it.
- **Shift when it shifts.** When a signal goes cold, follow the new one.

### Confluence Scoring
When multiple dimensions agree, bet harder:
- 1 dimension: OBSERVE (sit out)
- 2 dimensions: LEAN ($0.50)
- 3 dimensions: BASE ($1.00)
- 4+ dimensions: STRONG ($1.50-$2.00)

---

## Log File Format

`engine_log.jsonl` — one JSON object per line, appended on every spin:

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

AI reads this via: `tail -n 5 .tmp/engine_log.jsonl`

---

## File Structure

```
CASINO/
├── index.html              # Main app UI
├── style.css               # App styles
├── server.py               # Python HTTP server (serves files + receives log POSTs)
├── README.md               # This file
├── ROULETTE_MASTER_PLAN.md  # Strategy research + backtest data
├── ROULETTE_LEDGER.md       # Session P&L tracking
│
├── engine/                  # Core engine modules (loaded by browser)
│   ├── state.js             # State: hist[], bankroll, counters, wheel layout
│   ├── signals.js           # Signal generators (streak, confluence, dozen tracking)
│   ├── predict.js           # Prediction logic + Kelly sizing
│   ├── render.js            # DOM rendering
│   └── input.js             # Input handling, submit, undo, keyboard, TTS
│
├── .tmp/                    # Runtime files (gitignored)
│   ├── engine_log.jsonl     # ← Live spin log (AI reads this)
│   ├── sim.js               # CLI simulation runner
│   ├── backtest.js          # Full backtest harness
│   └── deep_analysis.js     # Statistical deep-dive tool
│
├── directives/              # SOPs
│   └── stealth_roulette.md  # Operational security protocol
│
└── knowledgebase/           # Local research & reference
```

---

## Bankroll Management

- **Starting bankroll:** $10
- **Bet sizes:** $0.50 (LEAN) → $1.00 (BASE) → $2.00 (STRONG)
- **Loss limit:** -$3.00 per session (30%). Walk away.
- **Win target:** +$5.00 per session (50%). Take profit.
- **Never chase losses.** Never increase after a loss.
- **Oscar's Grind:** For steady sessions — aim for +$1 per cycle.

---

## Future Roadmap

### Phase 1 (Current): Red/Black + Co-Pilot ✅
- [x] Backtest engine against real data
- [x] Identify working signals (streaks, confluence)
- [ ] Rebuild engine around table-following philosophy
- [ ] Add log file system for AI speed
- [ ] Test live with $0.50 bets

### Phase 2: Multi-Bet Types
- [ ] Add Odd/Even predictions
- [ ] Add Dozens predictions (1-12, 13-24, 25-36)
- [ ] Add High/Low predictions
- [ ] Confluence scoring across all bet types

### Phase 3: Full Backend
- [ ] Move from Python file server to proper Node/Express backend
- [ ] WebSocket connection for real-time log streaming
- [ ] Session database (track P&L across sessions)
- [ ] Historical backtest UI

### Phase 4: Vision
- [ ] OCR the results board from screenshots automatically
- [ ] Detect dealer changes from video feed
- [ ] Auto-prime from board screenshot (no manual typing)
