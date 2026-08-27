import { auth, db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const ROLE=window.IMS_ROLE||'admin';
const CAN_MASTER=['manager','superadmin'].includes(ROLE);
const byId=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const field=(t,h)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${t}</span>${h}</label>`;
const now=()=>new Date().toISOString();
let classificationRendering=false;
let classificationSaving=false;

async function load(name){
  try{const s=await getDocs(collection(db,name));return s.docs.map(d=>({id:d.id,...d.data()}));}
  catch(e){console.warn(`IMS enhancement: unable to load ${name}`,e);return[];}
}
async function audit(action,targetType,targetName,targetId,beforeValue,afterValue,remark=''){
  const u=auth.currentUser;if(!u)return;
  await addDoc(collection(db,'audit_traces'),{
    traceVersion:3,actionType:action,module:'IMS Enhancement',targetType,targetName:String(targetName||''),targetId:String(targetId||''),
    summary:`${action.replace(/_/g,' ')}: ${targetName||targetType}`,beforeValue:beforeValue??null,afterValue:afterValue??null,
    changedFields:Object.keys(afterValue||{}),remark,metadata:{source:'ims-enhancements.js'},performedBy:u.email||'',performedByRole:ROLE,performedAt:now()
  });
}

function css(){
  if(byId('imsEnhCss'))return;
  const s=document.createElement('style');s.id='imsEnhCss';
  s.textContent=`main>div.max-w-7xl{max-width:none!important;width:100%!important}#appContent>.grid:has(>section){grid-template-columns:minmax(0,1fr)!important}#appContent>.grid:has(>section)>section{width:100%;min-width:0}.ims-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}@media(min-width:768px){.ims-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(min-width:1280px){.ims-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}`;
  document.head.appendChild(s);
}

function stockTab(){
  const n=byId('navTabs');if(!n||byId('imsStockTab'))return;
  const b=document.createElement('button');b.id='imsStockTab';b.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800';b.textContent='Stock Monitor';b.onclick=renderStock;n.insertBefore(b,n.children[1]||null);
}

async function activeMaster(type){return (await load('settings')).filter(x=>x.type===type&&x.status!=='inactive');}
function selectedMeta(id){const e=byId(id),o=e?.selectedOptions?.[0];return {id:e?.value||'',value:o?.dataset?.v||o?.textContent?.trim()||''};}

async function registrationHierarchy(){
  const form=byId('registerForm'),cat=byId('itemCategory');if(!form||!cat||byId('itemBrand'))return;
  const wrap=document.createElement('div');wrap.className='sm:col-span-2 grid sm:grid-cols-3 gap-3';
  wrap.innerHTML=field('Brand (optional)',`<select id="itemBrand" class="${cls}"><option value="">-- Brand --</option></select>`)+field('Model (optional)',`<select id="itemModel" class="${cls}"><option value="">-- Model --</option></select>`)+field('Specification (optional)',`<select id="itemSpecification" class="${cls}"><option value="">-- Specification --</option></select>`);
  cat.closest('label')?.insertAdjacentElement('afterend',wrap);
  const refresh=async()=>{
    const settings=await load('settings'),cv=cat.value,b=byId('itemBrand'),m=byId('itemModel'),sp=byId('itemSpecification');
    const brands=settings.filter(x=>x.type==='brand'&&x.status!=='inactive'&&(!x.category||norm(x.category)===norm(cv)));
    const oldB=b.value;b.innerHTML='<option value="">-- Brand --</option>'+brands.map(x=>`<option value="${x.id}" data-v="${esc(x.value)}">${esc(x.value)}</option>`).join('');if([...b.options].some(o=>o.value===oldB))b.value=oldB;
    const bv=selectedMeta('itemBrand').value;
    const models=settings.filter(x=>x.type==='model'&&x.status!=='inactive'&&(!x.category||norm(x.category)===norm(cv))&&(!x.brand||norm(x.brand)===norm(bv)));
    const oldM=m.value;m.innerHTML='<option value="">-- Model --</option>'+models.map(x=>`<option value="${x.id}" data-v="${esc(x.value)}">${esc(x.value)}</option>`).join('');if([...m.options].some(o=>o.value===oldM))m.value=oldM;
    const mv=selectedMeta('itemModel').value;
    const specs=settings.filter(x=>x.type==='specification'&&x.status!=='inactive'&&(!x.category||norm(x.category)===norm(cv))&&(!x.brand||norm(x.brand)===norm(bv))&&(!x.model||norm(x.model)===norm(mv)));
    const oldS=sp.value;sp.innerHTML='<option value="">-- Specification --</option>'+specs.map(x=>`<option value="${x.id}" data-v="${esc(x.value)}">${esc(x.value)}</option>`).join('');if([...sp.options].some(o=>o.value===oldS))sp.value=oldS;
  };
  cat.addEventListener('change',refresh);byId('itemBrand').addEventListener('change',refresh);byId('itemModel').addEventListener('change',refresh);refresh();
}

