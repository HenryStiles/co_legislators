/**
 * Colorado Legislative District Maps
 * 
 * This script creates interactive maps for Colorado Senate and House districts
 * using Leaflet.js. It loads legislator data and geographic boundaries,
 * then renders color-coded districts with detailed popup information.
 * 
 * @author Your Name
 * @version 1.0
 */

// Load both GeoJSON and legislator data, then render the map
async function loadData() {
    /**
     * Helper: compute centroid of a Polygon or MultiPolygon
     * 
     * @param {Object} geometry - GeoJSON geometry object
     * @returns {Array|null} [lat, lng] coordinates of centroid, or null if invalid
     */
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

    // Load all data files concurrently
    const [senateGeoRes, legRes, countyRes, houseGeoRes] = await Promise.all([
        fetch('senate_coords.json'),
        fetch('legislators.json'),
        fetch('colorado_counties.geojson'),
        fetch('house_coords.json')
    ]);
    const senateGeojson = await senateGeoRes.json();
    const legislators = await legRes.json();
    const counties = await countyRes.json();
    const houseGeojson = await houseGeoRes.json();

    // Build lookups: district number -> {name, party, ...} for Senate and House
    const senateLegMap = {};
    const houseLegMap = {};
    legislators.forEach(leg => {
        if (leg.Chamber === 'Senate') {
            senateLegMap[String(leg.District)] = leg;
        } else if (leg.Chamber === 'House') {
            houseLegMap[String(leg.District)] = leg;
        }
    });

    /**
     * Party color mapping (lighter shades for better visibility)
     * 
     * @param {string} party - Political party name
     * @returns {string} Hex color code for the party
     */
    const partyColor = party => {
        if (!party) return '#fff59d'; // light yellow
        const p = party.toLowerCase();
        if (p.startsWith('rep')) return '#ff9999'; // light red
        if (p.startsWith('dem')) return '#90caf9'; // light blue
        return '#fff59d'; // light yellow for other
    };

    // --- Render Senate Map ---
    const map = L.map('map').setView([39.0, -105.5], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // County labels for Senate map
    let countyLabels = [];
    const countyLayer = L.geoJSON(counties, {
        style: {
            color: 'black',
            weight: 1,
            fillOpacity: 0,
            opacity: 0.7
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.name || feature.properties.NAME || feature.properties.County || 'Unknown';
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

    /**
     * Custom control for toggling county visibility on Senate map
     */
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

    /**
     * Creates and adds a district layer to the specified map
     * 
     * @param {Object} geojson - GeoJSON data for districts
     * @param {Object} legMap - Mapping of district numbers to legislator data
     * @param {L.Map} mapInstance - Leaflet map instance to add the layer to
     */
    const addDistrictLayer = (geojson, legMap, mapInstance) => {
        L.geoJSON(geojson, {
            style: feature => {
                const district = feature.properties.District;
                const leg = legMap[String(district)];
                return {
                    fillColor: partyColor(leg?.Party),
                    weight: 2,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 0.7
                };
            },
            onEachFeature: (feature, layer) => {
                const district = feature.properties.District;
                const leg = legMap[String(district)];
                
                // Build popup content with all legislator information
                let displayName = leg?.Name || 'Unknown';
                if (displayName.includes(',')) {
                    const [last, first] = displayName.split(',').map(s => s.trim());
                    displayName = `${first} ${last}`;
                }
                const counties = (leg?.Counties && leg.Counties.length)
                    ? `<b>Counties Served:</b><ul>${leg.Counties.map(c => `<li>${c}</li>`).join('')}</ul>`
                    : '<b>Counties Served:</b> <i>None listed</i>';
                const committees = (leg?.Committees && leg.Committees.length)
                    ? `<b>Committees:</b><ul>${leg.Committees.map(com => `<li>${com.name}${com.role ? ' (' + com.role + ')' : ''}</li>`).join('')}</ul>`
                    : '<b>Committees:</b> <i>None listed</i>';
                const popupContent = `
                    <strong>District ${district} &mdash; ${leg?.Party || 'Unknown Party'}</strong><br>
                    <span style="font-size:1.1em; font-weight:bold;">${displayName}</span><br>
                    ${counties}
                    ${committees}
                `;
                layer.bindPopup(popupContent);

                // Add non-interactive district label for visual clarity
                if (leg?.Name) {
                    const center = layer.getBounds().getCenter();
                    L.marker(center, {
                        icon: L.divIcon({
                            className: 'district-label',
                            html: displayName,
                            iconSize: [200, 50],
                            iconAnchor: [100, 25]
                        }),
                        interactive: false // Make label non-interactive
                    }).addTo(mapInstance);
                }
            }
        }).addTo(mapInstance);
    };

    // Add Senate districts
    addDistrictLayer(senateGeojson, senateLegMap, map);

    // --- Render House Map ---
    const houseMap = L.map('house-map').setView([39.0, -105.5], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(houseMap);

    // County overlay for House map
    let houseCountyLabels = [];
    const houseCountyLayer = L.geoJSON(counties, {
        style: {
            color: 'black',
            weight: 1,
            fillOpacity: 0,
            opacity: 0.7
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.name || feature.properties.NAME || feature.properties.County || 'Unknown';
            const centroid = getPolygonCentroid(feature.geometry) || layer.getBounds().getCenter();
            const label = L.marker(centroid, {
                icon: L.divIcon({
                    className: 'county-label',
                    html: name,
                    iconSize: [120, 30],
                    iconAnchor: [60, 15]
                })
            });
            houseCountyLabels.push(label);
        }
    });

    /**
     * Custom control for toggling county visibility on House map
     */
    const HouseCountyToggleControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.backgroundColor = 'white';
            container.style.padding = '6px';
            container.style.cursor = 'pointer';
            container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.65)';
            container.style.borderRadius = '4px';
            container.innerHTML = '<span id="house-county-toggle-btn">Show Counties</span>';

            let countiesVisible = false;
            container.onclick = function() {
                countiesVisible = !countiesVisible;
                if (countiesVisible) {
                    houseMap.addLayer(houseCountyLayer);
                    houseCountyLabels.forEach(label => label.addTo(houseMap));
                    container.innerHTML = '<span id="house-county-toggle-btn">Hide Counties</span>';
                } else {
                    houseMap.removeLayer(houseCountyLayer);
                    houseCountyLabels.forEach(label => houseMap.removeLayer(label));
                    container.innerHTML = '<span id="house-county-toggle-btn">Show Counties</span>';
                }
            };
            return container;
        }
    });
    houseMap.addControl(new HouseCountyToggleControl());

    // Add House districts
    addDistrictLayer(houseGeojson, houseLegMap, houseMap);
}

// Load data when page loads
loadData(); 