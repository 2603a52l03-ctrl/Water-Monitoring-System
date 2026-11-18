
/* ==========================================
   AQUAMONITOR 2.0
   INTERACTIVE DASHBOARD
========================================== */

const API_URL = "/api";

let readings = [];
let readingLogs = [];
let notifications = [];
let testHistory = [];
let qualityChart = null;
let phChart = null;
let analyticsPHChart = null;
let tdsChart = null;
let consumptionChart = null;
let selectedStation = null;
let refreshTimer = null;
let calibration = { ph: 0, tds: 0 };

const stations = [
    { station: "Station Alpha", location: "Main Reservoir" },
    { station: "Station Beta", location: "North Zone" },
    { station: "Station Gamma", location: "South Zone" },
    { station: "Station Delta", location: "East Zone" },
    { station: "Station Epsilon", location: "West Zone" },
    { station: "Station Zeta", location: "Central Zone" }
];

const sampleCases = [
    { name: "Normal Water", ph: 7.2, turbidity: 2, tds: 300, temperature: 25, expected: "Safe" },
    { name: "Acidic Water", ph: 4.5, turbidity: 2, tds: 250, temperature: 25, expected: "Unsafe" },
    { name: "High Turbidity", ph: 7.1, turbidity: 10, tds: 300, temperature: 25, expected: "Unsafe" },
    { name: "High TDS", ph: 7.2, turbidity: 2, tds: 1100, temperature: 25, expected: "Unsafe" },
    { name: "Slightly Alkaline", ph: 8.8, turbidity: 2, tds: 300, temperature: 25, expected: "Warning" },
    { name: "High Temperature", ph: 7.2, turbidity: 2, tds: 300, temperature: 45, expected: "Warning" }
];

function random(min, max, decimals = 1) {
    return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

// ==========================================
// WATER QUALITY CLASSIFICATION
// Demonstration thresholds, not certification
// ==========================================

function evaluateWater(data) {
    let unsafe = false;
    let warning = false;
    const issues = [];

    if (data.ph < 6.5 || data.ph > 8.5) {
        issues.push("pH outside demonstration range");
        if (data.ph < 6 || data.ph > 9) unsafe = true;
        else warning = true;
    }

    if (data.turbidity > 5) {
        issues.push("High turbidity");
        if (data.turbidity > 10) unsafe = true;
        else warning = true;
    }

    if (data.tds > 500) {
        issues.push("High TDS");
        if (data.tds > 1000) unsafe = true;
        else warning = true;
    }

    if (data.temperature > 35 || data.temperature < 5) {
        issues.push("Temperature outside demonstration range");
        warning = true;
    }

    return {
        status: unsafe ? "Unsafe" : warning ? "Warning" : "Safe",
        issues
    };
}

// ==========================================
// DEMO DATA GENERATION
// ==========================================

function generateDemoReadings() {
    return stations.map((station, index) => {
        const data = {
            ...station,
            ph: random(6.2, 8.8, 2) + calibration.ph,
            turbidity: random(0.5, 8, 2),
            tds: Math.max(0, random(150, 850, 0) + calibration.tds),
            temperature: random(20, 36, 1),
            timestamp: new Date().toISOString()
        };

        return {
            ...data,
            ...evaluateWater(data)
        };
    });
}

// ==========================================
// INITIALIZE DASHBOARD
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    loadSavedData();
    setupNavigation();
    setupSearch();
    setupFilters();
    setupTheme();
    setupCalibration();
    setupTestLab();
    setupSettings();

    await refreshData();

    renderTestHistory();
    renderSampleTests();
    renderNotifications();

    document.getElementById("sidebarToggle")
        ?.addEventListener("click", toggleSidebar);

    document.getElementById("clearTestHistory")
        ?.addEventListener("click", clearTestHistory);

    setupSystemStatus();
});

// ==========================================
// LOAD LOCAL STORAGE
// ==========================================

function loadSavedData() {
    try {
        testHistory = JSON.parse(
            localStorage.getItem("aquaTestHistory") || "[]"
        );

        readingLogs = JSON.parse(
            localStorage.getItem("aquaReadingLogs") || "[]"
        );

        notifications = JSON.parse(
            localStorage.getItem("aquaNotifications") || "[]"
        );

        if (localStorage.getItem("aquaTheme") === "dark") {
            document.body.classList.add("dark-mode");
        }
    } catch (error) {
        console.error("Saved data could not be loaded", error);
    }
}