document.addEventListener('submit',e=>{
  if(e.target?.id!=='registerForm')return;
  const code=byId('itemCode')?.value.trim();if(!code||!byId('itemSpecification'))return;
  const brand=selectedMeta('itemBrand'),model=selectedMeta('itemModel'),spec=selectedMeta('itemSpecification');
  const meta={brandId:brand.id,brand:brand.value,modelId:model.id,model:model.value,specificationId:spec.id,specification:spec.value,lastEditedAt:now(),lastEditedBy:auth.currentUser?.email||''};
  setTimeout(async()=>{for(let i=0;i<8;i++){const q=await getDocs(query(collection(db,'inventory'),where('itemCode','==',code)));if(!q.empty){const ref=q.docs[0],before=ref.data();await updateDoc(doc(db,'inventory',ref.id),meta);await audit('SET_ITEM_CLASSIFICATION','inventory',code,ref.id,{brand:before.brand||'',model:before.model||'',specification:before.specification||''},{brand:brand.value,model:model.value,specification:spec.value},'Classification captured during registration.');break;}await new Promise(r=>setTimeout(r,500));}},250);
},true);

function clientFields(){
  const st=byId('clientPositionStatus'),w=byId('moveDestinationWrap');if(!st||!w||byId('imsCommercial'))return;
  if(![...st.options].some(o=>o.value==='Sale'))st.insertAdjacentHTML('beforeend','<option>Sale</option>');
  const x=document.createElement('div');x.id='imsCommercial';x.className='mt-3 border-t border-slate-800 pt-3';
  x.innerHTML=`<div class="text-xs font-semibold text-emerald-400 mb-2">Client / Commercial Details</div><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">${field('From',`<input type="date" id="imsFrom" class="${cls}">`)}${field('To / Expected Return',`<input type="date" id="imsTo" class="${cls}">`)}${field('Currency',`<input id="imsCurrency" value="MYR" class="${cls}">`)}${field('Rate Basis',`<select id="imsRate" class="${cls}"><option value="unit">Per Unit</option><option value="day">Per Day</option><option value="week">Per Week</option><option value="month">Per Month</option><option value="flat">Flat Rate</option></select>`)}${field('Unit Price',`<input type="number" id="imsPrice" min="0" step="0.01" class="${cls}">`)}${field('Total Amount',`<input type="number" id="imsTotal" min="0" step="0.01" class="${cls}">`)}</div>`;
  w.appendChild(x);
  const calc=()=>{const t=byId('imsTotal');if(t&&!t.dataset.manual)t.value=(Number(byId('moveQty')?.value||0)*Number(byId('imsPrice')?.value||0)).toFixed(2);};
  byId('moveQty')?.addEventListener('input',calc);byId('imsPrice')?.addEventListener('input',calc);byId('imsTotal')?.addEventListener('input',()=>byId('imsTotal').dataset.manual='1');
}

document.addEventListener('submit',e=>{
  if(e.target?.id!=='moveForm')return;const itemId=byId('moveItem')?.value;if(!itemId||!byId('imsCommercial'))return;
  const meta={clientTransactionType:byId('clientPositionStatus')?.value||'',periodFrom:byId('imsFrom')?.value||'',periodTo:byId('imsTo')?.value||'',currency:byId('imsCurrency')?.value||'MYR',rateBasis:byId('imsRate')?.value||'unit',unitPrice:Number(byId('imsPrice')?.value||0),totalAmount:Number(byId('imsTotal')?.value||0)};
  setTimeout(async()=>{for(let i=0;i<8;i++){const q=await getDocs(query(collection(db,'movements'),where('itemId','==',itemId)));const a=q.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==='in_transit'&&x.createdBy===(auth.currentUser?.email||'')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));if(a[0]){await updateDoc(doc(db,'movements',a[0].id),meta);await audit('SET_COMMERCIAL_DETAILS','movement',a[0].itemCode||itemId,a[0].id,null,meta,'Client delivery commercial details.');break;}await new Promise(r=>setTimeout(r,500));}},250);
},true);

