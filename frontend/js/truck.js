// Check authentication on page load
(function() {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');
    
    if (!token || (role !== 'contractor' && role !== 'admin')) {
        alert('Доступ запрещен. Пожалуйста, войдите как водитель или администратор.');
        window.location.href = '/';
    }
})();

let containers = [];
let fillThreshold = 50;
let currentRouteContainers = [];
let startLocation = null;
let startMarker = null;
let waypointMarkers = [];

// Initialize map data when map is fully loaded
window.addEventListener('map-loaded', loadContainers);

async function loadContainers() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (!data || !data.features) throw new Error('Invalid data format');

        containers = [];

        // Extract all containers from features
        data.features.forEach(feature => {
            const props = feature.properties;
            if (props.containers && Array.isArray(props.containers)) {
                props.containers.forEach(c => {
                    containers.push(c);
                });
            }
        });

        // Add or update GeoJSON source
        if (map.getSource('containers-source')) {
            map.getSource('containers-source').setData(data);
        } else {
            map.addSource('containers-source', {
                type: 'geojson',
                data: data
            });

            const sourceName = map.getSource('containers-source') ? 'containers-source' : 'containers';
            
            // Очищаем старые слои, если они были
            if (map.getLayer('cluster-count')) map.removeLayer('cluster-count');
            if (map.getLayer('clusters')) map.removeLayer('clusters');

            map.addLayer({
                id: 'clusters',
                type: 'symbol',
                source: sourceName,
                layout: {
                    'icon-image': [
                        'case',
                        ['>=', ['get', 'avg_fill_percent'], 70], 'bin-red',
                        ['>=', ['get', 'avg_fill_percent'], 50], 'bin-yellow',
                        'bin-green'
                    ],
                    'icon-size': 1,
                    'icon-anchor': 'bottom',
                    'icon-allow-overlap': true
                }
            });

            // Клик по карте для установки точки старта
            map.on('click', function(e) {
                if (map.getLayer('clusters')) {
                    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
                    if (features.length > 0) return;
                }

                startLocation = `${e.lngLat.lat.toFixed(6)}, ${e.lngLat.lng.toFixed(6)}`;

                if (startMarker) startMarker.remove();

                const el = document.createElement('div');
                el.innerHTML = '<i class="fas fa-truck text-3xl text-blue-600" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));"></i>';
                startMarker = new maplibregl.Marker({element: el, anchor: 'bottom'})
                    .setLngLat([e.lngLat.lng, e.lngLat.lat])
                    .addTo(map);

                document.getElementById('startPointText').innerHTML = '<i class="fas fa-check-circle text-green-600"></i> Точка старта установлена';
            });

            // Обработка клика по контейнеру
            map.on('click', 'clusters', function(e) {
                const props = e.features[0].properties;
                const featureData = {
                    ...props,
                    containers: typeof props.containers === 'string' ? JSON.parse(props.containers) : props.containers
                };
                window.dispatchEvent(new CustomEvent('container-selected', { detail: featureData }));
            });
            map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
        }

        updateContainerCount();
        console.log(`Загружено ${containers.length} контейнеров`);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        alert('Не удалось загрузить данные о контейнерах');
    }
}

function updateThreshold(value) {
    fillThreshold = parseInt(value);
    document.getElementById('thresholdValue').textContent = value;
    updateContainerCount();
}

function updateContainerCount() {
    const needCollection = containers.filter(c => c.fill_percent >= fillThreshold);
    document.getElementById('containerCount').textContent = needCollection.length;
}

async function buildOptimalRoute() {
    const needCollection = containers.filter(c => c.fill_percent >= fillThreshold);
    
    if (!startLocation) {
        alert('Пожалуйста, укажите точку старта, кликнув на карту');
        return;
    }

    if (needCollection.length === 0) {
        alert('Нет контейнеров, требующих вывоза с текущим порогом');
        return;
    }

    try {
        // Use API to get optimal route (POST request)
        const response = await fetch('/api/logistics/route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('access_token')
            },
            body: JSON.stringify({
                container_ids: needCollection.map(c => c.id),
                threshold: fillThreshold,
                origin: startLocation
            })
        });

        if (response.ok) {
            const data = await response.json();
            // Если бэкенд вернул сообщение (например, нет уникальных точек)
            if (data.message) {
                alert(data.message);
                return;
            }
            const routeData = data.route;
            currentRouteContainers = needCollection.map(c => c.id);
            displayRoute(routeData, needCollection);
        } else {
            const errText = await response.text();
            console.error('Route build failed:', errText);
            alert('Не удалось построить маршрут. Подробности в консоли.');
        }
    } catch (error) {
        console.error('API route error:', error);
        alert('Ошибка при построении маршрута');
    }
}

