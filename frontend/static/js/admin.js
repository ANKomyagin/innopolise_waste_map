// JavaScript для панели администратора

class AdminPanel {
    constructor() {
        this.map = null;
        this.miniMap = null;
        this.containers = [];
        this.isEditMode = false;
        this.editingId = null;
        this.fillChart = null;
        this.topChart = null;
        
        this.init();
    }

    async init() {
        try {
            // Инициализация карт
            await this.initMaps();
            
            // Загрузка данных
            await this.loadData();
            
            // Настройка обработчиков событий
            this.setupEventListeners();
            
            // Инициализация графиков
            this.initCharts();
            
            console.log('Панель администратора инициализирована');
        } catch (error) {
            console.error('Ошибка инициализации панели администратора:', error);
            UIUtils.showNotification('Ошибка загрузки панели администратора', 'danger');
        }
    }

    async initMaps() {
        // Основная карта
        this.map = new MapUtils('map', {
            center: [55.753, 48.743],
            zoom: 13
        });
        await this.map.initMap();
        
        // Миникарта для модального окна
        this.miniMap = new MapUtils('miniMap', {
            center: [55.753, 48.743],
            zoom: 15,
            controls: []
        });
    }

    async loadData() {
        try {
            // Загрузка контейнеров
            await this.map.loadContainers();
            this.containers = this.map.containers;
            
            // Обновление статистики
            await this.updateStats();
            
            // Обновление таблицы контейнеров
            this.updateContainersTable();
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            throw error;
        }
    }