function saveData() {
    localStorage.setItem("aquaTestHistory", JSON.stringify(testHistory));
    localStorage.setItem("aquaReadingLogs", JSON.stringify(readingLogs));
    localStorage.setItem("aquaNotifications", JSON.stringify(notifications));
}

// ==========================================
// BACKEND CONNECTION
// ==========================================

async function refreshData() {
    try {
        let response = await fetch(`${API_URL}/refresh`, {
            method: "POST"
        });

        if (!response.ok) throw new Error("Refresh API unavailable");

        const result = await response.json();

        if (Array.isArray(result.readings)) {
            readings = result.readings;
        } else {
            const dashboardResponse = await fetch(`${API_URL}/dashboard`);
            if (!dashboardResponse.ok) throw new Error("Dashboard API unavailable");

            const dashboardData = await dashboardResponse.json();
            readings = dashboardData.readings;
        }

    } catch (error) {
        console.warn("Using local demonstration data:", error.message);
        readings = generateDemoReadings();
    }

    if (!Array.isArray(readings) || readings.length === 0) {
        readings = generateDemoReadings();
    }

    readings = readings.map(item => {
        const result = evaluateWater(item);
        return { ...item, ...result };
    });

    updateDashboard();
    updateLogs();
    updateAlerts();
    updateLiveMonitoring();
    updateStationCards();
    updateSensors();
    updateQualityIndex();
    updateConsumption();

    readingLogs.unshift(...readings.map(r => ({
        ...r,
        recordedAt: new Date().toLocaleString()
    })));

    readingLogs = readingLogs.slice(0, 100);
    saveData();
    updateSystemStatus();

    addNotification("Sensor readings refreshed successfully.");
}

// ==========================================
// DASHBOARD STATISTICS
// ==========================================

function updateDashboard() {
    const count = status =>
        readings.filter(r => r.status === status).length;

    setText("totalStations", readings.length);
    setText("safeStations", count("Safe"));
    setText("warningStations", count("Warning"));
    setText("unsafeStations", count("Unsafe"));

    setText("averagePH", average("ph").toFixed(2));
    setText("averageTDS", Math.round(average("tds")) + " PPM");

    renderStationTable();
    updateCharts();
}

function average(key) {
    if (!readings.length) return 0;

    return readings.reduce(
        (sum, item) => sum + Number(item[key]), 0
    ) / readings.length;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

// ==========================================
// NAVIGATION
// ==========================================

function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", () => {
            openPage(button.dataset.page);
        });
    });

    document.querySelectorAll("[data-goto]").forEach(button => {
        button.addEventListener("click", () => {
            openPage(button.dataset.goto);
        });
    });
}

function openPage(pageId) {
    const target = document.getElementById(pageId);

    if (!target) return;

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    target.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageId
        );
    });

    const activeButton = document.querySelector(
        `.nav-item[data-page="${pageId}"]`
    );

    setText(
        "pageSubtitle",
        activeButton
            ? activeButton.textContent.trim()
            : "Dashboard"
    );

    if (pageId === "analytics") updateCharts();
    if (pageId === "logs") updateLogs();
    if (pageId === "alerts") updateAlerts();
    if (pageId === "notifications") renderNotifications();
    if (pageId === "testlab") renderTestHistory();

    if (window.innerWidth <= 760) {
        document.getElementById("sidebar")
            ?.classList.remove("mobile-open");
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");

    if (window.innerWidth <= 760) {
        sidebar.classList.toggle("mobile-open");
    } else {
        document.querySelector(".app-layout")
            .classList.toggle("sidebar-collapsed");
    }
}

// ==========================================
// SEARCH
// ==========================================

function setupSearch() {
    const globalSearch = document.getElementById("globalSearch");

    globalSearch?.addEventListener("input", event => {
        const query = event.target.value.toLowerCase();

        openPage("stations");

        document.getElementById("stationSearch").value = query;
        renderStationCards(query);
    });

    document.getElementById("stationSearch")
        ?.addEventListener("input", event => {
            renderStationCards(event.target.value.toLowerCase());
        });
}

// ==========================================
// STATION TABLE AND FILTERS
// ==========================================

function setupFilters() {
    document.getElementById("statusFilter")
        ?.addEventListener("change", renderStationTable);
}

