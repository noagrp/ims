import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const byId=id=>document.getElementById(id);
const BACKUP_VERSION=4;
const COLLECTIONS=[
  'registration_batches',
  'inventory',
  'movements',
  'maintenance_events',
  'client_docs',
  'supplier_docs',
  'document_refs',
  'operational_logs',
  'audit_traces',
  'supplier_profiles',
  'client_profiles',
  'settings',
  'users'
];

async function activeSuperadmin(){
  const u=auth.currentUser;
  if(!u)throw new Error('You must be signed in.');
  const snap=await getDoc(doc(db,'users',u.uid));
  if(!snap.exists()||snap.data().status!=='active'||snap.data().role!=='superadmin')throw new Error('Active Superadmin account required.');
  return {uid:u.uid,email:snap.data().email||u.email||'',profile:snap.data()};
}

function encodeValue(v){
  if(v===null||v===undefined||typeof v!=='object')return v;
  if(typeof v.toDate==='function'&&typeof v.seconds==='number')return {__imsType:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds||0};
  if(Array.isArray(v))return v.map(encodeValue);
  const out={};
  Object.keys(v).forEach(k=>out[k]=encodeValue(v[k]));
  return out;
}

function decodeValue(v){
  if(v===null||v===undefined||typeof v!=='object')return v;
  if(v.__imsType==='timestamp'&&Number.isFinite(Number(v.seconds)))return new Timestamp(Number(v.seconds),Number(v.nanoseconds||0));
  if(Array.isArray(v))return v.map(decodeValue);
  const out={};
  Object.keys(v).forEach(k=>out[k]=decodeValue(v[k]));
  return out;
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

async function writeAudit(user,action,afterValue,remark='',metadata={}){
  await addDoc(collection(db,'audit_traces'),{
    traceVersion:3,
    actionType:action,
    module:'Global Settings',
    targetType:'backup',
    targetName:action==='CREATE_SYSTEM_BACKUP'?'Full System Backup':'Full System Restore',
    targetId:'',
    summary:action==='CREATE_SYSTEM_BACKUP'?'Create System Backup':'Restore System Backup',
    beforeValue:null,
    afterValue,
    changedFields:Object.keys(afterValue||{}),
    remark,
    metadata,
    performedBy:user.email,
    performedByRole:'superadmin',
    performedAt:new Date().toISOString()
  });
}

async function createBackup(){
  const user=await activeSuperadmin();
  const btn=byId('imsFullBackup');
  if(btn){btn.disabled=true;btn.textContent='Preparing Backup...';}
  try{
    await writeAudit(user,'CREATE_SYSTEM_BACKUP',{backupVersion:BACKUP_VERSION},'Complete Firestore IMS backup created.');
    const payload={
      imsBackupVersion:BACKUP_VERSION,
      createdAt:new Date().toISOString(),
      createdBy:user.email,
      restoreMode:'replace matching document IDs; preserve documents absent from backup',
      firebaseAuthIncluded:false,
      collections:{}
    };
    for(const name of COLLECTIONS)payload.collections[name]=await readCollection(name);
    payload.counts=Object.fromEntries(COLLECTIONS.map(name=>[name,payload.collections[name].length]));
    downloadJson(`IMS_Full_Backup_${payload.createdAt.slice(0,10)}.json`,payload);
    alert(`Full IMS backup created.\n\nRecords: ${Object.values(payload.counts).reduce((a,b)=>a+Number(b||0),0)}\n\nFirestore IMS data and user profiles are included. Firebase Authentication passwords/accounts are not exportable by this browser backup and remain in Firebase Auth.`);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Download Full Backup JSON';}
  }
}

function validateBackup(payload){
  if(!payload||Number(payload.imsBackupVersion)!==BACKUP_VERSION||!payload.collections||typeof payload.collections!=='object')throw new Error(`This is not a valid IMS full backup version ${BACKUP_VERSION} file.`);
  for(const name of COLLECTIONS)if(!Array.isArray(payload.collections[name]))throw new Error(`Backup is incomplete: missing collection ${name}.`);
}

function backupSummary(payload){
  const rows=COLLECTIONS.map(name=>`${name}: ${payload.collections[name].length}`);
  return {text:rows.join('\n'),total:COLLECTIONS.reduce((n,name)=>n+payload.collections[name].length,0)};
}

async function restoreBackup(file){
  if(!file)return;
  const user=await activeSuperadmin();
  let payload;
  try{payload=JSON.parse(await file.text());validateBackup(payload);}catch(err){alert(err?.message||'Invalid backup file.');return;}
  const summary=backupSummary(payload);
  const createdAt=payload.createdAt||'Unknown';
  if(!confirm(`FULL IMS RESTORE\n\nBackup date: ${createdAt}\nRecords in file: ${summary.total}\n\n${summary.text}\n\nRestore behavior:\n• Matching document IDs are restored to the backup version.\n• Newer documents not present in the backup are kept.\n• Current signed-in Superadmin profile is preserved to prevent lockout.\n• Firebase Auth accounts/passwords are not changed.\n\nContinue?`))return;
  const phrase=prompt('Type RESTORE IMS to confirm.','');
  if(phrase!=='RESTORE IMS'){alert('Restore cancelled. Confirmation text did not match.');return;}
  const btn=byId('imsFullRestore');
  if(btn){btn.disabled=true;btn.textContent='Restoring...';}
  let restored=0,skipped=0;
  const errors=[];
  try{
    for(const name of COLLECTIONS){
      for(const row of payload.collections[name]){
        if(!row?.id||row.data===undefined){errors.push(`${name}: invalid record`);continue;}
        if(name==='users'&&row.id===user.uid){skipped++;continue;}
        try{await setDoc(doc(db,name,row.id),decodeValue(row.data));restored++;}
        catch(err){errors.push(`${name}/${row.id}: ${err?.message||err}`);}
      }
    }
    await writeAudit(user,'RESTORE_SYSTEM_BACKUP',{restored,skippedCurrentSuperadmin:skipped,errors:errors.length,backupCreatedAt:payload.createdAt||''},'Complete IMS restore from backup JSON.',{fileName:file.name,backupVersion:payload.imsBackupVersion,mode:'replace matching IDs; preserve absent documents',firebaseAuthChanged:false});
    if(errors.length)console.error('IMS restore errors:',errors);
    alert(`IMS restore completed.\n\nRestored: ${restored}\nCurrent Superadmin profile preserved: ${skipped}\nErrors: ${errors.length}\n\nNewer documents that were not in the backup were kept. Firebase Auth accounts were unchanged.`);
    location.reload();
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Restore Full Backup JSON';}
  }
}

function mount(){
  if(window.IMS_ROLE!=='superadmin')return;
  const oldBtn=byId('downloadBackup');
  if(!oldBtn)return;
  const section=oldBtn.closest('section');
  if(!section||section.dataset.fullRecovery==='1')return;
  section.dataset.fullRecovery='1';
  section.innerHTML=`
    <h2 class="font-bold text-sm sm:text-base mb-4">System Backup / Recovery</h2>
    <p class="text-xs text-slate-400 mb-3">Complete current Firestore IMS recovery data. Includes inventory, registration batches, movements, maintenance, documents, operational history, masters and user profiles.</p>
    <div class="flex flex-wrap gap-2">
      <button id="imsFullBackup" type="button" class="bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded-lg text-xs font-bold">Download Full Backup JSON</button>
      <button id="imsFullRestore" type="button" class="bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-lg text-xs font-bold">Restore Full Backup JSON</button>
      <input id="imsFullRestoreFile" type="file" accept=".json,application/json" class="hidden">
    </div>
    <div class="text-[10px] text-slate-500 mt-3">Restore replaces matching Firestore document IDs with the backup version but does not delete documents created after the backup. The currently signed-in Superadmin profile and Firebase Authentication accounts/passwords are preserved.</div>`;
  byId('imsFullBackup').onclick=()=>createBackup().catch(err=>{console.error(err);alert('Backup failed: '+(err?.message||err));});
  byId('imsFullRestore').onclick=()=>byId('imsFullRestoreFile').click();
  byId('imsFullRestoreFile').onchange=e=>restoreBackup(e.target.files?.[0]).catch(err=>{console.error(err);alert('Restore failed: '+(err?.message||err));});
}

let t;
new MutationObserver(()=>{clearTimeout(t);t=setTimeout(mount,30);}).observe(document.body,{childList:true,subtree:true});
mount();
