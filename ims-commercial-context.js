import {db} from './firebase-config.js';
import {addDoc,collection,doc,documentId,getDoc,getDocs,limit,orderBy,query,startAfter,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const movementCache=new Map();
const key=(side,businessId,po)=>`${side}|${businessId||''}|${norm(po)}`;
let recentIndexSync=null;

async function movementsForItem(itemId,force=false){
  if(!itemId)return[];
  if(!force&&movementCache.has(itemId))return movementCache.get(itemId);
  const snap=await getDocs(query(collection(db,'movements'),where('itemId','==',itemId),limit(100)));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.createdAt||b.updatedAt||'').localeCompare(String(a.createdAt||a.updatedAt||'')));
  movementCache.set(itemId,rows);
  return rows;
}

async function currentClientAssignment(itemId,clientName=''){
  const target=norm(clientName),rows=await movementsForItem(itemId);
  const candidates=rows.filter(m=>(m.action==='DELIVER_CLIENT'||m.referenceType==='client_po')&&m.toType==='client'&&m.status==='arrived'&&(!target||norm(m.toName)===target));
  const m=candidates[0];
  if(!m)return null;
  return{movementId:m.id,clientId:m.toId||'',clientName:m.toName||'',po:m.referenceNumber||'',periodFrom:m.periodFrom||'',periodTo:m.periodTo||'',createdAt:m.createdAt||'',status:m.status||''};
}

async function readAllByFilter(name,filters=[]){const rows=[];let cursor=null;while(true){const parts=[...filters,orderBy(documentId(),'asc')];if(cursor)parts.push(startAfter(cursor));parts.push(limit(500));const snap=await getDocs(query(collection(db,name),...parts));rows.push(...snap.docs.map(d=>({id:d.id,...d.data()})));if(snap.size<500)break;cursor=snap.docs.at(-1);}return rows;}
async function existingCommercialKeys(keys){const found=new Set();for(let i=0;i<keys.length;i+=30){const chunk=keys.slice(i,i+30);if(!chunk.length)continue;const snap=await getDocs(query(collection(db,'document_refs'),where('commercialKey','in',chunk)));for(const d of snap.docs){const k=d.data().commercialKey;if(k)found.add(k);}}return found;}
async function recentRows(name,filters=[]){return(await getDocs(query(collection(db,name),...filters,orderBy(documentId(),'desc'),limit(100)))).docs.map(d=>({id:d.id,...d.data()}));}
async function syncRecentCommercialIndex(){
  if(recentIndexSync)return recentIndexSync;
  recentIndexSync=(async()=>{
    const actor=window.IMSUser?.email||'';if(!actor)return{created:0};
    const[clients,owned,r2r]=await Promise.all([
      recentRows('movement_groups',[where('referenceType','==','client_po')]),
      recentRows('registration_batches',[where('completionStatus','==','completed')]),
      recentRows('movement_groups',[where('referenceType','==','r2r_po')])
    ]);
    const candidates=[];
    for(const g of clients){const po=String(g.referenceNumber||'').trim(),businessId=String(g.partyId||g.toId||'');if(po&&businessId)candidates.push({kind:'client',key:key('client',businessId,po),g,po,businessId});}
    for(const b of owned){const po=String(b.ourPONumber||'').trim(),businessId=String(b.supplierId||'');if(po&&businessId)candidates.push({kind:'owned',key:key('supplier',businessId,po),b,po,businessId});}
    for(const g of r2r){const po=String(g.referenceNumber||'').trim(),businessId=String(g.partyId||g.fromId||'');if(po&&businessId)candidates.push({kind:'r2r',key:key('supplier',businessId,po),g,po,businessId});}
    const unique=[...new Map(candidates.map(x=>[x.key,x])).values()],existing=await existingCommercialKeys(unique.map(x=>x.key));let created=0;
    for(const c of unique){if(existing.has(c.key))continue;let rec=null;
      if(c.kind==='client'){
        const moves=await readAllByFilter('movements',[where('movementGroupId','==',c.g.id)]),ids=[...new Set(moves.map(x=>x.itemId).filter(Boolean))],first=moves[0]||{};
        rec={docType:'Commercial PO',context:'Commercial Documents',commercialKey:c.key,commercialSide:'client',businessId:c.businessId,businessName:c.g.partyName||c.g.toName||'',poNumber:c.po,refNumber:c.po,poAmount:Number(first.clientPOAmount||0),currency:first.currency||'MYR',poStatus:'Open',expectedQty:null,fulfilledQty:ids.length,periodFrom:first.periodFrom||'',periodTo:first.periodTo||'',linkedItemIds:ids,invoices:[],createdAt:c.g.createdAt||c.g.updatedAt||new Date().toISOString(),createdBy:actor};
      }else if(c.kind==='owned'){
        const ids=Array.isArray(c.b.itemIds)?c.b.itemIds.filter(Boolean):[];
        rec={docType:'Commercial PO',context:'Commercial Documents',commercialKey:c.key,commercialSide:'supplier',businessId:c.businessId,businessName:c.b.supplierName||'',poNumber:c.po,refNumber:c.po,poAmount:Number(c.b.ourPOAmount||0),currency:c.b.currency||'MYR',poStatus:'Open',expectedQty:Number(c.b.quantity||ids.length)||null,fulfilledQty:ids.length,periodFrom:'',periodTo:'',linkedItemIds:ids,invoices:[],createdAt:c.b.createdAt||new Date().toISOString(),createdBy:actor};
      }else{
        const ids=Array.isArray(c.g.itemIds)?c.g.itemIds.filter(Boolean):[];
        rec={docType:'Commercial PO',context:'Commercial Documents',commercialKey:c.key,commercialSide:'supplier',businessId:c.businessId,businessName:c.g.partyName||c.g.fromName||'',poNumber:c.po,refNumber:c.po,poAmount:0,currency:'MYR',poStatus:'Open',expectedQty:Number(c.g.itemCount||ids.length)||null,fulfilledQty:ids.length,periodFrom:'',periodTo:'',linkedItemIds:ids,invoices:[],createdAt:c.g.createdAt||c.g.updatedAt||new Date().toISOString(),createdBy:actor};
      }
      await addDoc(collection(db,'document_refs'),rec);existing.add(c.key);created++;
    }
    return{created};
  })().catch(e=>{console.warn('IMS recent Commercial PO index sync skipped:',e?.message||e);return{created:0,error:String(e?.message||e)};}).finally(()=>{setTimeout(()=>{recentIndexSync=null;},15000);});
  return recentIndexSync;
}

