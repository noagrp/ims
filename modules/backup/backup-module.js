import { auth, db } from '../../firebase-config.js';
import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';

// Optional consolidated Backup / Recovery module.
// Backup, restore and testing reset live together here. The destructive testing
// reset has its own permission and is never implied by ordinary backup access.

const BACKUP_VERSION=4;
const BACKUP_COLLECTIONS=Object.freeze([
  'registration_batches','inventory','movements','maintenance_events',
  'client_docs','supplier_docs','document_refs','operational_logs','audit_traces',
  'supplier_profiles','client_profiles','settings','users'
]);
const RESET_COLLECTIONS=Object.freeze(BACKUP_COLLECTIONS.filter(x=>x!=='users'));
const byId=id=>document.getElementById(id);
const nowISO=()=>new Date().toISOString();

function encodeValue(v){
  if(v===null||v===undefined||typeof v!=='object')return v;
  if(typeof v.toDate==='function'&&typeof v.seconds==='number')return {__imsType:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds||0};
  if(Array.isArray(v))return v.map(encodeValue);
  const out={};Object.keys(v).forEach(k=>out[k]=encodeValue(v[k]));return out;
}
function decodeValue(v){
  if(v===null||v===undefined||typeof v!=='object')return v;
  if(v.__imsType==='timestamp'&&Number.isFinite(Number(v.seconds)))return new Timestamp(Number(v.seconds),Number(v.nanoseconds||0));
  if(Array.isArray(v))return v.map(decodeValue);
  const out={};Object.keys(v).forEach(k=>out[k]=decodeValue(v[k]));return out;
}
function downloadJson(name,payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
async function readCollection(name){
  const snap=await getDocs(collection(db,name));
  return snap.docs.map(d=>({id:d.id,data:encodeValue(d.data())}));
}
async function writeAudit(action,afterValue,remark='',metadata={}){
  const user=auth.currentUser;if(!user)return;
  await addDoc(collection(db,'audit_traces'),{
    traceVersion:3,actionType:action,module:'Backup / Recovery',targetType:'backup',
    targetName:action==='CREATE_SYSTEM_BACKUP'?'Full System Backup':action==='RESTORE_SYSTEM_BACKUP'?'Full System Restore':'Clean Testing Reset',
    targetId:'',summary:String(action).replace(/_/g,' '),beforeValue:null,afterValue,
    changedFields:Object.keys(afterValue||{}),remark,metadata,
    performedBy:user.email||'',performedByRole:window.IMS_ROLE||'',performedAt:nowISO()
  });
}

async function createBackup(){
  if(!can('backup.create'))return;
  const btn=byId('imsFullBackup');if(btn){btn.disabled=true;btn.textContent='Preparing Backup...';}
  try{
    await writeAudit('CREATE_SYSTEM_BACKUP',{backupVersion:BACKUP_VERSION},'Complete Firestore IMS backup created.');
    const payload={imsBackupVersion:BACKUP_VERSION,createdAt:nowISO(),createdBy:auth.currentUser?.email||'',restoreMode:'replace matching document IDs; preserve documents absent from backup',firebaseAuthIncluded:false,collections:{}};
    for(const name of BACKUP_COLLECTIONS)payload.collections[name]=await readCollection(name);
    payload.counts=Object.fromEntries(BACKUP_COLLECTIONS.map(name=>[name,payload.collections[name].length]));
    downloadJson(`IMS_Full_Backup_${payload.createdAt.slice(0,10)}.json`,payload);
    alert(`Full IMS backup created.\n\nRecords: ${Object.values(payload.counts).reduce((a,b)=>a+Number(b||0),0)}\n\nFirestore IMS data and user profiles are included. Firebase Authentication accounts/passwords are not exported.`);
  }finally{if(btn){btn.disabled=false;btn.textContent='Download Full Backup JSON';}}
}

function validateBackup(payload){
  if(!payload||Number(payload.imsBackupVersion)!==BACKUP_VERSION||!payload.collections||typeof payload.collections!=='object')throw new Error(`This is not a valid IMS full backup version ${BACKUP_VERSION} file.`);
  for(const name of BACKUP_COLLECTIONS)if(!Array.isArray(payload.collections[name]))throw new Error(`Backup is incomplete: missing collection ${name}.`);
}
function backupSummary(payload){return{text:BACKUP_COLLECTIONS.map(name=>`${name}: ${payload.collections[name].length}`).join('\n'),total:BACKUP_COLLECTIONS.reduce((n,name)=>n+payload.collections[name].length,0)};}

async function restoreBackup(file){
  if(!can('backup.restore')||!file)return;
  let payload;
  try{payload=JSON.parse(await file.text());validateBackup(payload);}catch(err){alert(err?.message||'Invalid backup file.');return;}
  const summary=backupSummary(payload);
  if(!confirm(`FULL IMS RESTORE\n\nBackup date: ${payload.createdAt||'Unknown'}\nRecords in file: ${summary.total}\n\n${summary.text}\n\nRestore behavior:\n• Matching document IDs are restored to the backup version.\n• Newer documents absent from the backup are kept.\n• Current signed-in user profile is preserved to prevent lockout.\n• Firebase Auth accounts/passwords are unchanged.\n\nContinue?`))return;
  if(prompt('Type RESTORE IMS to confirm.','')!=='RESTORE IMS'){alert('Restore cancelled. Confirmation text did not match.');return;}
  const btn=byId('imsFullRestore');if(btn){btn.disabled=true;btn.textContent='Restoring...';}
  let restored=0,skipped=0;const errors=[];const uid=auth.currentUser?.uid||'';
  try{
    for(const name of BACKUP_COLLECTIONS){
      for(const row of payload.collections[name]){
        if(!row?.id||row.data===undefined){errors.push(`${name}: invalid record`);continue;}
        if(name==='users'&&row.id===uid){skipped++;continue;}
        try{await setDoc(doc(db,name,row.id),decodeValue(row.data));restored++;}catch(err){errors.push(`${name}/${row.id}: ${err?.message||err}`);}
      }
    }
    await writeAudit('RESTORE_SYSTEM_BACKUP',{restored,skippedCurrentUser:skipped,errors:errors.length,backupCreatedAt:payload.createdAt||''},'Complete IMS restore from backup JSON.',{fileName:file.name,backupVersion:payload.imsBackupVersion,mode:'replace matching IDs; preserve absent documents',firebaseAuthChanged:false});
    if(errors.length)console.error('IMS restore errors:',errors);
    alert(`IMS restore completed.\n\nRestored: ${restored}\nCurrent signed-in profile preserved: ${skipped}\nErrors: ${errors.length}\n\nDocuments absent from the backup were kept. Firebase Auth accounts were unchanged.`);
    location.reload();
  }finally{if(btn){btn.disabled=false;btn.textContent='Restore Full Backup JSON';}}
}

async function cleanTestingReset(){
  if(!can('system.test.reset'))return;
  const counts={};let total=0;
  for(const name of RESET_COLLECTIONS){const s=await getDocs(collection(db,name));counts[name]=s.size;total+=s.size;}
  if(!total){alert('There is no IMS test data to delete. User profiles and Firebase Auth accounts remain untouched.');return;}
  const summary=RESET_COLLECTIONS.map(n=>`${n}: ${counts[n]}`).join('\n');
  if(!confirm(`CLEAN TESTING RESET\n\nThis permanently deletes ${total} IMS test record(s):\n${summary}\n\nPRESERVED:\n• Firestore users collection\n• Firebase Auth accounts\n\nContinue?`))return;
  if(prompt('Type CLEAN RESET to confirm.','')!=='CLEAN RESET'){alert('Reset cancelled. Confirmation text did not match.');return;}
  if(!confirm('Final confirmation: permanently clear ALL IMS test data now?'))return;
  const btn=byId('imsResetDataBtn');if(btn){btn.disabled=true;btn.textContent='Cleaning...';}
  let deleted=0;
  try{
    // Audit before deleting audit_traces, then final audit after reset recreates a trace.
    await writeAudit('CLEAN_TEST_RESET',{plannedRecords:total},'Clean testing reset started.');
    for(const name of RESET_COLLECTIONS){const s=await getDocs(collection(db,name));for(const d of s.docs){await deleteDoc(doc(db,name,d.id));deleted++;}}
    await writeAudit('CLEAN_TEST_RESET',{deleted},'Clean testing reset completed; users and Firebase Auth preserved.');
    alert(`Clean testing reset completed.\nDeleted ${deleted} Firestore record(s).\n\nOnly user profiles and Firebase Auth accounts were preserved.`);
    location.reload();
  }catch(err){console.error('IMS clean testing reset failed:',err);alert('Reset failed: '+(err?.message||err));if(btn){btn.disabled=false;btn.textContent='Clean Reset All Test Data';}}
}

function recoverySection(){
  const backup=can('backup.create')?'<button id="imsFullBackup" type="button" class="bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded-lg text-xs font-bold">Download Full Backup JSON</button>':'';
  const restore=can('backup.restore')?'<button id="imsFullRestore" type="button" class="bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-lg text-xs font-bold">Restore Full Backup JSON</button><input id="imsFullRestoreFile" type="file" accept=".json,application/json" class="hidden">':'';
  const reset=can('system.test.reset')?`<div class="mt-4 border-t border-red-900/60 pt-4"><div class="font-bold text-red-300 text-sm">Clean Testing Reset</div><p class="text-xs text-slate-400 mt-1 mb-3">Testing only. Permanently clears IMS business/test data while preserving Firestore user profiles and Firebase Auth accounts.</p><button id="imsResetDataBtn" type="button" class="bg-red-700 hover:bg-red-600 px-4 py-2.5 rounded-lg text-xs font-bold">Clean Reset All Test Data</button></div>`:'';
  return `<section id="imsBackupRecoveryModule" class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl"><h2 class="font-bold text-sm sm:text-base mb-2">System Backup / Recovery</h2><p class="text-xs text-slate-400 mb-3">Complete Firestore IMS recovery data. Restore replaces matching document IDs but preserves documents absent from the backup. Firebase Authentication accounts/passwords are not changed.</p><div class="flex flex-wrap gap-2">${backup}${restore}</div>${reset}</section>`;
}

function mount(){
  if(!can('backup.create')&&!can('backup.restore')&&!can('system.test.reset'))return;
  if(byId('pageTitle')?.textContent!=='Global Settings')return;
  const app=byId('appContent');if(!app||byId('imsBackupRecoveryModule'))return;
  app.insertAdjacentHTML('beforeend',recoverySection());
  if(byId('imsFullBackup'))byId('imsFullBackup').onclick=()=>createBackup().catch(err=>{console.error(err);alert('Backup failed: '+(err?.message||err));});
  if(byId('imsFullRestore'))byId('imsFullRestore').onclick=()=>byId('imsFullRestoreFile')?.click();
  if(byId('imsFullRestoreFile'))byId('imsFullRestoreFile').onchange=e=>restoreBackup(e.target.files?.[0]).catch(err=>{console.error(err);alert('Restore failed: '+(err?.message||err));});
  if(byId('imsResetDataBtn'))byId('imsResetDataBtn').onclick=cleanTestingReset;
}

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mount,30);}).observe(document.body,{childList:true,subtree:true});
mount();

window.IMSBackup=Object.freeze({createBackup,restoreBackup,cleanTestingReset,mount});
window.dispatchEvent(new CustomEvent('ims:backup-ready'));
export { createBackup, restoreBackup, cleanTestingReset, mount };