    async updateStats() {
        try {
            const stats = await ApiService.getStats();
            this.updateStatsDisplay(stats);
            this.updateCharts(stats);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    updateStatsDisplay(stats) {
        const elements = {
            'totalContainers': stats.total_containers || 0,
            'avgFill': stats.avg_fill_percent || 0,
            'fullContainers': stats.full_containers || 0,
            'emptyContainers': stats.empty_containers || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    initCharts() {
        // График заполненности
        const fillCtx = document.getElementById('fillChart');
        if (fillCtx) {
            this.fillChart = new Chart(fillCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Пустые', 'Средне заполнены', 'Заполнены'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#28a745', '#ffc107', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        // График топ контейнеров
        const topCtx = document.getElementById('topChart');
        if (topCtx) {
            this.topChart = new Chart(topCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Заполненность (%)',
                        data: [],
                        backgroundColor: '#fa709a'
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
    }

    updateCharts(stats) {
        // Обновление графика заполненности
        if (this.fillChart && stats.fill_distribution) {
            this.fillChart.data.datasets[0].data = [
                stats.fill_distribution.empty || 0,
                stats.fill_distribution.medium || 0,
                stats.fill_distribution.full || 0
            ];
            this.fillChart.update();
        }

        // Обновление топ контейнеров
        if (this.topChart && stats.top_containers) {
            const topContainers = stats.top_containers.slice(0, 5);
            this.topChart.data.labels = topContainers.map(c => c.id);
            this.topChart.data.datasets[0].data = topContainers.map(c => c.fill_percent);
            this.topChart.update();
        }
    }

    updateContainersTable() {
        const tbody = document.getElementById('containersTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.containers.map(container => `
            <tr>
                <td>${container.id}</td>
                <td>
                    <span class="badge ${ContainerUtils.getStatusClass(container.fill_percent)}">
                        ${container.fill_percent}%
                    </span>
                </td>
                <td>${container.latitude.toFixed(6)}</td>
                <td>${container.longitude.toFixed(6)}</td>
                <td>${UIUtils.formatDate(container.last_updated)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="adminPanel.editContainer('${container.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.deleteContainer('${container.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    setupEventListeners() {
        // Кнопка добавления контейнера
        const addBtn = document.getElementById('addContainerBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddContainerModal());
        }

        // Кнопка обновления
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Форма добавления/редактирования контейнера
        const form = document.getElementById('containerForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleContainerForm(e));
        }
    }

    showAddContainerModal() {
        const content = `
            <form id="containerForm">
                <div class="mb-3">
                    <label class="form-label">ID контейнера</label>
                    <input type="text" class="form-control" id="containerId" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Широта</label>
                    <input type="number" step="0.000001" class="form-control" id="containerLat" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Долгота</label>
                    <input type="number" step="0.000001" class="form-control" id="containerLon" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Заполненность (%)</label>
                    <input type="number" min="0" max="100" class="form-control" id="containerFill" required>
                </div>
                <div class="mb-3">
                    <div id="miniMap" style="height: 300px; border-radius: 8px;"></div>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
            <button type="button" class="btn btn-primary" onclick="adminPanel.saveContainer()">Сохранить</button>
        `;

        UIUtils.showModal('Добавить контейнер', content, { footer });

        // Инициализация миникарты
        setTimeout(() => {
            this.initMiniMap();
            this.setupMapClick();
        }, 500);
    }

    async initMiniMap() {
        if (this.miniMap) {
            await this.miniMap.initMap();
        }
    }

    setupMapClick() {
        if (this.miniMap && this.miniMap.map) {
            this.miniMap.map.events.add('click', (e) => {
                const coords = e.get('coords');
                document.getElementById('containerLat').value = coords[0].toFixed(6);
                document.getElementById('containerLon').value = coords[1].toFixed(6);
                
                // Добавляем временную метку
                const tempPlacemark = new ymaps.Placemark(coords, {
                    balloonContentHeader: 'Новый контейнер'
                }, {
                    preset: 'islands#greenDotIcon'
                });
                
                this.miniMap.map.geoObjects.removeAll();
                this.miniMap.map.geoObjects.add(tempPlacemark);
            });
        }
    }

    editContainer(containerId) {
        const container = this.containers.find(c => c.id === containerId);
        if (!container) return;

        this.editingId = containerId;
        
        // Заполняем форму данными
        document.getElementById('containerId').value = container.id;
        document.getElementById('containerLat').value = container.latitude;
        document.getElementById('containerLon').value = container.longitude;
        document.getElementById('containerFill').value = container.fill_percent;

        // Показываем модальное окно
        this.showAddContainerModal();
    }

    async saveContainer() {
        const formData = {
            id: document.getElementById('containerId').value,
            latitude: parseFloat(document.getElementById('containerLat').value),
            longitude: parseFloat(document.getElementById('containerLon').value),
            fill_percent: parseInt(document.getElementById('containerFill').value)
        };

        try {
            UIUtils.showNotification('Сохранение контейнера...', 'info');
            
            // Здесь должен быть API запрос для сохранения
            // await ApiService.saveContainer(formData);
            
            UIUtils.showNotification('Контейнер сохранен', 'success');
            
            // Закрываем модальное окно
            const modal = document.querySelector('.modal.show');
            if (modal) {
                bootstrap.Modal.getInstance(modal).hide();
            }
            
            // Обновляем данные
            await this.loadData();
            
        } catch (error) {
            console.error('Ошибка сохранения контейнера:', error);
            UIUtils.showNotification('Ошибка сохранения контейнера', 'danger');
        }
    }

    async deleteContainer(containerId) {
        if (!confirm('Вы уверены, что хотите удалить этот контейнер?')) {
            return;
        }

        try {
            UIUtils.showNotification('Удаление контейнера...', 'info');
            
            // Здесь должен быть API запрос для удаления
            // await ApiService.deleteContainer(containerId);
            
            UIUtils.showNotification('Контейнер удален', 'success');
            await this.loadData();
            
        } catch (error) {
            console.error('Ошибка удаления контейнера:', error);
            UIUtils.showNotification('Ошибка удаления контейнера', 'danger');
        }
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Обновление...';
        }

        try {
            await this.loadData();
            UIUtils.showNotification('Данные обновлены', 'success');
        } catch (error) {
            UIUtils.showNotification('Ошибка обновления данных', 'danger');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Обновить';
            }
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});
