from http.server import SimpleHTTPRequestHandler, HTTPServer
import json

class DualHandler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/telemetry':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('latest_telemetry.json', 'w') as f:
                    json.dump(data, f, indent=2)
                print(f"\n[TELEMETRY] Logged spin. Total spins: {len(data.get('hist', []))}")
            except Exception as e:
                print(f"Telemetry Error: {e}")
                
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

server_address = ('', 8080)
httpd = HTTPServer(server_address, DualHandler)
print("Real App Server running on port 8080 (Serving files + Telemetry)...")
httpd.serve_forever()
