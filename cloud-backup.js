(() => {
  const TENANT = window.CGPR_TENANT || {
    keys:{cloud:'claseGraduandaPR_cloud_v1',auth:'claseGraduandaPR_auth_v1',data:'claseGraduandaPR_v1',branding:'claseGraduandaPR_branding_v1'},
    cloudCode:'COLEGEMA-PR',recoveryPin:'0583'
  };
  const CLOUD_KEY = TENANT.keys.cloud;
  const DEFAULT_SUPABASE_URL = 'https://ujrqkwdkytuvfaqnbmzl.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'sb_publishable_9Dm_vf7L3jETvPNCcjr7CA_vqAIReqH';
  const DEFAULT_COLLEGE_CODE = TENANT.cloudCode || 'COLEGEMA-PR';
  const RECOVERY_PIN = TENANT.recoveryPin || '';
  const AUTH_KEY = TENANT.keys.auth;
  const DATA_KEY = TENANT.keys.data;
  const WATCHED_KEYS = new Set([
    TENANT.keys.data,
    TENANT.keys.auth,
    TENANT.keys.branding
  ]);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let autoTimer = null;
  let suppressAuto = false;

  const $ = s => document.querySelector(s);
  const status = msg => {
    const el = $('#cloudStatus');
    if (el) el.textContent = msg;
  };
  const readConfig = () => {
    try { return JSON.parse(localStorage.getItem(CLOUD_KEY) || 'null') || {}; }
    catch { return {}; }
  };
  const writeConfig = cfg => localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg));
  const readAuth = () => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') || {pin:'1234'}; }
    catch { return {pin:'1234'}; }
  };

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
  const normalizeCode = code => String(code || '').trim().toUpperCase().replace(/\s+/g,'-');

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
    return crypto.subtle.importKey('raw', rawBytes, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
  }

  async function encryptBundle(bundle, rawKeyB64) {
    const key = await importAesKey(b64ToBytes(rawKeyB64));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name:'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(bundle))
    );
    return 'v1.' + bytesToB64(iv) + '.' + bytesToB64(new Uint8Array(encrypted));
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

  function getLocalData() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function hasMeaningfulLocalData() {
    const d = getLocalData();
    if (!d) return false;
    const students = Array.isArray(d.students) ? d.students.length : 0;
    const dues = Array.isArray(d.dues) ? d.dues.length : 0;
    const activities = Array.isArray(d.activities) ? d.activities.length : 0;
    const school = String(d.settings?.schoolName || '').trim();
    const className = String(d.settings?.className || '').trim();

    return students > 0 || dues > 0 || activities > 0 ||
      (school && school !== 'Colegio de Puerto Rico') ||
      (className && className !== 'Clase Graduanda 2027' && className !== 'Clase Graduanda');
  }

  function bundleNow() {
    const records = {};
    WATCHED_KEYS.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) records[key] = value;
    });
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      records
    };
  }

  function cloudHeaders(cfg) {
    return {
      'apikey': cfg.anonKey,
      'Authorization': 'Bearer ' + cfg.anonKey,
      'Content-Type': 'application/json'
    };
  }

  function validConfig(cfg) {
    return !!(cfg.url && cfg.anonKey && cfg.collegeId && cfg.rawKey);
  }

  async function rpc(cfg, fn, body) {
    const base = String(cfg.url || '').replace(/\/+$/,'');
    const res = await fetch(base + '/rest/v1/rpc/' + fn, {
      method:'POST',
      headers: cloudHeaders(cfg),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(()=>'');
      throw new Error('Supabase ' + res.status + (text ? ': ' + text.slice(0,180) : ''));
    }
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  async function bootstrapHiddenCloud() {
    const current = readConfig();
    const code = DEFAULT_COLLEGE_CODE;
    if (!RECOVERY_PIN) return current;
    const fixedRawKey = bytesToB64(await deriveRawKey(RECOVERY_PIN, code));
    const cfg = {
      ...current,
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_KEY,
      collegeCode: code,
      collegeId: await collegeId(code),
      rawKey: fixedRawKey,
      autosave: current.autosave !== false,
      autoManaged: true,
      recoveryConfigured: true,
      configuredAt: current.configuredAt || new Date().toISOString()
    };

    const keyChanged = current.rawKey && current.rawKey !== fixedRawKey;
    writeConfig(cfg);

    if (keyChanged && hasMeaningfulLocalData()) {
      setTimeout(() => backupNow(true), 700);
    }

    return cfg;
  }

  async function backupNow(silent=false) {
    const cfg = readConfig();
    if (!validConfig(cfg)) {
      if (!silent) status('Configura la mini nube primero.');
      return false;
    }

    if (!hasMeaningfulLocalData()) {
      if (!silent) status('No se subió nada: no hay datos locales suficientes para crear un respaldo seguro.');
      return false;
    }

    try {
      if (!silent) status('Guardando respaldo cifrado...');
      const payload = await encryptBundle(bundleNow(), cfg.rawKey);
      await rpc(cfg, 'save_graduanda_backup', {
        p_college_id: cfg.collegeId,
        p_payload: payload
      });
      cfg.lastBackup = new Date().toISOString();
      writeConfig(cfg);
      status('Último respaldo: ' + new Date(cfg.lastBackup).toLocaleString());
      return true;
    } catch (err) {
      status('Error de nube: ' + (err?.message || 'No se pudo respaldar'));
      return false;
    }
  }

  async function loadCloudRecord(cfg) {
    const result = await rpc(cfg, 'load_graduanda_backup', { p_college_id: cfg.collegeId });
    if (Array.isArray(result)) return result[0] || null;
    return result || null;
  }

  async function restoreCloud() {
    const cfg = readConfig();
    if (!validConfig(cfg)) return status('Configura la mini nube primero.');
    try {
      status('Buscando respaldo...');
      const row = await loadCloudRecord(cfg);
      if (!row || !row.payload) return status('Todavía no hay respaldo en la nube.');
      const bundle = await decryptBundle(row.payload, cfg.rawKey);
      if (!bundle?.records) throw new Error('Respaldo incompleto');
      if (!confirm('Se restaurará el respaldo de ' + new Date(row.updated_at || bundle.savedAt).toLocaleString() + '. ¿Continuar?')) {
        status('Restauración cancelada.');
        return;
      }
      suppressAuto = true;
      Object.entries(bundle.records).forEach(([key,value]) => localStorage.setItem(key, value));
      cfg.lastRestore = new Date().toISOString();
      writeConfig(cfg);
      status('Restaurado. Reiniciando la app...');
      setTimeout(() => location.reload(), 650);
    } catch (err) {
      status('No se pudo restaurar: verifica código, PIN y conexión.');
    } finally {
      setTimeout(()=>{ suppressAuto=false; },1000);
    }
  }

  async function testCloud() {
    const cfg = readConfig();
    if (!validConfig(cfg)) return status('Guarda primero la configuración de nube.');
    try {
      status('Probando conexión...');
      await loadCloudRecord(cfg);
      status('Conexión con Supabase correcta.');
    } catch (err) {
      status('Falló la conexión: ' + (err?.message || 'revisa Supabase'));
    }
  }

  async function saveCloudConfig() {
    const current = readConfig();
    const url = ($('#cloudSupabaseUrl')?.value || DEFAULT_SUPABASE_URL).trim();
    const anonKey = ($('#cloudAnonKey')?.value || DEFAULT_SUPABASE_KEY).trim();
    const code = DEFAULT_COLLEGE_CODE;
    const autosave = !!$('#cloudAutosave')?.checked;
    const rawKey = bytesToB64(await deriveRawKey(RECOVERY_PIN, code));

    const cfg = {
      ...current,
      url,
      anonKey,
      collegeCode: code,
      collegeId: await collegeId(code),
      rawKey,
      autosave,
      recoveryConfigured: true
    };
    writeConfig(cfg);
    if ($('#cloudPin')) $('#cloudPin').value = '';
    status('Nube sincronizada. Actualizando respaldo...');
    const ok = await backupNow(false);
    if (ok) status('Respaldo listo para restaurar en cualquier computadora.');
  }

  function hydrate() {
    const cfg = readConfig();
    if ($('#cloudSupabaseUrl')) $('#cloudSupabaseUrl').value = cfg.url || DEFAULT_SUPABASE_URL;
    if ($('#cloudAnonKey')) $('#cloudAnonKey').value = cfg.anonKey || DEFAULT_SUPABASE_KEY;
    if ($('#cloudCollegeCode')) $('#cloudCollegeCode').value = DEFAULT_COLLEGE_CODE;
    if ($('#cloudPin')) { $('#cloudPin').value = ''; $('#cloudPin').placeholder = 'PIN de recuperación fijo configurado'; $('#cloudPin').disabled = true; }
    if ($('#cloudAutosave')) $('#cloudAutosave').checked = cfg.autosave !== false;
    if (cfg.lastBackup) status('Último respaldo: ' + new Date(cfg.lastBackup).toLocaleString());
    else if (validConfig(cfg)) status('Nube configurada. Aún no hay respaldo registrado.');
  }

  function scheduleAutoBackup() {
    const cfg = readConfig();
    if (suppressAuto || cfg.autosave === false || !validConfig(cfg)) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => backupNow(true), 1400);
  }

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    const result = originalSetItem.call(this, key, value);
    if (this === localStorage && WATCHED_KEYS.has(String(key))) scheduleAutoBackup();
    return result;
  };

  $('#cloudSaveConfig')?.addEventListener('click', () => saveCloudConfig().catch(err => status('Error: ' + err.message)));
  $('#cloudBackupNow')?.addEventListener('click', () => backupNow(false));
  $('#cloudRestore')?.addEventListener('click', restoreCloud);
  $('#cloudTest')?.addEventListener('click', testCloud);
  $('#cloudAutosave')?.addEventListener('change', () => {
    const cfg = readConfig();
    cfg.autosave = !!$('#cloudAutosave').checked;
    writeConfig(cfg);
    status(cfg.autosave ? 'Respaldo automático activado.' : 'Respaldo automático pausado.');
  });

  function hideCloudPanel() {
    const panel = $('#cloudAdminPanel');
    if (panel) panel.hidden = true;
  }

  $('#cloudHidePanel')?.addEventListener('click', hideCloudPanel);

  bootstrapHiddenCloud().then(() => {
    hydrate();
  }).catch(() => {});

  setTimeout(async () => {
    const cfg = readConfig();
    if (!validConfig(cfg)) return;
    try {
      const row = await loadCloudRecord(cfg);
      if (!row?.updated_at) return;
      const cloudTime = new Date(row.updated_at).getTime();
      const localTime = cfg.lastBackup ? new Date(cfg.lastBackup).getTime() : 0;
      if (cloudTime > localTime + 1500) {
        status('Hay un respaldo en nube más reciente: ' + new Date(row.updated_at).toLocaleString());
      }
    } catch {}
  }, 2200);
})();
