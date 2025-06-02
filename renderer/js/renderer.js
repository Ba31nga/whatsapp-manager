import { setupQrCodeListeners } from './qrCode.js';
import { setupExcelInput } from './excelParser.js';
import { setupMessageInput, setupSendButton, setupClearButton } from './message.js';
import { loadLogs } from './logs.js';
import { setupTabListeners } from './tabs.js';
import { setupQATab } from './qa-tab.js';
import { initSessionsStatusTab } from './sessionsStatusTab.js';
import './chatbot-manager.js';


document.addEventListener('DOMContentLoaded', () => {
  const api = window.api; 
  if (!api) {
    console.error('API object not available on window');
    return;
  }

  setupQrCodeListeners(api);
  setupTabListeners();
  setupExcelInput(api);
  setupMessageInput(api);
  setupSendButton(api);
  setupClearButton();
  loadLogs(api);
  setupQATab(api);
  initSessionsStatusTab(api);
});
