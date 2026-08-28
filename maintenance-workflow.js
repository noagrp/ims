import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, runTransaction, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const now=()=>new Date().toISOString();
const today=()=>now().slice(0,10);
const TYPES=['Inspection','Preventive Maintenance','Repair','Calibration','Certification / Recertification','Testing','Service','Other'];
const DEFAULT_TASKS={
  'Inspection':['Inspect condition','Test / verify','Record result'],
  'Preventive Maintenance':['Inspect condition','Service / replace consumables','Functional test'],
  'Repair':['Diagnose issue','Repair / replace','Functional test'],
  'Calibration':['Perform calibration','Verify tolerance','Record certificate / result'],
  'Certification / Recertification':['Inspect / test','Certification review','Record certificate'],
  'Testing':['Prepare test','Perform test','Record result'],
  'Service':['Inspect condition','Perform service','Functional test'],
  'Other':['Perform work','Verify result']
};
const STATUS_PRIORITY=['In Transit','Maintenance','At Client','Not Available','At Supplier','Available'];
let inventory=[],settings=[],maintenance=[],me=null,busy=false,lastMount=null;

function balances(item){
  return (Array.isArray(item.stockBalances)?item.stockBalances:[])
    .filter(x=>Number(x.qty||0)>0)
    .map(x=>({
      qty:Number(x.qty||0),
      locationType:x.locationType||'warehouse',
      locationId:x.locationId||'',
      locationName:x.locationName||x.location||'Unknown',
      status:x.status||'Not Available'
    }));
}
function maintBalances(item){return balances(item).filter(x=>x.locationType==='maintenance'&&x.status==='Maintenance');}
function summary(b){
  const p=b.filter(x=>Number(x.qty)>0);
  if(!p.length)return{status:'Not Available',location:'No Stock'};
  const status=STATUS_PRIORITY.find(s=>p.some(x=>x.status===s))||'Not Available';
  return{status,location:p.length===1?p[0].locationName:`${p.length} Locations`};
}
function latestJob(itemId){return maintenance.filter(x=>x.itemId===itemId).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0]||null;}
function activeItems(){return inventory.filter(i=>maintBalances(i).length);}
function itemLabel(item){return item.alias?`${item.alias} · ${item.itemCode}`:item.itemCode;}
async function load(){
  const u=auth.currentUser;
  if(!u)throw new Error('Sign in required.');
  const ps=await getDoc(doc(db,'users',u.uid));
  if(!ps.exists()||ps.data().status!=='active')throw new Error('Active user profile required.');
  me={...ps.data(),email:ps.data().email||u.email||''};
  const [a,b,c]=await Promise.all([
    getDocs(collection(db,'inventory')),
    getDocs(collection(db,'settings')),
    getDocs(collection(db,'maintenance_events'))
  ]);
  inventory=a.docs.map(d=>({id:d.id,...d.data()}));
  settings=b.docs.map(d=>({id:d.id,...d.data()}));
  maintenance=c.docs.map(d=>({id:d.id,...d.data()}));
}
async function log(rec){await addDoc(collection(db,'operational_logs'),{logVersion:2,date:now(),performedBy:me.email,performedByRole:me.role,...rec});}
async function audit(action,item,job,beforeValue,afterValue,remark='',targetId='',metadata={}){
  await addDoc(collection(db,'audit_traces'),{
    traceVersion:3,
    actionType:action,
    module:'Maintenance',
    targetType:'maintenance',
    targetName:item.alias||item.itemCode,
    targetId:targetId||job?.id||'',
    summary:`${action.replace(/_/g,' ')}: ${item.alias||item.itemCode}`,
    beforeValue,
    afterValue,
    changedFields:['maintenance'],
    remark,
    metadata:{itemId:item.id,itemCode:item.itemCode,itemAlias:item.alias||'',maintenanceEventId:job?.id||'',...metadata},
    performedBy:me.email,
    performedByRole:me.role,
    performedAt:now()
  });
}
function baseLog(item,extra={}){
  return{
    itemId:item.id,itemCode:item.itemCode,itemAlias:item.alias||'',itemName:item.name,
    category:item.category||'',supplierId:item.supplierId||'',supplierName:item.supplierName||'',
    clientId:'',clientName:'',unit:item.unit||'',...extra
  };
}
function hideMaintenanceFromMove(){
  document.querySelectorAll('#bmAction option[value="RETURN_MAINTENANCE"]').forEach(x=>x.remove());
  const hiddenIds=new Set(inventory.filter(i=>balances(i).every(b=>b.status==='Maintenance'||b.status==='In Transit')).map(i=>i.id));
  document.querySelectorAll('.bmItem').forEach(sel=>[...sel.options].forEach(o=>{if(hiddenIds.has(o.value))o.remove();}));
}
function shellHtml(){
  const items=activeItems();
  return `<form id="maintenanceWorkflowForm" class="space-y-3"><div class="text-[11px] text-slate-500">Maintenance items must complete the maintenance result flow before normal use. Pass returns to a selected warehouse as Available. Fail can remain under Maintenance or return to a selected warehouse as Not Available.</div><label class="block text-xs text-slate-400">Item in Maintenance<select id="mwItem" class="${cls} mt-1"><option value="">-- Select item --</option>${items.map(i=>`<option value="${i.id}">${esc(itemLabel(i))} — ${esc(i.name)} (${maintBalances(i).reduce((a,b)=>a+b.qty,0)} ${esc(i.unit||'')})</option>`).join('')}</select></label><div id="mwBody"></div></form>`;
}
function openHtml(){
  return `<div class="border border-slate-800 rounded-xl p-3 space-y-3"><div class="font-semibold text-sm">Open Maintenance Job</div><div class="grid sm:grid-cols-2 gap-2"><label class="text-xs text-slate-400">Maintenance Type<select id="mwType" class="${cls} mt-1">${TYPES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label class="text-xs text-slate-400">Start Date<input id="mwStart" type="date" value="${today()}" class="${cls} mt-1"></label></div><label class="text-xs text-slate-400">Provider<input id="mwProvider" class="${cls} mt-1" placeholder="Workshop / provider"></label><label class="text-xs text-slate-400">Tasks — one per line<textarea id="mwTasks" rows="4" class="${cls} mt-1">${DEFAULT_TASKS.Inspection.join('\n')}</textarea></label><label class="text-xs text-slate-400">Remark<textarea id="mwRemark" rows="2" class="${cls} mt-1"></textarea></label><button id="mwOpen" type="button" class="w-full bg-amber-600 hover:bg-amber-500 py-2.5 rounded-lg text-sm font-bold">Open Maintenance</button></div>`;
}
function taskRows(job,readonly=false){
  const tasks=Array.isArray(job.tasks)?job.tasks:[];
  return tasks.map((t,n)=>`<div class="grid grid-cols-[auto_minmax(0,1fr)_145px] gap-2 items-center border border-slate-800 rounded-lg p-2"><input class="mwTaskDone" data-i="${n}" type="checkbox" ${t.done?'checked':''} ${readonly?'disabled':''}><div class="text-xs">${esc(t.name)}</div><input class="mwTaskDate ${cls}" data-i="${n}" type="date" value="${esc(t.date||'')}" ${readonly?'disabled':''}></div>`).join('')||'<div class="text-xs text-slate-500">No tasks.</div>';
}
function resultHtml(job){
  const result=job.maintenanceResult||'';
  if(!result)return `<div class="border-t border-slate-800 pt-3 space-y-2"><div class="font-semibold text-xs">Maintenance Result</div><textarea id="mwResultRemark" rows="2" class="${cls}" placeholder="Result detail; failure reason is required for Fail"></textarea><div class="grid grid-cols-2 gap-2"><button id="mwPass" type="button" class="bg-emerald-700 hover:bg-emerald-600 py-2 rounded-lg text-xs font-bold">Pass</button><button id="mwFail" type="button" class="bg-red-700 hover:bg-red-600 py-2 rounded-lg text-xs font-bold">Fail</button></div></div>`;
  return `<div class="border-t border-slate-800 pt-3 space-y-1"><div class="font-semibold text-xs">Maintenance Result</div><div class="text-sm font-bold ${result==='Pass'?'text-emerald-400':'text-red-400'}">${esc(result)}</div><div class="text-xs text-slate-500">${esc(job.resultRemark||'')}</div>${job.failedDisposition?`<div class="text-xs text-amber-400">Disposition: ${esc(job.failedDisposition)}</div>`:''}</div>`;
}
function releaseHtml(item,job){
  if(!job.maintenanceResult)return '';
  const mbs=maintBalances(item);
  const warehouses=settings.filter(x=>x.type==='warehouse'&&x.status!=='inactive');
  const result=job.maintenanceResult;
  return `<div class="border-t border-slate-800 pt-3 space-y-2"><div class="font-semibold text-xs text-cyan-300">${result==='Pass'?'Return to Warehouse → Available':'Failed Item Disposition'}</div>${result==='Fail'?`<button id="mwKeepMaintenance" type="button" class="w-full bg-amber-700 hover:bg-amber-600 py-2 rounded-lg text-xs font-bold">Keep Under Maintenance</button><div class="text-[10px] text-slate-500">Or return the failed item to a warehouse. It will arrive as Not Available and cannot be dispatched normally.</div>`:''}<div class="grid sm:grid-cols-2 gap-2"><label class="text-xs text-slate-400">Maintenance Source<select id="mwReleaseSource" class="${cls} mt-1">${mbs.map((b,n)=>`<option value="${n}">${esc(b.locationName)} — ${b.qty} ${esc(item.unit||'')}</option>`).join('')}</select></label><label class="text-xs text-slate-400">Warehouse<select id="mwWarehouse" class="${cls} mt-1"><option value="">-- Warehouse --</option>${warehouses.map(w=>`<option value="${w.id}" data-name="${esc(w.value)}">${esc(w.value)}</option>`).join('')}</select></label></div><div class="grid sm:grid-cols-2 gap-2"><label class="text-xs text-slate-400">Quantity<input id="mwReleaseQty" type="number" min="0.0001" step="any" value="${item.trackingType==='serialized'?1:(mbs[0]?.qty||1)}" ${item.trackingType==='serialized'?'readonly':''} class="${cls} mt-1"></label><label class="text-xs text-slate-400">Remark<input id="mwReleaseRemark" class="${cls} mt-1" placeholder="Optional disposition / return remark"></label></div><button id="mwRelease" type="button" class="w-full bg-cyan-700 hover:bg-cyan-600 py-2.5 rounded-lg text-sm font-bold">${result==='Pass'?'Start Return to Warehouse — Available':'Start Return to Warehouse — Not Available'}</button></div>`;
}
function jobHtml(item,job){
  const completed=job.eventStatus==='Completed';
  return `<div class="border border-slate-800 rounded-xl p-3 space-y-3"><div class="flex justify-between gap-3"><div><div class="font-semibold text-sm">${esc(job.eventType||'Maintenance')}</div><div class="text-[10px] text-slate-500">Opened ${esc(job.maintenanceFrom||job.eventDate||job.createdAt?.slice(0,10)||'')} · ${esc(job.provider||'No provider')}</div></div><span class="text-xs ${completed?'text-emerald-400':'text-amber-400'}">${completed?'Completed':'Open'}</span></div><div class="space-y-2">${taskRows(job,completed)}</div>${completed?`<div class="text-xs text-emerald-400">Completed on ${esc(job.completedDate||job.completedAt?.slice(0,10)||'—')}</div>${resultHtml(job)}${releaseHtml(item,job)}`:`<div class="grid sm:grid-cols-[1fr_auto] gap-2"><div class="text-[10px] text-slate-500 self-center">Tick a task and enter its completion date. Save progress whenever needed.</div><button id="mwSaveProgress" type="button" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-xs font-bold">Save Progress</button></div><div class="border-t border-slate-800 pt-3 grid sm:grid-cols-[1fr_auto] gap-2"><label class="text-xs text-slate-400">Completion Date<input id="mwCompleteDate" type="date" value="${today()}" class="${cls} mt-1"></label><button id="mwComplete" type="button" class="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-lg text-xs font-bold self-end">Complete Maintenance</button></div>`}</div>`;
}
async function renderSelected(){
  const body=byId('mwBody'),item=inventory.find(x=>x.id===byId('mwItem')?.value);
  if(!body)return;
  if(!item){body.innerHTML='';return;}
  const job=latestJob(item.id);
  body.innerHTML=job?jobHtml(item,job):openHtml();
  if(!job){
    byId('mwType').onchange=()=>{byId('mwTasks').value=(DEFAULT_TASKS[byId('mwType').value]||DEFAULT_TASKS.Other).join('\n');};
    byId('mwOpen').onclick=()=>openJob(item);
  }else if(job.eventStatus==='Completed'){
    if(!job.maintenanceResult){byId('mwPass').onclick=()=>setResult(item,job,'Pass');byId('mwFail').onclick=()=>setResult(item,job,'Fail');}
    else{
      if(byId('mwRelease'))byId('mwRelease').onclick=()=>release(item,job);
      if(job.maintenanceResult==='Fail'&&byId('mwKeepMaintenance'))byId('mwKeepMaintenance').onclick=()=>keepMaintenance(item,job);
    }
  }else{
    byId('mwSaveProgress').onclick=()=>saveProgress(item,job,false);
    byId('mwComplete').onclick=()=>saveProgress(item,job,true);
  }
}
function collectTasks(job){return (Array.isArray(job.tasks)?job.tasks:[]).map((t,n)=>({name:t.name,done:document.querySelector(`.mwTaskDone[data-i="${n}"]`)?.checked||false,date:document.querySelector(`.mwTaskDate[data-i="${n}"]`)?.value||''}));}
async function openJob(item){
  if(busy)return;
  const tasks=byId('mwTasks').value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(!tasks.length)return alert('Add at least one maintenance task.');
  const start=byId('mwStart').value;
  if(!start)return alert('Enter the maintenance start date.');
  busy=true;
  try{
    const ref=doc(collection(db,'maintenance_events'));
    const rec={eventId:ref.id,itemId:item.id,itemCode:item.itemCode,itemAliasSnapshot:item.alias||'',itemNameSnapshot:item.name,eventType:byId('mwType').value,maintenanceType:byId('mwType').value,eventStatus:'Open',maintenanceFrom:start,provider:byId('mwProvider').value.trim(),remark:byId('mwRemark').value.trim(),tasks:tasks.map(name=>({name,done:false,date:''})),createdBy:me.email,createdByRole:me.role,createdAt:now()};
    await setDoc(ref,rec);
    await log(baseLog(item,{activity:'MAINTENANCE_OPEN',activityLabel:'Open Maintenance',status:'Maintenance',fromType:'maintenance',fromName:maintBalances(item)[0]?.locationName||'Maintenance',toType:'maintenance',toName:maintBalances(item)[0]?.locationName||'Maintenance',qty:maintBalances(item).reduce((a,b)=>a+b.qty,0),remark:rec.remark,maintenanceEventId:ref.id}));
    await audit('OPEN_MAINTENANCE',item,{id:ref.id},null,{type:rec.eventType,start,tasks:rec.tasks.map(x=>x.name)},rec.remark);
    await load();await renderSelected();
  }catch(err){alert('Open maintenance failed: '+(err?.message||err));}finally{busy=false;}
}
async function saveProgress(item,job,complete){
  if(busy)return;
  const tasks=collectTasks(job);
  for(const t of tasks){if(t.done&&!t.date)return alert(`Enter a date for completed task: ${t.name}`);if(!t.done&&t.date)return alert(`Tick the task or clear its date: ${t.name}`);}
  if(complete&&!tasks.every(t=>t.done&&t.date))return alert('Complete every task with a date before completing maintenance.');
  const completedDate=complete?byId('mwCompleteDate').value:'';
  if(complete&&!completedDate)return alert('Enter the completion date.');
  busy=true;
  try{
    const patch={tasks,eventStatus:complete?'Completed':'Open',updatedAt:now(),updatedBy:me.email};
    if(complete)Object.assign(patch,{completedDate,completedAt:now(),completedBy:me.email});
    await updateDoc(doc(db,'maintenance_events',job.id),patch);
    await log(baseLog(item,{activity:complete?'MAINTENANCE_COMPLETE':'MAINTENANCE_PROGRESS',activityLabel:complete?'Complete Maintenance':'Maintenance Progress',status:'Maintenance',fromType:'maintenance',fromName:maintBalances(item)[0]?.locationName||'Maintenance',toType:'maintenance',toName:maintBalances(item)[0]?.locationName||'Maintenance',qty:maintBalances(item).reduce((a,b)=>a+b.qty,0),remark:complete?`Completed ${completedDate}`:'Task progress updated',maintenanceEventId:job.id}));
    await audit(complete?'COMPLETE_MAINTENANCE':'UPDATE_MAINTENANCE',item,job,{status:job.eventStatus,tasks:job.tasks},{status:patch.eventStatus,tasks,completedDate});
    await load();await renderSelected();
  }catch(err){alert('Maintenance update failed: '+(err?.message||err));}finally{busy=false;}
}
async function setResult(item,job,result){
  if(busy)return;
  const remark=byId('mwResultRemark')?.value.trim()||'';
  if(result==='Fail'&&!remark)return alert('Enter the failure detail / reason.');
  busy=true;
  try{
    const patch={maintenanceResult:result,resultRemark:remark,resultAt:now(),resultBy:me.email,failedDisposition:'',updatedAt:now(),updatedBy:me.email};
    await updateDoc(doc(db,'maintenance_events',job.id),patch);
    await log(baseLog(item,{activity:'MAINTENANCE_RESULT',activityLabel:`Maintenance Result — ${result}`,status:'Maintenance',fromType:'maintenance',fromName:job.provider||maintBalances(item)[0]?.locationName||'Maintenance',toType:'maintenance',toName:job.provider||maintBalances(item)[0]?.locationName||'Maintenance',qty:maintBalances(item).reduce((a,b)=>a+b.qty,0),remark:remark||`Maintenance ${result}`,maintenanceResult:result,maintenanceEventId:job.id}));
    await audit('SET_MAINTENANCE_RESULT',item,job,{maintenanceResult:job.maintenanceResult||''},{maintenanceResult:result},remark);
    await load();await renderSelected();
  }catch(err){alert('Maintenance result failed: '+(err?.message||err));}finally{busy=false;}
}
async function keepMaintenance(item,job){
  if(busy||job.maintenanceResult!=='Fail')return;
  busy=true;
  try{
    const remark=job.resultRemark||'Failed maintenance remains under maintenance.';
    const patch={failedDisposition:'Keep in Maintenance',failedDispositionAt:now(),failedDispositionBy:me.email,updatedAt:now(),updatedBy:me.email};
    await updateDoc(doc(db,'maintenance_events',job.id),patch);
    await log(baseLog(item,{activity:'MAINTENANCE_FAIL_KEEP',activityLabel:'Failed Maintenance — Keep Under Maintenance',status:'Maintenance',fromType:'maintenance',fromName:maintBalances(item)[0]?.locationName||'Maintenance',toType:'maintenance',toName:maintBalances(item)[0]?.locationName||'Maintenance',qty:maintBalances(item).reduce((a,b)=>a+b.qty,0),remark,maintenanceResult:'Fail',maintenanceEventId:job.id}));
    await audit('KEEP_FAILED_ITEM_IN_MAINTENANCE',item,job,{maintenanceResult:'Fail'},{maintenanceResult:'Fail',disposition:'Keep in Maintenance'},remark);
    await load();await renderSelected();
  }catch(err){alert('Maintenance disposition failed: '+(err?.message||err));}finally{busy=false;}
}
async function release(item,job){
  if(busy)return;
  if(job.maintenanceResult!=='Pass'&&job.maintenanceResult!=='Fail')return alert('Set the maintenance result before release.');
  const srcIndex=Number(byId('mwReleaseSource').value),src=maintBalances(item)[srcIndex],qty=Number(byId('mwReleaseQty').value||0),wh=byId('mwWarehouse'),toId=wh.value,toName=wh.selectedOptions?.[0]?.dataset?.name||'',remark=byId('mwReleaseRemark').value.trim();
  if(!src||qty<=0||qty>src.qty||!toId||!toName)return alert('Select a valid source, quantity and warehouse.');
  if(item.trackingType==='serialized'&&qty!==1)return alert('Serialized items must return as quantity 1.');
  const finalStatus=job.maintenanceResult==='Pass'?'Available':'Not Available';
  busy=true;
  try{
    const movementRef=doc(collection(db,'movements')),movementId=movementRef.id,createdAt=now();
    await runTransaction(db,async tx=>{
      const itemRef=doc(db,'inventory',item.id),snap=await tx.get(itemRef);
      if(!snap.exists())throw new Error('Item missing.');
      const cur=snap.data(),bal=balances(cur),source=bal.find(b=>b.locationType==='maintenance'&&b.status==='Maintenance'&&b.locationName===src.locationName&&(!src.locationId||b.locationId===src.locationId));
      if(!source||source.qty<qty)throw new Error('Maintenance stock changed. Refresh and retry.');
      source.qty-=qty;
      bal.push({qty,locationType:'transit',locationId:movementId,locationName:`Transit to ${toName}`,status:'In Transit'});
      const clean=bal.filter(b=>b.qty>0),sum=summary(clean);
      tx.update(itemRef,{stockBalances:clean,status:sum.status,currentLocation:sum.location,lastEditedBy:me.email,lastEditedAt:createdAt});
      tx.set(movementRef,{movementId,itemId:item.id,itemCode:item.itemCode,itemAliasSnapshot:item.alias||'',itemNameSnapshot:item.name,categorySnapshot:item.category||'',supplierId:item.supplierId||'',supplierNameSnapshot:item.supplierName||'',action:'RETURN_MAINTENANCE',actionLabel:'Return from Maintenance',fromType:'maintenance',fromId:src.locationId||'',fromName:src.locationName,toType:'warehouse',toId,toName,toStatus:finalStatus,qty,unit:item.unit||'',mode:'Maintenance Release',detail:`Maintenance ${job.maintenanceResult} · job ${job.id}`,remark,documents:[],status:'in_transit',maintenanceResult:job.maintenanceResult,maintenanceEventId:job.id,createdAt,createdBy:me.email,createdByRole:me.role});
    });
    await updateDoc(doc(db,'maintenance_events',job.id),{failedDisposition:job.maintenanceResult==='Fail'?'Return to Warehouse — Not Available':'Return to Warehouse — Available',releaseMovementId:movementId,releaseToWarehouseId:toId,releaseToWarehouseName:toName,releaseAt:createdAt,releaseBy:me.email,updatedAt:createdAt,updatedBy:me.email});
    await log(baseLog(item,{activity:'RETURN_MAINTENANCE',activityLabel:'Return from Maintenance',status:'In Transit',fromType:'maintenance',fromName:src.locationName,toType:'warehouse',toName,qty,movementId,remark,maintenanceResult:job.maintenanceResult,maintenanceEventId:job.id,toStatus:finalStatus}));
    await audit('RETURN_MAINTENANCE',item,job,{status:'Maintenance',location:src.locationName,maintenanceResult:job.maintenanceResult},{status:'In Transit',destination:toName,arrivalStatus:finalStatus,qty},remark,movementId,{arrivalStatus:finalStatus});
    alert(`Return to warehouse started. On arrival the item will be ${finalStatus}.`);
    location.reload();
  }catch(err){alert('Maintenance release failed: '+(err?.message||err));}finally{busy=false;}
}
async function mount(){
  const core=byId('maintenanceForm');
  if(!core||core.dataset.maintenanceWorkflow==='1'||core===lastMount)return;
  lastMount=core;
  try{await load();}catch(err){console.warn('IMS maintenance workflow unavailable:',err);return;}
  const replacement=document.createElement('div');replacement.innerHTML=shellHtml();
  const form=replacement.firstElementChild;form.dataset.maintenanceWorkflow='1';core.replaceWith(form);
  byId('mwItem').onchange=renderSelected;
  hideMaintenanceFromMove();
}
let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{mount();hideMaintenanceFromMove();},35);}).observe(document.body,{childList:true,subtree:true});
mount();
