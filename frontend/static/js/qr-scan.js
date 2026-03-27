// JavaScript для страницы QR сканирования

class QRScanner {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.scanning = false;
        this.stream = null;
        this.deviceId = null;
        
        this.init();
    }

    async init() {
        try {
            // Получаем параметры из URL
            this.getURLParams();
            
            // Инициализация элементов
            this.initElements();
            
            // Настройка обработчиков
            this.setupEventListeners();
            
            // Загружаем сохраненный ID устройства
            this.loadDeviceId();
            
            // Если есть ID контейнера в URL, показываем информацию
            if (this.containerId) {
                this.showContainerInfo(this.containerId);
            } else {
                // Запускаем сканирование
                await this.startScanning();
            }
            
            console.log('QR сканер инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации QR сканера:', error);
            UIUtils.showNotification('Ошибка инициализации камеры', 'danger');
        }
    }

    getURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.containerId = urlParams.get('id');
        this.scannedResult = urlParams.get('result');
    }

    initElements() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.context = this.canvas ? this.canvas.getContext('2d') : null;
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.resultElement = document.getElementById('result');
        this.messageElement = document.getElementById('message');
        this.deviceIdInput = document.getElementById('deviceId');
    }

    setupEventListeners() {
        // Кнопки управления
        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.startScanning());
        }
        
        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stopScanning());
        }

        // Ручной ввод ID устройства
        if (this.deviceIdInput) {
            this.deviceIdInput.addEventListener('change', () => {
                this.deviceId = this.deviceIdInput.value;
                this.saveDeviceId();
            });
        }

        // Кнопка ручного ввода QR кода
        const manualInputBtn = document.getElementById('manualInputBtn');
        if (manualInputBtn) {
            manualInputBtn.addEventListener('click', () => this.showManualInput());
        }

        // Кнопка возврата
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.history.back();
            });
        }
    }

    loadDeviceId() {
        const savedDeviceId = localStorage.getItem('deviceId');
        if (savedDeviceId) {
            this.deviceId = savedDeviceId;
            if (this.deviceIdInput) {
                this.deviceIdInput.value = savedDeviceId;
            }
        }
    }

    saveDeviceId() {
        if (this.deviceId) {
            localStorage.setItem('deviceId', this.deviceId);
        }
    }

    async startScanning() {
        try {
            UIUtils.showNotification('Включение камеры...', 'info');
            
            // Запрашиваем доступ к камере
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            
            // Подключаем видео поток
            if (this.video) {
                this.video.srcObject = this.stream;
                this.video.play();
            }
            
            this.scanning = true;
            this.updateUI();
            
            // Запускаем сканирование
            this.scanFrame();
            
            UIUtils.showNotification('Камера включена', 'success');
            
        } catch (error) {
            console.error('Ошибка доступа к камере:', error);
            UIUtils.showNotification('Не удалось получить доступ к камере', 'danger');
            this.showManualInput();
        }
    }

    stopScanning() {
        this.scanning = false;
        
        // Останавливаем видео поток
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
        
        this.updateUI();
        UIUtils.showNotification('Сканирование остановлено', 'info');
    }

    scanFrame() {
        if (!this.scanning || !this.video || !this.canvas || !this.context) {
            return;
        }

        // Устанавливаем размеры canvas
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        // Рисуем текущий кадр
        this.context.drawImage(this.video, 0, 0);
        
        // Получаем данные изображения
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Здесь должна быть библиотека для сканирования QR кодов
        // Для примера используем симуляцию
        this.simulateQRScan(imageData);
        
        // Продолжаем сканирование
        requestAnimationFrame(() => this.scanFrame());
    }

    simulateQRScan(imageData) {
        // Симуляция сканирования QR кода
        // В реальном приложении здесь будет использоваться библиотека типа jsQR
        
        // Для демонстрации: случайным образом "находим" QR код
        if (Math.random() < 0.001) { // 0.1% шанс найти QR код
            const mockQRCode = 'CONTAINER_' + Math.floor(Math.random() * 1000);
            this.onQRCodeDetected(mockQRCode);
        }
    }

    async onQRCodeDetected(qrCode) {
        try {
            UIUtils.showNotification('QR код обнаружен: ' + qrCode, 'success');
            
            // Останавливаем сканирование
            this.stopScanning();
            
            // Проверяем формат QR кода
            if (qrCode.startsWith('CONTAINER_')) {
                const containerId = qrCode.replace('CONTAINER_', '');
                await this.processContainerScan(containerId);
            } else {
                this.showResult('Неизвестный формат QR кода', 'warning');
            }
            
        } catch (error) {
            console.error('Ошибка обработки QR кода:', error);
            UIUtils.showNotification('Ошибка обработки QR кода', 'danger');
        }
    }

    async processContainerScan(containerId) {
        try {
            UIUtils.showNotification('Обработка контейнера...', 'info');
            
            // Отправляем запрос на API
            const result = await ApiService.scanContainer(containerId);
            
            // Показываем результат
            this.showScanResult(containerId, result);
            
            // Сохраняем в истории
            this.saveToHistory(containerId, result);
            
        } catch (error) {
            console.error('Ошибка сканирования контейнера:', error);
            this.showResult('Ошибка сканирования контейнера', 'danger');
        }
    }

    showScanResult(containerId, result) {
        const success = result.success || false;
        const message = result.message || 'Результат сканирования';
        
        const content = `
            <div class="scan-result ${success ? 'success' : 'error'}">
                <div class="result-icon">
                    <i class="fas ${success ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
                </div>
                <h5>Контейнер ${containerId}</h5>
                <p>${message}</p>
                ${result.fill_percent ? `<p>Заполненность: ${result.fill_percent}%</p>` : ''}
                ${result.points ? `<p>Начислено баллов: ${result.points}</p>` : ''}
                <div class="mt-3">
                    <button class="btn btn-primary" onclick="qrScanner.startScanning()">
                        <i class="fas fa-camera"></i> Сканировать еще
                    </button>
                    <button class="btn btn-secondary ms-2" onclick="qrScanner.showHistory()">
                        <i class="fas fa-history"></i> История
                    </button>
                </div>
            </div>
        `;
        
        if (this.resultElement) {
            this.resultElement.innerHTML = content;
        }
    }

    showContainerInfo(containerId) {
        const content = `
            <div class="container-info">
                <h5>Информация о контейнере ${containerId}</h5>
                <div class="info-item">
                    <i class="fas fa-qrcode"></i>
                    <span>QR код: CONTAINER_${containerId}</span>
                </div>
                <div class="mt-3">
                    <button class="btn btn-primary" onclick="qrScanner.processContainerScan('${containerId}')">
                        <i class="fas fa-check"></i> Отметить как обработанный
                    </button>
                    <button class="btn btn-secondary ms-2" onclick="qrScanner.startScanning()">
                        <i class="fas fa-camera"></i> Сканер
                    </button>
                </div>
            </div>
        `;
        
        if (this.resultElement) {
            this.resultElement.innerHTML = content;
        }
    }

    showManualInput() {
        const content = `
            <div class="manual-input">
                <h5>Ручной ввод QR кода</h5>
                <form id="manualQRForm">
                    <div class="mb-3">
                        <label class="form-label">ID контейнера</label>
                        <input type="text" class="form-control" id="manualContainerId" 
                               placeholder="Например: 123" required>
                        <small class="text-muted">Введите номер контейнера или полный QR код</small>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">ID устройства (опционально)</label>
                        <input type="text" class="form-control" id="manualDeviceId" 
                               placeholder="ID вашего устройства">
                    </div>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-check"></i> Обработать
                    </button>
                    <button type="button" class="btn btn-secondary ms-2" onclick="qrScanner.startScanning()">
                        <i class="fas fa-camera"></i> Использовать камеру
                    </button>
                </form>
            </div>
        `;
        
        if (this.resultElement) {
            this.resultElement.innerHTML = content;
        }
        
        // Обработчик формы
        const form = document.getElementById('manualQRForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const containerId = document.getElementById('manualContainerId').value;
                const deviceId = document.getElementById('manualDeviceId').value;
                
                if (deviceId) {
                    this.deviceId = deviceId;
                    this.saveDeviceId();
                }
                
                this.processContainerScan(containerId);
            });
        }
    }

    saveToHistory(containerId, result) {
        const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        history.unshift({
            containerId,
            result,
            timestamp: new Date().toISOString(),
            deviceId: this.deviceId
        });
        
        // Оставляем только последние 50 записей
        if (history.length > 50) {
            history.pop();
        }
        
        localStorage.setItem('scanHistory', JSON.stringify(history));
    }

    showHistory() {
        const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        
        if (history.length === 0) {
            UIUtils.showModal('История сканирования', '<p>История пуста</p>');
            return;
        }
        
        const content = `
            <div class="scan-history">
                <h5>История сканирования (${history.length})</h5>
                <div class="history-list">
                    ${history.map((item, index) => `
                        <div class="history-item">
                            <div class="d-flex justify-content-between">
                                <div>
                                    <strong>Контейнер ${item.containerId}</strong><br>
                                    <small class="text-muted">
                                        ${UIUtils.formatDate(item.timestamp)}
                                        ${item.deviceId ? ` • Устройство: ${item.deviceId}` : ''}
                                    </small>
                                </div>
                                <div>
                                    <span class="badge ${item.result.success ? 'bg-success' : 'bg-danger'}">
                                        ${item.result.success ? 'Успешно' : 'Ошибка'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-danger" onclick="qrScanner.clearHistory()">
                        <i class="fas fa-trash"></i> Очистить историю
                    </button>
                </div>
            </div>
        `;
        
        UIUtils.showModal('История сканирования', content);
    }

    clearHistory() {
        if (confirm('Вы уверены, что хотите очистить историю?')) {
            localStorage.removeItem('scanHistory');
            UIUtils.showNotification('История очищена', 'success');
            // Закрываем модальное окно
            const modal = document.querySelector('.modal.show');
            if (modal) {
                bootstrap.Modal.getInstance(modal).hide();
            }
        }
    }

    showResult(message, type = 'info') {
        if (this.messageElement) {
            this.messageElement.className = `message ${type}`;
            this.messageElement.textContent = message;
        }
    }

    updateUI() {
        if (this.startButton) {
            this.startButton.disabled = this.scanning;
        }
        
        if (this.stopButton) {
            this.stopButton.disabled = !this.scanning;
        }
        
        if (this.video) {
            this.video.style.display = this.scanning ? 'block' : 'none';
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.qrScanner = new QRScanner();
});
