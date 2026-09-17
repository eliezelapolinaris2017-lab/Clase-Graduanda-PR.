(() => {
  const methods = ['','Efectivo','ATH Móvil','Tarjeta','Cheque','Transferencia','Otro'];
  const methodSelect = () => {
    const select = document.createElement('select');
    select.name = 'payment_method';
    select.innerHTML = methods.map((m,i)=>`<option value="${m}">${i===0?'Método de pago':m}</option>`).join('');
    return select;
  };

  const addField = formId => {
    const form = document.querySelector(formId);
    if (!form || form.querySelector('[name="payment_method"]')) return;
    const select = methodSelect();
    const date = form.querySelector('[name="date"]');
    if (date) form.insertBefore(select, date);
    else form.appendChild(select);
  };

  const methodLabel = value => value || 'No especificado';

  function paintPaymentMethods(){
    const duesTable = document.querySelector('#duesTable');
    if (duesTable) {
      duesTable.innerHTML = `<tr><th>Fecha</th><th>Estudiante</th><th>Concepto</th><th>Asignado</th><th>Pagado</th><th>Método</th><th>Balance</th><th></th></tr>` +
        [...data.dues].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(r=>`<tr><td>${r.date||''}</td><td>${esc(studentById(r.student_id)?.student_name||'')}</td><td>${esc(r.concept)}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td>${Number(r.paid)>0?esc(methodLabel(r.payment_method)):'—'}</td><td>${money(Number(r.amount)-Number(r.paid))}</td><td><button class="danger" onclick="deleteDue(${r.id})">Eliminar</button></td></tr>`).join('');
    }

    const activitiesTable = document.querySelector('#activitiesTable');
    if (activitiesTable) {
      activitiesTable.innerHTML = `<tr><th>Fecha</th><th>Estudiante</th><th>Actividad</th><th>Cargo</th><th>Pagado</th><th>Método</th><th>Balance</th><th></th></tr>` +
        [...data.activities].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(r=>`<tr><td>${r.date||''}</td><td>${esc(studentById(r.student_id)?.student_name||'')}</td><td>${esc(r.activity_name)}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td>${Number(r.paid)>0?esc(methodLabel(r.payment_method)):'—'}</td><td>${money(Number(r.amount)-Number(r.paid))}</td><td><button class="danger" onclick="deleteActivity(${r.id})">Eliminar</button></td></tr>`).join('');
    }
  }

  addField('#duesForm');
  addField('#activitiesForm');

  if (typeof render === 'function') {
    const originalRender = render;
    render = function(){
      originalRender();
      paintPaymentMethods();
    };
  }

  paintPaymentMethods();
})();