// src/controllers/documentController.js
//
// Route handlers only. Each function reads the request, calls into the
// database or a service, and sends a response. Business logic that talks
// to OpenAI or runs vector SQL lives in src/services/*, not here.

const pool = require("../config/db");
const { embedText } = require("../services/embeddingService");
const { storeEmbedding, searchSimilar } = require("../services/vectorSearchService");
const { ChatOpenAI } = require("@langchain/openai");

// ---------- CRUD ----------

async function createDocument(req, res, next) {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required" });
    }

    const result = await pool.query(
      `INSERT INTO documents (title, content)
       VALUES ($1, $2)
       RETURNING id, title, content, embedding, created_at, updated_at`,
      [title, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getDocuments(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, title, content, created_at, updated_at,
              (embedding IS NOT NULL) AS has_embedding
       FROM documents
       ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getDocument(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, title, content, created_at, updated_at,
              (embedding IS NOT NULL) AS has_embedding
       FROM documents WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Document ${id} not found` });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateDocument(req, res, next) {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title && !content) {
      return res
        .status(400)
        .json({ error: "Provide at least one of: title, content" });
    }

    // Note: we intentionally do NOT re-embed automatically on update.
    // If the content changes, the old embedding is now stale — call
    // POST /api/documents/:id/embed again to refresh it. Keeping this
    // explicit (rather than automatic) keeps the flow easy to follow.
    const result = await pool.query(
      `UPDATE documents
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = now()
       WHERE id = $3
       RETURNING id, title, content, created_at, updated_at`,
      [title, content, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Document ${id} not found` });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM documents WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Document ${id} not found` });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------- Embedding ----------

async function embedDocument(req, res, next) {
  try {
    const { id } = req.params;

    const docResult = await pool.query(
      `SELECT id, content FROM documents WHERE id = $1`,
      [id]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: `Document ${id} not found` });
    }

    const { content } = docResult.rows[0];

    // Text -> LangChain -> OpenAI embedding model -> vector
    const vector = await embedText(content);

    // vector -> PostgreSQL (pgvector column)
    await storeEmbedding(id, vector);

    res.json({
      message: `Document ${id} embedded successfully`,
      dimensions: vector.length,
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Vector search ----------

async function searchDocuments(req, res, next) {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "query parameter is required" });
    }

    // 1. Turn the search text into a vector, same as embedding a document.
    const queryVector = await embedText(query);

    // 2. Ask Postgres/pgvector which stored documents are closest to it.
    const results = await searchSimilar(queryVector, 5);

    res.json({ query, results });
  } catch (err) {
    next(err);
  }
}

// ---------- RAG: retrieval-augmented question answering ----------

let chatModel; // created lazily so a missing API key doesn't crash at import time
function getChatModel() {
  if (!chatModel) {
    chatModel = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
      temperature: 0,
    });
  }
  return chatModel;
}

async function askQuestion(req, res, next) {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    // Step 1: question -> embedding
    const questionVector = await embedText(question);

    // Step 2: pgvector similarity search -> top 3 relevant documents
    const topDocs = await searchSimilar(questionVector, 3);

    if (topDocs.length === 0) {
      return res.json({
        question,
        answer:
          "I don't have any embedded documents to search yet. Create and embed some documents first.",
        sources: [],
      });
    }

    // Step 3: build a prompt containing the retrieved documents as context
    const context = topDocs
      .map((doc, i) => `Document ${i + 1} (title: ${doc.title}):\n${doc.content}`)
      .join("\n\n");

    const prompt = `Answer the question using ONLY the context below. If the context doesn't contain the answer, say you don't know.

Context:
${context}

Question: ${question}

Answer:`;

    // Step 4: send the prompt to the LLM via LangChain
    const response = await getChatModel().invoke(prompt);

    res.json({
      question,
      answer: response.content,
      sources: topDocs.map((d) => ({ id: d.id, title: d.title, similarity: d.similarity })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDocument,
  getDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  embedDocument,
  searchDocuments,
  askQuestion,
};
