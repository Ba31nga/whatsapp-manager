const logTableBody = document.querySelector('#logTable tbody');

export async function loadLogs(api) {
  try {
    const logs = await api.requestGetLogs();
    renderLogs(logs);
  } catch (e) {
    logTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">שגיאה בטעינת הלוגים.</td></tr>';
  }
}

function renderLogs(logs) {
  if (!logs || logs.length === 0) {
    logTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">אין הודעות שנשלחו.</td></tr>';
    return;
  }

  let html = '';
  logs.slice(-100).reverse().forEach(log => {
    html += `<tr>
      <td>${new Date(log.timestamp).toLocaleString('he-IL')}</td>
      <td>${log.number || log.phone}</td>
      <td>${log.type || ''}</td>
      <td>${log.status}</td>
      <td>${log.details || log.message || ''}</td>
    </tr>`;
  });
  logTableBody.innerHTML = html;
}
