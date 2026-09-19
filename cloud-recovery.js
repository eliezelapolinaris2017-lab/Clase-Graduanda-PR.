(() => {
  const TENANT = window.CGPR_TENANT || {
    keys:{cloud:'claseGraduandaPR_cloud_v1'},
    cloudCode:'COLEGEMA-PR',recoveryPin:'0583'
  };
  const CLOUD_KEY = TENANT.keys.cloud;
  const DEFAULT_SUPABASE_URL = 'https://ujrqkwdkytuvfaqnbmzl.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'sb_publishable_9Dm_vf7L3jETvPNCcjr7CA_vqAIReqH';
  const RECOVERY_PIN = TENANT.recoveryPin || '';
  const DEFAULT_COLLEGE_CODE = TENANT.cloudCode || 'COLEGEMA-PR';
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

  async function restoreFromCloud() {
    const code = DEFAULT_COLLEGE_CODE;
    const pin = ($('#recoveryCloudPin')?.value || '').trim();

    if (!RECOVERY_PIN) return setStatus('Este colegio todavía no tiene PIN de recuperación configurado.');
    if (pin !== RECOVERY_PIN) return setStatus('PIN de recuperación incorrecto.');

    try {
      setStatus('Buscando respaldo...');
      const id = await collegeId(code);
      const rawKey = bytesToB64(await deriveRawKey(RECOVERY_PIN, code));
      const row = await loadCloudRecord(id);

      if (!row?.payload) return setStatus('No se encontró un respaldo para ese código.');

      setStatus('Descifrando respaldo...');
      const bundle = await decryptBundle(row.payload, rawKey);
      if (!bundle?.records) throw new Error('Respaldo incompleto');

      Object.entries(bundle.records).forEach(([key,value]) => {
        localStorage.setItem(key, value);
      });

      localStorage.setItem(CLOUD_KEY, JSON.stringify({
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

      setStatus('Restauración completada. Reiniciando...');
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      setStatus('No se pudo restaurar. El respaldo todavía no está migrado o la conexión falló.');
    }
  }

  $('#openCloudRecovery')?.addEventListener('click', () => {
    const box = $('#cloudRecoveryBox');
    if (!box) return;
    box.hidden = false;
    $('#pinLoginForm')?.setAttribute('hidden','');
    $('#openCloudRecovery')?.setAttribute('hidden','');
    $('#recoveryCloudPin')?.focus();
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