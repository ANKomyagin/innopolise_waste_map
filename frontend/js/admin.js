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
let locations = {}; // Group containers by address
let isEditMode = false;
let editingId = null;
let currentEditingLocation = null;
let isSelectingLocation = false;
let editingLocationAddress = null;

// Initialize map data when map is fully loaded
window.addEventListener('map-loaded', function() {
    loadContainers();
    loadDashboardStats();
    loadRecentScans();
    setupMapClickHandler();
});

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

            const sourceName = map.getSource('containers-source') ? 'containers-source' : 'containers';
            
            // Очищаем старые слои, если они были
            if (map.getLayer('cluster-count')) map.removeLayer('cluster-count');
            if (map.getLayer('clusters')) map.removeLayer('clusters');

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
                    'icon-allow-overlap': true
                }
            });
        }

        // Обработка клика по контейнеру (открытие инфо)
        map.on('click', 'clusters', function(e) {
            const props = e.features[0].properties;
            const coords = e.features[0].geometry.coordinates; // [lon, lat]
            
            const featureData = {
                ...props,
                containers: typeof props.containers === 'string' ? JSON.parse(props.containers) : props.containers,
                lon: coords[0],
                lat: coords[1]
            };
            window.dispatchEvent(new CustomEvent('container-selected', { detail: featureData }));
        });
        map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

        // Клик по пустой карте = выбор координат или добавление нового контейнера
        setupMapClickHandler();

        updateStatistics();
        updateLocationsView();
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

