const { Client, LocalAuth } = require('whatsapp-web.js');
const EventEmitter = require('events');

class SessionManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.readySessions = new Set();
    console.log('[SessionManager] Initializing sessions...');
    this.initSessions();
  }

  async initSessions() {
    // Create all sessions concurrently
    const createPromises = [];
    for (let i = 1; i <= 4; i++) {
      console.log(`[SessionManager] Creating session ${i}`);
      createPromises.push(this.createSession(i));
    }
    await Promise.all(createPromises);
  }

  async createSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      console.log(`[SessionManager] Session ${sessionId} already exists, skipping creation.`);
      return;
    }

    console.log(`[SessionManager] createSession called for session ${sessionId}`);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: `client${sessionId}` }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox'],
      },
    });

    client.on('qr', (qr) => {
      console.log(`[SessionManager] QR received for session ${sessionId}`);
      this.emit('qr', sessionId, qr);
      this.emit('status', sessionId, 'סריקת QR נדרשת');
    });

    client.on('ready', () => {
      console.log(`[SessionManager] Client ready for session ${sessionId}`);
      this.readySessions.add(sessionId);
      this.emit('status', sessionId, 'מחובר');
      this.emit('ready', sessionId);
    });

    client.on('authenticated', () => {
      console.log(`[SessionManager] Client authenticated for session ${sessionId}`);
      this.emit('status', sessionId, 'מאומת');
    });

    client.on('auth_failure', (msg) => {
      console.log(`[SessionManager] Authentication failure for session ${sessionId}: ${msg}`);
      this.emit('status', sessionId, 'כשל באימות');
    });

    client.on('disconnected', async (reason) => {
      console.log(`[SessionManager] Disconnected session ${sessionId}, reason: ${reason}`);
      this.emit('status', sessionId, 'מנותק, מנסה להתחבר מחדש');
      this.readySessions.delete(sessionId);

      // Destroy current client and recreate after short delay
      await client.destroy();

      // Remove old session and recreate new one
      this.sessions.delete(sessionId);
      // Recreate session (wait 3 seconds before retrying)
      setTimeout(() => this.createSession(sessionId), 3000);
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

    try {
      await client.initialize();
      this.sessions.set(sessionId, client);
    } catch (err) {
      console.error(`[SessionManager] Error initializing client for session ${sessionId}:`, err);
    }
  }

  // Wait for all sessions to be ready
  waitForAllReady(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const expectedSessions = 4;
      const checkReady = () => {
        if (this.readySessions.size === expectedSessions) {
          resolve();
        }
      };

      checkReady();

      const interval = setInterval(() => {
        checkReady();
      }, 500);

      // Timeout fallback
      setTimeout(() => {
        clearInterval(interval);
        if (this.readySessions.size === expectedSessions) {
          resolve();
        } else {
          reject(new Error('Timeout waiting for all sessions to be ready'));
        }
      }, timeoutMs);
    });
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
    if (!client || !this.readySessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} לא מחובר או לא מוכן`);
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
   * Waits for all sessions to be ready before sending.
   */
  async sendMessagesSplit(data, messageTemplate) {
    const totalSessions = 4;
    const chunkSize = Math.ceil(data.length / totalSessions);

    // Wait for all sessions to be ready before sending
    await this.waitForAllReady();

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
    if (!client || !this.readySessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} לא מחובר או לא מוכן`);
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
