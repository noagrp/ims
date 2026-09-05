import { auth, db } from '../../firebase-config.js';
import { addDoc, collection, getCountFromServer, getDocs, limit, orderBy, query, startAfter, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';

const PAGE_SIZE=50;
const inputCls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500';
let records=[],filtered=[],page=0,total=0,loading=false,pageStates=[{all:null,admin:null,own:null}],sort={field:'performedAt',dir:'desc'};
const byId=id=>document.getElementById(id);
const nowISO=()=>new Date().toISOString();
const norm=s=>String(s??'').trim().toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const friendly=s=>String(s||'').toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const displayDate=v=>v?new Date(v).toLocaleString():'';
const label=(txt,html)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${txt}</span>${html}</label>`;
const card=(title,body,extra='')=>`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl ${extra}"><h2 class="font-bold text-sm sm:text-base mb-4">${title}</h2>${body}</section>`;

function isSuper(){return can('users.role.edit');}
function filterState(){return{role:byId('imsAuditRole')?.value||'',module:(byId('imsAuditModuleFilter')?.value||'').trim(),from:byId('imsAuditFrom')?.value||'',to:byId('imsAuditTo')?.value||''};}
function streams(f){if(isSuper())return['all'];if(f.role==='admin')return['admin'];if(f.role==='self')return['own'];return['admin','own'];}
function constraints(kind,f,cursor=null,withPage=true){const a=[],email=auth.currentUser?.email||'';if(kind==='all'&&f.role)a.push(where('performedByRole','==',f.role));if(kind==='admin')a.push(where('performedByRole','==','admin'));if(kind==='own'){a.push(where('performedByRole','==','manager'));a.push(where('performedBy','==',email));}if(f.module)a.push(where('module','==',f.module));if(f.from)a.push(where('performedAt','>=',`${f.from}T00:00:00`));if(f.to)a.push(where('performedAt','<=',`${f.to}T23:59:59.999`));a.push(orderBy('performedAt','desc'));if(withPage&&cursor)a.push(startAfter(cursor));if(withPage)a.push(limit(PAGE_SIZE));return a;}
function build(kind,f,cursor=null,withPage=true){return query(collection(db,'audit_traces'),...constraints(kind,f,cursor,withPage));}
async function fetchStream(kind,f,cursor){const snap=await getDocs(build(kind,f,cursor,true));return{kind,docs:snap.docs};}
async function countStream(kind,f){const snap=await getCountFromServer(build(kind,f,null,false));return snap.data().count;}
function blankState(){return{all:null,admin:null,own:null};}

async function reload(reset=false){
  if(!can('audit.view')){records=[];filtered=[];total=0;return records;}
  if(loading)return records;
  loading=true;
  if(reset){page=0;pageStates=[blankState()];}
  const f=filterState(),kinds=streams(f),state=pageStates[page]||blankState();
  if(byId('imsAuditBody'))byId('imsAuditBody').innerHTML='<tr><td colspan="10" class="p-5 text-center text-slate-500">Loading...</td></tr>';
  try{
    const [parts,counts]=await Promise.all([
      Promise.all(kinds.map(k=>fetchStream(k,f,state[k]))),
      Promise.all(kinds.map(k=>countStream(k,f)))
    ]);
    total=counts.reduce((n,v)=>n+v,0);
    const merged=parts.flatMap(p=>p.docs.map(docSnap=>({kind:p.kind,docSnap,data:{id:docSnap.id,...docSnap.data()}}))).sort((a,b)=>String(b.data.performedAt||'').localeCompare(String(a.data.performedAt||'')));
    const selected=merged.slice(0,PAGE_SIZE);
    records=selected.map(x=>x.data);
    const next={...state};
    for(const kind of kinds){const consumed=selected.filter(x=>x.kind===kind);if(consumed.length)next[kind]=consumed[consumed.length-1].docSnap;}
    pageStates[page+1]=next;
    if(byId('imsAuditIndexNote'))byId('imsAuditIndexNote').textContent='';
    applyPageSearch();
    return records;
  }catch(error){
    console.error('IMS audit server query failed:',error);
    records=[];filtered=[];
    if(byId('imsAuditIndexNote'))byId('imsAuditIndexNote').textContent='Audit query unavailable. Check required Firestore indexes / rules.';
    renderRows();
    throw error;
  }finally{loading=false;}
}

async function writeAudit(actionType,targetName,afterValue={}){const user=auth.currentUser;if(!user)return;await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType,module:'Audit',targetType:'audit_export',targetName,targetId:'',summary:`${friendly(actionType)}: ${targetName}`,beforeValue:null,afterValue,changedFields:[],remark:'',metadata:{source:'audit-module'},performedBy:user.email||'',performedByRole:window.IMS_ROLE||'',performedAt:nowISO()});}
function setHeader(){if(byId('pageTitle'))byId('pageTitle').textContent='Audit / Trace';if(byId('pageSubtitle'))byId('pageSubtitle').textContent=isSuper()?'Immutable system change history · server paginated.':'Admin audit records plus your own actions · server paginated.';document.querySelectorAll('.navBtn[data-tab]').forEach(btn=>{btn.className=`navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold ${btn.dataset.tab==='audit'?'bg-red-600 text-white':'bg-slate-800/50 hover:bg-slate-800'}`;});}
function roleOptions(){return isSuper()?['admin','manager','superadmin']:['admin','self'];}

