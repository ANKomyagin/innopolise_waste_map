// Утилиты для работы с Яндекс.Картами

class MapUtils {
    constructor(mapContainerId, options = {}) {
        this.mapContainer = document.getElementById(mapContainerId);
        this.map = null;
        this.objects = [];
        this.containers = [];
        this.userLocation = null;
        this.userPlacemark = null;
        
        this.defaultOptions = {
            center: [55.753, 48.743], // Иннополис
            zoom: 13,
            controls: ['zoomControl', 'typeSelector', 'fullscreenControl'],
            ...options
        };
    }

    async initMap() {
        try {
            await this.waitForYandexMaps();
            
            this.map = new ymaps.Map(this.mapContainer, this.defaultOptions);
            
            // Добавляем элементы управления
            this.addControls();
            
            // Обработчики событий
            this.setupEventListeners();
            
            console.log('Карта успешно инициализирована');
            return this.map;
        } catch (error) {
            console.error('Ошибка инициализации карты:', error);
            throw error;
        }
    }

    waitForYandexMaps() {
        return new Promise((resolve, reject) => {
            if (window.ymaps) {
                ymaps.ready(resolve);
            } else {
                // Если API еще не загружен, ждем
                let attempts = 0;
                const maxAttempts = 50;
                
                const checkYandexMaps = () => {
                    attempts++;
                    if (window.ymaps) {
                        ymaps.ready(resolve);
                    } else if (attempts < maxAttempts) {
                        setTimeout(checkYandexMaps, 100);
                    } else {
                        reject(new Error('Не удалось загрузить Яндекс.Карты'));
                    }
                };
                
                checkYandexMaps();
            }
        });
    }

    addControls() {
        // Кнопка геолокации
        const geolocationButton = new ymaps.control.Button({
            data: {
                content: '<i class="fas fa-location-arrow"></i>',
                title: 'Мое местоположение'
            },
            options: {
                maxWidth: 30,
                float: 'right'
            }
        });
        
        geolocationButton.events.add('click', () => {
            this.findUserLocation();
        });
        
        this.map.controls.add(geolocationButton);
    }

