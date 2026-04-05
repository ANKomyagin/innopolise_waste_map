const urlParams = new URLSearchParams(window.location.search);
const containerId = urlParams.get('id');

if (containerId) {
    document.getElementById('containerId').value = containerId;
} else {
    document.getElementById('containerId').value = 'НЕИЗВЕСТНО';
}

const fillPercent = document.getElementById('fillPercent');
const fillText = document.getElementById('fillText');

function updateColor(value) {
    if (value < 50) return 'text-green-500';
    if (value < 80) return 'text-yellow-500';
    return 'text-red-500';
}

fillPercent.addEventListener('input', function() {
    const value = this.value;
    fillText.textContent = value + '%';
    fillText.className = `text-2xl font-bold ${updateColor(value)}`;
});

// Геолокация пользователя
if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.getElementById('userLat').value = position.coords.latitude;
            document.getElementById('userLon').value = position.coords.longitude;
        },
        (error) => console.warn("Геолокация недоступна", error),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
}

document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

    // Получаем выбранную роль из radio кнопок
    const roleRadio = document.querySelector('input[name="role"]:checked');

    const formData = {
        container_id: document.getElementById('containerId').value,
        fill_percent: parseInt(fillPercent.value),
        device_id: document.getElementById('deviceId').value,
        role: roleRadio ? roleRadio.value : 'resident'
    };

    // Если удалось получить гео, можно будет добавить в запрос в будущем
    const lat = document.getElementById('userLat').value;
    const lon = document.getElementById('userLon').value;

    try {
        const response = await fetch('/api/sensors/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        const messageDiv = document.getElementById('message');
        
        messageDiv.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');
        
        if (response.ok && result.status === 'ok') {
            messageDiv.classList.add('bg-green-100', 'text-green-800');
            messageDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
        } else {
            messageDiv.classList.add('bg-red-100', 'text-red-800');
            messageDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${result.message || 'Ошибка сервера'}`;
        }

        setTimeout(() => {
            messageDiv.classList.add('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить отчет';
        }, 3000);

    } catch (error) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить отчет';
        alert('Ошибка сети. Проверьте подключение.');
    }
});

if (!localStorage.getItem('deviceId')) {
    localStorage.setItem('deviceId', 'device_' + Math.random().toString(36).substr(2, 9));
}
document.getElementById('deviceId').value = localStorage.getItem('deviceId');
