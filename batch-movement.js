import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, runTransaction } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const ROLE=window.IMS_ROLE||'admin';
const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const now=()=>new Date().toISOString();
const ACTIONS={
  RECEIVE_SUPPLIER:{label:'Receive from Supplier',from:'supplier',to:'warehouse',toStatus:'Available'},
  TRANSFER_WAREHOUSE:{label:'Transfer Warehouse / Location',from:'warehouse',to:'warehouse',toStatus:'Available'},
  DELIVER_CLIENT:{label:'Rental / Send to Client',from:'warehouse',to:'client',toStatus:'At Client'},
  RETURN_CLIENT:{label:'Return from Client',from:'client',to:'warehouse',toStatus:'Available'},
  SEND_MAINTENANCE:{label:'Send to Maintenance',from:'eligible',to:'maintenance',toStatus:'Maintenance'}
};
const VALID_STATUS=new Set(['At Supplier','Available','At Client','Maintenance','Not Available','In Transit']);
let inventory=[],settings=[],clients=[],suppliers=[],rowSeq=0,saving=false;

function balances(item){
  return (Array.isArray(item.stockBalances)?item.stockBalances:[])
    .filter(x=>Number(x.qty||0)>0)
    .map(x=>({
      qty:Number(x.qty||0),
      locationType:x.locationType||'warehouse',
      locationId:x.locationId||'',
      locationName:x.locationName||'Unknown',
      status:VALID_STATUS.has(x.status)?x.status:'Not Available'
    }));
}
function summary(b){
  const p=b.filter(x=>x.qty>0);
  if(!p.length)return{status:'Not Available',location:'No Stock'};
  const priority=['In Transit','Maintenance','At Client','Not Available','At Supplier','Available'];
  return{status:priority.find(s=>p.some(x=>x.status===s))||'Not Available',location:p.length===1?p[0].locationName:`${p.length} Locations`};
}
function master(type){return settings.filter(x=>x.type===type&&x.status!=='inactive');}
async function load(){
  const [a,b,c,d]=await Promise.all(['inventory','settings','client_profiles','supplier_profiles'].map(n=>getDocs(collection(db,n))));
  inventory=a.docs.map(x=>({id:x.id,...x.data()}));
  settings=b.docs.map(x=>({id:x.id,...x.data()}));
  clients=c.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.status!=='inactive');
  suppliers=d.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.status!=='inactive');
}
function action(){return ACTIONS[byId('bmAction')?.value||''];}
function itemLabel(i){return `${i.alias||i.itemCode}${i.alias?` · ${i.itemCode}`:''} — ${i.name||''}`;}
function sourceAllowed(b,a){
  if(!a||b.status==='In Transit'||b.status==='Maintenance')return false;
  if(a.from==='supplier')return b.locationType==='supplier'&&b.status==='At Supplier';
  if(a.from==='warehouse')return b.locationType==='warehouse'&&b.status==='Available';
  if(a.from==='client')return b.locationType==='client'&&b.status==='At Client';
  if(a.from==='eligible')return (b.locationType==='warehouse'&&(b.status==='Available'||b.status==='Not Available'))||(b.locationType==='client'&&b.status==='At Client');
  return false;
}
function eligibleItem(i){const a=action();return a&&balances(i).some(b=>sourceAllowed(b,a));}
function itemOptions(){
  const a=action();
  const list=a?inventory.filter(eligibleItem):inventory;
  return '<option value="">-- Select Item --</option>'+list.map(i=>`<option value="${i.id}">${esc(itemLabel(i))}</option>`).join('');
}
function sourceOptions(itemId){
  const i=inventory.find(x=>x.id===itemId),a=action();
  if(!i||!a)return '<option value="">-- Select Source Location --</option>';
  return '<option value="">-- Select Source Location --</option>'+balances(i).map((b,n)=>({b,n})).filter(x=>sourceAllowed(x.b,a)).map(({b,n})=>`<option value="${n}">${esc(b.locationName)} — ${b.qty} ${esc(i.unit||'')} — ${esc(b.status)}</option>`).join('');
}
function rowHtml(){
  const id=++rowSeq;
  return `<div class="bmRow border border-slate-800 rounded-xl p-3" data-row="${id}"><div class="grid sm:grid-cols-2 xl:grid-cols-[2fr_1.6fr_.7fr_1.5fr_1fr_auto] gap-2 items-end"><label class="text-xs text-slate-400">Item<select class="bmItem ${cls} mt-1">${itemOptions()}</select></label><label class="text-xs text-slate-400">Source Warehouse / Location<select class="bmSource ${cls} mt-1"><option value="">-- Select Source Location --</option></select></label><label class="text-xs text-slate-400">Qty<input class="bmQty ${cls} mt-1" type="number" min="0.0001" step="any" value="1"></label><label class="text-xs text-slate-400">Invoice Description<input class="bmDesc ${cls} mt-1" maxlength="160" placeholder="Item / service description"></label><label class="text-xs text-slate-400 bmAmountWrap">Line Amount<input class="bmAmount ${cls} mt-1" type="number" min="0" step="0.01" value="0"></label><button type="button" class="bmRemove bg-slate-800 hover:bg-red-800 px-3 py-2.5 rounded-lg text-xs">Remove</button></div><div class="bmLineInfo text-[10px] text-slate-500 mt-1"></div></div>`;
}
function destHtml(){
  const a=action();if(!a)return'';
  if(a.to==='warehouse')return `<label class="text-xs text-slate-400">Destination Warehouse / Location<select id="bmDestination" class="${cls} mt-1"><option value="">-- Warehouse / Location --</option>${master('warehouse').map(x=>`<option value="${x.id}" data-name="${esc(x.value)}">${esc(x.value)}</option>`).join('')}</select></label>`;
  if(a.to==='client')return `<label class="text-xs text-slate-400">Client<select id="bmDestination" class="${cls} mt-1"><option value="">-- Select Client --</option>${clients.map(x=>`<option value="${x.id}" data-name="${esc(x.companyName||x.clientName||'')}">${esc(x.companyName||x.clientName||'')}</option>`).join('')}</select></label>`;
  return `<label class="text-xs text-slate-400">Maintenance Provider<input id="bmDestination" list="bmProviders" class="${cls} mt-1" placeholder="Provider / workshop"><datalist id="bmProviders">${suppliers.map(x=>`<option value="${esc(x.companyName||x.supplierName||'')}">`).join('')}</datalist></label>`;
}
function invoiceVisible(){return ['RECEIVE_SUPPLIER','DELIVER_CLIENT'].includes(byId('bmAction')?.value||'');}
function invoiceHtml(){
  const client=byId('bmAction')?.value==='DELIVER_CLIENT';
  return `<div id="bmInvoice" class="border border-emerald-900/50 bg-emerald-950/10 rounded-xl p-3 space-y-3"><div><div class="font-semibold text-sm text-emerald-400">${client?'Client Invoice / Rental Information':'Supplier Invoice Information'}</div><div class="text-[10px] text-slate-500">One transaction may contain many items and quantities from different source warehouses / locations.</div></div><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2"><label class="text-xs text-slate-400">Invoice Number<input id="bmInvoiceNo" class="${cls} mt-1" placeholder="Optional"></label><label class="text-xs text-slate-400">Invoice Date<input id="bmInvoiceDate" type="date" value="${now().slice(0,10)}" class="${cls} mt-1"></label><label class="text-xs text-slate-400">Currency<input id="bmCurrency" value="MYR" class="${cls} mt-1"></label><label class="text-xs text-slate-400">Invoice Total<input id="bmInvoiceTotal" type="number" min="0" step="0.01" value="0" class="${cls} mt-1"></label></div>${client?`<div class="grid sm:grid-cols-2 gap-2"><label class="text-xs text-slate-400">Rental / Use From<input id="bmPeriodFrom" type="date" class="${cls} mt-1"></label><label class="text-xs text-slate-400">Rental / Use To<input id="bmPeriodTo" type="date" class="${cls} mt-1"></label></div>`:''}<div id="bmTally" class="text-xs text-slate-500">Itemised total: MYR 0.00</div></div>`;
}
function docsHtml(){return `<div class="border-t border-slate-800 pt-3"><div class="text-xs font-semibold text-amber-400 mb-2">Shared Document References</div><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2"><input class="bmDoc ${cls}" data-type="Reference 1" placeholder="Reference 1"><input class="bmDoc ${cls}" data-type="Reference 2" placeholder="Reference 2"><input class="bmDoc ${cls}" data-type="Reference 3" placeholder="Reference 3"><input id="bmOtherDoc" class="${cls}" placeholder="Other Type | Reference"></div></div>`;}
function formHtml(){
  return `<form id="batchMoveForm" class="space-y-4" data-latest-movement="1"><div class="grid sm:grid-cols-2 gap-3"><label class="text-xs text-slate-400">Action<select id="bmAction" class="${cls} mt-1"><option value="">-- Select Action --</option>${Object.entries(ACTIONS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select></label><div id="bmDestWrap"></div></div><div id="bmInvoiceWrap"></div><div class="border-t border-slate-800 pt-3"><div class="flex items-center justify-between gap-2 mb-2"><div><div class="font-semibold text-sm">Items / Units / Source Locations</div><div class="text-[10px] text-slate-500">Add as many rows as needed. Every row may use a different item, quantity and warehouse / location.</div></div><button id="bmAddRow" type="button" class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-bold">+ Add Item / Location</button></div><div id="bmRows" class="space-y-2"></div></div>${docsHtml()}<div class="grid sm:grid-cols-2 gap-2"><label class="text-xs text-slate-400">Mode<select id="bmMode" class="${cls} mt-1"><option>Normal</option><option>Urgent</option><option>Planned</option></select></label><label class="text-xs text-slate-400">Detail<input id="bmDetail" class="${cls} mt-1" placeholder="Optional detail"></label></div><label class="text-xs text-slate-400">Remark<textarea id="bmRemark" rows="2" class="${cls} mt-1"></textarea></label><button id="bmSave" class="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg text-sm font-bold">Start Transaction / Movement</button></form>`;
}
function bindInvoice(){
  ['bmInvoiceTotal','bmCurrency'].forEach(id=>{const el=byId(id);if(el)el.oninput=updateTally;});
}
function renderInvoice(){
  const w=byId('bmInvoiceWrap');if(!w)return;
  w.innerHTML=invoiceVisible()?invoiceHtml():'';
  document.querySelectorAll('.bmAmountWrap').forEach(x=>x.style.display=invoiceVisible()?'block':'none');
  bindInvoice();updateTally();
}
function updateTally(){
  const el=byId('bmTally');if(!el)return;
  const sum=[...document.querySelectorAll('.bmAmount')].reduce((a,x)=>a+Number(x.value||0),0),total=Number(byId('bmInvoiceTotal')?.value||0),currency=byId('bmCurrency')?.value||'MYR',inv=byId('bmInvoiceNo')?.value.trim()||'';
  const ok=!inv||Math.abs(sum-total)<0.005;
  el.className=`text-xs ${ok?'text-emerald-400':'text-amber-400'}`;
  el.textContent=`Itemised total: ${currency} ${sum.toFixed(2)} · Invoice total: ${currency} ${total.toFixed(2)}${inv?` · ${ok?'Tally':'Mismatch'}`:''}`;
}
function bindRow(row){
  const item=row.querySelector('.bmItem'),source=row.querySelector('.bmSource'),qty=row.querySelector('.bmQty');
  item.onchange=()=>{source.innerHTML=sourceOptions(item.value);lineInfo(row);};
  source.onchange=()=>lineInfo(row);qty.oninput=()=>lineInfo(row);
  row.querySelector('.bmAmount').oninput=updateTally;
  row.querySelector('.bmRemove').onclick=()=>{if(document.querySelectorAll('.bmRow').length===1)return alert('At least one item row is required.');row.remove();updateTally();};
}
function lineInfo(row){
  const i=inventory.find(x=>x.id===row.querySelector('.bmItem').value),idx=Number(row.querySelector('.bmSource').value),b=i?balances(i)[idx]:null;
  row.querySelector('.bmLineInfo').textContent=i&&b?`${i.alias||i.itemCode} · ${b.locationName} · ${b.qty} ${i.unit||''} available at this source`:'';
}
function addRow(){
  const w=byId('bmRows');w.insertAdjacentHTML('beforeend',rowHtml());bindRow(w.lastElementChild);
  document.querySelectorAll('.bmAmountWrap').forEach(x=>x.style.display=invoiceVisible()?'block':'none');
  updateTally();
}
function refreshForAction(){
  byId('bmDestWrap').innerHTML=destHtml();
  document.querySelectorAll('.bmRow').forEach(r=>{const item=r.querySelector('.bmItem');item.innerHTML=itemOptions();r.querySelector('.bmSource').innerHTML='<option value="">-- Select Source Location --</option>';lineInfo(r);});
  renderInvoice();
}
function destination(){
  const a=action(),d=byId('bmDestination');if(!a||!d)return null;
  if(a.to==='maintenance'){const name=d.value.trim();return name?{id:'',name}:null;}
  const name=d.selectedOptions?.[0]?.dataset?.name||d.selectedOptions?.[0]?.textContent?.trim()||'';
  return d.value&&name?{id:d.value,name}:null;
}
function collectLines(){
  const a=action();
  return [...document.querySelectorAll('.bmRow')].map((r,n)=>{
    const item=inventory.find(x=>x.id===r.querySelector('.bmItem').value),raw=r.querySelector('.bmSource').value,idx=raw===''?NaN:Number(raw),balance=item&&Number.isInteger(idx)?balances(item)[idx]:null;
    return{lineNo:n+1,item,balance,qty:Number(r.querySelector('.bmQty').value||0),description:r.querySelector('.bmDesc').value.trim(),invoiceAmount:Number(r.querySelector('.bmAmount').value||0)};
  }).filter(x=>x.item&&x.balance&&sourceAllowed(x.balance,a));
}
function validate(lines,dest){
  if(!action())return'Select an action.';
  if(!dest)return'Select a destination.';
  if(!lines.length)return'Add at least one valid item and source location.';
  for(const l of lines){
    if(l.qty<=0)return`Line ${l.lineNo}: quantity must be greater than zero.`;
    if(l.qty>l.balance.qty)return`Line ${l.lineNo}: quantity exceeds available quantity at ${l.balance.locationName}.`;
    if(l.item.trackingType==='serialized'&&l.qty!==1)return`Line ${l.lineNo}: serialized items must move as quantity 1.`;
  }
  const bySource=new Map();
  for(const l of lines){const k=`${l.item.id}|${l.balance.locationType}|${l.balance.locationId}|${l.balance.locationName}|${l.balance.status}`,used=(bySource.get(k)||0)+l.qty;bySource.set(k,used);if(used>l.balance.qty)return`${l.item.alias||l.item.itemCode}: combined quantity exceeds stock at ${l.balance.locationName}.`;}
  const inv=byId('bmInvoiceNo')?.value.trim()||'';
  if(inv){const sum=lines.reduce((a,l)=>a+l.invoiceAmount,0),total=Number(byId('bmInvoiceTotal')?.value||0);if(Math.abs(sum-total)>=0.005)return`Invoice itemised total (${sum.toFixed(2)}) must equal Invoice Total (${total.toFixed(2)}).`;}
  const pf=byId('bmPeriodFrom')?.value||'',pt=byId('bmPeriodTo')?.value||'';
  if((pf&&!pt)||(!pf&&pt))return'Enter both rental/use period dates or leave both blank.';
  if(pf&&pt&&pt<pf)return'Rental / Use To cannot be before From.';
  return'';
}
function sharedDocs(){
  const docs=[...document.querySelectorAll('.bmDoc')].map((x,n)=>({docType:x.dataset.type||`Reference ${n+1}`,refNumber:x.value.trim()})).filter(x=>x.refNumber);
  const o=byId('bmOtherDoc')?.value.trim();if(o){const [t,...r]=o.split('|');docs.push({docType:t.trim()||'Other',refNumber:r.join('|').trim()||o});}
  return docs;
}
async function save(e){
  e.preventDefault();if(saving)return;
  const a=action(),dest=destination(),lines=collectLines(),err=validate(lines,dest);if(err)return alert(err);
  saving=true;const btn=byId('bmSave');btn.disabled=true;btn.textContent='Saving...';
  try{
    const u=auth.currentUser;if(!u)throw new Error('Sign in required.');
    const p=await getDoc(doc(db,'users',u.uid));if(!p.exists()||p.data().status!=='active')throw new Error('Active user profile required.');
    const user=p.data(),email=user.email||u.email||'',batchId=doc(collection(db,'movements')).id,createdAt=now(),docs=sharedDocs();
    const invNo=byId('bmInvoiceNo')?.value.trim()||'',invDate=byId('bmInvoiceDate')?.value||createdAt.slice(0,10),invTotal=Number(byId('bmInvoiceTotal')?.value||0),currency=byId('bmCurrency')?.value||'MYR',periodFrom=byId('bmPeriodFrom')?.value||'',periodTo=byId('bmPeriodTo')?.value||'';
    const refs=lines.map(()=>doc(collection(db,'movements')));
    await runTransaction(db,async tx=>{
      const state=new Map();
      for(const id of [...new Set(lines.map(l=>l.item.id))]){const s=await tx.get(doc(db,'inventory',id));if(!s.exists())throw new Error('An item is missing.');state.set(id,{data:s.data(),balances:balances(s.data())});}
      for(let n=0;n<lines.length;n++){
        const l=lines[n],st=state.get(l.item.id),src=st.balances.find(b=>b.locationType===l.balance.locationType&&b.locationId===l.balance.locationId&&b.locationName===l.balance.locationName&&b.status===l.balance.status);
        if(!src||src.qty<l.qty)throw new Error(`${l.item.alias||l.item.itemCode}: source stock changed. Refresh and retry.`);
        src.qty-=l.qty;
        const mr=refs[n];
        st.balances.push({qty:l.qty,locationType:'transit',locationId:mr.id,locationName:`Transit to ${dest.name}`,status:'In Transit'});
        let side='',partyId='',partyName='';
        if(invNo&&a.to==='client'){side='client';partyId=dest.id;partyName=dest.name;}
        else if(invNo&&a.from==='supplier'){side='supplier';partyId=l.balance.locationId||l.item.supplierId||'';partyName=l.balance.locationName||l.item.supplierName||'';}
        const groupKey=invNo?`${side}|${partyId}|${invNo}`.toLowerCase():'';
        tx.set(mr,{movementId:mr.id,movementBatchId:batchId,invoiceGroupKey:groupKey,invoiceLineNo:l.lineNo,itemId:l.item.id,itemCode:l.item.itemCode,itemAlias:l.item.alias||'',itemNameSnapshot:l.item.name,categorySnapshot:l.item.category||'',supplierId:l.item.supplierId||'',supplierNameSnapshot:l.item.supplierName||'',action:byId('bmAction').value,actionLabel:a.label,fromType:l.balance.locationType,fromId:l.balance.locationId||'',fromName:l.balance.locationName,toType:a.to,toId:dest.id,toName:dest.name,toStatus:a.toStatus,qty:l.qty,unit:l.item.unit||'',mode:byId('bmMode').value,detail:byId('bmDetail').value.trim(),remark:byId('bmRemark').value.trim(),documents:docs,status:'in_transit',createdAt,createdBy:email,createdByRole:user.role||ROLE,invoiceNumber:invNo,invoiceDate:invNo?invDate:'',invoiceAmount:invNo?l.invoiceAmount:0,invoiceTotal:invNo?invTotal:0,invoiceDescription:invNo?l.description:'',invoiceSide:side,invoicePartyId:partyId,invoicePartyName:partyName,invoiceStatus:invNo?'Active':'',currency:invNo?currency:'',clientTransactionType:a.to==='client'?(periodFrom||periodTo?'Rental / Use Period':'At Client'):'',periodFrom,periodTo});
      }
      for(const [id,st] of state){const clean=st.balances.filter(b=>b.qty>0),sum=summary(clean);tx.update(doc(db,'inventory',id),{stockBalances:clean,status:sum.status,currentLocation:sum.location,lastEditedBy:email,lastEditedAt:createdAt});}
    });
    for(let n=0;n<lines.length;n++){
      const l=lines[n],mr=refs[n];
      for(const x of docs)await addDoc(collection(db,'document_refs'),{itemId:l.item.id,itemCode:l.item.itemCode,itemAlias:l.item.alias||'',context:a.label,docType:x.docType,refNumber:x.refNumber,eventId:mr.id,status:'current',createdAt,createdBy:email,createdByRole:user.role||ROLE});
      await addDoc(collection(db,'operational_logs'),{logVersion:2,date:createdAt,activity:byId('bmAction').value,activityLabel:a.label,status:'In Transit',fromType:l.balance.locationType,fromName:l.balance.locationName,toType:a.to,toName:dest.name,qty:l.qty,unit:l.item.unit||'',itemId:l.item.id,itemCode:l.item.itemCode,itemAlias:l.item.alias||'',itemName:l.item.name,category:l.item.category||'',supplierId:l.item.supplierId||'',supplierName:l.item.supplierName||'',clientId:a.to==='client'?dest.id:(l.balance.locationType==='client'?l.balance.locationId||'':''),clientName:a.to==='client'?dest.name:(l.balance.locationType==='client'?l.balance.locationName:''),invoiceNumber:invNo,movementId:mr.id,movementBatchId:batchId,performedBy:email,performedByRole:user.role||ROLE,remark:byId('bmRemark').value.trim(),documents:docs});
    }
    await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:'START_MOVEMENT_BATCH',module:'Movement',targetType:'movement_batch',targetName:`${a.label} · ${lines.length} line(s)`,targetId:batchId,summary:`Start Movement Batch: ${a.label}`,beforeValue:null,afterValue:{action:byId('bmAction').value,destination:dest.name,toStatus:a.toStatus,lines:lines.map(l=>({itemCode:l.item.itemCode,alias:l.item.alias||'',from:l.balance.locationName,qty:l.qty,invoiceAmount:l.invoiceAmount})),invoiceNumber:invNo,invoiceTotal:invTotal,currency,periodFrom,periodTo},changedFields:['action','destination','toStatus','lines','invoiceNumber','invoiceTotal','periodFrom','periodTo'],remark:byId('bmRemark').value.trim(),metadata:{movementIds:refs.map(x=>x.id)},performedBy:email,performedByRole:user.role||ROLE,performedAt:createdAt});
    alert(`${lines.length} item / location line(s) started successfully.`);location.reload();
  }catch(ex){console.error('Batch movement failed:',ex);alert('Batch movement failed: '+(ex?.message||ex));btn.disabled=false;btn.textContent='Start Transaction / Movement';saving=false;}
}
async function mount(){
  const old=byId('moveForm');if(!old||byId('batchMoveForm'))return;
  try{await load();}catch(e){console.warn('Batch movement data unavailable:',e);return;}
  const wrap=document.createElement('div');wrap.innerHTML=formHtml();old.replaceWith(wrap.firstElementChild);
  byId('bmAction').onchange=refreshForAction;
  byId('bmAddRow').onclick=addRow;
  byId('batchMoveForm').onsubmit=save;
  addRow();
}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mount,25);}).observe(document.body,{childList:true,subtree:true});
mount();
