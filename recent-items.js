import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
let items=[];
let docs=[];
let loaded=false;
let loading=null;
let pageSize=10;
let visibleCount=10;
let currentQuery='';

async function loadData(){
  if(loaded)return;
  if(loading)return loading;
  loading=(async()=>{
    const [invSnap,docSnap]=await Promise.all([
      getDocs(collection(db,'inventory')),
      getDocs(collection(db,'document_refs')).catch(()=>null)
    ]);
    items=invSnap.docs.map(d=>({id:d.id,...d.data()}));
    docs=docSnap?docSnap.docs.map(d=>({id:d.id,...d.data()})):[];
    items.sort((a,b)=>String(b.createdAt||b.lastEditedAt||'').localeCompare(String(a.createdAt||a.lastEditedAt||'')));
    loaded=true;
  })().finally(()=>loading=null);
  return loading;
}

function itemQty(i){
  const b=Array.isArray(i.stockBalances)?i.stockBalances:[];
  if(b.length)return b.reduce((n,x)=>n+Number(x.qty||0),0);
  return Number(i.quantity??i.qty??1);
}

function itemHaystack(i){
  return norm(`${i.itemCode||''} ${i.name||''} ${i.category||''} ${i.brand||''} ${i.model||''} ${i.specification||''} ${i.supplierName||''} ${i.currentLocation||''} ${i.status||''} ${JSON.stringify(i.stockBalances||[])}`);
}

function matchedItems(){
  if(!currentQuery)return items;
  const docIds=new Set(docs.filter(d=>norm(`${d.refNumber||''} ${d.docType||''} ${d.context||''}`).includes(currentQuery)).map(d=>d.itemId));
  return items.filter(i=>itemHaystack(i).includes(currentQuery)||docIds.has(i.id));
}

function render(){
  const mount=document.getElementById('itemFindResults');
  if(!mount)return;
  const all=matchedItems();
  const shown=all.slice(0,visibleCount);
  const label=currentQuery?`${all.length} matching item${all.length===1?'':'s'}`:`Latest ${Math.min(pageSize,all.length)} items`;
  mount.innerHTML=`<div class="flex items-center justify-between gap-3 mb-2"><div class="text-xs font-semibold text-slate-400">${esc(label)}</div>${!currentQuery?'<div class="text-[10px] text-slate-600">Click an item to view details and history</div>':''}</div>`+
    (shown.map(i=>`<button onclick="openItem('${i.id}')" class="w-full text-left bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl p-3"><div class="flex justify-between gap-3"><div><div class="font-semibold text-sm">${esc(i.itemCode)} — ${esc(i.name)}</div><div class="text-[11px] text-slate-500">${esc([i.category,i.brand,i.model,i.specification].filter(Boolean).join(' · ')||'No classification')} · ${esc(i.supplierName||'No supplier')}</div></div><div class="text-right"><div class="font-bold">${esc(itemQty(i))} ${esc(i.unit||'')}</div><div class="text-[10px] text-slate-500">${esc(i.status||'')}</div></div></div></button>`).join('')||'<div class="text-sm text-slate-500">No matching items.</div>')+
    (shown.length<all.length?`<div class="pt-2"><button id="imsShowMoreItems" type="button" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg py-2 text-xs font-bold">Show More (${all.length-shown.length} remaining)</button></div>`:'');
  document.getElementById('imsShowMoreItems')?.addEventListener('click',()=>{visibleCount+=pageSize;render();});
}

async function runSearch(){
  await loadData();
  currentQuery=norm(document.getElementById('itemFind')?.value||'');
  visibleCount=pageSize;
  render();
}

async function enhanceFinder(){
  const input=document.getElementById('itemFind');
  const button=document.getElementById('itemFindBtn');
  const mount=document.getElementById('itemFindResults');
  if(!input||!button||!mount||mount.dataset.imsRecentEnhanced==='1')return;
  mount.dataset.imsRecentEnhanced='1';
  mount.innerHTML='<div class="text-xs text-slate-500">Loading latest items...</div>';
  button.onclick=runSearch;
  input.onkeyup=e=>{if(e.key==='Enter')runSearch();};
  await loadData();
  currentQuery='';
  visibleCount=pageSize;
  if(document.getElementById('itemFindResults')===mount)render();
}

new MutationObserver(enhanceFinder).observe(document.body,{childList:true,subtree:true});
enhanceFinder();
