const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => `$${Number(n || 0).toFixed(2)}`;
const api = async (url, options={}) => {
  const r = await fetch(url, {headers:{'Content-Type':'application/json'}, ...options});
  const data = await r.json();
  if(!r.ok) throw new Error(data.error || 'Error');
  return data;
};
const toast = msg => {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2200);
};

let students=[];

$$('.tab').forEach(btn => btn.onclick = () => {
  $$('.tab').forEach(x=>x.classList.remove('active'));
  $$('.panel').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  $('#'+btn.dataset.tab).classList.add('active');
});

async function loadConfig(){
  const c = await api('/api/config');
  $('#schoolName').textContent = c.schoolName;
  $('#className').textContent = c.className;
}
async function loadStudents(){
  students = await api('/api/students');
  const opts = `<option value="">Seleccionar estudiante</option>` + students.map(s=>`<option value="${s.id}">${s.student_name}</option>`).join('');
  $$('select[name="student_id"]').forEach(s=>s.innerHTML=opts);

  $('#studentsTable').innerHTML = `
    <tr><th>Estudiante</th><th>Teléfono</th><th>Padre/Madre</th><th>Email</th><th></th></tr>
    ${students.map(s=>`<tr>
      <td>${s.student_name}</td><td>${s.phone||''}</td><td>${s.parent_name||''}</td><td>${s.email||''}</td>
      <td><button class="danger" onclick="deleteStudent(${s.id})">Eliminar</button></td>
    </tr>`).join('')}`;

  $('#studentBalanceTable').innerHTML = `
    <tr><th>Estudiante</th><th>Cuotas</th><th>Actividades</th><th>Total pendiente</th></tr>
    ${students.map(s=>`<tr>
      <td>${s.student_name}</td>
      <td>${money(s.dues_balance)}</td>
      <td>${money(s.activities_balance)}</td>
      <td><strong>${money(Number(s.dues_balance)+Number(s.activities_balance))}</strong></td>
    </tr>`).join('')}`;

  const dues = students.reduce((a,s)=>a+Number(s.dues_balance||0),0);
  const acts = students.reduce((a,s)=>a+Number(s.activities_balance||0),0);
  $('#kpiStudents').textContent=students.length;
  $('#kpiDues').textContent=money(dues);
  $('#kpiActivities').textContent=money(acts);
  $('#kpiTotal').textContent=money(dues+acts);
}
async function loadDues(){
  const rows=await api('/api/dues');
  $('#duesTable').innerHTML=`<tr><th>Fecha</th><th>Estudiante</th><th>Concepto</th><th>Asignado</th><th>Pagado</th><th>Balance</th><th></th></tr>`+
    rows.map(r=>`<tr><td>${r.date}</td><td>${r.student_name}</td><td>${r.concept}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td>${money(r.balance)}</td><td><button class="danger" onclick="deleteDue(${r.id})">Eliminar</button></td></tr>`).join('');
}
async function loadActivities(){
  const rows=await api('/api/activities');
  $('#activitiesTable').innerHTML=`<tr><th>Fecha</th><th>Estudiante</th><th>Actividad</th><th>Cargo</th><th>Pagado</th><th>Balance</th><th></th></tr>`+
    rows.map(r=>`<tr><td>${r.date}</td><td>${r.student_name}</td><td>${r.activity_name}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td>${money(r.balance)}</td><td><button class="danger" onclick="deleteActivity(${r.id})">Eliminar</button></td></tr>`).join('');
}
async function refresh(){
  await Promise.all([loadStudents(),loadDues(),loadActivities()]);
}

$('#studentForm').onsubmit=async e=>{
  e.preventDefault(); const f=Object.fromEntries(new FormData(e.target));
  await api('/api/students',{method:'POST',body:JSON.stringify(f)});
  e.target.reset(); toast('Estudiante guardado'); refresh();
};
$('#duesForm').onsubmit=async e=>{
  e.preventDefault(); const f=Object.fromEntries(new FormData(e.target));
  await api('/api/dues',{method:'POST',body:JSON.stringify(f)});
  e.target.reset(); e.target.date.value=new Date().toISOString().slice(0,10);
  toast('Cuota registrada'); refresh();
};
$('#activitiesForm').onsubmit=async e=>{
  e.preventDefault(); const f=Object.fromEntries(new FormData(e.target));
  await api('/api/activities',{method:'POST',body:JSON.stringify(f)});
  e.target.reset(); e.target.date.value=new Date().toISOString().slice(0,10);
  toast('Actividad registrada'); refresh();
};

window.deleteStudent=async id=>{ if(confirm('¿Eliminar estudiante y sus movimientos?')){await api('/api/students/'+id,{method:'DELETE'});refresh();}};
window.deleteDue=async id=>{await api('/api/dues/'+id,{method:'DELETE'});refresh();};
window.deleteActivity=async id=>{await api('/api/activities/'+id,{method:'DELETE'});refresh();};

async function generateReport(){
  const month=$('#reportMonth').value;
  if(!month) return toast('Selecciona el mes');
  const r=await api('/api/reports/monthly?month='+month);
  $('#reportSummary').innerHTML=`
    <div class="card"><small>Total asignado</small><strong>${money(r.totals.total_amount)}</strong></div>
    <div class="card"><small>Total cobrado</small><strong>${money(r.totals.total_paid)}</strong></div>
    <div class="card"><small>Cuotas pendientes</small><strong>${money(Number(r.totals.dues_amount)-Number(r.totals.dues_paid))}</strong></div>
    <div class="card"><small>Balance pendiente</small><strong>${money(r.totals.total_balance)}</strong></div>`;
  $('#reportTable').innerHTML=`<tr><th>Estudiante</th><th>Padre/Madre</th><th>Email</th><th>Cuotas</th><th>Actividades</th><th>Total</th></tr>`+
    r.students.map(s=>`<tr><td>${s.student_name}</td><td>${s.parent_name||''}</td><td>${s.email||''}</td><td>${money(s.dues_balance)}</td><td>${money(s.activities_balance)}</td><td><strong>${money(s.total_balance)}</strong></td></tr>`).join('');
  return r;
}
$('#loadReport').onclick=generateReport;
$('#sendReport').onclick=async()=>{
  const month=$('#reportMonth').value;
  if(!month) return toast('Selecciona el mes');
  try{
    const r=await api('/api/reports/monthly/send',{method:'POST',body:JSON.stringify({month,to:$('#reportEmail').value})});
    toast('Reporte enviado a '+r.to);
  }catch(e){toast(e.message)}
};

const today=new Date().toISOString().slice(0,10);
$$('input[type="date"]').forEach(i=>i.value=today);
$('#reportMonth').value=today.slice(0,7);

loadConfig(); refresh();
