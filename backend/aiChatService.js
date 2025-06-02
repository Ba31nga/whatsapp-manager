const { getAllQA } = require('./googleSheetsService');
const axios = require('axios');

const OLLAMA_GENERATE_URL = 'http://localhost:11434/api/generate';
const OLLAMA_EMBED_URL = 'http://localhost:11434/api/embeddings';

const OLLAMA_EMBED_MODEL = 'nomic-embed-text';
const OLLAMA_GENERATE_MODEL = 'llama3';

// Utility: cosine similarity
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  if (magA === 0 || magB === 0) return -1;
  return dot / (magA * magB);
}

// Use AI to classify question type
async function classifyQuestion(userQuestion) {
  const prompt = `
מיין את השאלה הבאה לאחת מתוך שלוש קטגוריות בלבד: SMALL_TALK, VAGUE, TECHNICAL

הסבר קצר לכל קטגוריה:
SMALL_TALK - ברכות, שיחות קלילות, נימוסים, שאלות לא טכניות כלל.
VAGUE - שאלות כלליות, פתוחות, או לא ממוקדות שמדברות על נושאים רחבים.
TECHNICAL - שאלות ספציפיות טכניות שדורשות ידע ממוקד.

שאלה: "${userQuestion}"

קטגוריה:
`.trim();

  try {
    const res = await axios.post(OLLAMA_GENERATE_URL, {
      model: OLLAMA_GENERATE_MODEL,
      prompt,
      max_tokens: 10,
      temperature: 0,
      stream: false,
    });
    const categoryRaw = res.data.response?.trim().toUpperCase() || '';
    if (categoryRaw.includes('SMALL_TALK')) return 'SMALL_TALK';
    if (categoryRaw.includes('VAGUE')) return 'VAGUE';
    if (categoryRaw.includes('TECHNICAL')) return 'TECHNICAL';
    return 'VAGUE'; // default fallback
  } catch (err) {
    console.error('[AI] classifyQuestion error:', err.message);
    return 'VAGUE';
  }
}

async function generateSmallTalkReply(userQuestion) {
  const prompt = `
אתה רובוט ידידותי בעברית, שמדבר בצורה טבעית ונעימה. ענה באופן קליל וחברותי לשאלה או ברכה הבאה:
"${userQuestion}"
  
ענה בעברית בצורה קצרה, נעימה, ועם קצת הומור אם אפשר.
`.trim();

  try {
    const res = await axios.post(OLLAMA_GENERATE_URL, {
      model: OLLAMA_GENERATE_MODEL,
      prompt,
      stream: false,
      max_tokens: 100,
    });

    const reply = res.data.response?.trim();
    if (!reply) return 'היי! איך אפשר לעזור לך היום?';
    return reply;
  } catch (err) {
    console.error('[AI] generateSmallTalkReply error:', err.message);
    return 'היי! איך אפשר לעזור לך היום?';
  }
}

async function getBestAnswer(userQuestion) {
  userQuestion = userQuestion.trim();
  if (!userQuestion) {
    return { answer: 'בבקשה שאל שאלה כדי שאוכל לעזור.', confidence: 0 };
  }

  // Use AI classification for question type
  const category = await classifyQuestion(userQuestion);

  if (category === 'SMALL_TALK') {
    const reply = await generateSmallTalkReply(userQuestion);
    return { answer: reply, confidence: 0.6 };
  }

  if (category === 'VAGUE') {
    return {
      answer:
        'נשמע שיש לך שאלה כללית. תוכל לפרט קצת יותר כדי שאוכל לעזור טוב יותר? או פשוט לשוחח איתי בכל נושא!',
      confidence: 0.5,
    };
  }

  // TECHNICAL question flow
  let qaList = [];
  try {
    qaList = await getAllQA();
  } catch {
    return {
      answer: 'מצטערים, יש בעיה במערכת השאלות והתשובות. אנא פנה לנציג אנושי.',
      confidence: 0,
    };
  }

  if (!qaList.length) {
    return {
      answer: 'אין שאלות ותשובות זמינות כרגע. אנא פנה לנציג אנושי.',
      confidence: 0,
    };
  }

  let userEmbedding;
  try {
    userEmbedding = await embedText(userQuestion);
  } catch {
    return {
      answer: 'מצטערים, לא הצלחתי להבין את השאלה שלך. אנא נסה לנסח אחרת או פנה לנציג אנושי.',
      confidence: 0,
    };
  }

  const scoredQA = [];
  for (const qa of qaList) {
    try {
      const qEmbedding = await embedText(qa.question);
      const score = cosineSimilarity(userEmbedding, qEmbedding);
      if (score >= 0) {
        scoredQA.push({ ...qa, score });
      }
    } catch {
      // skip bad embed
    }
  }

  if (!scoredQA.length) {
    return {
      answer: 'אני לא בטוח בתשובה, אנא פנה לנציג אנושי.',
      confidence: 0,
    };
  }

  scoredQA.sort((a, b) => b.score - a.score);
  const topQAs = scoredQA.slice(0, 3);
  const topScore = topQAs[0].score;

  if (topScore < 0.65) {
    return {
      answer: 'אני לא בטוח בתשובה, אנא פנה לנציג אנושי.',
      confidence: topScore,
    };
  }

  const context = topQAs
    .map((qa) => `שאלה: ${qa.question}\nתשובה: ${qa.answer}`)
    .join('\n\n');

  const prompt = `
אתה עוזר טכני ידידותי. השתמש רק במידע הבא כדי לענות על השאלה. אם אינך בטוח, אמור "אני לא בטוח בתשובה, אנא פנה לנציג אנושי".

${context}

שאלה: ${userQuestion}
תשובה:
`.trim();

  try {
    const res = await axios.post(OLLAMA_GENERATE_URL, {
      model: OLLAMA_GENERATE_MODEL,
      prompt,
      max_tokens: 150,
      temperature: 0.3,
      stream: false,
    });

    const answer = res.data.response?.trim();

    const fallbackTriggers = ['אני לא בטוח', 'אנא פנה לנציג', 'לא ידוע לי', 'מצטער'];
    const isFallback = fallbackTriggers.some((phrase) => answer.includes(phrase));

    return {
      answer: answer || 'אני לא בטוח בתשובה, אנא פנה לנציג אנושי.',
      confidence: isFallback ? topScore * 0.7 : Math.min(0.99, topScore + 0.2),
    };
  } catch (err) {
    console.error('[AI] generate answer error:', err.message);
    return {
      answer: 'מצטערים, לא הצלחתי לענות על השאלה. אנא פנה לנציג אנושי.',
      confidence: 0,
    };
  }
}

// embedText helper
async function embedText(text) {
  try {
    const res = await axios.post(OLLAMA_EMBED_URL, {
      model: OLLAMA_EMBED_MODEL,
      prompt: text.normalize('NFC').trim(),
    });
    if (!res.data || !res.data.embedding) throw new Error('No embedding returned');
    return res.data.embedding;
  } catch (err) {
    console.error('[AI] embedText error:', err.message);
    throw err;
  }
}

module.exports = {
  getBestAnswer,
};
