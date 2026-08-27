import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const pageSize=10;
let items=[];
let currentQuery='';

function itemQty(i){
  const b=Array.isArray(i.stockBalances)?i.stockBalances:[];
  if(b.length)return b.reduce((n,x)=>n+Number(x.qty||0),0);
  return Number(i.quantity??i.qty??0);
}
function itemHaystack(i){return norm(`${i.itemCode||''} ${i.name||''} ${i.category||''} ${i.brand||''} ${i.model||''} ${i.specification||''} ${i.supplierName||''} ${i.currentLocation||''} ${i.status||''} ${JSON.stringify(i.stockBalances||[])}`);}
function mergeUnique(list){const m=new Map();list.forEach(x=>{if(x?.id)m.set(x.id,x);});return [...m.values()];}

async function latestItems(){
  try{
    const s=await getDocs(query(collection(db,'inventory'),orderBy('createdAt','desc'),limit(pageSize)));
    return s.docs.map(d=>({id:d.id,...d.data()}));
  }catch{
    const s=await getDocs(query(collection(db,'inventory'),limit(pageSize)));
    return s.docs.map(d=>({id:d.id,...d.data()}));
  }
}

async function searchItems(raw){
  const qn=norm(raw);if(!qn)return latestItems();
  const found=[];
  try{
    const exact=await getDocs(query(collection(db,'inventory'),where('itemCode','==',raw.trim()),limit(10)));
    exact.forEach(d=>found.push({id:d.id,...d.data()}));
  }catch{}
  try{
    const refs=await getDocs(query(collection(db,'document_refs'),where('refNumber','==',raw.trim()),limit(20)));
    for(const r of refs.docs){const id=r.data().itemId;if(!id)continue;try{const s=await getDoc(doc(db,'inventory',id));if(s.exists())found.push({id:s.id,...s.data()});}catch{}}
  }catch{}
  try{
    const recent=await getDocs(query(collection(db,'inventory'),orderBy('lastEditedAt','desc'),limit(100)));
    recent.forEach(d=>{const i={id:d.id,...d.data()};if(itemHaystack(i).includes(qn))found.push(i);});
  }catch{
    try{const recent=await getDocs(query(collection(db,'inventory'),limit(100)));recent.forEach(d=>{const i={id:d.id,...d.data()};if(itemHaystack(i).includes(qn))found.push(i);});}catch{}
  }
  return mergeUnique(found).slice(0,100);
}

function render(){
  const mount=document.getElementById('itemFindResults');if(!mount)return;
  const label=currentQuery?`${items.length} matching item${items.length===1?'':'s'}`:`Latest ${items.length} items`;
  mount.innerHTML=`<div class="flex items-center justify-between gap-3 mb-2"><div class="text-xs font-semibold text-slate-400">${esc(label)}</div><div class="text-[10px] text-slate-600">${currentQuery?'Exact item code/reference + recent indexed search':'Click an item to view details and history'}</div></div>`+
    (items.map(i=>`<button onclick="openItem('${i.id}')" class="w-full text-left bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl p-3"><div class="flex justify-between gap-3"><div><div class="font-semibold text-sm">${esc(i.itemCode)} — ${esc(i.name)}</div><div class="text-[11px] text-slate-500">${esc([i.category,i.brand,i.model,i.specification].filter(Boolean).join(' · ')||'No classification')} · ${esc(i.supplierName||'No supplier')}</div></div><div class="text-right"><div class="font-bold">${esc(itemQty(i))} ${esc(i.unit||'')}</div><div class="text-[10px] text-slate-500">${esc(i.status||'')}</div></div></div></button>`).join('')||'<div class="text-sm text-slate-500">No matching items.</div>');
}

async function runSearch(){
  const mount=document.getElementById('itemFindResults');if(mount)mount.innerHTML='<div class="text-xs text-slate-500">Searching...</div>';
  const raw=document.getElementById('itemFind')?.value||'';currentQuery=norm(raw);items=await searchItems(raw);render();
}

async function enhanceFinder(){
  const input=document.getElementById('itemFind'),button=document.getElementById('itemFindBtn'),mount=document.getElementById('itemFindResults');
  if(!input||!button||!mount||mount.dataset.imsRecentEnhanced==='2')return;
  mount.dataset.imsRecentEnhanced='2';mount.innerHTML='<div class="text-xs text-slate-500">Loading latest items...</div>';
  button.onclick=runSearch;input.onkeyup=e=>{if(e.key==='Enter')runSearch();};
  currentQuery='';items=await latestItems();if(document.getElementById('itemFindResults')===mount)render();
}

new MutationObserver(enhanceFinder).observe(document.body,{childList:true,subtree:true});
enhanceFinder();
