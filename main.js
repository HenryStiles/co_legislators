/**
 * Colorado Legislative District Maps
 * 
 * Interactive maps for Colorado Senate and House districts using Leaflet.js.
 * Features:
 * - CARTO Voyager basemap with street-level & building footprint detail down to zoom 20
 * - Optional satellite imagery basemap toggle with street overlays
 * - Canvassing-optimized district transparency (fillOpacity: 0.22) so street names are clearly readable
 * - 1-click instant legislator search with auto-complete & keyboard navigation
 * - Pole of Inaccessibility (Polylabel) algorithm for optimal visual centering of labels & popups
 * - Context-aware district zoom with surrounding area padding
 * - Color-coded party representation and detailed profile popups
 * 
 * @version 2.3
 */

// Application State
let allLegislators = [];
const districtLayers = {
    Senate: {},
    House: {}
};
let senateMap = null;
let houseMap = null;
let mapsReady = false;
let pendingSelection = null;

/**
 * Party color mapping (lighter shades for readability with district labels)
 */
function partyColor(party) {
    if (!party) return '#fff59d'; // light yellow for unknown/other
    const p = String(party).toLowerCase();
    if (p.startsWith('rep')) return '#ff9999'; // light red
    if (p.startsWith('dem')) return '#90caf9'; // light blue
    return '#fff59d';
}

/**
 * Polylabel algorithm (Pole of Inaccessibility)
 * 
 * Finds the interior point inside a polygon that is farthest from all its boundary edges
 * (center of the maximum inscribed circle). This mathematically guarantees that the visual center
 * is strictly INSIDE the polygon, eliminating issues with irregular, concave, or C-shaped districts
 * where standard bounding-box centers fall outside.
 * 
 * @param {Array} polygon - GeoJSON polygon coordinates (array of rings: [exterior, ...holes])
 * @param {number} precision - Search precision in degrees (default 0.005)
 * @returns {Array} [lng, lat] of the pole of inaccessibility
 */
function polylabel(polygon, precision = 0.005) {
    const outerRing = polygon[0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < outerRing.length; i++) {
        const p = outerRing[i];
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const cellSize = Math.min(width, height);
    let h = cellSize / 2;

    if (cellSize === 0) return [minX, minY];

    // Signed distance from point (x, y) to polygon (positive if inside, negative if outside)
    function pointToPolygonDist(x, y) {
        let inside = false;
        let minDistSq = Infinity;
        for (let k = 0; k < polygon.length; k++) {
            const ring = polygon[k];
            for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
                const a = ring[i];
                const b = ring[j];
                if ((a[1] > y !== b[1] > y) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) {
                    inside = !inside;
                }
                const dx = b[0] - a[0];
                const dy = b[1] - a[1];
                let distSq;
                if (dx === 0 && dy === 0) {
                    distSq = (x - a[0]) ** 2 + (y - a[1]) ** 2;
                } else {
                    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
                    distSq = (x - (a[0] + t * dx)) ** 2 + (y - (a[1] + t * dy)) ** 2;
                }
                if (distSq < minDistSq) minDistSq = distSq;
            }
        }
        return (inside ? 1 : -1) * Math.sqrt(minDistSq);
    }

    class Cell {
        constructor(x, y, h) {
            this.x = x;
            this.y = y;
            this.h = h;
            this.d = pointToPolygonDist(x, y);
            this.max = this.d + this.h * Math.SQRT2;
        }
    }

    class PriorityQueue {
        constructor() { this.data = []; }
        push(val) {
            this.data.push(val);
            let idx = this.data.length - 1;
            while (idx > 0) {
                let parentIdx = (idx - 1) >> 1;
                if (this.data[idx].max <= this.data[parentIdx].max) break;
                let tmp = this.data[idx];
                this.data[idx] = this.data[parentIdx];
                this.data[parentIdx] = tmp;
                idx = parentIdx;
            }
        }
        pop() {
            if (this.data.length === 0) return null;
            const top = this.data[0];
            const bottom = this.data.pop();
            if (this.data.length > 0) {
                this.data[0] = bottom;
                let idx = 0;
                const len = this.data.length;
                while (true) {
                    let left = (idx << 1) + 1;
                    let right = left + 1;
                    let best = idx;
                    if (left < len && this.data[left].max > this.data[best].max) best = left;
                    if (right < len && this.data[right].max > this.data[best].max) best = right;
                    if (best === idx) break;
                    let tmp = this.data[idx];
                    this.data[idx] = this.data[best];
                    this.data[best] = tmp;
                    idx = best;
                }
            }
            return top;
        }
    }

    const pq = new PriorityQueue();
    for (let x = minX; x < maxX; x += cellSize) {
        for (let y = minY; y < maxY; y += cellSize) {
            pq.push(new Cell(x + h, y + h, h));
        }
    }

    let bestCell = new Cell((minX + maxX) / 2, (minY + maxY) / 2, 0);

    let iters = 0;
    while (pq.data.length > 0 && iters++ < 500) {
        const cell = pq.pop();
        if (cell.d > bestCell.d) bestCell = cell;
        if (cell.max - bestCell.d <= precision) continue;
        h = cell.h / 2;
        pq.push(new Cell(cell.x - h, cell.y - h, h));
        pq.push(new Cell(cell.x + h, cell.y - h, h));
        pq.push(new Cell(cell.x - h, cell.y + h, h));
        pq.push(new Cell(cell.x + h, cell.y + h, h));
    }

    return [bestCell.x, bestCell.y];
}

