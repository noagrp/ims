import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const ROLE=window.IMS_ROLE||'admin';
const byId=id=>document.getElementById(id);
const now=()=>new Date().toISOString();
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
let saving=false,inventoryCache=[];

function selected(id){const e=byId(id),o=e?.selectedOptions?.[0];return{id:e?.value||'',value:o?.dataset?.v||o?.textContent?.trim()||''};}
function permanentCode(ref){return `ITM-${ref.id.slice(0,10).toUpperCase()}`;}
async function profile(){const u=auth.currentUser;if(!u)throw new Error('Sign in required.');const s=await getDoc(doc(db,'users',u.uid));if(!s.exists()||s.data().status!=='active')throw new Error('Active user profile required.');return{email:s.data().email||u.email||'',role:s.data().role||ROLE};}
async function refreshInventory(){const s=await getDocs(collection(db,'inventory'));inventoryCache=s.docs.map(d=>({id:d.id,...d.data()}));}
function aliasesFor(qty){const first=byId('itemCode')?.value.trim()||'',extra=(byId('batchAliases')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);const list=[first,...extra].filter(Boolean);if(list.length>qty)throw new Error(`You entered ${list.length} aliases for ${qty} unit(s).`);const dup=list.find((x,i)=>list.findIndex(y=>norm(y)===norm(x))!==i);if(dup)throw new Error(`Duplicate alias in this batch: ${dup}`);const existing=new Set(inventoryCache.map(i=>norm(i.alias||'')).filter(Boolean));const clash=list.find(x=>existing.has(norm(x)));if(clash)throw new Error(`Alias already exists: ${clash}`);return Array.from({length:qty},(_,i)=>list[i]||'');}
function docsFromForm(){const docs=[['Our PO',byId('regPO')?.value||''],['Supplier Invoice',byId('regSupplierInvoice')?.value||''],['Supplier DO',byId('regSupplierDO')?.value||'']].filter(x=>x[1].trim());const oth=byId('regOtherDoc')?.value.trim()||'';if(oth){const [t,...r]=oth.split('|');docs.push([t.trim()||'Other',r.join('|').trim()||oth]);}return docs;}
async function writeDocRef(item,docType,refNumber,user){const ref=doc(collection(db,'document_refs'));await setDoc(ref,{itemId:item.id,itemCode:item.itemCode,itemAlias:item.alias||'',itemNameSnapshot:item.name,categorySnapshot:item.category||'',supplierId:item.supplierId||'',supplierNameSnapshot:item.supplierName||'',context:'Supplier / Registration',docType,refNumber,status:'current',eventId:item.registrationBatchId||item.id,createdAt:now(),createdBy:user.email,createdByRole:user.role});}
async function writeLog(item,user,docs){await addDoc(collection(db,'operational_logs'),{logVersion:2,date:now(),performedBy:user.email,performedByRole:user.role,activity:'REGISTER_ITEM',activityLabel:'Register Item',status:item.status,fromType:'',fromName:'',toType:item.stockBalances[0].locationType,toName:item.currentLocation,qty:item.quantity,unit:item.unit,itemId:item.id,itemCode:item.itemCode,itemAlias:item.alias||'',itemName:item.name,category:item.category||'',supplierId:item.supplierId||'',supplierName:item.supplierName||'',clientId:'',clientName:'',remark:item.remark||'',documents:docs.map(([docType,refNumber])=>({docType,refNumber})),registrationBatchId:item.registrationBatchId||''});}
async function writeAudit(item,user,qty){await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:'CREATE_ITEM',module:'Main Workspace',targetType:'inventory',targetName:item.alias||item.itemCode,targetId:item.id,summary:`Create Item: ${item.alias||item.itemCode}`,beforeValue:null,afterValue:{itemCode:item.itemCode,alias:item.alias||'',name:item.name,category:item.category,qty:item.quantity,unit:item.unit,trackingType:item.trackingType,status:item.status,location:item.currentLocation,registrationBatchId:item.registrationBatchId,batchQuantity:qty},changedFields:['itemCode','alias','name','category','qty','unit','trackingType','status','location'],remark:item.remark||'',metadata:{registrationBatchId:item.registrationBatchId,batchQuantity:qty},performedBy:user.email,performedByRole:user.role,performedAt:now()});}

