// --- ИНИЦИАЛИЗАЦИЯ КАРТЫ ---
const map = L.map('map').setView([55.753, 48.743], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let binsLayer = L.layerGroup().addTo(map);
let routeLayer = L.layerGroup().addTo(map);
let userMarker = null;
let currentRole = 'resident';
let allBinsData = []; // Кэш данных

// --- ЗАГРУЗКА МУСОРОК ---
async function loadBins() {
    const res = await fetch('/api/map/geojson');
    const data = await res.json();
    allBinsData = data.features;

    binsLayer.clearLayers();

    L.geoJSON(data, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 8,
                fillColor: feature.properties.color,
                color: "#222", weight: 1, opacity: 1, fillOpacity: 0.9
            });
        },
        onEachFeature: function (feature, layer) {
            let fill = feature.properties.fill_percent;
            let popupContent = `
                <div style="text-align:center;">
                    <b>ID: ${feature.properties.id}</b><br>
                    <small>${feature.properties.address}</small><br>
                    <h5 class="mt-2" style="color:${feature.properties.color}">${fill}% Заполнен</h5>
                    <small>Батарея: ${feature.properties.battery}</small>
            `;
            // Для админа добавляем кнопку удаления
            if (currentRole === 'admin') {
                popupContent += `<hr><button class="btn btn-sm btn-danger w-100" onclick="deleteBin('${feature.properties.id}')">Удалить контейнер</button>`;
            }
            popupContent += `</div>`;
            layer.bindPopup(popupContent);
        }
    }).addTo(binsLayer);
}

// --- ПЕРЕКЛЮЧЕНИЕ РОЛЕЙ ---
function switchRole(role) {
    currentRole = role;

    // Переключаем табы
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');

    // Переключаем панели
    document.querySelectorAll('.role-panel').forEach(el => el.classList.remove('active'));
    document.getElementById(`panel-${role}`).classList.add('active');

    loadBins(); // Перезагружаем маркеры (чтобы обновить попапы)

    if (role === 'admin') loadDashboard();
}

// --- ЛОГИКА ЖИТЕЛЯ (Найти ближайшую пустую) ---
map.on('click', function(e) {
    if (currentRole === 'resident') {
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker(e.latlng).addTo(map).bindPopup("Я здесь").openPopup();
    } else if (currentRole === 'admin') {
        // Добавление новой мусорки
        let id = prompt("Введите ID нового контейнера (число):");
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
    if (!userMarker) {
        alert("Сначала кликните на карту, чтобы указать ваше местоположение!");
        return;
    }

    let userLoc = userMarker.getLatLng();
    let minDistance = Infinity;
    let nearestBin = null;

    allBinsData.forEach(bin => {
        // Ищем только зеленые (пустые)
        if (bin.properties.fill_percent < 50) {
            let binLoc = L.latLng(bin.geometry.coordinates[1], bin.geometry.coordinates[0]);
            let dist = userLoc.distanceTo(binLoc);
            if (dist < minDistance) {
                minDistance = dist;
                nearestBin = bin;
            }
        }
    });

    if (nearestBin) {
        let el = document.getElementById('nearest-bin-info');
        el.classList.remove('d-none');
        el.innerHTML = `Ближайший свободный: <b>Контейнер ${nearestBin.properties.id}</b><br>Расстояние: ${Math.round(minDistance)} м.`;

        // Рисуем линию к нему
        routeLayer.clearLayers();
        L.polyline([userLoc, [nearestBin.geometry.coordinates[1], nearestBin.geometry.coordinates[0]]], {color: 'green', dashArray: '5, 10'}).addTo(routeLayer);
    } else {
        alert("Нет свободных контейнеров поблизости :(");
    }
}

// --- ЛОГИКА ПОДРЯДЧИКА (Маршрут) ---
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

function clearRoute() {
    routeLayer.clearLayers();
    document.getElementById('route-stats').classList.add('d-none');
}

// --- ЛОГИКА АДМИНА ---
async function loadDashboard() {
    const res = await fetch('/api/analytics/dashboard');
    const data = await res.json();

    if(data.message) return;

    document.getElementById('dash-full').innerText = data.needs_collection_now;
    document.getElementById('dash-alerts').innerText = data.hardware_alerts_count;

    const fillList = document.getElementById('top-full-list');
    fillList.innerHTML = '';
    data.top_fastest_filling.forEach(b => {
        fillList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
            Контейнер ${b.id} <span class="badge bg-danger rounded-pill">${b.fill}%</span>
        </li>`;
    });

    const emptyList = document.getElementById('top-empty-list');
    emptyList.innerHTML = '';
    data.least_used.forEach(b => {
        emptyList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">
            Контейнер ${b.id} <span class="badge bg-success rounded-pill">${b.fill}%</span>
        </li>`;
    });
}

async function deleteBin(id) {
    if(confirm(`Удалить контейнер ${id}?`)) {
        await fetch(`/api/containers/${id}`, {method: 'DELETE'});
        loadBins();
    }
}

// Запуск при загрузке
loadBins();
