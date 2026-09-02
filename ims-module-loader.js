import { can, currentRole } from './ims-permissions.js';

// Consolidated IMS runtime. Business areas are owned only by the new modules.
// Legacy helper files remain in the repository for rollback/history but are not
// loaded at runtime. A failed consolidated module is reported as failed instead
// of silently falling back to old behavior.
const MODULES = Object.freeze([
  // Shared UI utilities still used by the consolidated application.
  { id:'access-ui', src:'./ims-access-ui.js' },
  { id:'layout-core', src:'./layout-core.js', mode:'classic' },
  { id:'nav-active-fix', src:'./nav-active-fix.js', mode:'classic' },
  { id:'date-standard', src:'./date-standard.js', mode:'classic' },

  // Consolidated business modules.
  { id:'masters', src:'./modules/masters/masters-module.js', permission:'masters.view' },
  { id:'businesses', src:'./modules/businesses/business-module.js', permission:'supplier.view' },
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

  // Cross-cutting presentation helpers that are not legacy business fallbacks.
  { id:'sortable-tables', src:'./sortable-tables.js', mode:'classic' },
  { id:'print-clean', src:'./print-clean.js', mode:'classic', permission:'records.print.pdf' }
]);

function allowed(def) {
  const role = currentRole();
  if (def.roles && !def.roles.includes(role)) return false;
  if (def.permission && !can(def.permission, role)) return false;
  return true;
}

function loadClassic(def) {
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=def.src;
    s.async=false;
    s.dataset.imsModule=def.id;
    s.onload=()=>resolve(def.id);
    s.onerror=()=>reject(new Error(`Failed to load ${def.src}`));
    document.body.appendChild(s);
  });
}

async function loadModule(def){await import(def.src);return def.id;}
async function loadOne(def){return def.mode==='classic'?loadClassic(def):loadModule(def);}

async function bootOptionalModules(){
  const loaded=[],failed=[],skipped=[];
  for(const def of MODULES){
    if(!allowed(def)){skipped.push(def.id);continue;}
    try{await loadOne(def);loaded.push(def.id);}
    catch(error){failed.push({id:def.id,error:String(error?.message||error)});console.error(`IMS module failed: ${def.id}`,error);}
  }
  window.IMSModules=Object.freeze({loaded,failed,skipped,registry:MODULES});
  window.dispatchEvent(new CustomEvent('ims:modules-ready',{detail:window.IMSModules}));
}

bootOptionalModules().catch(error=>console.error('IMS module loader failed:',error));
export { MODULES, bootOptionalModules };
