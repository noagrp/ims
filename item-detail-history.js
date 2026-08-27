import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmt(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function friendly(s){return String(s||'').toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}

function historyMount(){
  const root=document.getElementById('itemDetailMount');
  if(!root)return null;
  const h=[...root.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Recent Item Record');
  return h?.nextElementSibling||null;
}

function legacyRows(item){
  return (item.lifecycleHistory||[]).map((h,n)=>({
    id:`legacy-${n}`,date:h.timestamp||'',activity:h.action||'LEGACY',activityLabel:h.action||'Legacy Activity',
    fromName:h.from||'',toName:h.to||h.location||'',qty:h.qty??'',unit:h.unit||item.unit||'',performedBy:h.user||''
  }));
}

async function loadHistory(itemId){
  const mount=historyMount();if(mount)mount.innerHTML='<div class="text-xs text-slate-500">Loading item history...</div>';
  try{
    const snap=await getDoc(doc(db,'inventory',itemId));
    if(!snap.exists())return;
    const item={id:snap.id,...snap.data()};
    let recent=[];
    if(item.itemCode){
      const q=query(collection(db,'operational_logs'),where('itemCode','==',item.itemCode),orderBy('date','desc'),limit(30));
      const logs=await getDocs(q);
      recent=logs.docs.map(d=>({id:d.id,...d.data()}));
    }
    const merged=[...recent,...legacyRows(item)]
      .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
      .slice(0,30);
    const target=historyMount();if(!target)return;
    target.innerHTML=merged.map(x=>`<div class="bg-slate-950 rounded-xl p-3 text-xs"><div class="font-semibold">${esc(x.activityLabel||friendly(x.activity))}</div><div class="text-slate-500">${esc(fmt(x.date))} · ${esc(x.performedBy||'')}</div><div>${esc(x.fromName||'')} ${x.toName?`→ ${esc(x.toName)}`:''} ${x.qty!==''&&x.qty!==undefined?`· ${esc(x.qty)} ${esc(x.unit||'')}`:''}</div></div>`).join('')||'<div class="text-xs text-slate-500">No operational logs.</div>';
  }catch(err){
    console.warn('IMS targeted item history unavailable:',err);
    const target=historyMount();if(target&&!target.children.length)target.innerHTML='<div class="text-xs text-slate-500">Item history unavailable.</div>';
  }
}

function wrap(){
  if(typeof window.openItem!=='function'||window.openItem.__imsTargetedHistory)return false;
  const original=window.openItem;
  const wrapped=function(id){const r=original.apply(this,arguments);Promise.resolve(r).finally(()=>setTimeout(()=>loadHistory(id),0));return r;};
  wrapped.__imsTargetedHistory=true;
  window.openItem=wrapped;
  return true;
}

let timer;new MutationObserver(()=>{if(wrap())return;clearTimeout(timer);timer=setTimeout(wrap,25);}).observe(document.body,{childList:true,subtree:true});wrap();
