(() => {
  const DEFAULT_SUPABASE_URL = 'https://ujrqkwdkytuvfaqnbmzl.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'sb_publishable_9Dm_vf7L3jETvPNCcjr7CA_vqAIReqH';
  const PROFILE_KEY = 'claseGraduandaPR_tenant_profiles_v1';
  const ACTIVE_KEY = 'claseGraduandaPR_active_tenant';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const $ = s => document.querySelector(s);
  const setStatus = msg => {
    const el = $('#cloudRecoveryStatus');
    if (el) el.textContent = msg;
  };
  const normalizeCode = code => String(code || '').trim().toUpperCase().replace(/\s+/g,'-');
  const bytesToB64 = bytes => {
    let s = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  };
  const b64ToBytes = value => {
    const s = atob(value);
    return Uint8Array.from(s, c => c.charCodeAt(0));
  };
  const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2,'0')).join('');

  async function sha256(value) {
    return crypto.subtle.digest('SHA-256', encoder.encode(value));
  }

  async function collegeId(code) {
    return hex(await sha256('nexus-clase-graduanda:' + normalizeCode(code)));
  }

  async function deriveRawKey(pin, code) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(String(pin)),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const salt = new Uint8Array(await sha256('cgpr-salt:' + normalizeCode(code)));
    const key = await crypto.subtle.deriveKey(
      { name:'PBKDF2', salt, iterations:180000, hash:'SHA-256' },
      baseKey,
      { name:'AES-GCM', length:256 },
      true,
      ['encrypt','decrypt']
    );
    return new Uint8Array(await crypto.subtle.exportKey('raw', key));
  }

  async function importAesKey(rawBytes) {
    return crypto.subtle.importKey('raw', rawBytes, {name:'AES-GCM'}, false, ['decrypt']);
  }

  async function decryptBundle(payload, rawKeyB64) {
    const parts = String(payload || '').split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Formato de respaldo no válido');
    const key = await importAesKey(b64ToBytes(rawKeyB64));
    const decrypted = await crypto.subtle.decrypt(
      { name:'AES-GCM', iv:b64ToBytes(parts[1]) },
      key,
      b64ToBytes(parts[2])
    );
    return JSON.parse(decoder.decode(decrypted));
  }

  async function loadCloudRecord(collegeIdValue) {
    const res = await fetch(DEFAULT_SUPABASE_URL + '/rest/v1/rpc/load_graduanda_backup', {
      method:'POST',
      headers:{
        'apikey': DEFAULT_SUPABASE_KEY,
        'Authorization':'Bearer ' + DEFAULT_SUPABASE_KEY,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({ p_college_id: collegeIdValue })
    });
    if (!res.ok) throw new Error('No se pudo conectar con la nube');
    const result = await res.json();
    return Array.isArray(result) ? result[0] || null : result;
  }

  function inferTenantId(records) {
    const keys = Object.keys(records || {});
    for (const key of keys) {
      const m = key.match(/^claseGraduandaPR_(.+)_data_v1$/);
      if (m?.[1]) return m[1];
    }
    return '';
  }

  function readJson(value) {
    try { return JSON.parse(value || 'null'); } catch { return null; }
  }

  async function restoreFromCloud() {
    const code = normalizeCode($('#recoveryCollegeCode')?.value || '');
    const pin = ($('#recoveryCloudPin')?.value || '').trim();

    if (!code) return setStatus('Escribe el código del colegio.');
    if (!/^\d{4,6}$/.test(pin)) return setStatus('Escribe el PIN de recuperación de 4 a 6 dígitos.');

    try {
      setStatus('Buscando respaldo...');
      const id = await collegeId(code);
      const row = await loadCloudRecord(id);
      if (!row?.payload) return setStatus('No se encontró un respaldo para ese código.');

      setStatus('Verificando código y PIN...');
      const rawKeyBytes = await deriveRawKey(pin, code);
      const rawKey = bytesToB64(rawKeyBytes);

      let bundle;
      try {
        bundle = await decryptBundle(row.payload, rawKey);
      } catch {
        return setStatus('Código del colegio o PIN de recuperación incorrecto.');
      }

      if (!bundle?.records) return setStatus('El respaldo está incompleto.');

      const tenantId = inferTenantId(bundle.records);
      if (!tenantId) return setStatus('No se pudo identificar el colegio dentro del respaldo.');

      Object.entries(bundle.records).forEach(([key,value]) => {
        localStorage.setItem(key, value);
      });

      const dataKey = 'claseGraduandaPR_' + tenantId + '_data_v1';
      const authKey = 'claseGraduandaPR_' + tenantId + '_auth_v1';
      const cloudKey = 'claseGraduandaPR_' + tenantId + '_cloud_v1';
      const restoredData = readJson(bundle.records[dataKey]) || {};
      const restoredAuth = readJson(bundle.records[authKey]) || {};

      const profiles = readJson(localStorage.getItem(PROFILE_KEY)) || {};
      profiles[tenantId] = {
        id: tenantId,
        slug: tenantId,
        schoolName: restoredData.settings?.schoolName || 'Clase Graduanda PR',
        className: restoredData.settings?.className || 'Clase Graduanda',
        cloudCode: code,
        recoveryPin: pin,
        defaultPin: restoredAuth.pin || '1234'
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
      localStorage.setItem(ACTIVE_KEY, tenantId);

      localStorage.setItem(cloudKey, JSON.stringify({
        url: DEFAULT_SUPABASE_URL,
        anonKey: DEFAULT_SUPABASE_KEY,
        collegeCode: code,
        collegeId: id,
        rawKey,
        autosave: true,
        autoManaged: true,
        recoveryConfigured: true,
        lastRestore: new Date().toISOString(),
        lastBackup: row.updated_at || bundle.savedAt || null
      }));

      setStatus('Restauración completada. Abriendo el colegio...');
      setTimeout(() => {
        const url = new URL(location.href);
        url.search = '';
        url.hash = '';
        location.href = url.origin + url.pathname;
      }, 900);
    } catch (err) {
      setStatus('No se pudo restaurar. Verifica la conexión e inténtalo nuevamente.');
    }
  }

  $('#openCloudRecovery')?.addEventListener('click', () => {
    const box = $('#cloudRecoveryBox');
    if (!box) return;
    box.hidden = false;
    $('#pinLoginForm')?.setAttribute('hidden','');
    $('#openCloudRecovery')?.setAttribute('hidden','');
    const code = $('#recoveryCollegeCode');
    if (code) {
      code.readOnly = false;
      code.value = '';
      code.focus();
    }
  });

  $('#cancelCloudRecovery')?.addEventListener('click', () => {
    const box = $('#cloudRecoveryBox');
    if (box) box.hidden = true;
    $('#pinLoginForm')?.removeAttribute('hidden');
    $('#openCloudRecovery')?.removeAttribute('hidden');
    setStatus('');
  });

  $('#runCloudRecovery')?.addEventListener('click', restoreFromCloud);
})();