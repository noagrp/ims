import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDoc, runTransaction, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const ROLE=window.IMS_ROLE||'admin';
const byId=id=>document.getElementById(id);
const now=()=>new Date().toISOString();
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const field=(t,h)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${t}</span>${h}</label>`;

function normalizeBalances(item){
  let b=Array.isArray(item.stockBalances)?item.stockBalances:[];
  if(!b.length){const q=Number(item.quantity??item.qty??1);if(q>0)b=[{qty:q,locationType:'warehouse',locationId:'',locationName:item.currentLocation||'Unknown',status:item.status||'At Warehouse'}];}
  return b.map(x=>({qty:Number(x.qty||0),locationType:x.locationType||'',locationId:x.locationId||'',locationName:x.locationName||x.location||'Unknown',status:x.status||''}));
}
function summarizeBalances(bal){
  const p=bal.filter(x=>Number(x.qty)>0);
  if(!p.length)return{status:'Disposed',location:'No Stock'};
  if(p.length===1)return{status:p[0].status||'Active',location:p[0].locationName||'Unknown'};
  return{status:'Multiple Locations',location:`${p.length} Locations`};
}
async function me(){
  const user=auth.currentUser;if(!user)throw new Error('You must be signed in.');
  const snap=await getDoc(doc(db,'users',user.uid));
  if(!snap.exists()||snap.data().status!=='active')throw new Error('Active user profile required.');
  return{user,email:snap.data().email||user.email||'',role:snap.data().role||ROLE};
}
async function docRef(item,context,docType,refNumber,eventId,user){
  if(!String(refNumber||'').trim())return;
  const r=doc(collection(db,'document_refs'));
  await setDoc(r,{itemId:item.id,itemCode:item.itemCode,itemNameSnapshot:item.name,categorySnapshot:item.category||'',supplierId:item.supplierId||'',supplierNameSnapshot:item.supplierName||'',context,docType:String(docType||'Other').trim(),refNumber:String(refNumber).trim(),eventId,status:'current',createdAt:now(),createdBy:user.email,createdByRole:user.role});
}

function injectPurchase(){
  const form=byId('registerForm');if(!form||byId('imsPurchaseCommercial'))return;
  const docs=byId('regPO')?.closest('.sm\\:col-span-2');
  const block=document.createElement('div');
  block.id='imsPurchaseCommercial';block.className='sm:col-span-2 border-t border-slate-800 pt-3';
  block.innerHTML=`<div class="text-xs font-semibold text-emerald-400 mb-2">Purchase / Commercial</div><div class="grid sm:grid-cols-3 gap-2">${field('Currency',`<input id="regCurrency" class="${cls}" value="MYR">`)}${field('Unit Price',`<input type="number" id="regUnitPrice" min="0" step="0.01" class="${cls}" placeholder="0.00">`)}${field('Total Amount',`<input type="number" id="regTotalAmount" min="0" step="0.01" class="${cls}" placeholder="0.00">`)}</div><div class="text-[10px] text-slate-500 mt-1">Total defaults to Quantity × Unit Price and can be edited to match the supplier invoice.</div>`;
  if(docs)form.insertBefore(block,docs);else form.appendChild(block);
  const calc=()=>{const t=byId('regTotalAmount');if(t&&!t.dataset.manual)t.value=(Number(byId('itemQty')?.value||0)*Number(byId('regUnitPrice')?.value||0)).toFixed(2);};
  byId('itemQty')?.addEventListener('input',calc);byId('regUnitPrice')?.addEventListener('input',calc);byId('regTotalAmount')?.addEventListener('input',()=>byId('regTotalAmount').dataset.manual='1');
}

function rentalFields(){
  const wrap=byId('moveDestinationWrap'),status=byId('clientPositionStatus');if(!wrap||!status)return;
  const old=byId('imsRentalCommercial');if(status.value!=='Rental'){old?.remove();return;}
  if(old)return;
  const block=document.createElement('div');block.id='imsRentalCommercial';block.className='mt-3 border-t border-slate-800 pt-3';
  block.innerHTML=`<div class="text-xs font-semibold text-emerald-400 mb-2">Rental / Commercial</div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">${field('Rental From',`<input type="date" id="rentalFrom" class="${cls}" required>`)}${field('Rental To',`<input type="date" id="rentalTo" class="${cls}" required>`)}${field('Currency',`<input id="rentalCurrency" class="${cls}" value="MYR">`)}${field('Rate Basis',`<select id="rentalRateBasis" class="${cls}"><option value="unit">Unit</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="flat">Flat</option></select>`)}${field('Unit Price',`<input type="number" id="rentalUnitPrice" min="0" step="0.01" class="${cls}" placeholder="0.00">`)}${field('Total Amount',`<input type="number" id="rentalTotalAmount" min="0" step="0.01" class="${cls}" placeholder="0.00">`)}</div><div class="text-[10px] text-slate-500 mt-1">Rental duration does not automatically change the amount. Total defaults to Quantity × Unit Price and may be edited to match the invoice.</div>`;
  wrap.appendChild(block);
  const calc=()=>{const t=byId('rentalTotalAmount');if(t&&!t.dataset.manual)t.value=(Number(byId('moveQty')?.value||0)*Number(byId('rentalUnitPrice')?.value||0)).toFixed(2);};
  byId('moveQty')?.addEventListener('input',calc);byId('rentalUnitPrice')?.addEventListener('input',calc);byId('rentalTotalAmount')?.addEventListener('input',()=>byId('rentalTotalAmount').dataset.manual='1');
}

