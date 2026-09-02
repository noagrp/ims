import { NAVIGATION, can, currentRole } from './ims-permissions.js';

// Transitional access bridge for the existing IMS core.
// It does not change business logic. It centralizes UI visibility/guards while
// older core functions are migrated gradually to IMSAccess.can(...).

const navPermission = new Map(NAVIGATION.map(x => [x.id, x.permission]));

function permissionForTab(tabId) {
  return navPermission.get(String(tabId || '')) || null;
}

function applyNavigationPermissions(root = document) {
  root.querySelectorAll?.('.navBtn[data-tab]').forEach(btn => {
    const permission = permissionForTab(btn.dataset.tab);
    const allowed = !permission || can(permission);
    btn.hidden = !allowed;
    btn.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    if (!allowed) btn.tabIndex = -1;
  });
}

function applyActionPermissions(root = document) {
  root.querySelectorAll?.('[data-ims-permission]').forEach(el => {
    const permission = el.dataset.imsPermission;
    const allowed = !permission || can(permission);
    el.hidden = !allowed;
    el.setAttribute('aria-hidden', allowed ? 'false' : 'true');
    if ('disabled' in el) el.disabled = !allowed;
  });
}

function applyPermissions(root = document) {
  applyNavigationPermissions(root);
  applyActionPermissions(root);
}

function guard(permission, fn) {
  return function guardedAction(...args) {
    if (!can(permission)) {
      console.warn(`IMS permission denied: ${permission} for role ${currentRole()}`);
      return undefined;
    }
    return fn.apply(this, args);
  };
}

let timer;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => applyPermissions(document), 20);
});
observer.observe(document.documentElement, { childList:true, subtree:true });

applyPermissions(document);

window.IMSAccessUI = Object.freeze({
  permissionForTab,
  applyNavigationPermissions,
  applyActionPermissions,
  applyPermissions,
  guard
});

window.dispatchEvent(new CustomEvent('ims:access-ui-ready', {
  detail: { role:currentRole() }
}));

export {
  permissionForTab,
  applyNavigationPermissions,
  applyActionPermissions,
  applyPermissions,
  guard
};