    setupEventListeners() {
        // Обработчик изменения размера карты
        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.container.fitToViewport();
            }
        });
    }

    async findUserLocation() {
        try {
            UIUtils.showNotification('Определение местоположения...', 'info');
            
            const position = await GeoUtils.getCurrentPosition();
            const coords = [position.coords.latitude, position.coords.longitude];
            
            this.userLocation = coords;
            
            // Устанавливаем метку пользователя
            this.setUserPlacemark(coords);
            
            // Центрируем карту на пользователе
            this.map.setCenter(coords, 15);
            
            UIUtils.showNotification('Местоположение определено', 'success');
        } catch (error) {
            console.error('Ошибка определения местоположения:', error);
            UIUtils.showNotification('Не удалось определить местоположение', 'warning');
        }
    }

    setUserPlacemark(coords) {
        // Удаляем старую метку
        if (this.userPlacemark) {
            this.map.geoObjects.remove(this.userPlacemark);
        }
        
        // Создаем новую метку
        this.userPlacemark = new ymaps.Placemark(coords, {
            balloonContentHeader: 'Ваше местоположение',
            balloonContentBody: 'Вы находитесь здесь'
        }, {
            preset: 'islands#blueDotIcon'
        });
        
        this.map.geoObjects.add(this.userPlacemark);
    }

    async loadContainers() {
        try {
            UIUtils.showNotification('Загрузка контейнеров...', 'info');
            
            const data = await ApiService.getMapData();
            
            if (!data || !data.features) {
                throw new Error('Неверный формат данных');
            }
            
            // Очищаем старые объекты
            this.clearObjects();
            
            // Добавляем новые контейнеры
            this.containers = [];
            data.features.forEach(feature => {
                this.addContainerFeature(feature);
            });
            
            UIUtils.showNotification(`Загружено ${data.features.length} объектов`, 'success');
        } catch (error) {
            console.error('Ошибка загрузки контейнеров:', error);
            UIUtils.showNotification('Ошибка загрузки контейнеров', 'danger');
        }
    }

    addContainerFeature(feature) {
        const coords = feature.geometry.coordinates;
        const props = feature.properties;
        
        if (!props.containers || props.containers.length === 0) return;
        
        // Добавляем все контейнеры из кластера в список
        props.containers.forEach(c => {
            this.containers.push(c);
        });
        
        // Определяем цвет на основе среднего заполнения
        const avgFill = props.is_cluster ? props.avg_fill_percent : props.containers[0].fill_percent;
        const fillColor = ContainerUtils.getFillColor(avgFill);
        
        // Создаем иконку
        const containerCount = props.container_count;
        const iconSvg = ContainerUtils.createContainerIcon(avgFill, containerCount);
        
        // Создаем содержимое балуна
        const containersList = props.containers.map(c => 
            ContainerUtils.formatContainerInfo(c)
        ).join('');
        
        const balloonContent = `
            <div style="max-width: 300px;">
                <h6>Контейнеры (${props.containers.length})</h6>
                ${containersList}
                ${props.is_cluster ? '<div class="mt-2"><small class="text-muted">Кластер контейнеров</small></div>' : ''}
            </div>
        `;
        
        // Создаем метку
        const placemark = new ymaps.Placemark(coords, {
            balloonContentHeader: `Контейнеры (${props.containers.length})`,
            balloonContentBody: balloonContent,
            hintContent: `Контейнеры: ${props.containers.length}`
        }, {
            iconLayout: 'default#image',
            iconImageHref: 'data:image/svg+xml;base64,' + btoa(iconSvg),
            iconImageSize: [60, 60],
            iconImageOffset: [-30, -30]
        });
        
        this.map.geoObjects.add(placemark);
        this.objects.push(placemark);
    }

    clearObjects() {
        this.objects.forEach(obj => {
            this.map.geoObjects.remove(obj);
        });
        this.objects = [];
        this.containers = [];
    }

    findNearestContainers(maxDistance = 5) {
        if (!this.userLocation || this.containers.length === 0) {
            return [];
        }
        
        const [userLat, userLon] = this.userLocation;
        
        return this.containers
            .map(container => {
                const distance = GeoUtils.calculateDistance(
                    userLat, userLon,
                    container.latitude, container.longitude
                );
                return { ...container, distance };
            })
            .filter(container => container.distance <= maxDistance)
            .sort((a, b) => a.distance - b.distance);
    }

    showNearestContainers() {
        const nearest = this.findNearestContainers();
        
        if (nearest.length === 0) {
            UIUtils.showNotification('Ближайшие контейнеры не найдены', 'info');
            return;
        }
        
        const content = `
            <div>
                <h6>Ближайшие контейнеры (в радиусе 5 км)</h6>
                ${nearest.map(container => `
                    <div class="mb-2 p-2 border rounded">
                        <strong>🗑️ ${container.id}</strong><br>
                        <small>Расстояние: ${container.distance.toFixed(2)} км</small><br>
                        <small>Заполнение: ${container.fill_percent}%</small>
                    </div>
                `).join('')}
            </div>
        `;
        
        UIUtils.showModal('Ближайшие контейнеры', content);
    }

    fitToObjects() {
        if (this.objects.length === 0) return;
        
        const bounds = this.map.geoObjects.getBounds();
        if (bounds) {
            this.map.setBounds(bounds, {
                checkZoomRange: true,
                zoomMargin: 50
            });
        }
    }

    setCenter(coords, zoom) {
        this.map.setCenter(coords, zoom);
    }

    getCenter() {
        return this.map.getCenter();
    }

    getZoom() {
        return this.map.getZoom();
    }

    destroy() {
        if (this.map) {
            this.map.destroy();
            this.map = null;
        }
    }
}

// Экспорт для использования в других модулях
window.MapUtils = MapUtils;
