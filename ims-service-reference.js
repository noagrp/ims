import {db} from './firebase-config.js';
import {collection,getDocs,limit,query,updateDoc,where,doc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const $=id=>document.getElementById(id);
let pending=null,timer;

function leaf(root,from,to){
  if(!root)return;
  for(const el of root.querySelectorAll('*')){
    if(!el.children.length&&el.textContent.trim()===from)el.textContent=to;
  }
}
function refineWorkflow(){
  const root=$('serviceCycleWorkflow');
  if(!root)return;
  leaf(root,'Service No.','Service No. / PO *');
  leaf(root,'PO','Service No. / PO *');
  leaf(root,'Service No. / PO','Service No. / PO *');
  leaf(root,'Active Service No.','Active Service No. / PO');
  leaf(root,'Active PO','Active Service No. / PO');
  leaf(root,'Failed Service No.','Failed Service No. / PO');
  leaf(root,'Failed PO','Failed Service No. / PO');
  leaf(root,'Completed / Failed Service No.','Completed / Failed Service No. / PO');
  leaf(root,'Completed / Failed PO','Completed / Failed Service No. / PO');
  leaf(root,'Select a Service No.','Select a Service No. / PO.');
  leaf(root,'Select a PO.','Select a Service No. / PO.');
  leaf(root,'Select a PO','Select a Service No. / PO');
}
function refineItemDetail(){
  const root=$('itemDetailMount');
  if(!root)return;
  const headings=[...root.querySelectorAll('h3')];
  const serviceHeading=headings.find(x=>x.textContent.trim()==='Service Cycle History');
  if(serviceHeading){
    const section=serviceHeading.closest('section');
    if(section){
      leaf(section,'Service No.','Service No. / PO');
      leaf(section,'PO','Service No. / PO');
    }
  }
  const docsHeading=headings.find(x=>x.textContent.trim()==='Documents & References');
  if(docsHeading){
    const section=docsHeading.closest('section');
    if(section){
      for(const td of section.querySelectorAll('td')){
        const t=td.textContent.trim();
        if((t==='PO'||t==='Service No.')&&td.previousElementSibling?.textContent.trim()==='Service Cycle')td.textContent='Service No. / PO';
      }
    }
  }
}
async function canonicalize(reference){
  reference=String(reference||'').trim();
  if(!reference)return;
  const snap=await getDocs(query(collection(db,'service_cycles'),where('serviceNo','==',reference),limit(100)));
  for(const d of snap.docs){
    const c=d.data();
    if(c.serviceReference===reference&&Array.isArray(c.stages)&&c.stages.every(s=>s.serviceReference||!s.serviceRef))continue;
    const stages=Array.isArray(c.stages)?c.stages.map(s=>({...s,serviceReference:s.serviceReference||s.serviceRef||reference})):[];
    await updateDoc(doc(db,'service_cycles',d.id),{serviceReference:reference,stages});
  }
}
function scheduleCanonicalize(){
  const p=pending;pending=null;if(!p?.reference)return;
  for(const ms of [900,1800,3200])setTimeout(()=>canonicalize(p.reference).catch(e=>console.warn('IMS service reference canonicalization pending Rules update:',e?.message||e)),ms);
}
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest?.('#scStart'))return;
  pending={reference:$('scNo')?.value.trim()||'',mode:$('scMode')?.value||''};
  setTimeout(scheduleCanonicalize,40);
},true);

new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(()=>{refineWorkflow();refineItemDetail();},35);
}).observe(document.body,{childList:true,subtree:true});

refineWorkflow();refineItemDetail();
window.IMSServiceReference=Object.freeze({canonicalize,refineWorkflow});
window.dispatchEvent(new CustomEvent('ims:service-reference-ready'));
export{canonicalize,refineWorkflow};