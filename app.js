const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => `$${Number(n || 0).toFixed(2)}`;
const uid = () => Date.now() + Math.floor(Math.random()*10000);

const TENANT = window.CGPR_TENANT || {keys:{data:'claseGraduandaPR_v1'},schoolName:'Colegio de Puerto Rico',className:'Clase Graduanda 2027'};
const STORE = TENANT.keys.data;
let data = JSON.parse(localStorage.getItem(STORE) || 'null') || {
  settings:{schoolName:TENANT.schoolName || 'Colegio de Puerto Rico', className:TENANT.className || 'Clase Graduanda 2027'},
  students:[], dues:[], activities:[]
};
const save = () => localStorage.setItem(STORE, JSON.stringify(data));
const toast = msg => { const el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$$('.tab').forEach(btn => btn.onclick = () => {
  $$('.tab').forEach(x=>x.classList.remove('active'));
  $$('.panel').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  $('#'+btn.dataset.tab).classList.add('active');
});

function studentById(id){ return data.students.find(s=>String(s.id)===String(id)); }
function studentBalances(id){
  const dues = data.dues.filter(x=>String(x.student_id)===String(id)).reduce((a,x)=>a+(Number(x.amount)-Number(x.paid)),0);
  const acts = data.activities.filter(x=>String(x.student_id)===String(id)).reduce((a,x)=>a+(Number(x.amount)-Number(x.paid)),0);
  return {dues, acts, total:dues+acts};
}

function render(){
  $('#schoolName').textContent=data.settings.schoolName;
  $('#className').textContent=data.settings.className;
  $('#settingSchool').value=data.settings.schoolName;
  $('#settingClass').value=data.settings.className;

  const opts='<option value="">Seleccionar estudiante</option>'+data.students.sort((a,b)=>a.student_name.localeCompare(b.student_name)).map(s=>`<option value="${s.id}">${esc(s.student_name)}</option>`).join('');
  $$('select[name="student_id"]').forEach(s=>s.innerHTML=opts);

  $('#studentsTable').innerHTML=`<tr><th>Estudiante</th><th>Teléfono</th><th>Padre/Madre</th><th>Email</th><th></th></tr>`+
    data.students.map(s=>`<tr><td>${esc(s.student_name)}</td><td>${esc(s.phone)}</td><td>${esc(s.parent_name)}</td><td>${esc(s.email)}</td><td><button class="danger" onclick="deleteStudent(${s.id})">Eliminar</button></td></tr>`).join('');

  $('#duesTable').innerHTML=`<tr><th>Fecha</th><th>Estudiante</th><th>Concepto</th><th>Asignado</th><th>Pagado</th><th>Balance</th><th></th></tr>`+
    [...data.dues].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${r.date}</td><td>${esc(studentById(r.student_id)?.student_name||'')}</td><td>${esc(r.concept)}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td>${money(Number(r.amount)-Number(r.paid))}</td><td><button class="danger" onclick="deleteDue(${r.id})">Eliminar</button></td></tr>`).join('');

  $('#activitiesTable').innerHTML=`<tr><th>Fecha</th><th>Estudiante</th><th>Actividad</th><th>Cargo</th><th>Pagado</th><th>Balance</th><th></th></tr>`+
    [...data.activities].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${r.date}</td><td>${esc(studentById(r.student_id)?.student_name||'')}</td><td>${esc(r.activity_name)}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td>${money(Number(r.amount)-Number(r.paid))}</td><td><button class="danger" onclick="deleteActivity(${r.id})">Eliminar</button></td></tr>`).join('');

  $('#studentBalanceTable').innerHTML=`<tr><th>Estudiante</th><th>Cuotas</th><th>Actividades</th><th>Total pendiente</th></tr>`+
    data.students.map(s=>{const b=studentBalances(s.id); return `<tr><td>${esc(s.student_name)}</td><td>${money(b.dues)}</td><td>${money(b.acts)}</td><td><strong>${money(b.total)}</strong></td></tr>`}).join('');

  const dueBal=data.dues.reduce((a,x)=>a+Number(x.amount)-Number(x.paid),0);
  const actBal=data.activities.reduce((a,x)=>a+Number(x.amount)-Number(x.paid),0);
  $('#kpiStudents').textContent=data.students.length;
  $('#kpiDues').textContent=money(dueBal);
  $('#kpiActivities').textContent=money(actBal);
  $('#kpiTotal').textContent=money(dueBal+actBal);
}

