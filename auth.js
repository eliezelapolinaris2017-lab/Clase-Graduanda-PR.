(() => {
  const TENANT=window.CGPR_TENANT||{keys:{auth:'claseGraduandaPR_auth_v1',data:'claseGraduandaPR_v1'},defaultPin:''};
  const AUTH_KEY=TENANT.keys.auth;
  const DATA_KEY=TENANT.keys.data;
  const DEFAULT_PIN=TENANT.defaultPin||'';
  const MASTER_HASH='8ad058a4cbcd36c770fa655d04b1241da93134f5040b862e49fe628b19a34790';

  const $=s=>document.querySelector(s);
  const readAuth=()=>JSON.parse(localStorage.getItem(AUTH_KEY)||'null')||{pin:DEFAULT_PIN,adminName:''};
  const saveAuth=a=>localStorage.setItem(AUTH_KEY,JSON.stringify(a));
  const readData=()=>JSON.parse(localStorage.getItem(DATA_KEY)||'null')||{};

  async function sha256(text){
    const bytes=new TextEncoder().encode(text);
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function currentDisplayName(){
    const auth=readAuth();
    const d=readData();
    return auth.adminName || d.settings?.className || d.settings?.schoolName || 'Clase Graduanda PR';
  }

  function refreshLoginName(){
    const el=$('#pinWelcomeName');
    if(el) el.textContent=currentDisplayName();
  }

  function lock(){
    const overlay=$('#pinLock');
    if(!overlay) return;
    refreshLoginName();
    overlay.classList.remove('unlocked');
    document.body.classList.add('app-locked');
    const input=$('#pinInput');
    if(input){input.value=''; setTimeout(()=>input.focus(),50);}
  }

  function unlock(){
    const overlay=$('#pinLock');
    if(!overlay) return;
    overlay.classList.add('unlocked');
    document.body.classList.remove('app-locked');
    const err=$('#pinError'); if(err) err.textContent='';
  }

  function hydrateSettings(){
    const auth=readAuth();
    const name=$('#settingAdminName');
    if(name) name.value=auth.adminName||'';
    const pin=$('#settingPin');
    if(pin) pin.value='';
  }

  const loginForm=$('#pinLoginForm');
  if(loginForm){
    loginForm.addEventListener('submit',async e=>{
      e.preventDefault();
      const entered=($('#pinInput')?.value||'').trim();
      const auth=readAuth();
      const isRecovery=(await sha256(entered))===MASTER_HASH;
      if(entered===auth.pin || isRecovery){
        unlock();
        hydrateSettings();
      } else {
        $('#pinError').textContent='PIN incorrecto';
        $('#pinInput').value='';
        $('#pinInput').focus();
      }
    });
  }

  const settingsForm=$('#settingsForm');
  if(settingsForm){
    settingsForm.addEventListener('submit',()=>{
      const auth=readAuth();
      const adminName=($('#settingAdminName')?.value||'').trim();
      const newPin=($('#settingPin')?.value||'').trim();
      auth.adminName=adminName;
      if(newPin && /^\d{4}$/.test(newPin)) auth.pin=newPin;
      saveAuth(auth);
      refreshLoginName();
      setTimeout(()=>{ const p=$('#settingPin'); if(p) p.value=''; },0);
    });
  }

  const lockBtn=$('#lockNowBtn');
  if(lockBtn) lockBtn.addEventListener('click',lock);

  if(!localStorage.getItem(AUTH_KEY)) saveAuth({pin:DEFAULT_PIN,adminName:''});
  else {
    try{
      const existing=readAuth();
      if(existing.pin==='1234'){
        existing.pin='';
        saveAuth(existing);
      }
    }catch{}
  }
  hydrateSettings();
  lock();
})();