const SessionManager = require('./sessionManager');
const Logger = require('./logger');

let sessionManager;
let mainWindow;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  ipcMain.handle('send-messages', async (event, messages) => {
    console.log('[Backend] IPC send-messages handler called with messages:', messages);
    try {
      for (const msgBatch of messages) {
        console.log(`[Backend] Sending messages for session ${msgBatch.sessionId} with ${msgBatch.data.length} entries`);

        const typingSpeed = msgBatch.typingSpeed || 'average';

        // Send messages one by one to simulate typing
        for (const recipientData of msgBatch.data) {
          // Customize message template by replacing placeholders
          let customizedMessage = msgBatch.messageTemplate.replace(/#(\w+)/g, (_, key) => recipientData[key] || `#${key}`);

          // Simulate typing delay before sending each message
          await simulateTypingDelay(customizedMessage, typingSpeed);

          // Send the message via SessionManager
          await sessionManager.sendSingleMessage(msgBatch.sessionId, recipientData, customizedMessage);
        }
      }
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
}

module.exports = { startBackend };
