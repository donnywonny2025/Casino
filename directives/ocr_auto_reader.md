# OCR Auto-Reader System — Full Setup Guide

## Overview
Automated number reading from FanDuel live dealer roulette via background CDP screenshot + Tesseract OCR. Reads the stats panel and feeds numbers directly into the engine without manual entry.

## Prerequisites
1. Chrome launched with debug port: `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &`
2. FanDuel live roulette tab open in Chrome
3. Stats panel visible on the roulette table (shows recent numbers)
4. Python packages: `pytesseract`, `Pillow`, `websocket-client`
5. Tesseract OCR installed: `brew install tesseract`

## Files Involved
- `ocr_poller.py` — Background process that screenshots FanDuel tab via CDP, crops the stats panel, runs OCR, posts new numbers to server
- `server.py` — Endpoints: `/api/ocr-start`, `/api/ocr-stop`, `/api/ocr-latest`, `/api/ocr-bootstrap`, `/ocr-spin`
- `index.html` — Dashboard OCR toggle button, bootstrap loader, polling loop
- `.tmp/ocr_latest.json` — Last detected number
- `.tmp/ocr_bootstrap.json` — Initial board numbers on first read
- `.tmp/ocr_poller.log` — Poller output log

## How It Works

### 1. Chrome CDP Background Capture
The poller connects to `localhost:9222`, finds the FanDuel tab by URL, attaches via `Target.attachToTarget` with `flatten=True` to get a session ID. This allows screenshotting WITHOUT switching tabs or stealing focus.

```python
# Key CDP calls:
targets = cdp_send("Target.getTargets")
session = cdp_send("Target.attachToTarget", targetId=tab_id, flatten=True)
screenshot = cdp_send("Page.captureScreenshot", sessionId=session_id)
```

### 2. OCR Crop Region
The stats panel is cropped from the screenshot. Crop coordinates are stored in localStorage keys:
- `feedCrop` — Primary crop: `{x, y, w, h}` in percentage of screenshot dimensions
- `feedCrop2` — Alternative crop
- `ocrCrop` — Fallback

Default crop targets the stats panel showing recent spin numbers.

### 3. Number Detection
- Screenshot → crop to stats panel → grayscale → threshold → Tesseract OCR
- OCR output is parsed for 1-2 digit numbers (0-36, 00)
- Compared against last known number to detect new spins
- New numbers are posted to `/ocr-spin` endpoint

### 4. Dashboard Integration
- OCR START button toggles the poller on the server
- `pollOcrLatest()` runs every 8 seconds, fetches `/api/ocr-latest`
- If a new number is detected, it calls `submit(number)` to feed the engine
- On first start, `checkBootstrap()` fetches `/api/ocr-bootstrap` for initial board state

### 5. Bootstrap Logic
On poller start, the first screenshot reads ALL visible numbers from the stats panel. These are saved as bootstrap data and bulk-fed into the engine to prime it. If localStorage already has more spins, bootstrap is skipped (preserves history).

## Server Endpoints

```
POST /api/ocr-start     — Starts ocr_poller.py as subprocess
POST /api/ocr-stop      — Kills the poller process
GET  /api/ocr-latest    — Returns last detected number + timestamp
GET  /api/ocr-bootstrap — Returns initial board numbers array
POST /ocr-spin          — Receives new number from poller, updates ocr_latest.json
```

## Known Issues & Fixes
1. **Chrome debug port dies:** Chrome must be launched with `--remote-debugging-port=9222`. If Chrome is restarted normally, the port is lost. Fix: relaunch with the flag.
2. **Stale poller processes:** Multiple pollers can accumulate. Fix: `pkill -f ocr_poller` before starting fresh.
3. **503 errors:** Occasional Tesseract/CDP timeouts. Poller retries automatically.
4. **Bootstrap overwrites history:** Fixed — bootstrap now checks if localStorage has more data and skips if so.

## Restart Procedure
```bash
# 1. Kill stale pollers
pkill -f ocr_poller

# 2. Ensure Chrome has debug port
# Close Chrome fully, then:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &

# 3. Open FanDuel in Chrome, navigate to live roulette

# 4. Start the server
cd /Volumes/WORK\ 2TB/WORK\ 2026/CASINO && python3 server.py

# 5. Open dashboard at http://localhost:8888

# 6. Click OCR START on the dashboard (or hit the toggle)
```

## Signal Weights When OCR Active
The OCR system feeds numbers to the same `submit()` function as manual entry. All signals, predictions, logging, and flight timing work identically whether the number comes from OCR or keyboard.
