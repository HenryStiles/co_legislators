// Load both GeoJSON and legislator data, then render the map
async function loadData() {
    // Helper: compute centroid of a Polygon or MultiPolygon
    function getPolygonCentroid(geometry) {
        let coords = [];
        if (geometry.type === 'Polygon') {
            coords = geometry.coordinates[0];
        } else if (geometry.type === 'MultiPolygon') {
            // Use the largest polygon
            let maxLen = 0;
            geometry.coordinates.forEach(ring => {
                if (ring[0].length > maxLen) {
                    maxLen = ring[0].length;
                    coords = ring[0];
                }
            });
        } else {
            return null;
        }
        let x = 0, y = 0, n = coords.length;
        coords.forEach(([lng, lat]) => {
            x += lng;
            y += lat;
        });
        return [y / n, x / n]; // [lat, lng]
    }

    const [geoRes, legRes, countyRes] = await Promise.all([
        fetch('senate_coords.json'),
        fetch('legislators.json'),
        fetch('colorado_counties.geojson')
    ]);
    const geojson = await geoRes.json();
    const legislators = await legRes.json();
    const counties = await countyRes.json();

    // Build a lookup: district number -> {name, party}
    const legMap = {};
    legislators.forEach(leg => {
        // Normalize district number to string for matching
        legMap[String(leg.District)] = leg;
    });

    // Party color mapping (lighter shades)
    const partyColor = party => {
        if (!party) return '#fff59d'; // light yellow
        const p = party.toLowerCase();
        if (p.startsWith('rep')) return '#ff9999'; // light red
        if (p.startsWith('dem')) return '#90caf9'; // light blue
        return '#fff59d'; // light yellow for other
    };

    // Initialize map centered on Colorado with moderate zoom
    const map = L.map('map').setView([39.0, -105.5], 7);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add GeoJSON layer
    const geoLayer = L.geoJSON(geojson, {
        style: feature => {
            const district = feature.properties.District;
            const leg = legMap[String(district)];
            return {
                fillColor: partyColor(leg?.Party),
                weight: 2,
                opacity: 1,
                color: 'white', // white district borders
                fillOpacity: 0.7
            };
        },
        onEachFeature: (feature, layer) => {
            const district = feature.properties.District;
            const leg = legMap[String(district)];
            
            // Add popup
            const popupContent = `
                <strong>District ${district}</strong><br>
                ${(() => {
                    if (leg?.Name && leg.Name.includes(',')) {
                        const [last, first] = leg.Name.split(',').map(s => s.trim());
                        return `${first} ${last}`;
                    }
                    return leg?.Name || 'Unknown';
                })()}<br>
                ${leg?.Party || 'Unknown Party'}
            `;
            layer.bindPopup(popupContent);

            // Add district labels
            if (leg?.Name) {
                // Convert 'Last, First' to 'First Last' if needed
                let displayName = leg.Name;
                if (displayName.includes(',')) {
                    const [last, first] = displayName.split(',').map(s => s.trim());
                    displayName = `${first} ${last}`;
                }
                const center = layer.getBounds().getCenter();
                const marker = L.marker(center, {
                    icon: L.divIcon({
                        className: 'district-label',
                        html: displayName,
                        iconSize: [200, 50],
                        iconAnchor: [100, 25]
                    })
                }).addTo(map);

                // Add click event for popup with counties and committees
                marker.on('click', () => {
                    const counties = (leg.Counties && leg.Counties.length)
                        ? `<b>Counties Served:</b><ul>${leg.Counties.map(c => `<li>${c}</li>`).join('')}</ul>`
                        : '<b>Counties Served:</b> <i>None listed</i>';
                    const committees = (leg.Committees && leg.Committees.length)
                        ? `<b>Committees:</b><ul>${leg.Committees.map(com => `<li>${com.name}${com.role ? ' (' + com.role + ')' : ''}</li>`).join('')}</ul>`
                        : '<b>Committees:</b> <i>None listed</i>';
                    const popupContent = `
                        <strong>${displayName}</strong><br>
                        ${counties}
                        ${committees}
                    `;
                    marker.bindPopup(popupContent).openPopup();
                });
            }
        }
    }).addTo(map);

    // Add county boundaries overlay (but don't add to map yet)
    let countyLabels = [];
    const countyLayer = L.geoJSON(counties, {
        style: {
            color: 'black',
            weight: 1,
            fillOpacity: 0,
            opacity: 0.7
        },
        onEachFeature: (feature, layer) => {
            // Prepare label but don't add yet
            const name = feature.properties.name || feature.properties.NAME || feature.properties.County || 'Unknown';
            // Use centroid for label placement
            const centroid = getPolygonCentroid(feature.geometry) || layer.getBounds().getCenter();
            const label = L.marker(centroid, {
                icon: L.divIcon({
                    className: 'county-label',
                    html: name,
                    iconSize: [120, 30],
                    iconAnchor: [60, 15]
                })
            });
            countyLabels.push(label);
        }
    });

    // Custom control to toggle county boundaries
    const CountyToggleControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.backgroundColor = 'white';
            container.style.padding = '6px';
            container.style.cursor = 'pointer';
            container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.65)';
            container.style.borderRadius = '4px';
            container.innerHTML = '<span id="county-toggle-btn">Show Counties</span>';

            let countiesVisible = false;
            container.onclick = function() {
                countiesVisible = !countiesVisible;
                if (countiesVisible) {
                    map.addLayer(countyLayer);
                    countyLabels.forEach(label => label.addTo(map));
                    container.innerHTML = '<span id="county-toggle-btn">Hide Counties</span>';
                } else {
                    map.removeLayer(countyLayer);
                    countyLabels.forEach(label => map.removeLayer(label));
                    container.innerHTML = '<span id="county-toggle-btn">Show Counties</span>';
                }
            };
            return container;
        }
    });
    map.addControl(new CountyToggleControl());
}

// Load data when page loads
loadData(); 