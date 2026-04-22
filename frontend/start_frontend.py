#!/usr/bin/env python3
"""
Frontend startup script for Personal Memory Assistant
"""
import sys
import os
import http.server
import socketserver
import webbrowser
from threading import Timer

def open_browser():
    """Open browser after a short delay"""
    webbrowser.open('http://localhost:8000')

if __name__ == "__main__":
    # Change to frontend directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    PORT = 8000
    
    print("Starting Memory Assistant Frontend...")
    print(f"Frontend will run on: http://localhost:{PORT}")
    print("Press Ctrl+C to stop the server\n")
    
    # Open browser after 1 second
    Timer(1.0, open_browser).start()
    
    try:
        Handler = http.server.SimpleHTTPRequestHandler
        
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"Server running at http://localhost:{PORT}/")
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\nServer stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting frontend: {e}")
        sys.exit(1)
