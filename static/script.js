const map = L.map('map').setView([51.514, 7.465], 14);
let userLocation = null;

// Map base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Marker icons by color
const icons = {
  green: new L.Icon({
    iconUrl: '/static/markers/marker-icon-green.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  }),
  orange: new L.Icon({
    iconUrl: '/static/markers/marker-icon-orange.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  }),
  red: new L.Icon({
    iconUrl: '/static/markers/marker-icon-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  }),
  best: new L.Icon({
    iconUrl: '/static/markers/marker-icon-blue.png',
    iconSize: [30, 50],
    iconAnchor: [15, 50],
  }),
};

// Get parking color based on availability ratio
function getMarkerColor(free, capacity) {
  const ratio = free / capacity;
  if (ratio >= 0.5) return 'green';
  if (ratio >= 0.2) return 'orange';
  return 'red';
}

// Load parking data
function loadParkings(lat, lon) {
  const url = `/api/parkings?available=true&lat=${lat}&lon=${lon}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('parking-list');
      list.innerHTML = '';

      if (data.length === 0) {
        list.innerHTML = "<li>No parking available nearby</li>";
        return;
      }

      // El mejor parqueadero es el primero (ya ordenados por backend)
      const bestParking = data[0];

      data.forEach((p, index) => {
        // Si es el mejor, marcador especial
        const icon = (index === 0) ? icons.best : icons[getMarkerColor(p.frei, p.capacity)];

        const marker = L.marker([p.lat, p.lon], { icon: icon })
          .addTo(map)
          .bindPopup(`
  <strong>${p.name}</strong><br>
  Available: ${p.frei}/${p.capacity}<br>
  Distance: ${p.distance_km} km<br>
  <strong>Price: €${p.price_per_hour} / hour</strong><br>
  <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}" target="_blank">Google Maps</a> |
  <a href="http://maps.apple.com/?daddr=${p.lat},${p.lon}" target="_blank">Apple Maps</a> |
  <a href="https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes" target="_blank">Waze</a>
`);

        // Agregar a la lista lateral
        const li = document.createElement('li');
li.innerHTML = `
  <strong>${p.name}</strong><br>
  ${p.frei} free / ${p.capacity} total<br>
  <em>${p.distance_km} km away</em><br>
  <span class="price">€${p.price_per_hour} / hour</span>
`;

        // Resaltar mejor parqueadero
        if (index === 0) {
          li.style.border = "2px solid #27ae60";
          li.style.background = "#eafaf1";
          li.innerHTML += "<br><strong>✅ Suggested parking</strong>";
        }

        // Al hacer click en la lista → abrir popup
        li.onclick = () => {
          marker.openPopup();
          map.setView([p.lat, p.lon], 16);
        };

        list.appendChild(li);
      });
    });
}

// Forzar ubicación en Dortmund
const defaultLocation = { lat: 51.514, lng: 7.465 };
map.setView([defaultLocation.lat, defaultLocation.lng], 14);
L.marker(defaultLocation).addTo(map).bindPopup('Default location: Dortmund').openPopup();
loadParkings(defaultLocation.lat, defaultLocation.lng);

let searchTimeout = null;

// Crear dropdown dinámico para sugerencias
const suggestionBox = document.createElement("ul");
suggestionBox.id = "suggestions";
document.getElementById("search-bar").appendChild(suggestionBox);

function searchDestination() {
  const query = document.getElementById("destination").value;

  // cancelar búsqueda anterior si el usuario sigue escribiendo
  if (searchTimeout) clearTimeout(searchTimeout);

  // esperar 500ms antes de consultar API
  searchTimeout = setTimeout(() => {
    if (query.length < 3) {
      suggestionBox.innerHTML = "";
      return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + " Dortmund")}&addressdetails=1&limit=5`;

    fetch(url, { headers: { "Accept-Language": "en" }})
      .then(res => res.json())
      .then(data => {
        suggestionBox.innerHTML = "";

        if (data.length === 0) {
          const li = document.createElement("li");
          li.textContent = "No results found";
          suggestionBox.appendChild(li);
          return;
        }

        // Mostrar sugerencias
        data.forEach(place => {
          const li = document.createElement("li");
          li.textContent = place.display_name;
          li.onclick = () => {
            // Limpiar sugerencias
            suggestionBox.innerHTML = "";
            document.getElementById("destination").value = place.display_name;

            const lat = parseFloat(place.lat);
            const lon = parseFloat(place.lon);

            // Agregar marcador destino
            const destMarker = L.marker([lat, lon]).addTo(map)
              .bindPopup(`Destination: ${place.display_name}`).openPopup();

            // Centrar mapa
            map.setView([lat, lon], 14);

            // Buscar parqueaderos cerca del destino
            loadParkings(lat, lon);
          };
          suggestionBox.appendChild(li);
        });
      });
  }, 500); // ⏱ delay de 500ms
}
