const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let win;
let client;

if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`),
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');
  initWhatsappClient();
}

function initWhatsappClient() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: "electron-whatsapp" }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    // Convert QR to data URL and send to renderer
    qrcode.toDataURL(qr, (err, url) => {
      if (err) {
        console.error('QR generate error:', err);
        return;
      }
      win.webContents.send('qr', url);
      win.webContents.send('loginStatus', 'סרוק את הברקוד עם וואטסאפ במכשירך');
    });
  });

  client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    win.webContents.send('ready');
    win.webContents.send('loginStatus', 'וואטסאפ מוכן לשימוש');
  });

  client.on('authenticated', () => {
    console.log('WhatsApp client authenticated');
    win.webContents.send('authenticated');
    win.webContents.send('loginStatus', 'מחובר בהצלחה לוואטסאפ!');
  });

  client.on('auth_failure', (msg) => {
    console.error('Auth failure:', msg);
    win.webContents.send('auth_failure');
    win.webContents.send('loginStatus', 'נכשל בחיבור. נסה לאתחל את האפליקציה.');
  });

  client.initialize();
}

// Listen for message sending from renderer
ipcMain.handle('send-whatsapp-messages', async (event, { data, template }) => {
  if (!client || !client.info) {
    return 'לא מחובר לוואטסאפ. אנא סרוק את הברקוד והתחבר.';
  }

  try {
    for (const row of data) {
      // Replace placeholders in the template
      let message = template;
      for (const key in row) {
        const placeholder = new RegExp(`#${key}`, 'g');
        message = message.replace(placeholder, row[key]);
      }

      // Validate phone number: try to extract from row.phone or row.Phone or first header starting with "phone"
      let phone = null;
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('phone')) {
          phone = row[key].replace(/\D/g, ''); // keep only digits
          break;
        }
      }
      if (!phone) {
        console.warn('No phone number found in row:', row);
        continue; // skip if no phone found
      }

      // WhatsApp requires phone with country code, no plus sign
      if (phone.startsWith('0')) {
        // Assuming local Israeli number, convert 0 prefix to 972 (you can adjust)
        phone = '972' + phone.slice(1);
      }

      const chatId = phone + '@c.us';

      // Send message
      await client.sendMessage(chatId, message);
      // Add small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));
    }
    return `נשלחו ${data.length} הודעות בהצלחה!`;
  } catch (err) {
    console.error('Error sending messages:', err);
    throw err;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