function maintPeriod(){
  const f=byId('maintenanceForm');if(!f||byId('imsMaintPeriod'))return;
  const x=document.createElement('div');x.id='imsMaintPeriod';x.className='grid sm:grid-cols-2 gap-3';x.innerHTML=field('Maintenance From',`<input type="date" id="imsMaintFrom" class="${cls}">`)+field('Expected / Actual To',`<input type="date" id="imsMaintTo" class="${cls}">`);byId('maintProvider')?.closest('label')?.insertAdjacentElement('beforebegin',x);
}

document.addEventListener('submit',e=>{
  if(e.target?.id!=='maintenanceForm')return;const itemId=byId('maintItem')?.value;if(!itemId)return;
  const meta={maintenanceFrom:byId('imsMaintFrom')?.value||byId('maintDate')?.value||'',maintenanceTo:byId('imsMaintTo')?.value||''};
  setTimeout(async()=>{for(let i=0;i<8;i++){const q=await getDocs(query(collection(db,'maintenance_events'),where('itemId','==',itemId)));const a=q.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.createdBy===(auth.currentUser?.email||'')).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)));if(a[0]){await updateDoc(doc(db,'maintenance_events',a[0].id),meta);await audit('SET_MAINTENANCE_PERIOD','maintenance_event',a[0].itemCode||itemId,a[0].id,null,meta,'Maintenance period captured.');break;}await new Promise(r=>setTimeout(r,500));}},250);
},true);

