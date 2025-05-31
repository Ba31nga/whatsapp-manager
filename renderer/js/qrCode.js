const qrImages = [
  document.getElementById('qrImage1'),
  document.getElementById('qrImage2'),
  document.getElementById('qrImage3'),
  document.getElementById('qrImage4'),
];

const loginStatuses = [
  document.getElementById('loginStatus1'),
  document.getElementById('loginStatus2'),
  document.getElementById('loginStatus3'),
  document.getElementById('loginStatus4'),
];

const qrLoginOverlay = document.getElementById('qrLoginOverlay');

function safeSetDisplay(el, displayValue) {
  if (el) {
    el.style.display = displayValue;
  }
}

function getUiElements(idx) {
  const qrImage = qrImages[idx];
  if (!qrImage) {
    console.warn(`[DEBUG] Session ${idx + 1}: QR image element missing`);
    return null;
  }

  const qrWrapper = qrImage.parentElement;
  if (!qrWrapper) {
    console.warn(`[DEBUG] Session ${idx + 1}: QR wrapper element missing`);
    return null;
  }

  const spinner = qrWrapper.querySelector('.spinner');
  const checkmark = qrWrapper.querySelector('.checkmark');
  const overlay = qrWrapper.querySelector('.overlay');

  return { qrImage, spinner, checkmark, overlay };
}

export function setupQrCodeListeners(api) {
  console.log('setupQrCodeListeners called, api:', api);

  // Store the statuses of all sessions here, default empty string
  const sessionStatuses = ['', '', '', ''];

  api.onQrCode((sessionId, qr) => {
    console.log('Received qr event:', sessionId, qr);
    const idx = sessionId - 1;

    const ui = getUiElements(idx);
    if (!ui) return;

    const { qrImage, spinner, checkmark, overlay } = ui;

    // Reset UI state for new QR
    safeSetDisplay(checkmark, 'none');
    safeSetDisplay(spinner, 'block');
    safeSetDisplay(overlay, 'none');

    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=200x200`;
    safeSetDisplay(qrImage, 'block');

    if (loginStatuses[idx]) {
      loginStatuses[idx].textContent = 'סרוק את קוד ה-QR';
    } else {
      console.warn(`[DEBUG] Session ${sessionId}: loginStatus element missing`);
    }

    qrImage.onload = () => {
      console.log(`[DEBUG] Session ${sessionId}: QR image loaded.`);
      safeSetDisplay(spinner, 'none');
      safeSetDisplay(overlay, 'none');
    };

    qrImage.onerror = () => {
      console.error(`[DEBUG] Session ${sessionId}: QR image failed to load.`);
      safeSetDisplay(spinner, 'none');
      safeSetDisplay(overlay, 'block');
      if (loginStatuses[idx]) loginStatuses[idx].textContent = 'שגיאה בטעינת QR';
    };
  });

  api.onLoginStatus((sessionId, status) => {
    console.log('Received status event:', sessionId, status);
    const idx = sessionId - 1;

    if (!loginStatuses[idx]) {
      console.warn(`[DEBUG] Session ${sessionId}: Login status element not found.`);
      return;
    }

    // Update stored status
    sessionStatuses[idx] = status;

    loginStatuses[idx].textContent = status;

    const ui = getUiElements(idx);
    if (!ui) return;

    const { qrImage, spinner, checkmark, overlay } = ui;

    switch (status) {
      case 'מחובר':
        safeSetDisplay(qrImage, 'none');
        safeSetDisplay(spinner, 'none');
        safeSetDisplay(checkmark, 'block');
        safeSetDisplay(overlay, 'none');
        break;

      case 'מנותק, מנסה להתחבר מחדש':
        safeSetDisplay(qrImage, 'none');
        safeSetDisplay(spinner, 'block');
        safeSetDisplay(checkmark, 'none');
        safeSetDisplay(overlay, 'none');
        break;

      case 'כשל באימות':
        safeSetDisplay(qrImage, 'none');
        safeSetDisplay(spinner, 'none');
        safeSetDisplay(checkmark, 'none');
        safeSetDisplay(overlay, 'block');
        break;

      default:
        safeSetDisplay(qrImage, 'block');
        safeSetDisplay(spinner, 'block');
        safeSetDisplay(checkmark, 'none');
        safeSetDisplay(overlay, 'none');
        break;
    }

    // Check if all sessions are connected
    const allConnected = sessionStatuses.every(s => s === 'מחובר');

    if (qrLoginOverlay) {
      if (allConnected) {
        qrLoginOverlay.style.display = 'none';  // hide overlay only if all connected
      } else {
        qrLoginOverlay.style.display = 'flex';  // show overlay otherwise
      }
    }
  });
}

