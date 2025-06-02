import { showToast } from './toastManager.js';

// Maps to store current statuses and roles
const sessionsStatus = new Map();
const sessionsRole = new Map();

/**
 * Returns all session IDs.
 * Update this list dynamically if needed.
 * @returns {Promise<string[]>}
 */
async function getAllSessionIds() {
  return [1, 2, 3, 4];
}

/**
 * Update the UI of a session card based on sessionId and status
 * @param {string} sessionId
 * @param {string} status
 */
function renderSessionStatus(sessionId, status) {
  const statusIndicator = document.getElementById(`status${sessionId}`);
  const statusText = document.getElementById(`sessionStatusText${sessionId}`);
  const roleSelect = document.getElementById(`roleSelect${sessionId}`);

  if (!statusIndicator || !statusText) {
    console.warn(`Session elements for session ${sessionId} not found`);
    return;
  }

  statusIndicator.classList.remove(
    'status-available',
    'status-bulking',
    'status-chatbot',
    'status-offline'
  );
  statusIndicator.style.backgroundColor = '';

  switch (status) {
    case 'available':
      statusIndicator.classList.add('status-available');
      statusText.textContent = 'זמין'; // Available (Hebrew)
      if (roleSelect) roleSelect.disabled = false;
      break;
    case 'bulking':
      statusIndicator.classList.add('status-bulking');
      statusText.textContent = 'טוען הודעות'; // Loading messages
      if (roleSelect) roleSelect.disabled = true;
      break;
    case 'chatbot':
      statusIndicator.classList.add('status-chatbot');
      statusText.textContent = 'מצב צ׳אטבוט'; // Chatbot mode
      if (roleSelect) roleSelect.disabled = true;
      break;
    case 'offline':
      statusIndicator.classList.add('status-offline');
      statusText.textContent = 'לא מחובר'; // Offline
      if (roleSelect) roleSelect.disabled = true;
      break;
    default:
      statusIndicator.style.backgroundColor = 'gray';
      statusText.textContent = 'לא ידוע'; // Unknown
      if (roleSelect) roleSelect.disabled = true;
      break;
  }
}

/**
 * Update the UI role <select> element for a session
 * @param {string} sessionId
 * @param {string} role - "bulking" or "chatbot"
 */
function renderSessionRole(sessionId, role) {
  const select = document.getElementById(`roleSelect${sessionId}`);
  if (!select) {
    console.warn(`Role select for session ${sessionId} not found`);
    return;
  }
  select.value = role === 'chatbot' ? 'chatbot' : 'bulking';

  // Set disabled state based on current session status
  const status = sessionsStatus.get(sessionId);
  if (status !== 'available') {
    select.disabled = true;
  } else {
    select.disabled = false;
  }
}

/**
 * Initialize the sessions status tab.
 * @param {object} api - The exposed API object from preload.js
 */
async function initSessionsStatusTab(api) {
  console.log('SessionsStatusTab initializing with api methods:', {
    apiDefined: !!api,
    onSessionStatusUpdated: typeof api?.onSessionStatusUpdated,
    requestSessionStatus: typeof api?.requestSessionStatus,
    updateSessionRole: typeof api?.updateSessionRole,
    requestSessionRole: typeof api?.requestSessionRole,
  });

  if (
    !api ||
    typeof api.onSessionStatusUpdated !== 'function' ||
    typeof api.requestSessionStatus !== 'function' ||
    typeof api.updateSessionRole !== 'function' ||
    typeof api.requestSessionRole !== 'function'
  ) {
    console.error('[SessionsStatusTab] API object or required methods are missing or not functions');
    return;
  }

  // Listen for live status updates from backend
  api.onSessionStatusUpdated((sessionId, status) => {
    console.log(`[SessionsStatusTab] Status update: session ${sessionId} is now ${status}`);
    sessionsStatus.set(sessionId, status);
    renderSessionStatus(sessionId, status);
  });

  // Refresh button setup
  let refreshButton = document.getElementById('refresh-session-statuses');
  if (!refreshButton) {
    refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-session-statuses';
    refreshButton.textContent = 'רענן מצב חיבורים'; // "Refresh Sessions Status"
    refreshButton.classList.add('refresh-button');
    const mainContent = document.getElementById('sessions-content');
    if (mainContent) {
      mainContent.appendChild(refreshButton);
    } else {
      document.body.appendChild(refreshButton);
    }
  }

  refreshButton.onclick = async () => {
    console.log('[SessionsStatusTab] Refresh button clicked, fetching all sessions statuses and roles...');
    let sessionIds;
    try {
      sessionIds = await getAllSessionIds();
    } catch (err) {
      console.error('[SessionsStatusTab] Failed to get session IDs', err);
      showToast('שגיאה בקבלת רשימת הפעלות', 'error');
      return;
    }

    for (const sessionId of sessionIds) {
      try {
        // Fetch session status
        const statusResult = await api.requestSessionStatus(sessionId);
        if (statusResult && statusResult.status) {
          sessionsStatus.set(sessionId, statusResult.status);
          renderSessionStatus(sessionId, statusResult.status);
        }

        // Fetch session role
        const roleResult = await api.requestSessionRole(sessionId);
        if (roleResult && roleResult.role) {
          sessionsRole.set(sessionId, roleResult.role);
          renderSessionRole(sessionId, roleResult.role);
        }
      } catch (error) {
        console.error(`[SessionsStatusTab] Error fetching status or role for session ${sessionId}`, error);
      }
    }

    // After data load, setup role change listeners
    setupRoleChangeListeners(sessionIds);
  };

  /**
   * Setup change listeners on each role select element.
   * Must be called **after** session elements are present in DOM and
   * after roles are rendered.
   * @param {string[]} sessionIds
   */
  function setupRoleChangeListeners(sessionIds) {
    for (const sessionId of sessionIds) {
      const select = document.getElementById(`roleSelect${sessionId}`);
      if (!select) {
        console.warn(`Role select for session ${sessionId} not found`);
        continue;
      }
      select.onchange = async (e) => {
        if (select.disabled) {
          console.warn(`[SessionsStatusTab] Role select for session ${sessionId} is disabled. Ignoring change.`);
          return;
        }

        const newRole = e.target.value;
        console.log(`[SessionsStatusTab] User changed role for session ${sessionId} to ${newRole}`);

        try {
          await api.updateSessionRole(sessionId, newRole);
          sessionsRole.set(sessionId, newRole);
          showToast(`הפקיד שונה בהצלחה ל־${newRole === 'chatbot' ? 'צ׳אט בוט' : 'שולח הודעות'}`, 'success');
        } catch (error) {
          console.error(`[SessionsStatusTab] Failed to update role for session ${sessionId}`, error);
          showToast('שגיאה בעדכון תפקיד', 'error');
          select.value = sessionsRole.get(sessionId) || 'bulking';
        }
      };
    }
  }

  // Initial load: fetch statuses and roles (triggers role listeners setup)
  refreshButton.click();
}

export { initSessionsStatusTab };
