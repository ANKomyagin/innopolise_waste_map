// JavaScript для страницы мусоровоза

class TruckRoute {
    constructor() {
        this.map = null;
        this.containers = [];
        this.route = null;
        this.currentContainerIndex = 0;
        this.isRouteActive = false;
        this.processedContainers = [];
        
        this.init();
    }

    async init() {
        try {
            // Инициализация карты
            await this.initMap();
            
            // Загрузка контейнеров
            await this.loadContainers();
            
            // Настройка обработчиков
            this.setupEventListeners();
            
            console.log('Маршрут мусоровоза инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации маршрута:', error);
            UIUtils.showNotification('Ошибка загрузки маршрута', 'danger');
        }
    }

    async initMap() {
        this.map = new MapUtils('map', {
            center: [55.753, 48.743],
            zoom: 13
        });
        await this.map.initMap();
    }

    async loadContainers() {
        try {
            await this.map.loadContainers();
            this.containers = this.map.containers;
            
            // Фильтруем контейнеры, требующие вывоза (>70% заполнения)
            this.containers = this.containers.filter(container => 
                container.fill_percent >= 70
            );
            
            // Сортируем по заполненности (убывание) и расстоянию
            this.sortContainersByPriority();
            
            // Обновляем интерфейс
            this.updateContainerList();
            this.updateStats();
            
        } catch (error) {
            console.error('Ошибка загрузки контейнеров:', error);
            throw error;
        }
    }

    sortContainersByPriority() {
        if (this.containers.length === 0) return;

        // Находим центральную точку (первый контейнер или центр города)
        const centerPoint = this.containers.length > 0 
            ? [this.containers[0].latitude, this.containers[0].longitude]
            : [55.753, 48.743];

        // Сортируем по заполненности (убывание), затем по расстоянию
        this.containers.sort((a, b) => {
            if (b.fill_percent !== a.fill_percent) {
                return b.fill_percent - a.fill_percent;
            }
            
            const distanceA = GeoUtils.calculateDistance(
                centerPoint[0], centerPoint[1],
                a.latitude, a.longitude
            );
            const distanceB = GeoUtils.calculateDistance(
                centerPoint[0], centerPoint[1],
                b.latitude, b.longitude
            );
            
            return distanceA - distanceB;
        });
    }

