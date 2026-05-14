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
from datetime import datetime
from PIL import Image
import io

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
    """Screenshot FanDuel tab and crop to stats panel."""
    tmp_path = '.tmp/ocr_frame.png'
    
    # Use browser-harness to screenshot the FanDuel tab
    script = f'''
import time
tabs = cdp("Target.getTargets", {{}})
pages = [t for t in tabs.get("targetInfos", []) if t.get("type") == "page"]
fd = [t for t in pages if "fanduel" in t.get("url","").lower() or "launcher.casino" in t.get("url","").lower()]
if fd:
    switch_tab(fd[0]["targetId"])
    time.sleep(0.5)
    capture_screenshot("{os.path.abspath(tmp_path)}")
    print("OK")
else:
    print("NO_TAB")
'''
    result = subprocess.run(
        ['browser-harness', '-c', script],
        capture_output=True, text=True, timeout=15
    )
    
    if 'NO_TAB' in result.stdout:
        return None
    
    # Find the actual file (browser-harness appends timestamp)
    import glob
    files = sorted(glob.glob('.tmp/ocr_frame*.png'), key=os.path.getmtime, reverse=True)
    if not files:
        return None
    
    # Open and crop
    img = Image.open(files[0])
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
    if not previous_row:
        return []  # First read, don't fire
    
    if current_row == previous_row:
        return []  # No change
    
    if not current_row:
        return []
    
    # Find how many new numbers shifted in from the left
    # The top row shifts right when a new spin happens
    new_numbers = []
    for i, num in enumerate(current_row):
        if i >= len(previous_row) or num != previous_row[0]:
            # Check if this number starts matching the old row at some offset
            remaining = current_row[i:]
            for offset in range(len(previous_row)):
                if previous_row[offset:offset+3] == remaining[:3] and len(remaining) >= 3:
                    # Found where old row starts in new row
                    new_numbers = current_row[:i]
                    return new_numbers
        else:
            break
    
    # Simple case: just the first number is new
    if current_row[0] != previous_row[0]:
        return [current_row[0]]
    
    return []

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
