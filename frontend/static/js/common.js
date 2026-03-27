// Общие утилиты и функции для всех страниц

// API конфигурация
const API_CONFIG = {
    baseUrl: '/api',
    endpoints: {
        map: '/map/geojson',
        containers: '/containers',
        stats: '/stats',
        scan: '/scan'
    }
};

// Класс для работы с API
class ApiService {
    static async request(endpoint, options = {}) {
        const url = `${API_CONFIG.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    static async getMapData() {
        return this.request(API_CONFIG.endpoints.map);
    }

    static async getContainers() {
        return this.request(API_CONFIG.endpoints.containers);
    }

    static async getStats() {
        return this.request(API_CONFIG.endpoints.stats);
    }

    static async scanContainer(containerId) {
        return this.request(`${API_CONFIG.endpoints.scan}/${containerId}`, {
            method: 'POST'
        });
    }
}

// Утилиты для работы с контейнерами
class ContainerUtils {
    static getFillColor(fillPercent) {
        if (fillPercent >= 70) return '#dc3545'; // Красный
        if (fillPercent >= 50) return '#ffc107'; // Желтый
        return '#28a745'; // Зеленый
    }

    static getStatusText(fillPercent) {
        if (fillPercent >= 70) return 'Заполнен';
        if (fillPercent >= 50) return 'Средне заполнен';
        return 'Мало заполнен';
    }

    static getStatusClass(fillPercent) {
        if (fillPercent >= 70) return 'status-high';
        if (fillPercent >= 50) return 'status-medium';
        return 'status-low';
    }

    static formatContainerInfo(container) {
        return `
            <div style="padding: 8px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; border-left: 3px solid ${this.getFillColor(container.fill_percent)};">
                <strong>🗑️ ${container.id}</strong><br>
                Заполнение: <strong>${container.fill_percent}%</strong><br>
                Статус: <span class="badge ${this.getStatusClass(container.fill_percent)}">${this.getStatusText(container.fill_percent)}</span>
            </div>
        `;
    }

    static createContainerIcon(fillPercent, containerCount = 1, size = 60) {
        const fillColor = this.getFillColor(fillPercent);
        
        return `
            <svg width="${size}" height="${size}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
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
                ${containerCount > 1 ? `
                    <circle cx="46" cy="14" r="10" fill="#ff6b6b" stroke="white" stroke-width="2.5"/>
                    <text x="46" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${containerCount}</text>
                ` : ''}
            </svg>
        `;
    }
}

// Утилиты для работы с геолокацией
class GeoUtils {
    static async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Геолокация не поддерживается браузером'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => resolve(position),
                error => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 минут кэша
                }
            );
        });
    }

    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Радиус Земли в км
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                 Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    static toRad(deg) {
        return deg * (Math.PI/180);
    }
}

// Утилиты для работы с UI
class UIUtils {
    static showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Автоматическое закрытие через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    static showModal(title, content, options = {}) {
        const modalId = 'dynamicModal_' + Date.now();
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        // Удаление модального окна после закрытия
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
        
        return modalInstance;
    }

    static showLoading(element, text = 'Загрузка...') {
        element.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height: 200px;">
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">${text}</span>
                    </div>
                    <div class="mt-2">${text}</div>
                </div>
            </div>
        `;
    }

    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Глобальные обработчики ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    UIUtils.showNotification('Произошла ошибка. Пожалуйста, обновите страницу.', 'danger');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    UIUtils.showNotification('Произошла ошибка при загрузке данных.', 'warning');
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('Common utilities loaded');
});
