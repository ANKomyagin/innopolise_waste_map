// Check authentication on page load
(function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    
    if (!token || role !== 'admin') {
        alert('Доступ запрещен. Пожалуйста, войдите как администратор.');
        window.location.href = '/';
    }
})();

let map;
let miniMap;
let containers = [];
let isEditMode = false;
let editingId = null;
let fillChart, topChart;

function initMap() {
    ymaps.ready(function() {
        map = new ymaps.Map("map", {
            center: [55.753, 48.743],
            zoom: 13,
            controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
        });

        loadContainers();
    });
}

async function loadContainers() {
    try {
        const response = await fetch('/api/map/geojson');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (!data || !data.features) throw new Error('Invalid data format');

        containers = [];
        map.geoObjects.removeAll();

        data.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const props = feature.properties;
            if (!props.containers || props.containers.length === 0) return;

            // Add all containers from cluster to list
            props.containers.forEach(c => {
                containers.push(c);
            });

            // Determine color based on average fill
            const avgFill = props.is_cluster ? props.avg_fill_percent : props.containers[0].fill_percent;
            let fillColor = '#28a745';
            if (avgFill >= 70) fillColor = '#dc3545';
            else if (avgFill >= 50) fillColor = '#ffc107';

            let iconSvg, balloonHeader, balloonBody, hintContent;

            // Unified design for all containers (single or cluster)
            const containerCount = props.container_count;
            const iconSize = 60; // Increased size
            
            // Beautiful cluster/container icon
            iconSvg = `
                <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
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
                    <circle cx="46" cy="14" r="10" fill="#ff6b6b" stroke="white" stroke-width="2.5"/>
                    <text x="46" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${containerCount}</text>
                </svg>
            `;

            const containersList = props.containers.map(c => `
                <div style="padding: 8px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; border-left: 3px solid ${c.fill_percent >= 70 ? '#dc3545' : c.fill_percent >= 50 ? '#ffc107' : '#28a745'};">
                    <strong>🗑️ ${c.id}</strong><br>
                    Заполнение: <strong>${c.fill_percent}%</strong>
                </div>
            `).join('');

            // Progress bar for fill percentage
            const fillPercentage = props.avg_fill_percent;
            const progressBarColor = fillPercentage >= 70 ? '#dc3545' : fillPercentage >= 50 ? '#ffc107' : '#28a745';
            
            balloonHeader = `<b>📍 ${props.is_cluster ? 'Площадка' : 'Контейнер'} (${containerCount} ${containerCount === 1 ? 'контейнер' : 'контейнера'})</b>`;
            balloonBody = `
                <div style="padding: 10px; max-height: 400px; overflow-y: auto;">
                    <p><strong>📍 Адрес:</strong> ${props.address}</p>
                    <div style="margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-weight: 600;">Заполненность:</span>
                            <span style="font-weight: 700; color: ${progressBarColor};">${fillPercentage}%</span>
                        </div>
                        <div style="width: 100%; height: 24px; background: #e9ecef; border-radius: 12px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="width: ${fillPercentage}%; height: 100%; background: linear-gradient(90deg, ${progressBarColor}, ${progressBarColor}dd); transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">
                                ${fillPercentage > 15 ? fillPercentage + '%' : ''}
                            </div>
                        </div>
                    </div>
                    <hr>
                    <h6><strong>Контейнеры на площадке:</strong></h6>
                    ${containersList}
                </div>
            `;
            hintContent = `${props.is_cluster ? 'Площадка' : 'Контейнер'}: ${containerCount} ${containerCount === 1 ? 'контейнер' : 'контейнеров'}, ${fillPercentage}%`;
            const placemark = new ymaps.Placemark(
                [coords[1], coords[0]],
                {
                    balloonContentHeader: balloonHeader,
                    balloonContentBody: balloonBody,
                    hintContent: hintContent
                },
                {
                    iconLayout: 'default#image',
                    iconImageHref: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg),
                    iconImageSize: [iconSize, iconSize],
                    iconImageOffset: [-iconSize/2, -iconSize/2]
                }
            );

            map.geoObjects.add(placemark);
        });

        updateStatistics();
        updateTable();
        updateCharts();
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = containers.map(c => {
        let badgeClass = 'badge-low';
        if (c.fill_percent >= 70) badgeClass = 'badge-high';
        else if (c.fill_percent >= 50) badgeClass = 'badge-medium';

        return `
            <tr>
                <td><strong>${c.id}</strong></td>
                <td>${c.address}</td>
                <td>${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}</td>
                <td><span class="badge-fill ${badgeClass}">${c.fill_percent}%</span></td>
                <td>
                    <button class="btn btn-sm btn-info btn-action" onclick="showQR('${c.id}')" title="QR-код">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </td>
                <td>
                    <button class="btn btn-sm btn-warning btn-action" onclick="editContainer('${c.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-action" onclick="deleteContainer('${c.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateCharts() {
    const low = containers.filter(c => c.fill_percent < 50).length;
    const medium = containers.filter(c => c.fill_percent >= 50 && c.fill_percent < 70).length;
    const high = containers.filter(c => c.fill_percent >= 70).length;

    // Pie chart
    const fillCtx = document.getElementById('fillChart').getContext('2d');
    if (fillChart) fillChart.destroy();
    fillChart = new Chart(fillCtx, {
        type: 'doughnut',
        data: {
            labels: ['Свободно (<50%)', 'Заполнено (50-70%)', 'Переполнено (>70%)'],
            datasets: [{
                data: [low, medium, high],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Top 5 bar chart
    const topContainers = [...containers].sort((a, b) => b.fill_percent - a.fill_percent).slice(0, 5);
    const topCtx = document.getElementById('topChart').getContext('2d');
    if (topChart) topChart.destroy();
    topChart = new Chart(topCtx, {
        type: 'bar',
        data: {
            labels: topContainers.map(c => c.id),
            datasets: [{
                label: 'Заполненность (%)',
                data: topContainers.map(c => c.fill_percent),
                backgroundColor: topContainers.map(c => 
                    c.fill_percent >= 70 ? '#dc3545' : c.fill_percent >= 50 ? '#ffc107' : '#28a745'
                )
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function showAddModal() {
    isEditMode = false;
    document.getElementById('modalTitle').textContent = 'Добавить контейнер';
    document.getElementById('containerForm').reset();
    document.getElementById('containerId').disabled = false;
    
    const modal = new bootstrap.Modal(document.getElementById('containerModal'));
    modal.show();

    setTimeout(() => {
        if (!miniMap) {
            ymaps.ready(function() {
                miniMap = new ymaps.Map("miniMap", {
                    center: [55.753, 48.743],
                    zoom: 13,
                    controls: ['zoomControl']
                });

                miniMap.events.add('click', function(e) {
                    const coords = e.get('coords');
                    document.getElementById('containerCoords').value = 
                        coords[0].toFixed(6) + ', ' + coords[1].toFixed(6);
                });
            });
        }
    }, 500);
}

function editContainer(id) {
    const container = containers.find(c => c.id === id);
    if (!container) return;

    isEditMode = true;
    editingId = id;
    document.getElementById('modalTitle').textContent = 'Редактировать контейнер';
    document.getElementById('containerId').value = container.id;
    document.getElementById('containerId').disabled = true;
    document.getElementById('containerAddress').value = container.address;
    document.getElementById('containerCoords').value = `${container.lat}, ${container.lon}`;

    const modal = new bootstrap.Modal(document.getElementById('containerModal'));
    modal.show();
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

function showQR(containerId) {
    const qrUrl = `/api/sensors/${containerId}/qr`;
    document.getElementById('qrModalTitle').textContent = `QR-код: ${containerId}`;
    document.getElementById('qrImage').src = qrUrl;
    document.getElementById('qrDownload').href = qrUrl;
    document.getElementById('qrDownload').download = `qr_${containerId}.png`;
    document.getElementById('qrUrl').textContent = `${window.location.origin}/qr-scan?id=${containerId}`;
    new bootstrap.Modal(document.getElementById('qrModal')).show();
}

async function saveContainer() {
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
            bootstrap.Modal.getInstance(document.getElementById('containerModal')).hide();
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

initMap();
