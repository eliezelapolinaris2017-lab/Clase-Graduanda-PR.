(() => {
  const STORE = 'claseGraduandaPR_v1';

  function getData(){
    try {
      return JSON.parse(localStorage.getItem(STORE) || 'null') || { students: [] };
    } catch {
      return { students: [] };
    }
  }

  function refreshReportRecipient(){
    const select = document.getElementById('reportEmail');
    if(!select) return;

    const previous = select.value;
    const students = [...(getData().students || [])]
      .sort((a,b) => String(a.student_name || '').localeCompare(String(b.student_name || ''), 'es'));

    select.innerHTML = '<option value="">Seleccionar estudiante — email</option>' +
      students.map(s => {
        const name = String(s.student_name || 'Sin nombre').trim();
        const email = String(s.email || '').trim();
        const label = email ? `${name} — ${email}` : `${name} — SIN EMAIL`;
        return `<option value="${email.replace(/"/g,'&quot;')}" data-student-id="${s.id}" ${email ? '' : 'disabled'}>${label}</option>`;
      }).join('');

    if(previous && students.some(s => String(s.email || '').trim() === previous)) {
      select.value = previous;
    }
  }

  window.refreshReportRecipient = refreshReportRecipient;

  document.addEventListener('DOMContentLoaded', refreshReportRecipient);
  window.addEventListener('storage', refreshReportRecipient);

  const observer = new MutationObserver(refreshReportRecipient);
  const table = document.getElementById('studentsTable');
  if(table) observer.observe(table, { childList:true, subtree:true });

  const restore = document.getElementById('restoreFile');
  if(restore) restore.addEventListener('change', () => setTimeout(refreshReportRecipient, 100));

  const studentForm = document.getElementById('studentForm');
  if(studentForm) studentForm.addEventListener('submit', () => setTimeout(refreshReportRecipient, 50));

  setTimeout(refreshReportRecipient, 0);
})();