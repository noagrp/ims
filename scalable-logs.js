import { db } from './firebase-config.js';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, startAfter, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { backfillCurrentClientPositions } from './client-log-backfill.js';

const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const PAGE_SIZE=10;
let page=0,cursors=[null],pageDocs=[],total=0,loading=false,backfillChecked=false;

function fmt(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
function filters(){return{status:byId('slStatus')?.value||'',itemCode:byId('slItem')?.value.trim()||'',supplierName:byId('slSupplier')?.value.trim()||'',clientName:byId('slClient')?.value.trim()||'',from:byId('slFrom')?.value||'',to:byId('slTo')?.value||''};}
function baseConstraints(f){const a=[];if(f.status)a.push(where('status','==',f.status));if(f.itemCode)a.push(where('itemCode','==',f.itemCode));if(f.supplierName)a.push(where('supplierName','==',f.supplierName));if(f.clientName)a.push(where('clientName','==',f.clientName));if(f.from)a.push(where('date','>=',`${f.from}T00:00:00`));if(f.to)a.push(where('date','<=',`${f.to}T23:59:59.999`));a.push(orderBy('date','desc'));return a;}
function buildQuery(f,withPage=true){const a=baseConstraints(f);if(withPage&&page>0&&cursors[page])a.push(startAfter(cursors[page]));if(withPage)a.push(limit(PAGE_SIZE));return query(collection(db,'operational_logs'),...a);}

function displayRow(x){
  const isArrival=String(x.activity||'').toUpperCase()==='ARRIVAL';
  let activity=x.activityLabel||x.activity||'';
  let from=x.fromName||'';
  let to=x.toName||'';
  let status=x.status||'';
  if(isArrival){
    from='Transit';
    if(x.toType==='client')activity=status==='Rental'?'Arrival at Client — Rental':'Arrival at Client';
    else if(x.toType==='warehouse')activity='Arrival at Warehouse';
    else if(x.toType==='maintenance')activity='Arrival at Maintenance';
    else if(x.toType==='supplier')activity='Arrival at Supplier';
    else activity='Arrival';
  }
  return{activity,from,to,status};
}

function row(x){const d=displayRow(x);return `<tr class="border-t border-slate-900"><td class="p-2 whitespace-nowrap">${esc(fmt(x.date))}</td><td class="p-2">${esc(d.activity)}</td><td class="p-2">${esc(x.itemCode||'')}</td><td class="p-2">${esc(x.itemName||x.itemNameSnapshot||'')}</td><td class="p-2">${esc(d.status)}</td><td class="p-2">${esc(d.from)}</td><td class="p-2">${esc(d.to)}</td><td class="p-2 text-right">${esc(x.qty??'')}</td><td class="p-2">${esc(x.unit||'')}</td><td class="p-2">${esc(x.clientName||'')}</td><td class="p-2">${esc(x.supplierName||'')}</td><td class="p-2">${esc(x.performedBy||'')}</td></tr>`;}
function renderRows(){const body=byId('slBody');if(!body)return;body.innerHTML=pageDocs.map(d=>row(d.data)).join('')||'<tr><td colspan="12" class="p-4 text-center text-slate-500">No matching records.</td></tr>';const start=total?page*PAGE_SIZE+1:0,end=Math.min((page+1)*PAGE_SIZE,total);byId('slCount').textContent=`Showing ${start}–${end} of ${total} records · Page ${page+1} of ${Math.max(1,Math.ceil(total/PAGE_SIZE))}`;byId('slPrev').disabled=page===0;byId('slNext').disabled=end>=total;}
async function load(reset=false){if(loading)return;loading=true;if(reset){page=0;cursors=[null];}byId('slBody').innerHTML='<tr><td colspan="12" class="p-4 text-center text-slate-500">Loading...</td></tr>';try{const f=filters();const [snap,countSnap]=await Promise.all([getDocs(buildQuery(f,true)),getCountFromServer(buildQuery(f,false))]);pageDocs=snap.docs.map(d=>({id:d.id,data:d.data()}));total=countSnap.data().count;if(snap.docs.length)cursors[page+1]=snap.docs[snap.docs.length-1];renderRows();byId('slIndexNote').textContent='';}catch(err){console.error('IMS paged logs query failed:',err);pageDocs=[];total=0;renderRows();byId('slIndexNote').textContent='This filter combination needs a Firestore index.';}finally{loading=false;}}
function csv(){const headers=['Date','Activity','Item Code','Item','Status','From','To','Qty','Unit','Client','Supplier','User'];const vals=pageDocs.map(({data:x})=>{const d=displayRow(x);return[fmt(x.date),d.activity,x.itemCode||'',x.itemName||x.itemNameSnapshot||'',d.status,d.from,d.to,x.qty??'',x.unit||'',x.clientName||'',x.supplierName||'',x.performedBy||''];});const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const text=[headers,...vals].map(r=>r.map(q).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download=`IMS_Logs_Page_${page+1}.csv`;document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove();}
function excel(){if(typeof XLSX==='undefined')return alert('Excel library unavailable.');const rows=pageDocs.map(({data:x})=>{const d=displayRow(x);return{Date:fmt(x.date),Activity:d.activity,ItemCode:x.itemCode||'',Item:x.itemName||x.itemNameSnapshot||'',Status:d.status,From:d.from,To:d.to,Quantity:x.qty??'',Unit:x.unit||'',Client:x.clientName||'',Supplier:x.supplierName||'',User:x.performedBy||''};});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Logs');XLSX.writeFile(wb,`IMS_Logs_Page_${page+1}.xlsx`);}

async function show(initialStatus=''){
  document.querySelectorAll('.navBtn').forEach(b=>b.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800');
  const tab=document.querySelector('.navBtn[data-tab="logs"]');if(tab)tab.className='navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-600 text-white';
  byId('pageTitle').textContent='Logs / Records';byId('pageSubtitle').textContent='Full operational history with Firestore paging. Movement departures and arrivals are shown as separate steps.';
  byId('appContent').innerHTML=`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4"><div><h2 class="font-bold">Record Filters</h2><p class="text-xs text-slate-500">All filters default to All. Text filters use exact stored values.</p></div><button id="slReset" class="bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold">Reset to All</button></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"><select id="slStatus" class="${cls}"><option value="">All Statuses</option><option>At Supplier</option><option>At Warehouse</option><option>In Transit</option><option>At Client</option><option>Rental</option><option>In Maintenance</option><option>Sold</option><option>Written Off</option></select><input id="slItem" class="${cls}" placeholder="Exact item code"><input id="slSupplier" class="${cls}" placeholder="Exact supplier name"><input id="slClient" class="${cls}" placeholder="Exact client name"><input type="date" id="slFrom" class="${cls}" title="From date"><input type="date" id="slTo" class="${cls}" title="To date"></div><div class="flex flex-wrap gap-2 mt-3"><button id="slApply" class="bg-red-600 px-4 py-2 rounded-lg text-xs font-bold">Apply Filters</button><button id="slExcel" class="bg-emerald-700 px-4 py-2 rounded-lg text-xs font-bold">Export This Page Excel</button><button id="slCsv" class="bg-cyan-700 px-4 py-2 rounded-lg text-xs font-bold">Export This Page CSV</button></div><div id="slIndexNote" class="text-[11px] text-amber-400 mt-2"></div></section><section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mt-5"><div id="slCount" class="text-xs text-slate-500 mb-3"></div><div class="overflow-x-auto border border-slate-800 rounded-xl"><table class="w-full min-w-[1200px] text-xs"><thead class="bg-slate-950 text-slate-400"><tr><th class="p-2 text-left">Date</th><th class="p-2 text-left">Activity</th><th class="p-2 text-left">Item Code</th><th class="p-2 text-left">Item</th><th class="p-2 text-left">Status</th><th class="p-2 text-left">From</th><th class="p-2 text-left">To</th><th class="p-2 text-right">Qty</th><th class="p-2 text-left">Unit</th><th class="p-2 text-left">Client</th><th class="p-2 text-left">Supplier</th><th class="p-2 text-left">User</th></tr></thead><tbody id="slBody"></tbody></table></div><div class="flex items-center justify-between gap-2 mt-3"><button id="slPrev" class="bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40">Previous</button><button id="slNext" class="bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40">Next</button></div></section>`;
  if(initialStatus&&byId('slStatus'))byId('slStatus').value=initialStatus;
  if(!backfillChecked){backfillChecked=true;try{await backfillCurrentClientPositions();}catch(err){console.warn('IMS client history backfill skipped:',err);}}
  byId('slApply').onclick=()=>load(true);byId('slReset').onclick=()=>{['slStatus','slItem','slSupplier','slClient','slFrom','slTo'].forEach(id=>{const e=byId(id);if(e)e.value='';});load(true);};byId('slPrev').onclick=()=>{if(page>0){page--;load(false);}};byId('slNext').onclick=()=>{if((page+1)*PAGE_SIZE<total){page++;load(false);}};byId('slExcel').onclick=excel;byId('slCsv').onclick=csv;await load(true);
}

function bind(){const tab=document.querySelector('.navBtn[data-tab="logs"]');if(!tab||tab.dataset.imsServerLogs==='1')return;tab.dataset.imsServerLogs='1';tab.onclick=()=>show('');}

document.addEventListener('click',e=>{
  const card=e.target.closest?.('.statLog');
  if(!card)return;
  e.preventDefault();e.stopImmediatePropagation();
  const status=card.dataset.status||'';
  show(status);
},true);

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(bind,25);}).observe(document.body,{childList:true,subtree:true});bind();
