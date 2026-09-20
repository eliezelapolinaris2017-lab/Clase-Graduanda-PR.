(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const profiles = window.CGPR_PARENT_DEMO || {};
  let current = null;
  let currentCode = '';
  let receiptSeq = 1200;

  const money = n => '$' + Number(n || 0).toFixed(2);
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function balanceTotal(){ return current ? current.balances.reduce((sum,x)=>sum+Number(x.amount||0),0) : 0; }
  function dueTotal(){ return current ? current.balances.filter(x=>x.type==='Cuota').reduce((s,x)=>s+Number(x.amount||0),0) : 0; }
  function activityTotal(){ return current ? current.balances.filter(x=>x.type==='Actividad').reduce((s,x)=>s+Number(x.amount||0),0) : 0; }

  function showPortal(){
    $('#portalLogin').hidden = true;
    $('#portalApp').hidden = false;
    render();
    window.scrollTo(0,0);
  }

  function showLogin(){
    current = null;
    currentCode = '';
    $('#portalApp').hidden = true;
    $('#portalLogin').hidden = false;
    $('#accessCode').value = '';
    $('#loginError').textContent = '';
    setTimeout(() => $('#accessCode')?.focus(), 50);
  }

  $('#portalLoginForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = ($('#accessCode').value || '').trim().toUpperCase();
    const profile = profiles[code];
    if(!profile){
      $('#loginError').textContent = 'Código no reconocido en este prototipo.';
      return;
    }
    currentCode = code;
    current = clone(profile);
    receiptSeq = Math.max(1200, ...current.history.map(x=>Number(x.receipt)||0)) + 1;
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

  function render(){
    if(!current) return;
    const s=current.student;
    $('#studentInitials').textContent=s.initials;
    $('#studentName').textContent=s.name;
    $('#studentMeta').textContent=s.className+' · '+s.school;

    const bal=balanceTotal();
    $('#heroBalance').textContent=money(bal);
    $('#heroPaid').textContent=money(current.summary.paid);
    $('#dueAmount').textContent=money(dueTotal());
    $('#activityAmount').textContent=money(activityTotal());

    const percent=Math.max(0,Math.min(100,Math.round((Number(current.summary.paid||0)/Math.max(1,Number(current.summary.totalGoal||1)))*100)));
    $('#progressPercent').textContent=percent+'% completado';
    $('#progressBar').style.width=percent+'%';
    $('#progressPaid').textContent=money(current.summary.paid)+' pagados';
    $('#progressTotal').textContent=money(current.summary.totalGoal)+' total';

    renderNext();
    renderBalances();
    renderHistory();
    renderActivities();
    renderDocuments();
    renderNotices();
  }

  function renderNext(){
    const next=current.balances[0];
    const row=$('#nextPaymentRow');
    if(!next){
      row.innerHTML='<div><strong>Todo al día</strong><small>No hay balances pendientes en este prototipo.</small></div><span class="badge">Al día</span>';
      $('#quickPay').hidden=true;
      return;
    }
    $('#quickPay').hidden=false;
    row.innerHTML='<div><strong>'+escapeHtml(next.concept)+'</strong><small>Fecha límite: '+escapeHtml(next.due)+'</small></div><div class="row-amount"><strong>'+money(next.amount)+'</strong><span class="badge">Pendiente</span></div>';
  }

  function renderBalances(){
    const list=$('#balancesList');
    list.innerHTML=current.balances.length ? current.balances.map(x =>
      '<div class="list-row" data-balance="'+escapeHtml(x.id)+'"><div><strong>'+escapeHtml(x.concept)+'</strong><small>'+escapeHtml(x.type)+' · Vence '+escapeHtml(x.due)+'</small></div><div class="row-amount"><strong>'+money(x.amount)+'</strong><span class="badge">Pendiente</span></div></div>'
    ).join('') : '<div class="empty-state">No hay balances pendientes.</div>';

    const select=$('#payConcept');
    select.innerHTML=current.balances.map(x=>'<option value="'+escapeHtml(x.id)+'">'+escapeHtml(x.concept)+' — '+money(x.amount)+'</option>').join('');
    $('#openPay').disabled=!current.balances.length;
    $('#openPay').textContent=current.balances.length?'Pagar balance':'Sin balances pendientes';
    if(!current.balances.length) $('#payPanel').hidden=true;
  }

  function renderHistory(){
    const history=$('#historyList');
    history.innerHTML=current.history.map(x=>
      '<div class="list-row"><div><strong>'+escapeHtml(x.concept)+'</strong><small>'+escapeHtml(x.date)+' · Recibo #'+escapeHtml(x.receipt)+'</small></div><div class="row-amount"><strong>'+money(x.amount)+'</strong><button class="mini-btn receipt-btn" type="button" data-receipt="'+escapeHtml(x.receipt)+'" data-concept="'+escapeHtml(x.concept)+'" data-amount="'+Number(x.amount).toFixed(2)+'">Ver recibo</button></div></div>'
    ).join('');
    $$('.receipt-btn').forEach(attachReceiptButton);
  }

  function renderActivities(){
    $('#activitiesList').innerHTML=current.activities.map(x=>
      '<div class="list-row"><div><strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.detail)+'</small></div><span class="badge">'+escapeHtml(x.tag)+'</span></div>'
    ).join('') || '<div class="empty-state">No hay actividades publicadas.</div>';
  }

  function renderDocuments(){
    $('#documentsList').innerHTML=current.documents.map((x,i)=>
      '<div class="document-row"><div class="doc-icon">'+escapeHtml(x.kind)+'</div><div><strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.detail)+'</small></div><button class="mini-btn doc-btn" type="button" data-doc-index="'+i+'">Ver</button></div>'
    ).join('') || '<div class="empty-state">No hay documentos publicados.</div>';
    $$('.doc-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const doc=current.documents[Number(btn.dataset.docIndex)];
      const preview=$('#docPreview');
      preview.hidden=false;
      preview.innerHTML='<span class="eyebrow dark">VISTA PREVIA</span><h3>'+escapeHtml(doc.title)+'</h3><p>'+escapeHtml(doc.detail)+'</p><p>En la versión conectada aquí se abriría el archivo publicado por la directiva.</p>';
    }));
  }

  function renderNotices(){
    $('#noticesList').innerHTML=current.notices.map(x=>
      '<div class="notice-item"><div class="notice-title"><strong>'+escapeHtml(x.title)+'</strong>'+(x.tag?'<span class="badge">'+escapeHtml(x.tag)+'</span>':'')+'</div><p>'+escapeHtml(x.body)+'</p><small>Publicado '+escapeHtml(x.date)+'</small></div>'
    ).join('') || '<div class="empty-state">No hay avisos nuevos.</div>';
  }

  $('#quickPay').addEventListener('click',()=>{
    openTab('pagos');
    $('#payPanel').hidden=false;
    if(current?.balances[0]) $('#payConcept').value=current.balances[0].id;
  });
  $('#openPay').addEventListener('click',()=>{$('#payPanel').hidden=!$('#payPanel').hidden;});
  $('#cancelPay').addEventListener('click',()=>{$('#payPanel').hidden=true;$('#payStatus').textContent='';});

  function attachReceiptButton(btn){
    btn.addEventListener('click',()=>{
      const box=$('#receiptPreview');
      box.hidden=false;
      box.innerHTML='<span class="eyebrow dark">RECIBO #'+escapeHtml(btn.dataset.receipt)+'</span><h3>'+escapeHtml(btn.dataset.concept)+'</h3><p>Estudiante: '+escapeHtml(current.student.name)+'</p><p>Monto recibido: <strong>$'+escapeHtml(btn.dataset.amount)+'</strong></p><p>'+escapeHtml(current.student.className)+' · '+escapeHtml(current.student.school)+'</p><p>Documento de demostración.</p>';
    });
  }

  $('#confirmPay').addEventListener('click',()=>{
    if(!current) return;
    const id=$('#payConcept').value;
    const index=current.balances.findIndex(x=>x.id===id);
    if(index<0){
      $('#payStatus').textContent='Ese concepto ya fue pagado en esta demostración.';
      return;
    }
    const item=current.balances.splice(index,1)[0];
    current.summary.paid=Number(current.summary.paid||0)+Number(item.amount||0);
    current.history.unshift({receipt:String(receiptSeq++),concept:item.concept,amount:item.amount,date:'Pago de demostración'});
    $('#payStatus').textContent='Pago de demostración registrado correctamente.';
    render();
  });

  $('#exportState').addEventListener('click',()=>{
    if(!current) return;
    const lines=[
      'CLASE GRADUANDA PR',
      'Portal para Padres — Estado de cuenta',
      'Código: '+currentCode,
      'Estudiante: '+current.student.name,
      current.student.className+' · '+current.student.school,
      '',
      'Balance pendiente: '+money(balanceTotal()),
      'Pagado: '+money(current.summary.paid),
      '',
      ...current.balances.map(x=>x.concept+': '+money(x.amount)+' — vence '+x.due),
      '',
      'Documento generado por el prototipo de evaluación.'
    ];
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='estado-de-cuenta-'+current.student.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.txt';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
  });

  setTimeout(()=>$('#accessCode')?.focus(),50);
})();