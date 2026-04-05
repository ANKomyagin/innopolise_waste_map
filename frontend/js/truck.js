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

            // Add clusters layer
            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'containers-source',
                paint: {
                    'circle-color': [
                        'case',
                        ['>=', ['get', 'avg_fill_percent'], 70],
                        '#dc3545',
                        ['>=', ['get', 'avg_fill_percent'], 50],
                        '#ffc107',
                        '#28a745'
                    ],
                    'circle-radius': [
                        'case',
                        ['>', ['get', 'container_count'], 1],
                        20,
                        15
                    ],
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#fff'
                }
            });

            // Add cluster count layer
            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'containers-source',
                layout: {
                    'text-field': ['get', 'avg_fill_percent'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 14,
                    'text-offset': [0, 0]
                },
                paint: {
                    'text-color': '#fff',
                    'text-halo-color': 'rgba(0, 0, 0, 0.5)',
                    'text-halo-width': 1
                }
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
                threshold: fillThreshold
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

function displayRoute(routeData, containers) {
    // Remove old route if exists
    if (map.getLayer('route-layer')) {
        map.removeLayer('route-layer');
    }
    if (map.getSource('route')) {
        map.removeSource('route');
    }

    // Add new route source and layer
    const routeGeoJSON = routeData.route_geojson;
    
    map.addSource('route', {
        type: 'geojson',
        data: routeGeoJSON
    });

    map.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#2563eb',
            'line-width': 5,
            'line-opacity': 0.8
        }
    });

    // Display route info
    const distance = routeData.distance_km;
    const duration = routeData.duration_min;

    document.getElementById('routeDistance').textContent = `${distance.toFixed(2)} км`;
    document.getElementById('routeDuration').textContent = `~${Math.round(duration)} мин`;
    document.getElementById('routeInfo').classList.remove('hidden');
    document.getElementById('actionPanel').classList.remove('hidden');
}

function clearRoute() {
    // Remove route layer and source
    if (map.getLayer('route-layer')) {
        map.removeLayer('route-layer');
    }
    if (map.getSource('route')) {
        map.removeSource('route');
    }
    
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
