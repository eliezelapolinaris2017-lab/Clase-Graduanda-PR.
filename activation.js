(() => {
  const $=s=>document.querySelector(s);
  const ENDPOINT='https://ujrqkwdkytuvfaqnbmzl.supabase.co/functions/v1/purchase-activation';
  const KEY='claseGraduandaPR_purchase_activation_v1';

  function read(){
    try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}
  }
  function validSession(){
    const s=read();
    return !!(s?.ticket && s?.expiresAt && new Date(s.expiresAt).getTime()>Date.now());
  }
  function showActivation(){
    const box=$('#purchaseActivation');
    if(!box) return;
    document.body.classList.add('activation-open');
    box.hidden=false;
    setTimeout(()=>$('#purchaseCode')?.focus(),50);
  }
  function hideActivation(){
    const box=$('#purchaseActivation');
    if(box) box.hidden=true;
    document.body.classList.remove('activation-open');
  }
  async function api(body){
    const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    let out={}; try{out=await res.json();}catch{}
    if(!res.ok||!out.ok) throw new Error(out.error||'No se pudo validar el código.');
    return out;
  }

  window.CGPR_PURCHASE_ACTIVATION={
    hasValidSession:validSession,
    async consume(tenantId){
      const s=read();
      if(!s?.ticket) throw new Error('Falta la activación de compra.');
      const out=await api({action:'consume',ticket:s.ticket,tenantId});
      localStorage.removeItem(KEY);
      return out;
    }
  };

  document.addEventListener('DOMContentLoaded',()=>{
    const needs=Boolean(window.CGPR_TENANT?.needsOnboarding);
    if(!needs) return;

    if(validSession()){
      hideActivation();
      return;
    }

    showActivation();

    $('#purchaseActivationForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const input=$('#purchaseCode');
      const btn=e.currentTarget.querySelector('button[type="submit"]');
      const status=$('#purchaseActivationStatus');
      const code=(input?.value||'').trim().toUpperCase();
      if(!/^CGPR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)){
        status.textContent='Verifica el código de compra.';
        return;
      }
      input.disabled=true; btn.disabled=true; status.textContent='Validando compra...';
      try{
        const out=await api({action:'validate',code});
        localStorage.setItem(KEY,JSON.stringify({ticket:out.ticket,expiresAt:out.expiresAt}));
        status.textContent='Código válido. Abriendo configuración...';
        setTimeout(()=>location.reload(),350);
      }catch(err){
        status.textContent=err?.message||'Código inválido.';
      }finally{
        input.disabled=false; btn.disabled=false;
      }
    });

    $('#activationRecovery')?.addEventListener('click',()=>{
      hideActivation();
      const pin=$('#pinLock');
      if(pin) pin.classList.remove('unlocked');
      $('#cloudRecoveryBox')?.removeAttribute('hidden');
      $('#pinLoginForm')?.setAttribute('hidden','');
      $('#openCloudRecovery')?.setAttribute('hidden','');
      const code=$('#recoveryCollegeCode');
      if(code){code.value='';code.readOnly=false;setTimeout(()=>code.focus(),50);}
    });
  });
})();