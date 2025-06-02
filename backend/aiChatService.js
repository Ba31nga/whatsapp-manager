// File: backend/aiChatService.js

const { getAllQA } = require('./googleSheetsService');
const crypto = require('crypto');
const axios = require('axios');

let qaCache = []; // [{ question, answer, embedding, hash }]

const OLLAMA_URL = 'http://localhost:11434/api/embeddings';
const OLLAMA_MODEL = 'nomic-embed-text';

// Hash text to detect unchanged questions
function getHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    console.warn('[AI] Invalid embeddings for cosine similarity', a, b);
    return -1;
  }
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) {
    console.warn('[AI] Zero magnitude vector detected');
    return -1;
  }
  return dot / (magA * magB);
}

// Use Ollama to embed a sentence
async function embedText(text) {
  const normalizedText = text.normalize('NFC').trim();
  console.log('[AI] Embedding with Ollama:', normalizedText);

  try {
    const response = await axios.post(OLLAMA_URL, {
      model: OLLAMA_MODEL,
      prompt: normalizedText
    });

    if (!response.data || !response.data.embedding) {
      console.warn('[AI] Invalid response from Ollama embedding API:', response.data);
      throw new Error('Embedding failed');
    }

    return response.data.embedding;
  } catch (err) {
    console.error('[AI] Ollama embedding error:', err.message);
    throw err;
  }
}

// Refresh the QA cache (with deduplication based on hash)
async function refreshCache() {
  const qaList = await getAllQA();
  const newCache = [];

  for (const qa of qaList) {
    const hash = getHash(qa.question);
    const existing = qaCache.find((item) => item.hash === hash);
    if (existing) {
      newCache.push(existing); // reuse existing embedding
    } else {
      const embedding = await embedText(qa.question);
      newCache.push({ ...qa, embedding, hash });
    }
  }

  qaCache = newCache;
  console.log(`[AI] Cache refreshed: ${qaCache.length} QA pairs`);
}

// Get the best matching answer based on embedding similarity
async function getBestAnswer(userQuestion) {
  if (qaCache.length === 0) {
    console.log('[AI] QA cache empty, refreshing...');
    await refreshCache();
  }

  const userEmbedding = await embedText(userQuestion);
  let bestMatch = null;
  let bestScore = -1;

  for (const qa of qaCache) {
    const score = cosineSimilarity(userEmbedding, qa.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = qa;
    }
  }

  const THRESHOLD = 0.75;

  if (bestScore >= THRESHOLD) {
    console.log(`[AI] Match found with confidence ${bestScore.toFixed(2)}: "${bestMatch.question}"`);
    return { answer: bestMatch.answer, confidence: bestScore };
  } else {
    console.log(`[AI] No good match found. Best confidence: ${bestScore.toFixed(2)}`);
    return {
      answer: 'אני לא בטוח בתשובה. בבקשה פנה לנציג אנושי.',
      confidence: bestScore
    };
  }
}

module.exports = {
  getBestAnswer,
  refreshCache,
};
