(() => {
  const openPanel = () => {
    const settingsTab = document.querySelector('.tab[data-tab="settings"]');
    if (settingsTab) settingsTab.click();

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelector('#settings')?.classList.add('active');

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    settingsTab?.classList.add('active');

    const panel = document.querySelector('#cloudAdminPanel');
    const tenantPanel = document.querySelector('#tenantAdminPanel');
    if (panel) panel.hidden = false;
    if (tenantPanel) tenantPanel.hidden = false;
    if (!panel && !tenantPanel) return;

    setTimeout(() => {
      panel.scrollIntoView({behavior:'smooth', block:'start'});
    }, 120);
  };

  const shouldOpen = () => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('nube') === 'admin' || location.hash === '#nube-admin';
    } catch {
      return false;
    }
  };

  const tryOpen = () => {
    if (!shouldOpen()) return;
    const lock = document.querySelector('#pinLock');
    if (lock && !lock.classList.contains('unlocked')) return;
    openPanel();
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(tryOpen, 500);
  });

  const observer = new MutationObserver(() => tryOpen());
  const lock = document.querySelector('#pinLock');
  if (lock) observer.observe(lock, {attributes:true, attributeFilter:['class']});

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.altKey && String(e.key).toLowerCase() === 'n') {
      e.preventDefault();
      openPanel();
    }
  });

  let taps = 0;
  let timer;
  const title = document.querySelector('#settingsTitle');
  title?.addEventListener('click', () => {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => taps = 0, 2200);
    if (taps >= 5) {
      taps = 0;
      openPanel();
    }
  });
})();