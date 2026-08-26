// src/services/vectorSearchService.js
//
// This file is the ONLY place that writes raw SQL involving the
// `embedding` column. It has two jobs:
//   1. Save a vector onto a document row.
//   2. Given a vector, find the most similar documents.

const pool = require("../config/db");

/**
 * pgvector expects vectors as a string like "[0.1,0.2,0.3]" when you pass
 * them through node-postgres (the pg driver doesn't know about the
 * "vector" type natively, so we send it as text and cast it in SQL with
 * ::vector). This helper does that conversion.
 */
function toVectorLiteral(vector) {
  return `[${vector.join(",")}]`;
}

/**
 * Stores an embedding vector on an existing document row.
 * @param {number} documentId
 * @param {number[]} vector
 */
async function storeEmbedding(documentId, vector) {
  const literal = toVectorLiteral(vector);

  const result = await pool.query(
    `UPDATE documents
     SET embedding = $1::vector,
         updated_at = now()
     WHERE id = $2
     RETURNING id, title`,
    [literal, documentId]
  );

  if (result.rows.length === 0) {
    throw new Error(`No document found with id ${documentId}`);
  }

  return result.rows[0];
}

/**
 * Finds the documents whose embeddings are most similar to the given
 * query vector, using cosine similarity.
 *
 * THE QUERY, EXPLAINED LINE BY LINE:
 *
 *   SELECT id, title, content,
 *          1 - (embedding <=> $1::vector) AS similarity
 *
 *     `<=>` is pgvector's COSINE DISTANCE operator. Cosine distance
 *     measures the angle between two vectors, ignoring their length —
 *     it answers "do these two vectors point in the same direction?"
 *     which, for embeddings, corresponds to "do these two texts mean
 *     similar things?". Distance ranges from 0 (identical direction) to
 *     2 (opposite direction).
 *
 *     Cosine SIMILARITY is just `1 - distance`, so it ranges from 1
 *     (identical) down to -1 (opposite), with 0 meaning "unrelated".
 *     We compute it here so the API returns an intuitive "higher is
 *     more similar" number instead of a distance where lower is better.
 *
 *   FROM documents
 *   WHERE embedding IS NOT NULL
 *
 *     Skip any document that hasn't been embedded yet (its `embedding`
 *     column is still NULL because /embed was never called on it) —
 *     comparing against NULL would just produce NULL results.
 *
 *   ORDER BY embedding <=> $1::vector
 *
 *     Sort by raw cosine DISTANCE ascending (smallest distance =
 *     most similar first). We sort by distance rather than by the
 *     `similarity` alias because that's what lets pgvector use its
 *     distance operator directly and, if you add an index later
 *     (see db/init.sql), take advantage of it.
 *
 *   LIMIT $2
 *
 *     Only return the top N closest matches.
 *
 * @param {number[]} queryVector
 * @param {number} limit
 */
async function searchSimilar(queryVector, limit = 5) {
  const literal = toVectorLiteral(queryVector);

  const result = await pool.query(
    `SELECT
       id,
       title,
       content,
       1 - (embedding <=> $1::vector) AS similarity
     FROM documents
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [literal, limit]
  );

  return result.rows;
}

module.exports = { storeEmbedding, searchSimilar };