function metaNode(card,label){return[...card.querySelectorAll('span')].find(x=>norm(x.textContent)===norm(label))?.parentElement||null;}
function metaValue(card,label){const n=metaNode(card,label);return n?.querySelector('div')?.textContent.trim()||'';}
function setMeta(card,oldLabel,newLabel,value){const n=metaNode(card,oldLabel)||metaNode(card,newLabel);if(!n)return;const l=n.querySelector('span'),v=n.querySelector('div');if(l)l.textContent=newLabel;if(v)v.textContent=value||'—';}

async function decorateWorkspace(){
  const supplierRoot=document.querySelector('[data-workspace-queue="supplier"]');
  if(supplierRoot)for(const card of supplierRoot.querySelectorAll('.workspaceOpenItem[data-id]')){
    const ownership=metaValue(card,'Ownership'),label=/r2r|third-party/i.test(ownership)?'Our PO':'Wellora PO';
    setMeta(card,'PO',label,metaValue(card,'PO')||metaValue(card,label));
  }
  const clientRoot=document.querySelector('[data-workspace-queue="client"]');
  if(clientRoot)for(const card of clientRoot.querySelectorAll('.workspaceOpenItem[data-id]')){
    const client=metaValue(card,'Client'),assignment=await currentClientAssignment(card.dataset.id,client);
    setMeta(card,'PO','Client PO',assignment?.po||'');
    card.dataset.currentClientPo=assignment?.po||'';
    card.dataset.currentClientDue=assignment?.periodTo||'';
    card.dataset.currentClientName=assignment?.clientName||client||'';
  }
}