$('#studentForm').onsubmit=e=>{e.preventDefault(); const f=Object.fromEntries(new FormData(e.target)); data.students.push({id:uid(),...f}); save(); e.target.reset(); render(); toast('Estudiante guardado');};
$('#duesForm').onsubmit=e=>{e.preventDefault(); const f=Object.fromEntries(new FormData(e.target)); data.dues.push({id:uid(),...f,amount:Number(f.amount||0),paid:Number(f.paid||0)}); save(); e.target.reset(); e.target.date.value=new Date().toISOString().slice(0,10); render(); toast('Cuota registrada');};
$('#activitiesForm').onsubmit=e=>{e.preventDefault(); const f=Object.fromEntries(new FormData(e.target)); data.activities.push({id:uid(),...f,amount:Number(f.amount||0),paid:Number(f.paid||0)}); save(); e.target.reset(); e.target.date.value=new Date().toISOString().slice(0,10); render(); toast('Actividad registrada');};
$('#settingsForm').onsubmit=e=>{e.preventDefault(); data.settings.schoolName=$('#settingSchool').value.trim()||TENANT.schoolName||'Colegio de Puerto Rico'; data.settings.className=$('#settingClass').value.trim()||TENANT.className||'Clase Graduanda'; save(); render(); toast('Configuración guardada');};

window.deleteStudent=id=>{ if(confirm('¿Eliminar estudiante y todos sus movimientos?')){ data.students=data.students.filter(x=>x.id!==id); data.dues=data.dues.filter(x=>x.student_id!=id); data.activities=data.activities.filter(x=>x.student_id!=id); save(); render(); }};
window.deleteDue=id=>{data.dues=data.dues.filter(x=>x.id!==id); save(); render();};
window.deleteActivity=id=>{data.activities=data.activities.filter(x=>x.id!==id); save(); render();};

function monthlyReport(month){
  const dues=data.dues.filter(x=>x.date?.startsWith(month));
  const acts=data.activities.filter(x=>x.date?.startsWith(month));
  const students=data.students.map(s=>{
    const sd=dues.filter(x=>x.student_id==s.id); const sa=acts.filter(x=>x.student_id==s.id);
    const duesAmount=sd.reduce((a,x)=>a+Number(x.amount),0), duesPaid=sd.reduce((a,x)=>a+Number(x.paid),0);
    const actAmount=sa.reduce((a,x)=>a+Number(x.amount),0), actPaid=sa.reduce((a,x)=>a+Number(x.paid),0);
    return {...s,dues_balance:duesAmount-duesPaid,activities_balance:actAmount-actPaid,total_balance:(duesAmount-duesPaid)+(actAmount-actPaid)};
  });
  const totalAmount=dues.reduce((a,x)=>a+Number(x.amount),0)+acts.reduce((a,x)=>a+Number(x.amount),0);
  const totalPaid=dues.reduce((a,x)=>a+Number(x.paid),0)+acts.reduce((a,x)=>a+Number(x.paid),0);
  return {month,students,totalAmount,totalPaid,totalBalance:totalAmount-totalPaid,dues,acts};
}

function generateReport(){
  const month=$('#reportMonth').value; if(!month) return toast('Selecciona el mes');
  const r=monthlyReport(month);
  $('#reportSummary').innerHTML=`<div class="card"><small>Total asignado</small><strong>${money(r.totalAmount)}</strong></div><div class="card"><small>Total cobrado</small><strong>${money(r.totalPaid)}</strong></div><div class="card"><small>Balance pendiente</small><strong>${money(r.totalBalance)}</strong></div><div class="card"><small>Estudiantes</small><strong>${r.students.length}</strong></div>`;
  $('#reportTable').innerHTML=`<tr><th>Estudiante</th><th>Padre/Madre</th><th>Email</th><th>Cuotas</th><th>Actividades</th><th>Total</th></tr>`+r.students.map(s=>`<tr><td>${esc(s.student_name)}</td><td>${esc(s.parent_name)}</td><td>${esc(s.email)}</td><td>${money(s.dues_balance)}</td><td>${money(s.activities_balance)}</td><td><strong>${money(s.total_balance)}</strong></td></tr>`).join('');
  return r;
}
$('#loadReport').onclick=generateReport;

