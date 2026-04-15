// ============ LOAD MAP DATA ============
async function loadMapData() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const geojsonData = await response.json();
        if (!geojsonData || !geojsonData.features) throw new Error('Invalid GeoJSON data');

        // Add GeoJSON source
        map.addSource('containers-source', {
            type: 'geojson',
            data: geojsonData
        });

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

        // Click handler
        map.on('click', 'clusters', function(e) {
            const props = e.features[0].properties;
            const featureData = {
                ...props,
                containers: typeof props.containers === 'string' ? JSON.parse(props.containers) : props.containers
            };
            window.dispatchEvent(new CustomEvent('container-selected', { detail: featureData }));
        });

        // Cursor change on hover
        map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

        // Disable scroll zoom to prevent breaking page scroll
        map.scrollZoom.disable();
        // Add zoom buttons
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

    } catch (err) {
        console.error('Ошибка загрузки данных контейнеров:', err);
        const mapSection = document.getElementById('map-section');
        if (mapSection) {
            const existing = document.getElementById('map-error-banner');
            if (existing) existing.remove();
            const banner = document.createElement('div');
            banner.id = 'map-error-banner';
            banner.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:12px 20px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.18);display:flex;align-items:center;gap:10px;z-index:9999;font-size:14px;max-width:90%;white-space:nowrap;';
            banner.innerHTML = '⚠️ <span style="white-space:normal;">Не удалось загрузить данные контейнеров. Возможно, ведутся технические работы.</span><button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:20px;line-height:1;cursor:pointer;color:#856404;margin-left:8px;padding:0;">×</button>';
            mapSection.appendChild(banner);
            setTimeout(() => { if (banner.parentElement) banner.remove(); }, 8000);
        }
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