function render(){
  if(!can('audit.view'))return;
  const mount=byId('appContent');if(!mount)return;
  setHeader();
  const roles=roleOptions();
  const exportButtons=can('audit.export.csv')?`<div class="flex flex-wrap gap-2 mt-3"><button id="imsAuditExport" class="bg-violet-700 px-4 py-2 rounded-lg text-xs font-bold">Export Current Page Excel</button><button id="imsAuditExportSelected" class="bg-cyan-700 px-4 py-2 rounded-lg text-xs font-bold">Export Selected Excel</button></div>`:'';
  mount.innerHTML=`<div id="imsAuditModule" class="space-y-5">${card('Audit Filters',`<div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">${label('Search Current Page',`<input id="imsAuditSearch" class="${inputCls}" placeholder="User, item, action, remark...">`)}${label('Role',`<select id="imsAuditRole" class="${inputCls}"><option value="">All Visible</option>${roles.map(r=>`<option value="${r}">${r==='self'?'My Actions':r[0].toUpperCase()+r.slice(1)}</option>`).join('')}</select>`)}${label('Module',`<input id="imsAuditModuleFilter" class="${inputCls}" placeholder="Exact module, optional">`)}${label('From Date',`<input type="date" id="imsAuditFrom" class="${inputCls}">`)}${label('To Date',`<input type="date" id="imsAuditTo" class="${inputCls}">`)}</div><div class="flex flex-wrap gap-2 mt-3"><button id="imsAuditApply" class="bg-red-600 px-4 py-2 rounded-lg text-xs font-bold">Apply</button><button id="imsAuditReset" class="bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold">Reset</button>${exportButtons}</div><div id="imsAuditIndexNote" class="text-[11px] text-amber-400 mt-2"></div>`)}${card('System Audit',`<div id="imsAuditCount" class="text-xs text-slate-500 mb-2"></div><div class="overflow-auto max-h-[68vh] border border-slate-800 rounded-xl"><table class="w-full min-w-[1250px] text-xs"><thead class="sticky top-0 bg-slate-950 text-slate-400"><tr><th class="p-2"><input id="imsAuditSelectAll" type="checkbox"></th>${[['performedAt','Date'],['performedBy','User'],['performedByRole','Role'],['module','Module'],['actionType','Action'],['targetName','Target'],['changedFields','Changed'],['remark','Remark']].map(([f,n])=>`<th class="p-2 text-left cursor-pointer imsAuditSort" data-field="${f}">${n} ↕</th>`).join('')}<th class="p-2">Details</th></tr></thead><tbody id="imsAuditBody"></tbody></table></div><div class="flex items-center justify-between gap-2 mt-3"><button id="imsAuditPrev" class="bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40">Previous</button><button id="imsAuditNext" class="bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40">Next</button></div>`)}</div>`;
  byId('imsAuditSearch').oninput=applyPageSearch;
  byId('imsAuditApply').onclick=()=>reload(true).catch(()=>{});
  byId('imsAuditReset').onclick=()=>renderAndLoad();
  document.querySelectorAll('.imsAuditSort').forEach(h=>h.onclick=()=>{sort={field:h.dataset.field,dir:sort.field===h.dataset.field&&sort.dir==='asc'?'desc':'asc'};applyPageSearch();});
  byId('imsAuditSelectAll').onchange=e=>document.querySelectorAll('.imsAuditRowCheck').forEach(x=>x.checked=e.target.checked);
  byId('imsAuditPrev').onclick=()=>{if(page>0){page--;reload(false).catch(()=>{});}};
  byId('imsAuditNext').onclick=()=>{if((page+1)*PAGE_SIZE<total){page++;reload(false).catch(()=>{});}};
  if(byId('imsAuditExport'))byId('imsAuditExport').onclick=()=>exportAudit(false);
  if(byId('imsAuditExportSelected'))byId('imsAuditExportSelected').onclick=()=>exportAudit(true);
}

