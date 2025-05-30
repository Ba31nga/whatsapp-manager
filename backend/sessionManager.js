const { Client, LocalAuth } = require('whatsapp-web.js');
const EventEmitter = require('events');

class SessionManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    console.log('[SessionManager] Initializing sessions...');
    this.initSessions();
  }

  async initSessions() {
    for (let i = 1; i <= 4; i++) {
      console.log(`[SessionManager] Creating session ${i}`);
      await this.delay(2000);
      this.createSession(i);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  createSession(sessionId) {
    console.log(`[SessionManager] createSession called for session ${sessionId}`);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: `client${sessionId}` }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox']
        // ❌ Removed userDataDir
      },
    });

    client.on('qr', (qr) => {
      console.log(`[SessionManager] QR received for session ${sessionId}`);
      this.emit('qr', sessionId, qr);
      this.emit('status', sessionId, 'סריקת QR נדרשת');
    });

    client.on('ready', () => {
      console.log(`[SessionManager] Client ready for session ${sessionId}`);
      this.emit('status', sessionId, 'מחובר');
    });

    client.on('authenticated', () => {
      console.log(`[SessionManager] Client authenticated for session ${sessionId}`);
      this.emit('status', sessionId, 'מאומת');
    });

    client.on('auth_failure', (msg) => {
      console.log(`[SessionManager] Authentication failure for session ${sessionId}: ${msg}`);
      this.emit('status', sessionId, 'כשל באימות');
    });

    client.on('disconnected', (reason) => {
      console.log(`[SessionManager] Disconnected session ${sessionId}, reason: ${reason}`);
      this.emit('status', sessionId, 'מנותק, מנסה להתחבר מחדש');
      client.destroy();
      this.createSession(sessionId);
    });

    client.on('change_state', (state) => {
      console.log(`[SessionManager] State changed for session ${sessionId}: ${state}`);
    });

    client.on('loading_screen', (percent) => {
      console.log(`[SessionManager] Loading screen progress for session ${sessionId}: ${percent}%`);
    });

    client.on('message', (msg) => {
      console.log(`[SessionManager] Message received for session ${sessionId}:`, msg.body);
    });

    client.initialize().catch((err) => {
      console.error(`[SessionManager] Error initializing client for session ${sessionId}:`, err);
    });

    this.sessions.set(sessionId, client);
  }

  async sendMessages(sessionId, data, messageTemplate) {
    const client = this.sessions.get(sessionId);
    if (!client || !client.info || !client.info.wid) {
      throw new Error(`Session ${sessionId} לא מחובר`);
    }

    for (const row of data) {
      const personalizedMessage = this.replacePlaceholders(messageTemplate, row);
      const phone = row.phone.replace(/\D/g, '');
      const chatId = phone + '@c.us';

      try {
        await client.sendMessage(chatId, personalizedMessage);
        this.emit('messageSent', {
          sessionId,
          phone,
          message: personalizedMessage,
          status: 'נשלח',
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        this.emit('messageSent', {
          sessionId,
          phone,
          message: personalizedMessage,
          status: 'נכשל',
          error: e.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  replacePlaceholders(template, dataRow) {
    return template.replace(/#(\w+)/g, (match, p1) => {
      return dataRow[p1] !== undefined ? dataRow[p1] : match;
    });
  }
}

module.exports = SessionManager;
