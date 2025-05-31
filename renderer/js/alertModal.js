// alertModal.js

export function showConfirmAlert(message) {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.4)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 9999;

    // Create modal container
    const modal = document.createElement('div');
    modal.style.background = '#222';
    modal.style.padding = '20px 30px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
    modal.style.minWidth = '320px';
    modal.style.color = '#fff';
    modal.style.fontFamily = 'Arial, sans-serif';
    modal.style.textAlign = 'center';

    // Message
    const msg = document.createElement('p');
    msg.textContent = message;
    msg.style.marginBottom = '24px';
    msg.style.fontSize = '16px';

    // Buttons container
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'center';
    btnContainer.style.gap = '16px';

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'אישור';
    confirmBtn.style.padding = '8px 18px';
    confirmBtn.style.backgroundColor = '#4ea1ff';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '4px';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.fontWeight = '700';
    confirmBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(true);
    });

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'ביטול';
    cancelBtn.style.padding = '8px 18px';
    cancelBtn.style.backgroundColor = '#666';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.color = '#eee';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontWeight = '700';
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(false);
    });

    btnContainer.appendChild(confirmBtn);
    btnContainer.appendChild(cancelBtn);

    modal.appendChild(msg);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
  });
}
