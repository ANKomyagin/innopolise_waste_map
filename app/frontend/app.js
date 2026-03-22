// --- ИНИЦИАЛИЗАЦИЯ КАРТЫ ---
const map = L.map('map').setView([55.753, 48.743], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let binsLayer = L.layerGroup().addTo(map);
let routeLayer = L.layerGroup().addTo(map);
let userMarker = null;
let currentRole = 'resident';
let allBinsData = []; // Кэш данных

// --- ФУНКЦИЯ РАСЧЕТА РАССТОЯНИЯ (в метрах) ---
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Радиус Земли
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// --- ЗАГРУЗКА И КЛАСТЕРИЗАЦИЯ МУСОРОК ---
async function loadBins() {
    const res = await fetch('/api/map/geojson');
    const data = await res.json();
    allBinsData = data.features;
    binsLayer.clearLayers();

    // 1. Группируем контейнеры в площадки (радиус 15 метров)
    let pads = [];
    allBinsData.forEach(bin => {
        let placed = false;
        let binLat = bin.geometry.coordinates[1];
        let binLng = bin.geometry.coordinates[0];

        for(let pad of pads) {
            if(getDistanceMeters(pad.lat, pad.lng, binLat, binLng) <= 15) {
                pad.containers.push(bin);
                placed = true;
                break;
            }
        }
        if(!placed) {
            pads.push({ lat: binLat, lng: binLng, containers: [bin] });
        }
    });

    // 2. Отрисовываем сгруппированные площадки
    pads.forEach(pad => {
        let totalCapacity = pad.containers.length * 100;
        let currentFill = 0;
        pad.containers.forEach(c => currentFill += c.properties.fill_percent);

        let avgFill = (currentFill / pad.containers.length) || 0;

        // Определяем цвет кластера
        let colorClass = 'bg-success';
        if (avgFill >= 70) colorClass = 'bg-danger';
        else if (avgFill >= 50) colorClass = 'bg-warning text-dark';

        // Рисуем красивую иконку с цифрой (количество баков на площадке)
        let iconHtml = `<div class="pad-cluster ${colorClass}">${pad.containers.length}</div>`;
        let customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });

        let marker = L.marker([pad.lat, pad.lng], { icon: customIcon });

        // Формируем попап
        let popupHtml = `
            <div style="min-width: 250px;">
                <h6 class="mb-1">📍 Площадка: ${pad.containers[0].properties.address}</h6>
                <div class="alert alert-secondary p-2 mb-2 text-center">
                    <b>Заполнено: ${Math.round(currentFill)}% из ${totalCapacity}%</b>
                </div>
                <div class="container-list">
        `;

        pad.containers.forEach(c => {
            let p = c.properties;
            popupHtml += `
                <div class="border-bottom pb-2 mb-2">
                    <b>ID: ${p.id}</b> <span style="color:${p.color}">(${p.fill_percent}%)</span><br>
                    <small>Батарея: ${p.battery}</small>
            `;
            // Кнопки для админа
            if (currentRole === 'admin') {
                popupHtml += `
                    <div class="mt-1 d-flex gap-1">
                        <a href="/api/containers/${p.id}/qr" target="_blank" class="btn btn-sm btn-outline-dark" style="flex:1">🖨 QR</a>
                        <button class="btn btn-sm btn-outline-primary" style="flex:1" onclick="editBin('${p.id}', '${p.address}', '${c.geometry.coordinates[1]}, ${c.geometry.coordinates[0]}')">✏️ Изменить</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteBin('${p.id}')">🗑</button>
                    </div>
                `;
            }
            popupHtml += `</div>`;
        });

        popupHtml += `</div></div>`;
        marker.bindPopup(popupHtml).addTo(binsLayer);
    });
}

