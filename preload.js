const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] preload.js loaded, setting up api');

contextBridge.exposeInMainWorld('api', {
  // Web WhatsApp QR handling
  onQrCode: (callback) => {
    console.log('[Preload] Registered onQrCode listener');
    ipcRenderer.on('qr-code', (event, sessionId, qr) => {
      console.log(`[Preload] Received qr-code event: sessionId=${sessionId}, qr length=${qr.length}`);
      callback(sessionId, qr);
    });
  },

  // WhatsApp login status handler
  onLoginStatus: (callback) => {
    console.log('[Preload] Registered onLoginStatus listener');
    ipcRenderer.on('login-status', (event, sessionId, status) => {
      console.log(`[Preload] Received login-status event: sessionId=${sessionId}, status=${status}`);
      callback(sessionId, status);
    });
  },

  // Message sent log listener
  onMessageSent: (callback) => {
    console.log('[Preload] Registered onMessageSent listener');
    ipcRenderer.on('message-sent', (event, log) => {
      console.log('[Preload] Received message-sent event:', log);
      callback(log);
    });
  },

  // Message sending request
  requestSendMessages: (messages) => {
    console.log('[Preload] requestSendMessages invoked with messages:', messages);
    return ipcRenderer.invoke('send-messages', messages);
  },

  // Log fetch request
  requestGetLogs: () => {
    console.log('[Preload] requestGetLogs invoked');
    return ipcRenderer.invoke('get-logs');
  },

  // Q&A database functions
  getAllQA: async () => {
    console.log('[Preload] getAllQA invoked');
    return await ipcRenderer.invoke('qa:getAll');
  },

  addQA: async (question, answer) => {
    console.log('[Preload] addQA invoked with question:', question);
    return await ipcRenderer.invoke('qa:add', question, answer);
  },

  updateQA: async (id, question, answer) => {
    console.log(`[Preload] updateQA invoked with id=${id}, question=${question}`);
    return await ipcRenderer.invoke('qa:update', id, question, answer);
  },

  deleteQA: async (id) => {
    console.log(`[Preload] deleteQA invoked with id=${id}`);
    return await ipcRenderer.invoke('qa:delete', id);
  },
});
