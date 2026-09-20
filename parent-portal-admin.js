(() => {
  const ENDPOINT='https://ujrqkwdkytuvfaqnbmzl.supabase.co/functions/v1/parent-portal-admin-sync';
  const PORTAL_URL='https://clasegraduandapr.com/portal/';
  const CLOUD_KEY=TENANT.keys.cloud;
  const DATA_KEY=TENANT.keys.data;
  let autoTimer=null;
  let busy=false;

  const readCloud=()=>{
    try{return JSON.parse(localStorage.getItem(CLOUD_KEY)||'null')||{};}catch{return {};}
  };
  const initials=name=>String(name||'CG').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'CG';
  const num=v=>Number(v||0);
  const fmtDate=v=>String(v||'');

  function buildPayload(student){
    const dues=(data.dues||[]).filter(x=>String(x.student_id)===String(student.id));
    const acts=(data.activities||[]).filter(x=>String(x.student_id)===String(student.id));
    const totalAssigned=[...dues,...acts].reduce((s,x)=>s+num(x.amount),0);
    const totalPaid=[...dues,...acts].reduce((s,x)=>s+num(x.paid),0);

    const balances=[
      ...dues.map(x=>({
        id:'due-'+x.id,
        type:'Cuota',
        concept:x.concept||'Cuota',
        amount:Math.max(0,num(x.amount)-num(x.paid)),
        due:fmtDate(x.date)
      })),
      ...acts.map(x=>({
        id:'activity-'+x.id,
        type:'Actividad',
        concept:x.activity_name||'Actividad',
        amount:Math.max(0,num(x.amount)-num(x.paid)),
        due:fmtDate(x.date)
      }))
    ].filter(x=>x.amount>0);

    const history=[
      ...dues.filter(x=>num(x.paid)>0).map(x=>({
        receipt:'C-'+String(x.id).slice(-8),
        concept:x.concept||'Cuota',
        amount:num(x.paid),
        date:fmtDate(x.date),
        method:x.payment_method||''
      })),
      ...acts.filter(x=>num(x.paid)>0).map(x=>({
        receipt:'A-'+String(x.id).slice(-8),
        concept:x.activity_name||'Actividad',
        amount:num(x.paid),
        date:fmtDate(x.date),
        method:x.payment_method||''
      }))
    ].sort((a,b)=>String(b.date).localeCompare(String(a.date)));

    const activities=acts
      .slice()
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
      .map(x=>{
        const bal=Math.max(0,num(x.amount)-num(x.paid));
        return {
          title:x.activity_name||'Actividad',
          detail:[fmtDate(x.date),bal>0?'Balance '+money(bal):'Pagada'].filter(Boolean).join(' · '),
          tag:bal>0?'Pendiente':'Pagada'
        };
      });

    return {
      student:{
        initials:initials(student.student_name),
        name:student.student_name||'Estudiante',
        className:data.settings?.className||TENANT.className||'Clase Graduanda',
        school:data.settings?.schoolName||TENANT.schoolName||'Clase Graduanda PR'
      },
      summary:{paid:totalPaid,totalGoal:totalAssigned},
      balances,
      history,
      activities,
      documents:[],
      notices:[]
    };
  }

  async function api(body){
    const cfg=readCloud();
    if(!cfg.collegeCode || !cfg.rawKey){
      throw new Error('La mini nube debe estar configurada antes de activar el Portal para Padres.');
    }
    const res=await fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        collegeCode:cfg.collegeCode,
        rawKey:cfg.rawKey,
        ...body
      })
    });
    let out={};
    try{out=await res.json();}catch{}
    if(!res.ok || !out.ok) throw new Error(out.error||'No se pudo actualizar el portal.');
    return out;
  }

  async function syncStudent(student,{rotate=false,silent=false}={}){
    if(!student) return null;
    const currentCode=rotate?'':String(student.parent_portal_code||'').trim().toUpperCase();
    const result=await api({
      action:'upsert',
      studentRef:String(student.id),
      accessCode:currentCode,
      payload:buildPayload(student)
    });
    student.parent_portal_enabled=true;
    student.parent_portal_code=result.accessCode;
    student.parent_portal_last_sync=new Date().toISOString();
    save();
    if(!silent) toast('Portal del estudiante sincronizado');
    return result;
  }

  async function disableStudent(student,{silent=false}={}){
    if(!student) return;
    await api({action:'disable',studentRef:String(student.id)});
    student.parent_portal_enabled=false;
    student.parent_portal_last_sync=new Date().toISOString();
    save();
    if(!silent) toast('Acceso de padres desactivado');
  }

  async function syncEnabledStudents(){
    if(busy) return;
    const enabled=(data.students||[]).filter(s=>s.parent_portal_enabled && s.parent_portal_code);
    if(!enabled.length) return;
    busy=true;
    try{
      for(const student of enabled){
        try{await syncStudent(student,{silent:true});}catch(err){console.warn('Portal Padres:',err?.message||err);}
      }
    }finally{busy=false;}
  }

  function scheduleSync(){
    clearTimeout(autoTimer);
    autoTimer=setTimeout(syncEnabledStudents,3000);
  }

  const style=document.createElement('style');
  style.textContent=`
    .parent-portal-btn{padding:7px 10px;background:#f6edd3;color:#745410;margin-right:6px;border:0;border-radius:9px;font-weight:800}
    .parent-portal-modal{position:fixed;inset:0;z-index:11000;background:rgba(4,20,32,.66);display:none;align-items:center;justify-content:center;padding:18px}
    .parent-portal-modal.open{display:flex}
    .parent-portal-card{width:min(100%,580px);background:#fff;border-radius:22px;padding:22px;box-shadow:0 28px 90px rgba(0,0,0,.32)}
    .parent-portal-card h2{margin:0 0 6px}.parent-portal-card p{color:#607181;line-height:1.45}
    .parent-portal-code{padding:15px;border:1px solid #dce3e8;border-radius:14px;background:#f7f9fb;margin:14px 0}
    .parent-portal-code small{display:block;color:#758494;font-weight:700;margin-bottom:5px}.parent-portal-code strong{font-size:20px;letter-spacing:1px;color:#102d46;word-break:break-all}
    .parent-portal-meta{font-size:12px;color:#758494;margin-top:8px}
    .parent-portal-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
    .parent-portal-actions button{flex:1;min-width:130px}
    .parent-portal-actions .danger-outline{background:#fff;color:#a72d2d;border:1px solid #e0b8b8}
    .parent-portal-status{min-height:20px;font-size:13px;font-weight:700;margin-top:10px;color:#31516b}
    @media(max-width:650px){.parent-portal-actions{display:grid;grid-template-columns:1fr}.parent-portal-actions button{width:100%}}
  `;
  document.head.appendChild(style);

  const modal=document.createElement('div');
  modal.className='parent-portal-modal';
  modal.innerHTML=`<div class="parent-portal-card">
    <h2>Portal para Padres</h2>
    <p id="ppStudent"></p>
    <div class="parent-portal-code">
      <small>Código individual del estudiante</small>
      <strong id="ppCode">Todavía no generado</strong>
      <div id="ppMeta" class="parent-portal-meta"></div>
    </div>
    <div class="parent-portal-actions">
      <button id="ppGenerate" type="button">Generar código</button>
      <button id="ppSync" type="button" class="secondary">Sincronizar ahora</button>
      <button id="ppCopy" type="button" class="secondary">Copiar acceso</button>
      <button id="ppDisable" type="button" class="danger-outline">Desactivar</button>
      <button id="ppClose" type="button" class="secondary">Cerrar</button>
    </div>
    <div id="ppStatus" class="parent-portal-status"></div>
  </div>`;
  document.body.appendChild(modal);

  let selected=null;
  const codeEl=modal.querySelector('#ppCode');
  const statusEl=modal.querySelector('#ppStatus');

  function refreshModal(){
    if(!selected) return;
    modal.querySelector('#ppStudent').textContent=selected.student_name+' · '+(data.settings?.className||TENANT.className||'');
    codeEl.textContent=selected.parent_portal_code||'Todavía no generado';
    const active=!!selected.parent_portal_enabled;
    const sync=selected.parent_portal_last_sync ? new Date(selected.parent_portal_last_sync).toLocaleString('es-PR') : 'Nunca';
    modal.querySelector('#ppMeta').textContent=(active?'Acceso activo':'Acceso inactivo')+' · Última sincronización: '+sync;
    modal.querySelector('#ppGenerate').textContent=selected.parent_portal_code?'Rotar código':'Generar código';
    modal.querySelector('#ppSync').disabled=!selected.parent_portal_code;
    modal.querySelector('#ppCopy').disabled=!selected.parent_portal_code;
    modal.querySelector('#ppDisable').disabled=!active;
  }

  function openModal(student){
    selected=student;
    statusEl.textContent='';
    refreshModal();
    modal.classList.add('open');
  }
  function closeModal(){modal.classList.remove('open');selected=null;statusEl.textContent='';}
  modal.querySelector('#ppClose').onclick=closeModal;
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});

  modal.querySelector('#ppGenerate').onclick=async()=>{
    if(!selected) return;
    const rotating=!!selected.parent_portal_code;
    if(rotating && !confirm('Se invalidará el código anterior de este estudiante. ¿Continuar?')) return;
    statusEl.textContent=rotating?'Rotando código...':'Creando acceso seguro...';
    try{
      await syncStudent(selected,{rotate:rotating,silent:true});
      statusEl.textContent=rotating?'Código nuevo creado. El anterior dejó de funcionar.':'Portal creado y sincronizado.';
      refreshModal();
      render();
    }catch(err){statusEl.textContent=err?.message||'No se pudo crear el portal.';}
  };

  modal.querySelector('#ppSync').onclick=async()=>{
    if(!selected) return;
    statusEl.textContent='Sincronizando pagos y balances...';
    try{
      await syncStudent(selected,{silent:true});
      statusEl.textContent='Pagos y balances actualizados.';
      refreshModal();
    }catch(err){statusEl.textContent=err?.message||'No se pudo sincronizar.';}
  };

  modal.querySelector('#ppCopy').onclick=async()=>{
    if(!selected?.parent_portal_code) return;
    const message='Portal para Padres - Clase Graduanda PR\n'+PORTAL_URL+'\nCódigo de acceso: '+selected.parent_portal_code;
    try{
      await navigator.clipboard.writeText(message);
      statusEl.textContent='Enlace y código copiados.';
    }catch{
      statusEl.textContent='Código: '+selected.parent_portal_code+' · '+PORTAL_URL;
    }
  };

  modal.querySelector('#ppDisable').onclick=async()=>{
    if(!selected || !confirm('¿Desactivar el acceso de padres para este estudiante?')) return;
    statusEl.textContent='Desactivando acceso...';
    try{
      await disableStudent(selected,{silent:true});
      statusEl.textContent='Acceso desactivado.';
      refreshModal();
      render();
    }catch(err){statusEl.textContent=err?.message||'No se pudo desactivar.';}
  };

  function addButtons(){
    const rows=[...document.querySelectorAll('#studentsTable tr')].slice(1);
    rows.forEach((tr,i)=>{
      const student=data.students[i];
      const cell=tr.lastElementChild;
      if(!student||!cell||cell.querySelector('.parent-portal-btn')) return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='parent-portal-btn';
      btn.textContent=student.parent_portal_enabled?'Portal Padres ✓':'Portal Padres';
      btn.onclick=()=>openModal(student);
      cell.prepend(btn);
    });
  }

  if(typeof render==='function'){
    const previousRender=render;
    render=function(){
      previousRender();
      setTimeout(addButtons,20);
    };
  }

  const previousSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    const result=previousSetItem.call(this,key,value);
    if(this===localStorage && String(key)===String(DATA_KEY)) scheduleSync();
    return result;
  };

  if(typeof window.deleteStudent==='function'){
    const originalDeleteStudent=window.deleteStudent;
    window.deleteStudent=function(id){
      const student=(data.students||[]).find(x=>String(x.id)===String(id));
      const snapshot=student ? {...student} : null;
      originalDeleteStudent(id);
      const stillExists=(data.students||[]).some(x=>String(x.id)===String(id));
      if(snapshot?.parent_portal_enabled && !stillExists){
        api({action:'disable',studentRef:String(snapshot.id)}).catch(()=>{});
      }
    };
  }

  setTimeout(addButtons,80);
})();