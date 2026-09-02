import { auth, db } from '../../firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';

// Consolidated registration module: batch / multi-unit intake, permanent IMS code,
// operational Alias, independent classification values, initial warehouse/supplier
// location, operational logs and batch-level audit. If unavailable, the legacy
// registration helpers remain the fallback.

const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const nowISO=()=>new Date().toISOString();
const inputCls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
let settings=[],suppliers=[],inventory=[],saving=false,lastCore=null;

async function loadReferenceData(){
  const [a,b,c]=await Promise.all([
    getDocs(collection(db,'settings')),
    getDocs(collection(db,'supplier_profiles')),
    getDocs(collection(db,'inventory'))
  ]);
  settings=a.docs.map(d=>({id:d.id,...d.data()}));
  suppliers=b.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status!=='inactive');
  inventory=c.docs.map(d=>({id:d.id,...d.data()}));
}
function active(type){return settings.filter(x=>x.type===type&&x.status!=='inactive').sort((a,b)=>String(a.value||'').localeCompare(String(b.value||''),undefined,{numeric:true,sensitivity:'base'}));}
async function profile(){const u=auth.currentUser;if(!u)throw new Error('Sign in required.');const s=await getDoc(doc(db,'users',u.uid));if(!s.exists()||s.data().status!=='active')throw new Error('Active user profile required.');return{email:s.data().email||u.email||'',role:s.data().role||window.IMS_ROLE||''};}
function code(ref){return`ITM-${ref.id.slice(0,10).toUpperCase()}`;}
function selected(id){const e=byId(id),o=e?.selectedOptions?.[0];return{id:e?.value||'',value:o?.dataset?.v||o?.textContent?.trim()||''};}
function options(type,label){return`<option value="">-- ${label} --</option>${active(type).map(x=>`<option value="${x.id}" data-v="${esc(x.value)}">${esc(x.value)}</option>`).join('')}`;}
function aliases(count){const list=(byId('batchAliases')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);if(list.length!==count)throw new Error(`Enter exactly ${count} Alias value(s), one per unit.`);const dup=list.find((x,i)=>list.findIndex(y=>norm(y)===norm(x))!==i);if(dup)throw new Error(`Duplicate Alias in this batch: ${dup}`);const used=new Set(inventory.map(x=>norm(x.alias||'')).filter(Boolean)),clash=list.find(x=>used.has(norm(x)));if(clash)throw new Error(`Alias already exists: ${clash}`);return list;}

function initialWrap(){
  const atSupplier=byId('initialPosition')?.value==='supplier',w=byId('initialLocationWrap');if(!w)return;
  if(atSupplier){const sid=byId('itemSupplier')?.value||'',s=suppliers.find(x=>x.id===sid);w.innerHTML=`<label class="text-xs text-slate-400 sm:col-span-2">Initial Supplier Location<input id="initialLocation" readonly class="${inputCls} mt-1" value="${esc(s?.companyName||s?.supplierName||'Select supplier above')}"></label>`;}
  else w.innerHTML=`<label class="text-xs text-slate-400 sm:col-span-2">Initial Warehouse / Location<select id="initialLocation" required class="${inputCls} mt-1">${options('warehouse','Warehouse / Location')}</select></label>`;
}

