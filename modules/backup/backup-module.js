import { auth, db } from '../../firebase-config.js';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';
import { rebuildInventorySummary } from '../inventory/inventory-summary.js';

const BACKUP_VERSION=6;
const BACKUP_COLLECTIONS=Object.freeze([
  'registration_batches','inventory',
  'movement_groups','movements','reservation_events','service_cycles',
  'client_docs','supplier_docs','document_refs',
  'operational_logs','audit_traces',
  'supplier_profiles','client_profiles','settings','users'
]);
const RESET_COLLECTIONS=Object.freeze(BACKUP_COLLECTIONS.filter(x=>x!=='users'));
const DERIVED_RESET_COLLECTIONS=Object.freeze(['inventory_summary']);
const byId=id=>document.getElementById(id);
const nowISO=()=>new Date().toISOString();

async function activeActor(allowedRoles=['manager','superadmin']){
  const user=auth.currentUser;
  if(!user)throw new Error('Sign in required.');
  const snap=await getDoc(doc(db,'users',user.uid));
  if(!snap.exists())throw new Error('User profile missing.');
  const profile=snap.data();
  if(profile.status!=='active'||!allowedRoles.includes(profile.role))throw new Error(`Active ${allowedRoles.join(' / ')} profile required.`);
  return{uid:user.uid,email:profile.email||user.email||'',role:profile.role};
}
const activeSuperadmin=()=>activeActor(['superadmin']);
function encodeValue(v){if(v===null||v===undefined||typeof v!=='object')return v;if(typeof v.toDate==='function'&&typeof v.seconds==='number')return{__imsType:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds||0};if(Array.isArray(v))return v.map(encodeValue);const out={};Object.keys(v).forEach(k=>out[k]=encodeValue(v[k]));return out;}
function decodeValue(v){if(v===null||v===undefined||typeof v!=='object')return v;if(v.__imsType==='timestamp'&&Number.isFinite(Number(v.seconds)))return new Timestamp(Number(v.seconds),Number(v.nanoseconds||0));if(Array.isArray(v))return v.map(decodeValue);const out={};Object.keys(v).forEach(k=>out[k]=decodeValue(v[k]));return out;}
function downloadJson(name,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
async function readCollection(name){try{const snap=await getDocs(collection(db,name));return snap.docs.map(d=>({id:d.id,data:encodeValue(d.data())}));}catch(err){throw new Error(`Unable to read ${name}: ${err?.message||err}`);}}
async function clearCollection(name){let snap;try{snap=await getDocs(collection(db,name));}catch(err){throw new Error(`Unable to read ${name} before reset: ${err?.message||err}`);}let deleted=0;for(const d of snap.docs){try{await deleteDoc(doc(db,name,d.id));deleted++;}catch(err){throw new Error(`Unable to delete ${name}/${d.id}: ${err?.message||err}`);}}return deleted;}
async function writeAudit(action,afterValue,remark='',metadata={},actor=null){const user=actor||await activeActor();await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:action,module:'Backup / Recovery',targetType:'backup',targetName:action==='CREATE_SYSTEM_BACKUP'?'Full System Backup':action==='RESTORE_SYSTEM_BACKUP'?'Full System Restore':action==='CLEAN_TEST_RESET'?'Clean Testing Reset':'System Reload',targetId:'',summary:String(action).replace(/_/g,' '),beforeValue:null,afterValue,changedFields:Object.keys(afterValue||{}),remark,metadata,performedBy:user.email,performedByRole:user.role,performedAt:nowISO()});}

