import { can, currentRole } from './ims-permissions.js';

// Optional IMS modules are loaded independently. Consolidated modules own their
// business area; proven legacy helpers remain repository fallbacks and load only
// when the consolidated owner did not become available.
const MODULES = Object.freeze([
  { id:'access-ui', src:'./ims-access-ui.js' },
  { id:'layout-core', src:'./layout-core.js', mode:'classic' },
  { id:'nav-active-fix', src:'./nav-active-fix.js', mode:'classic' },
  { id:'date-standard', src:'./date-standard.js', mode:'classic' },

  { id:'masters', src:'./modules/masters/masters-module.js', permission:'masters.view' },
  { id:'users', src:'./modules/users/users-module.js', permission:'users.view' },
  { id:'audit', src:'./modules/audit/audit-module.js', permission:'audit.view' },
  { id:'records', src:'./modules/records/records-module.js', permission:'records.view' },
  { id:'backup', src:'./modules/backup/backup-module.js', permission:'backup.create' },
  { id:'items', src:'./modules/items/item-module.js', permission:'inventory.view' },
  { id:'inventory', src:'./modules/inventory/inventory-module.js', permission:'inventory.view' },
  { id:'workspace', src:'./modules/workspace/workspace-module.js', permission:'app.view' },
  { id:'registration', src:'./modules/registration/registration-module.js', permission:'inventory.add' },
  { id:'movement', src:'./modules/movement/movement-module.js', permission:'movement.view' },
  { id:'maintenance', src:'./modules/maintenance/maintenance-module.js', permission:'maintenance.view' },
  { id:'invoices', src:'./modules/invoices/invoice-module.js', permission:'invoice.view' },

  { id:'classification-master', src:'./classification-master.js', permission:'masters.add', fallbackFor:'IMSMasters' },
  { id:'admin-item-masters-view', src:'./admin-item-masters-view.js', fallbackFor:'IMSMasters' },
  { id:'registration-classification', src:'./registration-classification.js', fallbackFor:'IMSRegistration' },
  { id:'registration-workflow', src:'./registration-workflow.js', fallbackFor:'IMSRegistration' },
  { id:'recent-items', src:'./recent-items.js', fallbackFor:'IMSWorkspace' },
  { id:'item-detail-history', src:'./item-detail-history.js', fallbackFor:'IMSItems' },
  { id:'item-record-export', src:'./item-record-export.js', permission:'records.export.csv', fallbackFor:'IMSItems' },
  { id:'stock-directory', src:'./stock-directory.js', permission:'inventory.view', fallbackFor:'IMSInventory' },
  { id:'scalable-logs', src:'./scalable-logs.js', fallbackFor:'IMSRecords' },
  { id:'batch-movement', src:'./batch-movement.js', fallbackFor:'IMSMovement' },
  { id:'maintenance-workflow', src:'./maintenance-workflow.js', permission:'maintenance.view', fallbackFor:'IMSMaintenance' },
  { id:'businesses', src:'./modules/businesses/business-module.js', permission:'supplier.view' },
  { id:'business-form-controls', src:'./business-form-controls.js' },
  { id:'invoice-management', src:'./invoice-management.js', permission:'invoice.view', fallbackFor:'IMSInvoices' },

  { id:'movement-refresh-normalizer', src:'./movement-refresh-normalizer.js', mode:'classic', fallbackFor:'IMSMovement' },
  { id:'manager-audit-fix', src:'./manager-audit-fix.js', fallbackFor:'IMSAudit' },
  { id:'sortable-tables', src:'./sortable-tables.js', mode:'classic' },
  { id:'print-clean', src:'./print-clean.js', mode:'classic', permission:'records.print.pdf' },

  { id:'backup-recovery', src:'./backup-recovery.js', permission:'backup.create', fallbackFor:'IMSBackup' },
  { id:'superadmin-reset', src:'./superadmin-reset.js', fallbackFor:'IMSBackup' }
]);

function allowed(def) {
  const role = currentRole();
  if (def.fallbackFor && window[def.fallbackFor]) return false;
  if (def.roles && !def.roles.includes(role)) return false;
  if (def.permission && !can(def.permission, role)) return false;
  return true;
}
function loadClassic(def) {return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=def.src;s.async=false;s.dataset.imsModule=def.id;s.onload=()=>resolve(def.id);s.onerror=()=>reject(new Error(`Failed to load ${def.src}`));document.body.appendChild(s);});}
async function loadModule(def){await import(def.src);return def.id;}
async function loadOne(def){return def.mode==='classic'?loadClassic(def):loadModule(def);}
async function bootOptionalModules(){const loaded=[],failed=[],skipped=[];for(const def of MODULES){if(!allowed(def)){skipped.push(def.id);continue;}try{await loadOne(def);loaded.push(def.id);}catch(error){failed.push({id:def.id,error:String(error?.message||error)});console.warn(`IMS optional module unavailable: ${def.id}`,error);}}window.IMSModules=Object.freeze({loaded,failed,skipped,registry:MODULES});window.dispatchEvent(new CustomEvent('ims:modules-ready',{detail:window.IMSModules}));}
bootOptionalModules().catch(error=>console.error('IMS optional module loader failed safely:',error));
export { MODULES, bootOptionalModules };
