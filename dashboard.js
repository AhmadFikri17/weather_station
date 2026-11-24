// ==========================================
// KONFIGURASI
// ==========================================
const API_URL = 'http://127.0.0.1:1880/api/weather'; 
const API_HISTORY_URL = 'http://127.0.0.1:1880/api/weather/history'; 

const HISTORY_LIMIT = 20;           
const TABLE_LIMIT = 100;            
const REFRESH_INTERVAL_MS = 30000;  

const MQTT_URL  = 'wss://broker.emqx.io:8084/mqtt';
const MQTT_TOPIC = 'weather/farid_weatherstation3/sensors';

let charts = {};
let latestTableData = [];

// ==========================================
// UTIL
// ==========================================
function parseTs(ts) {
    if (!ts) return '--:--';
    if (typeof ts === 'string' && ts.includes('-') && ts.includes(':')) {
        const parts = ts.split(' ');
        if (parts.length === 2 && parts[1].includes(':')) return parts[1].substring(0, 5);
    }
    let d = new Date(ts * 1000);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return '--:--';
}

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
// FUNGSI DOWNLOAD CSV
// ==========================================
function downloadCSV() {
    if (latestTableData.length === 0) { alert("Belum ada data."); return; }
    const headers = ["Waktu", "Suhu (C)", "Kelembapan (%)", "Radiasi (Lux)", "Kecepatan Angin (m/s)", "Curah Hujan (mm)", "Arah Angin"];
    const rows = latestTableData.map(d => [
        d.ts || '-', 
        round1(getVal(d, 'tmp')), 
        round1(getVal(d, 'hum')), 
        round1(getVal(d, 'lx')), 
        round1(getVal(d, 'wnd')), 
        round1(getVal(d, 'rn')), 
        getArahAngin(getVal(d, 'ang'))
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `riwayat_cuaca_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ==========================================
// RENDER GRAFIK
// ==========================================
function renderCharts(labels, suhu, hum, wind, lux) {
    Object.values(charts).forEach(c => c.destroy());
    const baseOpts = {
        responsive: true, maintainAspectRatio: false, layout: { padding: 0 },
        plugins: { legend: { display: false } },
        scales: { 
            x: { display: false, grid: { display: false } }, 
            y: { beginAtZero: false, grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, callback: function(value) { return round1(value); } }, grace: '5%' } 
        }, animation: { duration: 0 }
    };

    charts.suhu = new Chart(document.getElementById('chartSuhu').getContext('2d'), {
        type: 'line', data: { labels, datasets: [{ data: suhu, borderColor: '#ef4444', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: 'rgba(239, 68, 68, 0.1)' }] }, options: baseOpts
    });
    charts.lembap = new Chart(document.getElementById('chartKelembapan').getContext('2d'), {
        type: 'line', data: { labels, datasets: [{ data: hum, borderColor: '#3b82f6', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' }] }, options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, min: 0, max: 100, grace: 0 } } }
    });
    charts.radiasi = new Chart(document.getElementById('chartRadiasi').getContext('2d'), {
        type: 'line', data: { labels, datasets: [{ data: lux, borderColor: '#eab308', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: 'rgba(234, 179, 8, 0.1)' }] }, options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, beginAtZero: true, grace: '10%' } } }
    });
    charts.angin = new Chart(document.getElementById('chartAngin').getContext('2d'), {
        type: 'line', data: { labels, datasets: [{ data: wind, borderColor: '#6366f1', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: true, backgroundColor: 'rgba(99, 102, 241, 0.1)' }] }, options: { ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, beginAtZero: true, grace: '10%' } } }
    });
}

// ==========================================
// DATA FETCHING
// ==========================================
function extractData(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    return [];
}

function loadHistory() {
    fetch(`${API_URL}?limit=${HISTORY_LIMIT}`)
        .then(res => res.json())
        .then(result => {
            const raw = extractData(result);
            if (raw.length === 0) { renderCharts([], [], [], [], []); return; }
            const historyData = raw.slice().reverse();
            const labels = historyData.map(d => parseTs(d.ts));
            renderCharts(
                labels, 
                historyData.map(d => round1(getVal(d, 'tmp'))), 
                historyData.map(d => round1(getVal(d, 'hum'))), 
                historyData.map(d => round1(getVal(d, 'wnd'))), 
                historyData.map(d => round1(getVal(d, 'lx')))
            );
        }).catch(err => console.warn('API history gagal.', err));
}

function fetchHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat data...</td></tr>';
    
    fetch(`${API_HISTORY_URL}?limit=${TABLE_LIMIT}`)
        .then(res => res.json())
        .then(result => {
            const raw = extractData(result);
            latestTableData = raw; 
            if (raw.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-400">Belum ada data riwayat.</td></tr>'; return;
            }
            tbody.innerHTML = raw.map(d => `
                <tr class="border-b hover:bg-gray-50 transition">
                    <td class="px-4 py-2 whitespace-nowrap">${d.ts || '-'}</td>
                    <td class="px-4 py-2">${round1(getVal(d, 'tmp'))}</td>
                    <td class="px-4 py-2">${round1(getVal(d, 'hum'))}</td>
                    <td class="px-4 py-2">${round1(getVal(d, 'lx'))}</td>
                    <td class="px-4 py-2">${round1(getVal(d, 'wnd'))}</td>
                    <td class="px-4 py-2">${round1(getVal(d, 'rn'))}</td>
                    <td class="px-4 py-2">${getArahAngin(getVal(d, 'ang'))}</td>
                </tr>
            `).join('');
        }).catch(err => {
            console.error('Gagal load tabel:', err);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">Gagal memuat data dari API.</td></tr>';
        });
}

// Inisialisasi
loadHistory(); 
fetchHistoryTable();
setInterval(() => { loadHistory(); fetchHistoryTable(); }, REFRESH_INTERVAL_MS);

// ==========================================
// MQTT REALTIME
// ==========================================
const client = mqtt.connect(MQTT_URL, { clientId: 'dash_' + Math.random().toString(16).substr(2, 8) });

client.on('connect', () => {
    document.getElementById('connection-status').innerHTML = '<span class="text-green-400"><i class="fa-solid fa-circle text-xs mr-1"></i> MQTT Online</span>';
    client.subscribe(MQTT_TOPIC);
});

client.on('offline', () => {
    document.getElementById('connection-status').innerHTML = '<span class="text-red-400"><i class="fa-solid fa-circle text-xs mr-1"></i> MQTT Offline</span>';
});

client.on('error', (err) => console.error('MQTT error:', err));

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        
        // Update Kartu Ringkasan
        document.getElementById('dash-temp').innerText = `${round1(getVal(data, 'tmp'))} °C`;
        document.getElementById('dash-hum').innerText  = `${round1(getVal(data, 'hum'))} %`;
        document.getElementById('dash-lux').innerText  = `${round1(getVal(data, 'lx'))}`;
        document.getElementById('dash-wind').innerText = `${round1(getVal(data, 'wnd'))} m/s`;
        document.getElementById('dash-rain').innerText = `${round1(getVal(data, 'rn'))} mm`;
        document.getElementById('dash-dir').innerText  = `${getArahAngin(getVal(data, 'ang'))}`;

        // Update Grafik Realtime
        if (charts.suhu && charts.lembap && charts.radiasi && charts.angin) {
            const label = parseTs(data.ts);
            const push = (chart, val) => {
                if (chart.data.labels.length >= HISTORY_LIMIT) { 
                    chart.data.labels.shift(); 
                    chart.data.datasets[0].data.shift(); 
                }
                chart.data.labels.push(label);
                chart.data.datasets[0].data.push(round1(val));
                chart.update('none');
            };
            push(charts.suhu, getVal(data, 'tmp')); 
            push(charts.lembap, getVal(data, 'hum')); 
            push(charts.radiasi, getVal(data, 'lx')); 
            push(charts.angin, getVal(data, 'wnd'));
        }
    } catch (e) { 
        console.error('Gagal parse pesan MQTT:', e); 
    }
});