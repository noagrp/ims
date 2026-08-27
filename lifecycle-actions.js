import { auth, db } from './firebase-config.js';
import { collection, addDoc, doc, getDoc, runTransaction, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const ROLE=window.IMS_ROLE||'admin';
const byId=id=>document.getElementById(id);
const now=()=>new Date().toISOString();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const field=(t,h)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${t}</span>${h}</label>`;

function normalizeBalances(item){
  let b=Array.isArray(item.stockBalances)?item.stockBalances:[];
  if(!b.length){const q=Number(item.quantity??item.qty??1);if(q>0)b=[{qty:q,locationType:'warehouse',locationName:item.currentLocation||'Unknown',status:item.status||'At Warehouse'}];}
  return b.map(x=>({qty:Number(x.qty||0),locationType:x.locationType||'',locationId:x.locationId||'',locationName:x.locationName||x.location||'Unknown',status:x.status||''}));
}
function summarize(active,finalStatus,finalLocation){
  const p=active.filter(x=>Number(x.qty)>0);
  if(!p.length)return{status:finalStatus,location:finalLocation};
  if(p.length===1)return{status:p[0].status||'Active',location:p[0].locationName||'Unknown'};
  return{status:'Multiple Locations',location:`${p.length} Locations`};
}
function actionType(){return byId('moveAction')?.value||'';}
function isLifecycleAction(v=actionType()){return v==='SELL_OWNERSHIP'||v==='WRITE_OFF';}

function addOptions(){
  const a=byId('moveAction');if(!a)return;
  if(![...a.options].some(o=>o.value==='SELL_OWNERSHIP'))a.insertAdjacentHTML('beforeend','<option value="SELL_OWNERSHIP">Sell / Transfer Ownership</option>');
  if(![...a.options].some(o=>o.value==='WRITE_OFF'))a.insertAdjacentHTML('beforeend','<option value="WRITE_OFF">Write Off / Dispose</option>');
}
function renderFields(){
  const a=actionType();if(!isLifecycleAction(a))return;
  const wrap=byId('moveDestinationWrap'),docs=byId('moveDocsWrap');if(!wrap||!docs)return;
  if(a==='SELL_OWNERSHIP'){
    wrap.innerHTML=`<div id="imsLifecycleFields" class="space-y-3"><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">${field('Buyer / Client',`<input id="imsLifeBuyer" class="${cls}" required placeholder="Buyer / company / person">`)}${field('Sale Date',`<input type="date" id="imsLifeDate" class="${cls}" required value="${now().slice(0,10)}">`)}${field('Currency',`<input id="imsLifeCurrency" class="${cls}" value="MYR">`)}${field('Unit Price',`<input type="number" id="imsLifePrice" class="${cls}" min="0" step="0.01">`)}</div><div class="grid sm:grid-cols-2 gap-2">${field('Total Amount',`<input type="number" id="imsLifeTotal" class="${cls}" min="0" step="0.01">`)}${field('Invoice / DO / Reference',`<input id="imsLifeRef" class="${cls}" placeholder="Invoice, DO or sale reference">`)}</div></div>`;
    docs.innerHTML='<div class="text-xs text-slate-500">Sale is recorded as a completed stock exit. The item record remains searchable.</div>';
    const calc=()=>{const t=byId('imsLifeTotal');if(t&&!t.dataset.manual)t.value=(Number(byId('moveQty')?.value||0)*Number(byId('imsLifePrice')?.value||0)).toFixed(2);};
    byId('moveQty')?.addEventListener('input',calc,{once:false});byId('imsLifePrice')?.addEventListener('input',calc);byId('imsLifeTotal')?.addEventListener('input',()=>byId('imsLifeTotal').dataset.manual='1');
  }else{
    wrap.innerHTML=`<div id="imsLifecycleFields" class="space-y-3"><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">${field('Write-off Date',`<input type="date" id="imsLifeDate" class="${cls}" required value="${now().slice(0,10)}">`)}${field('Reason',`<select id="imsLifeReason" class="${cls}" required><option value="">-- Select Reason --</option><option>Damaged</option><option>Spoiled</option><option>Beyond Repair</option><option>Lost</option><option>Obsolete</option><option>Other</option></select>`)}${field('Supporting Reference',`<input id="imsLifeRef" class="${cls}" placeholder="Report / approval / disposal ref">`)}${field('Disposal Location / Method',`<input id="imsLifeBuyer" class="${cls}" placeholder="Disposed, scrap yard, destroyed...">`)}</div></div>`;
    docs.innerHTML='<div class="text-xs text-slate-500">Written-off stock leaves active inventory but remains in history and audit records.</div>';
  }
}

