import { showConfirmAlert } from './alertModal.js';
import { showToast } from './toastManager.js';

let selectedQAIndex = null;
let qaData = [];
let api = null;

export function setupQATab(externalApi) {
  api = externalApi;

  const menuQA = document.getElementById('menu-qa');
  const qaContent = document.getElementById('qa-content');

  const qaTableBody = document.querySelector('#qaListTable tbody');
  const questionInput = document.getElementById('qaQuestionInput');
  const answerInput = document.getElementById('qaAnswerInput');
  const saveButton = document.getElementById('saveQAButton');
  const clearButton = document.getElementById('clearQAForm');

  if (!menuQA || !qaContent || !qaTableBody || !questionInput || !answerInput || !saveButton || !clearButton) {
    console.error('[qa-tab] Some DOM elements are missing.');
    return;
  }

  menuQA.addEventListener('click', () => {
    hideAllMainContent();
    qaContent.style.display = 'block';
    menuQA.classList.add('active');
    loadQAData();
  });

  saveButton.addEventListener('click', async () => {
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();

    if (!question || !answer) {
      showToast('אנא מלא גם שאלה וגם תשובה', 'error');
      return;
    }

    if (selectedQAIndex !== null) {
      try {
        const qaId = qaData[selectedQAIndex].id;
        const result = await api.updateQA(qaId, question, answer);
        if (!result.success) {
          showToast('נכשלה שמירת שאלה', 'error');
          return;
        }
        qaData[selectedQAIndex] = { id: qaId, question, answer };
        selectedQAIndex = null;
      } catch (err) {
        console.error('[qa-tab] Error updating QA:', err);
        showToast('שגיאה בעדכון', 'error');
        return;
      }
    } else {
      try {
        const result = await api.addQA(question, answer);
        if (!result.success || !result.data) {
          showToast('נכשלה שמירת שאלה', 'error');
          return;
        }
        qaData.push(result.data);
      } catch (err) {
        console.error('[qa-tab] Error saving QA:', err);
        showToast('שגיאה בשמירה', 'error');
        return;
      }
    }

    questionInput.value = '';
    answerInput.value = '';
    renderQATable();
    showToast('השאלה נשמרה בהצלחה', 'success');
  });

  clearButton.addEventListener('click', () => {
    questionInput.value = '';
    answerInput.value = '';
    selectedQAIndex = null;
  });

  function styleButton(btn, bgColor, hoverBgColor) {
    btn.style.padding = '6px 14px';
    btn.style.fontSize = '0.9rem';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.color = 'white';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'background-color 0.3s ease';
    btn.style.userSelect = 'none';
    btn.style.backgroundColor = bgColor;
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = hoverBgColor;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = bgColor;
    });
  }

  function renderQATable() {
    qaTableBody.innerHTML = '';

    qaData.forEach((item, index) => {
      const tr = document.createElement('tr');

      // Question cell
      const questionTd = document.createElement('td');
      questionTd.textContent = item.question;
      questionTd.style.fontWeight = '700';
      questionTd.style.color = '#4ea1ff';
      questionTd.style.padding = '12px 10px';
      tr.appendChild(questionTd);

      // Answer cell
      const answerTd = document.createElement('td');
      answerTd.textContent = item.answer;
      answerTd.style.color = '#ccc';
      answerTd.style.padding = '12px 10px';
      tr.appendChild(answerTd);

      // Actions cell
      const actionsTd = document.createElement('td');
      actionsTd.style.textAlign = 'center';
      actionsTd.style.padding = '12px 10px';
      actionsTd.style.display = 'flex';
      actionsTd.style.justifyContent = 'center';
      actionsTd.style.alignItems = 'center';
      actionsTd.style.gap = '12px'; // space between buttons

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️ ערוך';
      styleButton(editBtn, '#2563eb', '#1e40af'); // blue and darker blue hover

      editBtn.addEventListener('click', () => {
        selectedQAIndex = index;
        questionInput.value = item.question;
        answerInput.value = item.answer;
        questionInput.focus();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️ מחק';
      styleButton(deleteBtn, '#dc2626', '#b91c1c'); // red and darker red hover

      deleteBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmAlert('האם אתה בטוח שברצונך למחוק את השאלה?');
        if (!confirmed) return;

        try {
          const qaId = item.id;
          const result = await api.deleteQA(qaId);
          if (!result.success) {
            showToast('נכשלה מחיקת השאלה', 'error');
            return;
          }
          qaData.splice(index, 1);
          renderQATable();
          showToast('השאלה נמחקה', 'success');
        } catch (err) {
          console.error('[qa-tab] Error deleting QA:', err);
          showToast('שגיאה במחיקה', 'error');
        }
      });

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);

      qaTableBody.appendChild(tr);
    });
  }

  async function loadQAData() {
    try {
      const result = await api.getAllQA();
      if (result.success && Array.isArray(result.data)) {
        qaData = result.data;
        renderQATable();
      } else {
        showToast('שגיאה בטעינת שאלות מהשרת', 'error');
      }
    } catch (err) {
      console.error('[qa-tab] Failed to fetch Q&A:', err);
      showToast('שגיאה בטעינה', 'error');
    }
  }

  function hideAllMainContent() {
    document.querySelectorAll('.main-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar nav a').forEach(link => link.classList.remove('active'));
  }
}
