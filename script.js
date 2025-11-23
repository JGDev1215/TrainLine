document.addEventListener('DOMContentLoaded', () => {
    const departuresList = document.getElementById('departures-list');
    const fenchurchStreetList = document.getElementById('fenchurch-street-list');
    const southendList = document.getElementById('southend-list');
    const clockElement = document.getElementById('clock');

    // Update clock every second
    function updateClock() {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Fetch departures
    async function fetchDepartures() {
        try {
            const response = await fetch('/api/departures');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            renderDepartures(data.trainServices);
        } catch (error) {
            console.error('Error fetching departures:', error);
            departuresList.innerHTML = `
                <div class="loading-state">
                    <p style="color: var(--status-cancelled)">Failed to load data.</p>
                    <p style="font-size: 0.8rem">Retrying shortly...</p>
                </div>
            `;
        }
    }

    // Fetch arrivals from Fenchurch Street
    async function fetchFenchurchStreet() {
        try {
            const response = await fetch('/api/arrivals/fenchurch-street');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            renderTrains(fenchurchStreetList, data.trainServices || []);
        } catch (error) {
            console.error('Error fetching Fenchurch Street data:', error);
            fenchurchStreetList.innerHTML = `
                <div class="loading-state">
                    <p style="color: var(--status-cancelled)">Failed to load data.</p>
                </div>
            `;
        }
    }

    // Fetch arrivals from Southend
    async function fetchSouthend() {
        try {
            const response = await fetch('/api/arrivals/southend');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            renderTrains(southendList, data.trainServices || []);
        } catch (error) {
            console.error('Error fetching Southend data:', error);
            southendList.innerHTML = `
                <div class="loading-state">
                    <p style="color: var(--status-cancelled)">Failed to load data.</p>
                </div>
            `;
        }
    }

    function renderTrains(container, services) {
        if (!services || services.length === 0) {
            container.innerHTML = `
                <div class="loading-state">
                    <p>No trains found.</p>
                </div>
            `;
            return;
        }

        const html = services.map(service => {
            const destination = service.destination[0].locationName;
            const via = service.destination[0].via ? service.destination[0].via : '';
            const scheduledTime = service.std;
            const estimatedTime = service.etd;
            const platform = service.platform || '-';

            let statusClass = 'status-ontime';
            let statusText = estimatedTime;

            if (estimatedTime === 'On time') {
                statusClass = 'status-ontime';
            } else if (estimatedTime === 'Cancelled') {
                statusClass = 'status-cancelled';
                statusText = 'Cancelled';
            } else if (estimatedTime === 'Delayed') {
                statusClass = 'status-delayed';
                statusText = 'Delayed';
            } else {
                statusClass = 'status-delayed';
            }

            return `
                <div class="departure-row">
                    <div class="col-time">${scheduledTime}</div>
                    <div class="col-dest">
                        ${destination}
                        ${via ? `<span class="via-text">${via}</span>` : ''}
                    </div>
                    <div class="col-plat">${platform}</div>
                    <div class="col-status ${statusClass}">${statusText}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    function renderDepartures(services) {
        renderTrains(departuresList, services);
    }

    // Initial fetch and auto-refresh
    fetchDepartures();
    fetchFenchurchStreet();
    fetchSouthend();
    setInterval(fetchDepartures, 30000); // Refresh every 30 seconds
    setInterval(fetchFenchurchStreet, 30000);
    setInterval(fetchSouthend, 30000);

    // Countdown Logic
    let nextTrainPlat1 = null;
    let nextTrainPlat2 = null;

    function parseTime(timeStr) {
        if (!timeStr) return null;
        const now = new Date();
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(now);
        date.setHours(hours, minutes, 0, 0);

        // If time is in the past (e.g. near midnight), add a day? 
        // For simplicity, if it's more than 12 hours ago, assume it's tomorrow.
        // But for this simple app, we'll just assume today.
        // Actually, better check: if parsed time is < now - 1 hour, maybe it's tomorrow?
        // Let's keep it simple: just use the time.

        return date;
    }

    function updateCountdowns() {
        const now = new Date();

        updateSingleCountdown('timer-plat-1', 'dest-plat-1', nextTrainPlat1, now);
        updateSingleCountdown('timer-plat-2', 'dest-plat-2', nextTrainPlat2, now);
    }

    function updateSingleCountdown(timerId, destId, train, now) {
        const timerEl = document.getElementById(timerId);
        const destEl = document.getElementById(destId);

        if (!train) {
            timerEl.textContent = '--:--';
            destEl.textContent = 'Waiting...';
            return;
        }

        destEl.textContent = train.destination;

        // If estimated time is "On time", use scheduled time.
        // If it's a time (e.g. "17:55"), use that.
        // If "Delayed", we might not have a time, so fallback to scheduled.
        // If "Cancelled", ignore.

        let targetTimeStr = train.std;
        if (train.etd && train.etd.includes(':')) {
            targetTimeStr = train.etd;
        }

        const targetTime = parseTime(targetTimeStr);

        if (!targetTime) {
            timerEl.textContent = '--:--';
            return;
        }

        const diff = targetTime - now;

        if (diff < 0) {
            // Train should have left or is leaving
            timerEl.textContent = 'Due';
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    setInterval(updateCountdowns, 1000);

    // Hook into renderDepartures to update next trains
    const originalRender = renderDepartures;
    renderDepartures = function (services) {
        originalRender(services);

        // Reset
        nextTrainPlat1 = null;
        nextTrainPlat2 = null;

        if (services) {
            // Find first train for Plat 1
            const p1 = services.find(s => s.platform === '1' && s.etd !== 'Cancelled');
            if (p1) {
                nextTrainPlat1 = {
                    destination: p1.destination[0].locationName,
                    std: p1.std,
                    etd: p1.etd
                };
            }

            // Find first train for Plat 2
            const p2 = services.find(s => s.platform === '2' && s.etd !== 'Cancelled');
            if (p2) {
                nextTrainPlat2 = {
                    destination: p2.destination[0].locationName,
                    std: p2.std,
                    etd: p2.etd
                };
            }
        }
        updateCountdowns();
    };
});
