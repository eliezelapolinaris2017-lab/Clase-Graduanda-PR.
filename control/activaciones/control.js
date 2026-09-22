(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const ENDPOINT='https://ujrqkwdkytuvfaqnbmzl.supabase.co/functions/v1/control-activations';
  const SESSION_KEY='cgpr_control_session_v1';
  let items=[],lastCode='',lastOrg='',lastRecovery='';

  const readSession=()=>{try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  const saveSession=s=>sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));
  const clearSession=()=>sessionStorage.removeItem(SESSION_KEY);

  async function api(action,data={},auth=true){
    const session=readSession();
    const headers={'Content-Type':'application/json'};
    if(auth && session?.token) headers.Authorization='Bearer '+session.token;
    const res=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({action,...data})});
    let body={};try{body=await res.json()}catch{}
    if(res.status===401&&auth){clearSession();showLogin();throw new Error(body.error||'Sesión expirada.');}
    if(!res.ok||!body.ok) throw new Error(body.error||'No se pudo completar la operación.');
    return body;
  }

  function showLogin(){$('#loginView').hidden=false;$('#panelView').hidden=true;setTimeout(()=>$('#adminPassword').focus(),50)}
  async function showPanel(){
    $('#loginView').hidden=true;$('#panelView').hidden=false;
    await loadItems();
    try{
      const recovery=await api('recovery_status');
      if(!recovery.configured){
        setTimeout(()=>{ if(confirm('Aún no tienes un código maestro de recuperación. ¿Generarlo ahora?')) generateRecovery(); },250);
      }
    }catch{}
  }

  $('#forgotPasswordBtn').onclick=()=>{
    $('#forgotForm').reset();
    $('#forgotStatus').textContent='';
    $('#forgotModal').hidden=false;
    setTimeout(()=>$('#forgotRecoveryCode').focus(),50);
  };

  $('#forgotForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const status=$('#forgotStatus'),next=$('#forgotNewPassword').value;
    if(next!==$('#forgotConfirmPassword').value){status.textContent='Las contraseñas nuevas no coinciden.';return}
    status.textContent='Restableciendo acceso…';
    const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      const out=await api('recover_password',{
        recoveryCode:$('#forgotRecoveryCode').value,
        newPassword:next
      },false);
      $('#forgotModal').hidden=true;
      lastRecovery=out.newRecoveryCode;
      showRecoveryCode(out.newRecoveryCode,'Contraseña restablecida. Este es tu NUEVO código de recuperación; el anterior ya no funciona.');
      clearSession();
      $('#loginStatus').textContent='Contraseña restablecida. Ya puedes iniciar sesión con la nueva.';
    }catch(err){status.textContent=err.message}
    finally{btn.disabled=false}
  });

  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const status=$('#loginStatus'),btn=e.currentTarget.querySelector('button');
    status.textContent='Verificando…';btn.disabled=true;
    try{const out=await api('login',{password:$('#adminPassword').value},false);saveSession({token:out.token,expiresAt:out.expiresAt});$('#adminPassword').value='';status.textContent='';await showPanel();}
    catch(err){status.textContent=err.message}finally{btn.disabled=false}
  });

  async function loadItems(){
    const list=$('#activationList');list.innerHTML='<div class="empty">Cargando activaciones…</div>';
    try{const out=await api('list');items=out.items||[];render()}
    catch(err){list.innerHTML='<div class="empty">'+esc(err.message)+'</div>'}
  }

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>v?new Date(v).toLocaleString('es-PR',{dateStyle:'medium',timeStyle:'short'}):'—';
  const statusOf=x=>{
    if(x.used_at)return ['Activado','used'];
    if(x.revoked_at||!x.active)return ['Desactivado','revoked'];
    if(x.expires_at&&new Date(x.expires_at).getTime()<Date.now())return ['Expirado','expired'];
    return ['Disponible','available'];
  };

  function render(){
    const q=$('#searchInput').value.trim().toLowerCase();
    const filtered=items.filter(x=>[x.organization_name,x.responsible_name,x.email,x.purchase_ref,x.used_tenant_id].some(v=>String(v||'').toLowerCase().includes(q)));
    $('#statTotal').textContent=items.length;
    $('#statAvailable').textContent=items.filter(x=>statusOf(x)[1]==='available').length;
    $('#statUsed').textContent=items.filter(x=>x.used_at).length;
    $('#statRevoked').textContent=items.filter(x=>statusOf(x)[1]==='revoked').length;
    $('#emptyState').hidden=filtered.length!==0;
    $('#activationList').innerHTML=filtered.map(x=>{
      const [label,cls]=statusOf(x);
      return `<article class="activation">
        <div class="activation-top">
          <div><h3>${esc(x.organization_name||'Sin nombre')}</h3><div class="meta"><span>${esc(x.responsible_name||'')}</span><span>·</span><span>${esc(x.email||'')}</span>${x.code_last4?`<span>· Código ••••${esc(x.code_last4)}</span>`:''}</div></div>
          <span class="status-pill ${cls}">${label}</span>
        </div>
        <div class="activation-grid">
          <div><small>Compra</small><strong>${esc(x.purchase_method||'—')}</strong></div>
          <div><small>Referencia</small><strong>${esc(x.purchase_ref||'—')}</strong></div>
          <div><small>Creado</small><strong>${date(x.created_at)}</strong></div>
          <div><small>Tenant activado</small><strong>${esc(x.used_tenant_id||'—')}</strong></div>
        </div>
        ${x.notes?`<div class="activation-grid"><div style="grid-column:1/-1"><small>Notas</small><strong>${esc(x.notes)}</strong></div></div>`:''}
        <div class="activation-actions">
          ${!x.used_at?`<button class="ghost" data-action="regenerate" data-id="${x.id}">Regenerar código</button>`:''}
          ${!x.used_at&&x.active&&!x.revoked_at?`<button class="ghost" data-action="revoke" data-id="${x.id}">Desactivar</button>`:''}
        </div>
      </article>`;
    }).join('');
    $$('[data-action="regenerate"]').forEach(b=>b.onclick=()=>regenerate(b.dataset.id));
    $$('[data-action="revoke"]').forEach(b=>b.onclick=()=>revoke(b.dataset.id));
  }

  $('#searchInput').addEventListener('input',render);
  $('#refreshBtn').onclick=loadItems;
  $('#newActivationBtn').onclick=()=>{$('#activationForm').reset();$('#activationStatus').textContent='';$('#activationModal').hidden=false};
  $$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).hidden=true);

  $('#activationForm').addEventListener('submit',async e=>{
    e.preventDefault();const status=$('#activationStatus');status.textContent='Generando activación…';
    try{
      const expires=$('#expiresAt').value;
      const out=await api('create',{
        organizationName:$('#organizationName').value,
        responsibleName:$('#responsibleName').value,
        email:$('#buyerEmail').value,
        phone:$('#buyerPhone').value,
        purchaseMethod:$('#purchaseMethod').value,
        purchaseRef:$('#purchaseRef').value,
        notes:$('#notes').value,
        expiresAt:expires?new Date(expires+'T23:59:59').toISOString():null
      });
      lastCode=out.code;lastOrg=$('#organizationName').value.trim();
      $('#activationModal').hidden=true;showCode(out.code);await loadItems();
    }catch(err){status.textContent=err.message}
  });

  function showCode(code){$('#generatedCode').textContent=code;$('#copyStatus').textContent='';$('#codeModal').hidden=false}
  $('#copyCodeBtn').onclick=async()=>{try{await navigator.clipboard.writeText(lastCode);$('#copyStatus').textContent='Código copiado.'}catch{$('#copyStatus').textContent='No se pudo copiar automáticamente.'}};
  $('#copyMessageBtn').onclick=async()=>{
    const msg=`Bienvenido a Clase Graduanda PR 🎓\n\nSu código de activación para ${lastOrg||'su clase'} es:\n\n${lastCode}\n\nIngrese a https://clasegraduandapr.com/acceso/ y seleccione “Entrar al sistema” para comenzar la configuración.\n\nEste código permite crear una sola clase y se invalidará al completar la activación.`;
    try{await navigator.clipboard.writeText(msg);$('#copyStatus').textContent='Mensaje para WhatsApp copiado.'}catch{$('#copyStatus').textContent='No se pudo copiar automáticamente.'}
  };

  async function regenerate(id){
    if(!confirm('El código anterior dejará de funcionar. ¿Generar uno nuevo?'))return;
    try{const item=items.find(x=>x.id===id);const out=await api('regenerate',{id});lastCode=out.code;lastOrg=item?.organization_name||'';showCode(out.code);await loadItems()}catch(err){alert(err.message)}
  }
  async function revoke(id){
    if(!confirm('¿Desactivar esta activación? El código dejará de funcionar.'))return;
    try{await api('revoke',{id});await loadItems()}catch(err){alert(err.message)}
  }

  async function generateRecovery(){
    if(!confirm('Generar un código nuevo invalidará cualquier código de recuperación anterior. ¿Continuar?')) return;
    try{
      const out=await api('generate_recovery');
      lastRecovery=out.recoveryCode;
      showRecoveryCode(out.recoveryCode,'Guárdalo en un lugar seguro. Solo se mostrará completo ahora.');
    }catch(err){alert(err.message)}
  }
  function showRecoveryCode(code,message=''){
    $('#recoveryCodeValue').textContent=code;
    $('#recoveryCodeStatus').textContent=message;
    $('#recoveryCodeModal').hidden=false;
  }
  $('#recoveryCodeBtn').onclick=generateRecovery;
  $('#copyRecoveryBtn').onclick=async()=>{
    try{await navigator.clipboard.writeText(lastRecovery);$('#recoveryCodeStatus').textContent='Código de recuperación copiado.'}
    catch{$('#recoveryCodeStatus').textContent='No se pudo copiar automáticamente.'}
  };

  $('#logoutBtn').onclick=async()=>{try{await api('logout')}catch{}clearSession();showLogin()};
  $('#changePasswordBtn').onclick=()=>{$('#passwordForm').reset();$('#passwordStatus').textContent='';$('#passwordModal').hidden=false};
  $('#passwordForm').addEventListener('submit',async e=>{
    e.preventDefault();const status=$('#passwordStatus'),next=$('#newPassword').value;
    if(next!==$('#confirmPassword').value){status.textContent='Las contraseñas nuevas no coinciden.';return}
    status.textContent='Actualizando contraseña…';
    try{await api('change_password',{currentPassword:$('#currentPassword').value,newPassword:next});clearSession();$('#passwordModal').hidden=true;showLogin();$('#loginStatus').textContent='Contraseña cambiada. Inicia sesión nuevamente.'}
    catch(err){status.textContent=err.message}
  });

  (async()=>{const s=readSession();if(!s?.token||!s.expiresAt||new Date(s.expiresAt).getTime()<=Date.now()){clearSession();showLogin();return}try{await api('session');await showPanel()}catch{showLogin()}})();
})();