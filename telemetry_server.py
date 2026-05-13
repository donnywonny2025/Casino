from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class TelemetryHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        # We only need to write the latest state to a file so the agent can read it
        with open('latest_telemetry.json', 'w') as f:
            json.dump(data, f, indent=2)

        print(f"\n[TELEMETRY RECEIVED] Spin count: {len(data.get('hist', []))}")
        print(f"Latest prediction: {data.get('pred', {}).get('color', 'pass').upper()} at {data.get('pred', {}).get('conf', 0)}%")
        
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b"OK")

    def log_message(self, format, *args):
        pass  # suppress standard http server logging

server_address = ('', 8080)
httpd = HTTPServer(server_address, TelemetryHandler)
print("Telemetry Server running on port 8080...")
httpd.serve_forever()
