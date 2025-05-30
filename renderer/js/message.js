import { getParsedData } from './excelParser.js';
import { showToast } from './toastManager.js'; // your external toast manager

const messageInput = document.getElementById('messageInput');
const messagePreview = document.getElementById('messagePreview');
const sendBtn = document.getElementById('sendMessages');
const excelInput = document.getElementById('excelInput');
const dataTable = document.getElementById('dataTable');
const typingSpeedSelect = document.getElementById('typingSpeedSelect'); // optional <select> element

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
  const template = messageInput.value.trim();
  if (!template) {
    messagePreview.textContent = 'כתוב הודעה מותאמת אישית.';
    return;
  }
  // Use the first row's data to preview the message with replaced placeholders
  const firstRow = parsedData[0];
  const previewText = template.replace(/#(\w+)/g, (_, key) => {
    return firstRow[key] !== undefined ? firstRow[key] : `#${key}`;
  });
  messagePreview.textContent = previewText;
}

/**
 * Setup send button to send split messages via API.
 * @param {Object} api - API interface with method requestSendMessages(messagesArray)
 */
export function setupSendButton(api) {
  sendBtn.addEventListener('click', async () => {
    const parsedData = getParsedData();

    if (parsedData.length === 0) {
      showToast('נא להדביק טבלה תקינה.', 'error');
      return;
    }

    const template = messageInput.value.trim();
    if (!template) {
      showToast('נא לכתוב הודעה מותאמת אישית.', 'error');
      return;
    }

    // Get typing speed or default to 'average'
    const typingSpeed = typingSpeedSelect?.value || 'average';

    // Split parsed data into 4 chunks for 4 sessions
    const chunks = chunkArray(parsedData, 4);

    // Build payload for each session
    const messagesToSend = chunks.map((chunk, idx) => ({
      sessionId: idx + 1,
      data: chunk,
      messageTemplate: template,
      typingSpeed,
    }));

    // Guard: if all chunks empty (shouldn't happen), show error
    if (messagesToSend.every(m => m.data.length === 0)) {
      showToast('אין נתונים לשליחה.', 'error');
      return;
    }

    try {
      const result = await api.requestSendMessages(messagesToSend);
      if (result.success) {
        showToast('ההודעות נשלחו בהצלחה', 'success');
      } else {
        showToast('שגיאה בשליחת ההודעות: ' + (result.error || 'לא ידוע'), 'error');
      }
    } catch (err) {
      showToast('שגיאה: ' + err.message, 'error');
    }
  });
}

/**
 * Splits array into approximately equal parts.
 * Last part may be smaller if not divisible evenly.
 * @param {Array} array
 * @param {number} parts
 * @returns {Array<Array>}
 */
function chunkArray(array, parts) {
  if (parts <= 0) return [array];

  const result = [];
  const chunkSize = Math.ceil(array.length / parts);

  for (let i = 0; i < parts; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, array.length);
    result.push(array.slice(start, end));
  }

  return result;
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
