const ipcRenderer = window.electron.ipcRenderer;
const excelInput = document.getElementById('excelInput');
const clearTableBtn = document.getElementById('clearTable');
const tableContainer = document.getElementById('tableContainer');
const dataTable = document.getElementById('dataTable');
const messageInput = document.getElementById('messageInput');
const messagePreview = document.getElementById('messagePreview');
const sendMessagesBtn = document.getElementById('sendMessages');
const qrLoginOverlay = document.getElementById('qrLoginOverlay');
const menuAutomatedMessages = document.getElementById('menu-automated-messages');
const menuLog = document.getElementById('menu-log');
const mainContent = document.getElementById('main-content');
const logContent = document.getElementById('log-content');

function showAutomatedMessages() {
  menuAutomatedMessages.classList.add('active');
  menuLog.classList.remove('active');
  mainContent.style.display = 'block';
  logContent.style.display = 'none';
}

function showLog() {
  menuLog.classList.add('active');
  menuAutomatedMessages.classList.remove('active');
  mainContent.style.display = 'none';
  logContent.style.display = 'block';
}

menuAutomatedMessages.addEventListener('click', e => {
  e.preventDefault();
  showAutomatedMessages();
});

menuLog.addEventListener('click', e => {
  e.preventDefault();
  showLog();
});

function saveLogEntry(logEntry) {
  // מקבל פריט חדש, שומר אותו במערך בלוקלסטורג'
  const logs = JSON.parse(localStorage.getItem('sentLogs')) || [];
  logs.push(logEntry);
  localStorage.setItem('sentLogs', JSON.stringify(logs));
}



// Map client IDs to their QR image and login status elements
const clients = {
  1: {
    qrImage: document.getElementById('qrImage1'),
    spinner: document.querySelector('#qrImage1').parentElement.querySelector('.spinner'),
    checkmark: document.querySelector('#qrImage1').parentElement.querySelector('.checkmark'),
    loginStatus: document.getElementById('loginStatus1'),
    loggedIn: false,
  },
  2: {
    qrImage: document.getElementById('qrImage2'),
    spinner: document.querySelector('#qrImage2').parentElement.querySelector('.spinner'),
    checkmark: document.querySelector('#qrImage2').parentElement.querySelector('.checkmark'),
    loginStatus: document.getElementById('loginStatus2'),
    loggedIn: false,
  },
  3: {
    qrImage: document.getElementById('qrImage3'),
    spinner: document.querySelector('#qrImage3').parentElement.querySelector('.spinner'),
    checkmark: document.querySelector('#qrImage3').parentElement.querySelector('.checkmark'),
    loginStatus: document.getElementById('loginStatus3'),
    loggedIn: false,
  },
  4: {
    qrImage: document.getElementById('qrImage4'),
    spinner: document.querySelector('#qrImage4').parentElement.querySelector('.spinner'),
    checkmark: document.querySelector('#qrImage4').parentElement.querySelector('.checkmark'),
    loginStatus: document.getElementById('loginStatus4'),
    loggedIn: false,
  }
};

let parsedData = [];

/* ====================
  Utility Functions
==================== */

// Debounce helper to delay function calls
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Parse pasted Excel text into array of objects
function parseExcelText(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Support tab or multiple spaces as delimiter
  const headers = lines[0].split(/\t| {2,}/).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(/\t| {2,}/);
    const obj = {};
    headers.forEach((header, i) => obj[header] = values[i] || '');
    return obj;
  });
}

// Render parsed data as HTML table
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

// Highlight placeholders (#fieldName) inside the preview message text
function highlightPlaceholders(text, headers) {
  if (!headers.length) return text;

  const escapedHeaders = headers.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  escapedHeaders.forEach(header => {
    const regex = new RegExp(`#${header}`, 'g');
    text = text.replace(regex, `<span class="highlight-placeholder">#${header}</span>`);
  });

  return text;
}

// Generate message preview by replacing placeholders with first row data
function generatePreview(message, headers, firstRow) {
  if (!firstRow) return '';

  let preview = message;

  headers.forEach(header => {
    const regex = new RegExp(`#${header}`, 'g');
    preview = preview.replace(regex, firstRow[header] || '');
  });

  return preview;
}

// Split array into specified number of chunks
function chunkArray(array, chunks) {
  const perChunk = Math.ceil(array.length / chunks);
  const result = [];
  for (let i = 0; i < chunks; i++) {
    result.push(array.slice(i * perChunk, (i + 1) * perChunk));
  }
  return result;
}

// Show loading spinner for a client
function showSpinner(clientId) {
  const client = clients[clientId];
  if (!client) return;
  client.spinner.style.display = 'block';
}

// Hide loading spinner for a client
function hideSpinner(clientId) {
  const client = clients[clientId];
  if (!client) return;
  client.spinner.style.display = 'none';
}

// Update visibility of QR login overlay (hide only when all clients logged in)
function updateOverlayVisibility() {
  const allLoggedIn = Object.values(clients).every(client => client.loggedIn);
  qrLoginOverlay.style.display = allLoggedIn ? 'none' : 'flex';
}

/* ====================
  Event Handlers
==================== */

// Handle pasted Excel input with debounce
const handleExcelInput = debounce((text) => {
  parsedData = parseExcelText(text);
  renderTable(parsedData);
  updatePreview();
}, 300);

