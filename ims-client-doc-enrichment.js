import {db} from './firebase-config.js';
import {collection,doc,getDoc,getDocs,limit,query,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const money=n=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
let groupCache=null,loading=false,lastLoad=0;

async function clientGroups(force=false){
  if(loading)return groupCache||[];
  if(!force&&groupCache&&Date.now()-lastLoad<30000)return groupCache;
  loading=true;
  try{
    const snap=await getDocs(query(collection(db,'movement_groups'),where('referenceType','==','client_po'),limit(100)));
    groupCache=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.referenceNumber);
    lastLoad=Date.now();
    return groupCache;
  }finally{loading=false;}
}

async function movementSummary(group){
  const snap=await getDocs(query(collection(db,'movements'),where('movementGroupId','==',group.id),limit(200)));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.referenceType==='client_po'||m.action==='DELIVER_CLIENT');
  if(!rows.length)return null;
  rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const itemIds=[...new Set(rows.map(x=>x.itemId).filter(Boolean))],first=rows.find(x=>x.periodFrom||x.periodTo||x.clientPOAmount)||rows[0];
  let current=0;
  for(const id of itemIds){
    const s=await getDoc(doc(db,'inventory',id));if(!s.exists())continue;
    const i=s.data(),balances=Array.isArray(i.stockBalances)?i.stockBalances:[];
    if(balances.some(b=>b.status==='At Client'&&((group.partyId&&String(b.locationId||'')===String(group.partyId))||norm(b.locationName)===norm(group.partyName||group.toName||''))))current++;
  }
  const poAmount=Math.max(0,...rows.map(x=>Number(x.clientPOAmount||0))),currency=first.currency||'MYR',expected=itemIds.length,outstanding=Math.max(0,expected-current);
  return{periodFrom:first.periodFrom||'',periodTo:first.periodTo||'',poAmount,currency,expected,current,outstanding};
}

function cellText(td){return String(td?.textContent||'').trim();}
function incomplete(cells){return cellText(cells[3])==='—'||cellText(cells[4])==='—'||cellText(cells[5])==='—'||cellText(cells[6])==='0'||/0\.00$/.test(cellText(cells[8]));}

async function enrichTable(force=false){
  const table=document.querySelector('#docTable table');if(!table)return;
  const groups=await clientGroups(force),rows=[...table.querySelectorAll('tbody tr')];
  for(const tr of rows){
    const cells=[...tr.children];if(cells.length<11||!incomplete(cells))continue;
    const po=cellText(cells[0]),business=cellText(cells[1]);
    const g=groups.find(x=>norm(x.referenceNumber)===norm(po)&&(!business||norm(x.partyName||x.toName)===norm(business)));
    if(!g)continue;
    const s=await movementSummary(g);if(!s)continue;
    if(cellText(cells[3])==='—'&&s.periodFrom)cells[3].textContent=s.periodFrom;
    if(cellText(cells[4])==='—'&&s.periodTo)cells[4].textContent=s.periodTo;
    if(cellText(cells[5])==='—')cells[5].textContent=String(s.expected);
    if(cellText(cells[6])==='0'||cellText(cells[6])==='—')cells[6].textContent=String(s.current);
    if(cellText(cells[7])==='—')cells[7].textContent=String(s.outstanding);
    if(/0\.00$/.test(cellText(cells[8]))&&s.poAmount>0)cells[8].textContent=`${s.currency} ${money(s.poAmount)}`;
    if(/0\.00$/.test(cellText(cells[10]))&&s.poAmount>0)cells[10].textContent=`${s.currency} ${money(s.poAmount)}`;
    tr.dataset.imsMovementEnriched='1';
  }
  window.IMSDueWarning?.refresh?.(false);
}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>enrichTable(false).catch(e=>console.error('IMS client document enrichment failed:',e)),90);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:invoices-ready',()=>enrichTable(true).catch(console.error));
window.addEventListener('ims:modules-ready',()=>enrichTable(true).catch(console.error));
enrichTable(true).catch(e=>console.error('IMS client document enrichment failed:',e));
window.IMSClientDocEnrichment=Object.freeze({enrichTable});
export{enrichTable};