// ============ LOAD MAP DATA ============
async function loadMapData() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const geojsonData = await response.json();
        if (!geojsonData || !geojsonData.features) throw new Error('Invalid GeoJSON data');

        // Create HTML markers for each container
        geojsonData.features.forEach(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;
            
            // Determine color based on fill percentage
            let colorClass = 'bg-green-500';
            if (props.avg_fill_percent >= 70) colorClass = 'bg-red-500';
            else if (props.avg_fill_percent >= 50) colorClass = 'bg-yellow-500';
            
            // Create marker element
            const el = document.createElement('div');
            el.className = `flex items-center justify-center w-10 h-10 rounded-full shadow-lg text-white cursor-pointer transition-transform hover:scale-110 ${colorClass}`;
            el.innerHTML = `<i class="fas fa-trash-alt text-lg"></i>
                            <div class="absolute -top-2 -right-2 bg-white text-gray-800 text-xs font-bold px-1.5 py-0.5 rounded-full shadow border">${props.avg_fill_percent}%</div>`;
            
            // Add marker to map
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([coords[0], coords[1]])
                .addTo(map);
            
            // Handle click
            el.addEventListener('click', () => {
                const featureData = {
                    ...props,
                    containers: typeof props.containers === 'string' ? JSON.parse(props.containers) : props.containers
                };
                window.dispatchEvent(new CustomEvent('container-selected', { detail: featureData }));
                console.log('Container selected:', featureData);
            });
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