async function registerBatch(e){
  if(e.target?.id!=='registerForm'||e.__imsRefinedHandled)return;
  e.preventDefault();e.stopImmediatePropagation();e.__imsRefinedHandled=true;if(saving)return;
  try{
    saving=true;await refreshInventory();const user=await profile();
    const trackingType=byId('trackingType')?.value||'serialized';
    const qty=Number(byId('itemQty')?.value||1);
    if(!Number.isInteger(qty)||qty<1||qty>500)throw new Error('Quantity must be a whole number from 1 to 500.');
    const recordCount=trackingType==='serialized'?qty:1;
    const aliases=aliasesFor(recordCount),unit=byId('itemUnit')?.value||'',name=byId('itemName')?.value.trim()||'',position=byId('initialPosition')?.value||'warehouse',sid=byId('itemSupplier')?.value||'',loc=byId('initialLocation')?.value.trim()||'';
    if(!unit||!name||!loc)throw new Error('Complete item name, unit and initial location.');
    const supplierSel=byId('itemSupplier')?.selectedOptions?.[0],supplierName=sid?(supplierSel?.textContent?.trim()||''):'';if(position==='supplier'&&!sid)throw new Error('Select the supplier for an item initially at supplier.');
    const status=position==='supplier'?'At Supplier':'Available',batchRef=doc(collection(db,'registration_batches')),batchId=batchRef.id,createdAt=now(),b=selected('itemBrand'),m=selected('itemModel'),g=selected('itemGrade'),s=selected('itemSpecification'),docs=docsFromForm();
    await setDoc(batchRef,{batchId,quantity:qty,recordCount,trackingType,itemName:name,category:byId('itemCategory')?.value||'',unit,initialPosition:position,initialLocation:loc,createdBy:user.email,createdByRole:user.role,createdAt});
    const created=[];
    for(let n=0;n<recordCount;n++){
      const ref=doc(collection(db,'inventory')),itemCode=permanentCode(ref),alias=aliases[n]||'',itemQty=trackingType==='serialized'?1:qty;
      const rec={type:byId('itemType')?.value||'Equipment',trackingType,itemCode,alias,name,category:byId('itemCategory')?.value||'',quantity:itemQty,unit,status,currentLocation:loc,supplierId:sid,supplierName,stockBalances:[{qty:itemQty,locationType:position,locationId:position==='supplier'?sid:'',locationName:loc,status}],remark:byId('itemRemark')?.value.trim()||'',brandId:b.id,brand:b.value,modelId:m.id,model:m.value,gradeId:g.id,grade:g.value,specificationId:s.id,specification:s.value,registrationBatchId:batchId,registrationBatchIndex:n+1,createdBy:user.email,createdAt,lastEditedBy:null,lastEditedAt:null};
      await setDoc(ref,rec);const item={id:ref.id,...rec};for(const [t,r] of docs)await writeDocRef(item,t,r,user);await writeLog(item,user,docs);await writeAudit(item,user,qty);created.push(item);
    }
    await addDoc(collection(db,'audit_traces'),{traceVersion:3,actionType:'CREATE_REGISTRATION_BATCH',module:'Main Workspace',targetType:'registration_batch',targetName:batchId,targetId:batchId,summary:`Create Registration Batch: ${qty} unit(s)`,beforeValue:null,afterValue:{quantity:qty,recordCount,trackingType,itemIds:created.map(x=>x.id),itemCodes:created.map(x=>x.itemCode),aliases:created.map(x=>x.alias)},changedFields:['quantity','recordCount','trackingType','itemIds','itemCodes','aliases'],remark:byId('itemRemark')?.value.trim()||'',metadata:{batchId},performedBy:user.email,performedByRole:user.role,performedAt:now()});
    alert(trackingType==='serialized'?`${qty} individual item${qty===1?'':'s'} registered. Each unit has its own permanent IMS Item ID.`:`Quantity item registered with ${qty} ${unit}.`);location.reload();
  }catch(err){alert('Registration failed: '+(err?.message||err));const btn=e.target?.querySelector('button[type="submit"],button:not([type])');if(btn){btn.disabled=false;btn.textContent=btn.dataset.imsOriginalText||'Register Item';}}
  finally{saving=false;}
}