excelInput.addEventListener('input', e => {
  handleExcelInput(e.target.value);
});

// Clear table and reset inputs
clearTableBtn.addEventListener('click', () => {
  excelInput.value = '';
  parsedData = [];
  renderTable([]);
  messagePreview.innerHTML = '';
});

// Update preview on message input change (debounced)
messageInput.addEventListener('input', debounce(() => {
  updatePreview();
}, 200));

// Update the message preview with highlighted placeholders
function updatePreview() {
  if (!parsedData.length) {
    messagePreview.textContent = 'אין נתונים לתצוגה.';
    return;
  }

  const headers = Object.keys(parsedData[0]);
  const rawMessage = messageInput.value;

  let previewText = generatePreview(rawMessage, headers, parsedData[0]);
  previewText = highlightPlaceholders(previewText, headers);

  messagePreview.innerHTML = previewText || 'אין הודעה להצגה.';
}

// Send messages button click handler
sendMessagesBtn.addEventListener('click', async () => {
  if (!parsedData.length) {
    alert('אנא הדבק טבלה חוקית בצד שמאל.');
    return;
  }

  const messageTemplate = messageInput.value.trim();
  if (!messageTemplate) {
    alert('אנא כתוב הודעה מותאמת אישית.');
    return;
  }

  // Split data into 4 chunks, one per client
  const chunks = chunkArray(parsedData, 4);

  // Calculate delay based on average typing speed
  function calculateDelay(message) {
    const words = message.trim().split(/\s+/).length;
    const wpm = 40; // average words per minute
    const secondsPerWord = 60 / wpm;
    return words * secondsPerWord * 1000; // delay in milliseconds
  }

  // Send messages sequentially per client with delay
  async function sendMessagesSequentially(clientId, messages) {
    for (const row of messages) {
      // Replace placeholders (#field) in the message with actual data
      let personalizedMessage = messageTemplate;
      Object.keys(row).forEach(header => {
        const regex = new RegExp(`#${header}`, 'g');
        personalizedMessage = personalizedMessage.replace(regex, row[header] || '');
      });

      // Invoke IPC to send the message
      await ipcRenderer.invoke('send-whatsapp-messages', {
        clientId,
        data: [{ ...row, message: personalizedMessage }],
        template: personalizedMessage,
      });

      // Wait for human-like delay before next message
      const delay = calculateDelay(personalizedMessage);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  try {
    // Run all clients in parallel sending their chunks sequentially
    const results = await Promise.all(
      chunks.map((chunkData, idx) => {
        const clientId = idx + 1;
        if (chunkData.length === 0) return Promise.resolve(`לקוח ${clientId}: אין הודעות לשליחה.`);
        return sendMessagesSequentially(clientId, chunkData).then(() => `לקוח ${clientId}: סיום שליחה.`);
      })
    );
    alert(results.join('\n'));
  } catch (err) {
    alert('שגיאה בשליחת ההודעות: ' + err.message);
  }
});

/* ====================
  IPC Event Handlers
==================== */

// Event log to avoid duplicate event handling
const eventLog = {};

// Log an event once per eventName + clientId combo
function logEventOnce(eventName, clientId) {
  const key = `${eventName}_${clientId}`;
  if (eventLog[key]) {
    console.warn(`Duplicate event: ${eventName} for client ${clientId}`);
    return false;
  }
  eventLog[key] = true;
  console.log(`${new Date().toISOString()} - Event: ${eventName}, client: ${clientId}`);
  return true;
}

// Handle 'qr' event - show QR code and spinner
ipcRenderer.on('qr', (event, payload) => {
  if (!payload || typeof payload !== 'object') return;

  const client = clients[payload.clientId];
  if (!client) return;

  client.loggedIn = false;

  client.qrImage.style.display = 'block';
  client.qrImage.src = payload.qrDataUrl;

  client.loginStatus.textContent = `Agent ${payload.clientId}`;

  client.spinner.style.display = 'block';
  client.checkmark.style.display = 'none';

  client.qrImage.onload = () => {
    client.spinner.style.display = 'none';
  };

  qrLoginOverlay.style.display = 'flex';
});

// Handle 'authenticated' event - hide QR, show checkmark, mark logged in
ipcRenderer.on('authenticated', (event, clientId) => {
  if (!logEventOnce('authenticated', clientId)) return;

  const client = clients[clientId];
  if (!client) return;

  client.loggedIn = true;
  client.qrImage.style.display = 'none';
  client.spinner.style.display = 'none';
  client.checkmark.style.display = 'block';
  client.loginStatus.textContent = `Agent ${clientId} מחובר`;

  updateOverlayVisibility();
});

// Handle 'auth_failure' event - show login failure message
ipcRenderer.on('auth_failure', (event, clientId) => {
  if (!logEventOnce('auth_failure', clientId)) return;

  const client = clients[clientId];
  if (!client) return;

  client.loggedIn = false;
  client.loginStatus.textContent = `Agent ${clientId} כשלון התחברות - נסה שוב`;
  client.qrImage.style.display = 'none';
  client.spinner.style.display = 'none';
  client.checkmark.style.display = 'none';

  qrLoginOverlay.style.display = 'flex';
});