// --- ЛОГИКА АДМИНА: РЕДАКТИРОВАНИЕ ---
async function editBin(id, oldAddress, oldCoords) {
    let newAddress = prompt(`Редактирование адреса для контейнера ${id}:`, oldAddress);
    if (newAddress === null) return; // Нажали Отмена

    let newCoords = prompt(`Координаты (Широта, Долгота):`, oldCoords);
    if (newCoords === null) return;

    await fetch(`/api/containers/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({address: newAddress, coords: newCoords})
    });
    loadBins();
}

async function deleteBin(id) {
    if(confirm(`Удалить контейнер ${id}?`)) {
        await fetch(`/api/containers/${id}`, {method: 'DELETE'});
        loadBins();
    }
}

// --- ПЕРЕКЛЮЧЕНИЕ РОЛЕЙ ---
function switchRole(role) {
    currentRole = role;
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.role-panel').forEach(el => el.classList.remove('active'));
    document.getElementById(`panel-${role}`).classList.add('active');
    loadBins();
    if (role === 'admin') loadDashboard();
}

// Оставил логику маршрутов и добавления без изменений:
map.on('click', function(e) {
    if (currentRole === 'resident') {
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker(e.latlng).addTo(map).bindPopup("Я здесь").openPopup();
    } else if (currentRole === 'admin') {
        let id = prompt("Введите ID нового контейнера:");
        if (id) {
            fetch('/api/containers', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id: id, address: "Новая площадка", coords: `${e.latlng.lat}, ${e.latlng.lng}`})
            }).then(() => loadBins());
        }
    }
});

function findNearestGreenBin() {
    if (!userMarker) { alert("Сначала кликните на карту!"); return; }
    let userLoc = userMarker.getLatLng();
    let minDistance = Infinity;
    let nearestBin = null;

    allBinsData.forEach(bin => {
        if (bin.properties.fill_percent < 50) {
            let binLoc = L.latLng(bin.geometry.coordinates[1], bin.geometry.coordinates[0]);
            let dist = userLoc.distanceTo(binLoc);
            if (dist < minDistance) { minDistance = dist; nearestBin = bin; }
        }
    });

    if (nearestBin) {
        let el = document.getElementById('nearest-bin-info');
        el.classList.remove('d-none');
        el.innerHTML = `Ближайший свободный: <b>Контейнер ${nearestBin.properties.id}</b><br>Расстояние: ${Math.round(minDistance)} м.`;
        routeLayer.clearLayers();
        L.polyline([userLoc, [nearestBin.geometry.coordinates[1], nearestBin.geometry.coordinates[0]]], {color: 'green', dashArray: '5, 10'}).addTo(routeLayer);
    } else { alert("Нет свободных контейнеров поблизости :("); }
}

async function buildOptimalRoute() {
    routeLayer.clearLayers();
    document.getElementById('route-time').innerText = "Строим...";
    document.getElementById('route-stats').classList.remove('d-none');
    const res = await fetch('/api/logistics/route');
    const data = await res.json();
    if (data.message) {
        document.getElementById('route-time').innerText = "Нет работы!";
        document.getElementById('route-dist').innerText = data.message;
        return;
    }
    L.geoJSON(data.route.route_geojson, { style: { color: "#2196F3", weight: 5 } }).addTo(routeLayer);
    document.getElementById('route-time').innerText = `⏳ ${data.route.duration_min} мин.`;
    document.getElementById('route-dist').innerText = `🛣 ${data.route.distance_km} км пробега`;
}

function clearRoute() { routeLayer.clearLayers(); document.getElementById('route-stats').classList.add('d-none'); }

async function loadDashboard() {
    const res = await fetch('/api/analytics/dashboard');
    const data = await res.json();
    if(data.message) return;
    document.getElementById('dash-full').innerText = data.needs_collection_now;
    document.getElementById('dash-alerts').innerText = data.hardware_alerts_count;
    const fillList = document.getElementById('top-full-list'); fillList.innerHTML = '';
    data.top_fastest_filling.forEach(b => { fillList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">Контейнер ${b.id} <span class="badge bg-danger rounded-pill">${b.fill}%</span></li>`; });
    const emptyList = document.getElementById('top-empty-list'); emptyList.innerHTML = '';
    data.least_used.forEach(b => { emptyList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">Контейнер ${b.id} <span class="badge bg-success rounded-pill">${b.fill}%</span></li>`; });
}

loadBins();