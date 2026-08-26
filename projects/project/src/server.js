// src/server.js
//
// Entry point. Loads environment variables, then starts the HTTP server.

require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Document Knowledge API listening on http://localhost:${PORT}`);
});