async function registerCommercial(e){
  if(e.target?.id!=='registerForm')return;
  e.preventDefault();e.stopImmediatePropagation();
  try{
    const who=await me();
    const code=byId('itemCode').value.trim(),name=byId('itemName').value.trim(),qty=Number(byId('itemQty').value),unit=byId('itemUnit').value,category=byId('itemCategory').value,position=byId('initialPosition').value;
    const supplier=byId('itemSupplier'),sid=supplier?.value||'',supplierName=supplier?.selectedOptions?.[0]?.textContent?.trim()||'';
    const loc=byId('initialLocation')?.value.trim()||'';
    if(!code||!name||!category||!qty||!unit||!loc)throw new Error('Complete item code, name, category, quantity, unit and initial location.');
    if(position==='supplier'&&!sid)throw new Error('Select the supplier for an item initially at supplier.');
    const currency=byId('regCurrency')?.value.trim()||'MYR',unitPrice=Number(byId('regUnitPrice')?.value||0),totalAmount=Number(byId('regTotalAmount')?.value||0);
    if(unitPrice<0||totalAmount<0)throw new Error('Price and total amount cannot be negative.');
    const ref=doc(collection(db,'inventory')),status=position==='supplier'?'At Supplier':'At Warehouse';
    const newItem={type:byId('itemType').value,trackingType:byId('trackingType').value,itemCode:code,name,category,quantity:qty,unit,status,currentLocation:loc,supplierId:sid,supplierName:position==='supplier'?supplierName:(sid?supplierName:''),stockBalances:[{qty,locationType:position,locationId:position==='supplier'?sid:'',locationName:loc,status}],purchaseCurrency:currency,purchaseUnitPrice:unitPrice,purchaseTotalAmount:totalAmount,remark:byId('itemRemark')?.value.trim()||'',createdBy:who.email,createdAt:now(),lastEditedBy:null,lastEditedAt:null};
    ['brand','model','specification'].forEach(k=>{const el=byId(`item${k[0].toUpperCase()+k.slice(1)}`);if(el?.value){newItem[k]=el.selectedOptions?.[0]?.dataset?.name||el.selectedOptions?.[0]?.textContent||el.value;newItem[`${k}Id`]=el.value;}});
    await setDoc(ref,newItem);
    const item={id:ref.id,...newItem};
    const docs=[['Our PO',byId('regPO')?.value],['Supplier Invoice',byId('regSupplierInvoice')?.value],['Supplier DO',byId('regSupplierDO')?.value]].filter(x=>String(x[1]||'').trim());
    const oth=byId('regOtherDoc')?.value.trim()||'';if(oth){const [t,...r]=oth.split('|');docs.push([t.trim()||'Other',r.join('|').trim()||oth]);}
    for(const [t,r] of docs)await docRef(item,'Supplier / Registration',t,r,ref.id,who);
    await addDoc(collection(db,'operational_logs'),{logVersion:2,date:now(),activity:'REGISTER_ITEM',activityLabel:'Register Item',status,fromType:'',fromName:'',toType:position,toName:loc,qty,unit,itemId:item.id,itemCode:code,itemName:name,category,supplierId:sid,supplierName:newItem.supplierName,clientId:'',clientName:'',currency,unitPrice,totalAmount,clientTransactionType:'Purchase',performedBy:who.email,performedByRole:who.role,remark:newItem.remark,documents:docs.map(([docType,refNumber])=>({docType,refNumber}))});
    await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:'CREATE_ITEM',module:'Main Workspace',targetType:'inventory',targetName:code,targetId:item.id,summary:`Create Item: ${code}`,beforeValue:null,afterValue:{name,category,qty,unit,status,location:loc,supplier:newItem.supplierName,purchaseCurrency:currency,purchaseUnitPrice:unitPrice,purchaseTotalAmount:totalAmount},changedFields:[],remark:newItem.remark,metadata:{commercial:true},performedBy:who.email,performedByRole:who.role,performedAt:now()});
    alert('Item registered.');location.reload();
  }catch(err){console.error('IMS commercial registration failed:',err);alert(err?.message||String(err));}
}

