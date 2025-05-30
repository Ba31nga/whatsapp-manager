const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', 'data', 'logs.json');

function readLogs() {
  try {
    if (!fs.existsSync(LOG_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(LOG_PATH, 'utf8');
    if (!raw.trim()) {
      // Empty file
      return [];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading logs:', e);
    return [];
  }
}

function appendLog(logEntry) {
  const logs = readLogs();
  logs.push(logEntry);
  try {
    fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Error writing logs:', e);
  }
}

module.exports = {
  getLogs: () => readLogs(),
  appendLog,
};
