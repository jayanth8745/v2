#!/usr/bin/env python3
"""
Backend startup script for Memory Assistant
"""
import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    # Try to import required packages
    print("Checking dependencies...")
    
    try:
        from flask import Flask
        print("✓ Flask found")
    except ImportError:
        print("✗ Flask not found. Installing...")
        os.system("pip install flask==2.3.3")
    
    try:
        from flask_cors import CORS
        print("✓ Flask-CORS found")
    except ImportError:
        print("✗ Flask-CORS not found. Installing...")
        os.system("pip install flask-cors==4.0.0")
    
    try:
        from flask_jwt_extended import JWTManager
        print("✓ Flask-JWT-Extended found")
    except ImportError:
        print("✗ Flask-JWT-Extended not found. Installing...")
        os.system("pip install flask-jwt-extended==4.5.3")
    
    try:
        from pymongo import MongoClient
        print("✓ PyMongo found")
    except ImportError:
        print("✗ PyMongo not found. Installing...")
        os.system("pip install pymongo==4.5.0")
    
    try:
        from dotenv import load_dotenv
        print("✓ python-dotenv found")
    except ImportError:
        print("✗ python-dotenv not found. Installing...")
        os.system("pip install python-dotenv==1.0.0")
    
    print("\nAll dependencies checked. Starting backend server...")
    print("Backend will run on: http://127.0.0.1:5000")
    print("Press Ctrl+C to stop the server\n")
    
    # Import and run the app
    from app import app
    app.run(host='127.0.0.1', port=5000, debug=True)

except Exception as e:
    print(f"Error starting backend: {e}")
    print("\nPlease ensure you have Python installed and try running:")
    print("pip install flask flask-cors flask-jwt-extended pymongo python-dotenv")
    sys.exit(1)