async function rentalMovement(e){
  if(e.target?.id!=='moveForm'||byId('moveAction')?.value!=='DELIVER_CLIENT'||byId('clientPositionStatus')?.value!=='Rental')return;
  e.preventDefault();e.stopImmediatePropagation();
  try{
    const who=await me(),itemId=byId('moveItem')?.value,sourceIndex=Number(byId('moveSource')?.value),qty=Number(byId('moveQty')?.value),unit=byId('moveUnit')?.value||'';
    const dest=byId('moveDestination'),toId=dest?.value||'',toName=dest?.selectedOptions?.[0]?.dataset?.name||dest?.selectedOptions?.[0]?.textContent?.trim()||'';
    const periodFrom=byId('rentalFrom')?.value||'',periodTo=byId('rentalTo')?.value||'',currency=byId('rentalCurrency')?.value.trim()||'MYR',rateBasis=byId('rentalRateBasis')?.value||'unit',unitPrice=Number(byId('rentalUnitPrice')?.value||0),totalAmount=Number(byId('rentalTotalAmount')?.value||0);
    if(!itemId||!Number.isFinite(sourceIndex)||sourceIndex<0||qty<=0||!toId||!toName)throw new Error('Select valid item, source, client and quantity.');
    if(!periodFrom||!periodTo)throw new Error('Select Rental From and Rental To dates.');
    if(periodTo<periodFrom)throw new Error('Rental To cannot be before Rental From.');
    if(unitPrice<0||totalAmount<0)throw new Error('Price and total amount cannot be negative.');
    const invRef=doc(db,'inventory',itemId),movementRef=doc(collection(db,'movements')),movementId=movementRef.id,remark=byId('moveRemark')?.value.trim()||'';
    let itemSnapshot=null,fromName='';
    await runTransaction(db,async tx=>{
      const snap=await tx.get(invRef);if(!snap.exists())throw new Error('Item missing.');
      const item={id:snap.id,...snap.data()};itemSnapshot=item;
      if(unit&&item.unit&&unit!==item.unit)throw new Error(`Unit must match item unit (${item.unit}).`);
      if(item.trackingType==='serialized'&&qty!==1)throw new Error('Serialized items must move as quantity 1.');
      const bal=normalizeBalances(item),active=bal.filter(x=>x.locationType!=='transit'&&x.qty>0),src=active[sourceIndex];if(!src||qty>src.qty)throw new Error('Source stock changed. Refresh and retry.');
      fromName=src.locationName;src.qty-=qty;
      bal.push({qty,locationType:'transit',locationId:movementId,locationName:`Transit to ${toName}`,status:'In Transit'});
      const clean=bal.filter(x=>x.qty>0),sum=summarizeBalances(clean);
      tx.update(invRef,{stockBalances:clean,status:sum.status,currentLocation:sum.location,lastEditedBy:who.email,lastEditedAt:now()});
      tx.set(movementRef,{movementId,itemId,itemCode:item.itemCode||'',itemNameSnapshot:item.name||'',categorySnapshot:item.category||'',supplierId:item.supplierId||'',supplierNameSnapshot:item.supplierName||'',action:'DELIVER_CLIENT',actionLabel:'Deliver to Client',fromType:src.locationType||'',fromId:src.locationId||'',fromName:src.locationName||'',toType:'client',toId,toName,toStatus:'Rental',qty,unit:item.unit||unit,mode:byId('moveMode')?.value||'',detail:byId('moveDetail')?.value.trim()||'',remark,documents:[],status:'in_transit',createdAt:now(),createdBy:who.email,createdByRole:who.role,clientTransactionType:'Rental',periodFrom,periodTo,currency,rateBasis,unitPrice,totalAmount});
    });
    const item=itemSnapshot;
    const docs=[...document.querySelectorAll('.moveDoc')].map(x=>({docType:x.dataset.type,refNumber:x.value.trim()})).filter(x=>x.refNumber);const oth=byId('moveOtherDoc')?.value.trim()||'';if(oth){const [t,...r]=oth.split('|');docs.push({docType:t.trim()||'Other',refNumber:r.join('|').trim()||oth});}
    for(const x of docs)await docRef(item,'Deliver to Client',x.docType,x.refNumber,movementId,who);
    await addDoc(collection(db,'operational_logs'),{logVersion:2,date:now(),activity:'DELIVER_CLIENT',activityLabel:'Deliver to Client',status:'In Transit',fromType:'',fromName,toType:'client',toName,qty,unit:item.unit||unit,itemId,itemCode:item.itemCode||'',itemName:item.name||'',category:item.category||'',supplierId:item.supplierId||'',supplierName:item.supplierName||'',clientId:toId,clientName:toName,clientTransactionType:'Rental',periodFrom,periodTo,currency,rateBasis,unitPrice,totalAmount,performedBy:who.email,performedByRole:who.role,remark,documents:docs});
    await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:'START_MOVEMENT',module:'Main Workspace',targetType:'movement',targetName:`${item.itemCode||''} Deliver to Client`,targetId:movementId,summary:`Start Movement: ${item.itemCode||item.name||itemId} Deliver to Client`,beforeValue:null,afterValue:{from:fromName,to:toName,qty,unit:item.unit||unit,status:'In Transit',clientTransactionType:'Rental',periodFrom,periodTo,currency,rateBasis,unitPrice,totalAmount},changedFields:[],remark,metadata:{movementId,commercial:true},performedBy:who.email,performedByRole:who.role,performedAt:now()});
    alert('Rental movement started and item is now in transit.');location.reload();
  }catch(err){console.error('IMS rental movement failed:',err);alert(err?.message||String(err));}
}

document.addEventListener('change',e=>{if(e.target?.id==='clientPositionStatus')setTimeout(rentalFields,0);},true);
document.addEventListener('submit',e=>{if(e.target?.id==='registerForm')registerCommercial(e);else if(e.target?.id==='moveForm')rentalMovement(e);},true);

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{injectPurchase();rentalFields();},20);}).observe(document.body,{childList:true,subtree:true});
injectPurchase();rentalFields();
