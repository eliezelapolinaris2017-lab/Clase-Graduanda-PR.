(() => {
  const TENANT = window.CGPR_TENANT || {keys:{branding:'claseGraduandaPR_branding_v1'}};
  const BRAND_KEY = TENANT.keys.branding;
  const defaults = { color1:'#102d46', color2:'#1c5277', logo:'' };

  const readBrand = () => {
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(BRAND_KEY) || '{}')) }; }
    catch { return { ...defaults }; }
  };

  const persistBrand = brand => {
    localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
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

  const optimizeLogo = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSide = 700;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });

  let brand = readBrand();
  applyBrand(brand);

  const logoInput = document.querySelector('#headerLogoFile');
  if (logoInput) {
    logoInput.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        toast('Selecciona un archivo JPG, PNG o WEBP');
        e.target.value = '';
        return;
      }
      if (file.size > 5000000) {
        toast('El logo es muy grande. Usa una imagen menor de 5 MB');
        e.target.value = '';
        return;
      }

      try {
        brand.logo = await optimizeLogo(file);
        persistBrand(brand);
        applyBrand(brand);
        toast('Logo guardado automáticamente');
      } catch {
        toast('No se pudo guardar el logo');
      }
    });
  }

  document.querySelector('#saveBrandingBtn')?.addEventListener('click', () => {
    brand.color1 = document.querySelector('#headerColor1')?.value || defaults.color1;
    brand.color2 = document.querySelector('#headerColor2')?.value || defaults.color2;
    try {
      persistBrand(brand);
      applyBrand(brand);
      toast('Diseño del header guardado');
    } catch {
      toast('No se pudo guardar el diseño');
    }
  });

  document.querySelector('#removeLogoBtn')?.addEventListener('click', () => {
    brand.logo = '';
    persistBrand(brand);
    if (logoInput) logoInput.value = '';
    applyBrand(brand);
    toast('Logo eliminado');
  });

  document.querySelector('#resetHeaderBtn')?.addEventListener('click', () => {
    brand.color1 = defaults.color1;
    brand.color2 = defaults.color2;
    persistBrand(brand);
    applyBrand(brand);
    toast('Colores originales restaurados');
  });

  document.querySelector('#headerColor1')?.addEventListener('input', e => {
    brand.color1 = e.target.value;
    document.documentElement.style.setProperty('--header1', brand.color1);
    try { persistBrand(brand); } catch {}
  });

  document.querySelector('#headerColor2')?.addEventListener('input', e => {
    brand.color2 = e.target.value;
    document.documentElement.style.setProperty('--header2', brand.color2);
    try { persistBrand(brand); } catch {}
  });
})();