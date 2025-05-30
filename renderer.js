const ipcRenderer = window.electron.ipcRenderer;
const excelInput = document.getElementById('excelInput');
const clearTableBtn = document.getElementById('clearTable');
const tableContainer = document.getElementById('tableContainer');
const dataTable = document.getElementById('dataTable');
const messageInput = document.getElementById('messageInput');
const messagePreview = document.getElementById('messagePreview');
const sendMessagesBtn = document.getElementById('sendMessages');
const qrLoginOverlay = document.getElementById('qrLoginOverlay');

// QR code & login status container elements already created and appended earlier
const qrImage = document.getElementById('qrImage');

const loginStatus = document.getElementById('loginStatus');

let parsedData = [];

function parseExcelText(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(/\t| {2,}/).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(/\t| {2,}/);
    const obj = {};
    headers.forEach((header, i) => obj[header] = values[i] || '');
    return obj;
  });
}

function renderTable(data) {
  if (!data.length) {
    tableContainer.style.display = 'none';
    return;
  }

  tableContainer.style.display = 'block';

  const headers = Object.keys(data[0]);

  let html = '<thead><tr>';
  headers.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';

  data.forEach(row => {
    html += '<tr>';
    headers.forEach(h => { html += `<td>${row[h] || ''}</td>`; });
    html += '</tr>';
  });

  html += '</tbody>';
  dataTable.innerHTML = html;
}

function highlightPlaceholders(text, headers) {
  if (!headers.length) return text;

  const escapedHeaders = headers.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  escapedHeaders.forEach(header => {
    const regex = new RegExp(`#${header}`, 'g');
    text = text.replace(regex, `<span class="highlight-placeholder">#${header}</span>`);
  });

  return text;
}

function generatePreview(message, headers, firstRow) {
  if (!firstRow) return '';

  let preview = message;

  headers.forEach(header => {
    const regex = new RegExp(`#${header}`, 'g');
    preview = preview.replace(regex, firstRow[header] || '');
  });

  return preview;
}

excelInput.addEventListener('input', e => {
  parsedData = parseExcelText(e.target.value);
  renderTable(parsedData);
  updatePreview();
});

clearTableBtn.addEventListener('click', () => {
  excelInput.value = '';
  parsedData = [];
  renderTable([]);
  messagePreview.innerHTML = '';
});

messageInput.addEventListener('input', () => {
  updatePreview();
});

function updatePreview() {
  if (!parsedData.length) {
    messagePreview.innerHTML = 'אין נתונים לתצוגה.';
    return;
  }

  const headers = Object.keys(parsedData[0]);
  const rawMessage = messageInput.value;

  const previewWithHighlight = highlightPlaceholders(rawMessage, headers);
  messagePreview.innerHTML = previewWithHighlight;

  // If you want real preview text below highlighted preview, you can show that separately
  // Here we just show the real preview as textContent (without HTML tags)
  // If you want to keep highlights, skip this line or show realPreview elsewhere
  // messagePreview.textContent = generatePreview(rawMessage, headers, parsedData[0]);
}

sendMessagesBtn.addEventListener('click', () => {
  if (!parsedData.length) {
    alert('אנא הדבק טבלה חוקית בצד שמאל.');
    return;
  }

  const messageTemplate = messageInput.value.trim();
  if (!messageTemplate) {
    alert('אנא כתוב הודעה מותאמת אישית.');
    return;
  }

  ipcRenderer.invoke('send-whatsapp-messages', { data: parsedData, template: messageTemplate })
    .then(response => {
      alert(response);
    })
    .catch(err => {
      alert('שגיאה בשליחת ההודעות: ' + err.message);
    });
});


// IPC handlers for QR code & WhatsApp login status

ipcRenderer.on('qr', (event, qr) => {
  // qr is usually a data URL string or base64 image string
  if (typeof qr === 'string' && qr.startsWith('data:image')) {
    qrImage.src = qr;
  } else {
    // If the QR is raw text, generate a QR code image with a library or just show as text (optional)
    qrImage.src = '';
    loginStatus.textContent = 'סרוק את הברקוד עם וואטסאפ במכשירך: ' + qr;
  }
  loginStatus.textContent = 'סרוק את הברקוד עם וואטסאפ במכשירך';
});

ipcRenderer.on('authenticated', () => {
  qrImage.src = '';
  loginStatus.textContent = 'מחובר בהצלחה לוואטסאפ!';
  qrLoginOverlay.style.display = 'none';
});


ipcRenderer.on('auth_failure', () => {
  qrImage.src = '';
  loginStatus.textContent = 'נכשל בחיבור. נסה לאתחל את האפליקציה.';
});

ipcRenderer.on('ready', () => {
  qrImage.src = '';
  loginStatus.textContent = 'וואטסאפ מוכן לשימוש';
  qrLoginOverlay.style.display = 'none';
});
