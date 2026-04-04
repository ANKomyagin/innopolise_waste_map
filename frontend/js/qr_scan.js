document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const containerId = urlParams.get('id');
    const containerInput = document.getElementById('containerId');
    const deviceHiddenInput = document.getElementById('deviceId');
    const fillPercent = document.getElementById('fillPercent');
    const rangeFill = document.getElementById('rangeFill');
    const fillText = document.getElementById('fillText');
    const reportForm = document.getElementById('reportForm');

    // 1. Установка ID контейнера
    if (containerId) {
        containerInput.value = containerId;
    } else {
        containerInput.value = "Не определен";
    }

    // 2. Работа с Device ID (скрыто)
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    deviceHiddenInput.value = deviceId;

    // 3. Обновление объединенного ползунка
    function updateSlider() {
        const value = fillPercent.value;
        fillText.textContent = value + '%';
        rangeFill.style.width = value + '%';

        // Меняем цвет в зависимости от заполнения
        if (value < 50) {
            rangeFill.style.backgroundColor = '#28a745'; // Зеленый
            fillText.style.backgroundColor = '#28a745';
        } else if (value < 80) {
            rangeFill.style.backgroundColor = '#ffc107'; // Желтый
            fillText.style.backgroundColor = '#ffc107';
        } else {
            rangeFill.style.backgroundColor = '#dc3545'; // Красный
            fillText.style.backgroundColor = '#dc3545';
        }
    }

    fillPercent.addEventListener('input', updateSlider);
    updateSlider(); // Инициализация при загрузке

    // 4. Отправка данных
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        const formData = {
            container_id: containerInput.value,
            fill_percent: parseInt(fillPercent.value),
            device_id: deviceHiddenInput.value,
            role: document.getElementById('role').value
        };

        try {
            const response = await fetch('/api/sensors/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            showMessage(response.ok ? 'success' : 'error', result.message || (response.ok ? 'Успешно отправлено!' : 'Ошибка сервера'));

            if (response.ok) {
                // Если успешно, можно немного подождать и сбросить или редиректнуть
            }
        } catch (error) {
            showMessage('error', 'Ошибка соединения с сервером');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить отчет';
        }
    });

    function showMessage(type, text) {
        const msgDiv = document.getElementById('message');
        msgDiv.className = `message ${type}`;
        msgDiv.textContent = (type === 'success' ? '✅ ' : '❌ ') + text;
        msgDiv.style.display = 'block';

        setTimeout(() => {
            msgDiv.style.display = 'none';
        }, 4000);
    }
});