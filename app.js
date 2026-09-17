const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => `$${Number(n || 0).toFixed(2)}`;
const uid = () => Date.now() + Math.floor(Math.random()*10000);

const STORE = 'claseGraduandaPR_v1';
let data = JSON.parse(localStorage.getItem(STORE) || 'null') || {
  settings:{schoolName:'Colegio de Puerto Rico', className:'Clase Graduanda 2027'},
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
$('#settingsForm').onsubmit=e=>{e.preventDefault(); data.settings.schoolName=$('#settingSchool').value.trim()||'Colegio de Puerto Rico'; data.settings.className=$('#settingClass').value.trim()||'Clase Graduanda'; save(); render(); toast('Configuración guardada');};

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
  return {month,students,totalAmount,totalPaid,totalBalance:totalAmount-totalPaid};
}

function generateReport(){
  const month=$('#reportMonth').value; if(!month) return toast('Selecciona el mes');
  const r=monthlyReport(month);
  $('#reportSummary').innerHTML=`<div class="card"><small>Total asignado</small><strong>${money(r.totalAmount)}</strong></div><div class="card"><small>Total cobrado</small><strong>${money(r.totalPaid)}</strong></div><div class="card"><small>Balance pendiente</small><strong>${money(r.totalBalance)}</strong></div><div class="card"><small>Estudiantes</small><strong>${r.students.length}</strong></div>`;
  $('#reportTable').innerHTML=`<tr><th>Estudiante</th><th>Padre/Madre</th><th>Email</th><th>Cuotas</th><th>Actividades</th><th>Total</th></tr>`+r.students.map(s=>`<tr><td>${esc(s.student_name)}</td><td>${esc(s.parent_name)}</td><td>${esc(s.email)}</td><td>${money(s.dues_balance)}</td><td>${money(s.activities_balance)}</td><td><strong>${money(s.total_balance)}</strong></td></tr>`).join('');
  return r;
}
$('#loadReport').onclick=generateReport;
$('#sendReport').onclick=()=>{
  const r=generateReport(); if(!r) return;
  const to=$('#reportEmail').value.trim();
  const lines=[`${data.settings.schoolName}`,`${data.settings.className} - Reporte mensual ${r.month}`,'',`Total asignado: ${money(r.totalAmount)}`,`Total cobrado: ${money(r.totalPaid)}`,`Balance pendiente: ${money(r.totalBalance)}`,'','Detalle por estudiante:'];
  r.students.forEach(s=>lines.push(`${s.student_name} | Cuotas: ${money(s.dues_balance)} | Actividades: ${money(s.activities_balance)} | Total: ${money(s.total_balance)}`));
  location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(data.settings.className+' - Balance '+r.month)}&body=${encodeURIComponent(lines.join('\n'))}`;
};

$('#backupBtn').onclick=()=>{ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='clase-graduanda-backup.json'; a.click(); URL.revokeObjectURL(a.href); };
$('#restoreFile').onchange=e=>{ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{data=JSON.parse(reader.result); save(); render(); toast('Backup restaurado');}catch{toast('Archivo inválido')}}; reader.readAsText(file); };

const today=new Date().toISOString().slice(0,10);
$$('input[type="date"]').forEach(i=>i.value=today);
$('#reportMonth').value=today.slice(0,7);
render();