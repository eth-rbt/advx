#!/usr/bin/env python3
"""
Simple static file server for the hackathon multiverse visualization.
Serves files from the static/ directory on port 3000.
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

# Change to the static directory
static_dir = Path(__file__).parent / "static"
os.chdir(static_dir)

PORT = 3000

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow requests from any origin
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    try:
        with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
            print(f"🌐 Serving visualization at http://localhost:{PORT}")
            print(f"📁 Static files from: {static_dir}")
            print("Press Ctrl+C to stop the server")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Try a different port or kill the existing process.")
            sys.exit(1)
        else:
            raise