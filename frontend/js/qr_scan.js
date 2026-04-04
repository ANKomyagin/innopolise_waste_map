// Получаем ID контейнера из URL параметров
const urlParams = new URLSearchParams(window.location.search);
const containerId = urlParams.get('id');

if (containerId) {
    document.getElementById('containerId').value = containerId;
} else {
    document.getElementById('containerId').placeholder = 'Отсканируйте QR код контейнера';
}

// Обновление индикатора заполнения
const fillPercent = document.getElementById('fillPercent');
const fillLevel = document.getElementById('fillLevel');
const fillText = document.getElementById('fillText');

fillPercent.addEventListener('input', function() {
    const value = this.value;
    fillText.textContent = value + '%';
    fillLevel.style.width = value + '%';

    // Изменение цвета в зависимости от уровня
    fillLevel.className = 'fill-level';
    if (value < 50) {
        fillLevel.classList.add('fill-low');
    } else if (value < 70) {
        fillLevel.classList.add('fill-medium');
    } else {
        fillLevel.classList.add('fill-high');
    }
});

// Обработка отправки формы
document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
        container_id: document.getElementById('containerId').value,
        fill_percent: parseInt(document.getElementById('fillPercent').value),
        device_id: document.getElementById('deviceId').value,
        role: document.getElementById('role').value
    };

    try {
        const response = await fetch('/api/sensors/manual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        const messageDiv = document.getElementById('message');
        if (response.ok) {
            messageDiv.className = 'message success';
            messageDiv.textContent = '✅ ' + result.message;
        } else {
            messageDiv.className = 'message error';
            messageDiv.textContent = '❌ ' + result.message;
        }
        messageDiv.style.display = 'block';

        // Очистка формы через 3 секунды
        setTimeout(() => {
            if (response.ok) {
                document.getElementById('reportForm').reset();
                document.getElementById('containerId').value = containerId || '';
                fillPercent.value = 50;
                fillPercent.dispatchEvent(new Event('input'));
            }
            messageDiv.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Ошибка:', error);
        const messageDiv = document.getElementById('message');
        messageDiv.className = 'message error';
        messageDiv.textContent = '❌ Ошибка соединения. Попробуйте еще раз.';
        messageDiv.style.display = 'block';
    }
});

// Генерация уникального ID устройства
if (!localStorage.getItem('deviceId')) {
    const deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', deviceId);
}
document.getElementById('deviceId').value = localStorage.getItem('deviceId');