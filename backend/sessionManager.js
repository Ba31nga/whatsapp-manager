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

  normalizePhone(phoneRaw) {
    let phone = phoneRaw.replace(/\D/g, '');

    if (!phone) return null;

    if (phone.startsWith('0')) {
      phone = '972' + phone.slice(1);
    } else if (phone.startsWith('972')) {
      // already in correct format
    } else if (phone.length === 9) {
      phone = '972' + phone;
    } else if (phone.length < 9) {
      return null; // invalid phone number
    }

    return phone;
  }

  async sendMessages(sessionId, data, messageTemplate) {
    const client = this.sessions.get(sessionId);
    if (!client || !client.info || !client.info.wid) {
      throw new Error(`Session ${sessionId} לא מחובר`);
    }

    console.log(`[SessionManager] Session ${sessionId} sending ${data.length} messages`);

    for (const row of data) {
      const personalizedMessage = this.replacePlaceholders(messageTemplate, row);
      const normalizedPhone = this.normalizePhone(row.phone);
      if (!normalizedPhone) {
        this.emit('messageSent', {
          sessionId,
          phone: row.phone,
          message: personalizedMessage,
          status: 'נכשל',
          error: 'מספר טלפון לא חוקי',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      const chatId = normalizedPhone + '@c.us';

      try {
        await client.sendMessage(chatId, personalizedMessage);
        this.emit('messageSent', {
          sessionId,
          phone: normalizedPhone,
          message: personalizedMessage,
          status: 'נשלח',
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        this.emit('messageSent', {
          sessionId,
          phone: normalizedPhone,
          message: personalizedMessage,
          status: 'נכשל',
          error: e.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Splits workload and sends messages concurrently across sessions.
   */
  async sendMessagesSplit(data, messageTemplate) {
    const totalSessions = 4;
    const chunkSize = Math.ceil(data.length / totalSessions);

    const chunks = [];
    for (let i = 0; i < totalSessions; i++) {
      chunks.push(data.slice(i * chunkSize, (i + 1) * chunkSize));
    }

    const sendPromises = [];

    chunks.forEach((chunk, index) => {
      const sessionId = index + 1;
      if (chunk.length === 0) {
        console.log(`[SessionManager] No data for session ${sessionId}, skipping send.`);
        return; // skip empty chunks
      }
      sendPromises.push(this.sendMessages(sessionId, chunk, messageTemplate));
    });

    await Promise.all(sendPromises);
  }

  async sendSingleMessage(sessionId, recipientData, messageTemplate) {
    const client = this.sessions.get(sessionId);
    if (!client || !client.info || !client.info.wid) {
      throw new Error(`Session ${sessionId} לא מחובר`);
    }

    const personalizedMessage = this.replacePlaceholders(messageTemplate, recipientData);
    const normalizedPhone = this.normalizePhone(recipientData.phone || '');

    if (!normalizedPhone) {
      throw new Error('מספר טלפון לא חוקי בנתוני הנמען');
    }

    const chatId = normalizedPhone + '@c.us';

    try {
      await client.sendMessage(chatId, personalizedMessage);
      this.emit('messageSent', {
        sessionId,
        phone: normalizedPhone,
        message: personalizedMessage,
        status: 'נשלח',
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      this.emit('messageSent', {
        sessionId,
        phone: normalizedPhone,
        message: personalizedMessage,
        status: 'נכשל',
        error: e.message,
        timestamp: new Date().toISOString(),
      });
      throw e;
    }
  }

  replacePlaceholders(template, dataRow) {
    return template.replace(/#(\w+)/g, (match, p1) => {
      return dataRow[p1] !== undefined ? dataRow[p1] : match;
    });
  }
}

module.exports = SessionManager;
