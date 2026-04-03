let map;
let objects = [];
let currentStats = null;
let statsModalInstance = null;

// Инициализация Яндекс.Карты
function initMap() {
    ymaps.ready(function() {
        map = new ymaps.Map("map", {
            center: [55.753, 48.743], // Координаты Иннополиса
            zoom: 13,
            controls: ['zoomControl', 'searchControl', 'typeSelector', 'fullscreenControl']
        });

        // Добавляем слой пробок (опционально)
        map.controls.add('trafficControl');

        loadContainers();
    });
}

// Загрузка данных о контейнерах
async function loadContainers() {
    try {
        const response = await fetch('/api/map/geojson');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.features) {
            throw new Error('Invalid data format received from API');
        }
        
        console.log('Received data:', data);
        
        // Очистка старых объектов
        objects.forEach(obj => map.geoObjects.remove(obj));
        objects = [];

        // Добавление новых меток (с поддержкой кластеров)
        data.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const props = feature.properties;
            
            // Проверка наличия контейнеров
            if (!props.containers || props.containers.length === 0) {
                console.warn('Feature without containers:', feature);
                return;
            }
            
            // Определяем цвет в зависимости от заполненности
            let fillColor = '#28a745'; // зеленый
            const fillPercent = props.is_cluster ? props.avg_fill_percent : props.containers[0].fill_percent;
            
            if (fillPercent >= 70) {
                fillColor = '#dc3545'; // красный
            } else if (fillPercent >= 50) {
                fillColor = '#ffc107'; // желтый
            }

            // Формируем контент балуна
            let balloonHeader, balloonBody, hintContent;
            
            if (props.is_cluster) {
                // Площадка с несколькими контейнерами
                balloonHeader = `<b>📍 Площадка (${props.container_count} контейнера)</b>`;
                
                const containersList = props.containers.map(c => `
                    <div style="padding: 8px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; border-left: 3px solid ${c.fill_percent >= 70 ? '#dc3545' : c.fill_percent >= 50 ? '#ffc107' : '#28a745'};">
                        <strong>🗑️ ${c.id}</strong><br>
                        Заполнение: <strong>${c.fill_percent}%</strong><br>
                        Батарея: ${c.battery}<br>
                        Температура: ${c.temperature}
                    </div>
                `).join('');
                
                balloonBody = `
                    <div style="padding: 10px; max-height: 400px; overflow-y: auto;">
                        <p><strong>📍 Адрес:</strong> ${props.address}</p>
                        <p style="font-size: 16px; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; text-align: center;">
                            <strong>Суммарная заполненность:</strong><br>
                            <span style="font-size: 24px;">${props.total_fill}%</span> из ${props.max_capacity}%<br>
                            <small>(Средняя: ${props.avg_fill_percent}%)</small>
                        </p>
                        <hr>
                        <h6><strong>Контейнеры на площадке:</strong></h6>
                        ${containersList}
                    </div>
                `;
                
                hintContent = `Площадка: ${props.container_count} контейнеров, ${props.total_fill}% из ${props.max_capacity}%`;
            } else {
                // Одиночный контейнер
                const c = props.containers[0];
                balloonHeader = `<b>🗑️ Контейнер: ${c.id}</b>`;
                balloonBody = `
                    <div style="padding: 10px;">
                        <p><strong>📍 Адрес:</strong> ${c.address}</p>
                        <p><strong>📊 Заполненность:</strong> ${c.fill_percent}%</p>
                        <p><strong>🔋 Батарея:</strong> ${c.battery}</p>
                        <p><strong>🌡️ Температура:</strong> ${c.temperature}</p>
                        <p><strong>🕐 Обновлено:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                `;
                hintContent = `Контейнер ${c.id}: ${c.fill_percent}%`;
            }

            // Создание иконки с учетом кластеризации
            let iconSvg;
            if (props.is_cluster) {
                // Иконка для площадки с несколькими контейнерами
                iconSvg = `
                    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                                <feOffset dx="0" dy="2" result="offsetblur"/>
                                <feComponentTransfer>
                                    <feFuncA type="linear" slope="0.3"/>
                                </feComponentTransfer>
                                <feMerge>
                                    <feMergeNode/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <circle cx="24" cy="24" r="18" fill="${fillColor}" stroke="#fff" stroke-width="3" filter="url(#shadow)"/>
                        <circle cx="24" cy="24" r="14" fill="none" stroke="#fff" stroke-width="1" opacity="0.5"/>
                        <text x="24" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${props.total_fill}%</text>
                        <text x="24" y="32" text-anchor="middle" fill="white" font-size="8">${props.container_count}x</text>
                    </svg>
                `;
            } else {
                // Иконка для одиночного контейнера
                iconSvg = `
                    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
                                <feOffset dx="0" dy="1" result="offsetblur"/>
                                <feComponentTransfer>
                                    <feFuncA type="linear" slope="0.3"/>
                                </feComponentTransfer>
                                <feMerge>
                                    <feMergeNode/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <circle cx="18" cy="18" r="14" fill="${fillColor}" stroke="#fff" stroke-width="2" filter="url(#shadow)"/>
                        <text x="18" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${fillPercent}%</text>
                    </svg>
                `;
            }

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
                    iconImageSize: props.is_cluster ? [48, 48] : [36, 36],
                    iconImageOffset: props.is_cluster ? [-24, -24] : [-18, -18]
                }
            );

            map.geoObjects.add(placemark);
            objects.push(placemark);
        });

        console.log(`Загружено ${data.features.length} площадок/контейнеров`);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        console.error('Error details:', error.message, error.stack);
        alert(`Не удалось загрузить данные о контейнерах.\nОшибка: ${error.message}\nПроверьте консоль браузера для деталей.`);
    }
}

