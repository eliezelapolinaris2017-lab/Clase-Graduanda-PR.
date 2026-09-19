(() => {
  const PROFILE_KEY='claseGraduandaPR_tenant_profiles_v1';
  const SUPABASE_URL='https://ujrqkwdkytuvfaqnbmzl.supabase.co';
  const SUPABASE_KEY='sb_publishable_9Dm_vf7L3jETvPNCcjr7CA_vqAIReqH';
  const encoder=new TextEncoder();
  const ACTIVE_KEY='claseGraduandaPR_active_tenant';
  const $=s=>document.querySelector(s);
  const slugify=v=>String(v||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

  const readProfiles=()=>{ try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{};}catch{return{};} };

  function hydrate(){
    const t=window.CGPR_TENANT||{};
    if($('#tenantAdminId')) $('#tenantAdminId').value=t.id||'';
    if($('#tenantAdminSchool')) $('#tenantAdminSchool').value=t.schoolName||'';
    if($('#tenantAdminClass')) $('#tenantAdminClass').value=t.className||'';
    if($('#tenantAdminCloudCode')) $('#tenantAdminCloudCode').value=t.cloudCode||'';
    if($('#tenantAdminPin')) $('#tenantAdminPin').value='';
    if($('#tenantAdminRecoveryPin')) $('#tenantAdminRecoveryPin').value='';
  }

  const bytesToB64=bytes=>{
    let s='';
    const arr=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    for(let i=0;i<arr.length;i++) s+=String.fromCharCode(arr[i]);
    return btoa(s);
  };
  const sha256=value=>crypto.subtle.digest('SHA-256',encoder.encode(value));
  const hex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const normalizeCode=code=>String(code||'').trim().toUpperCase().replace(/\s+/g,'-');

  async function collegeId(code){
    return hex(await sha256('nexus-clase-graduanda:'+normalizeCode(code)));
  }

  async function deriveRawKey(pin,code){
    const baseKey=await crypto.subtle.importKey('raw',encoder.encode(String(pin)),'PBKDF2',false,['deriveKey']);
    const salt=new Uint8Array(await sha256('cgpr-salt:'+normalizeCode(code)));
    const key=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},
      baseKey,{name:'AES-GCM',length:256},true,['encrypt']
    );
    return new Uint8Array(await crypto.subtle.exportKey('raw',key));
  }

  async function encryptBundle(bundle,rawKeyBytes){
    const key=await crypto.subtle.importKey('raw',rawKeyBytes,{name:'AES-GCM'},false,['encrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt(
      {name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(bundle))
    );
    return 'v1.'+bytesToB64(iv)+'.'+bytesToB64(new Uint8Array(encrypted));
  }

  async function rpc(fn,body){
    const res=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+fn,{
      method:'POST',
      headers:{
        'apikey':SUPABASE_KEY,
        'Authorization':'Bearer '+SUPABASE_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(body)
    });
    if(!res.ok) throw new Error('Supabase '+res.status);
    const text=await res.text();
    if(!text) return null;
    try{return JSON.parse(text);}catch{return text;}
  }

  $('#tenantAdminSave')?.addEventListener('click',async()=>{
    const school=($('#tenantAdminSchool')?.value||'').trim();
    const className=($('#tenantAdminClass')?.value||'').trim();
    let id=slugify($('#tenantAdminId')?.value||school);
    const cloudCode=($('#tenantAdminCloudCode')?.value||'').trim().toUpperCase().replace(/\s+/g,'-');
    const defaultPin=($('#tenantAdminPin')?.value||'').trim();
    const recoveryPin=($('#tenantAdminRecoveryPin')?.value||'').trim();
    const status=$('#tenantAdminStatus');

    if(!id || !school || !className || !cloudCode){
      if(status) status.textContent='Completa identificador, colegio, clase y código interno.';
      return;
    }
    if(defaultPin && !/^\d{4}$/.test(defaultPin)){
      if(status) status.textContent='El PIN inicial debe tener 4 dígitos.';
      return;
    }
    if(recoveryPin && !/^\d{4,6}$/.test(recoveryPin)){
      if(status) status.textContent='El PIN de recuperación debe tener de 4 a 6 dígitos.';
      return;
    }

    const profiles=readProfiles();
    const current=window.CGPR_TENANT||{};
    profiles[id]={
      id,
      slug:id,
      schoolName:school,
      className,
      cloudCode,
      recoveryPin:recoveryPin || current.recoveryPin || '',
      defaultPin:defaultPin || current.defaultPin || '1234'
    };
    localStorage.setItem(PROFILE_KEY,JSON.stringify(profiles));

    const prefix='claseGraduandaPR_'+id;
    const dataKey=prefix+'_data_v1';
    const authKey=prefix+'_auth_v1';
    const brandingKey=prefix+'_branding_v1';

    if(!localStorage.getItem(dataKey)){
      localStorage.setItem(dataKey,JSON.stringify({
        settings:{schoolName:school,className},
        students:[],
        dues:[],
        activities:[]
      }));
    }
    if(!localStorage.getItem(authKey)){
      localStorage.setItem(authKey,JSON.stringify({
        pin:defaultPin || current.defaultPin || '1234',
        adminName:''
      }));
    }
    if(!localStorage.getItem(brandingKey)){
      localStorage.setItem(brandingKey,JSON.stringify({
        color1:'#102d46',
        color2:'#1c5277',
        logo:''
      }));
    }

    localStorage.setItem(ACTIVE_KEY,id);

    try{
      if(status) status.textContent='Creando espacio del colegio en la nube...';

      const effectiveRecoveryPin=recoveryPin || current.recoveryPin || '';
      if(!effectiveRecoveryPin) throw new Error('Falta PIN de recuperación');

      const cid=await collegeId(cloudCode);
      const existing=await rpc('load_graduanda_backup',{p_college_id:cid});
      const existingRow=Array.isArray(existing)?existing[0]||null:existing;

      if(!existingRow?.payload){
        const rawKey=await deriveRawKey(effectiveRecoveryPin,cloudCode);
        const records={};
        records[dataKey]=localStorage.getItem(dataKey);
        records[authKey]=localStorage.getItem(authKey);
        records[brandingKey]=localStorage.getItem(brandingKey);

        const payload=await encryptBundle({
          version:2,
          savedAt:new Date().toISOString(),
          records
        },rawKey);

        await rpc('save_graduanda_backup',{
          p_college_id:cid,
          p_payload:payload
        });
      }

      const cloudKey=prefix+'_cloud_v1';
      const rawKey=await deriveRawKey(effectiveRecoveryPin,cloudCode);
      localStorage.setItem(cloudKey,JSON.stringify({
        url:SUPABASE_URL,
        anonKey:SUPABASE_KEY,
        collegeCode:cloudCode,
        collegeId:cid,
        rawKey:bytesToB64(rawKey),
        autosave:true,
        autoManaged:true,
        recoveryConfigured:true,
        configuredAt:new Date().toISOString(),
        lastBackup:new Date().toISOString()
      }));

      if(status) status.textContent='Colegio guardado y nube creada. Reiniciando...';
      setTimeout(()=>{
        const url=new URL(location.href);
        url.searchParams.delete('tenant');
        url.searchParams.delete('nube');
        url.hash='';
        location.href=url.origin + url.pathname;
      },700);
    }catch(err){
      if(status) status.textContent='Colegio guardado localmente, pero la nube falló: '+(err?.message||'error desconocido');
    }
  });

  hydrate();
})();