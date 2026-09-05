import {db} from '../../firebase-config.js';
import {collection,doc,getDocs,setDoc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const EXIT_STATUS=new Set(['Disposed - Sold','Disposed - Scrapped','Written Off','Returned to Supplier','Returned to Owner','Disposed - Other']);
const numeric=v=>Number(v||0);
const safe=s=>String(s??'').replace(/[./#$\[\]]/g,'_').trim()||'Unknown';

export function inventoryBalances(item){
  return (Array.isArray(item?.stockBalances)?item.stockBalances:[])
    .filter(b=>numeric(b.qty)>0)
    .map(b=>({...b,qty:numeric(b.qty),locationType:b.locationType||'',locationId:b.locationId||'',locationName:b.locationName||b.location||'Unknown',status:b.status||'Not Available'}));
}

export function summarizeInventory(items=[]){
  const global={liveQty:0,availableQty:0,atClientQty:0,atSupplierQty:0,reservedQty:0,maintenanceQty:0,inspectionQty:0,notAvailableQty:0,inTransitQty:0,missingQty:0,stolenQty:0,ownedQty:0,r2rQty:0};
  const warehouses={},clients={},suppliers={},categories={};
  for(const item of items){
    const isR2R=item?.ownershipType==='third_party',category=item?.category||'Uncategorized';
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
        const k=safe(b.locationId||b.locationName),x=suppliers[k]||(suppliers[k]={id:b.locationId||'',name:b.locationName||item?.supplierName||'Unknown Supplier',qty:0});x.qty+=q;
      }
    }
  }
  return{global,warehouses,clients,suppliers,categories};
}

export async function rebuildInventorySummary(rebuiltBy=''){
  const snap=await getDocs(collection(db,'inventory'));
  const items=snap.docs.map(d=>({id:d.id,...d.data()}));
  const summary=summarizeInventory(items),at=new Date().toISOString(),meta={summaryVersion:1,updatedAt:at,updatedBy:rebuiltBy,rebuiltAt:at,rebuiltBy,sourceRecordCount:snap.size};
  await Promise.all([
    setDoc(doc(db,'inventory_summary','global'),{...meta,...summary.global}),
    setDoc(doc(db,'inventory_summary','distribution'),{...meta,warehouses:summary.warehouses,clients:summary.clients,suppliers:summary.suppliers}),
    setDoc(doc(db,'inventory_summary','categories'),{...meta,categories:summary.categories})
  ]);
  return{recordCount:snap.size,...summary};
}
