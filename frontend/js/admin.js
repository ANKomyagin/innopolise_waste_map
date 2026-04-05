// Check authentication on page load
(function() {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');
    
    if (!token || role !== 'admin') {
        alert('Доступ запрещен. Пожалуйста, войдите как администратор.');
        window.location.href = '/';
    }
})();

let containers = [];
let isEditMode = false;
let editingId = null;

// Initialize map data when map is fully loaded
window.addEventListener('map-loaded', loadContainers);

async function loadContainers() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (!data || !data.features) throw new Error('Invalid data format');

        containers = [];

        // Extract all containers from features
        data.features.forEach(feature => {
            const props = feature.properties;
            if (props.containers && Array.isArray(props.containers)) {
                props.containers.forEach(c => {
                    containers.push(c);
                });
            }
        });

        // Add or update GeoJSON source
        if (map.getSource('containers-source')) {
            map.getSource('containers-source').setData(data);
        } else {
            map.addSource('containers-source', {
                type: 'geojson',
                data: data
            });

            // SVG pin icons layer
            const sourceName = map.getSource('containers-source') ? 'containers-source' : 'containers';
            
            map.addLayer({
                id: 'clusters',
                type: 'symbol',
                source: sourceName,
                layout: {
                    'icon-image': [
                        'case',
                        ['>=', ['get', 'avg_fill_percent'], 70], 'bin-red',
                        ['>=', ['get', 'avg_fill_percent'], 50], 'bin-yellow',
                        'bin-green'
                    ],
                    'icon-size': 1,
                    'icon-anchor': 'bottom',
                    'text-field': ['concat', ['get', 'avg_fill_percent'], '%'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 11,
                    'text-offset': [0, -2.6]
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': 'rgba(0,0,0,0.3)',
                    'text-halo-width': 1
                }
            });
        }

        // Обработка клика по контейнеру (открытие инфо)
        map.on('click', 'clusters', function(e) {
            const props = e.features[0].properties;
            const featureData = {
                ...props,
                containers: typeof props.containers === 'string' ? JSON.parse(props.containers) : props.containers
            };
            window.dispatchEvent(new CustomEvent('container-selected', { detail: featureData }));
        });
        map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

        // Клик по пустой карте = добавление нового контейнера
        map.on('click', function(e) {
            const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
            if (features.length) return; // Если кликнули по мусорке, игнорируем
            
            const coords = e.lngLat;
            document.getElementById('containerCoords').value = coords.lat.toFixed(6) + ', ' + coords.lng.toFixed(6);
            
            // Автоматически генерируем ID
            document.getElementById('containerId').value = 'BIN-' + Math.floor(Math.random() * 10000);
            document.getElementById('containerAddress').value = 'Новая площадка';
            
            isEditMode = false;
            document.getElementById('addContainerModal').style.display = 'flex';
        });

        updateStatistics();
        updateTable();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

function updateStatistics() {
    const total = containers.length;
    const needsCollection = containers.filter(c => c.fill_percent >= 70).length;
    const available = containers.filter(c => c.fill_percent < 50).length;
    const avgFill = total > 0 ? Math.round(containers.reduce((sum, c) => sum + c.fill_percent, 0) / total) : 0;

    document.getElementById('totalContainers').textContent = total;
    document.getElementById('needsCollection').textContent = needsCollection;
    document.getElementById('availableContainers').textContent = available;
    document.getElementById('avgFill').textContent = avgFill + '%';
}

function updateTable() {
    const tbody = document.getElementById('containerTableBody');
    if (containers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-gray-500">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = containers.map(c => {
        let fillColor = '#28a745';
        if (c.fill_percent >= 70) fillColor = '#dc3545';
        else if (c.fill_percent >= 50) fillColor = '#ffc107';

        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-semibold text-gray-800">${c.id}</td>
                <td class="px-4 py-3 text-gray-700">${c.address}</td>
                <td class="px-4 py-3">
                    <span class="inline-block px-3 py-1 rounded-full text-white text-sm font-medium" style="background-color: ${fillColor}">
                        ${c.fill_percent}%
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

function showQR(containerId) {
    const qrUrl = `/api/sensors/${containerId}/qr`;
    alert(`QR-код: ${containerId}\n${window.location.origin}/qr-scan?id=${containerId}`);
    // In a real app, you'd open a modal with the QR image
}

async function saveContainer(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('containerId').value;
    const address = document.getElementById('containerAddress').value;
    const coords = document.getElementById('containerCoords').value;

    if (!id || !address || !coords) {
        alert('Заполните все поля');
        return;
    }

    const url = isEditMode ? `/api/containers/${editingId}` : '/api/containers/';
    const method = isEditMode ? 'PUT' : 'POST';
    const body = isEditMode ? {address, coords} : {id, address, coords};

    try {
        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });

        if (response.ok) {
            alert(isEditMode ? 'Контейнер обновлен' : 'Контейнер добавлен');
            document.getElementById('addContainerModal').style.display = 'none';
            document.getElementById('containerForm').reset();
            loadContainers();
        } else if (response.status === 401) {
            alert('Сессия истекла. Войдите заново.');
            localStorage.clear();
            window.location.href = '/';
        } else {
            const err = await response.json().catch(() => null);
            alert('Ошибка сохранения: ' + (err?.detail || response.statusText));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка сохранения');
    }
}

async function deleteContainer(id) {
    if (!confirm(`Удалить контейнер ${id}?`)) return;

    try {
        const response = await fetch(`/api/containers/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            alert('Контейнер удален');
            loadContainers();
        } else if (response.status === 401) {
            alert('Сессия истекла. Войдите заново.');
            localStorage.clear();
            window.location.href = '/';
        } else {
            const err = await response.json().catch(() => null);
            alert('Ошибка удаления: ' + (err?.detail || response.statusText));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка удаления');
    }
}

// Setup form submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('containerForm');
    if (form) {
        form.addEventListener('submit', saveContainer);
    }
});
