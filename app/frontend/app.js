// --- ИНИЦИАЛИЗАЦИЯ КАРТЫ ЯНДЕКС ---
let myMap;
let objectManager;
let userMarker = null;
let userRouteLine = null; // Маршрут для жителя (пешеходный)
let multiRoute = null; // Маршрут для подрядчика (авто)
let currentRole = 'resident';
let allBinsData = []; // Кэш данных с бекенда

// Ждем загрузки API Яндекса
ymaps.ready(init);

function init() {
    myMap = new ymaps.Map("map", {
        center: [55.753, 48.743], // Координаты Иннополиса
        zoom: 15,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    // Обработка клика по карте (для жителя и мэрии)
    myMap.events.add('click', function (e) {
        let coords = e.get('coords');

        if (currentRole === 'resident') {
            // Ставим метку пользователя
            if (userMarker) myMap.geoObjects.remove(userMarker);
            userMarker = new ymaps.Placemark(coords, { balloonContent: "Я здесь" }, { preset: 'islands#bluePersonIcon' });
            myMap.geoObjects.add(userMarker);

            // Если была старая линия до бака - удаляем
            if (userRouteLine) myMap.geoObjects.remove(userRouteLine);
            document.getElementById('nearest-bin-info').classList.add('d-none');

        } else if (currentRole === 'admin') {
            // Мэрия: Добавление нового бака
            let id = prompt("Введите ID нового умного контейнера:");
            if (id) {
                fetch('/api/containers', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({id: id, address: "Новая площадка", coords: `${coords[0]}, ${coords[1]}`})
                }).then(() => loadBins());
            }
        }
    });

    // Загружаем данные
    loadBins();
}

// --- ФУНКЦИЯ РАСЧЕТА ПРЯМОГО РАССТОЯНИЯ (Для поиска ближайшего бака) ---
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    return ymaps.coordSystem.geo.getDistance([lat1, lon1], [lat2, lon2]);
}

// --- ЗАГРУЗКА И КЛАСТЕРИЗАЦИЯ МУСОРОК ---
async function loadBins() {
    const res = await fetch('/api/map/geojson');
    const data = await res.json();
    allBinsData = data.features;

    // Очищаем карту от старых баков (не трогаем маршруты и юзера)
    myMap.geoObjects.each(function (geoObject) {
        if (geoObject !== userMarker && geoObject !== multiRoute && geoObject !== userRouteLine) {
            myMap.geoObjects.remove(geoObject);
        }
    });

    // 1. Группируем контейнеры в площадки (радиус 15 метров)
    let pads = [];
    allBinsData.forEach(bin => {
        let placed = false;
        let binLat = bin.geometry.coordinates[1]; // У GeoJSON координаты перевернуты [lon, lat]
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

        // Определяем цвет иконки Яндекса
        let presetColor = 'islands#greenCircleIcon';
        if (avgFill >= 70) presetColor = 'islands#redCircleIcon';
        else if (avgFill >= 50) presetColor = 'islands#yellowCircleIcon';

        // Формируем попап
        let popupHtml = `
            <div style="min-width: 250px;">
                <h6 class="mb-1">📍 Площадка: ${pad.containers[0].properties.address}</h6>
                <div class="alert alert-secondary p-2 mb-2 text-center">
                    <b>Заполнено: ${Math.round(currentFill)}% из ${totalCapacity}%</b>
                </div>
                <div class="container-list" style="max-height: 200px; overflow-y: auto;">
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
                        <button class="btn btn-sm btn-outline-primary" style="flex:1" onclick="window.editBin('${p.id}', '${p.address}', '${c.geometry.coordinates[1]}, ${c.geometry.coordinates[0]}')">✏️</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="window.deleteBin('${p.id}')">🗑</button>
                    </div>
                `;
            }
            popupHtml += `</div>`;
        });

        popupHtml += `</div></div>`;

        // Создаем маркер на Яндекс.Карте
        let placemark = new ymaps.Placemark([pad.lat, pad.lng], {
            balloonContent: popupHtml,
            iconContent: pad.containers.length.toString()
        }, {
            preset: presetColor
        });

        myMap.geoObjects.add(placemark);
    });
}