function syncTrackingUI(){const tracking=byId('trackingType'),qty=byId('itemQty'),aliases=byId('batchAliases');if(!tracking||!qty)return;const serialized=tracking.value==='serialized';qty.min='1';qty.step='1';qty.readOnly=false;const qspan=qty.closest('label')?.querySelector('span');if(qspan)qspan.textContent=serialized?'Units to Register':'Quantity';if(aliases?.closest('label'))aliases.closest('label').style.display=serialized?'':'none';}
function mountRegistration(){const form=byId('registerForm'),code=byId('itemCode'),qty=byId('itemQty'),tracking=byId('trackingType');if(!form||!code||byId('batchAliases'))return;if(tracking){tracking.disabled=false;tracking.closest('label')?.classList.remove('opacity-60');const span=tracking.closest('label')?.querySelector('span');if(span)span.textContent='Tracking Type';}
  qty.min='1';qty.step='1';qty.value=String(Math.max(1,Math.round(Number(qty.value||1))));qty.readOnly=false;const qspan=qty.closest('label')?.querySelector('span');if(qspan)qspan.textContent='Units to Register';
  const cspan=code.closest('label')?.querySelector('span');if(cspan)cspan.textContent='Alias (optional — first unit)';code.required=false;code.placeholder='External / accounting / warehouse code';
  const wrap=document.createElement('label');wrap.className='block text-xs text-slate-400 sm:col-span-2';wrap.innerHTML=`<span class="block mb-1">Additional Aliases for Individual Units (optional, one per line)</span><textarea id="batchAliases" rows="3" class="${cls}" placeholder="Second unit alias\nThird unit alias\n..."></textarea><div class="text-[10px] text-slate-500 mt-1">IMS generates the permanent Item ID. Alias remains editable later.</div>`;code.closest('label')?.insertAdjacentElement('afterend',wrap);
  tracking?.addEventListener('change',syncTrackingUI);syncTrackingUI();
  const btn=form.querySelector('button[type="submit"],button:not([type])');if(btn)btn.textContent='Register Item(s)';
}

async function validateBatchMovement(e){if(e.target?.id!=='batchMoveForm')return;const action=byId('bmAction')?.value||'';if(!['DELIVER_CLIENT','TRANSFER_WAREHOUSE','SEND_MAINTENANCE'].includes(action))return;await refreshInventory();const ids=[...document.querySelectorAll('.bmItem')].map(x=>x.value).filter(Boolean);const bad=ids.map(id=>inventoryCache.find(i=>i.id===id)).find(i=>{if(!i)return false;const statuses=(i.stockBalances||[]).filter(b=>Number(b.qty||0)>0).map(b=>b.status||'');if(action==='SEND_MAINTENANCE')return statuses.every(s=>s==='In Maintenance'||s==='Maintenance'||s==='In Transit');return statuses.some(s=>s==='Not Available'||s==='In Maintenance'||s==='Maintenance');});if(bad){e.preventDefault();e.stopImmediatePropagation();alert(`${bad.alias||bad.itemCode} is not eligible for this movement because its current status is ${bad.status||'restricted'}.`);}}

function relabelOptions(){const map=new Map(inventoryCache.map(i=>[i.id,i]));document.querySelectorAll('#moveItem option,.bmItem option,#mwItem option').forEach(o=>{const i=map.get(o.value);if(!i)return;const primary=i.alias||i.itemCode;const secondary=i.alias?` · ${i.itemCode}`:'';const qty=(i.stockBalances||[]).reduce((a,b)=>a+Number(b.qty||0),0);o.textContent=`${primary}${secondary} — ${i.name||''}${qty?` (${qty} ${i.unit||''})`:''}`;});}
async function mountLabels(){try{await refreshInventory();relabelOptions();}catch{}}

document.addEventListener('submit',registerBatch,true);
document.addEventListener('submit',e=>{validateBatchMovement(e).catch(err=>console.warn('IMS movement eligibility check unavailable:',err));},true);
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{mountRegistration();mountLabels();},40);}).observe(document.body,{childList:true,subtree:true});mountRegistration();mountLabels();
