import subprocess
import re
import json

def scan_screen():
    # 1. Take native screenshot
    subprocess.run(["screencapture", "-x", "-D", "2", "/tmp/casino_board.png"])
    
    # 2. Run Tesseract on it
    result = subprocess.run(["tesseract", "/tmp/casino_board.png", "stdout", "--psm", "11"], capture_output=True, text=True)
    text = result.stdout
    
    # Extract numbers 0-36 or 00
    # This is a basic filter, but since the board has lots of numbers, we just dump raw text for the LLM to process
    print(text)

if __name__ == "__main__":
    scan_screen()
