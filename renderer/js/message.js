import { getParsedData } from './excelParser.js';
import { showToast } from './toastManager.js'; // your external toast manager
import { showConfirmAlert } from './alertModal.js';

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

  const firstRow = parsedData[0];

  // Normalize keys: remove spaces and underscores, lowercase
  const normalizedMap = {};
  for (const key in firstRow) {
    const normalizedKey = key.replace(/[\s_]/g, '').toLowerCase();
    normalizedMap[normalizedKey] = firstRow[key];
  }

  // Replace placeholders in the template:
  // Match #key, #key_with_underscores or #{key with spaces}
  const previewText = template.replace(
    /#(?:\{([\p{L}\w\s_]+)\}|([\p{L}\w_]+))/gu,
    (match, p1, p2) => {
      const keyRaw = p1 || p2; // key inside braces or without braces
      const normalizedKey = keyRaw.replace(/[\s_]/g, '').toLowerCase();

      // Return the mapped value or original placeholder if no match
      return normalizedMap[normalizedKey] !== undefined
        ? normalizedMap[normalizedKey]
        : match;
    }
  );

  messagePreview.textContent = previewText;
}



/**
 * Setup send button to send split messages via API.
 * @param {Object} api - API interface with method requestSendMessages(messagesArray)
 */
export function setupSendButton(api) {
  sendBtn.addEventListener('click', async () => {
    // Show confirmation alert before sending
    const confirmed = await showConfirmAlert('האם אתה בטוח שברצונך לשלוח את ההודעות?');
    if (!confirmed) return;  // user cancelled

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

    const typingSpeed = typingSpeedSelect?.value || 'average';
    const chunks = chunkArray(parsedData, 4);

    const messagesToSend = chunks.map((chunk, idx) => ({
      sessionId: idx + 1,
      data: chunk,
      messageTemplate: template,
      typingSpeed,
    }));

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
