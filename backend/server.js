// File: backend.js (or whatever your backend entry filename is)

const { getBestAnswer } = require('./aiChatService');
const sessionStatuses = {};
const { getAllQA, addQA, updateQA, deleteQA } = require('./googleSheetsService');
const SessionManager = require('./sessionManager');
const Logger = require('./logger');

let sessionManager;
let mainWindow;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setSessionStatus(sessionId, status) {
  sessionStatuses[sessionId] = status;
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('session-status-updated', sessionId, status);
  }
  console.log(`[Backend] Session ${sessionId} status set to '${status}'`);
}

function getSessionStatus(sessionId) {
  return sessionStatuses[sessionId] || 'available';
}

// Typing speeds in chars per second for simulation
const typingSpeeds = {
  average: 5,         // ~5 chars per second (slow human typing)
  'above-average': 8, // ~8 chars per second (fast human typing)
};

async function simulateTypingDelay(message, typingSpeed = 'average') {
  const cps = typingSpeeds[typingSpeed] || typingSpeeds.average;
  const delayMs = (message.length / cps) * 1000;
  // Add a small random variance ±15% to seem more human-like
  const variance = delayMs * 0.15;
  const finalDelay = delayMs + (Math.random() * variance * 2 - variance);
  await sleep(finalDelay);
}

function startBackend(ipcMain, window) {
  mainWindow = window;
  console.log('[Backend] Starting backend, initializing SessionManager...');
  sessionManager = new SessionManager();

  sessionManager.on('qr', (sessionId, qr) => {
    console.log(`[Backend] QR event for session ${sessionId} received. QR data length: ${qr.length}`);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('qr-code', sessionId, qr);
      console.log(`[Backend] Sent 'qr-code' event to renderer for session ${sessionId}`);
    } else {
      console.warn('[Backend] mainWindow or webContents not available to send qr-code');
    }
  });

  sessionManager.on('status', (sessionId, status) => {
    console.log(`[Backend] Status event for session ${sessionId}: ${status}`);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('login-status', sessionId, status);
      console.log(`[Backend] Sent 'login-status' event to renderer for session ${sessionId}`);
    } else {
      console.warn('[Backend] mainWindow or webContents not available to send login-status');
    }
  });

  sessionManager.on('messageSent', (log) => {
    Logger.appendLog(log);
    console.log(`[Backend] messageSent event logged and sending to renderer:`, log);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('message-sent', log);
      console.log('[Backend] Sent \'message-sent\' event to renderer');
    } else {
      console.warn('[Backend] mainWindow or webContents not available to send message-sent');
    }
  });

  ipcMain.handle('session:update-role', async (event, sessionId, newRole) => {
    try {
      sessionManager.updateRole(sessionId, newRole);
      console.log(`[Backend] Updated role for session ${sessionId} to ${newRole}`);
      return { success: true };
    } catch (err) {
      console.error(`[Backend] Error updating role for session ${sessionId}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('session:get-role', async (event, sessionId) => {
    try {
      const role = sessionManager.getSessionRole(sessionId);
      if (!role) {
        return { success: false, error: 'Session role not found' };
      }
      return { success: true, role };
    } catch (err) {
      console.error(`[Backend] Error getting role for session ${sessionId}:`, err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('send-messages', async (event, messages) => {
    console.log('[Backend] IPC send-messages handler called with messages:', messages);
    try {
      const sessionPromises = messages.map(async (msgBatch) => {
        const sessionId = msgBatch.sessionId;

        // Check session role before sending
        const role = sessionManager.getSessionRole(sessionId);
        if (role !== 'bulking') {
          console.log(`[Backend] Skipping session ${sessionId} because its role is '${role}', not 'bulking'`);
          return;
        }

        console.log(`[Backend] Sending messages for session ${sessionId} with ${msgBatch.data.length} entries`);

        const typingSpeed = msgBatch.typingSpeed || 'average';

        // Set session status to 'bulking'
        setSessionStatus(sessionId, 'bulking');

        for (const recipientData of msgBatch.data) {
          let customizedMessage = msgBatch.messageTemplate.replace(/#(\w+)/g, (_, key) => recipientData[key] || `#${key}`);
          await simulateTypingDelay(customizedMessage, typingSpeed);
          await sessionManager.sendSingleMessage(sessionId, recipientData, customizedMessage);
        }

        // Mark session available again
        setSessionStatus(sessionId, 'available');
      });

      await Promise.all(sessionPromises);

      console.log('[Backend] All messages sent successfully');
      return { success: true };
    } catch (err) {
      console.error('[Backend] Error sending messages:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-logs', async () => {
    console.log('[Backend] IPC get-logs handler called');
    return Logger.getLogs();
  });

  ipcMain.handle('qa:getAll', async () => {
    try {
      const data = await getAllQA();
      return { success: true, data };
    } catch (err) {
      console.error('[Backend] Error fetching QA from Google Sheets:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('qa:add', async (event, question, answer) => {
    try {
      await addQA(question, answer);
      // Fetch all QA again and get the last added one
      const data = await getAllQA();
      const lastQA = data[data.length - 1]; // Return last added
      return { success: true, data: lastQA };
    } catch (err) {
      console.error('[Backend] Error adding QA to Google Sheets:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('qa:update', async (event, id, question, answer) => {
    try {
      await updateQA(id, question, answer);
      return { success: true };
    } catch (err) {
      console.error('[Backend] Error updating QA in Google Sheets:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('qa:delete', async (event, id) => {
    try {
      await deleteQA(id);
      return { success: true };
    } catch (err) {
      console.error('[Backend] Error deleting QA from Google Sheets:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('session:get-status', async (event, sessionId) => {
    return { success: true, status: getSessionStatus(sessionId) };
  });
  
  ipcMain.handle('chatbot:ask', async (event, question) => {
    if (!question) {
      return { success: false, error: 'שאלה חסרה' };
    }

    try {
      const result = await getBestAnswer(question);
      if (!result.answer) {
        return { success: true, answer: 'מצטער, לא מצאתי תשובה מתאימה.', confidence: result.confidence };
      }
      return { success: true, answer: result.answer, confidence: result.confidence };
    } catch (err) {
      console.error('[Backend] Error in chatbot:ask handler', err);
      return { success: false, error: 'שגיאה פנימית' };
    }
  });

}

module.exports = { startBackend };
