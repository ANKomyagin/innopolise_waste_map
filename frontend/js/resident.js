let map;
let userLocation = null;
let userPlacemark = null;
let routeLine = null;
let containers = [];

function initMap() {
    ymaps.ready(function() {
        map = new ymaps.Map("map", {
            center: [55.753, 48.743],
            zoom: 13,
            controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
        });

        loadContainers();
    });
}

async function loadContainers() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (!data || !data.features) throw new Error('Invalid data format');

        data.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const props = feature.properties;
            
            if (!props.containers || props.containers.length === 0) return;

            // Add all containers from this cluster to our list
            props.containers.forEach(c => {
                containers.push({
                    id: c.id,
                    lat: c.lat,
                    lon: c.lon,
                    fill: c.fill_percent,
                    address: c.address
                });
            });

            // Determine color based on average fill
            const avgFill = props.is_cluster ? props.avg_fill_percent : props.containers[0].fill_percent;
            let fillColor = '#28a745';
            if (avgFill >= 70) fillColor = '#dc3545';
            else if (avgFill >= 50) fillColor = '#ffc107';

            let iconSvg, balloonHeader, balloonBody, hintContent;

            // Unified design for all containers (single or cluster)
            const containerCount = props.container_count;
            const iconSize = 60; // Increased size
            
            // Beautiful cluster/container icon
            iconSvg = `
                <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
                            <feOffset dx="0" dy="3" result="offsetblur"/>
                            <feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer>
                            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>
                    <!-- Background circle -->
                    <circle cx="30" cy="30" r="26" fill="${fillColor}" opacity="0.2"/>
                    <circle cx="30" cy="30" r="24" fill="white" stroke="${fillColor}" stroke-width="3" filter="url(#shadow)"/>
                    <!-- Trash bins group -->
                    <g transform="translate(30, 30)">
                        <!-- Left bin -->
                        <rect x="-14" y="-7" width="9" height="12" rx="1" fill="${fillColor}" opacity="0.8"/>
                        <rect x="-14" y="-9" width="9" height="2.5" rx="1" fill="${fillColor}"/>
                        <line x1="-11" y1="-7" x2="-11" y2="3" stroke="white" stroke-width="1.2"/>
                        <!-- Center bin -->
                        <rect x="-4.5" y="-9" width="9" height="14" rx="1" fill="${fillColor}"/>
                        <rect x="-4.5" y="-11" width="9" height="2.5" rx="1" fill="${fillColor}"/>
                        <line x1="-2" y1="-9" x2="-2" y2="3" stroke="white" stroke-width="1.2"/>
                        <line x1="2" y1="-9" x2="2" y2="3" stroke="white" stroke-width="1.2"/>
                        <!-- Right bin -->
                        <rect x="5" y="-7" width="9" height="12" rx="1" fill="${fillColor}" opacity="0.8"/>
                        <rect x="5" y="-9" width="9" height="2.5" rx="1" fill="${fillColor}"/>
                        <line x1="8" y1="-7" x2="8" y2="3" stroke="white" stroke-width="1.2"/>
                    </g>
                    <!-- Count badge -->
                    <circle cx="46" cy="14" r="10" fill="#ff6b6b" stroke="white" stroke-width="2.5"/>
                    <text x="46" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${containerCount}</text>
                </svg>
            `;

            const containersList = props.containers.map(c => `
                <div style="padding: 8px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; border-left: 3px solid ${c.fill_percent >= 70 ? '#dc3545' : c.fill_percent >= 50 ? '#ffc107' : '#28a745'};">
                    <strong>🗑️ ${c.id}</strong><br>
                    Заполнение: <strong>${c.fill_percent}%</strong>
                </div>
            `).join('');

            // Progress bar for fill percentage
            const fillPercentage = props.avg_fill_percent;
            const progressBarColor = fillPercentage >= 70 ? '#dc3545' : fillPercentage >= 50 ? '#ffc107' : '#28a745';
            
            balloonHeader = `<b>📍 ${props.is_cluster ? 'Площадка' : 'Контейнер'} (${containerCount} ${containerCount === 1 ? 'контейнер' : 'контейнера'})</b>`;
            balloonBody = `
                <div style="padding: 10px; max-height: 400px; overflow-y: auto;">
                    <p><strong>📍 Адрес:</strong> ${props.address}</p>
                    <div style="margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-weight: 600;">Заполненность:</span>
                            <span style="font-weight: 700; color: ${progressBarColor};">${fillPercentage}%</span>
                        </div>
                        <div style="width: 100%; height: 24px; background: #e9ecef; border-radius: 12px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="width: ${fillPercentage}%; height: 100%; background: linear-gradient(90deg, ${progressBarColor}, ${progressBarColor}dd); transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">
                                ${fillPercentage > 15 ? fillPercentage + '%' : ''}
                            </div>
                        </div>
                    </div>
                    <hr>
                    <h6><strong>Контейнеры на площадке:</strong></h6>
                    ${containersList}
                </div>
            `;
            hintContent = `${props.is_cluster ? 'Площадка' : 'Контейнер'}: ${containerCount} ${containerCount === 1 ? 'контейнер' : 'контейнеров'}, ${fillPercentage}%`;
            const placemark = new ymaps.Placemark(
                [coords[1], coords[0]],
                {
                    balloonContentHeader: balloonHeader,
                    balloonContentBody: balloonBody,
                    hintContent: hintContent
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

        console.log(`Загружено ${containers.length} контейнеров`);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        alert('Не удалось загрузить данные о контейнерах');
    }
}

function setMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                userLocation = [position.coords.latitude, position.coords.longitude];
                
                if (userPlacemark) {
                    map.geoObjects.remove(userPlacemark);
                }

                const userIcon = `
                    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="20" cy="20" r="16" fill="#4facfe" stroke="#fff" stroke-width="3"/>
                        <circle cx="20" cy="20" r="6" fill="#fff"/>
                    </svg>
                `;

                userPlacemark = new ymaps.Placemark(
                    userLocation,
                    {
                        balloonContent: '<b>📍 Вы здесь</b>',
                        hintContent: 'Ваше местоположение'
                    },
                    {
                        iconLayout: 'default#image',
                        iconImageHref: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(userIcon),
                        iconImageSize: [40, 40],
                        iconImageOffset: [-20, -20]
                    }
                );

                map.geoObjects.add(userPlacemark);
                map.setCenter(userLocation, 15);
            },
            error => {
                alert('Не удалось определить ваше местоположение. Кликните на карте, чтобы указать точку вручную.');
                enableMapClick();
            }
        );
    } else {
        alert('Геолокация не поддерживается вашим браузером. Кликните на карте, чтобы указать точку.');
        enableMapClick();
    }
}

function enableMapClick() {
    map.events.add('click', function(e) {
        userLocation = e.get('coords');
        
        if (userPlacemark) {
            map.geoObjects.remove(userPlacemark);
        }

        const userIcon = `
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="16" fill="#4facfe" stroke="#fff" stroke-width="3"/>
                <circle cx="20" cy="20" r="6" fill="#fff"/>
            </svg>
        `;

        userPlacemark = new ymaps.Placemark(
            userLocation,
            {
                balloonContent: '<b>📍 Вы здесь</b>',
                hintContent: 'Ваше местоположение'
            },
            {
                iconLayout: 'default#image',
                iconImageHref: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(userIcon),
                iconImageSize: [40, 40],
                iconImageOffset: [-20, -20]
            }
        );

        map.geoObjects.add(userPlacemark);
    });
}

function findNearestContainer() {
    if (!userLocation) {
        alert('Сначала укажите ваше местоположение');
        return;
    }

    // Find containers with fill < 70% (available)
    const availableContainers = containers.filter(c => c.fill < 70);
    
    if (availableContainers.length === 0) {
        alert('К сожалению, все контейнеры переполнены');
        return;
    }

    // Find nearest
    let nearest = null;
    let minDistance = Infinity;

    availableContainers.forEach(container => {
        const distance = getDistance(
            userLocation[0], userLocation[1],
            container.lat, container.lon
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            nearest = container;
        }
    });

    if (nearest) {
        buildRoute(userLocation, [nearest.lat, nearest.lon], nearest, minDistance);
    }
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function buildRoute(from, to, container, distance) {
    ymaps.route([from, to], {
        mapStateAutoApply: true,
        routingMode: 'pedestrian'
    }).then(route => {
        if (routeLine) {
            map.geoObjects.remove(routeLine);
        }
        
        route.getPaths().options.set({
            strokeColor: '#4facfe',
            strokeWidth: 4,
            opacity: 0.8
        });

        map.geoObjects.add(route);
        routeLine = route;

        const walkTime = Math.round(distance / 80); // ~80m/min walking speed
        
        document.getElementById('routeInfo').innerHTML = `
            <h6><i class="fas fa-check-circle"></i> Маршрут построен</h6>
            <p><strong>Контейнер:</strong> ${container.id}</p>
            <p><strong>Адрес:</strong> ${container.address}</p>
            <p><strong>Расстояние:</strong> ${Math.round(distance)} м</p>
            <p><strong>Время пешком:</strong> ~${walkTime} мин</p>
            <p><strong>Заполненность:</strong> ${container.fill}%</p>
        `;
        document.getElementById('routeInfo').classList.add('active');
    }).catch(error => {
        console.error('Ошибка построения маршрута:', error);
        alert('Не удалось построить маршрут');
    });
}

function clearRoute() {
    if (routeLine) {
        map.geoObjects.remove(routeLine);
        routeLine = null;
    }
    document.getElementById('routeInfo').classList.remove('active');
}

initMap();
