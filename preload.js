// preload.js
const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] preload.js loaded, setting up api');

contextBridge.exposeInMainWorld('api', {
  onQrCode: (callback) => {
    console.log('[Preload] Registered onQrCode listener');
    ipcRenderer.on('qr-code', (event, sessionId, qr) => {
      console.log(`[Preload] Received qr-code event: sessionId=${sessionId}, qr length=${qr.length}`);
      callback(sessionId, qr);
    });
  },
  onLoginStatus: (callback) => {
    console.log('[Preload] Registered onLoginStatus listener');
    ipcRenderer.on('login-status', (event, sessionId, status) => {
      console.log(`[Preload] Received login-status event: sessionId=${sessionId}, status=${status}`);
      callback(sessionId, status);
    });
  },
  onMessageSent: (callback) => {
    console.log('[Preload] Registered onMessageSent listener');
    ipcRenderer.on('message-sent', (event, log) => {
      console.log('[Preload] Received message-sent event:', log);
      callback(log);
    });
  },
  requestSendMessages: (messages) => {
    console.log('[Preload] requestSendMessages invoked with messages:', messages);
    return ipcRenderer.invoke('send-messages', messages);
  },
  requestGetLogs: () => {
    console.log('[Preload] requestGetLogs invoked');
    return ipcRenderer.invoke('get-logs');
  },
});