function renderStationTable() {
    const table = document.getElementById("readingsTable");
    if (!table) return;

    const filter = document.getElementById("statusFilter")?.value || "All";

    const filtered = readings.filter(r =>
        filter === "All" || r.status === filter
    );

    table.innerHTML = filtered.map((r, index) => `
        <tr>
            <td><strong>${escapeHTML(r.station)}</strong></td>
            <td>${r.ph}</td>
            <td>${r.turbidity} NTU</td>
            <td>${r.tds} PPM</td>
            <td>${r.temperature} °C</td>
            <td><span class="status ${r.status.toLowerCase()}">${r.status}</span></td>
            <td>
                <button onclick="showStation(${readings.indexOf(r)})">
                    View Details
                </button>
            </td>
        </tr>
    `).join("") || "<tr><td colspan='7'>No stations found.</td></tr>";
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================
// STATION CARDS
// ==========================================

function updateStationCards() {
    renderStationCards("");
}

function renderStationCards(query) {
    const container = document.getElementById("stationCards");
    if (!container) return;

    const filtered = readings.filter(r =>
        r.station.toLowerCase().includes(query) ||
        r.location.toLowerCase().includes(query)
    );

    container.innerHTML = filtered.map(r => `
        <div class="station-card"
             onclick="selectStation('${escapeHTML(r.station)}')">

            <h5>📍 ${escapeHTML(r.station)}</h5>
            <p>${escapeHTML(r.location)}</p>
            <h3>${r.ph} pH</h3>
            <span class="status ${r.status.toLowerCase()}">${r.status}</span>
        </div>
    `).join("") || "<p>No matching stations found.</p>";
}

function selectStation(name) {
    const station = readings.find(r => r.station === name);
    if (!station) return;

    selectedStation = name;

    const details = document.getElementById("stationDetails");

    details.innerHTML = `
        <h5>${escapeHTML(station.station)}</h5>
        <p>Location: ${escapeHTML(station.location)}</p>
        <p>pH: ${station.ph}</p>
        <p>Turbidity: ${station.turbidity} NTU</p>
        <p>TDS: ${station.tds} PPM</p>
        <p>Temperature: ${station.temperature} °C</p>
        <p>Status: <strong>${station.status}</strong></p>
    `;

    document.querySelectorAll(".station-card").forEach(card => {
        card.classList.toggle(
            "selected",
            card.querySelector("h5")?.textContent.includes(name)
        );
    });
}

function showStation(index) {
    const r = readings[index];
    if (!r) return;

    const body = document.getElementById("stationModalBody");

    body.innerHTML = `
        <h5>${escapeHTML(r.station)}</h5>
        <p>Location: ${escapeHTML(r.location)}</p>
        <hr>
        <p>pH: ${r.ph}</p>
        <p>Turbidity: ${r.turbidity} NTU</p>
        <p>TDS: ${r.tds} PPM</p>
        <p>Temperature: ${r.temperature} °C</p>
        <p>Status: ${r.status}</p>
        <p>Issues: ${r.issues.join(", ") || "None detected"}</p>
    `;

    if (window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(
            document.getElementById("stationModal")
        ).show();
    } else {
        alert(`${r.station}: ${r.status}`);
    }
}

// ==========================================
// SENSOR DETAILS
// ==========================================

function updateSensors() {
    const container = document.getElementById("sensorDetails");
    if (!container) return;

    const sensors = [
        ["pH Sensor", "ph", "pH"],
        ["Turbidity Sensor", "turbidity", "NTU"],
        ["TDS Sensor", "tds", "PPM"],
        ["Temperature Sensor", "temperature", "°C"]
    ];

    container.innerHTML = sensors.map(([name, key, unit]) => `
        <div class="sensor-card">
            <h5>🔬 ${name}</h5>
            <h2>${average(key).toFixed(2)} ${unit}</h2>
            <p>Average across ${readings.length} stations</p>
            <span class="status safe">Simulated sensor</span>
        </div>
    `).join("");
}

function updateLiveMonitoring() {
    const container = document.getElementById("liveReadings");
    if (!container) return;

    container.innerHTML = readings.map(r => `
        <div class="sensor-card">
            <h5>${escapeHTML(r.station)}</h5>
            <p>pH: ${r.ph}</p>
            <p>Turbidity: ${r.turbidity} NTU</p>
            <p>TDS: ${r.tds} PPM</p>
            <p>Temperature: ${r.temperature} °C</p>
            <span class="status ${r.status.toLowerCase()}">${r.status}</span>
        </div>
    `).join("");
}

// ==========================================
// CHARTS
// ==========================================

function makeChart(id, oldChart, config) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return oldChart;

    if (oldChart) oldChart.destroy();

    return new Chart(canvas, config);
}

