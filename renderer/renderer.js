const excelInput = document.getElementById('excelInput');
const clearTableBtn = document.getElementById('clearTable');
const tableContainer = document.getElementById('tableContainer');
const dataTable = document.getElementById('dataTable');
const messageInput = document.getElementById('messageInput');
const messagePreview = document.getElementById('messagePreview');
const sendMessagesBtn = document.getElementById('sendMessages');

let parsedData = []; // array of objects, each row is {header: value}

function parseExcelText(text) {
  // Split by lines, ignore empty lines
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Split headers by tab or spaces
  const headers = lines[0].split(/\t| {2,}/).map(h => h.trim());

  const rows = lines.slice(1).map(line => {
    const values = line.split(/\t| {2,}/);
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || '';
    });
    return obj;
  });

  return rows;
}

function renderTable(data) {
  if (!data.length) {
    tableContainer.style.display = 'none';
    return;
  }

  tableContainer.style.display = 'block';

  // Headers
  const headers = Object.keys(data[0]);

  let html = '<thead><tr>';
  headers.forEach(h => {
    html += `<th>${h}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Rows
  data.forEach(row => {
    html += '<tr>';
    headers.forEach(h => {
      html += `<td>${row[h] || ''}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody>';
  dataTable.innerHTML = html;
}

function highlightPlaceholders(text, headers) {
  // highlight #header names in message input
  // This only highlights in the preview area, input stays normal textarea
  // We'll replace #header with <span class="highlight-placeholder">#header</span>

  if (!headers.length) return text;

  // Escape RegExp special chars in headers for safer matching
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

  // Also generate actual preview text with values replaced
  const realPreview = generatePreview(rawMessage, headers, parsedData[0]);
  messagePreview.textContent = realPreview; // override with real preview (no HTML tags)

  // To highlight placeholders inside messageInput, you would need a rich text editor (complex).
  // So we highlight placeholders only in preview area for now.
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

  // For demo: send messages one by one with delay (to be implemented with whatsapp-web.js)
  // For now, just show an alert with number of messages to send
  alert(`יש לשלוח ${parsedData.length} הודעות עם התבנית:\n\n${messageTemplate}`);

  // Here you will later integrate whatsapp-web.js sending logic
});
