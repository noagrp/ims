import { auth, db } from './firebase-config.js';
import { collection, deleteDoc, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const byId=id=>document.getElementById(id);

// Testing-mode reset: keep only user profiles / Firebase Auth so Superadmin
// does not lock itself out. Everything else in the current IMS data model is test data.
const RESET_COLLECTIONS=[
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
  'settings'
];

async function activeSuperadmin(){
  const u=auth.currentUser;
  if(!u)throw new Error('You must be signed in.');
  const s=await getDoc(doc(db,'users',u.uid));
  if(!s.exists()||s.data().status!=='active'||s.data().role!=='superadmin'){
    throw new Error('Active Superadmin account required.');
  }
  return s.data();
}

async function countDocs(name){
  const s=await getDocs(collection(db,name));
  return s.size;
}

async function deleteCollection(name){
  const s=await getDocs(collection(db,name));
  let deleted=0;
  for(const d of s.docs){
    await deleteDoc(doc(db,name,d.id));
    deleted++;
  }
  return {deleted};
}

function ensureControl(){
  const old=byId('imsTempReset');
  if(window.IMS_ROLE!=='superadmin'||byId('pageTitle')?.textContent!=='Global Settings'){
    old?.remove();
    return;
  }
  if(old)return;

  const app=byId('appContent');
  if(!app)return;

  const box=document.createElement('section');
  box.id='imsTempReset';
  box.className='bg-red-950/30 border border-red-900 rounded-2xl p-4 sm:p-5 mt-5';
  box.innerHTML=`
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="font-bold text-red-300">Clean Testing Reset</h2>
        <p class="text-xs text-slate-400 mt-1">Superadmin only. Completely clears current IMS test data, including settings, suppliers and clients. Only Firestore user profiles and Firebase Auth accounts are kept.</p>
      </div>
      <button id="imsResetDataBtn" type="button" class="bg-red-700 hover:bg-red-600 px-4 py-2.5 rounded-lg text-xs font-bold">Clean Reset All Test Data</button>
    </div>
    <div class="text-[10px] text-slate-500 mt-2">This is a testing-mode reset. No current business test data is intentionally preserved.</div>`;

  app.appendChild(box);
  byId('imsResetDataBtn').onclick=resetData;
}

async function resetData(){
  try{
    await activeSuperadmin();

    const counts={};
    let total=0;
    for(const name of RESET_COLLECTIONS){
      counts[name]=await countDocs(name);
      total+=counts[name];
    }

    if(!total){
      alert('There is no IMS test data to delete. User profiles and Firebase Auth accounts remain untouched.');
      return;
    }

    const summary=RESET_COLLECTIONS.map(n=>`${n}: ${counts[n]}`).join('\n');

    if(!confirm(`CLEAN TESTING RESET\n\nThis will permanently delete ${total} IMS test record(s):\n${summary}\n\nONLY PRESERVED:\n• Firestore users collection\n• Firebase Auth accounts\n\nContinue?`))return;

    const phrase=prompt('Type CLEAN RESET to confirm.','');
    if(phrase!=='CLEAN RESET'){
      alert('Reset cancelled. Confirmation text did not match.');
      return;
    }

    if(!confirm('Final confirmation: permanently clear ALL IMS test data now?'))return;

    const btn=byId('imsResetDataBtn');
    if(btn){
      btn.disabled=true;
      btn.textContent='Cleaning...';
    }

    let deletedTotal=0;
    for(const name of RESET_COLLECTIONS){
      const result=await deleteCollection(name);
      deletedTotal+=result.deleted;
    }

    alert(`Clean testing reset completed.\nDeleted ${deletedTotal} Firestore record(s).\n\nOnly user profiles and Firebase Auth accounts were preserved.`);
    location.reload();
  }catch(err){
    console.error('IMS clean testing reset failed:',err);
    alert('Reset failed: '+(err?.message||err));
    const btn=byId('imsResetDataBtn');
    if(btn){
      btn.disabled=false;
      btn.textContent='Clean Reset All Test Data';
    }
  }
}

let t;
new MutationObserver(()=>{
  clearTimeout(t);
  t=setTimeout(ensureControl,30);
}).observe(document.body,{childList:true,subtree:true});
ensureControl();