async function writeLifecycle(e){
  const a=actionType();if(!isLifecycleAction(a))return;
  e.preventDefault();e.stopImmediatePropagation();
  const itemId=byId('moveItem')?.value,sourceIndex=Number(byId('moveSource')?.value),qty=Number(byId('moveQty')?.value||0),unit=byId('moveUnit')?.value||'',remark=byId('moveRemark')?.value.trim()||'';
  if(!itemId||!Number.isFinite(sourceIndex)||sourceIndex<0||qty<=0){alert('Select an item, source and valid quantity.');return;}
  const date=byId('imsLifeDate')?.value||now().slice(0,10),refNo=byId('imsLifeRef')?.value.trim()||'',buyer=byId('imsLifeBuyer')?.value.trim()||'',reason=byId('imsLifeReason')?.value||'';
  if(a==='SELL_OWNERSHIP'&&!buyer){alert('Enter the buyer / client.');return;}
  if(a==='WRITE_OFF'&&!reason){alert('Select a write-off reason.');return;}
  const user=auth.currentUser;if(!user){alert('You must be signed in.');return;}
  const invRef=doc(db,'inventory',itemId),movRef=doc(collection(db,'movements'));
  let snapshot=null,fromName='',finalStatus=a==='SELL_OWNERSHIP'?'Sold':'Written Off',finalLocation=a==='SELL_OWNERSHIP'?buyer:(buyer||'Disposed / Written Off');
  try{
    await runTransaction(db,async tx=>{
      const snap=await tx.get(invRef);if(!snap.exists())throw new Error('Item not found.');
      const item={id:snap.id,...snap.data()};snapshot=item;
      const all=normalizeBalances(item),active=all.filter(x=>x.locationType!=='transit'&&x.qty>0),src=active[sourceIndex];
      if(!src)throw new Error('Source stock changed. Refresh and try again.');
      if(qty>src.qty)throw new Error('Quantity exceeds the selected source balance.');
      if((item.trackingType||'')==='serialized'&&qty!==1)throw new Error('Serialized items must be sold or written off as quantity 1.');
      if(unit&&item.unit&&unit!==item.unit)throw new Error(`Unit must match item unit (${item.unit}).`);
      fromName=src.locationName;src.qty-=qty;
      const remaining=all.filter(x=>x.qty>0);
      const sum=summarize(remaining,finalStatus,finalLocation);
      const storedBalances=remaining.length?remaining:[{qty:0,locationType:a==='SELL_OWNERSHIP'?'sold':'writeoff',locationId:movRef.id,locationName:finalLocation,status:finalStatus}];
      tx.update(invRef,{stockBalances:storedBalances,status:sum.status,currentLocation:sum.location,lastEditedAt:now(),lastEditedBy:user.email||''});
      const movement={movementId:movRef.id,itemId,itemCode:item.itemCode||'',itemNameSnapshot:item.name||'',categorySnapshot:item.category||'',brand:item.brand||'',model:item.model||'',specification:item.specification||'',action:a,actionLabel:a==='SELL_OWNERSHIP'?'Sell / Transfer Ownership':'Write Off / Dispose',fromType:src.locationType||'',fromId:src.locationId||'',fromName:src.locationName||'',toType:a==='SELL_OWNERSHIP'?'sold':'writeoff',toId:'',toName:finalLocation,toStatus:finalStatus,qty,unit:item.unit||unit,status:'completed',createdAt:now(),createdBy:user.email||'',createdByRole:ROLE,completedAt:now(),completedBy:user.email||'',eventDate:date,remark,reference:refNo};
      if(a==='SELL_OWNERSHIP')Object.assign(movement,{buyerName:buyer,currency:byId('imsLifeCurrency')?.value.trim()||'MYR',unitPrice:Number(byId('imsLifePrice')?.value||0),totalAmount:Number(byId('imsLifeTotal')?.value||0),clientTransactionType:'Sale'});
      else Object.assign(movement,{writeOffReason:reason,disposalMethod:buyer});
      tx.set(movRef,movement);
    });
    const item=snapshot;
    const log={logVersion:2,date:now(),activity:a,activityLabel:a==='SELL_OWNERSHIP'?'Sell / Transfer Ownership':'Write Off / Dispose',status:finalStatus,fromType:'',fromName,toType:a==='SELL_OWNERSHIP'?'sold':'writeoff',toName:finalLocation,qty,unit:item.unit||unit,itemId,itemCode:item.itemCode||'',itemName:item.name||'',category:item.category||'',supplierId:item.supplierId||'',supplierName:item.supplierName||'',clientId:'',clientName:a==='SELL_OWNERSHIP'?buyer:'',performedBy:user.email||'',performedByRole:ROLE,remark,reference:refNo};
    if(a==='SELL_OWNERSHIP')Object.assign(log,{currency:byId('imsLifeCurrency')?.value.trim()||'MYR',unitPrice:Number(byId('imsLifePrice')?.value||0),totalAmount:Number(byId('imsLifeTotal')?.value||0)});else log.writeOffReason=reason;
    await addDoc(collection(db,'operational_logs'),log);
    await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:a,module:'Main Workspace',targetType:'inventory',targetName:item.itemCode||item.name||itemId,targetId:itemId,summary:`${a==='SELL_OWNERSHIP'?'Sell / Transfer Ownership':'Write Off / Dispose'}: ${item.itemCode||item.name||itemId}`,beforeValue:{status:item.status||'',currentLocation:item.currentLocation||'',stockBalances:item.stockBalances||[]},afterValue:{status:finalStatus,stockExitQty:qty,unit:item.unit||unit,to:finalLocation,reference:refNo},changedFields:['status','currentLocation','stockBalances'],remark,metadata:{movementId:movRef.id,eventDate:date,reason:a==='WRITE_OFF'?reason:'',buyer:a==='SELL_OWNERSHIP'?buyer:''},performedBy:user.email||'',performedByRole:ROLE,performedAt:now()});
    if(refNo){await setDoc(doc(collection(db,'document_refs')),{itemId,itemCode:item.itemCode||'',itemNameSnapshot:item.name||'',categorySnapshot:item.category||'',context:a==='SELL_OWNERSHIP'?'Sale / Ownership Transfer':'Write Off / Disposal',docType:a==='SELL_OWNERSHIP'?'Sale Reference':'Write-off Reference',refNumber:refNo,eventId:movRef.id,status:'current',createdAt:now(),createdBy:user.email||'',createdByRole:ROLE});}
    alert(a==='SELL_OWNERSHIP'?'Sale / ownership transfer recorded.':'Write-off / disposal recorded.');
    location.reload();
  }catch(err){console.error('IMS lifecycle action failed:',err);alert(err?.message||String(err));}
}

