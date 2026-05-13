import subprocess
import time
import re
import os
from PIL import Image

# CONFIGURATION
DISPLAY = "2" # LG Left
STATS_CROP = (1410, 520, 1450, 560)
LOCAL_DIR = "/Volumes/WORK 2TB/WORK 2026/CASINO/.vision"
BUFFER_PATH = f"{LOCAL_DIR}/vision_history.txt"
FULL_FRAME = f"{LOCAL_DIR}/vision_full.png"
NUM_CROP = f"{LOCAL_DIR}/vision_num.png"

# Ensure local dir exists
if not os.path.exists(LOCAL_DIR): os.makedirs(LOCAL_DIR)

LAST_NUMBER = None

def get_vision_data():
    subprocess.run(["screencapture", "-x", "-D", DISPLAY, FULL_FRAME])
    with Image.open(FULL_FRAME) as img:
        stats_img = img.crop(STATS_CROP)
        stats_img.save(NUM_CROP)

    num_out = subprocess.run([
        "tesseract", NUM_CROP, "stdout", "--psm", "11", 
        "-c", "tessedit_char_whitelist=0123456789"
    ], capture_output=True, text=True).stdout.strip()
    nums = re.findall(r'\b\d{1,2}\b', num_out)
    return nums[0] if nums else None

def vision_loop():
    global LAST_NUMBER
    print(f"🚀 LOCAL VISION CACHE ACTIVE: {LOCAL_DIR}")
    while True:
        try:
            num = get_vision_data()
            if num and num != LAST_NUMBER:
                with open(BUFFER_PATH, "a") as f:
                    f.write(f"{num}\n")
                LAST_NUMBER = num
            time.sleep(2)
        except Exception:
            time.sleep(5)

if __name__ == "__main__":
    vision_loop()
