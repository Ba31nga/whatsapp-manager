const express = require('express');
const router = express.Router();
const { getBestAnswer } = require('../services/aiChatService');

router.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'שאלה חסרה' });

  try {
    const result = await getBestAnswer(question);
    if (!result.answer) {
      return res.json({ answer: 'מצטער, לא מצאתי תשובה מתאימה.', confidence: result.confidence });
    }
    res.json(result);
  } catch (err) {
    console.error('[Chatbot Error]', err);
    res.status(500).json({ error: 'שגיאה פנימית' });
  }
});

module.exports = router;