/**
 * Computes the optimal visual center for a GeoJSON feature
 */
function getFeatureVisualCenter(feature) {
    if (!feature || !feature.geometry) return null;
    const geom = feature.geometry;
    let polygon = null;
    if (geom.type === 'Polygon') {
        polygon = geom.coordinates;
    } else if (geom.type === 'MultiPolygon') {
        polygon = geom.coordinates.reduce((largest, part) => {
            return (part[0] && part[0].length > (largest[0]?.length || 0)) ? part : largest;
        }, geom.coordinates[0]);
    }
    if (!polygon || !polygon[0] || polygon[0].length === 0) return null;
    const pt = polylabel(polygon, 0.005);
    return L.latLng(pt[1], pt[0]); // [lat, lng]
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatName(rawName) {
    if (!rawName) return 'Unknown';
    if (rawName.includes(',')) {
        const [last, first] = rawName.split(',').map(s => s.trim());
        return `${first} ${last}`;
    }
    return rawName;
}

/**
 * Instant Search Initialization
 * Runs immediately so the search bar is responsive without waiting for heavy map geometries.
 */
function setupSearchUI() {
    const input = document.getElementById('legislator-search');
    const clearBtn = document.getElementById('search-clear-btn');
    const dropdown = document.getElementById('search-results-dropdown');
    if (!input || !dropdown) return;

    let selectedIndex = -1;
    let currentResults = [];

    // Filter matching legislators
    const searchLegislators = query => {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        const sdMatch = q.match(/^sd\s*(\d+)$/);
        const hdMatch = q.match(/^hd\s*(\d+)$/);

        return allLegislators.filter(leg => {
            const districtStr = String(leg.District || '');
            if (sdMatch && leg.Chamber === 'Senate' && districtStr === sdMatch[1]) return true;
            if (hdMatch && leg.Chamber === 'House' && districtStr === hdMatch[1]) return true;

            const rawName = (leg.Name || '').toLowerCase();
            const formatted = formatName(leg.Name).toLowerCase();
            const chamber = (leg.Chamber || '').toLowerCase();
            const party = (leg.Party || '').toLowerCase();
            const counties = (leg.Counties || []).join(' ').toLowerCase();

            return rawName.includes(q) ||
                   formatted.includes(q) ||
                   (chamber + ' ' + districtStr).includes(q) ||
                   (chamber + ' district ' + districtStr).includes(q) ||
                   ('district ' + districtStr).includes(q) ||
                   (districtStr === q) ||
                   party.includes(q) ||
                   counties.includes(q);
        });
    };

    const renderResults = results => {
        currentResults = results;
        selectedIndex = -1;
        dropdown.innerHTML = '';

        if (results.length === 0) {
            dropdown.innerHTML = `<div class="search-no-results">No legislators matching "<em>${escapeHtml(input.value)}</em>"</div>`;
            dropdown.style.display = 'block';
            return;
        }

        results.slice(0, 10).forEach((leg, idx) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.setAttribute('role', 'option');
            item.setAttribute('data-index', idx);

            const displayName = formatName(leg.Name);
            const partyClass = (leg.Party || '').toLowerCase().startsWith('dem') ? 'badge-dem' : 
                               ((leg.Party || '').toLowerCase().startsWith('rep') ? 'badge-rep' : 'badge-senate');
            const chamberClass = leg.Chamber === 'Senate' ? 'badge-senate' : 'badge-house';

            const avatarHtml = (leg.Picture && leg.Picture !== 'N/A')
                ? `<img src="${leg.Picture}" alt="${escapeHtml(displayName)}" class="result-avatar" onerror="this.style.display='none'">`
                : `<div class="result-avatar-fallback">${displayName.charAt(0)}</div>`;

            const noticeBadge = leg.Note ? `<span class="badge badge-notice">Notice</span>` : '';
            const countiesText = (leg.Counties && leg.Counties.length) ? leg.Counties.join(', ') : 'Colorado';

            item.innerHTML = `
                ${avatarHtml}
                <div class="result-info">
                    <div class="result-name">${escapeHtml(displayName)}</div>
                    <div class="result-badges">
                        <span class="badge ${chamberClass}">${escapeHtml(leg.Chamber)} ${escapeHtml(leg.District)}</span>
                        <span class="badge ${partyClass}">${escapeHtml(leg.Party || 'Unknown')}</span>
                        ${noticeBadge}
                    </div>
                    <div class="result-counties">${escapeHtml(countiesText)}</div>
                </div>
            `;

            // CRITICAL FIX: Use mousedown with preventDefault so input blur/change
            // does NOT destroy the element before the click event finishes.
            // This guarantees instant 1-click selection!
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selectLegislator(leg);
            });

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectLegislator(leg);
            });

            dropdown.appendChild(item);
        });

        dropdown.style.display = 'block';
    };

    const updateSelectionHighlight = () => {
        const items = dropdown.querySelectorAll('.search-result-item');
        items.forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    };

    const selectLegislator = leg => {
        const displayName = formatName(leg.Name);
        input.value = displayName;
        dropdown.style.display = 'none';
        clearBtn.style.display = 'flex';

        if (!mapsReady) {
            // Queue selection to execute as soon as maps finish loading
            pendingSelection = leg;
            const targetSectionId = leg.Chamber === 'Senate' ? 'senate-section' : 'house-section';
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        executeSelection(leg);
    };

    const handleSearchInput = () => {
        const val = input.value.trim();
        clearBtn.style.display = val ? 'flex' : 'none';
        if (val.length === 0) {
            dropdown.style.display = 'none';
            currentResults = [];
            return;
        }
        if (allLegislators.length === 0) {
            dropdown.innerHTML = `<div class="search-no-results">Loading legislators dataset...</div>`;
            dropdown.style.display = 'block';
            return;
        }
        const matches = searchLegislators(val);
        renderResults(matches);
    };

    // Attach listeners for instant responsiveness.
    // NOTE: 'change' listener is omitted intentionally to prevent input blur
    // from triggering a re-render while the user is clicking an option.
    input.addEventListener('input', handleSearchInput);
    input.addEventListener('keyup', (e) => {
        if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
            handleSearchInput();
        }
    });
    input.addEventListener('search', handleSearchInput);

    // Keyboard navigation
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            dropdown.style.display = 'none';
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
                selectLegislator(currentResults[selectedIndex]);
            } else if (currentResults.length > 0) {
                selectLegislator(currentResults[0]);
            } else {
                const matches = searchLegislators(input.value);
                if (matches.length > 0) selectLegislator(matches[0]);
            }
            return;
        }

        if (dropdown.style.display === 'none') {
            if (['ArrowDown', 'ArrowUp'].includes(e.key) && input.value.trim()) {
                handleSearchInput();
            }
            return;
        }

        const items = dropdown.querySelectorAll('.search-result-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelectionHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelectionHighlight();
        }
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        clearBtn.style.display = 'none';
        dropdown.style.display = 'none';
        currentResults = [];
        input.focus();
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.search-container')) {
            dropdown.style.display = 'none';
        }
    });

    input.addEventListener('focus', () => {
        if (input.value.trim().length > 0) {
            handleSearchInput();
        }
    });

    // If input already has text on load, run search
    if (input.value.trim().length > 0) {
        handleSearchInput();
    }
}

