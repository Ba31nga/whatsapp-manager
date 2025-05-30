// main.js

// ----- imports -----
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// ----- globals -----
let win;
const clients = {}; // store 4 clients indexed by ID: 1,2,3,4

// ----- development reload -----
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`),
  });
}

// ----- create main window -----
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');

  // wait until window is ready before initializing WhatsApp clients
  win.webContents.once('did-finish-load', () => {
    console.log("window finished loading");
    initWhatsappClients();
  });
}

// ----- send message to renderer helper -----
function sendToRenderer(channel, data) {
  if (win && win.webContents) {
    win.webContents.send(channel, data);
  } else {
    console.warn(`cannot send to renderer; window not ready. channel: ${channel}`);
  }
}

// ----- initialize whatsapp clients -----
function initWhatsappClients() {
  for (let i = 1; i <= 4; i++) {
    const clientId = `electron-whatsapp-${i}`;
    const client = new Client({
      authStrategy: new LocalAuth({ clientId }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    // listen for qr code event
    client.on('qr', (qr) => {
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          console.error(`qr generate error client ${i}:`, err);
          return;
        }
        sendToRenderer('qr', { clientId: i, qrDataUrl: url });
        sendToRenderer('loginStatus', { clientId: i, status: 'סרוק את הברקוד עם וואטסאפ במכשירך' });
      });
    });

    // listen for client ready event
    client.on('ready', () => {
      console.log(`whatsapp client ${i} is ready!`);
      sendToRenderer('ready', i);
      sendToRenderer('loginStatus', { clientId: i, status: 'וואטסאפ מוכן לשימוש' });
    });

    // listen for client authenticated event
    client.on('authenticated', () => {
      console.log(`whatsapp client ${i} authenticated`);
      sendToRenderer('authenticated', i);
      sendToRenderer('loginStatus', { clientId: i, status: 'מחובר בהצלחה לוואטסאפ!' });
    });

    // listen for authentication failure
    client.on('auth_failure', (msg) => {
      console.error(`auth failure client ${i}:`, msg);
      sendToRenderer('auth_failure', i);
      sendToRenderer('loginStatus', { clientId: i, status: 'נכשל בחיבור. נסה לאתחל את האפליקציה.' });
    });

    client.initialize();
    clients[i] = client;
  }
}

// ----- ipc handler for sending whatsapp messages -----
ipcMain.handle('send-whatsapp-messages', async (event, { clientId, data, template }) => {
  const client = clients[clientId];
  if (!client || !client.info) {
    return `לקוח וואטסאפ ${clientId} לא מחובר. אנא סרוק את הברקוד והתחבר.`;
  }

  try {
    for (const row of data) {
      let message = template;
      // replace placeholders with actual values
      for (const key in row) {
        const placeholder = new RegExp(`#${key}`, 'g');
        message = message.replace(placeholder, row[key]);
      }

      // find phone number in row
      let phone = null;
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('phone')) {
          phone = row[key].replace(/\D/g, '');
          break;
        }
      }
      if (!phone) {
        console.warn('no phone number found in row:', row);
        continue;
      }

      // normalize israeli phone number
      if (phone.startsWith('0')) {
        phone = '972' + phone.slice(1);
      } else if (phone.startsWith('5')) {
        phone = '972' + phone;
      }

      const chatId = phone + '@c.us';

      await client.sendMessage(chatId, message);
      await new Promise((r) => setTimeout(r, 1500));
    }
    return `נשלחו ${data.length} הודעות בהצלחה מלקוח ${clientId}!`;
  } catch (err) {
    console.error(`error sending messages from client ${clientId}:`, err);
    throw err;
  }
});

// ----- app lifecycle events -----
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
