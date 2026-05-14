from http.server import SimpleHTTPRequestHandler, HTTPServer
import json
import os
import subprocess
import signal
from datetime import datetime, timezone

LOG_FILE = '.tmp/engine_log.jsonl'
ocr_process = None  # Global ref to OCR poller subprocess

class EdgeHandler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        global ocr_process
        if self.path == '/log':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                # Add server-side timestamp
                data['ts'] = datetime.now(timezone.utc).isoformat()
                
                # Ensure .tmp directory exists
                os.makedirs('.tmp', exist_ok=True)
                
                # Append one JSON line to the log file
                with open(LOG_FILE, 'a') as f:
                    f.write(json.dumps(data) + '\n')
                
                spin = data.get('spin', '?')
                num = data.get('num', '?')
                pred = data.get('pred', '?')
                conf = data.get('conf', '?')
                confluence = data.get('confluence', 0)
                bankroll = data.get('bankroll', '?')
                
                print(f"[LOG] #{spin} → {num} | pred:{pred} conf:{conf}% confl:{confluence} | ${bankroll}")
                
            except Exception as e:
                print(f"[ERROR] Log write failed: {e}")
                
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        elif self.path == '/telemetry':
            # Legacy telemetry endpoint (backward compat)
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('latest_telemetry.json', 'w') as f:
                    json.dump(data, f, indent=2)
            except Exception as e:
                print(f"Telemetry Error: {e}")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b"OK")

        elif self.path == '/clear-log':
            # Clear the log file for a new session
            try:
                os.makedirs('.tmp', exist_ok=True)
                with open(LOG_FILE, 'w') as f:
                    f.write('')  # Truncate
                print("[LOG] Session log cleared")
            except Exception as e:
                print(f"[ERROR] Clear failed: {e}")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        elif self.path == '/prediction':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                os.makedirs('.tmp', exist_ok=True)
                with open('.tmp/prediction.json', 'w') as f:
                    f.write(post_data.decode('utf-8'))
            except Exception as e:
                print(f"[ERROR] Prediction write failed: {e}")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        elif self.path == '/ocr-spin':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                num = data.get('number', '?')
                print(f"[OCR-SPIN] New number from OCR: {num}")
                # Store latest OCR spin for frontend polling
                os.makedirs('.tmp', exist_ok=True)
                with open('.tmp/ocr_latest.json', 'w') as f:
                    json.dump({"number": num, "ts": datetime.now(timezone.utc).isoformat()}, f)
            except Exception as e:
                print(f"[ERROR] OCR spin failed: {e}")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        elif self.path == '/ocr-bootstrap':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                numbers = data.get('numbers', [])
                print(f"[OCR-BOOT] Bootstrap received: {len(numbers)} spins")
                os.makedirs('.tmp', exist_ok=True)
                with open('.tmp/ocr_bootstrap.json', 'w') as f:
                    json.dump({"numbers": numbers, "ts": datetime.now(timezone.utc).isoformat()}, f)
            except Exception as e:
                print(f"[ERROR] OCR bootstrap failed: {e}")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        elif self.path == '/api/set-crop':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                os.makedirs('.tmp', exist_ok=True)
                with open('.tmp/ocr_crop.json', 'w') as f:
                    json.dump(data, f, indent=2)
                print(f"[CROP] Saved: x={data.get('srcX')}, y={data.get('srcY')}, "
                      f"{data.get('srcW')}×{data.get('srcH')}")
            except Exception as e:
                print(f"[ERROR] Crop save failed: {e}")
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')

        elif self.path == '/api/ocr-start':
            if ocr_process and ocr_process.poll() is None:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok":true,"status":"already_running"}')
            else:
                try:
                    ocr_process = subprocess.Popen(
                        ['python3', 'ocr_poller.py'],
                        cwd=os.path.dirname(os.path.abspath(__file__)) or '.',
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT
                    )
                    print(f"[OCR] Poller started (PID {ocr_process.pid})")
                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(f'{{"ok":true,"pid":{ocr_process.pid}}}'.encode())
                except Exception as e:
                    print(f"[ERROR] OCR start failed: {e}")
                    self.send_response(500)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(f'{{"error":"{e}"}}'.encode())

        elif self.path == '/api/ocr-stop':
            if ocr_process and ocr_process.poll() is None:
                ocr_process.terminate()
                try:
                    ocr_process.wait(timeout=5)
                except Exception:
                    ocr_process.kill()
                print(f"[OCR] Poller stopped")
                ocr_process = None
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true,"status":"stopped"}')

        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        global ocr_process
        # API endpoints (return JSON)
        if self.path == '/api/ocr-status':
            running = ocr_process is not None and ocr_process.poll() is None
            pid = ocr_process.pid if running else None
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"running": running, "pid": pid}).encode())
            return

        if self.path == '/api/ocr-latest':
            try:
                with open('.tmp/ocr_latest.json') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data.encode('utf-8'))
            except FileNotFoundError:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"number":null}')
            return

        if self.path == '/api/ocr-bootstrap':
            try:
                with open('.tmp/ocr_bootstrap.json') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data.encode('utf-8'))
            except FileNotFoundError:
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"numbers":[]}')
            return

        # Serve calibration page
        if self.path == '/calibrate':
            self.path = '/calibrate.html'
        return super().do_GET()

    def log_message(self, format, *args):
        # Suppress GET request logging to keep console clean
        if args and 'GET' in str(args[0]):
            return
        super().log_message(format, *args)

PORT = 8888
server_address = ('', PORT)
httpd = HTTPServer(server_address, EdgeHandler)
print(f"[Edge Server] Running on port {PORT}")
print(f"[Edge Server] Log file: {LOG_FILE}")
print(f"[Edge Server] AI reads via: tail -5 {LOG_FILE}")
httpd.serve_forever()