/**
 * Executes zoom, highlight, and popup for a selected legislator
 */
function executeSelection(leg) {
    const isSenate = leg.Chamber === 'Senate';
    const targetMap = isSenate ? senateMap : houseMap;
    const targetSectionId = isSenate ? 'senate-section' : 'house-section';
    const layer = districtLayers[leg.Chamber]?.[String(leg.District)];

    // Smoothly scroll down to the target chamber's map section
    const targetSection = document.getElementById(targetSectionId);
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (layer && targetMap) {
        // Zoom in on district + surrounding context using generous padding (80px)
        const bounds = layer.getBounds();
        targetMap.flyToBounds(bounds, {
            padding: [80, 80],
            maxZoom: 13,
            duration: 1.2
        });

        // Flash highlight outline to immediately draw user's eye to the district
        const originalStyle = {
            fillColor: partyColor(leg.Party),
            weight: 2.5,
            opacity: 0.9,
            color: '#334155',
            fillOpacity: 0.22
        };

        layer.setStyle({
            weight: 5,
            color: '#d97706', // warm vibrant gold/amber outline
            fillOpacity: 0.5
        });

        setTimeout(() => {
            layer.setStyle(originalStyle);
        }, 3000);

        // Open the popup at the true visual center (Pole of Inaccessibility)
        setTimeout(() => {
            const popupLatLng = layer._visualCenter || bounds.getCenter();
            layer.openPopup(popupLatLng);
        }, 650);
    }
}

