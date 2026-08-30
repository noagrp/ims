import { auth, db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().toLowerCase();
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
let records=[];

function fmt(v){
  if(!v)return '';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?String(v):d.toLocaleString();
}
function friendly(s){return String(s||'').toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}

async function loadVisible(){
  const u=auth.currentUser;
  if(!u)throw new Error('Sign in required.');
  const p=await getDoc(doc(db,'users',u.uid));
  if(!p.exists()||p.data().status!=='active'||p.data().role!=='manager')throw new Error('Active Manager profile required.');
  const email=p.data().email||u.email||'';
  const [adminSnap,ownSnap]=await Promise.all([
    getDocs(query(collection(db,'audit_traces'),where('performedByRole','==','admin'))),
    getDocs(query(collection(db,'audit_traces'),where('performedByRole','==','manager'),where('performedBy','==',email)))
  ]);
  const m=new Map();
  adminSnap.forEach(d=>m.set(d.id,{id:d.id,...d.data()}));
  ownSnap.forEach(d=>m.set(d.id,{id:d.id,...d.data()}));
  records=[...m.values()].sort((a,b)=>String(b.performedAt||'').localeCompare(String(a.performedAt||'')));
}

function renderRows(){
  const q=norm(byId('mafSearch')?.value),role=byId('mafRole')?.value||'',module=byId('mafModule')?.value||'',from=byId('mafFrom')?.value||'',to=byId('mafTo')?.value||'';
  const rows=records.filter(x=>{
    const d=String(x.performedAt||'').slice(0,10);
    return (!q||norm(JSON.stringify(x)).includes(q))&&(!role||x.performedByRole===role)&&(!module||x.module===module)&&(!from||d>=from)&&(!to||d<=to);
  });
  byId('mafCount').textContent=`${rows.length} visible audit record(s).`;
  byId('mafBody').innerHTML=rows.map(x=>`<tr class="border-t border-slate-900"><td class="p-2 whitespace-nowrap">${esc(fmt(x.performedAt))}</td><td class="p-2">${esc(x.performedBy||'')}</td><td class="p-2">${esc(x.performedByRole||'')}</td><td class="p-2">${esc(x.module||'')}</td><td class="p-2">${esc(friendly(x.actionType))}</td><td class="p-2">${esc(x.targetName||'')}</td><td class="p-2">${esc((x.changedFields||[]).join(', ')||'—')}</td><td class="p-2">${esc(x.remark||'')}</td></tr>`).join('')||'<tr><td colspan="8" class="p-5 text-center text-slate-500">No audit records.</td></tr>';
}

async function show(){
  document.querySelectorAll('.navBtn').forEach(b=>b.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800');
  const tab=document.querySelector('.navBtn[data-tab="audit"]');
  if(tab)tab.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-600 text-white';
  if(byId('pageTitle'))byId('pageTitle').textContent='Audit / Trace';
  if(byId('pageSubtitle'))byId('pageSubtitle').textContent='Admin audit records plus this Manager’s own actions.';
  if(!byId('appContent'))return;
  byId('appContent').innerHTML=`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5"><div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-2"><input id="mafSearch" class="${cls}" placeholder="Search user, item, action, remark..."><select id="mafRole" class="${cls}"><option value="">All Visible</option><option value="admin">Admin</option><option value="manager">My Actions</option></select><select id="mafModule" class="${cls}"><option value="">All Modules</option></select><input id="mafFrom" type="date" class="${cls}"><input id="mafTo" type="date" class="${cls}"></div><div id="mafError" class="text-xs text-amber-400 mt-2"></div></section><section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mt-5"><div id="mafCount" class="text-xs text-slate-500 mb-3">Loading...</div><div class="overflow-x-auto border border-slate-800 rounded-xl"><table class="w-full min-w-[1200px] text-xs"><thead class="bg-slate-950 text-slate-400"><tr><th class="p-2 text-left">Date</th><th class="p-2 text-left">User</th><th class="p-2 text-left">Role</th><th class="p-2 text-left">Module</th><th class="p-2 text-left">Action</th><th class="p-2 text-left">Target</th><th class="p-2 text-left">Changed</th><th class="p-2 text-left">Remark</th></tr></thead><tbody id="mafBody"></tbody></table></div></section>`;
  try{
    await loadVisible();
    const modules=[...new Set(records.map(x=>x.module).filter(Boolean))].sort();
    byId('mafModule').innerHTML='<option value="">All Modules</option>'+modules.map(x=>`<option>${esc(x)}</option>`).join('');
    ['mafRole','mafModule','mafFrom','mafTo'].forEach(id=>byId(id).onchange=renderRows);
    byId('mafSearch').oninput=renderRows;
    renderRows();
  }catch(err){
    console.error('Manager audit load failed:',err);
    byId('mafError').textContent='Audit query failed: '+(err?.message||err);
    byId('mafCount').textContent='0 visible audit record(s).';
    byId('mafBody').innerHTML='<tr><td colspan="8" class="p-5 text-center text-slate-500">No audit records loaded.</td></tr>';
  }
}

function bind(){
  const tab=document.querySelector('.navBtn[data-tab="audit"]');
  if(!tab||tab.dataset.managerAuditFix==='1')return;
  tab.dataset.managerAuditFix='1';
  tab.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();show();},true);
}

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(bind,25);}).observe(document.body,{childList:true,subtree:true});
bind();
