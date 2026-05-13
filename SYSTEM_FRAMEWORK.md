# CASINO BAYESIAN ENGINE: System Architecture (v4.0)

**Date Documented:** May 2026
**State:** Hardened & Live-Ready

This document outlines the current state of the application after the v4.0 rebuild. It serves as the ground truth for how the system processes data, calculates edge, manages risk, and renders the interface.

## 1. Core Philosophy
This system is an **Entropy Detector** and **Bankroll Manager**. It does not assume roulette is beatable on every spin. It assumes that physical dealers occasionally fall into readable, low-entropy rhythms. 
- **The Math:** Bayesian inference combined with physical wheel mapping.
- **The Risk:** Cold, emotionless Kelly Criterion scaling based on active bankroll.
- **The Goal:** Detect the edge, size the bet proportionally, and survive the variance.

---

## 2. The Engine (`/engine/`)

The core deterministic logic is decoupled from the UI and the LLM layer. It is split into five functional files:

### `state.js` (The Source of Truth)
- Holds the global variables (`hist`, `bankroll`, `wins`, `losses`).
- Contains the `WHEEL` array constant: the exact physical pocket order of an American Roulette wheel.
- Manages `localStorage` persistence so state survives browser refreshes.

### `input.js` (Data Ingestion & Scoring)
- Handles raw number input from the user.
- **Bulk Priming:** Automatically detects multi-number pastes (like copying a grid from FanDuel) and reverse-ingests them chronologically to build an instant dealer baseline.
- **P&L Resolution:** When a single live spin is entered, it resolves the previous prediction against the result. If a bet was recommended, it mathematically adds or subtracts from the `bankroll` variable in `state.js`.

### `signals.js` (The Detectors)
- Evaluates specific mathematical conditions against the current wheel history.
- **Current Signals:** `DEALER` (variance), `ZONE` (clustering), `FREQ` (color bias), `FLOW` (streak physics), `HOT` (pocket frequency), `ACCEL` (momentum).

### `predict.js` (The Brain)
- Calculates standard deviation and entropy to detect if a dealer has shifted or if the wheel is completely random.
- Aggregates the 6 signals to generate a Bayesian posterior probability for Red vs. Black.
- **Cold Math Kelly Sizing:** If an edge is detected, it calculates the bet size proportionally to the *current* bankroll (max 15% risk). It automatically throttles down during high variance but never arbitrarily panics.

### `render.js` (The Visuals)
- Maps the mathematical state to the DOM.
- **Dual Heat Maps:** Colors the HTML grids based on frequency arrays. 
- **Stealth Mode:** Only shows essential telemetry. No flashy animations or distracting visual P&L bars.

---

## 3. The Visual Layer (`index.html` & `style.css`)

### Dual Spatial Heat Maps
The sequential number grid was discarded because dealer signatures are physical, not sequential.
1. **Wheel Map:** 2 rows of 19 pockets, rendered in exact physical wheel order. Used to visualize physical clustering and release bias.
2. **Table Map:** Standard 3x12 betting layout. Used to visualize where the physical clusters map onto the betting felt.

### Stealth UI
- Pure CSS dark mode with native, invisible scrollbars.
- `index.html` utilizes cache-busting (`?v=...`) to ensure the browser always loads the latest styling without ghosting previous versions.

---

## 4. The Advisory Layer (`gemini_v2.js`)

The AI (Gemini) does **not** pick the colors. The deterministic Bayesian engine picks the colors. 
Gemini acts as the "Sharp Friend at the Table."

- **Telemetry Ingestion:** Every 5 spins, Gemini is fed the complete state: recent history, Bayesian posterior, entropy levels, active signals, and critically, **bankroll health**.
- **Role:** It evaluates the engine's confidence against the overarching context (e.g., "The engine has a 60% edge, but we are on a 3-loss streak and bankroll is low").
- **Output:** Advises on pacing and sizing in a single, punchy sentence. 

---

## 5. Standard Operating Procedure (SOP)

1. **Prime the Engine:** Paste the array of the last 140/500 spins from the live casino UI (read top-left to right, newest to oldest). The engine will reverse it and build the baseline.
2. **Observe the Heat Map:** Check if the physical Wheel Map shows distinct clustering. If entropy is 90%+, the dealer is scattering the ball.
3. **Live Entry:** As the live dealer spins, type the result into the app and press Space/Enter.
4. **Follow the Math:** If the UI says `RED - $1.5 HALF`, you bet $1.50 on Red. If the UI says `PASS` or `LEAN`, you sit out and let the engine recalibrate.
