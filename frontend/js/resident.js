let containers = [];

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

            // Click handler for clusters layer
            map.on('click', 'clusters', function(e) {
                const properties = e.features[0].properties;
                const featureData = {
                    ...properties,
                    containers: typeof properties.containers === 'string' ? JSON.parse(properties.containers) : properties.containers
                };
                
                // Display container info
                const address = featureData.address || 'Адрес не указан';
                const fillPercent = featureData.avg_fill_percent || 0;
                const containerCount = featureData.container_count || 0;
                
                const message = `📍 Адрес: ${address}\n🗑️ Контейнеров: ${containerCount}\n📊 Заполненность: ${fillPercent}%`;
                alert(message);
                console.log('Container selected:', featureData);
            });

            // Cursor change on hover
            map.on('mouseenter', 'clusters', function() {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'clusters', function() {
                map.getCanvas().style.cursor = '';
            });
        }

        console.log(`Загружено ${containers.length} контейнеров`);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        alert('Не удалось загрузить данные о контейнерах');
    }
}

