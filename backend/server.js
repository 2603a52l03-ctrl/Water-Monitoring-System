
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Generate random water readings
function generateReading(id, station) {
    const ph = Number((Math.random() * 4 + 5).toFixed(2));
    const turbidity = Number((Math.random() * 8).toFixed(2));
    const tds = Math.floor(Math.random() * 650 + 100);
    const temperature = Number((Math.random() * 12 + 20).toFixed(1));

    let status = "Safe";

    if (ph < 6.5 || ph > 8.5 || turbidity > 5 || tds > 500) {
        status = "Unsafe";
    } else if (ph < 6.8 || ph > 8.2 || turbidity > 3 || tds > 400) {
        status = "Warning";
    }

    return {
        id,
        station,
        ph,
        turbidity,
        tds,
        temperature,
        status,
        time: new Date().toLocaleTimeString()
    };
}

// Create sample monitoring stations
const stations = [
    "Central Water Plant",
    "North Zone Station",
    "South Zone Station",
    "East Zone Station",
    "West Zone Station",
    "Lake Monitoring Unit"
];

let readings = [];

function generateAllReadings() {
    readings = stations.map((station, index) =>
        generateReading(index + 1, station)
    );
}

generateAllReadings();

// Dashboard API
app.get("/api/dashboard", (req, res) => {
    const total = readings.length;
    const safe = readings.filter(r => r.status === "Safe").length;
    const warning = readings.filter(r => r.status === "Warning").length;
    const unsafe = readings.filter(r => r.status === "Unsafe").length;

    const averagePH = (
        readings.reduce((sum, r) => sum + r.ph, 0) / total
    ).toFixed(2);

    res.json({
        totalStations: total,
        safeStations: safe,
        warningStations: warning,
        unsafeStations: unsafe,
        averagePH,
        readings
    });
});

// Get all sensor readings
app.get("/api/readings", (req, res) => {
    res.json(readings);
});

// Refresh and generate new random readings
app.post("/api/refresh", (req, res) => {
    generateAllReadings();

    res.json({
        message: "New water readings generated successfully",
        readings
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Smart Water Monitoring Server running on port ${PORT}`);
});