// Optional CARTO API Key (leave empty or specify your key from carto.com)
const CARTO_API_KEY = '';

function getCartoVoyagerUrl() {
    const base = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    return CARTO_API_KEY ? `${base}?api_key=${encodeURIComponent(CARTO_API_KEY)}` : base;
}

/**
 * Initializes a Leaflet map with high-detail street tiles & Satellite layer
 */
function initChamberMap(containerId) {
    // 1. OpenStreetMap: 100% free, zero API key required. High street detail, building footprints, house numbers
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });

    // 2. Esri World Street Map: 100% free, zero API key required, crisp street & highway detail down to zoom 19
    const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, HERE, Garmin, USGS, EPA, NPS',
        maxZoom: 19
    });

    // 3. Esri World Imagery (Satellite) + Street Labels overlay (100% free, zero API key)
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
    });

    const satelliteLabels = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri',
        maxZoom: 19
    });

    const satelliteWithLabels = L.layerGroup([satellite, satelliteLabels]);

    // 4. CARTO Voyager: Street-level detail & building footprints (requires CARTO API key for production)
    const voyager = L.tileLayer(getCartoVoyagerUrl(), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const map = L.map(containerId, {
        center: [39.0, -105.5],
        zoom: 7,
        maxZoom: 19,
        layers: [osm] // Keyless default: OpenStreetMap (with street & building detail)
    });

    const baseMaps = {
        "OpenStreetMap (Streets & Buildings - Keyless)": osm,
        "Esri World Street Map (Keyless)": esriStreet,
        "Satellite with Streets (Keyless)": satelliteWithLabels,
        "CARTO Voyager (Requires API Key)": voyager
    };

    return { map, baseMaps };
}

