// renderer/js/tabs.js

export function setupTabListeners() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;

      // Remove active from all buttons
      tabButtons.forEach(btn => btn.classList.remove('active'));

      // Hide all tab contents
      tabContents.forEach(content => content.classList.add('hidden'));

      // Activate current
      button.classList.add('active');
      document.getElementById(tabId).classList.remove('hidden');
    });
  });
}
