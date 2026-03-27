// JavaScript для страницы жителя

class ResidentMap {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.userPlacemark = null;
        this.containers = [];
        this.route = null;
        
        this.init();
    }

    async init() {
        try {
            // Инициализация карты
            await this.initMap();
            
            // Определение местоположения пользователя
            await this.findUserLocation();
            
            // Загрузка контейнеров
            await this.loadContainers();
            
            // Настройка обработчиков
            this.setupEventListeners();
            
            console.log('Карта жителя инициализирована');
        } catch (error) {
            console.error('Ошибка инициализации карты жителя:', error);
            UIUtils.showNotification('Ошибка загрузки карты', 'danger');
        }
    }

    async initMap() {
        this.map = new MapUtils('map', {
            center: [55.753, 48.743],
            zoom: 13
        });
        await this.map.initMap();
    }

    async findUserLocation() {
        try {
            UIUtils.showNotification('Определение местоположения...', 'info');
            
            const position = await GeoUtils.getCurrentPosition();
            this.userLocation = [position.coords.latitude, position.coords.longitude];
            
            // Устанавливаем метку пользователя
            this.setUserPlacemark();
            
            // Центрируем карту на пользователе
            this.map.setCenter(this.userLocation, 15);
            
            // Показываем ближайшие контейнеры
            this.showNearestContainers();
            
            UIUtils.showNotification('Местоположение определено', 'success');
        } catch (error) {
            console.error('Ошибка определения местоположения:', error);
            UIUtils.showNotification('Не удалось определить местоположение', 'warning');
        }
    }

    setUserPlacemark() {
        if (!this.userLocation) return;

        // Удаляем старую метку
        if (this.userPlacemark) {
            this.map.map.geoObjects.remove(this.userPlacemark);
        }
        
        // Создаем новую метку пользователя
        this.userPlacemark = new ymaps.Placemark(this.userLocation, {
            balloonContentHeader: 'Ваше местоположение',
            balloonContentBody: 'Вы находитесь здесь'
        }, {
            preset: 'islands#blueDotIcon',
            iconColor: '#1e90ff'
        });
        
        this.map.map.geoObjects.add(this.userPlacemark);
    }

    async loadContainers() {
        try {
            await this.map.loadContainers();
            this.containers = this.map.containers;
            
            // Показываем маршруты к ближайшим контейнерам
            this.showRoutesToNearestContainers();
            
        } catch (error) {
            console.error('Ошибка загрузки контейнеров:', error);
            throw error;
        }
    }

    showNearestContainers() {
        const nearest = this.map.findNearestContainers(3); // 3 ближайших контейнера
        
        if (nearest.length === 0) {
            UIUtils.showNotification('Ближайшие контейнеры не найдены', 'info');
            return;
        }
        
        // Обновляем панель с ближайшими контейнерами
        this.updateNearestPanel(nearest);
    }

    updateNearestPanel(nearest) {
        const panel = document.getElementById('nearestContainers');
        if (!panel) return;

        panel.innerHTML = `
            <h6>Ближайшие контейнеры</h6>
            ${nearest.map((container, index) => `
                <div class="nearest-container-item" data-container-id="${container.id}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>🗑️ ${container.id}</strong><br>
                            <small class="text-muted">Расстояние: ${container.distance.toFixed(2)} км</small><br>
                            <span class="badge ${ContainerUtils.getStatusClass(container.fill_percent)}">
                                ${container.fill_percent}%
                            </span>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary" onclick="residentMap.showRoute(${container.latitude}, ${container.longitude}, '${container.id}')">
                                <i class="fas fa-directions"></i> Маршрут
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        `;
    }

    showRoutesToNearestContainers() {
        if (!this.userLocation) return;

        const nearest = this.map.findNearestContainers(2); // Показываем маршрут к 2 ближайшим
        
        nearest.forEach(container => {
            this.showRoute(container.latitude, container.longitude, container.id, false);
        });
    }

    async showRoute(lat, lon, containerId, showNotification = true) {
        if (!this.userLocation) {
            UIUtils.showNotification('Сначала определите ваше местоположение', 'warning');
            return;
        }

        try {
            // Удаляем старый маршрут
            if (this.route) {
                this.map.map.geoObjects.remove(this.route);
            }

            // Создаем мультимаршрут
            const multiRoute = new ymaps.multiRouter.MultiRoute({
                referencePoints: [
                    this.userLocation,
                    [lat, lon]
                ],
                params: {
                    routingMode: 'pedestrian' // Пешеходный маршрут
                }
            }, {
                wayPointStartIconColor: '#1e90ff',
                wayPointFinishIconColor: '#28a745',
                routeActiveStrokeColor: '#1e90ff',
                routeActiveStrokeWidth: 4
            });

            // Добавляем маршрут на карту
            this.map.map.geoObjects.add(multiRoute);
            this.route = multiRoute;

            // Обработчик построения маршрута
            multiRoute.model.events.add('requestsuccess', () => {
                const routes = multiRoute.getRoutes();
                if (routes.getLength() > 0) {
                    const route = routes.get(0);
                    const distance = route.properties.get('distance').text;
                    const duration = route.properties.get('duration').text;
                    
                    if (showNotification) {
                        UIUtils.showNotification(
                            `Маршрут к контейнеру ${containerId}: ${distance}, ${duration}`, 
                            'success'
                        );
                    }
                    
                    // Показываем информацию о маршруте
                    this.showRouteInfo(containerId, distance, duration);
                }
            });

            // Обработчик ошибок
            multiRoute.model.events.add('requestfail', () => {
                UIUtils.showNotification('Не удалось построить маршрут', 'warning');
            });

        } catch (error) {
            console.error('Ошибка построения маршрута:', error);
            UIUtils.showNotification('Ошибка построения маршрута', 'danger');
        }
    }

    showRouteInfo(containerId, distance, duration) {
        const infoPanel = document.getElementById('routeInfo');
        if (!infoPanel) return;

        infoPanel.innerHTML = `
            <div class="alert alert-info">
                <h6>Маршрут к контейнеру ${containerId}</h6>
                <div class="d-flex justify-content-between">
                    <span><i class="fas fa-route"></i> ${distance}</span>
                    <span><i class="fas fa-clock"></i> ${duration}</span>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Кнопка обновления местоположения
        const locationBtn = document.getElementById('updateLocationBtn');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => {
                this.findUserLocation();
            });
        }

        // Кнопка поиска ближайших
        const findBtn = document.getElementById('findNearestBtn');
        if (findBtn) {
            findBtn.addEventListener('click', () => {
                this.showNearestContainers();
            });
        }

        // Кнопка очистки маршрутов
        const clearBtn = document.getElementById('clearRoutesBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearRoutes();
            });
        }

        // Фильтр по заполненности
        const filterSelect = document.getElementById('fillFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterContainers(e.target.value);
            });
        }
    }

    filterContainers(fillLevel) {
        // Очищаем текущие объекты
        this.map.clearObjects();
        
        // Фильтруем контейнеры
        let filteredContainers = this.containers;
        
        if (fillLevel !== 'all') {
            const minFill = fillLevel === 'high' ? 70 : fillLevel === 'medium' ? 50 : 0;
            const maxFill = fillLevel === 'low' ? 49 : fillLevel === 'medium' ? 69 : 100;
            
            filteredContainers = this.containers.filter(c => 
                c.fill_percent >= minFill && c.fill_percent <= maxFill
            );
        }

        // Создаем GeoJSON с отфильтрованными контейнерами
        const geoJsonData = this.createGeoJsonFromContainers(filteredContainers);
        
        // Добавляем отфильтрованные контейнеры на карту
        if (geoJsonData.features.length > 0) {
            geoJsonData.features.forEach(feature => {
                this.map.addContainerFeature(feature);
            });
        }

        UIUtils.showNotification(`Показано ${filteredContainers.length} контейнеров`, 'info');
    }

    createGeoJsonFromContainers(containers) {
        const features = containers.map(container => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [container.latitude, container.longitude]
            },
            properties: {
                containers: [container],
                container_count: 1,
                is_cluster: false,
                avg_fill_percent: container.fill_percent
            }
        }));

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    clearRoutes() {
        if (this.route) {
            this.map.map.geoObjects.remove(this.route);
            this.route = null;
        }

        const infoPanel = document.getElementById('routeInfo');
        if (infoPanel) {
            infoPanel.innerHTML = '';
        }

        UIUtils.showNotification('Маршруты очищены', 'info');
    }

    // Метод для сканирования QR кода
    scanQRCode() {
        window.location.href = 'qr_scan.html';
    }

    // Метод для показа информации о контейнере
    showContainerInfo(containerId) {
        const container = this.containers.find(c => c.id === containerId);
        if (!container) return;

        const content = `
            <div>
                <h6>Контейнер ${container.id}</h6>
                <p><strong>Заполненность:</strong> ${container.fill_percent}%</p>
                <p><strong>Координаты:</strong></p>
                <p>Широта: ${container.latitude.toFixed(6)}</p>
                <p>Долгота: ${container.longitude.toFixed(6)}</p>
                <p><strong>Последнее обновление:</strong> ${UIUtils.formatDate(container.last_updated)}</p>
                <div class="mt-3">
                    <button class="btn btn-primary" onclick="residentMap.showRoute(${container.latitude}, ${container.longitude}, '${container.id}')">
                        <i class="fas fa-directions"></i> Построить маршрут
                    </button>
                </div>
            </div>
        `;

        UIUtils.showModal(`Информация о контейнере ${container.id}`, content);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.residentMap = new ResidentMap();
});