/**
 * Loads map boundary data and initializes Leaflet layers
 */
async function loadMapData(senateGeojson, counties, houseGeojson) {
    // Build lookups: district number -> {name, party, ...} for Senate and House
    const senateLegMap = {};
    const houseLegMap = {};
    allLegislators.forEach(leg => {
        const map = leg.Chamber === 'Senate' ? senateLegMap : (leg.Chamber === 'House' ? houseLegMap : null);
        if (map) {
            const key = String(leg.District);
            if (!map[key] || (map[key].Note && !leg.Note)) {
                map[key] = leg;
            }
        }
    });

    // --- Render Senate Map with CARTO Voyager basemap ---
    const senateSetup = initChamberMap('map');
    senateMap = senateSetup.map;

    const senateCountyLayer = L.geoJSON(counties, {
        style: {
            color: '#1e293b',
            weight: 1.5,
            dashArray: '4, 4',
            fillOpacity: 0,
            opacity: 0.6
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.name || feature.properties.NAME || feature.properties.County || 'Unknown';
            layer.bindPopup(`<strong>County:</strong> ${escapeHtml(name)}`);
        }
    });

    const addDistrictLayer = (geojson, legMap, mapInstance, chamber) => {
        L.geoJSON(geojson, {
            style: feature => {
                const district = feature.properties.District;
                const leg = legMap[String(district)];
                return {
                    fillColor: partyColor(leg?.Party),
                    weight: 2.5,
                    opacity: 0.9,
                    color: '#334155', // crisp dark slate boundary line
                    fillOpacity: 0.22  // translucent fill for clear street and building visibility during canvassing
                };
            },
            onEachFeature: (feature, layer) => {
                const district = feature.properties.District;
                const leg = legMap[String(district)];
                const key = String(district);

                // Hover interaction: highlights district while keeping streets legible
                layer.on({
                    mouseover: (e) => {
                        const l = e.target;
                        l.setStyle({ fillOpacity: 0.45, weight: 3.5 });
                    },
                    mouseout: (e) => {
                        const l = e.target;
                        l.setStyle({ fillOpacity: 0.22, weight: 2.5 });
                    }
                });

                // Calculate Pole of Inaccessibility (visual center strictly inside district)
                const visualCenter = getFeatureVisualCenter(feature) || layer.getBounds().getCenter();
                layer._visualCenter = visualCenter;
                layer._district = district;
                layer._chamber = chamber;
                layer._leg = leg;

                districtLayers[chamber][key] = layer;

                const displayName = formatName(leg?.Name);

                const countiesHtml = (leg?.Counties && leg.Counties.length)
                    ? `<b>Counties Served:</b><ul>${leg.Counties.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`
                    : '<b>Counties Served:</b> <i>None listed</i>';

                const committeesHtml = (leg?.Committees && leg.Committees.length)
                    ? `<b>Committees:</b><ul>${leg.Committees.map(com => `<li>${escapeHtml(com.name)}${com.role ? ' (' + escapeHtml(com.role) + ')' : ''}</li>`).join('')}</ul>`
                    : '<b>Committees:</b> <i>None listed</i>';

                const pictureHtml = (leg?.Picture && leg.Picture !== 'N/A')
                    ? `<img src="${leg.Picture}" alt="${escapeHtml(displayName)}" style="width: 80px; height: auto; float: right; margin-left: 10px; border-radius: 4px; border: 1px solid #ccc;">`
                    : '';

                const noteHtml = (leg?.Note)
                    ? `<div style="margin-top: 4px; margin-bottom: 6px; padding: 3px 6px; background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; border-radius: 4px; font-size: 0.85em;"><strong>Notice:</strong> ${escapeHtml(leg.Note)}</div>`
                    : '';

                const popupContent = `
                    <div style="min-width: 220px;">
                        ${pictureHtml}
                        <strong>District ${district} &mdash; ${escapeHtml(leg?.Party || 'Unknown Party')}</strong><br>
                        <span style="font-size:1.1em; font-weight:bold;">${escapeHtml(displayName)}</span><br>
                        ${noteHtml}
                        <div style="clear: both; padding-top: 5px;">
                            ${countiesHtml}
                            ${committeesHtml}
                        </div>
                    </div>
                `;

                layer.bindPopup(popupContent, {
                    autoPanPadding: [10, 50]
                });

                // Add non-interactive district label placed at the true visual center
                if (leg?.Name) {
                    L.marker(visualCenter, {
                        icon: L.divIcon({
                            className: 'district-label',
                            html: escapeHtml(displayName),
                            iconSize: [200, 50],
                            iconAnchor: [100, 25]
                        }),
                        interactive: false
                    }).addTo(mapInstance);
                }
            }
        }).addTo(mapInstance);
    };

    // Add Senate districts & layer controls (Basemaps + Counties overlay)
    addDistrictLayer(senateGeojson, senateLegMap, senateMap, 'Senate');
    L.control.layers(senateSetup.baseMaps, { "County Lines": senateCountyLayer }, { position: 'topright' }).addTo(senateMap);

    // --- Render House Map with CARTO Voyager basemap ---
    const houseSetup = initChamberMap('house-map');
    houseMap = houseSetup.map;

    const houseCountyLayer = L.geoJSON(counties, {
        style: {
            color: '#1e293b',
            weight: 1.5,
            dashArray: '4, 4',
            fillOpacity: 0,
            opacity: 0.6
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.name || feature.properties.NAME || feature.properties.County || 'Unknown';
            layer.bindPopup(`<strong>County:</strong> ${escapeHtml(name)}`);
        }
    });

    // Add House districts & layer controls
    addDistrictLayer(houseGeojson, houseLegMap, houseMap, 'House');
    L.control.layers(houseSetup.baseMaps, { "County Lines": houseCountyLayer }, { position: 'topright' }).addTo(houseMap);

    mapsReady = true;

    // If user clicked a legislator while map was loading, execute now
    if (pendingSelection) {
        const target = pendingSelection;
        pendingSelection = null;
        executeSelection(target);
    }
}

