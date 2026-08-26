// src/server.js
//
// Entry point — the only file that actually starts listening on a port.
// (Tests import app.js directly and never run this file.)

require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Employee CRUD API listening on http://localhost:${PORT}`);
});
