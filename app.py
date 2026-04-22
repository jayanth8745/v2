import os

# At the very bottom of app.py, replace the existing run code with:
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))  # Render sets PORT env variable
    print(f"Server running on port {port}")
    print(f"Google Client ID: {GOOGLE_CLIENT_ID[:20]}..." if GOOGLE_CLIENT_ID else "Google Client ID not set!")
    app.run(debug=False, host='0.0.0.0', port=port)  # host='0.0.0.0' is critical