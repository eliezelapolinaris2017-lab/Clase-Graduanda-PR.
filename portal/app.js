(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const DEMO_CODE = 'MR-2030-4821';
  let balance = 185;
  let paid = 615;
  let receiptSeq = 1030;

  const money = n => '$' + Number(n || 0).toFixed(2);

  function showPortal(){
    $('#portalLogin').hidden = true;
    $('#portalApp').hidden = false;
    window.scrollTo(0,0);
  }

  function showLogin(){
    $('#portalApp').hidden = true;
    $('#portalLogin').hidden = false;
    $('#accessCode').value = '';
    $('#loginError').textContent = '';
    setTimeout(() => $('#accessCode')?.focus(), 50);
  }

  $('#portalLoginForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = ($('#accessCode').value || '').trim().toUpperCase();
    if(code !== DEMO_CODE){
      $('#loginError').textContent = 'Código no reconocido en este prototipo.';
      return;
    }
    $('#loginError').textContent = '';
    showPortal();
  });

  $('#logoutBtn').addEventListener('click', showLogin);

  function openTab(name){
    $$('.portal-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.portal-panel').forEach(p => p.classList.toggle('active', p.id === name));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  $$('.portal-tab').forEach(btn => btn.addEventListener('click', () => openTab(btn.dataset.tab)));
  $('#quickPay').addEventListener('click', () => {
    openTab('pagos');
    $('#payPanel').hidden = false;
  });

  $('#openPay').addEventListener('click', () => {
    $('#payPanel').hidden = !$('#payPanel').hidden;
  });
  $('#cancelPay').addEventListener('click', () => {
    $('#payPanel').hidden = true;
    $('#payStatus').textContent = '';
  });

  function attachReceiptButton(btn){
    btn.addEventListener('click', () => {
      const box = $('#receiptPreview');
      box.hidden = false;
      box.innerHTML =
        '<span class="eyebrow dark">RECIBO #' + btn.dataset.receipt + '</span>' +
        '<h3>' + btn.dataset.concept + '</h3>' +
        '<p>Estudiante: María Rodríguez</p>' +
        '<p>Monto recibido: <strong>$' + btn.dataset.amount + '</strong></p>' +
        '<p>Clase Monarca 2030 · Colegio Santa Cruz</p>' +
        '<p>Documento de demostración.</p>';
    });
  }
  $$('.receipt-btn').forEach(attachReceiptButton);

  $('#confirmPay').addEventListener('click', () => {
    const select = $('#payConcept');
    const option = select.options[select.selectedIndex];
    const amount = Number(option.value);
    const key = option.dataset.key;
    const concept = option.text.split(' — ')[0];
    const row = document.querySelector('[data-balance="' + key + '"]');

    if(!row){
      $('#payStatus').textContent = 'Ese concepto ya fue pagado en esta demostración.';
      return;
    }

    balance = Math.max(0, balance - amount);
    paid += amount;
    receiptSeq += 1;

    $('#heroBalance').textContent = money(balance);
    $('#heroPaid').textContent = money(paid);
    row.remove();

    if(key === 'graduacion' || key === 'mensual'){
      const remaining = Math.max(0, Number($('#dueAmount').textContent.replace(/[^0-9.]/g,'')) - amount);
      $('#dueAmount').textContent = money(remaining);
    } else if(key === 'actividad'){
      const remaining = Math.max(0, Number($('#activityAmount').textContent.replace(/[^0-9.]/g,'')) - amount);
      $('#activityAmount').textContent = money(remaining);
    }

    const history = $('#historyList');
    const item = document.createElement('div');
    item.className = 'list-row';

    const left = document.createElement('div');
    left.innerHTML = '<strong>' + concept + '</strong><small>Pago de demostración · Recibo #' + receiptSeq + '</small>';

    const right = document.createElement('div');
    right.className = 'row-amount';
    right.innerHTML = '<strong>' + money(amount) + '</strong>';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mini-btn receipt-btn';
    btn.textContent = 'Ver recibo';
    btn.dataset.receipt = String(receiptSeq);
    btn.dataset.concept = concept;
    btn.dataset.amount = amount.toFixed(2);
    right.appendChild(btn);
    attachReceiptButton(btn);

    item.append(left,right);
    history.prepend(item);

    $('#payStatus').textContent = 'Pago de demostración registrado correctamente.';
    if(!$('#balancesList .list-row')){
      $('#openPay').disabled = true;
      $('#openPay').textContent = 'Sin balances pendientes';
      $('#payPanel').hidden = true;
    }
  });

  $('#exportState').addEventListener('click', () => {
    const lines = [
      'CLASE GRADUANDA PR',
      'Portal para Padres — Estado de cuenta',
      'Estudiante: María Rodríguez',
      'Clase Monarca 2030',
      '',
      'Balance pendiente: ' + money(balance),
      'Pagado este año: ' + money(paid),
      '',
      'Documento generado por el prototipo de evaluación.'
    ];
    const blob = new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'estado-de-cuenta-maria-rodriguez.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });

  $$('.doc-btn').forEach(btn => btn.addEventListener('click', () => {
    const preview = $('#docPreview');
    preview.hidden = false;
    preview.innerHTML =
      '<span class="eyebrow dark">VISTA PREVIA</span>' +
      '<h3>' + btn.dataset.doc + '</h3>' +
      '<p>En el sistema final aquí se abriría el documento publicado por la directiva, con opción de descargarlo cuando corresponda.</p>';
  }));

  setTimeout(() => $('#accessCode')?.focus(), 50);
})();