function updateCharts() {
    const safe = readings.filter(r => r.status === "Safe").length;
    const warning = readings.filter(r => r.status === "Warning").length;
    const unsafe = readings.filter(r => r.status === "Unsafe").length;

    const labels = readings.map(r => r.station);

    qualityChart = makeChart("qualityChart", qualityChart, {
        type: "doughnut",
        data: {
            labels: ["Safe", "Warning", "Unsafe"],
            datasets: [{
                data: [safe, warning, unsafe],
                backgroundColor: ["#16a36a", "#e9a326", "#dc4653"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });

    phChart = makeChart("phChart", phChart, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "pH Level",
                data: readings.map(r => r.ph),
                backgroundColor: "#087fba"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { min: 0, max: 14 }
            }
        }
    });

    analyticsPHChart = makeChart(
        "analyticsPHChart",
        analyticsPHChart,
        {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "pH Levels",
                    data: readings.map(r => r.ph),
                    borderColor: "#08a5ad",
                    tension: 0.3
                }]
            },
            options: { responsive: true }
        }
    );

    tdsChart = makeChart("tdsChart", tdsChart, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "TDS (PPM)",
                data: readings.map(r => r.tds),
                backgroundColor: "#1686c5"
            }]
        },
        options: { responsive: true }
    });
}

// ==========================================
// WATER QUALITY INDEX
// Illustrative score, not official WQI
// ==========================================

function calculateScore(r) {
    let score = 100;

    score -= Math.abs(r.ph - 7) * 8;
    score -= Math.max(0, r.turbidity - 1) * 3;
    score -= Math.max(0, r.tds - 300) * 0.04;
    score -= Math.max(0, r.temperature - 30) * 1.5;

    return Math.max(0, Math.min(100, Math.round(score)));
}

