// src/routes/documentRoutes.js
//
// Maps URLs + HTTP methods to controller functions. No logic lives here
// on purpose — it's just a table of routes.

const express = require("express");
const router = express.Router();
const controller = require("../controllers/documentController");

// CRUD
router.post("/documents", controller.createDocument);
router.get("/documents", controller.getDocuments);
router.get("/documents/:id", controller.getDocument);
router.put("/documents/:id", controller.updateDocument);
router.delete("/documents/:id", controller.deleteDocument);

// Embedding
router.post("/documents/:id/embed", controller.embedDocument);

// Vector search (query string, e.g. /api/search?query=nodejs backend)
router.get("/search", controller.searchDocuments);

// RAG question answering
router.post("/ask", controller.askQuestion);

module.exports = router;
