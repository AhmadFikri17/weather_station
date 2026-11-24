// ==========================================
// 1. KONFIGURASI DASAR & BATAS PETA
// ==========================================
const indonesiaBounds = [
    [-11.5, 94.5],
    [6.5, 141.5]
];

let stationCoords = { lat: -8.0474787, lon: 112.6252229 }; // Default Malang

const map = L.map('map', {
    zoomControl: false,
    minZoom: 5,
    maxZoom: 18,
    maxBounds: indonesiaBounds,
    maxBoundsViscosity: 1.0
}).setView([stationCoords.lat, stationCoords.lon], 12);

const baseLayers = {
    'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 })
};
let currentLayer = baseLayers['OpenStreetMap'].addTo(map);
let isLayerMenuOpen = false;

L.control.scale({ position: 'bottomright', metric: true, imperial: false, maxWidth: 150 }).addTo(map);

// ==========================================
// 2. STATE GLOBAL & UTIL
// ==========================================
let currentLatestData = null;
let mainMarker = null;

function round1(val) {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : parseFloat(num.toFixed(1));
}

function getVal(obj, key) {
    if (!obj) return 0;
    const map = { 'tmp': 't', 'hum': 'h', 'wnd': 'w', 'ang': 'a', 'rn': 'r', 'lx': 'l' };
    let val = obj[key] !== undefined && obj[key] !== null ? obj[key] : (obj[map[key]] !== undefined ? obj[map[key]] : 0);
    return val;
}

// ===== FUNGSI FORMAT WAKTU (TANPA OFFSET ZONA WAKTU) =====
function formatWaktu(ts) {
    if (!ts) return '--:--';
    if (typeof ts === 'number' || !isNaN(Number(ts))) {
        const d = new Date(Number(ts) * 1000);
        if (!isNaN(d.getTime())) {
            const hours = String(d.getUTCHours()).padStart(2, '0');
            const minutes = String(d.getUTCMinutes()).padStart(2, '0');
            return `${hours}:${minutes} WIB`;
        }
    }
    return ts;
}

// ===== FUNGSI KONVERSI DERAJAT KE ARAH MATA ANGIN =====
function getArahAngin(deg) {
    if (deg === null || deg === undefined || isNaN(deg) || Number(deg) === 0) return '--';
    deg = Number(deg);
    deg += 11.25;
    if (deg >= 360) deg -= 360;
    if (deg < 22.5)        return "U/N";
    else if (deg < 45)     return "UTL/NNE";
    else if (deg < 67.5)   return "TL/NE";
    else if (deg < 90)     return "TTL/ENE";
    else if (deg < 112.5)  return "T/E";
    else if (deg < 135)    return "TTG/ESE";
    else if (deg < 157.5)  return "TG/SE";
    else if (deg < 180)    return "STG/SSE";
    else if (deg < 202.5)  return "S/S";
    else if (deg < 225)    return "SBD/SSW";
    else if (deg < 247.5)  return "BD/SW";
    else if (deg < 270)    return "BBD/WSW";
    else if (deg < 292.5)  return "B/W";
    else if (deg < 315)    return "BBL/WNW";
    else if (deg < 337.5)  return "BL/NW";
    else                   return "UBL/NNW";
}

