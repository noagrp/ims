import { NAVIGATION, can, currentRole } from './ims-permissions.js';

// Transitional access bridge for the existing IMS core.
// Business logic remains unchanged. This bridge maps legacy UI controls to the
// central permission registry until each module is migrated to can(...).

const navPermission = new Map(NAVIGATION.map(x => [x.id, x.permission]));

const LEGACY_ACTIONS = Object.freeze([
  // Inventory / document controls
  { selector:'button[onclick^="editItemName("]', permission:'inventory.edit' },
  { selector:'button[onclick^="correctDoc("]', permission:'documents.edit' },
  { selector:'button[onclick^="addManualDoc("]', permission:'documents.add' },

  // Supplier / client controls
  { selector:`button[onclick^="editBusiness('supplier'"]`, permission:'supplier.edit' },
  { selector:`button[onclick^="editBusiness('client'"]`, permission:'client.edit' },
  { selector:`button[onclick^="toggleBusiness('supplier'"]`, permission:'supplier.status' },
  { selector:`button[onclick^="toggleBusiness('client'"]`, permission:'client.status' },

  // Master data
  { selector:'.masterForm', permission:'masters.add' },
  { selector:'button[onclick^="toggleMaster("]', permission:'masters.status' },

  // Record output
  { selector:'#exportLogExcel', permission:'records.export.csv' },
  { selector:'#exportLogCsv', permission:'records.export.csv' },
  { selector:'#exportLogSelected', permission:'records.export.csv' },

  // Audit output
  { selector:'#auditExport', permission:'audit.export.csv' },
  { selector:'#auditExportSelected', permission:'audit.export.csv' },

  // Users
  { selector:'#userForm', permission:'users.add' },
  { selector:'button[onclick^="toggleUser("]', permission:'users.status' },
  { selector:'button[onclick^="changeRole("]', permission:'users.role.edit' },

  // Backup
  { selector:'#downloadBackup', permission:'backup.create' }
]);

function permissionForTab(tabId) {
  return navPermission.get(String(tabId || '')) || null;
}

function setAllowed(el, allowed) {
  el.hidden = !allowed;
  el.setAttribute('aria-hidden', allowed ? 'false' : 'true');
  if ('disabled' in el) el.disabled = !allowed;
  if (!allowed && 'tabIndex' in el) el.tabIndex = -1;
}

function applyNavigationPermissions(root = document) {
  root.querySelectorAll?.('.navBtn[data-tab]').forEach(btn => {
    const permission = permissionForTab(btn.dataset.tab);
    setAllowed(btn, !permission || can(permission));
  });
}

function applyDeclaredActionPermissions(root = document) {
  root.querySelectorAll?.('[data-ims-permission]').forEach(el => {
    const permission = el.dataset.imsPermission;
    setAllowed(el, !permission || can(permission));
  });
}

function applyLegacyActionPermissions(root = document) {
  for (const def of LEGACY_ACTIONS) {
    root.querySelectorAll?.(def.selector).forEach(el => {
      el.dataset.imsPermission = def.permission;
      setAllowed(el, can(def.permission));
    });
  }
}

function applyPermissions(root = document) {
  applyNavigationPermissions(root);
  applyDeclaredActionPermissions(root);
  applyLegacyActionPermissions(root);
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
  applyDeclaredActionPermissions,
  applyLegacyActionPermissions,
  applyPermissions,
  guard,
  legacyActions:LEGACY_ACTIONS
});

window.dispatchEvent(new CustomEvent('ims:access-ui-ready', {
  detail: { role:currentRole() }
}));

export {
  permissionForTab,
  applyNavigationPermissions,
  applyDeclaredActionPermissions,
  applyLegacyActionPermissions,
  applyPermissions,
  guard,
  LEGACY_ACTIONS
};
