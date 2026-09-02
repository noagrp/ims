import { auth, db } from '../../firebase-config.js';
import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';

// Consolidated Audit / Trace module.
// Superadmin sees all traces. Manager sees Admin traces plus this Manager's own
// traces using the same rule-compatible query shape as the proven legacy path.

const inputCls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500';
let records=[];
let filtered=[];
let sort={field:'performedAt',dir:'desc'};

const byId=id=>document.getElementById(id);
const nowISO=()=>new Date().toISOString();
const norm=s=>String(s??'').trim().toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const friendly=s=>String(s||'').toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const displayDate=v=>v?new Date(v).toLocaleString():'';
const label=(txt,html)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${txt}</span>${html}</label>`;
const card=(title,body,extra='')=>`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl ${extra}"><h2 class="font-bold text-sm sm:text-base mb-4">${title}</h2>${body}</section>`;

async function reload(){
  if(!can('audit.view')){records=[];return records;}
  const email=auth.currentUser?.email||'';
  if(can('users.role.edit')){
    const snap=await getDocs(collection(db,'audit_traces'));
    records=snap.docs.map(d=>({id:d.id,...d.data()}));
  }else{
    const [adminSnap,ownSnap]=await Promise.all([
      getDocs(query(collection(db,'audit_traces'),where('performedByRole','==','admin'))),
      getDocs(query(collection(db,'audit_traces'),where('performedByRole','==','manager'),where('performedBy','==',email)))
    ]);
    const map=new Map();
    adminSnap.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
    ownSnap.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
    records=[...map.values()].filter(x=>x.performedByRole==='admin'||(x.performedByRole==='manager'&&x.performedBy===email));
  }
  records.sort((a,b)=>String(b.performedAt||'').localeCompare(String(a.performedAt||'')));
  return records;
}

async function writeAudit(actionType,targetName,afterValue={}){
  const user=auth.currentUser;if(!user)return;
  await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType,module:'Audit',targetType:'audit_export',targetName,targetId:'',summary:`${friendly(actionType)}: ${targetName}`,beforeValue:null,afterValue,changedFields:[],remark:'',metadata:{source:'audit-module'},performedBy:user.email||'',performedByRole:window.IMS_ROLE||'',performedAt:nowISO()});
}

function setHeader(){
  if(byId('pageTitle'))byId('pageTitle').textContent='Audit / Trace';
  if(byId('pageSubtitle'))byId('pageSubtitle').textContent=can('users.role.edit')?'Immutable system change history.':'Admin audit records plus your own actions.';
  document.querySelectorAll('.navBtn[data-tab]').forEach(btn=>{btn.className=`navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold ${btn.dataset.tab==='audit'?'bg-red-600 text-white':'bg-slate-800/50 hover:bg-slate-800'}`;});
}

function roleOptions(){return can('users.role.edit')?['admin','manager','superadmin']:['admin','self'];}

function render(){
  if(!can('audit.view'))return;
  const mount=byId('appContent');if(!mount)return;
  setHeader();
  const modules=[...new Set(records.map(x=>x.module).filter(Boolean))].sort(),roles=roleOptions();
  const exportButtons=can('audit.export.csv')?`<div class="flex flex-wrap gap-2 mt-3"><button id="imsAuditExport" class="bg-violet-700 px-4 py-2 rounded-lg text-xs font-bold">Export Filtered Excel</button><button id="imsAuditExportSelected" class="bg-cyan-700 px-4 py-2 rounded-lg text-xs font-bold">Export Selected Excel</button></div>`:'';
  mount.innerHTML=`<div id="imsAuditModule" class="space-y-5">${card('Audit Filters',`<div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">${label('Search',`<input id="imsAuditSearch" class="${inputCls}" placeholder="User, item, action, remark...">`)}${label('Role',`<select id="imsAuditRole" class="${inputCls}"><option value="">All Visible</option>${roles.map(r=>`<option value="${r}">${r==='self'?'My Actions':r[0].toUpperCase()+r.slice(1)}</option>`).join('')}</select>`)}${label('Module',`<select id="imsAuditModuleFilter" class="${inputCls}"><option value="">All Modules</option>${modules.map(x=>`<option>${esc(x)}</option>`).join('')}</select>`)}${label('From Date',`<input type="date" id="imsAuditFrom" class="${inputCls}">`)}${label('To Date',`<input type="date" id="imsAuditTo" class="${inputCls}">`)}</div>${exportButtons}`)}${card('System Audit',`<div id="imsAuditCount" class="text-xs text-slate-500 mb-2"></div><div class="overflow-auto max-h-[68vh] border border-slate-800 rounded-xl"><table class="w-full min-w-[1250px] text-xs"><thead class="sticky top-0 bg-slate-950 text-slate-400"><tr><th class="p-2"><input id="imsAuditSelectAll" type="checkbox"></th>${[['performedAt','Date'],['performedBy','User'],['performedByRole','Role'],['module','Module'],['actionType','Action'],['targetName','Target'],['changedFields','Changed'],['remark','Remark']].map(([f,n])=>`<th class="p-2 text-left cursor-pointer imsAuditSort" data-field="${f}">${n} ↕</th>`).join('')}<th class="p-2">Details</th></tr></thead><tbody id="imsAuditBody"></tbody></table></div>`)}</div>`;
  ['imsAuditSearch','imsAuditRole','imsAuditModuleFilter','imsAuditFrom','imsAuditTo'].forEach(id=>{const el=byId(id);if(el)el.oninput=applyFilters;});
  document.querySelectorAll('.imsAuditSort').forEach(h=>h.onclick=()=>{sort={field:h.dataset.field,dir:sort.field===h.dataset.field&&sort.dir==='asc'?'desc':'asc'};applyFilters();});
  byId('imsAuditSelectAll').onchange=e=>document.querySelectorAll('.imsAuditRowCheck').forEach(x=>x.checked=e.target.checked);
  if(byId('imsAuditExport'))byId('imsAuditExport').onclick=()=>exportAudit(false);
  if(byId('imsAuditExportSelected'))byId('imsAuditExportSelected').onclick=()=>exportAudit(true);
  applyFilters();
}

