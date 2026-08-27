import { auth, db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const BACKFILL_KEY='ims-client-position-backfill-v2';
const safeKey=s=>String(s??'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'client';

function clientBalances(item){
  const b=Array.isArray(item.stockBalances)?item.stockBalances:[];
  return b.filter(x=>Number(x?.qty||0)>0 && String(x?.locationType||'').toLowerCase()==='client');
}

async function alreadyLogged(itemId,clientId,clientName,status){
  const snap=await getDocs(query(collection(db,'operational_logs'),where('itemId','==',itemId)));
  return snap.docs.some(d=>{
    const x=d.data();
    const sameClient=clientId ? x.clientId===clientId : String(x.clientName||x.toName||'').trim()===clientName;
    return sameClient && x.toType==='client' && (x.status===status || (status==='At Client'&&x.status==='Rental'));
  });
}

export async function backfillCurrentClientPositions(){
  if(localStorage.getItem(BACKFILL_KEY)==='done')return 0;
  const user=auth.currentUser;
  if(!user)return 0;
  const profileSnap=await getDoc(doc(db,'users',user.uid));
  if(!profileSnap.exists()||profileSnap.data().status!=='active')return 0;
  const profile=profileSnap.data();
  const email=profile.email||user.email||'';
  const role=profile.role||'';
  if(!email||!role)return 0;

  const invSnap=await getDocs(collection(db,'inventory'));
  let created=0;

  for(const d of invSnap.docs){
    const item={id:d.id,...d.data()};
    for(const bal of clientBalances(item)){
      const clientName=String(bal.locationName||item.currentLocation||'Client').trim()||'Client';
      const clientId=String(bal.locationId||'').trim();
      const status=bal.status==='Rental'?'Rental':'At Client';
      if(await alreadyLogged(item.id,clientId,clientName,status))continue;

      const key=`client-position-backfill_${item.id}_${safeKey(clientId||clientName)}`;
      const ref=doc(db,'operational_logs',key);
      const existing=await getDoc(ref);
      if(existing.exists())continue;

      const eventDate=item.lastEditedAt||item.createdAt||new Date().toISOString();
      await setDoc(ref,{
        logVersion:2,migrationVersion:2,migrated:true,migrationType:'CURRENT_CLIENT_POSITION',
        date:String(eventDate),activity:'CURRENT_POSITION_BACKFILL',activityLabel:'Current Position Migration',status,
        fromType:'unknown',fromName:'Previous / Unknown',toType:'client',toName:clientName,qty:Number(bal.qty||0),unit:item.unit||'',
        itemId:item.id,itemCode:item.itemCode||'',itemName:item.name||item.itemName||'',category:item.category||'',
        supplierId:item.supplierId||'',supplierName:item.supplierName||'',clientId,clientName,
        performedBy:email,performedByRole:role,
        remark:'Backfilled from current stock balance; original arrival event was not available in operational logs.'
      });
      created++;
    }
  }

  localStorage.setItem(BACKFILL_KEY,'done');
  if(created)console.info(`IMS: backfilled ${created} current client position log(s).`);
  return created;
}
