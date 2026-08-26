// src/app.js
//
// Configures the Express app (middleware + routes). Kept separate from
// server.js so Jest/Supertest can import the app WITHOUT starting a real
// server listening on a port (see tests/employee.test.js).

const express = require("express");
const cors = require("cors");
const employeeRoutes = require("./routes/employeeRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Used by the Jenkins pipeline's Health Check stage, and by Docker
// Compose's "wait until the API is really ready" checks.
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/api", employeeRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized error handler — every controller calls next(err) on
// failure and it lands here, so there's one place that decides how
// errors become HTTP responses.
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === "ECONNREFUSED") {
    return res.status(503).json({ error: "Database is unreachable" });
  }
  if (err.code === "22P02") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  res.status(500).json({ error: "Internal server error", details: err.message });
});

module.exports = app;
