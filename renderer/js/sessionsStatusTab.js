// sessionsStatusTab.js

// Map to store current statuses (optional, for reference)
const sessionsStatus = new Map();

/**
 * Returns all session IDs.
 * Update this list dynamically if needed.
 */
function getAllSessionIds() {
  return ['1', '2', '3', '4'];
}

/**
 * Update the UI of a session card based on sessionId and status
 * @param {string} sessionId - e.g. '1', '2', '3', '4'
 * @param {string} status - e.g. "available", "bulking", "chatbot"
 */
function renderSessionStatus(sessionId, status) {
  const statusIndicator = document.getElementById(`status${sessionId}`);
  const statusText = document.getElementById(`sessionStatusText${sessionId}`);

  if (!statusIndicator || !statusText) {
    console.warn(`Session elements for session ${sessionId} not found`);
    return;
  }

  // Clear previous status classes
  statusIndicator.classList.remove(
    'status-available',
    'status-bulking',
    'status-chatbot',
    'status-offline'
  );

  switch (status) {
    case 'available':
      statusIndicator.classList.add('status-available');
      statusText.textContent = 'זמין'; // Hebrew for "available"
      break;
    case 'bulking':
      statusIndicator.classList.add('status-bulking');
      statusText.textContent = 'טוען הודעות'; // "loading messages"
      break;
    case 'chatbot':
      statusIndicator.classList.add('status-chatbot');
      statusText.textContent = 'מצב צ׳אטבוט'; // "chatbot mode"
      break;
    case 'offline':
      statusIndicator.classList.add('status-offline');
      statusText.textContent = 'לא מחובר'; // "offline"
      break;
    default:
      statusIndicator.style.backgroundColor = 'gray';
      statusText.textContent = 'לא ידוע'; // "unknown"
      break;
  }
}

/**
 * Initialize the sessions status tab.
 * @param {object} api - The exposed API object from preload.js
 */
function initSessionsStatusTab(api) {
  if (!api || !api.onSessionStatusUpdated || !api.requestSessionStatus) {
    console.error('[SessionsStatusTab] API object or required methods are missing');
    return;
  }

  // Listen for live status updates from backend
  api.onSessionStatusUpdated((sessionId, status) => {
    console.log(`[SessionsStatusTab] Status update: session ${sessionId} is now ${status}`);
    sessionsStatus.set(sessionId, status);
    renderSessionStatus(sessionId, status);
  });

  // Refresh button logic
  let refreshButton = document.getElementById('refresh-session-statuses');
  if (!refreshButton) {
    refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-session-statuses';
    refreshButton.textContent = 'רענן מצב חיבורים'; // Hebrew: "Refresh Sessions Status"
    refreshButton.classList.add('refresh-button');
    // Place button inside main content or body
    const mainContent = document.getElementById('sessions-content');
    if (mainContent) {
      mainContent.appendChild(refreshButton);
    } else {
      document.body.appendChild(refreshButton);
    }
  }

  refreshButton.onclick = async () => {
    console.log('[SessionsStatusTab] Refresh button clicked, fetching all sessions statuses...');
    if (typeof getAllSessionIds !== 'function') {
      console.warn('getAllSessionIds() function is not defined.');
      return;
    }

    const sessionIds = getAllSessionIds();

    for (const sessionId of sessionIds) {
      try {
        const statusResult = await api.requestSessionStatus(sessionId);
        if (statusResult && statusResult.status) {
          sessionsStatus.set(sessionId, statusResult.status);
          renderSessionStatus(sessionId, statusResult.status);
        }
      } catch (error) {
        console.error(`[SessionsStatusTab] Error fetching status for session ${sessionId}`, error);
      }
    }
  };
}

export { initSessionsStatusTab };