/**
 * Main Entry Point
 */
function init() {
    // 1. Immediately wire up the search UI listeners
    setupSearchUI();

    const checkResponse = (res, fileName) => {
        if (!res.ok) {
            throw new Error(`Failed to fetch ${fileName}: ${res.status} ${res.statusText}`);
        }
        return res.json();
    };

    // 2. Fetch legislators immediately to make search functional in milliseconds
    const legislatorsPromise = fetch('legislators.json?v=' + Date.now())
        .then(res => checkResponse(res, 'legislators.json'))
        .then(data => {
            allLegislators = data;
            // Refresh search input if user already typed something
            const input = document.getElementById('legislator-search');
            if (input && input.value.trim()) {
                input.dispatchEvent(new Event('input'));
            }
            return data;
        });

    // 3. Concurrently fetch heavy map files
    const mapsPromise = Promise.all([
        fetch('senate_coords.json').then(res => checkResponse(res, 'senate_coords.json')),
        fetch('colorado_counties.geojson').then(res => checkResponse(res, 'colorado_counties.geojson')),
        fetch('house_coords.json').then(res => checkResponse(res, 'house_coords.json'))
    ]);

    // 4. Once both legislators and map geometries are ready, build the Leaflet layers
    Promise.all([legislatorsPromise, mapsPromise])
        .then(([legs, [senateGeo, counties, houseGeo]]) => {
            loadMapData(senateGeo, counties, houseGeo);
        })
        .catch(err => {
            console.error('Error loading map data:', err);
        });
}

// Start immediately or when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}