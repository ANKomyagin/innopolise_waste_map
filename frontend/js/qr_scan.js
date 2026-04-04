// 1. Получаем параметры из URL
const urlParams = new URLSearchParams(window.location.search);

const containerId = urlParams.get('id') || urlParams.get('container_id');

const containerInput = document.getElementById('containerId');
const submitBtn = document.getElementById('submitBtn');
const messageDiv = document.getElementById('message');

// 2. Инициализация ID устройства (из localStorage)
if (!localStorage.getItem('deviceId')) {
    const newDeviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', newDeviceId);
}
document.getElementById('deviceId').value = localStorage.getItem('deviceId');

// 3. Проверка наличия ID контейнера
if (containerId) {
    containerInput.value = containerId;
} else {
    containerInput.placeholder = ' ID не найден';
    containerInput.classList.add('input-error');
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.innerText = 'Необходим ID контейнера';
}


const fillText = document.getElementById('fillText');
const sliderFill = document.getElementById('sliderFill');
const sliderThumb = document.getElementById('sliderThumb');
const customSlider = document.getElementById('customSlider');
const fillPercentInput = document.getElementById('fillPercent');

function getFillColor(percent) {
    if (percent < 40) return '#34C759';
    if (percent < 75) return '#FF9500';
    return '#FF3B30';
}

function updateSlider(value) {
    const percent = value + '%';
    const color = getFillColor(value);
    fillText.textContent = percent;
    fillText.style.color = color;
    sliderFill.style.width = percent;
    sliderFill.style.background = color;
    sliderThumb.style.left = percent;
    fillPercentInput.value = value;
}

function handleMove(e) {
    const rect = customSlider.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    updateSlider(percent);
}

let isDragging = false;
customSlider.addEventListener('mousedown', (e) => { isDragging = true; handleMove(e); });
customSlider.addEventListener('touchstart', (e) => { isDragging = true; handleMove(e); }, {passive: true});
document.addEventListener('mousemove', (e) => { if(isDragging) handleMove(e); });
document.addEventListener('touchmove', (e) => { if(isDragging) handleMove(e); }, {passive: false});
document.addEventListener('mouseup', () => isDragging = false);
document.addEventListener('touchend', () => isDragging = false);

updateSlider(50);

// 4. ОБРАБОТКА ФОРМЫ
document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Сбор данных
    const payload = {
        container_id: containerInput.value,
        fill_percent: parseInt(fillPercentInput.value),
        device_id: document.getElementById('deviceId').value,
        role: document.getElementById('role').value
    };

    // Отладка
    console.log("Отправка данных:", payload);

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/sensors/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        messageDiv.className = `message ${response.ok ? 'success' : 'error'}`;
        messageDiv.textContent = (response.ok ? '✅ ' : '❌ ') + (result.message || result.error || 'Ошибка сервера');
        messageDiv.style.display = 'block';

        if (response.ok) {
            if (window.navigator.vibrate) window.navigator.vibrate([50, 30, 50]);
            // Можно очистить форму или скрыть её через 2 секунды
        }

    } catch (error) {
        console.error("Ошибка запроса:", error);
        messageDiv.className = 'message error';
        messageDiv.textContent = '❌ Ошибка сети. Проверьте интернет.';
        messageDiv.style.display = 'block';
    } finally {
        submitBtn.classList.remove('loading');
        if (containerId) submitBtn.disabled = false;
    }
});