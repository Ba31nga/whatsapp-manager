const excelInput = document.getElementById('excelInput');
const dataTable = document.getElementById('dataTable');
const tableContainer = document.getElementById('tableContainer');

let parsedData = [];

export function setupExcelInput() {
  excelInput.addEventListener('input', () => {
    const text = excelInput.value.trim();
    if (!text) {
      tableContainer.hidden = true;
      parsedData = [];
      return;
    }
    parsedData = parseExcelText(text);
    renderTable(parsedData);
  });
}

export function getParsedData() {
  return parsedData;
}

function parseExcelText(text) {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  let headers = lines[0].split(/\t|,/).map(h => h.trim());

  // Find the phone header (case insensitive, Hebrew or English)
  const phoneHeaderCandidates = ['phone', 'טלפון', 'מספר', 'phone number', 'PhoneNumber', 'מספר טלפון'];
  let phoneHeader = headers.find(h => phoneHeaderCandidates.includes(h.toLowerCase()));

  // If found, normalize it to 'phone'
  if (phoneHeader) {
    headers = headers.map(h => (h === phoneHeader ? 'phone' : h));
  }

  return lines.slice(1).map(line => {
    const cells = line.split(/\t|,/);
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = cells[i] ? cells[i].trim() : '';
    });
    return obj;
  });
}

function renderTable(data) {
  if (!data || data.length === 0) {
    tableContainer.hidden = true;
    dataTable.innerHTML = '';
    return;
  }

  tableContainer.hidden = false;
  const headers = Object.keys(data[0]);
  let html = '<thead><tr>';
  headers.forEach(h => {
    html += `<th>${h}</th>`;
  });
  html += '</tr></thead><tbody>';
  data.forEach(row => {
    html += '<tr>';
    headers.forEach(h => {
      html += `<td>${row[h] || ''}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  dataTable.innerHTML = html;
}
