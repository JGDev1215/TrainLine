from flask import Flask, jsonify, send_from_directory
import requests
import os

app = Flask(__name__, static_folder='.')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/departures')
def get_departures():
    try:
        # Fetch data from Huxley 2 API for West Horndon (WHR)
        # We want 10 services, expanding details to get platform info if available
        response = requests.get(
            'https://huxley2.azurewebsites.net/departures/WHR/10?expand=true',
            timeout=10
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