function updateQualityIndex() {
    const container = document.getElementById("qualityIndex");
    if (!container) return;

    container.innerHTML = readings.map(r => {
        const score = calculateScore(r);

        return `
            <div class="mb-4">
                <strong>${escapeHTML(r.station)}</strong>
                <h3>${score}/100</h3>
                <div class="progress" style="height:12px">
                    <div class="progress-bar"
                         role="progressbar"
                         style="width:${score}%;background:#08a5ad">
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================
// CONSUMPTION
// Demonstration-only usage figures
// ==========================================

function updateConsumption() {
    const container = document.getElementById("consumptionDetails");
    if (!container) return;

    container.innerHTML = readings.map((r, i) => `
        <p>
            <strong>${escapeHTML(r.station)}</strong>
            <span style="float:right">${(random(100, 800, 0))} L</span>
        </p>
        <hr>
    `).join("");

    const values = [450, 520, 390, 610, 700, 550, 620];

    consumptionChart = makeChart(
        "consumptionChart",
        consumptionChart,
        {
            type: "line",
            data: {
                labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                datasets: [{
                    label: "Estimated usage (L)",
                    data: values,
                    borderColor: "#087fba",
                    tension: 0.3
                }]
            },
            options: { responsive: true }
        }
    );
}

// ==========================================
// TEST LAB
// ==========================================

function setupTestLab() {
    document.getElementById("testForm")
        ?.addEventListener("submit", event => {
            event.preventDefault();

            const test = {
                name: document.getElementById("testName").value,
                ph: Number(document.getElementById("testPH").value),
                turbidity: Number(document.getElementById("testTurbidity").value),
                tds: Number(document.getElementById("testTDS").value),
                temperature: Number(document.getElementById("testTemperature").value)
            };

            if (
                !test.name.trim() ||
                !Number.isFinite(test.ph) ||
                test.ph < 0 || test.ph > 14 ||
                !Number.isFinite(test.turbidity) || test.turbidity < 0 ||
                !Number.isFinite(test.tds) || test.tds < 0 ||
                !Number.isFinite(test.temperature) ||
                test.temperature < -10 || test.temperature > 100
            ) {
                alert("Please enter valid sensor values.");
                return;
            }

            runCustomTest(test);
        });

    document.getElementById("runSampleTests")
        ?.addEventListener("click", runAllSampleTests);
}

function runCustomTest(test) {
    const result = evaluateWater(test);

    const record = {
        ...test,
        status: result.status,
        issues: result.issues,
        date: new Date().toLocaleString()
    };

    testHistory.unshift(record);
    testHistory = testHistory.slice(0, 100);

    saveData();
    renderTestHistory();

    document.getElementById("testResult").innerHTML = `
        <div class="alert-item ${result.status === "Unsafe" ? "unsafe-alert" : result.status === "Safe" ? "safe-alert" : ""}">
            <h5>Test Result: ${result.status}</h5>
            <p>Test: ${escapeHTML(test.name)}</p>
            <p>pH: ${test.ph} | Turbidity: ${test.turbidity} NTU</p>
            <p>TDS: ${test.tds} PPM | Temperature: ${test.temperature} °C</p>
            <p>Issues: ${result.issues.join(", ") || "No issues detected"}</p>
        </div>
    `;

    addNotification(`Test "${test.name}" completed: ${result.status}.`);
}

function runAllSampleTests() {
    sampleCases.forEach(test => {
        const result = evaluateWater(test);

        testHistory.unshift({
            ...test,
            status: result.status,
            issues: result.issues,
            date: new Date().toLocaleString(),
            testResult: result.status === test.expected ? "PASS" : "CHECK"
        });
    });

    testHistory = testHistory.slice(0, 100);
    saveData();
    renderTestHistory();

    alert("All sample tests have been completed. Check the test history.");
}

function renderSampleTests() {
    const container = document.getElementById("sampleTests");
    if (!container) return;

    container.innerHTML = `
        <div class="table-responsive">
        <table class="table">
            <thead>
                <tr>
                    <th>Test Case</th>
                    <th>pH</th>
                    <th>Turbidity</th>
                    <th>TDS</th>
                    <th>Expected</th>
                </tr>
            </thead>
            <tbody>
                ${sampleCases.map(t => `
                    <tr>
                        <td>${escapeHTML(t.name)}</td>
                        <td>${t.ph}</td>
                        <td>${t.turbidity}</td>
                        <td>${t.tds}</td>
                        <td>${t.expected}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        </div>
    `;
}

function renderTestHistory() {
    const container = document.getElementById("testHistory");
    if (!container) return;

    if (!testHistory.length) {
        container.innerHTML = "<p>No tests have been performed yet.</p>";
        return;
    }

    container.innerHTML = `
        <div class="table-responsive">
        <table class="table">
            <thead>
                <tr>
                    <th>Test</th>
                    <th>pH</th>
                    <th>Turbidity</th>
                    <th>TDS</th>
                    <th>Status</th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
                ${testHistory.map(t => `
                    <tr>
                        <td>${escapeHTML(t.name)}</td>
                        <td>${t.ph}</td>
                        <td>${t.turbidity}</td>
                        <td>${t.tds}</td>
                        <td><span class="status ${t.status.toLowerCase()}">${t.status}</span></td>
                        <td>${escapeHTML(t.date || "")}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        </div>
    `;
}

function clearTestHistory() {
    if (!confirm("Are you sure you want to clear test history?")) return;

    testHistory = [];
    saveData();
    renderTestHistory();
}

// ==========================================
// ALERTS AND NOTIFICATIONS
// ==========================================

function updateAlerts() {
    const container = document.getElementById("allAlerts");
    const dashboard = document.getElementById("dashboardAlerts");

    const problems = readings.filter(r => r.status !== "Safe");

    const html = problems.length
        ? problems.map(r => `
            <div class="alert-item ${r.status === "Unsafe" ? "unsafe-alert" : ""}">
                <strong>${r.status}:</strong>
                ${escapeHTML(r.station)} -
                ${escapeHTML(r.issues.join(", "))}
            </div>
        `).join("")
        : `<div class="alert-item safe-alert">All simulated stations currently show safe readings.</div>`;

    if (container) container.innerHTML = html;
    if (dashboard) dashboard.innerHTML = html;
}

function addNotification(message) {
    notifications.unshift({
        message,
        time: new Date().toLocaleString()
    });

    notifications = notifications.slice(0, 50);
    saveData();
    renderNotifications();
}

function renderNotifications() {
    const container = document.getElementById("notificationList");
    if (!container) return;

    container.innerHTML = notifications.length
        ? notifications.map(n => `
            <div class="alert-item safe-alert">
                ${escapeHTML(n.message)}
                <br><small>${escapeHTML(n.time)}</small>
            </div>
        `).join("")
        : "<p>No notifications available.</p>";
}

// ==========================================
// DATA LOGS
// ==========================================

function updateLogs() {
    const container = document.getElementById("logsTable");
    if (!container) return;

    container.innerHTML = readingLogs.map(r => `
        <tr>
            <td>${escapeHTML(r.recordedAt || "")}</td>
            <td>${escapeHTML(r.station)}</td>
            <td>${r.ph}</td>
            <td>${r.tds}</td>
            <td>${r.turbidity}</td>
            <td><span class="status ${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>
    `).join("") || "<tr><td colspan='6'>No readings recorded.</td></tr>";
}

// ==========================================
// CSV EXPORT
// ==========================================

function exportCSV() {
    if (!readings.length) {
        alert("No readings available to export.");
        return;
    }

    const columns = [
        "Station", "Location", "pH",
        "Turbidity", "TDS", "Temperature", "Status"
    ];

    const rows = readings.map(r => [
        r.station, r.location, r.ph,
        r.turbidity, r.tds, r.temperature, r.status
    ]);

    const csv = [columns, ...rows]
        .map(row => row.map(value =>
            `"${String(value).replace(/"/g, '""')}"`
        ).join(","))
        .join("\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "AquaMonitor_Readings.csv";
    link.click();

    URL.revokeObjectURL(url);
    addNotification("CSV report downloaded.");
}

// ==========================================
// DARK MODE
// ==========================================

function setupTheme() {
    const button = document.getElementById("themeToggle");

    function updateThemeButton() {
        if (button) {
            button.textContent = document.body.classList.contains("dark-mode")
                ? "☀️ Toggle Light Mode"
                : "🌙 Toggle Dark Mode";
        }
    }

    updateThemeButton();

    button?.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");

        localStorage.setItem(
            "aquaTheme",
            document.body.classList.contains("dark-mode") ? "dark" : "light"
        );

        updateThemeButton();
        updateCharts();
    });
}

