(() => {
  const businessTabs = {
    Suppliers: 'suppliers',
    Clients: 'clients'
  };

  function syncBusinessActiveTab() {
    const title = document.getElementById('pageTitle')?.textContent?.trim();
    const activeTab = businessTabs[title];
    if (!activeTab) return;

    document.querySelectorAll('.navBtn').forEach(button => {
      const isActive = button.dataset.tab === activeTab;
      button.className = `navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold ${
        isActive ? 'bg-red-600 text-white' : 'bg-slate-800/50 hover:bg-slate-800'
      }`;
    });
  }

  const observer = new MutationObserver(syncBusinessActiveTab);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  document.addEventListener('click', event => {
    if (event.target.closest('.navBtn')) setTimeout(syncBusinessActiveTab, 0);
  }, true);

  syncBusinessActiveTab();
})();