function formHtml(){return`<form id="registerForm" class="grid sm:grid-cols-2 gap-3" data-ims-registration-module="1">
  <div class="sm:col-span-2 text-xs text-slate-500">Every physical unit receives its own permanent IMS Item Code. Register multiple units together and assign one unique operational Alias per unit.</div>
  <label class="text-xs text-slate-400">Item Type<select id="itemType" class="${inputCls} mt-1"><option>Equipment</option><option>Part</option></select></label>
  <label class="text-xs text-slate-400">Units to Register<input id="itemQty" type="number" min="1" max="500" step="1" value="1" required class="${inputCls} mt-1"></label>
  <label class="text-xs text-slate-400">Item Name<input id="itemName" required class="${inputCls} mt-1"></label>
  <label class="text-xs text-slate-400">Category<select id="itemCategory" required class="${inputCls} mt-1">${options('category','Category')}</select></label>
  <label class="text-xs text-slate-400">Unit<select id="itemUnit" required class="${inputCls} mt-1">${options('unit','Unit')}</select></label>
  <label class="text-xs text-slate-400">Supplier<select id="itemSupplier" class="${inputCls} mt-1"><option value="">-- Supplier --</option>${suppliers.map(x=>`<option value="${x.id}">${esc(x.companyName||x.supplierName||'')}</option>`).join('')}</select></label>
  <label class="text-xs text-slate-400">Brand<select id="itemBrand" class="${inputCls} mt-1">${options('brand','Brand')}</select></label>
  <label class="text-xs text-slate-400">Model<select id="itemModel" class="${inputCls} mt-1">${options('model','Model')}</select></label>
  <label class="text-xs text-slate-400">Grade<select id="itemGrade" class="${inputCls} mt-1">${options('grade','Grade')}</select></label>
  <label class="text-xs text-slate-400">Specification<select id="itemSpecification" class="${inputCls} mt-1">${options('specification','Specification')}</select></label>
  <label class="text-xs text-slate-400">Initial Position<select id="initialPosition" class="${inputCls} mt-1"><option value="warehouse">Available at Warehouse</option><option value="supplier">At Supplier</option></select></label>
  <div id="initialLocationWrap" class="sm:col-span-2"></div>
  <label class="text-xs font-semibold text-cyan-300 sm:col-span-2">Alias — one per unit<textarea id="batchAliases" rows="4" required class="${inputCls} mt-1" placeholder="EQ-001\nEQ-002\nEQ-003"></textarea><span class="block text-[10px] text-slate-500 mt-1">Alias is the operational/accounting code users will search and recognize outside IMS.</span></label>
  <label class="text-xs text-slate-400 sm:col-span-2">Remark<textarea id="itemRemark" rows="2" class="${inputCls} mt-1"></textarea></label>
  <button id="registerSave" class="sm:col-span-2 w-full bg-red-600 py-2.5 rounded-lg text-sm font-bold">Register Item(s)</button>
  <div id="registrationResult" class="sm:col-span-2"></div>
</form>`;}

async function writeAudit(user,batch,created,details){
  await addDoc(collection(db,'audit_traces'),{
    traceVersion:3,actionType:'REGISTER_ITEM_BATCH',module:'Registration',targetType:'registration_batch',
    targetName:`${details.itemName} × ${created.length}`,targetId:batch.id,
    summary:`Register Item Batch: ${details.itemName} × ${created.length}`,
    beforeValue:null,
    afterValue:{quantity:created.length,itemName:details.itemName,category:details.category,unit:details.unit,initialPosition:details.initialPosition,initialLocation:details.initialLocation,aliases:created.map(x=>x.alias),itemCodes:created.map(x=>x.itemCode)},
    changedFields:['inventory','registration_batches','operational_logs'],remark:details.remark||'',metadata:{source:'registration-module'},
    performedBy:user.email,performedByRole:user.role,performedAt:nowISO()
  });
}

