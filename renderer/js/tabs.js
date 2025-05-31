// renderer/js/tabs.js

export function setupTabListeners() {
  const tabs = [
    { buttonId: 'menu-automated-messages', contentId: 'main-content' },
    { buttonId: 'menu-log', contentId: 'log-content' },
    { buttonId: 'menu-qa', contentId: 'qa-content' },
  ];

  tabs.forEach(({ buttonId, contentId }) => {
    const button = document.getElementById(buttonId);
    const content = document.getElementById(contentId);

    button.addEventListener('click', (e) => {
      e.preventDefault();

      // Deactivate all buttons and hide all content
      tabs.forEach(({ buttonId: bId, contentId: cId }) => {
        document.getElementById(bId).classList.remove('active');
        document.getElementById(cId).style.display = 'none';
      });

      // Activate current
      button.classList.add('active');
      content.style.display = 'block';
    });
  });
}