async function classificationManager(){
  const c=byId('appContent');
  if(!c||byId('imsClassificationManager')||classificationRendering||!/Global Settings/i.test(byId('pageTitle')?.textContent||''))return;
  classificationRendering=true;
  try{
    const s=await load('settings');
    if(!byId('appContent')||byId('imsClassificationManager')||!/Global Settings/i.test(byId('pageTitle')?.textContent||''))return;
    const cats=s.filter(x=>x.type==='category'&&x.status!=='inactive'),brands=s.filter(x=>x.type==='brand'),models=s.filter(x=>x.type==='model'),specs=s.filter(x=>x.type==='specification');
    const activeBrands=brands.filter(x=>x.status!=='inactive'),activeModels=models.filter(x=>x.status!=='inactive');
    const x=document.createElement('section');x.id='imsClassificationManager';x.className='bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl mt-5';
    x.innerHTML=`<h2 class="font-bold mb-1">Brand / Model / Specification</h2><p class="text-xs text-slate-500 mb-4">Optional configurable classification. Values are added as master records; existing values are not deleted or silently renamed.</p>
    ${CAN_MASTER?`<div class="space-y-4">
     <form id="imsBrandForm" class="grid sm:grid-cols-[220px_1fr_auto] gap-2 items-end">${field('Category',`<select id="imsBrandCat" required class="${cls}"><option value="">-- Category --</option>${cats.map(a=>`<option>${esc(a.value)}</option>`).join('')}</select>`)}${field('Brand',`<input id="imsBrandVal" required class="${cls}" placeholder="e.g. manufacturer / brand">`)}<button class="bg-emerald-700 px-4 py-2.5 rounded-lg text-xs font-bold">Add Brand</button></form>
     <form id="imsModelForm" class="grid sm:grid-cols-2 lg:grid-cols-[200px_220px_1fr_auto] gap-2 items-end">${field('Category',`<select id="imsModelCat" required class="${cls}"><option value="">-- Category --</option>${cats.map(a=>`<option>${esc(a.value)}</option>`).join('')}</select>`)}${field('Brand (optional)',`<select id="imsModelBrand" class="${cls}"><option value="">-- Any / none --</option>${activeBrands.map(a=>`<option>${esc(a.value)}</option>`).join('')}</select>`)}${field('Model',`<input id="imsModelVal" required class="${cls}" placeholder="Model / series">`)}<button class="bg-cyan-700 px-4 py-2.5 rounded-lg text-xs font-bold">Add Model</button></form>
     <form id="imsSpecForm" class="grid sm:grid-cols-2 lg:grid-cols-[180px_180px_180px_1fr_auto] gap-2 items-end">${field('Category',`<select id="imsSpecCat" required class="${cls}"><option value="">-- Category --</option>${cats.map(a=>`<option>${esc(a.value)}</option>`).join('')}</select>`)}${field('Brand (optional)',`<select id="imsSpecBrand" class="${cls}"><option value="">-- Any / none --</option>${activeBrands.map(a=>`<option>${esc(a.value)}</option>`).join('')}</select>`)}${field('Model (optional)',`<select id="imsSpecModel" class="${cls}"><option value="">-- Any / none --</option>${activeModels.map(a=>`<option>${esc(a.value)}</option>`).join('')}</select>`)}${field('Specification',`<input id="imsSpecVal" required class="${cls}" placeholder="Technical specification / variant">`)}<button class="bg-amber-700 px-4 py-2.5 rounded-lg text-xs font-bold">Add Specification</button></form>
    </div>`:''}
    <div class="mt-5 grid md:grid-cols-3 gap-3"><div><div class="text-xs font-bold mb-2">Brands</div>${brands.map(a=>masterRow(a)).join('')||empty()}</div><div><div class="text-xs font-bold mb-2">Models</div>${models.map(a=>masterRow(a)).join('')||empty()}</div><div><div class="text-xs font-bold mb-2">Specifications</div>${specs.map(a=>masterRow(a)).join('')||empty()}</div></div>`;
    byId('appContent').appendChild(x);

    const create=async(type,data,form)=>{
      if(classificationSaving)return;
      classificationSaving=true;
      const button=form?.querySelector('button[type="submit"],button');
      if(button){button.disabled=true;button.classList.add('opacity-60','cursor-not-allowed');}
      try{
        const current=await load('settings');
        const duplicate=current.find(r=>r.type===type&&r.status!=='inactive'&&norm(r.value)===norm(data.value)&&norm(r.category||'')===norm(data.category||'')&&norm(r.brand||'')===norm(data.brand||'')&&norm(r.model||'')===norm(data.model||''));
        if(duplicate){alert(`${type.charAt(0).toUpperCase()+type.slice(1)} already exists. Nothing was saved.`);return;}
        const ref=await addDoc(collection(db,'settings'),{type,...data,status:'active',createdAt:now(),createdBy:auth.currentUser?.email||''});
        await audit('CREATE_MASTER_VALUE','setting',`${type}: ${data.value}`,ref.id,null,{type,...data,status:'active'},'New master value; duplicate checked before save.');
        byId('imsClassificationManager')?.remove();
        await classificationManager();
      } finally {
        classificationSaving=false;
        if(button&&document.body.contains(button)){button.disabled=false;button.classList.remove('opacity-60','cursor-not-allowed');}
      }
    };
    byId('imsBrandForm')?.addEventListener('submit',e=>{e.preventDefault();if(classificationSaving)return;create('brand',{category:byId('imsBrandCat').value.trim(),value:byId('imsBrandVal').value.trim()},e.currentTarget);});
    byId('imsModelForm')?.addEventListener('submit',e=>{e.preventDefault();if(classificationSaving)return;create('model',{category:byId('imsModelCat').value.trim(),brand:byId('imsModelBrand').value.trim(),value:byId('imsModelVal').value.trim()},e.currentTarget);});
    byId('imsSpecForm')?.addEventListener('submit',e=>{e.preventDefault();if(classificationSaving)return;create('specification',{category:byId('imsSpecCat').value.trim(),brand:byId('imsSpecBrand').value.trim(),model:byId('imsSpecModel').value.trim(),value:byId('imsSpecVal').value.trim()},e.currentTarget);});
  } finally {
    classificationRendering=false;
  }
}
function masterRow(a){return `<div class="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-2"><div class="text-[10px] text-slate-500">${esc([a.category,a.brand,a.model].filter(Boolean).join(' • '))}</div><div class="text-sm">${esc(a.value)}</div><div class="text-[10px] ${a.status==='inactive'?'text-slate-600':'text-emerald-500'}">${esc(a.status||'active')}</div></div>`;}
function empty(){return '<div class="text-xs text-slate-500">None yet.</div>';}
function balances(i){let b=Array.isArray(i.stockBalances)?i.stockBalances:[];if(!b.length)b=[{qty:Number(i.quantity??i.qty??1),locationName:i.currentLocation||'Unknown',status:i.status||''}];return b.filter(x=>Number(x.qty)>0);}

