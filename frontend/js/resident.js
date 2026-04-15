let containersData = [];
let userMarker = null;

window.addEventListener('map-loaded', loadContainers);

async function loadContainers() {
    const response = await fetch('/api/map/geojson');
    const data = await response.json();
    
    // Сохраняем для поиска
    data.features.forEach(f => {
        containersData.push({
            address: f.properties.address,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            fill: f.properties.avg_fill_percent
        });
    });

    map.addSource('containers', { type: 'geojson', data: data });
    
    const sourceName = map.getSource('containers') ? 'containers' : 'containers-source';
    
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

    // Клик по карте (ставим точку "Дом")
    map.on('click', function(e) {
        // Проверяем, есть ли слой clusters перед запросом
        if (map.getLayer('clusters')) {
            const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
            if (features.length > 0) return; // Игнорируем клик, если попали по мусорке
        }
        
        const lat = e.lngLat.lat;
        const lon = e.lngLat.lng;
        window.dispatchEvent(new CustomEvent('set-user-location', { detail: {lat, lon, address: "Выбранная точка"} }));
    });
}

// Alpine.js логика UI
document.addEventListener('alpine:init', () => {
    Alpine.data('residentApp', () => ({
        expanded: true,
        touchStartY: 0,
        touchEndY: 0,
        searchQuery: '',
        suggestions: [],
        userLocation: null, // {lat, lon}
        routeInfo: null,
        
        init() {
            // Восстанавливаем локацию из памяти только ПОСЛЕ загрузки карты
            const restoreLocation = () => {
                const saved = localStorage.getItem('resident_location');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.updateMarker(parsed.lat, parsed.lon, parsed.address);
                }
            };

            if (window.map && window.map.loaded && window.map.loaded()) {
                restoreLocation();
            } else {
                window.addEventListener('map-loaded', restoreLocation);
            }

            window.addEventListener('set-user-location', (e) => {
                this.updateMarker(e.detail.lat, e.detail.lon, e.detail.address);
            });
        },
        
        searchAddress() {
            if (this.searchQuery.length < 2) { this.suggestions = []; return; }
            const q = this.searchQuery.toLowerCase();
            // Ищем уникальные адреса
            const unique = new Set();
            this.suggestions = containersData.filter(c => {
                if (c.address.toLowerCase().includes(q) && !unique.has(c.address)) {
                    unique.add(c.address);
                    return true;
                }
                return false;
            }).slice(0, 5);
        },
        
        selectAddress(item) {
            this.updateMarker(item.lat, item.lon, item.address);
            this.suggestions = [];
            map.flyTo({center: [item.lon, item.lat], zoom: 15});
        },
        
        updateMarker(lat, lon, addr) {
            this.userLocation = {lat, lon};
            this.searchQuery = addr;
            localStorage.setItem('resident_location', JSON.stringify({lat, lon, address: addr}));
            
            if (userMarker) userMarker.remove();
            
            const el = document.createElement('div');
            el.innerHTML = '<i class="fas fa-home text-2xl text-blue-600" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>';
            userMarker = new maplibregl.Marker({element: el}).setLngLat([lon, lat]).addTo(map);
        },
        
        async findNearest() {
            if (!this.userLocation) return;
            this.expanded = false; // Сворачиваем панель на мобилках
            
            // Ищем ближайший свободный бак (<70%)
            const available = containersData.filter(c => c.fill < 70);
            if (!available.length) { alert("Все контейнеры переполнены!"); return; }
            
            // Считаем дистанцию
            let nearest = available[0];
            let minDist = Infinity;
            available.forEach(c => {
                const dist = Math.pow(c.lat - this.userLocation.lat, 2) + Math.pow(c.lon - this.userLocation.lon, 2);
                if (dist < minDist) { minDist = dist; nearest = c; }
            });

            // Строим маршрут
            const response = await fetch('/api/logistics/resident-route', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    origin: `${this.userLocation.lat},${this.userLocation.lon}`,
                    destination: `${nearest.lat},${nearest.lon}` 
                })
            });
            
            if(response.ok) {
                const data = await response.json();
                this.routeInfo = data.route;
                this.drawRoute(data.route.route_geojson);
                
                // Подстраиваем камеру, чтобы вместить маршрут
                const bounds = new maplibregl.LngLatBounds();
                bounds.extend([this.userLocation.lon, this.userLocation.lat]);
                bounds.extend([nearest.lon, nearest.lat]);
                map.fitBounds(bounds, {padding: 50});
            }
        },
        
        drawRoute(geojson) {
            this.clearRoute();
            map.addSource('route', { type: 'geojson', data: geojson });
            map.addLayer({
                id: 'route-layer', type: 'line', source: 'route',
                paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-dasharray': [1, 2] }
            });
        },
        
        clearRoute() {
            this.routeInfo = null;
            if (map.getLayer('route-layer')) map.removeLayer('route-layer');
            if (map.getSource('route')) map.removeSource('route');
        }
    }));
});

