// File: chatbot-manager.js

document.addEventListener('DOMContentLoaded', () => {
  const questionListEl = document.getElementById('chatbotQuestionList');
  const chatWindowEl = document.getElementById('chatWindow');
  const markHumanBtn = document.getElementById('markHumanResponse');
  const startChatbotBtn = document.getElementById('startChatbotMode');
  const chatbotStatusEl = document.getElementById('chatbotStatus');

  let allQuestions = [];
  let filteredQuestions = [];
  let selectedQuestion = null;
  let currentStatusFilter = 'unanswered';

  // Load all questions from backend and update UI list
  async function loadQuestions() {
    try {
      const res = await window.api.getAllChatbotQuestions();
      if (res.success) {
        allQuestions = res.questions;
        filterQuestions(currentStatusFilter);
      } else {
        chatWindowEl.innerHTML = `<p style="color:red;">Error loading questions</p>`;
      }
    } catch (err) {
      chatWindowEl.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
  }

  // Filter questions by status and update sidebar list
  function filterQuestions(status) {
    currentStatusFilter = status;
    filteredQuestions = allQuestions.filter(q => q.status === status);
    renderQuestionList();
  }

  // Render question list sidebar
  function renderQuestionList() {
    questionListEl.querySelectorAll('li').forEach(li => {
      li.classList.toggle('active', li.dataset.status === currentStatusFilter);
    });

    // Clear previous questions from sidebar (except category headers)
    const existingQuestions = questionListEl.querySelectorAll('li.question-item');
    existingQuestions.forEach(el => el.remove());

    if (filteredQuestions.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'אין שאלות זמינות';
      li.style.fontStyle = 'italic';
      questionListEl.appendChild(li);
      chatWindowEl.innerHTML = `<p class="placeholder">בחר שאלה מהרשימה כדי להציג את השיחה</p>`;
      markHumanBtn.style.display = 'none';
      selectedQuestion = null;
      return;
    }

    filteredQuestions.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q.question;
      li.classList.add('question-item');
      li.dataset.phone = q.phone;
      li.dataset.status = q.status;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        selectQuestion(q.phone);
      });
      questionListEl.appendChild(li);
    });

    // Automatically select first question
    selectQuestion(filteredQuestions[0].phone);
  }

  // Select question by phone, display chat and show mark human button if applicable
  function selectQuestion(phone) {
    selectedQuestion = allQuestions.find(q => q.phone === phone);
    if (!selectedQuestion) return;

    // Highlight selected question in sidebar
    questionListEl.querySelectorAll('li.question-item').forEach(li => {
      li.classList.toggle('selected', li.dataset.phone === phone);
    });

    renderChat(selectedQuestion);
  }

  // Render chat window for selected question
  function renderChat(question) {
    if (!question.chat || question.chat.length === 0) {
      chatWindowEl.innerHTML = `<p class="placeholder">אין הודעות בשיחה זו</p>`;
    } else {
      chatWindowEl.innerHTML = '';
      question.chat.forEach(msg => {
        const p = document.createElement('p');
        p.textContent = `${msg.sender}: ${msg.text}`;
        p.style.padding = '4px';
        p.style.borderBottom = '1px solid #ccc';
        chatWindowEl.appendChild(p);
      });
    }

    // Show or hide "mark as needs human" button
    if (question.status !== 'needs-human') {
      markHumanBtn.style.display = 'inline-block';
    } else {
      markHumanBtn.style.display = 'none';
    }
  }

  // Handler for marking question as needing human response
  async function markAsNeedsHuman() {
    if (!selectedQuestion) return;
    try {
      const res = await window.api.updateChatbotQuestionStatus(selectedQuestion.phone, 'needs-human', null);
      if (res.success) {
        // Update local state and refresh UI
        selectedQuestion.status = 'needs-human';
        filterQuestions(currentStatusFilter);
        chatbotStatusEl.textContent = `שאלה ${selectedQuestion.phone} סומנה כממתינה למענה אנושי`;
        setTimeout(() => chatbotStatusEl.textContent = '', 3000);
      } else {
        alert('שגיאה בסימון השאלה כממתינה למענה אנושי');
      }
    } catch (err) {
      alert('שגיאה: ' + err.message);
    }
  }

  // Handler for starting chatbot mode
  async function startChatbot() {
    try {
      chatbotStatusEl.textContent = 'מפעיל מצב צ\'אטבוט...';
      const res = await window.api.startChatbot();
      if (res.success) {
        chatbotStatusEl.textContent = 'מצב צ\'אטבוט הופעל בהצלחה!';
      } else {
        chatbotStatusEl.textContent = 'שגיאה בהפעלת מצב צ\'אטבוט: ' + (res.error || 'Unknown error');
      }
      setTimeout(() => chatbotStatusEl.textContent = '', 3000);
    } catch (err) {
      chatbotStatusEl.textContent = 'שגיאה: ' + err.message;
    }
  }

  // Setup event listeners
  questionListEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      if (li.dataset.status) {
        filterQuestions(li.dataset.status);
      }
    });
  });

  markHumanBtn.addEventListener('click', markAsNeedsHuman);
  startChatbotBtn.addEventListener('click', startChatbot);

  // Initial load
  loadQuestions();
});
