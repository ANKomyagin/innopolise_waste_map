// ============ STATE ============ 
let map;
let userLocation = null;
let userPlacemark = null;
let routeLine = null;
let containers = [];

// ============ MAP INIT ============ 
ymaps.ready(function() {
    map = new ymaps.Map("map", {
        center: [55.753, 48.743],
        zoom: 14,
        controls: ['zoomControl', 'geolocationControl', 'typeSelector']
    });
    loadContainers();
});

// ============ LOAD CONTAINERS ============ 
async function loadContainers() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (!data || !data.features) throw new Error('Invalid data');

        let totalCount = 0;
        let fullCount = 0;
        let fillSum = 0;

        data.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const props = feature.properties;
            if (!props.containers || props.containers.length === 0) return;

            props.containers.forEach(c => {
                containers.push({
                    id: c.id, lat: c.lat, lon: c.lon,
                    fill: c.fill_percent, address: c.address
                });
                totalCount++;
                fillSum += c.fill_percent;
                if (c.fill_percent >= 70) fullCount++;
            });

            const avgFill = props.avg_fill_percent || (props.containers.length === 1 ? props.containers[0].fill_percent : 0);
            let fillColor = '#28a745';
            if (avgFill >= 70) fillColor = '#dc3545';
            else if (avgFill >= 50) fillColor = '#ffc107';

            const containerCount = props.container_count || props.containers.length;
            const iconSize = 60;
            const iconSvg = `
                <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
                            <feOffset dx="0" dy="3" result="ob"/>
                            <feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer>
                            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>
                    <circle cx="30" cy="30" r="26" fill="${fillColor}" opacity="0.2"/>
                    <circle cx="30" cy="30" r="24" fill="white" stroke="${fillColor}" stroke-width="3" filter="url(#s)"/>
                    <g transform="translate(30,30)">
                        <rect x="-14" y="-7" width="9" height="12" rx="1" fill="${fillColor}" opacity="0.8"/>
                        <rect x="-14" y="-9" width="9" height="2.5" rx="1" fill="${fillColor}"/>
                        <rect x="-4.5" y="-9" width="9" height="14" rx="1" fill="${fillColor}"/>
                        <rect x="-4.5" y="-11" width="9" height="2.5" rx="1" fill="${fillColor}"/>
                        <rect x="5" y="-7" width="9" height="12" rx="1" fill="${fillColor}" opacity="0.8"/>
                        <rect x="5" y="-9" width="9" height="2.5" rx="1" fill="${fillColor}"/>
                    </g>
                    <circle cx="46" cy="14" r="10" fill="#ff6b6b" stroke="white" stroke-width="2.5"/>
                    <text x="46" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${containerCount}</text>
                </svg>`;

            const fillPct = avgFill;
            const barColor = fillPct >= 70 ? '#dc3545' : fillPct >= 50 ? '#ffc107' : '#28a745';
            const containersList = props.containers.map(c => `
                <div style="padding:8px;margin:4px 0;background:#f8f9fa;border-radius:6px;border-left:3px solid ${c.fill_percent>=70?'#dc3545':c.fill_percent>=50?'#ffc107':'#28a745'}">
                    <strong>${c.id}</strong> — ${c.fill_percent}%
                </div>`).join('');

            const balloonBody = `
                <div style="padding:8px;max-height:350px;overflow-y:auto">
                    <p style="margin:0 0 8px"><strong>Адрес:</strong> ${props.address || '—'}</p>
                    <div style="margin:8px 0">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                            <span style="font-weight:600">Заполненность:</span>
                            <span style="font-weight:700;color:${barColor}">${fillPct}%</span>
                        </div>
                        <div style="width:100%;height:20px;background:#e9ecef;border-radius:10px;overflow:hidden">
                            <div style="width:${fillPct}%;height:100%;background:${barColor};border-radius:10px"></div>
                        </div>
                    </div>
                    <hr style="border:none;border-top:1px solid #dee2e6;margin:10px 0">
                    <strong>Контейнеры (${containerCount}):</strong>
                    ${containersList}
                </div>`;

            const placemark = new ymaps.Placemark(
                [coords[1], coords[0]],
                {
                    balloonContentHeader: `<b>${props.is_cluster ? 'Площадка' : 'Контейнер'} (${containerCount})</b>`,
                    balloonContentBody: balloonBody,
                    hintContent: `${containerCount} конт., ${fillPct}%`
                },
                {
                    iconLayout: 'default#image',
                    iconImageHref: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg),
                    iconImageSize: [iconSize, iconSize],
                    iconImageOffset: [-iconSize/2, -iconSize/2]
                }
            );
            map.geoObjects.add(placemark);
        });


    } catch (err) {
        console.error('Ошибка загрузки контейнеров:', err);
    }
}