function buildEmailLines(r){
  const lines=[
    data.settings.schoolName,
    `${data.settings.className} - Estado de cuenta ${r.month}`,
    '',
    `Total asignado: ${money(r.totalAmount)}`,
    `Total pagado: ${money(r.totalPaid)}`,
    `Balance pendiente: ${money(r.totalBalance)}`,
    '',
    '============================',
    'REGISTROS DE PAGO',
    '============================'
  ];

  r.students.forEach(s=>{
    const studentDues=r.dues.filter(x=>x.student_id==s.id);
    const studentActs=r.acts.filter(x=>x.student_id==s.id);
    const duePayments=studentDues.filter(x=>Number(x.paid)>0);
    const actPayments=studentActs.filter(x=>Number(x.paid)>0);
    if(!studentDues.length && !studentActs.length) return;

    lines.push('',`ESTUDIANTE: ${s.student_name}`);
    if(s.parent_name) lines.push(`PADRE/MADRE/ENCARGADO: ${s.parent_name}`);

    lines.push('','PAGOS DE CUOTAS');
    if(duePayments.length){
      duePayments.sort((a,b)=>a.date.localeCompare(b.date)).forEach(x=>{
        const bal=Number(x.amount)-Number(x.paid);
        lines.push(`• Fecha: ${x.date} | Cuota: ${x.concept} | Pago registrado: ${money(x.paid)} | Balance: ${money(bal)}`);
      });
    } else {
      lines.push('• No hay pagos de cuotas registrados en este mes.');
    }

    lines.push('','PAGOS DE ACTIVIDADES');
    if(actPayments.length){
      actPayments.sort((a,b)=>a.date.localeCompare(b.date)).forEach(x=>{
        const bal=Number(x.amount)-Number(x.paid);
        lines.push(`• Fecha: ${x.date} | Actividad: ${x.activity_name} | Pago registrado: ${money(x.paid)} | Balance: ${money(bal)}`);
      });
    } else {
      lines.push('• No hay pagos de actividades registrados en este mes.');
    }

    const totalPaidStudent=studentDues.reduce((a,x)=>a+Number(x.paid),0)+studentActs.reduce((a,x)=>a+Number(x.paid),0);
    lines.push('',`TOTAL PAGADO EN EL MES: ${money(totalPaidStudent)}`);
    lines.push(`BALANCE PENDIENTE DEL ESTUDIANTE: ${money(s.total_balance)}`,'----------------------------');
  });

  lines.push('',`TOTAL PAGADO GENERAL: ${money(r.totalPaid)}`);
  lines.push(`BALANCE TOTAL GENERAL: ${money(r.totalBalance)}`);
  return lines;
}