function updateLocationsView() {
    locations = {};
    containers.forEach(c => {
        if (!locations[c.address]) {
            locations[c.address] = [];
        }
        locations[c.address].push(c);
    });

    const container = document.getElementById('locationsContainer');
    if (Object.keys(locations).length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-6">Нет площадок</div>';
        return;
    }

    container.innerHTML = Object.entries(locations).map(([address, locs]) => {
        const safeAddress = address.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
        const avgFill = Math.round(locs.reduce((sum, c) => sum + c.fill_percent, 0) / locs.length);
        let fillColor = 'text-green-600';
        if (avgFill >= 70) fillColor = 'text-red-600';
        else if (avgFill >= 50) fillColor = 'text-yellow-600';

        return `
            <div class="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-lg p-4">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <h3 class="font-bold text-gray-800 dark:text-white">${address}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Контейнеров: ${locs.length}</p>
                    </div>
                    <span class="text-lg font-bold ${fillColor}">${avgFill}%</span>
                </div>
                
                <div class="flex gap-2 mb-3 flex-wrap">
                    <button onclick="startLocationSelection('${safeAddress}')" class="flex-1 min-w-[120px] bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1">
                        <i class="fas fa-map-pin"></i> Координаты
                    </button>
                    <button onclick="openAddContainerToLocationModal('${safeAddress}', '${locs[0].lat}, ${locs[0].lon}')" class="flex-1 min-w-[120px] bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1">
                        <i class="fas fa-plus"></i> Добавить бак
                    </button>
                    <button onclick="openEditLocationModal('${safeAddress}', '${locs[0].lat}, ${locs[0].lon}')" class="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1">
                        <i class="fas fa-edit"></i> Ред. площадку
                    </button>
                </div>
                
                <div class="space-y-2">
                    ${locs.map(c => {
                        let cFillColor = 'bg-green-100 text-green-800';
                        if (c.fill_percent >= 70) cFillColor = 'bg-red-100 text-red-800';
                        else if (c.fill_percent >= 50) cFillColor = 'bg-yellow-100 text-yellow-800';
                        
                        return `
                            <div class="bg-white dark:bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p class="font-semibold text-gray-800 dark:text-white">${c.id}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${c.lat}, ${c.lon}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded text-sm font-medium ${cFillColor}">${c.fill_percent}%</span>
                                    <button onclick="openQRModal('${c.id}')" class="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors" title="QR-код">
                                        <i class="fas fa-qrcode"></i>
                                    </button>
                                    <button onclick="openEditContainerModal('${c.id}', ${c.fill_percent})" class="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors" title="Редактировать">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteContainer('${c.id}')" class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors" title="Удалить">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function loadDashboardStats() {
    try {
        const response = await fetch('/api/analytics/dashboard');
        if (!response.ok) return;
        const data = await response.json();
        
        document.getElementById('totalContainers').textContent = data.total_containers || 0;
        document.getElementById('needsCollection').textContent = data.needs_collection_now || 0;
        document.getElementById('availableContainers').textContent = data.total_containers - (data.needs_collection_now || 0);
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadRecentScans() {
    try {
        const response = await fetch('/api/analytics/scans', {
            headers: getAuthHeaders()
        });
        if (!response.ok) return;
        const data = await response.json();
        
        document.getElementById('totalScans').textContent = data.stats.total_scans || 0;
        document.getElementById('scansLast24h').textContent = data.stats.scans_last_24h || 0;
        
        const tbody = document.getElementById('recentScansBody');
        if (!data.recent_scans || data.recent_scans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-gray-500">Нет сканирований</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.recent_scans.map(scan => {
            let dateStr = scan.scanned_at;
            if (!dateStr.endsWith('Z')) {
                dateStr += 'Z';
            }
            const date = new Date(dateStr);
            const timeStr = date.toLocaleString('ru-RU', { 
                timeZone: 'Europe/Moscow', 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            return `
                <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td class="px-4 py-3 font-semibold text-gray-800 dark:text-white">${scan.container_id}</td>
                    <td class="px-4 py-3 text-gray-700 dark:text-gray-300">${scan.fill_percent}%</td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">${timeStr}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading recent scans:', error);
    }
}

function setupMapClickHandler() {
    if (map._mapClickHandlerSetup) return; // Prevent duplicate handlers
    
    map.on('click', function(e) {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (features.length) return; // Если кликнули по мусорке, игнорируем
        
        const coords = e.lngLat;
        const coordsStr = coords.lat.toFixed(6) + ', ' + coords.lng.toFixed(6);
        
        // Если в режиме выбора координат площадки
        if (isSelectingLocation) {
            if (confirm('Перенести площадку сюда?')) {
                updateLocationCoordinates(coordsStr);
            } else {
                cancelLocationSelection();
            }
            return;
        }
        
        // Иначе открываем модалку создания новой площадки
        document.getElementById('containerCoords').value = coordsStr;
        document.getElementById('containerCoords').disabled = false;
        
        document.getElementById('containerAddress').value = 'Новая площадка';
        document.getElementById('containerAddress').disabled = false;
        
        // Автоматически генерируем ID
        document.getElementById('containerId').value = 'BIN-' + Math.floor(Math.random() * 10000);
        
        isEditMode = false;
        document.getElementById('addContainerModal').style.display = 'flex';
    });
    
    map._mapClickHandlerSetup = true;
}

async function updateLocationCoordinates(newCoords) {
    if (!editingLocationAddress) {
        alert('Ошибка: адрес площадки не найден');
        cancelLocationSelection();
        return;
    }
    
    try {
        const encodedAddress = encodeURIComponent(editingLocationAddress);
        const response = await fetch(`/api/containers/location/${encodedAddress}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                new_address: editingLocationAddress,
                new_coords: newCoords
            })
        });
        
        if (response.ok) {
            alert('Координаты площадки обновлены');
            loadContainers();
        } else {
            const err = await response.json().catch(() => null);
            alert('Ошибка обновления: ' + (err?.detail || response.statusText));
        }
        cancelLocationSelection();
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка обновления координат');
        cancelLocationSelection();
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

function openQRModal(containerId) {
    const qrUrl = `/api/sensors/${containerId}/qr`;
    document.getElementById('qrImage').src = qrUrl;
    document.getElementById('qrModal').style.display = 'flex';
}

function openEditContainerModal(containerId, currentFill) {
    editingId = containerId;
    document.getElementById('editContainerId').value = '';
    document.getElementById('editContainerFill').value = currentFill;
    document.getElementById('editContainerModal').style.display = 'flex';
}

function openEditLocationModal(address, coords) {
    currentEditingLocation = address;
    editingLocationAddress = address;
    document.getElementById('editLocationAddress').value = address;
    document.getElementById('editLocationCoords').value = coords;
    document.getElementById('editLocationModal').style.display = 'flex';
}

function startLocationSelection(address) {
    editingLocationAddress = address;
    isSelectingLocation = true;
    map.getCanvas().style.cursor = 'crosshair';
    showLocationSelectionBanner();
    window.dispatchEvent(new Event('collapse-panel'));
}

function cancelLocationSelection() {
    isSelectingLocation = false;
    editingLocationAddress = null;
    map.getCanvas().style.cursor = '';
    hideLocationSelectionBanner();
}

function showLocationSelectionBanner() {
    const banner = document.getElementById('locationSelectBanner');
    if (banner) {
        banner.classList.remove('hidden');
    }
}

function hideLocationSelectionBanner() {
    const banner = document.getElementById('locationSelectBanner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

function openAddContainerToLocationModal(address, coords, lon) {
    document.getElementById('containerId').value = 'BIN-' + Math.floor(Math.random() * 10000);
    
    // Set address and make it readonly
    document.getElementById('containerAddress').value = address || '';
    document.getElementById('containerAddress').disabled = true;
    
    // Handle coords in two formats:
    // 1. String "lat, lon" (from locations view)
    // 2. Separate lat and lon parameters (from container details modal)
    let coordsStr = '';
    if (lon !== undefined) {
        // Called with separate lat and lon values
        const lat = parseFloat(coords);
        const longitude = parseFloat(lon);
        if (!isNaN(lat) && !isNaN(longitude)) {
            coordsStr = lat.toFixed(6) + ', ' + longitude.toFixed(6);
        }
    } else if (coords) {
        // Called with "lat, lon" string
        coordsStr = String(coords).trim();
    }
    
    document.getElementById('containerCoords').value = coordsStr;
    document.getElementById('containerCoords').disabled = true;
    
    isEditMode = false;
    document.getElementById('addContainerModal').style.display = 'flex';
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

    try {
        const response = await fetch('/api/containers/', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({id, address, coords})
        });

        if (response.ok) {
            alert('Контейнер добавлен');
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

async function saveEditContainer(event) {
    if (event) event.preventDefault();
    
    const newId = document.getElementById('editContainerId').value;
    const fillPercent = parseInt(document.getElementById('editContainerFill').value);

    if (!editingId) {
        alert('Ошибка: ID контейнера не найден');
        return;
    }

    const body = {};
    if (newId) body.new_id = newId;
    if (!isNaN(fillPercent)) body.fill_percent = fillPercent;

    if (Object.keys(body).length === 0) {
        alert('Укажите хотя бы одно поле для изменения');
        return;
    }

    try {
        const response = await fetch(`/api/containers/${editingId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });

        if (response.ok) {
            alert('Контейнер обновлен');
            document.getElementById('editContainerModal').style.display = 'none';
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

async function saveEditLocation(event) {
    if (event) event.preventDefault();
    
    const newAddress = document.getElementById('editLocationAddress').value;
    const newCoords = document.getElementById('editLocationCoords').value;

    if (!currentEditingLocation || !newAddress || !newCoords) {
        alert('Заполните все поля');
        return;
    }

    try {
        const encodedAddress = encodeURIComponent(currentEditingLocation);
        const response = await fetch(`/api/containers/location/${encodedAddress}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                new_address: newAddress,
                new_coords: newCoords
            })
        });

        if (response.ok) {
            alert('Площадка обновлена');
            document.getElementById('editLocationModal').style.display = 'none';
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

// Event listeners for modal prompts from container details
window.addEventListener('edit-container-prompt', function(e) {
    const { id, fill } = e.detail;
    openEditContainerModal(id, fill);
});

window.addEventListener('delete-container-prompt', function(e) {
    const { id } = e.detail;
    deleteContainer(id);
});

// Setup form submissions and keyboard listeners
document.addEventListener('DOMContentLoaded', function() {
    const containerForm = document.getElementById('containerForm');
    if (containerForm) {
        containerForm.addEventListener('submit', saveContainer);
    }
    
    const editContainerForm = document.getElementById('editContainerForm');
    if (editContainerForm) {
        editContainerForm.addEventListener('submit', saveEditContainer);
    }
    
    const editLocationForm = document.getElementById('editLocationForm');
    if (editLocationForm) {
        editLocationForm.addEventListener('submit', saveEditLocation);
    }
    
    // Add Escape key listener for location selection cancellation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isSelectingLocation) {
            cancelLocationSelection();
        }
    });
});
