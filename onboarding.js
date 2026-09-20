(() => {
  const $ = s => document.querySelector(s);
  const PROFILE_KEY = 'claseGraduandaPR_tenant_profiles_v1';
  const ACTIVE_KEY = 'claseGraduandaPR_active_tenant';
  const SUCCESS_KEY = 'claseGraduandaPR_onboarding_success_v1';
  const PENDING_CLOUD_KEY = 'claseGraduandaPR_pending_cloud_provision';
  let step = 1;
  let logoData = '';

  const slugify = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/^(colegio|escuela|academia|instituto)\s+/,'')
    .replace(/[^a-z0-9]+/g,'').slice(0,32) || 'clase';

  const cloudCodeFor = school => (slugify(school).toUpperCase() + '-PR');

  const readProfiles = () => {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {}; }
    catch { return {}; }
  };

  const fullClassName = () => {
    const name = ($('#obClass')?.value || '').trim();
    const year = ($('#obYear')?.value || '').trim();
    if (!year) return name;
    if (name.includes(year)) return name;
    return (name + ' ' + year).trim();
  };

  function showStep(n){
    step = Math.max(1, Math.min(5, n));
    document.querySelectorAll('.onboarding-step').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.step) === step);
    });
    document.querySelectorAll('.onboarding-progress span').forEach((el,i) => {
      el.classList.toggle('active', i < step);
    });
    const back = $('#onboardingBack');
    const next = $('#onboardingNext');
    const create = $('#onboardingCreate');
    if (back) back.hidden = step === 1;
    if (next) next.hidden = step === 5;
    if (create) create.hidden = step !== 5;
    if (step === 5) renderSummary();
    if ($('#onboardingStatus')) $('#onboardingStatus').textContent = '';
  }

  function validateStep(){
    const status = $('#onboardingStatus');
    const fail = msg => { if(status) status.textContent = msg; return false; };
    if(step === 1){
      if(!($('#obSchool')?.value || '').trim()) return fail('Escribe el nombre del colegio.');
      if(!($('#obClass')?.value || '').trim()) return fail('Escribe el nombre de la clase.');
      const y = Number($('#obYear')?.value || 0);
      if(!y || y < 2026 || y > 2100) return fail('Indica un año de graduación válido.');
    }
    if(step === 2){
      const pin = ($('#obPin')?.value || '').trim();
      const recovery = ($('#obRecoveryPin')?.value || '').trim();
      if(!/^\d{4}$/.test(pin)) return fail('El PIN principal debe tener exactamente 4 dígitos.');
      if(!/^\d{4,6}$/.test(recovery)) return fail('El PIN de recuperación debe tener de 4 a 6 dígitos.');
    }
    return true;
  }

  function renderSummary(){
    const school = ($('#obSchool')?.value || '').trim();
    const className = fullClassName();
    const year = ($('#obYear')?.value || '').trim();
    const code = cloudCodeFor(school);
    const backup = document.querySelector('input[name="obBackup"]:checked')?.value === 'cloud' ? 'En la nube (opcional)' : 'Solo en este dispositivo';
    const summary = $('#onboardingSummary');
    if(!summary) return;
    const rows = [
      ['Colegio', school],
      ['Clase', className],
      ['Año de graduación', year],
      ['Código interno', code],
      ['PIN principal', '••••'],
      ['PIN de recuperación', '••••'],
      ['Diseño', logoData ? 'Personalizado con logo' : 'Colores personalizados'],
      ['Respaldo', backup]
    ];
    summary.innerHTML = rows.map(([a,b]) => '<div class="onboarding-summary-row"><span>'+a+'</span><strong>'+b+'</strong></div>').join('');
  }

  async function fileToDataUrl(file){
    if(!file) return '';
    if(file.size > 1600000) throw new Error('El logo es muy grande. Usa una imagen menor de 1.6 MB.');
    return await new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function createClass(){
    const status = $('#onboardingStatus');
    if(!validateStep()) return;
    try{
      if(status) status.textContent = 'Creando tu clase...';
      const school = ($('#obSchool')?.value || '').trim();
      const className = fullClassName();
      const id = slugify(school);
      const cloudCode = cloudCodeFor(school);
      const pin = ($('#obPin')?.value || '').trim();
      const recoveryPin = ($('#obRecoveryPin')?.value || '').trim();
      const cloud = document.querySelector('input[name="obBackup"]:checked')?.value === 'cloud';
      const color1 = $('#obColor1')?.value || '#102d46';
      const color2 = $('#obColor2')?.value || '#1c5277';

      const profiles = readProfiles();
      profiles[id] = {
        id,
        slug:id,
        schoolName:school,
        className,
        cloudCode,
        recoveryPin: cloud ? recoveryPin : '',
        defaultPin:pin
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));

      const prefix = 'claseGraduandaPR_' + id;
      localStorage.setItem(prefix + '_data_v1', JSON.stringify({
        settings:{schoolName:school,className},
        students:[], dues:[], activities:[]
      }));
      localStorage.setItem(prefix + '_auth_v1', JSON.stringify({pin,adminName:''}));
      localStorage.setItem(prefix + '_branding_v1', JSON.stringify({
        color1,color2,logo:logoData || ''
      }));

      localStorage.setItem(ACTIVE_KEY,id);
      if(cloud) localStorage.setItem(PENDING_CLOUD_KEY,id);
      else localStorage.removeItem(PENDING_CLOUD_KEY);

      localStorage.setItem(SUCCESS_KEY, JSON.stringify({school,className,cloudCode,cloud}));
      if(status) status.textContent = cloud ? 'Configurando tu clase y preparando el respaldo...' : 'Tu clase está lista.';
      setTimeout(() => location.reload(), 450);
    }catch(err){
      if(status) status.textContent = err?.message || 'No se pudo crear la clase.';
    }
  }

  function showSuccess(data){
    const success = $('#onboardingSuccess');
    const code = $('#onboardingSuccessCode');
    if(!success) return;
    document.body.classList.add('onboarding-open');
    success.hidden = false;
    const cloudText = data.cloud ? ' · Nube activada' : '';
    if(code) code.textContent = data.cloudCode + ' · ' + data.className + cloudText;
  }

  document.addEventListener('DOMContentLoaded', () => {
    let successData = null;
    try { successData = JSON.parse(localStorage.getItem(SUCCESS_KEY) || 'null'); } catch {}
    if(successData){
      localStorage.removeItem(SUCCESS_KEY);
      showSuccess(successData);
      return;
    }

    const needsOnboarding = Boolean(window.CGPR_TENANT?.needsOnboarding);
    const onboarding = $('#onboarding');
    if(needsOnboarding && onboarding){
      document.body.classList.add('onboarding-open');
      onboarding.hidden = false;
      showStep(1);
    }

    $('#onboardingNext')?.addEventListener('click', () => {
      if(validateStep()) showStep(step + 1);
    });
    $('#onboardingBack')?.addEventListener('click', () => showStep(step - 1));
    $('#onboardingCreate')?.addEventListener('click', createClass);

    $('#onboardingClose')?.addEventListener('click', () => {
      const box = $('#onboarding');
      if(box) box.hidden = true;
      document.body.classList.remove('onboarding-open');
    });

    $('#onboardingEnter')?.addEventListener('click', () => {
      const box = $('#onboardingSuccess');
      if(box) box.hidden = true;
      document.body.classList.remove('onboarding-open');
      location.reload();
    });

    $('#obLogo')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      try{
        logoData = await fileToDataUrl(file);
        const label = document.querySelector('.onboarding-upload span');
        if(label && file) label.innerHTML = '✓ ' + file.name + '<br><small>Logo preparado</small>';
      }catch(err){
        logoData = '';
        if($('#onboardingStatus')) $('#onboardingStatus').textContent = err.message;
      }
    });

    document.querySelectorAll('input[name="obBackup"]').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('.backup-choice').forEach(x => x.classList.remove('selected'));
        r.closest('.backup-choice')?.classList.add('selected');
      });
    });
  });
})();