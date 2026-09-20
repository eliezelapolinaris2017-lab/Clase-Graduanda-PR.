(() => {
  const activeStore = () => {
    try {
      return window.CGPR_TENANT?.keys?.data || (typeof TENANT !== 'undefined' && TENANT?.keys?.data) || 'claseGraduandaPR_v1';
    } catch {
      return 'claseGraduandaPR_v1';
    }
  };

  function getStudents(){
    if (typeof data !== 'undefined' && Array.isArray(data?.students)) {
      return data.students;
    }

    try {
      const saved = JSON.parse(localStorage.getItem(activeStore()) || 'null');
      return Array.isArray(saved?.students) ? saved.students : [];
    } catch {
      return [];
    }
  }

  function escAttr(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function refreshReportRecipient(){
    const select = document.getElementById('reportEmail');
    if(!select) return;

    const previous = select.value;
    const students = [...getStudents()]
      .sort((a,b) => String(a.student_name || '').localeCompare(String(b.student_name || ''), 'es'));

    const options = students.map(s => {
      const name = String(s.student_name || 'Sin nombre').trim();
      const email = String(s.email || '').trim();
      const label = email ? `${name} — ${email}` : `${name} — SIN EMAIL`;
      return `<option value="${escAttr(email)}" data-student-id="${escAttr(s.id)}" ${email ? '' : 'disabled'}>${escAttr(label)}</option>`;
    }).join('');

    select.innerHTML = '<option value="">Seleccionar estudiante — email</option>' + options;

    if(previous && students.some(s => String(s.email || '').trim() === previous)) {
      select.value = previous;
    }
  }

  window.refreshReportRecipient = refreshReportRecipient;

  document.addEventListener('DOMContentLoaded', refreshReportRecipient);
  window.addEventListener('storage', e => {
    if(!e.key || e.key === activeStore()) refreshReportRecipient();
  });

  document.querySelector('.tab[data-tab="reports"]')?.addEventListener('click', () => {
    setTimeout(refreshReportRecipient, 0);
  });

  const restore = document.getElementById('restoreFile');
  restore?.addEventListener('change', () => setTimeout(refreshReportRecipient, 120));

  const studentForm = document.getElementById('studentForm');
  studentForm?.addEventListener('submit', () => setTimeout(refreshReportRecipient, 80));

  const table = document.getElementById('studentsTable');
  if(table){
    new MutationObserver(() => setTimeout(refreshReportRecipient, 0))
      .observe(table, {childList:true, subtree:true});
  }

  setTimeout(refreshReportRecipient, 0);
})();