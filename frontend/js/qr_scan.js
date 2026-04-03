// ... (начало кода с URLSearchParams остается без изменений) ...

const fillText = document.getElementById('fillText');
const sliderFill = document.getElementById('sliderFill');
const sliderThumb = document.getElementById('sliderThumb');
const customSlider = document.getElementById('customSlider');
const fillPercentInput = document.getElementById('fillPercent');
const submitBtn = document.getElementById('submitBtn');

// Функция смены цвета в зависимости от %
function getFillColor(percent) {
    if (percent < 40) return '#34C759'; // Зеленый (Apple Success)
    if (percent < 75) return '#FF9500'; // Оранжевый (Warning)
    return '#FF3B30'; // Красный (Danger)
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

// Улучшенная обработка ввода (Desktop + Mobile)
function handleMove(e) {
    const rect = customSlider.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    updateSlider(percent);
}

let isDragging = false;
const startDrag = (e) => { isDragging = true; handleMove(e); };
const stopDrag = () => { isDragging = false; };

customSlider.addEventListener('mousedown', startDrag);
customSlider.addEventListener('touchstart', startDrag, {passive: true});

document.addEventListener('mousemove', (e) => { if(isDragging) handleMove(e); });
document.addEventListener('touchmove', (e) => { if(isDragging) handleMove(e); }, {passive: false});

document.addEventListener('mouseup', stopDrag);
document.addEventListener('touchend', stopDrag);

// Обновленный обработчик формы
document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const formData = {
        container_id: document.getElementById('containerId').value,
        fill_percent: parseInt(fillPercentInput.value),
        device_id: document.getElementById('deviceId').value,
        role: document.getElementById('role').value
    };

    try {
        const response = await fetch('/api/sensors/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        const messageDiv = document.getElementById('message');

        messageDiv.className = `message ${response.ok ? 'success' : 'error'}`;
        messageDiv.textContent = (response.ok ? '✅ ' : '❌ ') + result.message;
        messageDiv.style.display = 'block';

        if (response.ok) {
            // Легкая вибрация телефона при успехе (если поддерживается)
            if (window.navigator.vibrate) window.navigator.vibrate(50);
        }

    } catch (error) {
        // ... обработка ошибки ...
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// Инициализация
updateSlider(50);