function displayRoute(routeData, needCollection) {
    clearRoute();

    const routeGeoJSON = routeData.route_geojson;

    map.addSource('route', { type: 'geojson', data: routeGeoJSON });
    map.addLayer({
        id: 'route-layer', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.8 }
    });

    document.getElementById('routeDistance').textContent = `${routeData.distance_km.toFixed(2)} км`;
    document.getElementById('routeDuration').textContent = `~${Math.round(routeData.duration_min)} мин`;

    const addressListEl = document.getElementById('addressList');
    addressListEl.innerHTML = '';

    let yandexCoords = [startLocation.replace(', ', ',')];

    const waypoints = routeData.optimized_waypoints_order;
    const addedAddresses = new Set();
    let index = 1;

    waypoints.forEach(wpStr => {
        const [wpLat, wpLon] = wpStr.split(',').map(Number);

        let closestAddr = 'Неизвестный адрес';
        let minDist = Infinity;
        needCollection.forEach(c => {
            const dist = Math.pow(c.lat - wpLat, 2) + Math.pow(c.lon - wpLon, 2);
            if (dist < minDist) { minDist = dist; closestAddr = c.address; }
        });

        if (!addedAddresses.has(closestAddr)) {
            addedAddresses.add(closestAddr);

            const li = document.createElement('li');
            li.className = 'flex gap-2 items-start';
            li.innerHTML = `<span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5">${index}</span> <span>${closestAddr}</span>`;
            addressListEl.appendChild(li);

            const el = document.createElement('div');
            el.className = 'w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold border-2 border-white shadow-md text-xs';
            el.textContent = index;
            const marker = new maplibregl.Marker({element: el})
                .setLngLat([wpLon, wpLat])
                .addTo(map);
            waypointMarkers.push(marker);

            yandexCoords.push(`${wpLat},${wpLon}`);
            index++;
        }
    });

    const yandexUrl = `https://yandex.ru/maps/?rtext=${yandexCoords.join('~')}&rtt=auto`;
    document.getElementById('yandexRouteBtn').href = yandexUrl;

    document.getElementById('routeInfo').classList.remove('hidden');
    document.getElementById('actionPanel').classList.remove('hidden');

    const bounds = new maplibregl.LngLatBounds();
    const startParts = startLocation.split(',');
    bounds.extend([parseFloat(startParts[1]), parseFloat(startParts[0])]);
    waypoints.forEach(wp => {
        const parts = wp.split(',');
        bounds.extend([parseFloat(parts[1]), parseFloat(parts[0])]);
    });
    map.fitBounds(bounds, { padding: 50 });
}

function clearRoute() {
    if (map.getLayer('route-layer')) map.removeLayer('route-layer');
    if (map.getSource('route')) map.removeSource('route');

    waypointMarkers.forEach(m => m.remove());
    waypointMarkers = [];

    document.getElementById('routeInfo').classList.add('hidden');
    document.getElementById('actionPanel').classList.add('hidden');
    currentRouteContainers = [];
}

async function emptyRouteContainers() {
    if (!currentRouteContainers.length) return;
    if (!confirm(`Подтверждаете очистку ${currentRouteContainers.length} контейнеров?`)) return;

    try {
        const response = await fetch('/api/containers/empty', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('access_token')
            },
            body: JSON.stringify({ container_ids: currentRouteContainers })
        });

        if (response.ok) {
            alert('Контейнеры успешно отмечены как пустые!');
            clearRoute();
            loadContainers(); // Обновляем карту
        } else {
            alert('Ошибка при сбросе статуса');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка сети');
    }
}
