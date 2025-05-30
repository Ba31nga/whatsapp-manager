import { getParsedData } from './excelParser.js';
import { showToast } from './toastManager.js'; // use your external toast manager

const messageInput = document.getElementById('messageInput');
const messagePreview = document.getElementById('messagePreview');
const sendBtn = document.getElementById('sendMessages');
const excelInput = document.getElementById('excelInput');
const dataTable = document.getElementById('dataTable');
const typingSpeedSelect = document.getElementById('typingSpeedSelect'); // new: <select> in your HTML

export function setupMessageInput() {
  messageInput.addEventListener('input', () => {
    updatePreview();
  });
}

function updatePreview() {
  const parsedData = getParsedData();
  if (parsedData.length === 0) {
    messagePreview.textContent = 'כתוב הודעה מותאמת אישית.';
    return;
  }
  let template = messageInput.value;
  if (!template) {
    messagePreview.textContent = 'כתוב הודעה מותאמת אישית.';
    return;
  }
  const firstRow = parsedData[0];
  const previewText = template.replace(/#(\w+)/g, (_, key) => firstRow[key] || `#${key}`);
  messagePreview.textContent = previewText;
}

export function setupSendButton(api) {
  sendBtn.addEventListener('click', async () => {
    const parsedData = getParsedData();
    if (parsedData.length === 0) {
      showToast('נא להדביק טבלה תקינה.', 'error');
      return;
    }
    if (!messageInput.value.trim()) {
      showToast('נא לכתוב הודעה מותאמת אישית.', 'error');
      return;
    }

    // Read typing speed from select, default to 'average'
    const typingSpeed = typingSpeedSelect?.value || 'average';

    const messagesToSend = [];
    for (let sessionId = 1; sessionId <= 4; sessionId++) {
      messagesToSend.push({
        sessionId,
        data: parsedData,
        messageTemplate: messageInput.value.trim(),
        typingSpeed, // pass typingSpeed here
      });
    }

    try {
      const result = await api.requestSendMessages(messagesToSend);
      if (result.success) {
        showToast('ההודעות נשלחו בהצלחה', 'success');
        // Optionally clear inputs or reload logs elsewhere
      } else {
        showToast('שגיאה בשליחת ההודעות: ' + result.error, 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + err.message, 'error');
    }
  });
}

export function setupClearButton() {
  const clearBtn = document.getElementById('clearTable');
  clearBtn.addEventListener('click', () => {
    excelInput.value = '';
    dataTable.innerHTML = '';
    messageInput.value = '';
    messagePreview.textContent = 'כתוב הודעה מותאמת אישית.';
    showToast('הטבלה וההודעה נמחקו', 'info', 3000);
  });
}
