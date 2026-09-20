(() => {
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const ACCESS_ENDPOINT='https://ujrqkwdkytuvfaqnbmzl.supabase.co/functions/v1/parent-portal-access';
  let current=null;
  let currentUpdatedAt='';

  const money=n=>'$'+Number(n||0).toFixed(2);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clone=obj=>JSON.parse(JSON.stringify(obj));
  const recordDate=x=>String(x?.date||x?.due||'').trim();
  const methodLabel=x=>String(x?.method||'No especificado').trim()||'No especificado';

  function balanceTotal(){return current?(current.balances||[]).reduce((sum,x)=>sum+Number(x.amount||0),0):0;}
  function dueItems(){return current?(current.balances||[]).filter(x=>x.type==='Cuota'):[];}
  function activityItems(){return current?(current.balances||[]).filter(x=>x.type==='Actividad'):[];}
  function dueTotal(){return dueItems().reduce((s,x)=>s+Number(x.amount||0),0);}
  function activityTotal(){return activityItems().reduce((s,x)=>s+Number(x.amount||0),0);}

  function showPortal(){
    $('#portalLogin').hidden=true;
    $('#portalApp').hidden=false;
    render();
    window.scrollTo(0,0);
  }

  function showLogin(){
    current=null;
    currentUpdatedAt='';
    $('#portalApp').hidden=true;
    $('#portalLogin').hidden=false;
    $('#accessCode').value='';
    $('#loginError').textContent='';
    setTimeout(()=>$('#accessCode')?.focus(),50);
  }

  async function lookupPortal(code){
    const response=await fetch(ACCESS_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code})
    });
    let body={};
    try{body=await response.json();}catch{}
    if(!response.ok||!body?.ok||!body?.portal) throw new Error(body?.error||'No se pudo abrir el portal.');
    return body;
  }

  $('#portalLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const input=$('#accessCode');
    const button=e.currentTarget.querySelector('button[type="submit"]');
    const code=(input.value||'').trim().toUpperCase();

    if(!/^PR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)){
      $('#loginError').textContent='Verifica el código de acceso.';
      return;
    }

    $('#loginError').textContent='Verificando acceso...';
    input.disabled=true;
    button.disabled=true;

    try{
      const result=await lookupPortal(code);
      current=clone(result.portal);
      currentUpdatedAt=result.updatedAt||'';
      if(!Array.isArray(current.balances)) current.balances=[];
      if(!Array.isArray(current.history)) current.history=[];
      if(!Array.isArray(current.activities)) current.activities=[];
      if(!current.summary) current.summary={paid:0,totalGoal:0};
      $('#loginError').textContent='';
      showPortal();
    }catch(err){
      $('#loginError').textContent=err?.message||'Código no reconocido.';
    }finally{
      input.disabled=false;
      button.disabled=false;
    }
  });

  $('#logoutBtn').addEventListener('click',showLogin);

  function openTab(name){
    $$('.portal-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
    $$('.portal-panel').forEach(p=>p.classList.toggle('active',p.id===name));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  $$('.portal-tab').forEach(btn=>btn.addEventListener('click',()=>openTab(btn.dataset.tab)));

  function render(){
    if(!current)return;
    const s=current.student||{};
    $('#studentInitials').textContent=s.initials||'CG';
    $('#studentName').textContent=s.name||'Estudiante';
    $('#studentMeta').textContent=[s.className,s.school].filter(Boolean).join(' · ');

    $('#heroBalance').textContent=money(balanceTotal());
    $('#heroPaid').textContent=money(current.summary.paid);
    $('#dueAmount').textContent=money(dueTotal());
    $('#activityAmount').textContent=money(activityTotal());
    $('#dueCount').textContent=dueItems().length+' '+(dueItems().length===1?'concepto pendiente':'conceptos pendientes');
    $('#activityCount').textContent=activityItems().length+' '+(activityItems().length===1?'actividad pendiente':'actividades pendientes');

    const assigned=Number(current.summary.totalGoal||0);
    const paid=Number(current.summary.paid||0);
    const percent=assigned>0?Math.max(0,Math.min(100,Math.round((paid/assigned)*100))):0;
    $('#progressPercent').textContent=percent+'% completado';
    $('#progressBar').style.width=percent+'%';
    $('#progressPaid').textContent=money(paid)+' pagados';
    $('#progressTotal').textContent=money(assigned)+' asignados';

    if(currentUpdatedAt){
      const d=new Date(currentUpdatedAt);
      $('#portalUpdated').textContent=Number.isNaN(d.getTime())?'':'Última actualización: '+d.toLocaleString('es-PR',{dateStyle:'medium',timeStyle:'short'});
    }else{
      $('#portalUpdated').textContent='';
    }

    renderPrimaryBalance();
    renderBalances();
    renderHistory();
    renderActivities();
  }

  function renderPrimaryBalance(){
    const next=current.balances[0];
    const row=$('#nextPaymentRow');
    if(!next){
      row.innerHTML='<div><strong>Todo al día</strong><small>No hay balances pendientes registrados.</small></div><span class="badge">Al día</span>';
      return;
    }
    const date=recordDate(next);
    row.innerHTML='<div><strong>'+escapeHtml(next.concept)+'</strong><small>'+escapeHtml(next.type||'Balance')+(date?' · Registrado '+escapeHtml(date):'')+'</small></div><div class="row-amount"><strong>'+money(next.amount)+'</strong><span class="badge">Pendiente</span></div>';
  }

  function renderBalances(){
    const list=$('#balancesList');
    list.innerHTML=current.balances.length?current.balances.map(x=>{
      const date=recordDate(x);
      return '<div class="list-row"><div><strong>'+escapeHtml(x.concept)+'</strong><small>'+escapeHtml(x.type||'Balance')+(date?' · Registrado '+escapeHtml(date):'')+'</small></div><div class="row-amount"><strong>'+money(x.amount)+'</strong><span class="badge">Pendiente</span></div></div>';
    }).join(''):'<div class="empty-state">No hay balances pendientes.</div>';
  }

  function renderHistory(){
    const history=$('#historyList');
    history.innerHTML=current.history.length?current.history.map((x,i)=>
      '<div class="list-row"><div><strong>'+escapeHtml(x.concept)+'</strong><small>'+escapeHtml(x.date||'')+' · '+escapeHtml(methodLabel(x))+' · Recibo #'+escapeHtml(x.receipt||'')+'</small></div><div class="row-amount"><strong>'+money(x.amount)+'</strong><button class="mini-btn receipt-btn" type="button" data-index="'+i+'">Ver recibo</button></div></div>'
    ).join(''):'<div class="empty-state">No hay pagos registrados.</div>';
    $$('.receipt-btn').forEach(btn=>btn.addEventListener('click',()=>showReceipt(Number(btn.dataset.index))));
  }

  function renderActivities(){
    $('#activitiesList').innerHTML=current.activities.length?current.activities.map(x=>
      '<div class="list-row"><div><strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.detail||'')+'</small></div><span class="badge">'+escapeHtml(x.tag||'Actividad')+'</span></div>'
    ).join(''):'<div class="empty-state">No hay actividades registradas para este estudiante.</div>';
  }

  function showReceipt(index){
    const item=current.history[index];
    if(!item)return;
    const box=$('#receiptPreview');
    box.hidden=false;
    box.innerHTML=
      '<span class="eyebrow dark">RECIBO #'+escapeHtml(item.receipt||'')+'</span>'+
      '<h3>'+escapeHtml(item.concept)+'</h3>'+
      '<p>Estudiante: <strong>'+escapeHtml(current.student?.name||'')+'</strong></p>'+
      '<p>Fecha: '+escapeHtml(item.date||'')+'</p>'+
      '<p>Método de pago: '+escapeHtml(methodLabel(item))+'</p>'+
      '<p>Monto registrado: <strong>'+money(item.amount)+'</strong></p>'+
      '<p>'+escapeHtml(current.student?.className||'')+' · '+escapeHtml(current.student?.school||'')+'</p>'+
      '<div class="receipt-actions"><button id="receiptPdf" type="button" class="secondary-btn">Descargar recibo PDF</button><button id="receiptClose" type="button" class="secondary-btn">Cerrar</button></div>';
    $('#receiptPdf').onclick=()=>downloadReceiptPdf(item);
    $('#receiptClose').onclick=()=>{box.hidden=true;box.innerHTML='';};
  }

  function pdfReady(){
    return !!(window.jspdf&&window.jspdf.jsPDF);
  }

  function addPdfHeader(doc,title){
    const student=current.student||{};
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text(student.school||'Clase Graduanda PR',40,46);
    doc.setFontSize(11);
    doc.text(student.className||'Clase Graduanda',40,64);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.text(title,40,82);
    doc.setDrawColor(210);
    doc.line(40,92,572,92);
  }

  function downloadReceiptPdf(item){
    if(!pdfReady()) return alert('No se pudo cargar el generador PDF. Intenta nuevamente con conexión a internet.');
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'pt',format:'letter'});
    addPdfHeader(doc,'Recibo / registro de pago');
    const rows=[
      ['Estudiante',current.student?.name||''],
      ['Recibo',String(item.receipt||'')],
      ['Fecha',String(item.date||'')],
      ['Concepto',String(item.concept||'')],
      ['Método de pago',methodLabel(item)],
      ['Monto',money(item.amount)]
    ];
    doc.autoTable({startY:112,margin:{left:40,right:40},head:[['Detalle','Información']],body:rows,theme:'grid',styles:{fontSize:10,cellPadding:7},headStyles:{fontStyle:'bold'}});
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Generado desde el Portal para Padres de Clase Graduanda PR.',40,doc.internal.pageSize.getHeight()-32);
    const safe=(current.student?.name||'estudiante').replace(/[^a-z0-9áéíóúñü -]/gi,'').trim().replace(/\s+/g,'-').toLowerCase();
    doc.save('recibo-'+safe+'-'+String(item.receipt||'pago')+'.pdf');
  }

  $('#exportState').addEventListener('click',()=>{
    if(!current)return;
    if(!pdfReady()) return alert('No se pudo cargar el generador PDF. Intenta nuevamente con conexión a internet.');
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'pt',format:'letter'});
    addPdfHeader(doc,'Estado de cuenta del estudiante');
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('Estudiante: '+(current.student?.name||''),40,112);
    doc.setFont('helvetica','normal');
    doc.text('Total pagado: '+money(current.summary.paid),40,130);
    doc.text('Balance pendiente: '+money(balanceTotal()),40,146);

    const balanceRows=current.balances.length?current.balances.map(x=>[
      x.type||'Balance',
      x.concept||'',
      recordDate(x),
      money(x.amount)
    ]):[['—','Sin balances pendientes','—','$0.00']];

    doc.autoTable({
      startY:164,
      margin:{left:40,right:40},
      head:[['Tipo','Concepto','Fecha','Pendiente']],
      body:balanceRows,
      theme:'grid',
      styles:{fontSize:8.5,cellPadding:5},
      headStyles:{fontStyle:'bold'}
    });

    const historyRows=current.history.length?current.history.map(x=>[
      x.date||'',
      x.concept||'',
      methodLabel(x),
      money(x.amount),
      String(x.receipt||'')
    ]):[['—','Sin pagos registrados','—','$0.00','—']];

    doc.autoTable({
      startY:doc.lastAutoTable.finalY+22,
      margin:{left:40,right:40},
      head:[['Fecha','Concepto','Método','Pagado','Recibo']],
      body:historyRows,
      theme:'striped',
      styles:{fontSize:8,cellPadding:5},
      headStyles:{fontStyle:'bold'}
    });

    const safe=(current.student?.name||'estudiante').replace(/[^a-z0-9áéíóúñü -]/gi,'').trim().replace(/\s+/g,'-').toLowerCase();
    doc.save('estado-de-cuenta-'+safe+'.pdf');
  });

  setTimeout(()=>$('#accessCode')?.focus(),50);
})();