// --- ЛОГИКА АДМИНА: РЕДАКТИРОВАНИЕ ---
window.editBin = async function(id, oldAddress, oldCoords) {
    let newAddress = prompt(`Редактирование адреса для контейнера ${id}:`, oldAddress);
    if (newAddress === null) return;
    let newCoords = prompt(`Координаты (Широта, Долгота):`, oldCoords);
    if (newCoords === null) return;

    await fetch(`/api/containers/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({address: newAddress, coords: newCoords})
    });
    loadBins();
};

window.deleteBin = async function(id) {
    if(confirm(`Удалить контейнер ${id}?`)) {
        await fetch(`/api/containers/${id}`, {method: 'DELETE'});
        loadBins();
    }
};

// --- ПЕРЕКЛЮЧЕНИЕ РОЛЕЙ ---
window.switchRole = function(role) {
    currentRole = role;
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.role-panel').forEach(el => el.classList.remove('active'));
    document.getElementById(`panel-${role}`).classList.add('active');

    loadBins();
    if (role === 'admin') loadDashboard();
};

// --- ЖИТЕЛЬ: НАЙТИ СВОБОДНУЮ МУСОРКУ (Пешеходный маршрут) ---
window.findNearestGreenBin = function() {
    if (!userMarker) { alert("Сначала кликните на карту, чтобы указать, где вы!"); return; }

    let userLoc = userMarker.geometry.getCoordinates();
    let minDistance = Infinity;
    let nearestBin = null;

    // Ищем ближайший бак математически
    allBinsData.forEach(bin => {
        if (bin.properties.fill_percent < 50) {
            let binLoc = [bin.geometry.coordinates[1], bin.geometry.coordinates[0]];
            let dist = getDistanceMeters(userLoc[0], userLoc[1], binLoc[0], binLoc[1]);
            if (dist < minDistance) { minDistance = dist; nearestBin = bin; }
        }
    });

    if (nearestBin) {
        let el = document.getElementById('nearest-bin-info');
        el.classList.remove('d-none');
        el.innerHTML = `Ближайший свободный: <b>Контейнер ${nearestBin.properties.id}</b><br>Расстояние по прямой: ${Math.round(minDistance)} м.`;

        if (userRouteLine) myMap.geoObjects.remove(userRouteLine);

        let binCoords = [nearestBin.geometry.coordinates[1], nearestBin.geometry.coordinates[0]];

        // РЕШЕНИЕ 1: СТРОИМ НАСТОЯЩИЙ ПЕШЕХОДНЫЙ МАРШРУТ (С учетом тротуаров)
        userRouteLine = new ymaps.multiRouter.MultiRoute({
            referencePoints: [userLoc, binCoords],
            params: { routingMode: 'pedestrian' } // Режим пешехода
        }, {
            boundsAutoApply: true,
            wayPointVisible: false, // Скрываем дефолтные метки Яндекса (т.к. у нас уже стоят свои)
            routeActiveStrokeColor: '#28a745',
            routeActiveStrokeWidth: 5,
            routeActiveStrokeStyle: 'shortdash'
        });

        myMap.geoObjects.add(userRouteLine);
    } else {
        alert("Нет свободных контейнеров поблизости :(");
    }
};

// --- ПОДРЯДЧИК: ПОСТРОИТЬ МАРШРУТ (Автомобильный) ---
window.buildOptimalRoute = function() {
    clearRoute();
    document.getElementById('route-time').innerText = "Строим маршрут...";
    document.getElementById('route-stats').classList.remove('d-none');

    let points = [];
    points.push([55.753, 48.743]); // Депо мусоровозов (База Иннополиса)

    allBinsData.forEach(bin => {
        if (bin.properties.fill_percent >= 70) {
            points.push([bin.geometry.coordinates[1], bin.geometry.coordinates[0]]);
        }
    });

    if (points.length === 1) {
        document.getElementById('route-time').innerText = "Нет работы!";
        document.getElementById('route-dist').innerText = "Все контейнеры свободны";
        return;
    }

    // РЕШЕНИЕ 2: ГАРАНТИРОВАННОЕ ПОСТРОЕНИЕ АВТОМАРШРУТА ПО УЛИЦАМ
    multiRoute = new ymaps.multiRouter.MultiRoute({
        referencePoints: points,
        params: {
            routingMode: 'auto', // Автомобиль
            results: 1           // Берем только самый быстрый маршрут
        }
    }, {
        boundsAutoApply: true,
        routeActiveStrokeWidth: 6,
        routeActiveStrokeColor: '#1E98FF',
        wayPointVisible: true // Показываем кружочки на точках остановки мусоровоза
    });

    // Обработка успешного построения (извлечение минут и километров)
    multiRoute.model.events.add('requestsuccess', function() {
        var activeRoute = multiRoute.getActiveRoute();
        if(activeRoute) {
            document.getElementById('route-time').innerText = `⏳ ${activeRoute.properties.get("duration").text}`;
            document.getElementById('route-dist').innerText = `🛣 ${activeRoute.properties.get("distance").text}`;
        }
    });

    // Обработка ошибок Яндекса (если упадет, мы это увидим, а не просто пустую карту)
    multiRoute.model.events.add('requesterror', function (error) {
        console.error("Ошибка API Яндекса:", error.get('error').message);
        document.getElementById('route-time').innerText = "Ошибка API!";
        document.getElementById('route-dist').innerText = "Яндекс не смог проложить путь.";
    });

    myMap.geoObjects.add(multiRoute);
};

window.clearRoute = function() {
    if (multiRoute) myMap.geoObjects.remove(multiRoute);
    document.getElementById('route-stats').classList.add('d-none');
};

// --- ДАШБОРД МЭРИИ ---
async function loadDashboard() {
    const res = await fetch('/api/analytics/dashboard');
    const data = await res.json();
    if(data.message) return;
    document.getElementById('dash-full').innerText = data.needs_collection_now;
    document.getElementById('dash-alerts').innerText = data.hardware_alerts_count;

    const fillList = document.getElementById('top-full-list'); fillList.innerHTML = '';
    data.top_fastest_filling.forEach(b => {
        fillList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">Контейнер ${b.id} <span class="badge bg-danger rounded-pill">${b.fill}%</span></li>`;
    });

    const emptyList = document.getElementById('top-empty-list'); emptyList.innerHTML = '';
    data.least_used.forEach(b => {
        emptyList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">Контейнер ${b.id} <span class="badge bg-success rounded-pill">${b.fill}%</span></li>`;
    });
}