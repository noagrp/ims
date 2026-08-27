import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const byId=id=>document.getElementById(id);
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
let stockCache=null;
let logPage=1;
const logPageSize=10;
let logRows=[];
let logPagingBusy=false;

async function loadStockData(force=false){
  if(stockCache&&!force)return stockCache;
  const names=['inventory','movements','client_profiles'];
  const out={};
  for(const n of names){
    try{const s=await getDocs(collection(db,n));out[n]=s.docs.map(d=>({id:d.id,...d.data()}));}
    catch{out[n]=[];}
  }
  const latestMovement=new Map();
  out.movements.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).forEach(m=>{if(!latestMovement.has(m.itemId))latestMovement.set(m.itemId,m);});
  out.latestMovement=latestMovement;
  stockCache=out;
  return out;
}

function itemBalances(i){
  let b=Array.isArray(i.stockBalances)?i.stockBalances:[];
  if(!b.length)b=[{qty:Number(i.quantity??i.qty??1),locationType:'warehouse',locationName:i.currentLocation||'Unknown',status:i.status||''}];
  return b.filter(x=>Number(x.qty)>0).map(x=>({qty:Number(x.qty||0),locationType:x.locationType||'',locationName:x.locationName||x.location||'',status:x.status||''}));
}
function totalQty(i){return itemBalances(i).reduce((n,b)=>n+b.qty,0);}
function optionList(values,label){return `<option value="">All ${label}</option>`+[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b))).map(v=>`<option>${esc(v)}</option>`).join('');}
function currentStockFilter(){return {q:norm(byId('imsStockSearch')?.value||''),category:byId('imsStockCategory')?.value||'',brand:byId('imsStockBrand')?.value||'',model:byId('imsStockModel')?.value||'',specification:byId('imsStockSpec')?.value||'',status:byId('imsStockStatus')?.value||'',location:byId('imsStockLocation')?.value||'',client:byId('imsStockClient')?.value||''};}
function matchesStock(i,f,data){
  const lm=data.latestMovement.get(i.id)||{};
  const balances=itemBalances(i);
  const clientName=lm.toType==='client'?(lm.toName||''):'';
  const hay=norm(`${i.itemCode||''} ${i.name||''} ${i.category||''} ${i.brand||''} ${i.model||''} ${i.specification||''} ${i.supplierName||''} ${i.currentLocation||''} ${i.status||''} ${clientName} ${JSON.stringify(balances)}`);
  return (!f.q||hay.includes(f.q))&&(!f.category||i.category===f.category)&&(!f.brand||i.brand===f.brand)&&(!f.model||i.model===f.model)&&(!f.specification||i.specification===f.specification)&&(!f.status||balances.some(b=>b.status===f.status)||i.status===f.status)&&(!f.location||balances.some(b=>b.locationName===f.location))&&(!f.client||clientName===f.client);
}
function calcSummary(items){
  const s={records:items.length,qty:0,warehouse:0,client:0,rental:0,maintenance:0,transit:0,supplier:0};
  items.forEach(i=>itemBalances(i).forEach(b=>{s.qty+=b.qty;if(b.locationType==='warehouse')s.warehouse+=b.qty;else if(b.locationType==='client'){s.client+=b.qty;if(norm(b.status)==='rental')s.rental+=b.qty;}else if(b.locationType==='maintenance')s.maintenance+=b.qty;else if(b.locationType==='transit')s.transit+=b.qty;else if(b.locationType==='supplier')s.supplier+=b.qty;}));
  return s;
}
function kpi(label,value,status=''){return `<button type="button" class="imsStockKpi bg-slate-950 border border-slate-800 rounded-xl p-3 text-left hover:bg-slate-900" data-status="${esc(status)}"><div class="text-xl font-black">${esc(value)}</div><div class="text-[10px] text-slate-500">${esc(label)}</div></button>`;}

