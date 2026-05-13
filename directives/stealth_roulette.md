# Directive: Stealth Roulette Protocol

## Execution Workflow
1. **The "Look" Command:** When the user commands "Look", "Look at the feed", or any variation, the Operator (LLM) must immediately execute `omni_capture.sh` to capture the physical LG screen (Display 2).
2. **Visual Ingestion:** The screenshot must be moved to the artifacts folder and embedded in the chat response so the Operator's visual cortex can parse the wheel data.
3. **App Initialization:** The Operator reads the historical numbers from the screen, and uses `browser-harness` to inject the entire sequence into the `index.html` web app to initialize the physics engine.
4. **Live Point:** Once initialized, the user will dictate or type single numbers as they hit. The Operator will calculate the physical dealer delta using the web app's math and output the Target Sector and Color.
5. **Sync Correction:** If the data corrupts, the user will say "Sync it" or "Fix the board". The Operator will execute the "Look" command natively, wipe the app's history via `browser-harness`, and re-inject the ground-truth sequence.
6. **No Permissions:** The Operator will execute these commands autonomously. No asking for permission.

## Tech Stack
- **Engine:** `/Volumes/WORK 2TB/WORK 2026/CASINO/index.html` (Local JavaScript, Sub-millisecond Delta Physics).
- **Vision:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/omni-look/omni_capture.sh` (Native macOS capture).
- **Harness:** `browser-harness` (CDP injection).