function generatePdf(){
  const r=generateReport();
  if(!r) return;
  if(!window.jspdf || !window.jspdf.jsPDF) return toast('No se pudo cargar el generador PDF');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt',format:'letter'});
  const pageWidth=doc.internal.pageSize.getWidth();
  const margin=42;
  let y=48;

  const addPageIfNeeded=(needed=80)=>{
    if(y+needed>doc.internal.pageSize.getHeight()-45){
      doc.addPage();
      y=48;
    }
  };

  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.text(data.settings.schoolName, margin, y);
  y+=24;
  doc.setFontSize(13);
  doc.text(data.settings.className, margin, y);
  y+=18;
  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.text(`Estado de cuenta mensual - ${r.month}`, margin, y);
  y+=28;

  doc.autoTable({
    startY:y,
    margin:{left:margin,right:margin},
    head:[['Resumen','Monto']],
    body:[
      ['Total asignado',money(r.totalAmount)],
      ['Total pagado',money(r.totalPaid)],
      ['Balance pendiente',money(r.totalBalance)]
    ],
    theme:'grid',
    styles:{font:'helvetica',fontSize:9,cellPadding:5},
    headStyles:{fontStyle:'bold'}
  });
  y=doc.lastAutoTable.finalY+24;

  r.students.forEach(s=>{
    const studentDues=r.dues.filter(x=>x.student_id==s.id);
    const studentActs=r.acts.filter(x=>x.student_id==s.id);
    const duePayments=studentDues.filter(x=>Number(x.paid)>0).sort((a,b)=>a.date.localeCompare(b.date));
    const actPayments=studentActs.filter(x=>Number(x.paid)>0).sort((a,b)=>a.date.localeCompare(b.date));
    if(!studentDues.length && !studentActs.length) return;

    addPageIfNeeded(120);
    doc.setFont('helvetica','bold');
    doc.setFontSize(12);
    doc.text(`Estudiante: ${s.student_name}`, margin, y);
    y+=16;
    doc.setFont('helvetica','normal');
    doc.setFontSize(9.5);
    if(s.parent_name){doc.text(`Padre/Madre/Encargado: ${s.parent_name}`, margin, y); y+=14;}
    if(s.email){doc.text(`Email: ${s.email}`, margin, y); y+=14;}

    if(duePayments.length){
      doc.autoTable({
        startY:y+4,
        margin:{left:margin,right:margin},
        head:[['Pagos de Cuotas','Fecha','Pago','Balance']],
        body:duePayments.map(x=>[x.concept,x.date,money(x.paid),money(Number(x.amount)-Number(x.paid))]),
        theme:'striped',
        styles:{font:'helvetica',fontSize:8.5,cellPadding:4},
        headStyles:{fontStyle:'bold'},
        columnStyles:{0:{cellWidth:230},1:{cellWidth:85},2:{cellWidth:85},3:{cellWidth:85}}
      });
      y=doc.lastAutoTable.finalY+14;
    } else {
      doc.setFont('helvetica','italic');
      doc.setFontSize(9);
      doc.text('No hay pagos de cuotas registrados en este mes.', margin, y+5);
      y+=22;
    }

    addPageIfNeeded(90);
    if(actPayments.length){
      doc.autoTable({
        startY:y,
        margin:{left:margin,right:margin},
        head:[['Pagos de Actividades','Fecha','Pago','Balance']],
        body:actPayments.map(x=>[x.activity_name,x.date,money(x.paid),money(Number(x.amount)-Number(x.paid))]),
        theme:'striped',
        styles:{font:'helvetica',fontSize:8.5,cellPadding:4},
        headStyles:{fontStyle:'bold'},
        columnStyles:{0:{cellWidth:230},1:{cellWidth:85},2:{cellWidth:85},3:{cellWidth:85}}
      });
      y=doc.lastAutoTable.finalY+14;
    } else {
      doc.setFont('helvetica','italic');
      doc.setFontSize(9);
      doc.text('No hay pagos de actividades registrados en este mes.', margin, y+5);
      y+=22;
    }

    const totalPaidStudent=studentDues.reduce((a,x)=>a+Number(x.paid),0)+studentActs.reduce((a,x)=>a+Number(x.paid),0);
    addPageIfNeeded(55);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9.5);
    doc.text(`Total pagado en el mes: ${money(totalPaidStudent)}`, margin, y);
    y+=14;
    doc.text(`Balance pendiente del estudiante: ${money(s.total_balance)}`, margin, y);
    y+=24;
    doc.setDrawColor(180);
    doc.line(margin,y,pageWidth-margin,y);
    y+=20;
  });

  addPageIfNeeded(55);
  doc.setFont('helvetica','bold');
  doc.setFontSize(11);
  doc.text(`TOTAL PAGADO GENERAL: ${money(r.totalPaid)}`, margin, y);
  y+=16;
  doc.text(`BALANCE TOTAL GENERAL: ${money(r.totalBalance)}`, margin, y);

  const pages=doc.internal.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.text(`Página ${p} de ${pages}`, pageWidth-margin, doc.internal.pageSize.getHeight()-22,{align:'right'});
  }

  const safeName=(data.settings.className||'clase-graduanda').replace(/[^a-z0-9áéíóúñü -]/gi,'').trim().replace(/\s+/g,'-').toLowerCase();
  doc.save(`${safeName}-reporte-${r.month}.pdf`);
  toast('PDF generado');
}

$('#pdfReport').onclick=generatePdf;

$('#sendReport').onclick=()=>{
  const r=generateReport(); if(!r) return;
  const to=$('#reportEmail').value.trim();
  const lines=buildEmailLines(r);
  location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(data.settings.className+' - Registros de pago '+r.month)}&body=${encodeURIComponent(lines.join('\n'))}`;
};

$('#backupBtn').onclick=()=>{ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='clase-graduanda-backup.json'; a.click(); URL.revokeObjectURL(a.href); };
$('#restoreFile').onchange=e=>{ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{data=JSON.parse(reader.result); save(); render(); toast('Backup restaurado');}catch{toast('Archivo inválido')}}; reader.readAsText(file); };

const today=new Date().toISOString().slice(0,10);
$$('input[type="date"]').forEach(i=>i.value=today);
$('#reportMonth').value=today.slice(0,7);
render();