// src/services/embeddingService.js
//
// This is the ONLY file that talks to the embedding model. Everything
// else in the app just calls embedText(someString) and gets back an
// array of 1536 numbers.
//
// THE FLOW THIS FILE IMPLEMENTS:
//
//   Text ("Node.js is a JavaScript runtime...")
//     ↓
//   LangChain's OpenAIEmbeddings wrapper
//     ↓
//   OpenAI's embedding model (text-embedding-3-small)
//     ↓
//   Vector: [0.0123, -0.0456, 0.0789, ... ]  (1536 numbers)
//
// WHAT IS AN EMBEDDING?
// It's a list of numbers that represents the MEANING of a piece of text
// as a point in a high-dimensional space. Texts with similar meaning end
// up as points that are close together; unrelated texts end up far apart.
// "Node.js is a JS runtime" and "Node.js lets you run JavaScript on the
// server" would produce vectors that are close together, even though the
// wording is different — because the embedding model captures meaning,
// not just matching words.
//
// WHAT DOES LANGCHAIN ADD HERE?
// Nothing magical — OpenAIEmbeddings is a thin wrapper around OpenAI's
// embeddings API. We use it because the same LangChain interface
// (`.embedQuery()`) works if you swap OpenAI for a different embedding
// provider later, without changing any other file in this app.

const { OpenAIEmbeddings } = require("@langchain/openai");

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY is not set. Copy .env.example to .env and fill it in."
  );
}

// text-embedding-3-small always returns vectors of 1536 numbers.
// This MUST match the `vector(1536)` column defined in db/init.sql.
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
});

/**
 * Turns a piece of text into an embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>} an array of 1536 numbers
 */
async function embedText(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("embedText requires a non-empty string");
  }

  // .embedQuery() sends the text to OpenAI and returns the vector.
  // (LangChain also has .embedDocuments() for embedding many texts at
  // once in a single batched call — not needed for this simple project.)
  const vector = await embeddings.embedQuery(text);
  return vector;
}

module.exports = { embedText };
