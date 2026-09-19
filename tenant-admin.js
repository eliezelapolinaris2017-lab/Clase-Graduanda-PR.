(() => {
  const PROFILE_KEY='claseGraduandaPR_tenant_profiles_v1';
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

  $('#tenantAdminSave')?.addEventListener('click',()=>{
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
    if(status) status.textContent='Colegio guardado. Reiniciando en su espacio independiente...';
    setTimeout(()=>{
      const url=new URL(location.href);
      url.searchParams.delete('tenant');
      url.searchParams.delete('nube');
      url.hash='';
      location.href=url.origin + url.pathname;
    },500);
  });

  hydrate();
})();