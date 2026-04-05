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

// Initialize map data when map is fully loaded
window.addEventListener('map-loaded', function() {
    loadMapData();
});

// ============ LOGIN HANDLER ============
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessageEl = document.getElementById('error-message');
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('role', data.role);
            
            if (data.role === 'admin') {
                window.location.href = '/admin.html';
            } else if (data.role === 'contractor') {
                window.location.href = '/truck.html';
            }
        } else if (response.status === 401) {
            errorMessageEl.textContent = 'Неверный логин или пароль';
            errorMessageEl.style.color = '#dc3545';
            errorMessageEl.style.display = 'block';
        } else {
            errorMessageEl.textContent = 'Ошибка сервера. Попробуйте позже.';
            errorMessageEl.style.color = '#dc3545';
            errorMessageEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessageEl.textContent = 'Ошибка подключения к серверу';
        errorMessageEl.style.color = '#dc3545';
        errorMessageEl.style.display = 'block';
    }
}
