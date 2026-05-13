# Roulette Analytics Engine - Framework & Architecture

## Core Philosophy
The Roulette Analytics Engine is designed as a **high-speed, zero-latency local web application**. The primary goal is to completely remove the AI conversational delay from the real-time betting process. By running the prediction models (Markov Chains, Physics Delta, Flight Timing CV) locally in the browser, the system can instantly react to new spins and provide actionable betting insights without waiting for an AI to reply.

## The 3-File Architecture
The system MUST be modular and adhere to best practices. It consists of three perfectly separated layers:

1. **`index.html` (The UI Shell):** Contains the DOM structure, CSS styling, grid layouts, and the Flight Timing Telemetry strip (the interactive spacebar clock).
2. **`engine.js` (The Physics & Logic Core):** The heavy lifter. Contains the `preSeed` array (historical ground truth), Markov flow calculations, the global spacebar event listener for timing ball flight, undo functionality, and the 5-spin Priming phase logic.
3. **`gemini_v2.js` (The Tactical Risk Manager):** Replaced the JSON-heavy V1. Takes a plain-text payload of momentum (win/loss streak) and timing consistency from the engine, and outputs a simple `[SIZING] - [Reason]` directive to manage bankroll.

## The Incident: Why Was It Merged?
During an attempt to bypass browser caching issues (where the browser refused to load updated logic), a critical mistake was made: a script was written to forcibly merge `engine.js` and `gemini.js` directly into `index.html`. 
**Why this was a catastrophic failure:**
- It corrupted the HTML syntax, causing the entire UI to break.
- It violated the fundamental software engineering principle of Separation of Concerns.
- It destroyed the ability to easily maintain, debug, and update the engine logic cleanly.
This approach has been permanently abandoned. The files have been split back to their proper, independent states, and cache issues are now managed via query string versioning (e.g. `?v=23000`).

## How to Operate the System
1. **Load the App:** The app must be accessed via your local server (or direct file open).
2. **Hard Refresh:** Because browsers aggressively cache `.js` files, always ensure the version in `index.html` is updated (e.g., `?v=23000`) and hard refresh the browser.
3. **Flight Timing (The Rhythm):**
   - Press **SPACEBAR** (or click TAP) the moment the dealer releases the ball. The clock will tick in real-time.
   - Press **SPACEBAR** again the moment the ball lands. The UI will instantly focus the input box.
   - If you misclick, press **ESC** to cancel the active timer, or click **UNDO** to remove a bad time.
4. **Submit Spins:** Type the number into the 'Enter Number' box and hit Enter. The prediction will generate instantly.
5. **Priming:** The first 5 spins of a session are strictly for calibration ("PRIMING"). Do not bet. Let the system sync with the dealer's physical consistency.

**DO NOT rely on me to read screenshots to update your app.** The entire purpose of this local app is for YOU to have instant, zero-latency predictions by typing the numbers as they drop. Sending me a screenshot to read and update introduces a 30-second delay, which makes live betting impossible.