    updateContainerList() {
        const listElement = document.getElementById('containerList');
        if (!listElement) return;

        if (this.containers.length === 0) {
            listElement.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-check-circle fa-3x mb-3"></i>
                    <p>Нет контейнеров, требующих вывоза</p>
                </div>
            `;
            return;
        }

        listElement.innerHTML = this.containers.map((container, index) => `
            <div class="route-item ${index === this.currentContainerIndex ? 'active' : ''}" 
                 data-index="${index}" onclick="truckRoute.selectContainer(${index})">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>🗑️ ${container.id}</strong><br>
                        <small class="text-muted">
                            Расстояние: ${this.getDistanceFromPrevious(container, index).toFixed(2)} км
                        </small><br>
                        <span class="badge ${ContainerUtils.getStatusClass(container.fill_percent)}">
                            ${container.fill_percent}%
                        </span>
                    </div>
                    <div>
                        ${index < this.currentContainerIndex ? 
                            '<i class="fas fa-check-circle text-success"></i>' : 
                            index === this.currentContainerIndex ? 
                            '<i class="fas fa-truck text-primary"></i>' : 
                            '<i class="fas fa-circle text-muted"></i>'
                        }
                    </div>
                </div>
            </div>
        `).join('');
    }

    getDistanceFromPrevious(container, currentIndex) {
        if (currentIndex === 0) {
            return 0; // Расстояние от депо
        }
        
        const previousContainer = this.containers[currentIndex - 1];
        return GeoUtils.calculateDistance(
            previousContainer.latitude, previousContainer.longitude,
            container.latitude, container.longitude
        );
    }

    updateStats() {
        const totalDistance = this.calculateTotalDistance();
        const estimatedTime = Math.round(totalDistance * 5); // 5 минут на км
        
        document.getElementById('totalDistance').textContent = totalDistance.toFixed(1);
        document.getElementById('estimatedTime').textContent = estimatedTime;
        document.getElementById('totalContainers').textContent = this.containers.length;
        document.getElementById('totalCount').textContent = this.containers.length;
        document.getElementById('processedCount').textContent = this.processedContainers.length;
        
        this.updateProgress();
    }

    calculateTotalDistance() {
        if (this.containers.length === 0) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < this.containers.length; i++) {
            totalDistance += this.getDistanceFromPrevious(this.containers[i], i);
        }
        return totalDistance;
    }

    updateProgress() {
        const progress = this.containers.length > 0 
            ? (this.processedContainers.length / this.containers.length) * 100
            : 0;
        
        const progressBar = document.getElementById('routeProgress');
        if (progressBar) {
            progressBar.style.width = progress + '%';
            progressBar.textContent = Math.round(progress) + '%';
        }
    }

    setupEventListeners() {
        // Кнопка начала маршрута
        const startBtn = document.getElementById('startRouteBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startRoute());
        }

        // Кнопка следующего контейнера
        const nextBtn = document.getElementById('nextContainerBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextContainer());
        }

        // Кнопка очистки маршрута
        const clearBtn = document.getElementById('clearRouteBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearRoute());
        }
    }

    async startRoute() {
        if (this.containers.length === 0) {
            UIUtils.showNotification('Нет контейнеров для маршрута', 'warning');
            return;
        }

        try {
            this.isRouteActive = true;
            this.currentContainerIndex = 0;
            this.processedContainers = [];
            
            UIUtils.showNotification('Маршрут начат', 'success');
            
            // Строим полный маршрут
            await this.buildFullRoute();
            
            // Выделяем первый контейнер
            this.selectContainer(0);
            
            // Обновляем кнопку
            const startBtn = document.getElementById('startRouteBtn');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.innerHTML = '<i class="fas fa-play"></i> Маршрут активен';
            }
            
        } catch (error) {
            console.error('Ошибка начала маршрута:', error);
            UIUtils.showNotification('Ошибка начала маршрута', 'danger');
        }
    }

    async buildFullRoute() {
        if (this.containers.length < 2) return;

        // Создаем точки маршрута
        const routePoints = this.containers.map(container => 
            [container.latitude, container.longitude]
        );

        try {
            // Удаляем старый маршрут
            if (this.route) {
                this.map.map.geoObjects.remove(this.route);
            }

            // Создаем мультимаршрут
            const multiRoute = new ymaps.multiRouter.MultiRoute({
                referencePoints: routePoints,
                params: {
                    routingMode: 'auto' // Автомобильный маршрут
                }
            }, {
                wayPointStartIconColor: '#fa709a',
                wayPointFinishIconColor: '#28a745',
                routeActiveStrokeColor: '#fa709a',
                routeActiveStrokeWidth: 4,
                routeStrokeColor: '#ccc',
                routeStrokeWidth: 3
            });

            // Добавляем маршрут на карту
            this.map.map.geoObjects.add(multiRoute);
            this.route = multiRoute;

            // Центрируем карту на маршруте
            multiRoute.model.events.add('requestsuccess', () => {
                const bounds = multiRoute.getBounds();
                if (bounds) {
                    this.map.map.setBounds(bounds, {
                        checkZoomRange: true,
                        zoomMargin: 50
                    });
                }
            });

        } catch (error) {
            console.error('Ошибка построения маршрута:', error);
            UIUtils.showNotification('Ошибка построения маршрута', 'warning');
        }
    }

    selectContainer(index) {
        if (index < 0 || index >= this.containers.length) return;

        this.currentContainerIndex = index;
        const container = this.containers[index];

        // Центрируем карту на контейнере
        this.map.setCenter([container.latitude, container.longitude], 16);

        // Обновляем список
        this.updateContainerList();

        // Показываем информацию о контейнере
        this.showContainerInfo(container);
    }

    showContainerInfo(container) {
        const content = `
            <div>
                <h6>Контейнер ${container.id}</h6>
                <p><strong>Заполненность:</strong> ${container.fill_percent}%</p>
                <p><strong>Координаты:</strong></p>
                <p>Широта: ${container.latitude.toFixed(6)}</p>
                <p>Долгота: ${container.longitude.toFixed(6)}</p>
                <p><strong>Последнее обновление:</strong> ${UIUtils.formatDate(container.last_updated)}</p>
            </div>
        `;

        UIUtils.showModal(`Информация о контейнере ${container.id}`, content);
    }

    async nextContainer() {
        if (!this.isRouteActive) {
            UIUtils.showNotification('Сначала начните маршрут', 'warning');
            return;
        }

        if (this.currentContainerIndex >= this.containers.length) {
            UIUtils.showNotification('Маршрут завершен', 'success');
            this.completeRoute();
            return;
        }

        const currentContainer = this.containers[this.currentContainerIndex];
        
        try {
            // Отмечаем контейнер как обработанный
            this.processedContainers.push(currentContainer);
            
            // Здесь должен быть API запрос для отметки о вывозе
            // await ApiService.markAsCollected(currentContainer.id);
            
            UIUtils.showNotification(
                `Контейнер ${currentContainer.id} отмечен как обработанный`, 
                'success'
            );
            
            // Переходим к следующему контейнеру
            this.currentContainerIndex++;
            
            if (this.currentContainerIndex < this.containers.length) {
                this.selectContainer(this.currentContainerIndex);
            } else {
                this.completeRoute();
            }
            
            // Обновляем статистику
            this.updateStats();
            
        } catch (error) {
            console.error('Ошибка обработки контейнера:', error);
            UIUtils.showNotification('Ошибка обработки контейнера', 'danger');
        }
    }

    completeRoute() {
        this.isRouteActive = false;
        
        UIUtils.showNotification('Маршрут завершен!', 'success');
        
        // Показываем итоговую статистику
        const content = `
            <div class="text-center">
                <i class="fas fa-check-circle text-success fa-4x mb-3"></i>
                <h5>Маршрут завершен</h5>
                <p>Обработано контейнеров: ${this.processedContainers.length}</p>
                <p>Общее расстояние: ${this.calculateTotalDistance().toFixed(1)} км</p>
                <button class="btn btn-primary" onclick="truckRoute.clearRoute()">
                    <i class="fas fa-redo"></i> Новый маршрут
                </button>
            </div>
        `;
        
        UIUtils.showModal('Маршрут завершен', content);
        
        // Обновляем кнопку
        const startBtn = document.getElementById('startRouteBtn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> Начать маршрут';
        }
    }

    clearRoute() {
        this.isRouteActive = false;
        this.currentContainerIndex = 0;
        this.processedContainers = [];
        
        // Удаляем маршрут с карты
        if (this.route) {
            this.map.map.geoObjects.remove(this.route);
            this.route = null;
        }
        
        // Перезагружаем контейнеры
        this.loadContainers();
        
        UIUtils.showNotification('Маршрут очищен', 'info');
        
        // Обновляем кнопку
        const startBtn = document.getElementById('startRouteBtn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> Начать маршрут';
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.truckRoute = new TruckRoute();
});
