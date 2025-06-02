// SessionManager.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class SessionManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();          // sessionId -> client
    this.sessionStatus = new Map();     // sessionId -> status string
    this.sessionRoles = new Map();      // sessionId -> role ('bulking' or 'chatbot')
    this.retryCounts = new Map();       // sessionId -> number of reconnect attempts
    this.MAX_RETRIES = 5;
    this.RETRY_DELAY_MS = 5000;
    this.rolesFilePath = path.resolve(__dirname, 'sessionRoles.json');

    console.log('[SessionManager] Initializing sessions...');
    this.loadRolesFromFile();
    this.initSessions();
  }

  loadRolesFromFile() {
    try {
      if (fs.existsSync(this.rolesFilePath)) {
        const data = fs.readFileSync(this.rolesFilePath, 'utf8');
        const rolesObj = JSON.parse(data);
        for (const [sessionId, role] of Object.entries(rolesObj)) {
          this.sessionRoles.set(Number(sessionId), role);
        }
        console.log('[SessionManager] Loaded session roles from file.');
      } else {
        console.log('[SessionManager] No roles file found, starting fresh.');
      }
    } catch (err) {
      console.error('[SessionManager] Error loading roles from file:', err);
    }
  }

  saveRolesToFile() {
    try {
      const rolesObj = {};
      for (const [sessionId, role] of this.sessionRoles.entries()) {
        rolesObj[sessionId] = role;
      }
      fs.writeFileSync(this.rolesFilePath, JSON.stringify(rolesObj, null, 2), 'utf8');
      console.log('[SessionManager] Saved session roles to file.');
    } catch (err) {
      console.error('[SessionManager] Error saving roles to file:', err);
    }
  }

  async initSessions() {
    for (let i = 1; i <= 4; i++) {
      console.log(`[SessionManager] Creating session ${i}`);
      await this.delay(2000);
      this.createSession(i);

      // Assign role: load from file if exists, else default
      if (!this.sessionRoles.has(i)) {
        const role = i <= 2 ? 'bulking' : 'chatbot';
        this.setSessionRole(i, role);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setSessionStatus(sessionId, status) {
    this.sessionStatus.set(sessionId, status);
    this.emit('status', sessionId, status);
  }

  setSessionRole(sessionId, role) {
    this.sessionRoles.set(sessionId, role);
    this.saveRolesToFile();
  }

  getSessionRole(sessionId) {
    return this.sessionRoles.get(sessionId) || null;
  }

  createSession(sessionId) {
    console.log(`[SessionManager] createSession called for session ${sessionId}`);

    this.retryCounts.set(sessionId, 0);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: `client${sessionId}` }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox']
      },
    });

    this.sessions.set(sessionId, client);
    this.setSessionStatus(sessionId, 'מתחבר...');

    client.on('qr', (qr) => {
      console.log(`[SessionManager] QR received for session ${sessionId}`);
      this.emit('qr', sessionId, qr);
      this.setSessionStatus(sessionId, 'סריקת QR נדרשת');
    });

    client.on('ready', () => {
      console.log(`[SessionManager] Client ready for session ${sessionId}`);
      this.setSessionStatus(sessionId, 'מחובר');
      this.retryCounts.set(sessionId, 0);
    });

    client.on('authenticated', () => {
      console.log(`[SessionManager] Client authenticated for session ${sessionId}`);
      this.setSessionStatus(sessionId, 'מאומת');
    });

    client.on('auth_failure', (msg) => {
      console.log(`[SessionManager] Authentication failure for session ${sessionId}: ${msg}`);
      this.setSessionStatus(sessionId, 'כשל באימות');
    });

    client.on('disconnected', (reason) => {
      console.log(`[SessionManager] Disconnected session ${sessionId}, reason: ${reason}`);
      this.setSessionStatus(sessionId, 'מנותק, מנסה להתחבר מחדש');

      let retries = this.retryCounts.get(sessionId) || 0;
      retries++;
      this.retryCounts.set(sessionId, retries);

      if (retries > this.MAX_RETRIES) {
        console.error(`[SessionManager] Session ${sessionId} exceeded max retries. Stopping reconnect attempts.`);
        this.setSessionStatus(sessionId, 'מנותק לצמיתות - אנא בדוק את החיבור');
        return;
      }

      setTimeout(async () => {
        try {
          await client.destroy();
        } catch (e) {
          console.warn(`[SessionManager] Error destroying client for session ${sessionId}:`, e.message);
        }
        this.createSession(sessionId);
      }, this.RETRY_DELAY_MS);
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
      this.setSessionStatus(sessionId, 'שגיאה באתחול');
    });
  }

  updateRole(sessionId, newRole) {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} does not exist.`);
    }

    const currentStatus = this.sessionStatus.get(sessionId);
    if (currentStatus !== 'מחובר') {
      throw new Error(`Cannot change role for session ${sessionId} because its status is "${currentStatus}". Only sessions with status "מחובר" can have their roles changed.`);
    }

    this.sessionRoles.set(sessionId, newRole);
    this.saveRolesToFile();
    this.emit('roleUpdated', sessionId, newRole);
    console.log(`[SessionManager] Updated role for session ${sessionId} to ${newRole}`);
  }



  normalizePhone(phoneRaw) {
    let phone = phoneRaw.replace(/\D/g, '');

    if (!phone) return null;

    if (phone.startsWith('0')) {
      phone = '972' + phone.slice(1);
    } else if (phone.startsWith('972')) {
      // already correct
    } else if (phone.length === 9) {
      phone = '972' + phone;
    } else if (phone.length < 9) {
      return null;
    }

    return phone;
  }

  async sendMessages(sessionId, data, messageTemplate) {
    const client = this.sessions.get(sessionId);
    const status = this.sessionStatus.get(sessionId);

    if (!client || !client.info || !client.info.wid || status !== 'מחובר') {
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

  async sendMessagesSplit(data, messageTemplate) {
    // Filter sessions that are bulking and connected
    const bulkingSessions = Array.from(this.sessions.keys()).filter(sessionId =>
      this.sessionRoles.get(sessionId) === 'bulking' &&
      this.sessionStatus.get(sessionId) === 'מחובר'
    );

    console.log(`[SessionManager] Found ${bulkingSessions.length} bulking sessions connected.`);
    console.log(`[SessionManager] Sending total ${data.length} messages.`);

    if (bulkingSessions.length === 0) {
      throw new Error('אין לך מספיק סוכנים עם התפקיד : "שליחת הודעות"');
    }

    // Calculate chunk size properly
    const chunkSize = Math.ceil(data.length / bulkingSessions.length);

    // Create chunks to split the data evenly across bulking sessions
    const chunks = bulkingSessions.map((_, index) =>
      data.slice(index * chunkSize, (index + 1) * chunkSize)
    );

    // Remove empty chunks (in case data.length < bulkingSessions.length)
    const nonEmptyChunks = chunks.filter(chunk => chunk.length > 0);

    if (nonEmptyChunks.length === 0) {
      console.log('[SessionManager] No data to send after chunking.');
      return;
    }

    // Send messages in parallel
    const sendPromises = nonEmptyChunks.map((chunk, index) => {
      const sessionId = bulkingSessions[index];
      console.log(`[SessionManager] Sending ${chunk.length} messages via session ${sessionId}`);
      return this.sendMessages(sessionId, chunk, messageTemplate);
    });

    await Promise.all(sendPromises);
  }


  async sendSingleMessage(sessionId, recipientData, messageTemplate) {
    const client = this.sessions.get(sessionId);
    const status = this.sessionStatus.get(sessionId);

    if (!client || !client.info || !client.info.wid || status !== 'מחובר') {
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
    const normalizedMap = {};
    for (const key in dataRow) {
      const normalizedKey = key.replace(/[\s_]/g, '').toLowerCase();
      normalizedMap[normalizedKey] = dataRow[key];
    }

    return template.replace(/#(?:\{([\p{L}\w\s_]+)\}|([\p{L}\w_]+))/gu, (match, p1, p2) => {
      const keyRaw = p1 || p2;
      const normalizedKey = keyRaw.replace(/[\s_]/g, '').toLowerCase();
      return normalizedMap[normalizedKey] !== undefined ? normalizedMap[normalizedKey] : match;
    });
  }
}

module.exports = SessionManager;
