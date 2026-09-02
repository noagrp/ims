import { auth, db } from '../../firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';

// Optional Global Settings / Independent Item Masters module.
// If unavailable, the legacy settings screen remains the fallback.

const inputCls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500';
const MASTER_GROUPS=Object.freeze([
  {type:'warehouse',label:'Warehouses'},
  {type:'unit',label:'Units'},
  {type:'category',label:'Categories'},
  {type:'brand',label:'Brands'},
  {type:'model',label:'Models'},
  {type:'grade',label:'Grades'},
  {type:'specification',label:'Specifications'}
]);

let settings=[];
const byId=id=>document.getElementById(id);
const nowISO=()=>new Date().toISOString();
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const card=(title,body,extra='')=>`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl ${extra}"><h2 class="font-bold text-sm sm:text-base mb-4">${title}</h2>${body}</section>`;

async function reload(){
  const snap=await getDocs(collection(db,'settings'));
  settings=snap.docs.map(d=>({id:d.id,...d.data()}));
  return settings;
}

function itemsFor(type){
  return settings.filter(x=>x.type===type).sort((a,b)=>String(a.value||'').localeCompare(String(b.value||''),undefined,{numeric:true,sensitivity:'base'}));
}

async function writeAudit(actionType,targetType,targetName,beforeValue=null,afterValue=null,remark='',targetId=''){
  const user=auth.currentUser;
  if(!user)return;
  await addDoc(collection(db,'audit_traces'),{
    traceVersion:3,
    actionType,
    module:'Global Settings',
    targetType,
    targetName:String(targetName||''),
    targetId:String(targetId||''),
    summary:`${String(actionType||'').replace(/_/g,' ')}: ${targetName||targetType}`,
    beforeValue,
    afterValue,
    changedFields:[],
    remark:String(remark||''),
    metadata:{source:'masters-module'},
    performedBy:user.email||'',
    performedByRole:window.IMS_ROLE||'',
    performedAt:nowISO()
  });
}

function masterCard(group){
  const editable=can('masters.add');
  const statusable=can('masters.status');
  const rows=itemsFor(group.type);
  const singular=group.label.replace(/s$/,'');
  return card(group.label,`
    <p class="text-[11px] text-slate-500 mb-3">Values are never deleted. Deactivate obsolete values so historical records remain traceable.</p>
    ${editable?`<form class="imsMasterForm flex flex-col sm:flex-row gap-2 mb-3" data-type="${group.type}"><input class="imsMasterInput ${inputCls}" required placeholder="Add ${esc(singular)}"><button class="bg-red-600 px-4 py-2.5 rounded-lg text-xs font-bold sm:w-28">Add</button></form>`:'<div class="text-[11px] text-slate-500 mb-3">View only for this role.</div>'}
    <div class="space-y-2">${rows.map(x=>`<div class="bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-between items-center gap-3"><div class="min-w-0"><span class="text-sm break-words">${esc(x.value)}</span> <span class="text-[10px] ${x.status==='inactive'?'text-amber-400':'text-emerald-400'}">${esc(x.status||'active')}</span></div>${statusable?`<button data-master-toggle="${x.id}" data-master-type="${group.type}" class="bg-slate-700 px-2 py-1 rounded text-[10px] shrink-0">${x.status==='inactive'?'Activate':'Deactivate'}</button>`:''}</div>`).join('')||'<div class="text-xs text-slate-500">No records.</div>'}</div>
  `);
}

function setHeader(){
  if(byId('pageTitle'))byId('pageTitle').textContent='Global Settings';
  if(byId('pageSubtitle'))byId('pageSubtitle').textContent='Warehouses, units and independent item masters. Values are deactivated, not deleted.';
  document.querySelectorAll('.navBtn[data-tab]').forEach(btn=>{
    btn.className=`navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold ${btn.dataset.tab==='settings'?'bg-red-600 text-white':'bg-slate-800/50 hover:bg-slate-800'}`;
  });
}

function render(){
  const mount=byId('appContent');
  if(!mount||!can('masters.view'))return;
  setHeader();
  mount.innerHTML=`<div id="imsMastersModule" class="space-y-5">
    ${card('Global Settings',`<p class="text-sm text-slate-300">Operational location/unit masters and item classification masters are managed independently below.</p><p class="text-xs text-slate-500 mt-2">Category, Brand, Model, Grade and Specification are independent values; no relationship is implied between them.</p>`)}
    <div class="grid lg:grid-cols-2 gap-5">${MASTER_GROUPS.map(masterCard).join('')}</div>
  </div>`;
  mount.querySelectorAll('.imsMasterForm').forEach(form=>form.onsubmit=createMaster);
  mount.querySelectorAll('[data-master-toggle]').forEach(btn=>btn.onclick=()=>toggleMaster(btn.dataset.masterToggle,btn.dataset.masterType));
}

async function createMaster(e){
  e.preventDefault();
  if(!can('masters.add'))return;
  const form=e.currentTarget;
  const type=form.dataset.type;
  const input=form.querySelector('.imsMasterInput');
  const value=input.value.trim().replace(/\s+/g,' ');
  if(!value)return;
  if(settings.some(x=>x.type===type&&norm(x.value)===norm(value))){alert('This value already exists. Activate the existing record if needed.');return;}
  const ref=await addDoc(collection(db,'settings'),{
    type,
    value,
    normalizedValue:norm(value),
    status:'active',
    createdAt:nowISO(),
    createdBy:auth.currentUser?.email||''
  });
  await writeAudit('CREATE_MASTER',type,value,null,{value,status:'active'},'',ref.id);
  await reload();
  render();
}

async function toggleMaster(id,type){
  if(!can('masters.status'))return;
  const x=settings.find(s=>s.id===id);
  if(!x)return;
  const status=x.status==='inactive'?'active':'inactive';
  const reason=prompt(`Reason for ${status==='inactive'?'deactivating':'activating'} ${x.value} (required)`,'');
  if(!reason?.trim())return;
  await updateDoc(doc(db,'settings',id),{
    status,
    updatedAt:nowISO(),
    updatedBy:auth.currentUser?.email||''
  });
  await writeAudit('CHANGE_MASTER_STATUS',type,x.value,{status:x.status||'active'},{status},reason.trim(),id);
  await reload();
  render();
}

function interceptNavigation(){
  document.addEventListener('click',async event=>{
    const btn=event.target.closest?.('.navBtn[data-tab="settings"]');
    if(!btn||!can('masters.view'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      await reload();
      render();
    }catch(error){
      console.warn('IMS masters module failed; legacy fallback remains available.',error);
    }
  },true);
}

interceptNavigation();
window.IMSMasters=Object.freeze({reload,render,groups:MASTER_GROUPS});
window.dispatchEvent(new CustomEvent('ims:masters-ready'));

export { reload, render, MASTER_GROUPS };