function renderRows(){
  const body=byId('imsAuditBody');if(!body)return;
  body.innerHTML=filtered.map(x=>`<tr class="border-t border-slate-900"><td class="p-2"><input class="imsAuditRowCheck" value="${x.id}" type="checkbox"></td><td class="p-2 whitespace-nowrap">${esc(displayDate(x.performedAt))}</td><td class="p-2">${esc(x.performedBy||'')}</td><td class="p-2">${esc(x.performedByRole||'')}</td><td class="p-2">${esc(x.module||'')}</td><td class="p-2">${esc(friendly(x.actionType))}</td><td class="p-2">${esc(x.targetName||'')}</td><td class="p-2">${esc((x.changedFields||[]).join(', ')||'—')}</td><td class="p-2 max-w-[250px]">${esc(x.remark||'')}</td><td class="p-2"><button data-audit-detail="${x.id}" class="bg-slate-700 px-2 py-1 rounded text-[10px]">View</button></td></tr>`).join('')||'<tr><td colspan="10" class="p-4 text-center text-slate-500">No audit records on this page.</td></tr>';
  const start=total?page*PAGE_SIZE+1:0,end=Math.min(page*PAGE_SIZE+records.length,total);
  if(byId('imsAuditCount'))byId('imsAuditCount').textContent=`Showing ${start}–${end} of ${total} visible audit record(s) · Page ${page+1} of ${Math.max(1,Math.ceil(total/PAGE_SIZE))}${filtered.length!==records.length?` · ${filtered.length} match current-page search`:''}`;
  if(byId('imsAuditPrev'))byId('imsAuditPrev').disabled=page===0;
  if(byId('imsAuditNext'))byId('imsAuditNext').disabled=end>=total;
  document.querySelectorAll('[data-audit-detail]').forEach(btn=>btn.onclick=()=>showDetail(btn.dataset.auditDetail));
}
function applyPageSearch(){const q=norm(byId('imsAuditSearch')?.value||'');filtered=records.filter(x=>!q||norm(JSON.stringify(x)).includes(q));filtered.sort((a,b)=>{const av=Array.isArray(a[sort.field])?a[sort.field].join(', '):(a[sort.field]??''),bv=Array.isArray(b[sort.field])?b[sort.field].join(', '):(b[sort.field]??''),c=String(av).localeCompare(String(bv));return sort.dir==='asc'?c:-c;});renderRows();}
function showDetail(id){const x=records.find(y=>y.id===id);if(!x)return;alert(`${x.summary||friendly(x.actionType)}\n\nBefore:\n${JSON.stringify(x.beforeValue,null,2)}\n\nAfter:\n${JSON.stringify(x.afterValue,null,2)}\n\nRemark: ${x.remark||'—'}\nBy: ${x.performedBy} (${x.performedByRole})\nAt: ${x.performedAt}`);}
async function exportAudit(selected){if(!can('audit.export.csv'))return;let rows=filtered;if(selected){const ids=[...document.querySelectorAll('.imsAuditRowCheck:checked')].map(x=>x.value);rows=filtered.filter(x=>ids.includes(x.id));if(!rows.length){alert('Select audit rows first.');return;}}if(!rows.length)return alert('No audit rows on this page.');const out=rows.map(x=>({Date:x.performedAt,User:x.performedBy,Role:x.performedByRole,Module:x.module,Action:friendly(x.actionType),Target:x.targetName,Changed:(x.changedFields||[]).join(', '),Before:JSON.stringify(x.beforeValue),After:JSON.stringify(x.afterValue),Remark:x.remark||''}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(out),'Audit');XLSX.writeFile(wb,`IMS_Audit_Page_${page+1}_${selected?'Selected':'Visible'}_${nowISO().slice(0,10)}.xlsx`);try{await writeAudit('EXPORT_AUDIT',selected?'Selected Audit Export':'Current Page Audit Export',{count:rows.length,page:page+1});}catch(error){console.warn('Audit export succeeded but export trace failed:',error);}}
function renderError(error){setHeader();const mount=byId('appContent');if(!mount)return;mount.innerHTML=`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5"><h2 class="font-bold">Audit / Trace</h2><div class="text-sm text-amber-300 mt-3">Unable to load audit records.</div><div class="text-xs text-slate-500 mt-2">${esc(error?.message||String(error))}</div></section>`;}
async function renderAndLoad(){render();try{await reload(true);}catch(error){console.error('IMS audit module failed:',error);}}
function interceptNavigation(){document.addEventListener('click',async event=>{const btn=event.target.closest?.('.navBtn[data-tab="audit"]');if(!btn||!can('audit.view'))return;event.preventDefault();event.stopImmediatePropagation();try{await renderAndLoad();}catch(error){renderError(error);}},true);}
interceptNavigation();
window.IMSAudit=Object.freeze({reload,render:renderAndLoad,applyFilters:applyPageSearch});
window.dispatchEvent(new CustomEvent('ims:audit-ready'));
export { reload, renderAndLoad as render, applyPageSearch as applyFilters };
