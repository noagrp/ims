import { can, currentRole } from './ims-permissions.js';

// Optional IMS modules are loaded independently. A missing or broken optional
// module is reported and skipped without stopping the rest of the application.
const MODULES = Object.freeze([
  { id:'access-ui', src:'./ims-access-ui.js' },
  { id:'layout-core', src:'./layout-core.js', mode:'classic' },
  { id:'nav-active-fix', src:'./nav-active-fix.js', mode:'classic' },
  { id:'date-standard', src:'./date-standard.js', mode:'classic' },

  { id:'masters', src:'./modules/masters/masters-module.js', permission:'masters.view' },
  { id:'users', src:'./modules/users/users-module.js', permission:'users.view' },
  { id:'audit', src:'./modules/audit/audit-module.js', permission:'audit.view' },
  { id:'records', src:'./modules/records/records-module.js', permission:'app.view' },
  { id:'backup', src:'./modules/backup/backup-module.js', permission:'backup.create' },
  { id:'classification-master', src:'./classification-master.js', permission:'masters.add' },
  { id:'admin-item-masters-view', src:'./admin-item-masters-view.js', roles:['admin'] },
  { id:'registration-classification', src:'./registration-classification.js' },
  { id:'registration-workflow', src:'./registration-workflow.js' },
  { id:'recent-items', src:'./recent-items.js' },
  { id:'item-detail-history', src:'./item-detail-history.js' },
  { id:'item-record-export', src:'./item-record-export.js', permission:'records.export.csv' },
  { id:'stock-directory', src:'./stock-directory.js' },
  { id:'scalable-logs', src:'./scalable-logs.js' },
  { id:'batch-movement', src:'./batch-movement.js' },
  { id:'maintenance-workflow', src:'./maintenance-workflow.js', permission:'maintenance.view' },
  { id:'businesses', src:'./modules/businesses/business-module.js', permission:'supplier.view' },
  { id:'business-form-controls', src:'./business-form-controls.js' },
  { id:'invoice-management', src:'./invoice-management.js' },

  { id:'movement-refresh-normalizer', src:'./movement-refresh-normalizer.js', mode:'classic' },
  { id:'manager-audit-fix', src:'./manager-audit-fix.js', roles:['manager'] },
  { id:'sortable-tables', src:'./sortable-tables.js', mode:'classic' },
  { id:'print-clean', src:'./print-clean.js', mode:'classic', permission:'records.print.pdf' },

  { id:'backup-recovery', src:'./backup-recovery.js', permission:'backup.create' },
  { id:'superadmin-reset', src:'./superadmin-reset.js', roles:['superadmin'] }
]);

function allowed(def) {
  const role = currentRole();
  if (def.roles && !def.roles.includes(role)) return false;
  if (def.permission && !can(def.permission, role)) return false;
  return true;
}

function loadClassic(def) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = def.src;
    s.async = false;
    s.dataset.imsModule = def.id;
    s.onload = () => resolve(def.id);
    s.onerror = () => reject(new Error(`Failed to load ${def.src}`));
    document.body.appendChild(s);
  });
}

async function loadModule(def) {
  await import(def.src);
  return def.id;
}

async function loadOne(def) {
  return def.mode === 'classic' ? loadClassic(def) : loadModule(def);
}

async function bootOptionalModules() {
  const loaded = [];
  const failed = [];
  const skipped = [];

  for (const def of MODULES) {
    if (!allowed(def)) {
      skipped.push(def.id);
      continue;
    }
    try {
      await loadOne(def);
      loaded.push(def.id);
    } catch (error) {
      failed.push({ id:def.id, error:String(error?.message || error) });
      console.warn(`IMS optional module unavailable: ${def.id}`, error);
    }
  }

  window.IMSModules = Object.freeze({ loaded, failed, skipped, registry:MODULES });
  window.dispatchEvent(new CustomEvent('ims:modules-ready', { detail:window.IMSModules }));
}

bootOptionalModules().catch(error => {
  // This catch is intentionally final: optional module boot must never blank IMS.
  console.error('IMS optional module loader failed safely:', error);
});

export { MODULES, bootOptionalModules };