function renderError(error){
  setHeader();const mount=byId('appContent');if(!mount)return;
  mount.innerHTML=`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5"><h2 class="font-bold">Audit / Trace</h2><div class="text-sm text-amber-300 mt-3">Unable to load Manager audit records.</div><div class="text-xs text-slate-500 mt-2">${esc(error?.message||String(error))}</div></section>`;
}

function applyFilters(){
  const q=norm(byId('imsAuditSearch')?.value||''),role=byId('imsAuditRole')?.value||'',module=byId('imsAuditModuleFilter')?.value||'',from=byId('imsAuditFrom')?.value||'',to=byId('imsAuditTo')?.value||'',email=auth.currentUser?.email||'';
  filtered=records.filter(x=>{const d=String(x.performedAt||'').slice(0,10),roleOk=!role||(role==='self'?x.performedBy===email:x.performedByRole===role);return(!q||norm(JSON.stringify(x)).includes(q))&&roleOk&&(!module||x.module===module)&&(!from||d>=from)&&(!to||d<=to);});
  filtered.sort((a,b)=>{const av=Array.isArray(a[sort.field])?a[sort.field].join(', '):(a[sort.field]??''),bv=Array.isArray(b[sort.field])?b[sort.field].join(', '):(b[sort.field]??''),c=String(av).localeCompare(String(bv));return sort.dir==='asc'?c:-c;});
  if(byId('imsAuditCount'))byId('imsAuditCount').textContent=`${filtered.length} visible audit record(s).`;
  if(byId('imsAuditBody'))byId('imsAuditBody').innerHTML=filtered.map(x=>`<tr class="border-t border-slate-900"><td class="p-2"><input class="imsAuditRowCheck" value="${x.id}" type="checkbox"></td><td class="p-2 whitespace-nowrap">${esc(displayDate(x.performedAt))}</td><td class="p-2">${esc(x.performedBy||'')}</td><td class="p-2">${esc(x.performedByRole||'')}</td><td class="p-2">${esc(x.module||'')}</td><td class="p-2">${esc(friendly(x.actionType))}</td><td class="p-2">${esc(x.targetName||'')}</td><td class="p-2">${esc((x.changedFields||[]).join(', ')||'—')}</td><td class="p-2 max-w-[250px]">${esc(x.remark||'')}</td><td class="p-2"><button data-audit-detail="${x.id}" class="bg-slate-700 px-2 py-1 rounded text-[10px]">View</button></td></tr>`).join('')||'<tr><td colspan="10" class="p-4 text-center text-slate-500">No audit records.</td></tr>';
  document.querySelectorAll('[data-audit-detail]').forEach(btn=>btn.onclick=()=>showDetail(btn.dataset.auditDetail));
}

function showDetail(id){const x=records.find(y=>y.id===id);if(!x)return;alert(`${x.summary||friendly(x.actionType)}\n\nBefore:\n${JSON.stringify(x.beforeValue,null,2)}\n\nAfter:\n${JSON.stringify(x.afterValue,null,2)}\n\nRemark: ${x.remark||'—'}\nBy: ${x.performedBy} (${x.performedByRole})\nAt: ${x.performedAt}`);}
async function exportAudit(selected){if(!can('audit.export.csv'))return;let rows=filtered;if(selected){const ids=[...document.querySelectorAll('.imsAuditRowCheck:checked')].map(x=>x.value);rows=filtered.filter(x=>ids.includes(x.id));if(!rows.length){alert('Select audit rows first.');return;}}const out=rows.map(x=>({Date:x.performedAt,User:x.performedBy,Role:x.performedByRole,Module:x.module,Action:friendly(x.actionType),Target:x.targetName,Changed:(x.changedFields||[]).join(', '),Before:JSON.stringify(x.beforeValue),After:JSON.stringify(x.afterValue),Remark:x.remark||''}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(out),'Audit');XLSX.writeFile(wb,`IMS_Audit_${selected?'Selected':'Filtered'}_${nowISO().slice(0,10)}.xlsx`);try{await writeAudit('EXPORT_AUDIT',selected?'Selected Audit Export':'Filtered Audit Export',{count:rows.length});}catch(error){console.warn('Audit export succeeded but export trace failed:',error);}}

function interceptNavigation(){document.addEventListener('click',async event=>{const btn=event.target.closest?.('.navBtn[data-tab="audit"]');if(!btn||!can('audit.view'))return;event.preventDefault();event.stopImmediatePropagation();try{await reload();render();}catch(error){console.error('IMS audit module failed:',error);renderError(error);}},true);}

interceptNavigation();
window.IMSAudit=Object.freeze({reload,render,applyFilters});
window.dispatchEvent(new CustomEvent('ims:audit-ready'));
export { reload, render, applyFilters };
