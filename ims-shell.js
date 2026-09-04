import { NAVIGATION, can, currentRole } from './ims-permissions.js';

// IMS shell/navigation adapter.
// The legacy core may render the base shell, but this module owns which tabs
// are available to the current role. It intentionally contains no inventory,
// movement, maintenance or Firestore write logic.

const navById = new Map(NAVIGATION.map(item => [item.id, item]));

function navigationForRole(role = currentRole()) {
  return NAVIGATION.filter(item => !item.permission || can(item.permission, role));
}

function permissionForTab(tabId) {
  return navById.get(String(tabId || ''))?.permission || null;
}

function applyNavigation(root = document) {
  const allowedIds = new Set(navigationForRole().map(item => item.id));

  root.querySelectorAll?.('.navBtn[data-tab]').forEach(btn => {
    const allowed = allowedIds.has(btn.dataset.tab);
    btn.hidden = !allowed;
    btn.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    btn.tabIndex = allowed ? 0 : -1;
  });

  return [...allowedIds];
}

function setActiveTab(tabId) {
  document.querySelectorAll('.navBtn[data-tab]').forEach(btn => {
    const active = btn.dataset.tab === tabId;
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

let timer;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => applyNavigation(document), 20);
});
observer.observe(document.documentElement, { childList:true, subtree:true });

applyNavigation(document);

window.IMSShell = Object.freeze({
  navigationForRole,
  permissionForTab,
  applyNavigation,
  setActiveTab
});

window.dispatchEvent(new CustomEvent('ims:shell-ready', {
  detail: { role:currentRole(), tabs:navigationForRole().map(x => x.id) }
}));

export { navigationForRole, permissionForTab, applyNavigation, setActiveTab };
