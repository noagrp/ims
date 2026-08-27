import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>{if(!v)return'';const s=String(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:s;};
let selectedItemId='';
let cache=null;

async function loadAll(){
  if(cache)return cache;
  const names=['inventory','document_refs','maintenance_events','operational_logs','movements'];
  const out={};
  for(const name of names){
    try{const snap=await getDocs(collection(db,name));out[name]=snap.docs.map(d=>({id:d.id,...d.data()}));}
    catch{out[name]=[];}
  }
  cache=out;
  return out;
}

function currentItem(data){return data.inventory.find(x=>x.id===selectedItemId);}
function rowsForItem(data,item){
  const base=[
    ['Item Code / Serial',item.itemCode||''],['Item Name',item.name||''],['Category',item.category||''],['Brand',item.brand||''],['Model',item.model||''],['Specification',item.specification||''],['Tracking Type',item.trackingType||''],['Quantity',item.quantity??item.qty??''],['Unit',item.unit||''],['Supplier',item.supplierName||''],['Status',item.status||''],['Current Location',item.currentLocation||''],['Remark',item.remark||''],['Created By',item.createdBy||''],['Created Date',fmt(item.createdAt)],['Last Edited By',item.lastEditedBy||''],['Last Edited Date',fmt(item.lastEditedAt)]
  ].map(([Field,Value])=>({Section:'Item Details',Field,Value}));
  const balances=(Array.isArray(item.stockBalances)?item.stockBalances:[]).map((b,i)=>({Section:'Current Balances',Field:`Balance ${i+1}`,Value:`${b.qty??''} ${item.unit||''} | ${b.locationName||b.location||''} | ${b.status||''}`}));
  const docs=data.document_refs.filter(x=>x.itemId===item.id).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))).map(x=>({Section:'Documents',Field:`${x.docType||'Document'}${x.context?` (${x.context})`:''}`,Value:`${x.refNumber||''}${x.status?` | ${x.status}`:''}${x.createdAt?` | ${fmt(x.createdAt)}`:''}`}));
  const maint=data.maintenance_events.filter(x=>x.itemId===item.id).sort((a,b)=>String(a.eventDate||a.createdAt||'').localeCompare(String(b.eventDate||b.createdAt||''))).map(x=>({Section:'Maintenance History',Field:`${fmt(x.eventDate||x.createdAt)} ${x.maintenanceType||x.eventType||''}`.trim(),Value:`${x.eventStatus||''}${x.provider?` | ${x.provider}`:''}${x.remark?` | ${x.remark}`:''}`}));
  const logs=data.operational_logs.filter(x=>x.itemId===item.id||x.itemCode===item.itemCode).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).map(x=>({Section:'Operational History',Field:`${fmt(x.date)} ${x.activityLabel||x.activity||''}`.trim(),Value:`${x.fromName||''}${x.toName?` → ${x.toName}`:''}${x.qty!==''&&x.qty!==undefined?` | ${x.qty} ${x.unit||''}`:''}${x.status?` | ${x.status}`:''}${x.performedBy?` | ${x.performedBy}`:''}${x.remark?` | ${x.remark}`:''}`}));
  const moves=data.movements.filter(x=>x.itemId===item.id).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))).map(x=>({Section:'Movement Records',Field:`${fmt(x.createdAt)} ${x.actionLabel||x.action||''}`.trim(),Value:`${x.fromName||''} → ${x.toName||''} | ${x.qty??''} ${x.unit||''} | ${x.status||''}`}));
  return [...base,...balances,...docs,...maint,...moves,...logs];
}

function safeName(item,ext){return `IMS_${String(item.itemCode||'Item').replace(/[^a-z0-9_-]+/gi,'_')}_Record.${ext}`;}

async function exportExcel(){
  const data=await loadAll(),item=currentItem(data);if(!item)return alert('Open an item first.');
  const rows=rowsForItem(data,item);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Item Record');
  XLSX.writeFile(wb,safeName(item,'xlsx'));
}

async function exportCsv(){
  const data=await loadAll(),item=currentItem(data);if(!item)return alert('Open an item first.');
  const rows=rowsForItem(data,item);
  const ws=XLSX.utils.json_to_sheet(rows);const csv=XLSX.utils.sheet_to_csv(ws);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=safeName(item,'csv');document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove();
}

async function printPdf(){
  const data=await loadAll(),item=currentItem(data);if(!item)return alert('Open an item first.');
  const detail=document.getElementById('itemDetailMount');if(!detail?.innerHTML.trim())return alert('Open an item first.');
  const w=window.open('','_blank','width=1000,height=800');if(!w)return alert('Please allow pop-ups to print this item.');
  w.document.write(`<!doctype html><html><head><title>${esc(item.itemCode||'Item')} - IMS Item Record</title><style>body{font-family:Arial,sans-serif;color:#111;margin:24px}button{display:none!important}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}.bg-slate-950,.bg-slate-900{background:#fff!important}.text-slate-500,.text-slate-400{color:#555!important}.text-slate-100,.text-slate-300{color:#111!important}section{border:0!important;box-shadow:none!important}h2,h3{margin-top:18px}.grid{display:block!important}.overflow-x-auto,.overflow-y-auto,.overflow-auto,.max-h-72{overflow:visible!important;max-height:none!important}</style></head><body><h1>IMS Item Record</h1>${detail.innerHTML}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),250);
}

function addButtons(){
  const mount=document.getElementById('itemDetailMount');
  if(!mount||!mount.innerHTML.trim()||document.getElementById('imsItemExportBar'))return;
  const bar=document.createElement('div');bar.id='imsItemExportBar';bar.className='flex flex-wrap gap-2 mb-3';
  bar.innerHTML='<button type="button" id="imsItemExcel" class="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-lg text-xs font-bold">Export Excel</button><button type="button" id="imsItemCsv" class="bg-emerald-800 hover:bg-emerald-700 px-4 py-2 rounded-lg text-xs font-bold">Export CSV</button><button type="button" id="imsItemPdf" class="bg-violet-700 hover:bg-violet-600 px-4 py-2 rounded-lg text-xs font-bold">Print / Save PDF</button>';
  mount.prepend(bar);
  document.getElementById('imsItemExcel').onclick=exportExcel;
  document.getElementById('imsItemCsv').onclick=exportCsv;
  document.getElementById('imsItemPdf').onclick=printPdf;
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('button[onclick^="openItem("]');
  if(!b)return;
  const m=b.getAttribute('onclick')?.match(/openItem\('([^']+)'\)/);if(m)selectedItemId=m[1];
});

new MutationObserver(()=>{if(document.getElementById('itemDetailMount')?.innerHTML.trim())addButtons();}).observe(document.body,{childList:true,subtree:true});