// ============ GEOLOCATION ============ 
function setMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => placeUser([pos.coords.latitude, pos.coords.longitude]),
            () => {
                alert('Не удалось определить местоположение. Кликните на карту, чтобы указать вручную.');
                enableMapClick();
            }
        );
    } else {
        alert('Геолокация не поддерживается. Кликните на карту.');
        enableMapClick();
    }
}

function placeUser(coords) {
    userLocation = coords;
    if (userPlacemark) map.geoObjects.remove(userPlacemark);

    const icon = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="16" fill="#667eea" stroke="#fff" stroke-width="3"/>
        <circle cx="20" cy="20" r="6" fill="#fff"/>
    </svg>`;

    userPlacemark = new ymaps.Placemark(userLocation,
        { balloonContent: '<b>Вы здесь</b>', hintContent: 'Ваше местоположение' },
        {
            iconLayout: 'default#image',
            iconImageHref: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(icon),
            iconImageSize: [40,40],
            iconImageOffset: [-20,-20]
        }
    );
    map.geoObjects.add(userPlacemark);
    map.setCenter(userLocation, 15, { duration: 400 });
}

function enableMapClick() {
    map.events.add('click', function handler(e) {
        placeUser(e.get('coords'));
        map.events.remove('click', handler);
    });
}

// ============ NEAREST CONTAINER ============ 
function findNearestContainer() {
    if (!userLocation) {
        alert('Сначала укажите ваше местоположение');
        return;
    }
    const available = containers.filter(c => c.fill < 70);
    if (available.length === 0) {
        alert('Все контейнеры переполнены');
        return;
    }
    let nearest = null, minDist = Infinity;
    available.forEach(c => {
        const d = haversine(userLocation[0], userLocation[1], c.lat, c.lon);
        if (d < minDist) { minDist = d; nearest = c; }
    });
    if (nearest) buildRoute(userLocation, [nearest.lat, nearest.lon], nearest, minDist);
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buildRoute(from, to, container, distance) {
    ymaps.route([from, to], { mapStateAutoApply: true, routingMode: 'pedestrian' })
        .then(route => {
            if (routeLine) map.geoObjects.remove(routeLine);
            route.getPaths().options.set({ strokeColor: '#667eea', strokeWidth: 5, opacity: 0.85 });
            map.geoObjects.add(route);
            routeLine = route;

            const walkMin = Math.round(distance / 80);
            const el = document.getElementById('routeInfo');
            el.innerHTML = `
                <h6><i class="fas fa-check-circle"></i> Маршрут построен</h6>
                <p><strong>Контейнер:</strong> ${container.id}</p>
                <p><strong>Адрес:</strong> ${container.address || '—'}</p>
                <p><strong>Расстояние:</strong> ${Math.round(distance)} м</p>
                <p><strong>Пешком:</strong> ~${walkMin} мин</p>
                <p><strong>Заполненность:</strong> ${container.fill}%</p>`;
            el.classList.add('active');
        })
        .catch(() => alert('Не удалось построить маршрут'));
}

function clearRoute() {
    if (routeLine) { map.geoObjects.remove(routeLine); routeLine = null; }
    const el = document.getElementById('routeInfo');
    el.classList.remove('active');
    el.innerHTML = '';
}

// ============ LOGIN ============ 
function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}
function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('error-message').style.display = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', document.getElementById('username').value);
    formData.append('password', document.getElementById('password').value);

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            if (data.role === 'admin') window.location.href = '/admin.html';
            else if (data.role === 'contractor') window.location.href = '/truck.html';
        } else {
            showError('Неверный логин или пароль');
        }
    } catch {
        showError('Ошибка подключения к серверу');
    }
}

function showError(msg) {
    const el = document.getElementById('error-message');
    el.textContent = msg;
    el.style.display = 'block';
}