// Обновление данных
function refreshData() {
    console.log('Обновление данных...');
    loadContainers();
}

// Центрирование на Иннополисе
function centerOnInnopolis() {
    map.setCenter([55.753, 48.743], 13);
}

// Показ статистики
async function showStats() {
    try {
        const response = await fetch('/api/analytics/dashboard');
        const stats = await response.json();
        currentStats = stats;
        
        const statsHtml = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>📦 Всего контейнеров:</strong> ${stats.total_containers || 0}</p>
                    <p><strong>🚛 Требуют вывоза:</strong> ${stats.needs_collection_now || 0}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>⚠️ Аппаратных сбоев:</strong> ${stats.hardware_alerts_count || 0}</p>
                    <p><strong>🟢 Активных контейнеров:</strong> ${stats.total_containers - (stats.hardware_alerts_count || 0)}</p>
                </div>
            </div>
            ${stats.top_fastest_filling && stats.top_fastest_filling.length > 0 ? `
                <h6 class="mt-3">🔥 Самые быстрые по наполнению:</h6>
                <ul>
                    ${stats.top_fastest_filling.map(c => `<li>${c.id}: ${c.fill}% (${c.address})</li>`).join('')}
                </ul>
            ` : ''}
        `;
        
        document.getElementById('statsData').innerHTML = statsHtml;
        statsModalInstance.show();
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        alert('Не удалось загрузить статистику');
    }
}

// Закрытие модального окна
function closeStats() {
    statsModalInstance.hide();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация модального окна Bootstrap
    const statsModalEl = document.getElementById('statsModal');
    statsModalInstance = new bootstrap.Modal(statsModalEl);

    // Проверяем доступность Яндекс.Карт API
    if (typeof ymaps !== 'undefined') {
        initMap();
    } else {
        // Если API не загрузился, пробуем снова через 1 секунду
        console.warn('Yandex Maps API not loaded, retrying in 1s...');
        setTimeout(initMap, 1000);
    }
});

// Автоматическое обновление каждые 5 минут
setInterval(loadContainers, 300000);

// Обработка ошибок API
window.addEventListener('error', function(e) {
    if (e.message.includes('ymaps')) {
        console.error('Ошибка загрузки Яндекс.Карт:', e.message);
    }
});