function contextInfo(label,value){return`<div class="bg-slate-950 rounded-xl p-3 min-w-0"><div class="text-[10px] uppercase tracking-wide text-slate-500">${esc(label)}</div><div class="mt-1 text-sm font-semibold break-words">${esc(value||'—')}</div></div>`;}
async function decorateItemDetail(itemId){
  const mount=document.getElementById('itemDetailMount'),outer=mount?.querySelector(':scope > section');if(!outer||!itemId)return;
  outer.querySelector('[data-ims-current-commercial-context]')?.remove();
  const snap=await getDoc(doc(db,'inventory',itemId));if(!snap.exists())return;
  const i={id:snap.id,...snap.data()},firstSection=[...outer.children].find(x=>x.tagName==='SECTION');
  let html='';
  if(i.status==='At Client'){
    const assignment=await currentClientAssignment(itemId,i.currentLocation||'');
    html=`<section data-ims-current-commercial-context class="border border-cyan-900/50 bg-cyan-950/10 rounded-xl p-4"><h3 class="text-sm font-bold text-cyan-200 mb-2">Current Client Assignment</h3><div class="grid sm:grid-cols-2 md:grid-cols-4 gap-2">${contextInfo('Client',assignment?.clientName||i.currentLocation)}${contextInfo('Client PO',assignment?.po)}${contextInfo('Due Date',assignment?.periodTo)}${contextInfo('Status','At Client')}</div></section>`;
  }else if(i.status==='At Supplier'){
    const poLabel=i.ownershipType==='third_party'?'Our PO':'Wellora PO';
    html=`<section data-ims-current-commercial-context class="border border-slate-700 rounded-xl p-4"><h3 class="text-sm font-bold mb-2">Current Supplier Position</h3><div class="grid sm:grid-cols-2 md:grid-cols-4 gap-2">${contextInfo('Supplier',i.currentLocation||i.ownerBusinessName||i.supplierName)}${contextInfo(poLabel,i.ourPONumber)}${contextInfo('Ownership',i.ownershipType==='third_party'?'R2R / Third-Party':'Owned')}${contextInfo('Status','At Supplier')}</div></section>`;
  }
  if(html){const w=document.createElement('div');w.innerHTML=html;firstSection?outer.insertBefore(w.firstElementChild,firstSection):outer.appendChild(w.firstElementChild);}
}

function wrapItems(){
  const current=window.IMSItems;if(!current||current.__commercialContextWrapped)return;
  const original=current.showItem.bind(current);
  const showItem=async id=>{const result=await original(id);await decorateItemDetail(id);return result;};
  window.IMSItems=Object.freeze({...current,showItem,__commercialContextWrapped:true});
}

function replaceLeafText(root,from,to){for(const el of root.querySelectorAll('*'))if(!el.children.length&&el.textContent.includes(from))el.textContent=el.textContent.replaceAll(from,to);}
function decorateBusinessDocuments(){
  const modal=document.getElementById('bizProfileModal');if(!modal)return;
  replaceLeafText(modal,'Supplier PO','Wellora / Our PO');
  const docs=document.getElementById('bizDocs');if(!docs||docs.dataset.commercialGrouped==='1')return;
  const cards=[...docs.querySelectorAll('.bizDoc')];if(!cards.length)return;
  const client=cards.filter(b=>/Client PO/i.test(b.textContent)),supplier=cards.filter(b=>/Wellora \/ Our PO|Supplier PO/i.test(b.textContent));
  if(!client.length&&!supplier.length)return;
  docs.dataset.commercialGrouped='1';docs.className='space-y-4';docs.innerHTML='';
  const addGroup=(title,note,list)=>{if(!list.length)return;const s=document.createElement('section');s.className='border border-slate-800 rounded-xl p-3';s.innerHTML=`<div class="font-semibold text-sm">${title}</div><div class="text-[10px] text-slate-500 mt-0.5 mb-2">${note}</div><div class="grid sm:grid-cols-2 gap-2" data-group-cards></div>`;const target=s.querySelector('[data-group-cards]');list.forEach(x=>target.appendChild(x));docs.appendChild(s);};
  addGroup('Client Commercial','Client PO, due dates and client invoices.',client);
  addGroup('Supplier / Procurement','Wellora / Our PO and supplier-side invoices.',supplier);
}

async function refresh(){wrapItems();await syncRecentCommercialIndex();await decorateWorkspace();decorateBusinessDocuments();}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>refresh().catch(e=>console.error('IMS commercial context failed:',e)),70);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:workspace-rendered',()=>refresh().catch(console.error));
window.addEventListener('ims:items-ready',wrapItems);
window.addEventListener('ims:auth-ready',()=>syncRecentCommercialIndex().catch(()=>{}));
refresh().catch(e=>console.error('IMS commercial context failed:',e));
window.IMSCommercialContext=Object.freeze({currentClientAssignment,movementsForItem,decorateItemDetail,syncRecentCommercialIndex,refresh});
export{currentClientAssignment,movementsForItem,decorateItemDetail,syncRecentCommercialIndex,refresh};