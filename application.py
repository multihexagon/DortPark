from flask import Flask, jsonify, render_template, request
import requests
from math import exp, radians, sin, cos, sqrt, atan2

app = Flask(__name__)

API_URL = "https://open-data.dortmund.de/api/explore/v2.1/catalog/datasets/parkhauser/records?limit=100"

# Haversine formula to calculate distance (in km)
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

# Logistic pricing model with default invented values
def logistic_price(free, capacity, P_min=1.0, P_max=4.0, x0=0.7, k=10):
    if capacity == 0:
        return P_min
    occupied_ratio = (capacity - free) / capacity
    price = P_min + (P_max - P_min) / (1 + exp(-k * (occupied_ratio - x0)))
    return round(price, 2)


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/parkings')
def parkings():
    user_lat = request.args.get('lat', type=float)
    user_lon = request.args.get('lon', type=float)
    only_available = request.args.get('available', default=False, type=lambda v: v.lower() == 'true')

    response = requests.get(API_URL)
    data = response.json()
    results = []

    for item in data.get('results', []):
        geo = item.get("geo_point_2d")
        frei = item.get("frei")
        capacity = item.get("capacity")
        name = item.get("name")

        if geo and frei is not None and capacity:
            if only_available and frei == 0:
                continue  # skip full parking lots

            entry = {
                "name": name,
                "frei": frei,
                "capacity": capacity,
                "lat": geo.get("lat"),
                "lon": geo.get("lon"),
                "price_per_hour": logistic_price(frei, capacity)  # always invented
            }

            # Add distance if user location is provided
            if user_lat is not None and user_lon is not None:
                dist = calculate_distance(user_lat, user_lon, geo.get("lat"), geo.get("lon"))
                entry["distance_km"] = round(dist, 2)

            results.append(entry)

    # Optional sort by distance
    if user_lat is not None and user_lon is not None:
        results.sort(key=lambda x: x.get("distance_km", float('inf')))

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
