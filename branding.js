(() => {
  const BRAND_KEY = 'claseGraduandaPR_branding_v1';
  const defaults = { color1:'#102d46', color2:'#1c5277', logo:'' };

  const readBrand = () => {
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(BRAND_KEY) || '{}')) }; }
    catch { return { ...defaults }; }
  };

  const applyBrand = brand => {
    document.documentElement.style.setProperty('--header1', brand.color1 || defaults.color1);
    document.documentElement.style.setProperty('--header2', brand.color2 || defaults.color2);

    const wrap = document.querySelector('#headerLogoWrap');
    const img = document.querySelector('#headerLogo');
    if (brand.logo) {
      img.src = brand.logo;
      wrap.hidden = false;
    } else {
      img.removeAttribute('src');
      wrap.hidden = true;
    }

    const c1 = document.querySelector('#headerColor1');
    const c2 = document.querySelector('#headerColor2');
    if (c1) c1.value = brand.color1 || defaults.color1;
    if (c2) c2.value = brand.color2 || defaults.color2;
  };

  let brand = readBrand();
  applyBrand(brand);

  const logoInput = document.querySelector('#headerLogoFile');
  if (logoInput) {
    logoInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        toast('Selecciona un archivo JPG, PNG o WEBP');
        e.target.value = '';
        return;
      }
      if (file.size > 1500000) {
        toast('El logo es muy grande. Usa una imagen menor de 1.5 MB');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        brand.logo = String(reader.result || '');
        applyBrand(brand);
        toast('Logo listo. Presiona Guardar diseño');
      };
      reader.readAsDataURL(file);
    });
  }

  document.querySelector('#saveBrandingBtn')?.addEventListener('click', () => {
    brand.color1 = document.querySelector('#headerColor1')?.value || defaults.color1;
    brand.color2 = document.querySelector('#headerColor2')?.value || defaults.color2;
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
      applyBrand(brand);
      toast('Diseño del header guardado');
    } catch {
      toast('No se pudo guardar el logo. Intenta con una imagen más pequeña');
    }
  });

  document.querySelector('#removeLogoBtn')?.addEventListener('click', () => {
    brand.logo = '';
    localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
    if (logoInput) logoInput.value = '';
    applyBrand(brand);
    toast('Logo eliminado');
  });

  document.querySelector('#resetHeaderBtn')?.addEventListener('click', () => {
    brand.color1 = defaults.color1;
    brand.color2 = defaults.color2;
    localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
    applyBrand(brand);
    toast('Colores originales restaurados');
  });

  document.querySelector('#headerColor1')?.addEventListener('input', e => {
    document.documentElement.style.setProperty('--header1', e.target.value);
  });
  document.querySelector('#headerColor2')?.addEventListener('input', e => {
    document.documentElement.style.setProperty('--header2', e.target.value);
  });
})();