async function renderStock(){
  document.querySelectorAll('.navBtn').forEach(b=>b.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800');
  byId('imsStockTab').className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-600 text-white';byId('pageTitle').textContent='Stock Monitor';byId('pageSubtitle').textContent='Filter category, brand, model, specification, status, client, location and item.';
  const c=byId('appContent');c.innerHTML='<div class="text-sm text-slate-500">Loading...</div>';
  const [inv,mov,clients]=await Promise.all([load('inventory'),load('movements'),load('client_profiles')]);const cm=new Map(clients.map(x=>[x.id,x.companyName||x.clientName||'']));
  const mm=new Map();mov.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).forEach(m=>{if(!mm.has(m.itemId))mm.set(m.itemId,m);});
  const rows=[];inv.forEach(i=>balances(i).forEach(b=>{const m=mm.get(i.id)||{},cid=b.locationType==='client'?b.locationId:(m.toType==='client'?m.toId:'');rows.push({i,b,m,cid,client:cm.get(cid)||m.toName||''});}));
  const opts=a=>[...new Set(a.filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join('');
  c.innerHTML=`<section id="imsStockMonitor" class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5"><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">${field('Category',`<select id="sfCat" class="${cls}"><option value="">All</option>${opts(inv.map(x=>x.category))}</select>`)}${field('Brand',`<select id="sfBrand" class="${cls}"><option value="">All</option>${opts(inv.map(x=>x.brand))}</select>`)}${field('Model',`<select id="sfModel" class="${cls}"><option value="">All</option>${opts(inv.map(x=>x.model))}</select>`)}${field('Specification',`<select id="sfSpec" class="${cls}"><option value="">All</option>${opts(inv.map(x=>x.specification))}</select>`)}${field('Status',`<select id="sfStatus" class="${cls}"><option value="">All</option>${opts(rows.map(x=>x.b.status))}</select>`)}${field('Client',`<select id="sfClient" class="${cls}"><option value="">All</option>${[...new Map(rows.filter(x=>x.cid).map(x=>[x.cid,x.client])).entries()].map(([id,n])=>`<option value="${id}">${esc(n)}</option>`).join('')}</select>`)}${field('Location',`<select id="sfLoc" class="${cls}"><option value="">All</option>${opts(rows.map(x=>x.b.locationName))}</select>`)}${field('Search',`<input id="sfSearch" class="${cls}" placeholder="Serial / name / location">`)}</div><div id="sfKpi" class="ims-kpis mb-4"></div><div id="sfRows" class="space-y-2"></div></section>`;
  function apply(){
    const f={cat:byId('sfCat').value,brand:byId('sfBrand').value,model:byId('sfModel').value,spec:byId('sfSpec').value,status:byId('sfStatus').value,client:byId('sfClient').value,loc:byId('sfLoc').value,q:norm(byId('sfSearch').value)};
    const o=rows.filter(r=>(!f.cat||r.i.category===f.cat)&&(!f.brand||r.i.brand===f.brand)&&(!f.model||r.i.model===f.model)&&(!f.spec||r.i.specification===f.spec)&&(!f.status||r.b.status===f.status)&&(!f.client||r.cid===f.client)&&(!f.loc||r.b.locationName===f.loc)&&(!f.q||norm(`${r.i.itemCode} ${r.i.name} ${r.i.category} ${r.i.brand} ${r.i.model} ${r.i.specification} ${r.b.locationName} ${r.client}`).includes(f.q)));
    const qty=o.reduce((a,r)=>a+Number(r.b.qty||0),0),amt=o.reduce((a,r)=>a+Number(r.m.totalAmount||0),0);
    byId('sfKpi').innerHTML=[['Items',new Set(o.map(r=>r.i.id)).size],['Total Qty',qty],['Specs',new Set(o.map(r=>r.i.specification).filter(Boolean)).size],['Clients',new Set(o.map(r=>r.cid).filter(Boolean)).size],['Locations',new Set(o.map(r=>r.b.locationName)).size],['Amount',`MYR ${amt.toFixed(2)}`]].map(([a,b])=>`<div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><div class="text-lg font-black">${esc(b)}</div><div class="text-[10px] text-slate-500">${a}</div></div>`).join('');
    byId('sfRows').innerHTML=o.map(r=>`<div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><div class="font-semibold">${esc(r.i.itemCode)} — ${esc(r.i.name)}</div><div class="text-xs text-slate-400 mt-1">${esc([r.i.category,r.i.brand,r.i.model,r.i.specification].filter(Boolean).join(' • ')||'No classification')}</div><div class="text-xs text-slate-500 mt-1">${esc(r.b.status||'')} • ${esc(r.b.locationName||'')} • ${esc(r.b.qty)} ${esc(r.i.unit||'')} ${r.client?'• '+esc(r.client):''}</div>${r.m.periodFrom||r.m.periodTo?`<div class="text-[11px] text-slate-500">Period: ${esc(r.m.periodFrom||'')} → ${esc(r.m.periodTo||'Open')}</div>`:''}${r.m.totalAmount?`<div class="text-[11px] text-emerald-400">${esc(r.m.currency||'MYR')} ${Number(r.m.totalAmount).toFixed(2)}</div>`:''}</div>`).join('')||'<div class="text-sm text-slate-500">No matching stock.</div>';
  }
  ['sfCat','sfBrand','sfModel','sfSpec','sfStatus','sfClient','sfLoc','sfSearch'].forEach(id=>byId(id).addEventListener(id==='sfSearch'?'input':'change',apply));apply();
}

async function enhance(){css();stockTab();registrationHierarchy();clientFields();maintPeriod();classificationManager();}
new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
enhance();