// ==========================================
// CALIBRATION
// Applies adjustments to demo readings
// ==========================================

function setupCalibration() {
    const ph = document.getElementById("phCalibration");
    const tds = document.getElementById("tdsCalibration");

    ph?.addEventListener("input", () => {
        setText("phCalibrationValue", ph.value);
    });

    tds?.addEventListener("input", () => {
        setText("tdsCalibrationValue", tds.value);
    });

    document.getElementById("applyCalibration")
        ?.addEventListener("click", async () => {
            calibration.ph = Number(ph.value);
            calibration.tds = Number(tds.value);

            await refreshData();
            addNotification("Simulated calibration applied.");
        });

    document.getElementById("resetCalibration")
        ?.addEventListener("click", async () => {
            calibration = { ph: 0, tds: 0 };

            ph.value = 0;
            tds.value = 0;

            setText("phCalibrationValue", "0");
            setText("tdsCalibrationValue", "0");

            await refreshData();
            addNotification("Simulated calibration reset.");
        });
}

// ==========================================
// SETTINGS
// ==========================================

function setupSettings() {
    const select = document.getElementById("refreshInterval");
    if (!select) return;

    select.value = localStorage.getItem("aquaRefreshInterval") || "0";

    document.getElementById("saveSettings")
        ?.addEventListener("click", () => {
            localStorage.setItem("aquaRefreshInterval", select.value);
            configureAutoRefresh();
            alert("Dashboard preferences saved.");
        });

    configureAutoRefresh();
}

function configureAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);

    const seconds = Number(
        localStorage.getItem("aquaRefreshInterval") || "0"
    );

    if (seconds > 0) {
        refreshTimer = setInterval(refreshData, seconds * 1000);
    }
}

// ==========================================
// SYSTEM STATUS
// ==========================================

async function setupSystemStatus() {
    updateSystemStatus();

    try {
        const response = await fetch(`${API_URL}/dashboard`);
        setText(
            "systemStatus",
            response.ok
                ? "Backend API: Connected"
                : "Backend API: Responding with an error"
        );
    } catch {
        setText("systemStatus", "Backend API: Offline (Demo Mode Active)");
    }
}

function updateSystemStatus() {
    const container = document.getElementById("systemStatus");
    if (!container) return;

    container.innerHTML = `
        <p>Frontend: <strong>Running</strong></p>
        <p>Chart.js: <strong>${window.Chart ? "Available" : "Unavailable"}</strong></p>
        <p>LocalStorage: <strong>Available</strong></p>
        <p>Monitoring stations: <strong>${readings.length}</strong></p>
        <p>Data mode: <strong>${readings.length ? "Simulated readings" : "Waiting for data"}</strong></p>
    `;
}