async function createBackup(){
  if(!can('backup.create'))return;
  const btn=byId('imsFullBackup');if(btn){btn.disabled=true;btn.textContent='Preparing Backup...';}
  try{
    const actor=await activeActor(['manager','superadmin']);
    const payload={imsBackupVersion:BACKUP_VERSION,createdAt:nowISO(),createdBy:actor.email,restoreMode:'replace matching document IDs; preserve documents absent from backup; rebuild derived inventory summary after restore',firebaseAuthIncluded:false,derivedCollectionsExcluded:['inventory_summary'],collections:{}};
    for(const name of BACKUP_COLLECTIONS)payload.collections[name]=await readCollection(name);
    payload.counts=Object.fromEntries(BACKUP_COLLECTIONS.map(name=>[name,payload.collections[name].length]));
    await writeAudit('CREATE_SYSTEM_BACKUP',{backupVersion:BACKUP_VERSION,collections:BACKUP_COLLECTIONS.length,records:Object.values(payload.counts).reduce((a,b)=>a+Number(b||0),0)},'Complete Firestore IMS backup created. Inventory summary is derived and is not backed up.',{},actor);
    downloadJson(`IMS_Full_Backup_${payload.createdAt.slice(0,10)}.json`,payload);
    alert(`Full IMS backup created.\n\nRecords: ${Object.values(payload.counts).reduce((a,b)=>a+Number(b||0),0)}\nCollections: ${BACKUP_COLLECTIONS.length}\n\nInventory is backed up as the source of truth. Inventory Summary is derived and rebuilt after restore. Firebase Authentication accounts/passwords are not exported.`);
  }catch(err){console.error('IMS backup failed:',err);alert('Backup failed: '+(err?.message||err));}
  finally{if(btn){btn.disabled=false;btn.textContent='Download Full Backup JSON';}}
}
function validateBackup(payload){if(!payload||Number(payload.imsBackupVersion)!==BACKUP_VERSION||!payload.collections||typeof payload.collections!=='object')throw new Error(`Unsupported IMS backup. Current backup version required: ${BACKUP_VERSION}.`);for(const name of BACKUP_COLLECTIONS)if(!Array.isArray(payload.collections[name]))throw new Error(`Backup is incomplete: missing collection ${name}.`);return BACKUP_COLLECTIONS;}
function backupSummary(payload,names){return{text:names.map(name=>`${name}: ${payload.collections[name].length}`).join('\n'),total:names.reduce((n,name)=>n+payload.collections[name].length,0)};}
async function restoreBackup(file){
  if(!can('backup.restore')||!file)return;
  let payload,names;try{payload=JSON.parse(await file.text());names=validateBackup(payload);}catch(err){alert(err?.message||'Invalid backup file.');return;}
  const summary=backupSummary(payload,names);if(!confirm(`FULL IMS RESTORE\n\nBackup version: ${payload.imsBackupVersion}\nBackup date: ${payload.createdAt||'Unknown'}\nRecords in file: ${summary.total}\n\n${summary.text}\n\nRestore behavior:\n• Matching document IDs are restored to the backup version.\n• Documents absent from the backup are kept.\n• Inventory Summary is rebuilt afterward.\n• Current signed-in user profile is preserved.\n• Firebase Auth accounts/passwords are unchanged.\n\nContinue?`))return;if(prompt('Type RESTORE IMS to confirm.','')!=='RESTORE IMS'){alert('Restore cancelled. Confirmation text did not match.');return;}
  const btn=byId('imsFullRestore');if(btn){btn.disabled=true;btn.textContent='Restoring...';}let restored=0,skipped=0;const errors=[];
  try{const actor=await activeSuperadmin(),uid=actor.uid;for(const name of names){for(const row of payload.collections[name]){if(!row?.id||row.data===undefined){errors.push(`${name}: invalid record`);continue;}if(name==='users'&&row.id===uid){skipped++;continue;}try{await setDoc(doc(db,name,row.id),decodeValue(row.data));restored++;}catch(err){errors.push(`${name}/${row.id}: ${err?.message||err}`);}}}const rebuilt=await rebuildInventorySummary(actor.email);await writeAudit('RESTORE_SYSTEM_BACKUP',{restored,skippedCurrentUser:skipped,errors:errors.length,backupCreatedAt:payload.createdAt||'',backupVersion:payload.imsBackupVersion,inventorySummaryRebuilt:true,inventorySummarySourceRecords:rebuilt.recordCount},'Complete IMS restore from backup JSON. Inventory Summary rebuilt from inventory source of truth.',{fileName:file.name,mode:'replace matching IDs; preserve absent documents; rebuild inventory summary',firebaseAuthChanged:false},actor);if(errors.length)console.error('IMS restore errors:',errors);alert(`IMS restore completed.\n\nRestored: ${restored}\nCurrent signed-in profile preserved: ${skipped}\nErrors: ${errors.length}\nInventory Summary rebuilt from ${rebuilt.recordCount} inventory record(s).`);location.reload();}catch(err){console.error('IMS restore failed:',err);alert('Restore failed: '+(err?.message||err));}finally{if(btn){btn.disabled=false;btn.textContent='Restore Full Backup JSON';}}
}
async function cleanTestingReset(){
  if(!can('system.test.reset'))return;
  const actor=await activeSuperadmin(),counts={};let total=0;
  try{for(const name of RESET_COLLECTIONS){const s=await getDocs(collection(db,name));counts[name]=s.size;total+=s.size;}for(const name of DERIVED_RESET_COLLECTIONS){const s=await getDocs(collection(db,name));counts[name]=s.size;total+=s.size;}}catch(err){throw new Error(`Unable to prepare reset: ${err?.message||err}`);}
  if(!total){alert('There is no IMS test data to delete. User profiles and Firebase Auth accounts remain untouched.');return;}
  const resetNames=[...RESET_COLLECTIONS,...DERIVED_RESET_COLLECTIONS],summary=resetNames.map(n=>`${n}: ${counts[n]||0}`).join('\n');if(!confirm(`CLEAN TESTING RESET\n\nThis permanently deletes ${total} IMS test/derived record(s):\n${summary}\n\nPRESERVED:\n• Firestore users collection\n• Firebase Auth accounts\n\nContinue?`))return;if(prompt('Type CLEAN RESET to confirm.','')!=='CLEAN RESET'){alert('Reset cancelled. Confirmation text did not match.');return;}if(!confirm('Final confirmation: permanently clear ALL IMS test data now?'))return;
  const btn=byId('imsResetDataBtn');if(btn){btn.disabled=true;btn.textContent='Cleaning...';}let deleted=0;
  try{await writeAudit('CLEAN_TEST_RESET',{plannedRecords:total,collections:resetNames.length},'Clean testing reset started.',{},actor);for(const name of RESET_COLLECTIONS)deleted+=await clearCollection(name);for(const name of DERIVED_RESET_COLLECTIONS)deleted+=await clearCollection(name);await writeAudit('CLEAN_TEST_RESET',{deleted,collections:resetNames.length,inventorySummaryCleared:true},'Clean testing reset completed; users and Firebase Auth preserved; derived Inventory Summary removed.',{},actor);alert(`Clean testing reset completed.\nDeleted ${deleted} Firestore record(s).`);location.reload();}catch(err){console.error('IMS clean testing reset failed:',err);alert('Reset failed: '+(err?.message||err));}finally{if(btn){btn.disabled=false;btn.textContent='Clean Reset All Test Data';}}
}
async function reloadSystem(){if(!can('backup.create'))return;try{const actor=await activeActor(['manager','superadmin']);await writeAudit('SYSTEM_RELOAD',{requestedAt:nowISO()},'Authorized user manually reloaded IMS.',{},actor);}catch(err){console.warn('IMS reload audit failed:',err);}location.reload();}
function recoverySection(){const backup=can('backup.create')?'<button id="imsFullBackup" type="button" class="bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded-lg text-xs font-bold">Download Full Backup JSON</button>':'';const restore=can('backup.restore')?'<button id="imsFullRestore" type="button" class="bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-lg text-xs font-bold">Restore Full Backup JSON</button><input id="imsFullRestoreFile" type="file" accept=".json,application/json" class="hidden">':'';const reload=can('backup.create')?'<button id="imsReloadSystem" type="button" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-xs font-bold">Reload IMS</button>':'';const reset=can('system.test.reset')?`<div class="mt-4 border-t border-red-900/60 pt-4"><div class="font-bold text-red-300 text-sm">Clean Testing Reset</div><p class="text-xs text-slate-400 mt-1 mb-3">Testing only. Permanently clears current IMS business/test data and derived Inventory Summary while preserving users and Firebase Auth.</p><button id="imsResetDataBtn" type="button" class="bg-red-700 hover:bg-red-600 px-4 py-2.5 rounded-lg text-xs font-bold">Clean Reset All Test Data</button></div>`:'';return`<section id="imsBackupRecoveryModule" class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl"><h2 class="font-bold text-sm sm:text-base mb-2">System Backup / Recovery</h2><p class="text-xs text-slate-400 mb-3">Manager and Superadmin can create backups. Restore and full reset remain Superadmin-only. Inventory Summary is rebuilt after restore.</p><div class="flex flex-wrap gap-2">${backup}${restore}${reload}</div>${reset}</section>`;}
function bindRecovery(){if(byId('imsFullBackup'))byId('imsFullBackup').onclick=createBackup;if(byId('imsFullRestore'))byId('imsFullRestore').onclick=()=>byId('imsFullRestoreFile')?.click();if(byId('imsFullRestoreFile'))byId('imsFullRestoreFile').onchange=e=>restoreBackup(e.target.files?.[0]);if(byId('imsReloadSystem'))byId('imsReloadSystem').onclick=reloadSystem;if(byId('imsResetDataBtn'))byId('imsResetDataBtn').onclick=()=>cleanTestingReset().catch(err=>{console.error(err);alert('Reset failed: '+(err?.message||err));});}
function mount(){if(!can('backup.create')&&!can('backup.restore')&&!can('system.test.reset'))return;if(byId('pageTitle')?.textContent!=='Global Settings')return;const host=byId('imsBackupRecoveryHost')||byId('appContent');if(!host)return;if(byId('imsBackupRecoveryModule')){bindRecovery();return;}host.insertAdjacentHTML('beforeend',recoverySection());bindRecovery();}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mount,30)}).observe(document.body,{childList:true,subtree:true});mount();
window.IMSBackup=Object.freeze({createBackup,restoreBackup,cleanTestingReset,reloadSystem,mount,BACKUP_COLLECTIONS,RESET_COLLECTIONS,DERIVED_RESET_COLLECTIONS});
window.dispatchEvent(new CustomEvent('ims:backup-ready'));
export { createBackup, restoreBackup, cleanTestingReset, reloadSystem, mount };
