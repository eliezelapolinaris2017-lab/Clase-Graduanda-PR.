(() => {
  const host = String(location.hostname || '').toLowerCase();
  const params = new URLSearchParams(location.search);
  const requested = String(params.get('tenant') || '').trim().toLowerCase();

  const hostSlug = host && host !== 'localhost'
    ? host.split('.')[0].replace(/[^a-z0-9-]/g,'')
    : '';

  const registry = {
    colegema: {
      id: 'colegema',
      slug: 'colegema',
      schoolName: 'Colegio Santa Gema',
      className: 'Clase Senior 2030',
      cloudCode: 'COLEGEMA-PR',
      recoveryPin: '0583',
      defaultPin: '1234'
    },
    santacruz: {
      id: 'santacruz',
      slug: 'santacruz',
      schoolName: 'Colegio Santa Cruz',
      className: 'Clase Monarca 2030',
      cloudCode: 'SANTACRUZ-PR',
      recoveryPin: '6417',
      defaultPin: '2468'
    }
  };

  const tenantId = requested || hostSlug || 'colegema';
  const base = registry[tenantId] || {
    id: tenantId,
    slug: tenantId,
    schoolName: 'Clase Graduanda PR',
    className: 'Clase Graduanda',
    cloudCode: ('CGPR-' + tenantId).toUpperCase(),
    recoveryPin: '',
    defaultPin: '1234'
  };

  const prefix = 'claseGraduandaPR_' + base.id;
  const keys = {
    data: prefix + '_data_v1',
    auth: prefix + '_auth_v1',
    branding: prefix + '_branding_v1',
    cloud: prefix + '_cloud_v1'
  };

  const legacy = {
    data: 'claseGraduandaPR_v1',
    auth: 'claseGraduandaPR_auth_v1',
    branding: 'claseGraduandaPR_branding_v1',
    cloud: 'claseGraduandaPR_cloud_v1'
  };

  // Migración segura para el colegio actual. Copia; no elimina los datos viejos.
  if (base.id === 'colegema') {
    Object.keys(keys).forEach(name => {
      if (!localStorage.getItem(keys[name]) && localStorage.getItem(legacy[name])) {
        localStorage.setItem(keys[name], localStorage.getItem(legacy[name]));
      }
    });
  }

  window.CGPR_TENANT = Object.freeze({
    ...base,
    keys,
    legacyKeys: legacy,
    storagePrefix: prefix
  });

  document.documentElement.dataset.tenant = base.id;
  document.title = base.schoolName + ' — ' + base.className;

  document.addEventListener('DOMContentLoaded', () => {
    const code = document.querySelector('#recoveryCollegeCode');
    if (code) {
      code.value = base.cloudCode;
      code.readOnly = true;
    }
  });
})();