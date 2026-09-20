(() => {
  const METHODS = ['', 'Efectivo', 'ATH Móvil', 'Cheque'];

  const style = document.createElement('style');
  style.textContent = `
    .edit-btn{padding:7px 10px;background:#e8f1f8;color:#123b5d;margin-right:6px}
    .edit-modal{position:fixed;inset:0;z-index:10000;background:rgba(10,20,30,.55);display:none;align-items:center;justify-content:center;padding:18px}
    .edit-modal.open{display:flex}
    .edit-card{width:min(100%,620px);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.28)}
    .edit-card h2{margin:0 0 16px}
    .edit-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .edit-field{display:grid;gap:6px}
    .edit-field.full{grid-column:1/-1}
    .edit-field label{font-size:13px;font-weight:700;color:#52606d}
    .edit-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
    @media(max-width:650px){.edit-grid{grid-template-columns:1fr}.edit-field.full{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'edit-modal';
  modal.innerHTML = `<div class="edit-card">
    <h2 id="editTitle">Editar</h2>
    <form id="editForm">
      <div id="editFields" class="edit-grid"></div>
      <div class="edit-actions">
        <button type="button" id="editCancel" class="secondary">Cancelar</button>
        <button type="submit">Guardar cambios</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);

  const fields = modal.querySelector('#editFields');
  const form = modal.querySelector('#editForm');
  let onSave = null;

  const close = () => { modal.classList.remove('open'); form.reset(); fields.innerHTML=''; onSave=null; };
  modal.querySelector('#editCancel').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  const inputField = (label, name, value='', type='text', full=false, extra='') => `
    <div class="edit-field ${full?'full':''}">
      <label>${label}</label>
      <input name="${name}" type="${type}" value="${esc(value)}" ${extra} />
    </div>`;

  const selectField = (label, name, value, options, full=false) => `
    <div class="edit-field ${full?'full':''}">
      <label>${label}</label>
      <select name="${name}">${options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>
    </div>`;

  function openStudent(id){
    const item = data.students.find(x=>x.id==id); if(!item) return;
    modal.querySelector('#editTitle').textContent='Editar estudiante';
    fields.innerHTML =
      inputField('Nombre del estudiante','student_name',item.student_name,'text',true,'required')+
      inputField('Teléfono','phone',item.phone||'')+
      inputField('Padre/Madre/Encargado','parent_name',item.parent_name||'')+
      inputField('Email','email',item.email||'','email',true);
    onSave = f => Object.assign(item,{student_name:f.student_name.trim(),phone:f.phone.trim(),parent_name:f.parent_name.trim(),email:f.email.trim()});
    modal.classList.add('open');
  }

  const studentOptions = selected => [{value:'',label:'Seleccionar estudiante'}, ...data.students.map(s=>({value:s.id,label:s.student_name}))];
  const methodOptions = current => {
    const list=[...METHODS];
    if(current && !list.includes(current)) list.push(current);
    return list.map((m,i)=>({value:m,label:i===0?'No especificado':m}));
  };

  function openDue(id){
    const item=data.dues.find(x=>x.id==id); if(!item) return;
    modal.querySelector('#editTitle').textContent='Editar cuota';
    fields.innerHTML =
      selectField('Estudiante','student_id',item.student_id,studentOptions(item.student_id),true)+
      inputField('Concepto','concept',item.concept||'','text',true,'required')+
      inputField('Monto asignado','amount',item.amount,'number',false,'step="0.01" min="0" required')+
      inputField('Pagado','paid',item.paid,'number',false,'step="0.01" min="0"')+
      selectField('Método de pago','payment_method',item.payment_method||'',methodOptions(item.payment_method||''))+
      inputField('Fecha','date',item.date||'','date',false,'required')+
      inputField('Notas','notes',item.notes||'','text',true);
    onSave = f => Object.assign(item,{student_id:f.student_id,concept:f.concept.trim(),amount:Number(f.amount||0),paid:Number(f.paid||0),payment_method:f.payment_method,date:f.date,notes:f.notes.trim()});
    modal.classList.add('open');
  }

  function openActivity(id){
    const item=data.activities.find(x=>x.id==id); if(!item) return;
    modal.querySelector('#editTitle').textContent='Editar actividad';
    fields.innerHTML =
      selectField('Estudiante','student_id',item.student_id,studentOptions(item.student_id),true)+
      inputField('Actividad','activity_name',item.activity_name||'','text',true,'required')+
      inputField('Cargo','amount',item.amount,'number',false,'step="0.01" min="0" required')+
      inputField('Pagado','paid',item.paid,'number',false,'step="0.01" min="0"')+
      selectField('Método de pago','payment_method',item.payment_method||'',methodOptions(item.payment_method||''))+
      inputField('Fecha','date',item.date||'','date',false,'required')+
      inputField('Notas','notes',item.notes||'','text',true);
    onSave = f => Object.assign(item,{student_id:f.student_id,activity_name:f.activity_name.trim(),amount:Number(f.amount||0),paid:Number(f.paid||0),payment_method:f.payment_method,date:f.date,notes:f.notes.trim()});
    modal.classList.add('open');
  }

  form.onsubmit = e => {
    e.preventDefault();
    if(!onSave) return;
    const f=Object.fromEntries(new FormData(form));
    onSave(f);
    save();
    render();
    close();
    toast('Cambios guardados');
  };

  function addEditButtons(){
    const studentRows=[...document.querySelectorAll('#studentsTable tr')].slice(1);
    studentRows.forEach((tr,i)=>{
      const s=data.students[i]; const cell=tr.lastElementChild; if(!s||!cell||cell.querySelector('.edit-btn')) return;
      const b=document.createElement('button'); b.type='button'; b.className='edit-btn'; b.textContent='Editar'; b.onclick=()=>openStudent(s.id); cell.prepend(b);
    });

    const dues=[...data.dues].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    [...document.querySelectorAll('#duesTable tr')].slice(1).forEach((tr,i)=>{
      const x=dues[i]; const cell=tr.lastElementChild; if(!x||!cell||cell.querySelector('.edit-btn')) return;
      const b=document.createElement('button'); b.type='button'; b.className='edit-btn'; b.textContent='Editar'; b.onclick=()=>openDue(x.id); cell.prepend(b);
    });

    const acts=[...data.activities].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    [...document.querySelectorAll('#activitiesTable tr')].slice(1).forEach((tr,i)=>{
      const x=acts[i]; const cell=tr.lastElementChild; if(!x||!cell||cell.querySelector('.edit-btn')) return;
      const b=document.createElement('button'); b.type='button'; b.className='edit-btn'; b.textContent='Editar'; b.onclick=()=>openActivity(x.id); cell.prepend(b);
    });
  }

  if(typeof render==='function'){
    const previousRender=render;
    render=function(){ previousRender(); setTimeout(addEditButtons,0); };
  }
  addEditButtons();
})();