async function renderStockDashboard(){
  const nav=byId('navTabs');if(!nav)return;
  let tab=byId('imsStockTab');
  if(!tab){tab=document.createElement('button');tab.id='imsStockTab';tab.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800';tab.textContent='Stock Monitor';nav.insertBefore(tab,nav.children[1]||null);}
  if(tab.dataset.stockDashBound!=='1'){tab.dataset.stockDashBound='1';tab.onclick=()=>showStock();}
}

async function showStock(){
  document.querySelectorAll('.navBtn').forEach(b=>b.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800');
  const tab=byId('imsStockTab');if(tab)tab.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-600 text-white';
  byId('pageTitle').textContent='Stock Monitor';
  byId('pageSubtitle').textContent='Current stock overview. Default is All; filter only when you need to drill down.';
  const app=byId('appContent');app.innerHTML='<div class="text-sm text-slate-500">Loading stock overview...</div>';
  const data=await loadStockData(true);const inv=data.inventory;
  const clients=[...new Set(data.movements.filter(m=>m.toType==='client').map(m=>m.toName).filter(Boolean))];
  app.innerHTML=`
  <section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
   <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4"><div><h2 class="font-bold">Stock Overview</h2><p class="text-xs text-slate-500">All filters start at All. Summary and list update together.</p></div><button id="imsStockReset" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-xs font-bold">Reset to All</button></div>
   <div class="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2">
    <input id="imsStockSearch" class="${cls}" placeholder="Search item, supplier, location...">
    <select id="imsStockCategory" class="${cls}">${optionList(inv.map(i=>i.category),'Categories')}</select>
    <select id="imsStockBrand" class="${cls}">${optionList(inv.map(i=>i.brand),'Brands')}</select>
    <select id="imsStockModel" class="${cls}">${optionList(inv.map(i=>i.model),'Models')}</select>
    <select id="imsStockSpec" class="${cls}">${optionList(inv.map(i=>i.specification),'Specifications')}</select>
    <select id="imsStockStatus" class="${cls}">${optionList(inv.flatMap(i=>itemBalances(i).map(b=>b.status)).concat(inv.map(i=>i.status)),'Statuses')}</select>
    <select id="imsStockLocation" class="${cls}">${optionList(inv.flatMap(i=>itemBalances(i).map(b=>b.locationName)),'Locations')}</select>
    <select id="imsStockClient" class="${cls}">${optionList(clients,'Clients')}</select>
   </div>
  </section>
  <section id="imsStockSummary" class="mt-5"></section>
  <section id="imsStockCategorySummary" class="mt-5"></section>
  <section id="imsStockList" class="mt-5"></section>`;
  ['imsStockSearch','imsStockCategory','imsStockBrand','imsStockModel','imsStockSpec','imsStockStatus','imsStockLocation','imsStockClient'].forEach(id=>{const e=byId(id);if(e)e.oninput=e.onchange=()=>refreshStockView(data);});
  byId('imsStockReset').onclick=()=>{['imsStockSearch','imsStockCategory','imsStockBrand','imsStockModel','imsStockSpec','imsStockStatus','imsStockLocation','imsStockClient'].forEach(id=>{const e=byId(id);if(e)e.value='';});refreshStockView(data);};
  refreshStockView(data);
}

function refreshStockView(data){
  const f=currentStockFilter();const items=data.inventory.filter(i=>matchesStock(i,f,data));const s=calcSummary(items);
  byId('imsStockSummary').innerHTML=`<div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">${kpi('Item Records',s.records)}${kpi('Total Quantity',s.qty)}${kpi('Warehouse Qty',s.warehouse,'At Warehouse')}${kpi('Client Qty',s.client,'At Client')}${kpi('Rental Qty',s.rental,'Rental')}${kpi('Maintenance Qty',s.maintenance,'In Maintenance')}${kpi('Transit Qty',s.transit,'In Transit')}${kpi('Supplier Qty',s.supplier,'At Supplier')}</div>`;
  document.querySelectorAll('.imsStockKpi[data-status]').forEach(b=>{if(!b.dataset.status)return;b.onclick=()=>{const e=byId('imsStockStatus');if(e){e.value=[...e.options].some(o=>o.value===b.dataset.status)?b.dataset.status:'';refreshStockView(data);}};});
  const groups=new Map();items.forEach(i=>{const k=i.category||'Uncategorised';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
  byId('imsStockCategorySummary').innerHTML=`<div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5"><div class="flex items-center justify-between mb-3"><h2 class="font-bold">Category Summary</h2><span class="text-xs text-slate-500">Click category to drill down</span></div><div class="overflow-x-auto"><table class="w-full min-w-[760px] text-xs"><thead class="text-slate-500"><tr><th class="p-2 text-left">Category</th><th>Records</th><th>Total Qty</th><th>Warehouse</th><th>Client</th><th>Rental</th><th>Maintenance</th><th>Transit</th></tr></thead><tbody>${[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([cat,arr])=>{const x=calcSummary(arr);return `<tr class="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer imsCatRow" data-cat="${esc(cat)}"><td class="p-2 font-semibold">${esc(cat)}</td><td class="p-2 text-center">${x.records}</td><td class="p-2 text-center">${x.qty}</td><td class="p-2 text-center">${x.warehouse}</td><td class="p-2 text-center">${x.client}</td><td class="p-2 text-center">${x.rental}</td><td class="p-2 text-center">${x.maintenance}</td><td class="p-2 text-center">${x.transit}</td></tr>`;}).join('')||'<tr><td colspan="8" class="p-4 text-slate-500 text-center">No matching stock.</td></tr>'}</tbody></table></div></div>`;
  document.querySelectorAll('.imsCatRow').forEach(r=>r.onclick=()=>{const e=byId('imsStockCategory');if(e){e.value=r.dataset.cat==='Uncategorised'?'':r.dataset.cat;refreshStockView(data);}});
  const rows=items.sort((a,b)=>String(a.itemCode||'').localeCompare(String(b.itemCode||'')));
  byId('imsStockList').innerHTML=`<div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5"><div class="flex items-center justify-between gap-2 mb-3"><div><h2 class="font-bold">Current Stock Records</h2><div class="text-xs text-slate-500">${rows.length} matching item record(s)</div></div></div><div class="space-y-2">${rows.slice(0,100).map(i=>{const b=itemBalances(i),loc=[...new Set(b.map(x=>x.locationName))].join(', ');return `<div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div class="font-semibold text-sm">${esc(i.itemCode||'')} — ${esc(i.name||'')}</div><div class="text-[11px] text-slate-500">${esc([i.category,i.brand,i.model,i.specification].filter(Boolean).join(' · '))}</div><div class="text-[11px] text-slate-500">${esc(loc||i.currentLocation||'')} · ${esc(i.status||'')}</div></div><div class="flex items-center gap-3"><div class="text-right"><div class="font-bold">${totalQty(i)} ${esc(i.unit||'')}</div></div><button class="imsOpenStockItem bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-bold" data-id="${i.id}">View</button></div></div></div>`;}).join('')||'<div class="text-sm text-slate-500">No matching stock.</div>'}</div>${rows.length>100?'<div class="text-xs text-slate-500 mt-3">Showing first 100 matching item records. Narrow filters for more precise results.</div>':''}</div>`;
  document.querySelectorAll('.imsOpenStockItem').forEach(b=>b.onclick=()=>{const w=document.querySelector('.navBtn[data-tab="workspace"]');w?.click();setTimeout(()=>window.openItem?.(b.dataset.id),60);});
}

function captureLogRows(){
  if(logPagingBusy)return;
  const title=byId('pageTitle')?.textContent||'';const body=byId('logBody');if(!/Logs \/ Records/i.test(title)||!body)return;
  const rows=[...body.querySelectorAll('tr')];
  if(!rows.length||rows.length===1&&/No matching records/i.test(rows[0].textContent||''))return;
  if(body.dataset.imsPaged==='1')return;
  logRows=rows.map(r=>r.outerHTML);logPage=1;renderLogPage();
}
function renderLogPage(){
  const body=byId('logBody');if(!body||!logRows.length)return;
  const total=logRows.length,pages=Math.max(1,Math.ceil(total/logPageSize));logPage=Math.min(Math.max(1,logPage),pages);const start=(logPage-1)*logPageSize,end=Math.min(start+logPageSize,total);
  logPagingBusy=true;body.dataset.imsPaged='1';body.innerHTML=logRows.slice(start,end).join('');
  let bar=byId('imsLogPager');if(!bar){bar=document.createElement('div');bar.id='imsLogPager';bar.className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 text-xs';body.closest('.overflow-auto')?.insertAdjacentElement('afterend',bar);}
  bar.innerHTML=`<div class="text-slate-500">Showing ${total?start+1:0}–${end} of ${total} records · Page ${logPage} of ${pages}</div><div class="flex items-center gap-2"><button id="imsLogPrev" class="bg-slate-700 px-3 py-1.5 rounded disabled:opacity-40" ${logPage<=1?'disabled':''}>Previous</button><span class="text-slate-400">${logPage} / ${pages}</span><button id="imsLogNext" class="bg-slate-700 px-3 py-1.5 rounded disabled:opacity-40" ${logPage>=pages?'disabled':''}>Next</button></div>`;
  byId('imsLogPrev')?.addEventListener('click',()=>{logPage--;renderLogPage();});byId('imsLogNext')?.addEventListener('click',()=>{logPage++;renderLogPage();});
  requestAnimationFrame(()=>{logPagingBusy=false;});
}
function watchLogs(){
  const title=byId('pageTitle')?.textContent||'';const body=byId('logBody');if(!/Logs \/ Records/i.test(title)||!body)return;
  if(body.dataset.imsPaged==='1'&&logPagingBusy)return;
  if(body.dataset.imsPaged==='1')delete body.dataset.imsPaged;
  captureLogRows();
}

let timer=null;
const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{renderStockDashboard();watchLogs();},30);});
observer.observe(document.body,{childList:true,subtree:true,characterData:true});
renderStockDashboard();
