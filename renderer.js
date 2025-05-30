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

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;

  toast.style.cssText = `
    background-color: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
    color: white;
    padding: 12px 20px;
    margin-top: 10px;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    font-size: 16px;
    animation: fadein 0.3s, fadeout 0.5s 4.5s;
    opacity: 1;
    transition: opacity 0.5s ease-out;
  `;

  const container = document.getElementById('toast-container');
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 5000);
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
function chunkArray(arr, chunkCount) {
  const result = Array.from({ length: chunkCount }, () => []);
  arr.forEach((item, index) => {
    result[index % chunkCount].push(item);
  });
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
    showToast('אנא הדבק טבלה חוקית בצד שמאל.', 'error');
    return;
  }

  const messageTemplate = messageInput.value.trim();
  if (!messageTemplate) {
    showToast('אנא כתוב הודעה מותאמת אישית.', 'error');
    return;
  }

  // Split data into 4 chunks, one per client
  const chunks = chunkArray(parsedData, 4);

  // Calculate delay based on average typing speed
  function calculateDelay(message) {
    const randomFactor = 0.8 + Math.random() * 0.4
    const words = message.trim().split(/\s+/).length;
    const wpm = 40; // average words per minute
    const secondsPerWord = 60 / wpm;
    return words * secondsPerWord * 1000 * randomFactor; // delay in milliseconds
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
    showToast(results.join(' | '), 'success');
  } catch (err) {
    showToast('שגיאה בשליחת ההודעות: ' + err.message, 'error');

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
  const client = clients[payload.clientId];
  if (!client) return;

  client.loggedIn = false;
  client.qrImage.style.display = 'block';
  client.qrImage.src = payload.qrDataUrl;
  client.loginStatus.textContent = `Agent ${payload.clientId}`;

  client.spinner.style.display = 'block';
  client.checkmark.style.display = 'none';

  let qrLoaded = false;
  const timeout = setTimeout(() => {
    if (!qrLoaded) {
      client.spinner.style.display = 'none'; // fallback hide spinner anyway
    }
  }, 10000); // 10 seconds fallback

  client.qrImage.onload = () => {
    qrLoaded = true;
    clearTimeout(timeout);
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

  // Hide QR and spinner
  client.qrImage.style.display = 'none';
  client.spinner.style.display = 'none';

  // Show checkmark
  client.checkmark.style.display = 'block';

  client.loginStatus.textContent = `Agent ${clientId} מחובר`;

  // If all clients logged in, hide overlay
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
