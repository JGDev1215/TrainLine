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

@app.route('/api/arrivals/fenchurch-street')
def get_arrivals_fenchurch_street():
    try:
        # Fetch departures from Fenchurch Street (FST) and filter for West Horndon
        response = requests.get(
            'https://huxley2.azurewebsites.net/departures/FST/10?expand=true',
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        # Filter for trains going to West Horndon
        if 'trainServices' in data:
            data['trainServices'] = [
                service for service in data['trainServices']
                if service.get('destination') and any(
                    'West Horndon' in dest.get('locationName', '')
                    for dest in service['destination']
                )
            ][:5]  # Limit to 5 services

        return jsonify(data)
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/arrivals/southend')
def get_arrivals_southend():
    try:
        # Fetch departures from Southend Central (SOC) and filter for West Horndon
        response = requests.get(
            'https://huxley2.azurewebsites.net/departures/SOC/10?expand=true',
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        # Filter for trains going to West Horndon
        if 'trainServices' in data:
            data['trainServices'] = [
                service for service in data['trainServices']
                if service.get('destination') and any(
                    'West Horndon' in dest.get('locationName', '')
                    for dest in service['destination']
                )
            ][:5]  # Limit to 5 services

        return jsonify(data)
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
