"""
OCR Poller — Runs as a background process.
Every 10 seconds: screenshot FanDuel tab → crop stats panel → Gemini reads numbers → detect new spins.
Uses browser-harness for screenshots, saved crop coordinates, and Gemini 2.5 Flash for OCR.

Usage: python3 ocr_poller.py
"""
import json
import base64
import urllib.request
import subprocess
import time
import os
import re
import sys
import signal
import atexit
from datetime import datetime
from PIL import Image
import io

# ─── PID Lock — prevent duplicate pollers ───
PID_FILE = '.tmp/ocr.pid'

def check_pid_lock():
    """Exit immediately if another poller is already running."""
    if os.path.exists(PID_FILE):
        try:
            old_pid = int(open(PID_FILE).read().strip())
            # Check if that process is actually alive
            os.kill(old_pid, 0)
            print(f'[OCR] Another poller is already running (PID {old_pid}). Exiting.')
            sys.exit(0)
        except (ProcessLookupError, ValueError):
            # Old process is dead, clean up stale PID file
            os.remove(PID_FILE)
        except PermissionError:
            # Process exists but we can't signal it — it's alive
            print(f'[OCR] Another poller is already running. Exiting.')
            sys.exit(0)
    
    os.makedirs('.tmp', exist_ok=True)
    with open(PID_FILE, 'w') as f:
        f.write(str(os.getpid()))

def cleanup_pid():
    try:
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)
    except:
        pass

atexit.register(cleanup_pid)
signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))

check_pid_lock()

# ─── Config ───
POLL_INTERVAL = 10  # seconds
CROP_FILE = '.tmp/ocr_crop.json'
ENGINE_URL = 'http://localhost:8888'

# Load API key from .env
API_KEY = ''
if os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            if line.startswith('GEMINI_API_KEY='):
                API_KEY = line.strip().split('=', 1)[1]
if not API_KEY:
    print("[ERROR] No GEMINI_API_KEY in .env")
    exit(1)

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={API_KEY}"

# Two prompts: bootstrap reads ALL rows, poll reads only top row
PROMPT_BOOTSTRAP = (
    "This image shows a roulette LAST 500 ROUNDS statistics grid. "
    "Read ALL numbers from EVERY row, top to bottom, left to right. "
    "Each row has about 11 numbers. Return them as a single line of space-separated integers. "
    "Return ONLY the numbers, nothing else."
)

PROMPT_POLL = (
    "Read the numbers from the FIRST/TOP row only (the large numbers). "
    "Return space-separated integers left to right. ONLY numbers, nothing else."
)

HISTORY_FILE = '.tmp/ocr_history.json'

# Load crop coordinates
if not os.path.exists(CROP_FILE):
    print(f"[ERROR] No crop file at {CROP_FILE}. Run calibration first.")
    exit(1)

with open(CROP_FILE) as f:
    crop = json.load(f)
print(f"[OCR] Crop loaded: x={crop['srcX']}, y={crop['srcY']}, {crop['srcW']}×{crop['srcH']}")

# ─── State ───
last_row = []
spins_detected = 0

def capture_and_crop():
    """Screenshot FanDuel tab in BACKGROUND — no focus steal via CDP session_id."""
    tmp_path = '.tmp/ocr_frame.png'
    abs_path = os.path.abspath(tmp_path)
    
    # Background capture: attach to FanDuel target WITHOUT activating it
    script = f'''
import base64
tabs = cdp("Target.getTargets")
fd = [t for t in tabs["targetInfos"] if t.get("type") == "page" and "launcher.casino" in t.get("url","").lower()]
if not fd:
    fd = [t for t in tabs["targetInfos"] if t.get("type") == "page" and "fanduel" in t.get("url","").lower()]
if fd:
    tid = fd[0]["targetId"]
    sid = cdp("Target.attachToTarget", targetId=tid, flatten=True)["sessionId"]
    r = cdp("Page.captureScreenshot", session_id=sid, format="png")
    open("{abs_path}", "wb").write(base64.b64decode(r["data"]))
    print("OK")
else:
    print("NO_TAB")
'''
    result = subprocess.run(
        ['browser-harness', '-c', script],
        capture_output=True, text=True, timeout=15
    )
    
    if 'OK' not in result.stdout:
        if result.stderr:
            print(f"[OCR] Capture error: {result.stderr[:200]}")
        return None
    
    if not os.path.exists(abs_path):
        return None
    
    # Open and crop
    img = Image.open(abs_path)
    scale_x = img.size[0] / crop['videoW']
    scale_y = img.size[1] / crop['videoH']
    
    x = int(crop['srcX'] * scale_x)
    y = int(crop['srcY'] * scale_y)
    w = int(crop['srcW'] * scale_x)
    h = int(crop['srcH'] * scale_y)
    
    cropped = img.crop((x, y, x + w, y + h))
    
    # Convert to base64
    buf = io.BytesIO()
    cropped.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')

