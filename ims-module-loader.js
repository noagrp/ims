import { can, currentRole } from './ims-permissions.js';

const IMS_BUILD='20260904-4';
const versioned=src=>`${src}${src.includes('?')?'&':'?'}v=${IMS_BUILD}`;

const MODULES=Object.freeze([
{id:'nav-active-fix',src:'./nav-active-fix.js',mode:'classic'},
{id:'date-standard',src:'./date-standard.js',mode:'classic'},
{id:'masters',src:'./modules/masters/masters-module.js',permission:'masters.view',owner:'IMSMasters'},
{id:'businesses',src:'./modules/businesses/business-module.js',permission:'supplier.view',owner:'IMSBusinesses'},
{id:'users',src:'./modules/users/users-module.js',permission:'users.view',owner:'IMSUsers'},
{id:'audit',src:'./modules/audit/audit-module.js',permission:'audit.view',owner:'IMSAudit'},
{id:'records',src:'./modules/records/records-module.js',permission:'records.view',owner:'IMSRecords'},
{id:'backup',src:'./modules/backup/backup-module.js',permission:'backup.create',owner:'IMSBackup'},
{id:'items',src:'./modules/items/item-module.js',permission:'inventory.view',owner:'IMSItems'},
{id:'inventory',src:'./modules/inventory/inventory-module.js',permission:'inventory.view',owner:'IMSInventory'},
{id:'workspace',src:'./modules/workspace/workspace-module.js',permission:'app.view',owner:'IMSWorkspace'},
{id:'registration',src:'./modules/registration/registration-module.js',permission:'inventory.add',owner:'IMSRegistration'},
{id:'movement',src:'./modules/movement/movement-module.js',permission:'movement.view',owner:'IMSMovement'},
{id:'maintenance',src:'./modules/maintenance/maintenance-module.js',permission:'maintenance.view',owner:'IMSMaintenance'},
{id:'invoices',src:'./modules/invoices/invoice-module.js',permission:'documents.view',owner:'IMSInvoices'},
{id:'renttorent',src:'./modules/renttorent/renttorent-module.js',permission:'renttorent.view',owner:'IMSRentToRent'},
{id:'reservation',src:'./modules/reservation/reservation-module.js',permission:'reservation.view',owner:'IMSReservation'},
{id:'disposition',src:'./modules/disposition/disposition-module.js',permission:'disposition.view',owner:'IMSDisposition'},
{id:'incident',src:'./modules/incident/incident-module.js',permission:'incident.view',owner:'IMSIncident'},
{id:'sortable-tables',src:'./sortable-tables.js',mode:'classic'},
{id:'print-clean',src:'./print-clean.js',mode:'classic',permission:'records.print.pdf'}
]);
function allowed(def){const role=currentRole();if(def.roles&&!def.roles.includes(role))return false;if(def.permission&&!can(def.permission,role))return false;return true;}
function waitForAuth(){if(window.IMSUser&&document.getElementById('navTabs'))return Promise.resolve();return new Promise(resolve=>window.addEventListener('ims:auth-ready',()=>resolve(),{once:true}));}
function loadClassic(def){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=versioned(def.src);s.async=false;s.dataset.imsModule=def.id;s.onload=()=>resolve(def.id);s.onerror=()=>reject(new Error(`Failed to load ${def.src}`));document.body.appendChild(s);});}
async function loadModule(def){await import(versioned(def.src));return def.id;}
async function loadOne(def){await(def.mode==='classic'?loadClassic(def):loadModule(def));if(def.owner&&!window[def.owner])throw new Error(`${def.id} imported but did not publish window.${def.owner}`);return def.id;}
function bindDirectNavigation(){const stock=document.querySelector('.navBtn[data-tab="stock"]');if(stock&&window.IMSInventory)stock.onclick=()=>window.IMSInventory.show('overview');const workspace=document.querySelector('.navBtn[data-tab="workspace"]');if(workspace&&window.IMSWorkspace)workspace.onclick=()=>window.IMSWorkspace.show();}
function publishStatus(loaded,failed,skipped){const owners=Object.fromEntries(MODULES.filter(x=>x.owner).map(x=>[x.id,{owner:x.owner,ready:Boolean(window[x.owner]),allowed:allowed(x)}]));window.IMSModules=Object.freeze({build:IMS_BUILD,loaded:[...loaded],failed:[...failed],skipped:[...skipped],owners,registry:MODULES,legacyFallbacks:false});window.dispatchEvent(new CustomEvent('ims:modules-ready',{detail:window.IMSModules}));console.info('IMS consolidated module status',window.IMSModules);}
async function bootOptionalModules(){await waitForAuth();const loaded=[],failed=[],skipped=[];for(const def of MODULES){if(!allowed(def)){skipped.push(def.id);continue;}try{await loadOne(def);loaded.push(def.id);}catch(error){failed.push({id:def.id,error:String(error?.message||error)});console.error(`IMS module failed: ${def.id}`,error);}}bindDirectNavigation();publishStatus(loaded,failed,skipped);if(window.IMSWorkspace&&!document.querySelector('[data-ims-workspace-module="1"]'))window.IMSWorkspace.show();return window.IMSModules;}
bootOptionalModules().catch(error=>console.error('IMS module loader failed:',error));export {MODULES,IMS_BUILD,bootOptionalModules};