function addDetailShortcuts(){
  const mount=byId('itemDetailMount');if(!mount||!mount.innerHTML.trim()||byId('imsLifeShortcuts'))return;
  const bar=document.createElement('div');bar.id='imsLifeShortcuts';bar.className='flex flex-wrap gap-2 mb-3';
  bar.innerHTML='<button type="button" id="imsSellShortcut" class="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-lg text-xs font-bold">Sell Item</button><button type="button" id="imsWriteoffShortcut" class="bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-lg text-xs font-bold">Write Off Item</button>';
  mount.prepend(bar);
  const go=action=>{const workspace=document.querySelector('.navBtn[data-tab="workspace"]');workspace?.click();setTimeout(()=>{const id=window.__imsLastOpenedItemId||'';const item=byId('moveItem');if(id&&item){item.value=id;item.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>{const source=byId('moveSource');if(source&&source.options.length>1){source.selectedIndex=1;source.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>{const act=byId('moveAction');if(act){addOptions();act.value=action;act.dispatchEvent(new Event('change',{bubbles:true}));}},40);}},40);}},60);};
  byId('imsSellShortcut').onclick=()=>go('SELL_OWNERSHIP');byId('imsWriteoffShortcut').onclick=()=>go('WRITE_OFF');
}

document.addEventListener('click',e=>{const b=e.target.closest?.('button[onclick^="openItem("]');if(!b)return;const m=b.getAttribute('onclick')?.match(/openItem\('([^']+)'\)/);if(m)window.__imsLastOpenedItemId=m[1];},true);
document.addEventListener('change',e=>{if(e.target?.id==='moveSource'){setTimeout(addOptions,0);}if(e.target?.id==='moveAction')setTimeout(renderFields,0);},true);
document.addEventListener('submit',writeLifecycle,true);

let t;
new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{addOptions();if(isLifecycleAction())renderFields();addDetailShortcuts();},20);}).observe(document.body,{childList:true,subtree:true});
addOptions();addDetailShortcuts();
