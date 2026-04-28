const KnowledgeBase = require('../models/KnowledgeBase');
const { generateEmbedding } = require('./openaiService');
const logger = require('../utils/logger');

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

async function retrieveContext(sourceCode, language) {
  try {
    const queryEmbedding = await generateEmbedding(sourceCode);

    if (queryEmbedding) {
      const candidates = await KnowledgeBase.find({
        language: { $in: [language, 'general'] },
        embedding: { $exists: true, $ne: [] },
      }).lean();

      if (candidates.length === 0) {
        logger.info('No embedded knowledge base entries found, using keyword fallback');
        return keywordFallback(language);
      }

      const scored = candidates
        .map(doc => ({ ...doc, similarity: cosineSimilarity(queryEmbedding, doc.embedding) }))
        .sort((a, b) => b.similarity - a.similarity);

      const relevant = scored.slice(0, 5).filter(doc => doc.similarity >= 0.3);

      if (relevant.length === 0) {
        logger.info('No entries above similarity threshold, using keyword fallback');
        return keywordFallback(language);
      }

      const context = relevant
        .map(doc => `[${doc.category}] ${doc.title}:\n${doc.content}`)
        .join('\n\n---\n\n');

      logger.info(`RAG retrieved ${relevant.length} docs (top similarity: ${relevant[0].similarity.toFixed(3)})`);
      return context;
    }

    // No embedding support — fall back to keyword-based retrieval
    return keywordFallback(language);
  } catch (error) {
    logger.error(`RAG retrieval failed: ${error.message}`);
    return '';
  }
}

async function keywordFallback(language) {
  try {
    const entries = await KnowledgeBase.find({
      language: { $in: [language, 'general'] },
    })
      .sort({ category: 1 })
      .limit(5)
      .lean();

    if (entries.length === 0) return '';

    const context = entries
      .map(doc => `[${doc.category}] ${doc.title}:\n${doc.content}`)
      .join('\n\n---\n\n');

    logger.info(`RAG keyword fallback: retrieved ${entries.length} entries for ${language}`);
    return context;
  } catch (err) {
    logger.error(`Keyword fallback failed: ${err.message}`);
    return '';
  }
}

async function indexDocument(doc) {
  try {
    const embedding = await generateEmbedding(`${doc.title}\n${doc.content}`);
    await KnowledgeBase.findByIdAndUpdate(doc._id, { embedding });
    logger.info(`Indexed document: ${doc.title}`);
    return true;
  } catch (error) {
    logger.error(`Document indexing failed: ${error.message}`);
    return false;
  }
}

async function indexAllDocuments() {
  const docs = await KnowledgeBase.find({ embedding: { $size: 0 } });
  logger.info(`Indexing ${docs.length} unindexed documents...`);

  let indexed = 0;
  for (const doc of docs) {
    const success = await indexDocument(doc);
    if (success) indexed++;
  }

  logger.info(`Indexed ${indexed}/${docs.length} documents`);
  return indexed;
}

module.exports = { retrieveContext, indexDocument, indexAllDocuments };
