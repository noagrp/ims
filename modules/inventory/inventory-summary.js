import {db} from '../../firebase-config.js';
import {collection,doc,getDocs,runTransaction,setDoc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export const SUMMARY_VERSION=1;
export const SUMMARY_GLOBAL=doc(db,'inventory_summary','global');
export const SUMMARY_DISTRIBUTION=doc(db,'inventory_summary','distribution');
export const SUMMARY_CATEGORIES=doc(db,'inventory_summary','categories');

const EXIT_STATUS=new Set(['Disposed - Sold','Disposed - Scrapped','Written Off','Returned to Supplier','Returned to Owner','Disposed - Other']);
const GLOBAL_FIELDS=['liveQty','availableQty','atClientQty','atSupplierQty','reservedQty','maintenanceQty','inspectionQty','notAvailableQty','inTransitQty','missingQty','stolenQty','ownedQty','r2rQty'];
const numeric=v=>Number(v||0);
const safe=s=>String(s??'').replace(/[./#$\[\]]/g,'_').trim()||'Unknown';
const clone=v=>JSON.parse(JSON.stringify(v||{}));

export function inventoryBalances(item){
  return(Array.isArray(item?.stockBalances)?item.stockBalances:[])
    .filter(b=>numeric(b.qty)>0)
    .map(b=>({...b,qty:numeric(b.qty),locationType:b.locationType||'',locationId:b.locationId||'',locationName:b.locationName||b.location||'Unknown',status:b.status||'Not Available'}));
}

export function summarizeItem(item={}){
  const global=Object.fromEntries(GLOBAL_FIELDS.map(k=>[k,0])),warehouses={},clients={},suppliers={},categories={};
  const isR2R=item.ownershipType==='third_party',category=item.category||'Uncategorized';
  for(const b of inventoryBalances(item)){
    const q=b.qty,live=!EXIT_STATUS.has(b.status);
    if(live){global.liveQty+=q;isR2R?global.r2rQty+=q:global.ownedQty+=q;categories[category]=(categories[category]||0)+q;}
    if(b.status==='Available')global.availableQty+=q;
    if(b.status==='At Client')global.atClientQty+=q;
    if(b.status==='At Supplier')global.atSupplierQty+=q;
    if(b.status==='Reserved')global.reservedQty+=q;
    if(b.status==='Maintenance')global.maintenanceQty+=q;
    if(b.status==='Inspection')global.inspectionQty+=q;
    if(b.status==='Not Available')global.notAvailableQty+=q;
    if(b.status==='In Transit')global.inTransitQty+=q;
    if(b.status==='Missing')global.missingQty+=q;
    if(b.status==='Stolen')global.stolenQty+=q;
    if(live&&b.locationType==='warehouse'){
      const k=safe(b.locationId||b.locationName),x=warehouses[k]||(warehouses[k]={id:b.locationId||'',name:b.locationName||'Unknown',qty:0,availableQty:0});
      x.qty+=q;if(b.status==='Available')x.availableQty+=q;
    }
    if(live&&b.status==='At Client'){
      const k=safe(b.locationId||b.locationName),x=clients[k]||(clients[k]={id:b.locationId||'',name:b.locationName||'Unknown',qty:0});x.qty+=q;
    }
    if(live&&b.status==='At Supplier'&&!isR2R){
      const k=safe(b.locationId||b.locationName),x=suppliers[k]||(suppliers[k]={id:b.locationId||'',name:b.locationName||item.supplierName||'Unknown Supplier',qty:0});x.qty+=q;
    }
  }
  return{global,warehouses,clients,suppliers,categories};
}

export function summarizeInventory(items=[]){
  const out={global:Object.fromEntries(GLOBAL_FIELDS.map(k=>[k,0])),warehouses:{},clients:{},suppliers:{},categories:{}};
  const mergeGroups=(target,src,warehouse=false)=>{for(const[k,v]of Object.entries(src)){const x=target[k]||(target[k]={id:v.id||'',name:v.name||k,qty:0});x.qty+=numeric(v.qty);if(warehouse)x.availableQty=numeric(x.availableQty)+numeric(v.availableQty);}};
  for(const item of items){const s=summarizeItem(item);for(const k of GLOBAL_FIELDS)out.global[k]+=numeric(s.global[k]);mergeGroups(out.warehouses,s.warehouses,true);mergeGroups(out.clients,s.clients);mergeGroups(out.suppliers,s.suppliers);for(const[k,v]of Object.entries(s.categories))out.categories[k]=(out.categories[k]||0)+numeric(v);}
  return out;
}

function groupDelta(before={},after={},warehouse=false){const out={},keys=new Set([...Object.keys(before),...Object.keys(after)]);for(const k of keys){const b=before[k]||{},a=after[k]||{},qty=numeric(a.qty)-numeric(b.qty),availableQty=numeric(a.availableQty)-numeric(b.availableQty);if(qty||(warehouse&&availableQty))out[k]={id:a.id||b.id||'',name:a.name||b.name||k,qty,...(warehouse?{availableQty}:{})};}return out;}
export function inventorySummaryDelta(beforeItem={},afterItem={}){
  const before=summarizeItem(beforeItem),after=summarizeItem(afterItem),global={};for(const k of GLOBAL_FIELDS)global[k]=numeric(after.global[k])-numeric(before.global[k]);
  const categories={},keys=new Set([...Object.keys(before.categories),...Object.keys(after.categories)]);for(const k of keys){const d=numeric(after.categories[k])-numeric(before.categories[k]);if(d)categories[k]=d;}
  return{global,warehouses:groupDelta(before.warehouses,after.warehouses,true),clients:groupDelta(before.clients,after.clients),suppliers:groupDelta(before.suppliers,after.suppliers),categories};
}

export function combineInventorySummaryDeltas(deltas=[]){
  const out={global:Object.fromEntries(GLOBAL_FIELDS.map(k=>[k,0])),warehouses:{},clients:{},suppliers:{},categories:{}};
  const mergeGroups=(target,src)=>{for(const[k,d]of Object.entries(src||{})){const x=target[k]||(target[k]={id:d.id||'',name:d.name||k,qty:0,availableQty:0});x.qty+=numeric(d.qty);x.availableQty+=numeric(d.availableQty);}};
  for(const d of deltas){for(const k of GLOBAL_FIELDS)out.global[k]+=numeric(d?.global?.[k]);mergeGroups(out.warehouses,d?.warehouses);mergeGroups(out.clients,d?.clients);mergeGroups(out.suppliers,d?.suppliers);for(const[k,v]of Object.entries(d?.categories||{}))out.categories[k]=(out.categories[k]||0)+numeric(v);}
  return out;
}

function applyGroups(base={},delta={},warehouse=false){const out=clone(base);for(const[k,d]of Object.entries(delta)){const x=out[k]||{id:d.id||'',name:d.name||k,qty:0};x.id=d.id||x.id||'';x.name=d.name||x.name||k;x.qty=Math.max(0,numeric(x.qty)+numeric(d.qty));if(warehouse)x.availableQty=Math.max(0,numeric(x.availableQty)+numeric(d.availableQty));if(!x.qty&&(!warehouse||!x.availableQty))delete out[k];else out[k]=x;}return out;}
function applyCategories(base={},delta={}){const out=clone(base);for(const[k,d]of Object.entries(delta)){const v=Math.max(0,numeric(out[k])+numeric(d));if(v)out[k]=v;else delete out[k];}return out;}

export async function applyInventorySummaryDelta(tx,delta,{updatedAt=new Date().toISOString(),updatedBy=''}={}){
  const gSnap=await tx.get(SUMMARY_GLOBAL),dSnap=await tx.get(SUMMARY_DISTRIBUTION),cSnap=await tx.get(SUMMARY_CATEGORIES);
  if(!gSnap.exists()||!dSnap.exists()||!cSnap.exists())return false;
  const g={summaryVersion:SUMMARY_VERSION,...gSnap.data()};for(const k of GLOBAL_FIELDS)g[k]=Math.max(0,numeric(g[k])+numeric(delta.global[k]));g.updatedAt=updatedAt;g.updatedBy=updatedBy;
  const d={summaryVersion:SUMMARY_VERSION,...dSnap.data()};d.warehouses=applyGroups(d.warehouses,delta.warehouses,true);d.clients=applyGroups(d.clients,delta.clients);d.suppliers=applyGroups(d.suppliers,delta.suppliers);d.updatedAt=updatedAt;d.updatedBy=updatedBy;
  const c={summaryVersion:SUMMARY_VERSION,...cSnap.data()};c.categories=applyCategories(c.categories,delta.categories);c.updatedAt=updatedAt;c.updatedBy=updatedBy;
  tx.set(SUMMARY_GLOBAL,g,{merge:true});tx.set(SUMMARY_DISTRIBUTION,d,{merge:true});tx.set(SUMMARY_CATEGORIES,c,{merge:true});return true;
}

export async function updateInventorySummary(beforeItem,afterItem,meta={}){const delta=inventorySummaryDelta(beforeItem,afterItem);await runTransaction(db,tx=>applyInventorySummaryDelta(tx,delta,meta));}

export async function rebuildInventorySummary(rebuiltBy=''){
  const snap=await getDocs(collection(db,'inventory')),items=snap.docs.map(d=>({id:d.id,...d.data()})),summary=summarizeInventory(items),at=new Date().toISOString(),meta={summaryVersion:SUMMARY_VERSION,updatedAt:at,updatedBy:rebuiltBy,rebuiltAt:at,rebuiltBy,sourceRecordCount:snap.size};
  await Promise.all([
    setDoc(SUMMARY_GLOBAL,{...meta,...summary.global}),
    setDoc(SUMMARY_DISTRIBUTION,{...meta,warehouses:summary.warehouses,clients:summary.clients,suppliers:summary.suppliers}),
    setDoc(SUMMARY_CATEGORIES,{...meta,categories:summary.categories})
  ]);
  return{recordCount:snap.size,...summary};
}
