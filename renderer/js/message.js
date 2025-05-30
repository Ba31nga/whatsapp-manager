import { getParsedData } from './excelParser.js';

const messageInput = document.getElementById('messageInput');
const messagePreview = document.getElementById('messagePreview');
const sendBtn = document.getElementById('sendMessages');
const excelInput = document.getElementById('excelInput');
const dataTable = document.getElementById('dataTable');

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
      alert('נא להדביק טבלה תקינה.');
      return;
    }
    if (!messageInput.value.trim()) {
      alert('נא לכתוב הודעה מותאמת אישית.');
      return;
    }

    const messagesToSend = [];
    for (let sessionId = 1; sessionId <= 4; sessionId++) {
      messagesToSend.push({
        sessionId,
        data: parsedData,
        messageTemplate: messageInput.value.trim(),
      });
    }

    try {
      const result = await api.requestSendMessages(messagesToSend);
      if (result.success) {
        alert('ההודעות נשלחו בהצלחה');
        // Maybe clear inputs or trigger logs reload elsewhere
      } else {
        alert('שגיאה בשליחת ההודעות: ' + result.error);
      }
    } catch (err) {
      alert('שגיאה: ' + err.message);
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
  });
}