// ==========================================
// 3. MARKER & PANEL INFO
// ==========================================
function createMarker(location) {
    let bgColor = location.status === 'offline' ? 'bg-gray-500' : 'bg-orange-500';
    let iconHtml = location.status === 'offline' ? 'X' : location.suhu;

    if (location.status !== 'offline' && location.hujan) {
        iconHtml = `<i class="fa-solid fa-cloud-rain"></i>`;
    }

    const customIcon = L.divIcon({
        className: 'custom-icon',
        html: `<div class="${bgColor} text-white font-bold rounded-full w-7 h-7 flex items-center justify-center border-2 border-white shadow-md text-[11px]">${iconHtml}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const marker = L.marker([location.lat, location.lon], { icon: customIcon }).addTo(map);

    marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        openInfoPanel();
    });

    return marker;
}

mainMarker = createMarker({
    lat: stationCoords.lat,
    lon: stationCoords.lon,
    suhu: 0,
    status: 'offline',
    hujan: false
});

function updateMarker(location) {
    if (mainMarker) map.removeLayer(mainMarker);
    mainMarker = createMarker(location);
}

function openInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    panel.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'translate-y-[-10px]');
    }, 10);

    updateInfoPanelData();
}

function closeInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    panel.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
        panel.classList.add('hidden');
    }, 300);
}

function updateInfoPanelData() {
    const el = (id) => document.getElementById(id);
    if (!el('info-time')) return;

    if (!currentLatestData) {
        el('info-time').innerText = "Waktu: Menunggu Data...";
        return;
    }

    const d = currentLatestData;
    try {
        el('info-time').innerText = `Waktu: ${formatWaktu(d.ts)}`;
        el('info-rain').innerText = `${round1(getVal(d, 'rn'))} mm`;
        el('info-lux').innerText  = `${round1(getVal(d, 'lx'))} W/m²`;
        el('info-temp').innerText = `${round1(getVal(d, 'tmp'))} °C`;
        el('info-hum').innerText  = `${round1(getVal(d, 'hum'))} %`;
        el('info-wind').innerText = `${round1(getVal(d, 'wnd'))} m/s`;
        // Menggunakan getArahAngin
        el('info-dir').innerText  = `${getArahAngin(getVal(d, 'ang'))} (${round1(getVal(d, 'ang'))}°)`;
    } catch (e) {
        console.log("Data sensor belum lengkap:", e);
    }
}

// ==========================================
// 4. MQTT REALTIME (EMQX)
// ==========================================
if (typeof mqtt !== 'undefined') {
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: 'map_web_' + Math.random().toString(16).substr(2, 8)
    });

    client.on('connect', () => {
        console.log('Peta MQTT Connected (EMQX)');
        client.subscribe('weather/farid_weatherstation3/sensors');
        client.subscribe('weather/farid_weatherstation3/status');
    });

    client.on('error', (err) => console.error('MQTT Error:', err));

    client.on('message', (topic, message) => {
        let data;
        try {
            data = JSON.parse(message.toString());
        } catch (e) {
            return console.error('JSON parse error:', e);
        }

        // JIKA MENERIMA PESAN STATUS (DATA GPS)
        if (topic.includes('/status')) {
            if (data.lat && data.lon) {
                stationCoords.lat = data.lat;
                stationCoords.lon = data.lon;
                if (currentLatestData) {
                    updateMarker({
                        lat: stationCoords.lat,
                        lon: stationCoords.lon,
                        suhu: round1(getVal(currentLatestData, 'tmp')),
                        status: 'online',
                        hujan: Number(getVal(currentLatestData, 'rn')) > 0
                    });
                }
            }
            return; 
        }

        // JIKA MENERIMA PESAN SENSOR
        currentLatestData = data;

        const clock = document.getElementById('clock-display');
        if (clock) clock.innerText = `Waktu: ${formatWaktu(data.ts)}`;

        try {
            updateMarker({
                lat: stationCoords.lat,
                lon: stationCoords.lon,
                suhu: round1(getVal(data, 'tmp')),
                status: 'online',
                hujan: Number(getVal(data, 'rn')) > 0
            });
        } catch (e) {
            console.error('Gagal update marker:', e);
        }

        const panel = document.getElementById('info-panel');
        if (panel && !panel.classList.contains('hidden')) {
            updateInfoPanelData();
        }
    });
}

// ==========================================
// 5. KONTROL PETA
// ==========================================
function toggleLayerMenu() {
    isLayerMenuOpen = !isLayerMenuOpen;
    const menu = document.getElementById('layer-menu');
    if (menu) menu.classList.toggle('hidden', !isLayerMenuOpen);
}

function changeLayer(name) {
    if (!baseLayers[name]) return;
    map.removeLayer(currentLayer);
    currentLayer = baseLayers[name];
    currentLayer.addTo(map);
    toggleLayerMenu();
}

function resetView() {
    map.fitBounds(indonesiaBounds, {
        padding: [20, 20],
        maxZoom: 5
    });
}

function goToMalang() {
    map.setView([stationCoords.lat, stationCoords.lon], 12);
}

map.on('click', () => {
    const panel = document.getElementById('info-panel');
    if (panel && !panel.classList.contains('hidden')) closeInfoPanel();
    if (isLayerMenuOpen) toggleLayerMenu();
});

// ==========================================
// 6. EXPOSE FUNGSI GLOBAL
// ==========================================
window.toggleLayerMenu = toggleLayerMenu;
window.changeLayer = changeLayer;
window.resetView = resetView;
window.goToMalang = goToMalang;
window.openInfoPanel = openInfoPanel;
window.closeInfoPanel = closeInfoPanel;