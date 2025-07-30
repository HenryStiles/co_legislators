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

    // County Layer for Senate Map
    const countyLayer = L.geoJSON(counties, {
        style: {
            color: 'black',
            weight: 1,
            fillOpacity: 0,
            opacity: 0.5
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.name || feature.properties.NAME || feature.properties.County || 'Unknown';
            layer.bindPopup(`<strong>County:</strong> ${name}`);
        }
    });
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

    // Add a standard layer control to the Senate map
    const senateOverlayMaps = {
        "Counties": countyLayer
    };
    L.control.layers(null, senateOverlayMaps).addTo(map);


    // --- Render House Map ---
    const houseMap = L.map('house-map').setView([39.0, -105.5], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(houseMap);

    const houseCountyLayer = L.geoJSON(counties, {
        style: {
            color: 'black',
            weight: 1,
            fillOpacity: 0,
            opacity: 0.5
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.name || feature.properties.NAME || feature.properties.County || 'Unknown';
            layer.bindPopup(`<strong>County:</strong> ${name}`);
        }
    });

    // Add House districts
    addDistrictLayer(houseGeojson, houseLegMap, houseMap);

    // Add a standard layer control to the House map
    const houseOverlayMaps = {
        "Counties": houseCountyLayer
    };
    L.control.layers(null, houseOverlayMaps).addTo(houseMap);
}

// Load data when page loads
loadData(); 