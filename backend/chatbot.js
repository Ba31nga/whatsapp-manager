// chatbot.js

const { getBestAnswer } = require('./aiChatService');

let chatbotActive = false;
let messageListener = null;

const waitQueue = []; // [{ phone, question }]
const questionState = new Map(); // phone => { question, status, lastWaitMessageTime, lastAIAnswerTime, assignedSession }

let waitSessionBusy = false;
const aiSessions = new Map(); // sessionId => { client, busyUntil, currentPhone }

async function sendTypingReply(client, number, text) {
  try {
    const chat = await client.getChatById(number + '@c.us');
    await chat.sendStateTyping();
    const typingSpeedPerChar = 150 + Math.random() * 100;
    const typingTime = Math.min(10000, text.length * typingSpeedPerChar);
    await new Promise(resolve => setTimeout(resolve, typingTime));
    await chat.clearState();
    await client.sendMessage(number + '@c.us', text);
  } catch (error) {
    console.error('[Chatbot] sendTypingReply error:', error);
  }
}

async function processWaitQueue(waitClient) {
  if (waitSessionBusy || waitQueue.length === 0) return;

  waitSessionBusy = true;
  try {
    while (waitQueue.length > 0) {
      const { phone, question } = waitQueue.shift();

      const existing = questionState.get(phone);
      if (existing && (existing.status === 'waiting' || existing.status === 'answered')) {
        // Already processing or answered, skip
        continue;
      }

      // Mark waiting and send wait message
      questionState.set(phone, {
        question,
        status: 'waiting',
        lastWaitMessageTime: Date.now(),
        lastAIAnswerTime: null,
        assignedSession: null,
      });

      try {
        await sendTypingReply(waitClient, phone, 'תודה שפניתם, הנציג הבא יתפנה ויעזור לכם בקרוב...');
      } catch (err) {
        console.error('[Chatbot] Error sending wait message:', err);
      }

      // Try assign to AI session immediately
      assignToAvailableAI(phone, question);
    }
  } finally {
    waitSessionBusy = false;
  }
}

function assignToAvailableAI(phone, question) {
  // Find free or expired session
  for (const [sessionId, session] of aiSessions.entries()) {
    if (!session.currentPhone || Date.now() > session.busyUntil) {
      session.currentPhone = phone;
      questionState.set(phone, {
        ...questionState.get(phone),
        assignedSession: sessionId,
      });
      processAIResponse(sessionId, phone, question);
      return;
    }
  }

  // No free session, retry assignment after delay
  setTimeout(() => assignToAvailableAI(phone, question), 3000);
}

async function processAIResponse(sessionId, phone, question) {
  const session = aiSessions.get(sessionId);
  if (!session) return;

  const now = Date.now();
  const { client } = session;

  try {
    const { answer, confidence } = await getBestAnswer(question);
    console.log(`[Chatbot] AI response for ${phone}:`, { answer, confidence });

    if (confidence >= 0.75 && answer) {
      await sendTypingReply(client, phone, answer);
      questionState.set(phone, {
        ...questionState.get(phone),
        status: 'answered',
        lastAIAnswerTime: now,
      });
    } else {
      await sendTypingReply(client, phone, 'מצטערים, נציג אנושי יתפנה לעזור לכם בקרוב.');
      questionState.set(phone, {
        ...questionState.get(phone),
        status: 'needs-human',
        lastAIAnswerTime: now,
      });
    }

    session.busyUntil = now + 60000; // 1 minute hold for follow-up
    session.currentPhone = phone;
  } catch (err) {
    console.error('[Chatbot] Error processing AI:', err);
    // On error, free session immediately to avoid deadlock
    session.busyUntil = 0;
    session.currentPhone = null;
  }
}

async function startChatbotMode(sessionManager, mainWindow) {
  const sessions = Array.from(sessionManager.sessions.entries()).filter(
    ([sessionId]) => sessionManager.getSessionRole(sessionId) === 'chatbot'
  );

  if (sessions.length < 2) {
    return { success: false, error: 'יש צורך בלפחות 2 סשנים עם תפקיד "chatbot"' };
  }

  chatbotActive = true;
  const [waitEntry, ...aiEntries] = sessions;
  const waitClient = waitEntry[1];

  console.log(`[Chatbot] Wait session: ${waitEntry[0]}`);
  console.log(`[Chatbot] AI sessions: ${aiEntries.map(([id]) => id).join(', ')}`);

  aiSessions.clear();
  for (const [sessionId, client] of aiEntries) {
    aiSessions.set(sessionId, {
      client,
      busyUntil: 0,
      currentPhone: null,
    });
  }

  if (messageListener) {
    waitClient.off('message', messageListener);
  }

  messageListener = async (msg) => {
    const contact = await msg.getContact();
    if (contact.isMe) return;

    const phone = contact.number;
    const question = msg.body;
    const existing = questionState.get(phone);
    const now = Date.now();

    // If recent answered, send to same AI session for follow-up
    if (existing?.status === 'answered' && now - (existing.lastAIAnswerTime || 0) < 60000) {
      const sessionId = existing.assignedSession;
      if (sessionId && aiSessions.has(sessionId)) {
        processAIResponse(sessionId, phone, question);
        return;
      }
    }

    // If no state or need human, queue question for wait session
    if (!existing || existing.status === 'needs-human' || existing.status === 'waiting') {
      waitQueue.push({ phone, question });
      processWaitQueue(waitClient);
    }
  };

  waitClient.on('message', messageListener);

  return { success: true };
}

async function stopChatbotMode(sessionManager) {
  if (!chatbotActive) return { success: false, error: 'Chatbot mode is not active' };

  chatbotActive = false;

  const sessions = Array.from(sessionManager.sessions.entries()).filter(
    ([sessionId]) => sessionManager.getSessionRole(sessionId) === 'chatbot'
  );

  const [waitEntry] = sessions;
  const waitClient = waitEntry?.[1];

  if (messageListener && waitClient) {
    waitClient.off('message', messageListener);
    messageListener = null;
  }

  waitQueue.length = 0;
  questionState.clear();
  aiSessions.clear();

  return { success: true };
}

function updateQuestionStatus(phone, status, assignedAgent = null) {
  if (!questionState.has(phone)) return false;
  const old = questionState.get(phone);
  questionState.set(phone, { ...old, status, assignedAgent });
  return true;
}

function getAllQuestions() {
  return Array.from(questionState.entries()).map(([phone, data]) => ({
    phone,
    ...data,
  }));
}

module.exports = {
  startChatbotMode,
  stopChatbotMode,
  updateQuestionStatus,
  getAllQuestions,
};