async function save(e){
  e.preventDefault();if(saving||!can('inventory.add'))return;
  saving=true;const btn=byId('registerSave');btn.disabled=true;btn.textContent='Saving...';
  try{
    await loadReferenceData();const user=await profile(),qty=Number(byId('itemQty').value||0);
    if(!Number.isInteger(qty)||qty<1||qty>500)throw new Error('Units must be a whole number from 1 to 500.');
    const aliasList=aliases(qty),name=byId('itemName').value.trim(),unit=selected('itemUnit'),cat=selected('itemCategory'),position=byId('initialPosition').value,sid=byId('itemSupplier').value,s=suppliers.find(x=>x.id===sid);
    if(!name||!unit.value||!cat.value)throw new Error('Complete Item Name, Category and Unit.');
    if(position==='supplier'&&!s)throw new Error('Select supplier.');
    const loc=position==='supplier'?{id:sid,value:s.companyName||s.supplierName||''}:selected('initialLocation');if(!loc.value)throw new Error('Select initial location.');
    const status=position==='supplier'?'At Supplier':'Available',batch=doc(collection(db,'registration_batches')),createdAt=nowISO(),brand=selected('itemBrand'),model=selected('itemModel'),grade=selected('itemGrade'),spec=selected('itemSpecification'),remark=byId('itemRemark').value.trim();
    await setDoc(batch,{batchId:batch.id,quantity:qty,recordCount:qty,itemName:name,category:cat.value,unit:unit.value,initialPosition:position,initialLocationId:loc.id,initialLocation:loc.value,createdBy:user.email,createdByRole:user.role,createdAt});
    const created=[];
    for(let n=0;n<qty;n++){
      const ref=doc(collection(db,'inventory')),itemCode=code(ref),rec={type:byId('itemType').value,itemCode,alias:aliasList[n],name,category:cat.value,quantity:1,unit:unit.value,status,currentLocation:loc.value,supplierId:sid||'',supplierName:s?.companyName||s?.supplierName||'',stockBalances:[{qty:1,locationType:position,locationId:loc.id,locationName:loc.value,status}],brandId:brand.id,brand:brand.value,modelId:model.id,model:model.value,gradeId:grade.id,grade:grade.value,specificationId:spec.id,specification:spec.value,remark,registrationBatchId:batch.id,registrationBatchIndex:n+1,createdBy:user.email,createdAt,lastEditedBy:null,lastEditedAt:null};
      await setDoc(ref,rec);const item={id:ref.id,...rec};
      await addDoc(collection(db,'operational_logs'),{logVersion:2,date:createdAt,activity:'REGISTER_ITEM',activityLabel:'Register Item',status,toType:position,toName:loc.value,qty:1,unit:item.unit,itemId:item.id,itemCode:item.itemCode,itemAlias:item.alias,itemName:item.name,category:item.category,supplierId:item.supplierId,supplierName:item.supplierName,registrationBatchId:batch.id,performedBy:user.email,performedByRole:user.role,remark:item.remark});
      created.push(item);
    }
    await writeAudit(user,batch,created,{itemName:name,category:cat.value,unit:unit.value,initialPosition:position,initialLocation:loc.value,remark});
    inventory.push(...created);
    byId('registrationResult').innerHTML=`<div class="rounded-xl border border-emerald-800 p-3 text-xs space-y-2"><div class="font-semibold text-emerald-300">${created.length} item(s) registered.</div><div class="space-y-1">${created.map(x=>`<div><b class="text-cyan-300">${esc(x.alias)}</b> · <span class="font-mono">${esc(x.itemCode)}</span> · ${esc(x.name)}</div>`).join('')}</div><button id="registrationDone" type="button" class="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-xs font-semibold">Done</button></div>`;
    byId('registrationDone').onclick=()=>location.reload();byId('batchAliases').value='';byId('itemQty').value='1';
  }catch(err){console.error('Registration failed:',err);alert('Registration failed: '+(err?.message||err));}
  finally{btn.disabled=false;btn.textContent='Register Item(s)';saving=false;}
}

async function mount(){
  if(!can('inventory.add'))return;
  const core=byId('registerForm');if(!core||core.dataset.imsRegistrationModule==='1'||core===lastCore)return;
  lastCore=core;
  try{await loadReferenceData();}catch(err){console.warn('IMS registration module unavailable; legacy fallback remains available.',err);return;}
  const wrap=document.createElement('div');wrap.innerHTML=formHtml();core.replaceWith(wrap.firstElementChild);
  byId('initialPosition').onchange=initialWrap;
  byId('itemSupplier').onchange=()=>{if(byId('initialPosition').value==='supplier')initialWrap();};
  byId('registerForm').onsubmit=save;initialWrap();
}

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>mount().catch(()=>{}),30);}).observe(document.body,{childList:true,subtree:true});
mount().catch(()=>{});
window.IMSRegistration=Object.freeze({mount,loadReferenceData});
window.dispatchEvent(new CustomEvent('ims:registration-ready'));
export { mount, loadReferenceData };