def gemini_read(b64_image, prompt):
    """Send cropped image to Gemini, return parsed numbers."""
    payload = {
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": "image/png", "data": b64_image}},
                {"text": prompt}
            ]
        }],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 500}
    }
    
    req = urllib.request.Request(
        GEMINI_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    resp = urllib.request.urlopen(req, timeout=10)
    result = json.loads(resp.read().decode('utf-8'))
    text = result['candidates'][0]['content']['parts'][0]['text'].strip()
    
    # Parse numbers
    numbers = []
    for token in text.split():
        cleaned = re.sub(r'[^0-9]', '', token)
        if cleaned and 0 <= int(cleaned) <= 36:
            numbers.append(int(cleaned))
    
    return numbers

def detect_new_spins(current_row, previous_row):
    """Compare current top row to previous. Return list of new numbers."""
    if not previous_row or not current_row:
        return []  # First read or empty, don't fire
    
    if current_row == previous_row:
        return []  # No change
    
    # Simple and reliable: find how many new numbers were prepended
    # by looking for where the old first number now sits in the new row
    old_first = previous_row[0]
    new_numbers = []
    
    for i, num in enumerate(current_row):
        if num == old_first:
            # Found where old data starts — everything before this is new
            new_numbers = current_row[:i]
            break
    
    # If we didn't find the old first number at all, just take the first number
    # (can happen if the row shifted by more than its length)
    if not new_numbers and current_row[0] != previous_row[0]:
        new_numbers = [current_row[0]]
    
    return new_numbers

def feed_to_engine(number):
    """POST a new spin number to the engine."""
    try:
        data = json.dumps({"number": number, "source": "ocr"}).encode('utf-8')
        req = urllib.request.Request(
            f"{ENGINE_URL}/ocr-spin",
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception:
        return False

def feed_to_engine_bulk(numbers):
    """POST full history array to engine for bootstrap."""
    try:
        data = json.dumps({"numbers": numbers, "source": "ocr-bootstrap"}).encode('utf-8')
        req = urllib.request.Request(
            f"{ENGINE_URL}/ocr-bootstrap",
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req, timeout=10)
        print(f"[OCR] ✓ Sent {len(numbers)} numbers to engine")
        return True
    except Exception as e:
        print(f"[OCR] Engine not receiving yet (will retry): {e}")
        return False

# ─── Main Loop ───
print(f"[OCR] Poller started — checking every {POLL_INTERVAL}s")
print(f"[OCR] Gemini model: gemini-2.5-flash")
print(f"[OCR] Press Ctrl+C to stop\n")

bootstrapped = False

while True:
    try:
        t0 = time.time()
        
        # 1. Screenshot and crop
        b64 = capture_and_crop()
        if not b64:
            print(f"[OCR] {datetime.now().strftime('%H:%M:%S')} — No FanDuel tab found")
            time.sleep(POLL_INTERVAL)
            continue
        
        # 2. Bootstrap or poll
        if not bootstrapped:
            print(f"[OCR] {datetime.now().strftime('%H:%M:%S')} — BOOTSTRAP: Reading full grid...")
            all_numbers = gemini_read(b64, PROMPT_BOOTSTRAP)
            elapsed = time.time() - t0
            
            if all_numbers:
                # Save full history
                history = {
                    "table_history": all_numbers,
                    "total_spins": len(all_numbers),
                    "bootstrapped_at": datetime.now().isoformat(),
                    "last_top_row": all_numbers[:12]
                }
                with open(HISTORY_FILE, 'w') as f:
                    json.dump(history, f, indent=2)
                
                last_row = all_numbers[:12]
                bootstrapped = True
                print(f"[OCR] ✓ Bootstrap complete: {len(all_numbers)} spins loaded [{elapsed:.1f}s]")
                print(f"[OCR]   Recent: {all_numbers[:15]}...")
                print(f"[OCR]   Saved to {HISTORY_FILE}")
                
                # Feed all numbers to engine
                feed_to_engine_bulk(all_numbers)
            else:
                print(f"[OCR] Bootstrap failed, retrying... [{elapsed:.1f}s]")
        else:
            # Poll mode — just read top row
            current_row = gemini_read(b64, PROMPT_POLL)
            elapsed = time.time() - t0
            
            # Detect new spins
            new_spins = detect_new_spins(current_row, last_row)
            
            if new_spins:
                for num in new_spins:
                    spins_detected += 1
                    print(f"[OCR] {datetime.now().strftime('%H:%M:%S')} — 🎯 NEW SPIN: {num} (#{spins_detected}) [{elapsed:.1f}s]")
                    feed_to_engine(num)
                    
                    # Append to history
                    try:
                        with open(HISTORY_FILE) as f:
                            hist = json.load(f)
                        hist['table_history'].insert(0, num)
                        hist['total_spins'] = len(hist['table_history'])
                        hist['last_top_row'] = current_row
                        with open(HISTORY_FILE, 'w') as f:
                            json.dump(hist, f, indent=2)
                    except Exception:
                        pass
            else:
                print(f"[OCR] {datetime.now().strftime('%H:%M:%S')} — No change [{elapsed:.1f}s]")
            
            last_row = current_row
        
        # 3. Wait
        wait = max(0, POLL_INTERVAL - (time.time() - t0))
        time.sleep(wait)
        
    except KeyboardInterrupt:
        print(f"\n[OCR] Stopped. Detected {spins_detected} spins total.")
        break
    except Exception as e:
        print(f"[OCR] {datetime.now().strftime('%H:%M:%S')} — Error: {e}")
        time.sleep(POLL_INTERVAL)
