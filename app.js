(function () {
    const STORAGE_KEY = 'poids-tracker-data';

    function loadData() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    function formatDateLong(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }

    function todayStr() {
        return new Date().toISOString().slice(0, 10);
    }

    function showToast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    }

    // --- Chart ---
    let chart = null;
    let currentPeriod = 30;

    function buildChart(data, days) {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        let filtered = sorted;
        if (days > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffStr = cutoff.toISOString().slice(0, 10);
            filtered = sorted.filter(d => d.date >= cutoffStr);
        }

        const labels = filtered.map(d => d.date);
        const values = filtered.map(d => d.weight);

        const ctx = document.getElementById('chart').getContext('2d');

        if (chart) chart.destroy();

        if (filtered.length === 0) {
            chart = new Chart(ctx, {
                type: 'line',
                data: { labels: [''], datasets: [{ data: [0] }] },
                options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
            });
            return;
        }

        const minW = Math.min(...values);
        const maxW = Math.max(...values);
        const padding = Math.max((maxW - minW) * 0.15, 0.5);

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: values,
                    borderColor: '#e94560',
                    backgroundColor: 'rgba(233, 69, 96, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: filtered.length > 60 ? 0 : 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#e94560',
                    borderWidth: 2.5,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#16213e',
                        titleColor: '#8899aa',
                        bodyColor: '#eee',
                        bodyFont: { size: 16, weight: 'bold' },
                        padding: 10,
                        cornerRadius: 10,
                        displayColors: false,
                        callbacks: {
                            title: (items) => formatDateLong(items[0].label),
                            label: (item) => item.parsed.y.toFixed(1) + ' kg'
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        ticks: {
                            color: '#8899aa',
                            font: { size: 11 },
                            maxTicksLimit: 6,
                            callback: (val, i) => formatDate(labels[i])
                        },
                        grid: { display: false }
                    },
                    y: {
                        min: minW - padding,
                        max: maxW + padding,
                        ticks: {
                            color: '#8899aa',
                            font: { size: 11 },
                            callback: v => v.toFixed(1)
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }

    // --- Stats ---
    function updateStats(data) {
        const container = document.getElementById('stats');
        if (data.length === 0) {
            container.innerHTML = '';
            return;
        }

        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const first = sorted[0];
        const diff = latest.weight - first.weight;
        const diffClass = diff < 0 ? 'down' : diff > 0 ? 'up' : 'neutral';
        const diffSign = diff > 0 ? '+' : '';

        let weekDiff = null;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().slice(0, 10);
        const weekEntry = sorted.filter(d => d.date <= weekStr).pop();
        if (weekEntry) {
            weekDiff = latest.weight - weekEntry.weight;
        }

        container.innerHTML = `
            <div class="stat">
                <div class="stat-value">${latest.weight.toFixed(1)}</div>
                <div class="stat-label">Actuel (kg)</div>
            </div>
            <div class="stat">
                <div class="stat-value">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</div>
                <div class="stat-label">Total</div>
                <div class="stat-diff ${diffClass}">${diffSign}${diff.toFixed(1)} kg</div>
            </div>
            ${weekDiff !== null ? `
            <div class="stat">
                <div class="stat-value">${weekDiff > 0 ? '+' : ''}${weekDiff.toFixed(1)}</div>
                <div class="stat-label">7 jours</div>
                <div class="stat-diff ${weekDiff < 0 ? 'down' : weekDiff > 0 ? 'up' : 'neutral'}">${weekDiff > 0 ? '+' : ''}${weekDiff.toFixed(1)} kg</div>
            </div>` : ''}
        `;
    }

    // --- History ---
    function renderHistory(data) {
        const container = document.getElementById('historyList');
        const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">&#9878;</div>
                    <p>Aucune mesure enregistree.<br>Ajoutez votre poids ci-dessus.</p>
                </div>`;
            return;
        }

        container.innerHTML = sorted.slice(0, 30).map((entry, i) => {
            let changeHtml = '';
            const nextIdx = sorted.findIndex((e, j) => j > i);
            if (nextIdx >= 0) {
                const diff = entry.weight - sorted[nextIdx].weight;
                const cls = diff < 0 ? 'down' : diff > 0 ? 'up' : 'neutral';
                const sign = diff > 0 ? '+' : '';
                changeHtml = `<span class="history-change ${cls}">${sign}${diff.toFixed(1)}</span>`;
            }

            return `
                <div class="history-item" data-date="${entry.date}">
                    <span class="history-date">${formatDateLong(entry.date)}</span>
                    <span class="history-weight">${entry.weight.toFixed(1)} kg</span>
                    ${changeHtml}
                    <button class="history-delete" data-date="${entry.date}">&times;</button>
                </div>`;
        }).join('');
    }

    // --- Refresh all ---
    function refresh() {
        const data = loadData();
        updateStats(data);
        buildChart(data, currentPeriod);
        renderHistory(data);
    }

    // --- Events ---
    function init() {
        const dateInput = document.getElementById('dateInput');
        dateInput.value = todayStr();

        document.getElementById('addBtn').addEventListener('click', () => {
            const weightInput = document.getElementById('weightInput');
            const weight = parseFloat(weightInput.value);
            const date = dateInput.value;

            if (!weight || weight < 20 || weight > 300) {
                showToast('Poids invalide');
                return;
            }
            if (!date) {
                showToast('Date invalide');
                return;
            }

            const data = loadData();
            const existing = data.findIndex(d => d.date === date);
            if (existing >= 0) {
                data[existing].weight = weight;
            } else {
                data.push({ date, weight });
            }

            saveData(data);
            weightInput.value = '';
            dateInput.value = todayStr();
            showToast('Enregistre !');
            refresh();
        });

        document.getElementById('weightInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('addBtn').click();
        });

        document.getElementById('historyList').addEventListener('click', (e) => {
            if (e.target.classList.contains('history-delete')) {
                const date = e.target.dataset.date;
                const data = loadData().filter(d => d.date !== date);
                saveData(data);
                showToast('Supprime');
                refresh();
            }
        });

        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentPeriod = parseInt(btn.dataset.period);
                buildChart(loadData(), currentPeriod);
            });
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            const data = loadData();
            if (data.length === 0) {
                showToast('Aucune donnee');
                return;
            }
            const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
            let csv = 'Date,Poids (kg)\n';
            sorted.forEach(d => csv += `${d.date},${d.weight}\n`);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `poids-${todayStr()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('CSV exporte');
        });

        refresh();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
})();
