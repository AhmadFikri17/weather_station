// ==========================================
// 1. KONFIGURASI DASAR & BATAS PETA
// ==========================================
const indonesiaBounds = [
    [-11.5, 94.5],  // Southwest coordinates
    [6.5, 141.5]    // Northeast coordinates
];

const malangCoords = { lat: -8.0474787, lon: 112.6252229 };

// Inisialisasi Peta dengan batas Indonesia
const map = L.map('map', {
    zoomControl: false,
    minZoom: 5,
    maxZoom: 18,
    maxBounds: indonesiaBounds,
    maxBoundsViscosity: 1.0
}).setView([malangCoords.lat, malangCoords.lon], 12);

const baseLayers = {
    'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 })
};
let currentLayer = baseLayers['OpenStreetMap'].addTo(map);
let isLayerMenuOpen = false;

L.control.scale({ position: 'bottomright', metric: true, imperial: false, maxWidth: 150 }).addTo(map);

// ==========================================
// 2. STATE GLOBAL
// ==========================================
let currentLatestData = null;
let mainMarker = null;

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
    
    // Perbaikan: stopPropagation agar klik marker tidak menutup panel sendiri
    marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        openInfoPanel();
    });

    return marker;
}

mainMarker = createMarker({ lat: malangCoords.lat, lon: malangCoords.lon, suhu: 0, status: 'offline', hujan: false });

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
    if (!currentLatestData) {
        document.getElementById('info-time').innerText = "Waktu: Menunggu Data...";
        return;
    }
    
    const d = currentLatestData;
    try {
        document.getElementById('info-time').innerText = `Waktu: ${d.ts || '--'}`;
        document.getElementById('info-rain').innerText = `${d.rn || 0} mm`;
        document.getElementById('info-lux').innerText = `${d.lx || 0} W/m²`;
        document.getElementById('info-temp').innerText = `${d.tmp || 0} °C`;
        document.getElementById('info-hum').innerText = `${d.hum || 0} %`;
        document.getElementById('info-wind').innerText = `${d.wnd || 0} m/s`;
        document.getElementById('info-dir').innerText = `${d.ang || 0}° (${d.dir || '--'})`;
    } catch (e) { 
        console.log("Data sensor belum lengkap:", e); 
    }
}

// ==========================================
// 4. MQTT REALTIME
// ==========================================
if (typeof mqtt !== 'undefined') {
    const client = mqtt.connect('wss://335c4f56e51e42f4a5a82c5a477c3e96.s1.eu.hivemq.cloud:8884/mqtt', {
        username: 'esp32sensoriklim',
        password: '12345678aBz',
        clientId: 'map_' + Math.random().toString(16).substr(2, 8)
    });

    client.on('connect', () => {
        console.log('Peta MQTT Connected');
        client.subscribe('weatherstation/sensors');
    });

    client.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            currentLatestData = data;

            // Update jam
            document.getElementById('clock-display').innerText = `Waktu: ${data.ts} WIB`;
            
            // Update tampilan marker (suhu di atas peta)
            updateMarker({
                lat: malangCoords.lat, lon: malangCoords.lon,
                suhu: Math.round(data.tmp), status: 'online', hujan: data.rn > 0
            });

            // Update panel info jika sedang terbuka
            if (!document.getElementById('info-panel').classList.contains('hidden')) {
                updateInfoPanelData();
            }
        } catch (e) { console.error(e); }
    });
}

// ==========================================
// 5. KONTROL PETA
// ==========================================
function toggleLayerMenu() {
    isLayerMenuOpen = !isLayerMenuOpen;
    document.getElementById('layer-menu').classList.toggle('hidden', !isLayerMenuOpen);
}

function changeLayer(name) {
    map.removeLayer(currentLayer);
    currentLayer = baseLayers[name];
    currentLayer.addTo(map);
    toggleLayerMenu();
}

function resetView() {
    // Mengembalikan pandangan ke seluruh Indonesia
    map.fitBounds(indonesiaBounds, {
        padding: [20, 20],
        maxZoom: 5
    });
}

// Menutup panel jika peta diklik
map.on('click', () => {
    if (!document.getElementById('info-panel').classList.contains('hidden')) {
        closeInfoPanel();
    }
    if (isLayerMenuOpen) {
        toggleLayerMenu();
    }
});