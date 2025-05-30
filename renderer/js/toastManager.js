// toastManager.js

const toastContainer = document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) {
    console.warn('Toast container element not found!');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toast.style.minWidth = '200px';
  toast.style.marginBottom = '10px';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '6px';
  toast.style.color = 'white';
  toast.style.fontSize = '14px';
  toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  toast.style.opacity = '0.95';
  toast.style.cursor = 'pointer';
  toast.style.userSelect = 'none';

  switch(type) {
    case 'success':
      toast.style.backgroundColor = '#4caf50';
      break;
    case 'error':
      toast.style.backgroundColor = '#f44336';
      break;
    case 'warning':
      toast.style.backgroundColor = '#ff9800';
      break;
    default:
      toast.style.backgroundColor = '#333';
  }

  toastContainer.appendChild(toast);

  toast.addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.style.transition = 'opacity 0.5s ease';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, duration);
}
