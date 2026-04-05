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

        // Create trash bin SVG icons with different colors
        function createTrashIcon(fillPercent) {
            let color = '#28a745'; // green
            if (fillPercent >= 70) color = '#dc3545'; // red
            else if (fillPercent >= 50) color = '#ffc107'; // yellow
            
            const svg = `
                <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                            <feOffset dx="0" dy="2" result="offsetblur"/>
                            <feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer>
                            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>
                    <circle cx="20" cy="20" r="18" fill="white" stroke="${color}" stroke-width="2" filter="url(#shadow)"/>
                    <g transform="translate(20, 20)">
                        <rect x="-6" y="-8" width="12" height="14" rx="1" fill="${color}"/>
                        <rect x="-6" y="-10" width="12" height="2" rx="1" fill="${color}"/>
                        <line x1="-3" y1="-8" x2="-3" y2="4" stroke="white" stroke-width="0.8"/>
                        <line x1="0" y1="-8" x2="0" y2="4" stroke="white" stroke-width="0.8"/>
                        <line x1="3" y1="-8" x2="3" y2="4" stroke="white" stroke-width="0.8"/>
                    </g>
                </svg>
            `;
            return svg;
        }

        // Add icons for each unique fill percentage
        const fillPercentages = new Set();
        geojsonData.features.forEach(feature => {
            fillPercentages.add(feature.properties.avg_fill_percent);
        });

        fillPercentages.forEach(fillPercent => {
            const iconSvg = createTrashIcon(fillPercent);
            const canvas = document.createElement('canvas');
            canvas.width = 40;
            canvas.height = 40;
            const ctx = canvas.getContext('2d');
            
            const img = new Image();
            img.onload = function() {
                ctx.drawImage(img, 0, 0);
                const imageData = canvas.toDataURL('image/png');
                map.addImage(`trash-icon-${fillPercent}`, canvas, { pixelRatio: 2 });
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg);
        });

        // Add symbol layer with trash icons
        map.addLayer({
            id: 'containers-icons',
            type: 'symbol',
            source: 'containers-source',
            layout: {
                'icon-image': ['concat', 'trash-icon-', ['get', 'avg_fill_percent']],
                'icon-size': 1,
                'icon-allow-overlap': true,
                'text-field': ['get', 'avg_fill_percent'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 12,
                'text-offset': [0, 0]
            },
            paint: {
                'text-color': '#fff',
                'text-halo-color': 'rgba(0, 0, 0, 0.5)',
                'text-halo-width': 1
            }
        });

        // Click handler for containers layer
        map.on('click', 'containers-icons', function(e) {
            const properties = e.features[0].properties;
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
        map.on('mouseenter', 'containers-icons', function() {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'containers-icons', function() {
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
