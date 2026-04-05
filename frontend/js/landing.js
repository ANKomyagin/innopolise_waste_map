// ============ LOAD MAP DATA ============
async function loadMapData() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const geojsonData = await response.json();
        if (!geojsonData || !geojsonData.features) throw new Error('Invalid GeoJSON data');

        // Add GeoJSON source to map
        map.addSource('containers-source', {
            type: 'geojson',
            data: geojsonData
        });

        // Add clusters layer (circle visualization)
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

        // Add cluster count layer (text display)
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

        // Click handler for clusters layer
        map.on('click', 'clusters', function(e) {
            const properties = e.features[0].properties;
            // In GeoJSON, properties may come as strings, need to parse nested objects
            const featureData = {
                ...properties,
                containers: typeof properties.containers === 'string' ? JSON.parse(properties.containers) : properties.containers
            };
            
            window.dispatchEvent(new CustomEvent('container-selected', {
                detail: featureData
            }));
            console.log('Container selected:', featureData);
        });

        // Cursor change on hover
        map.on('mouseenter', 'clusters', function() {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'clusters', function() {
            map.getCanvas().style.cursor = '';
        });

    } catch (err) {
        console.error('Ошибка загрузки данных контейнеров:', err);
    }
}

// Initialize map data when map is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait for map to be initialized in base.html
    const checkMapReady = setInterval(function() {
        if (typeof map !== 'undefined' && map) {
            clearInterval(checkMapReady);
            loadMapData();
        }
    }, 100);
});
