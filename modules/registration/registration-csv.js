import {db} from '../../firebase-config.js';
import {collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const $=id=>document.getElementById(id);
const allowedRole=()=>['manager','superadmin'].includes(String(window.IMS_ROLE||'').toLowerCase());
const blank=v=>/^--\s+.*\s+--$/.test(String(v??'').trim())?'':String(v??'');
const csvCell=v=>`"${String(v??'').replace(/"/g,'""')}"`;

function downloadCsv(filename,headers,rows=[]){
  const lines=[headers,...rows];
  const text='\ufeff'+lines.map(r=>r.map(csvCell).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function regRow(i){const b=(Array.isArray(i.stockBalances)?i.stockBalances:[]).find(x=>Number(x.qty||0)>0)||{},pos=b.locationType==='supplier'?'Supplier':'Warehouse';return[i.type,1,i.unit,i.name,i.alias,blank(i.coc),i.category,blank(i.size),blank(i.grade),blank(i.ppf),blank(i.connection),blank(i.range),blank(i.brand),blank(i.model),i.weight??'',i.weightUnit,i.supplierName,i.ourPONumber,i.ourPOAmount??'',i.currency,pos,pos==='Warehouse'?b.locationName:'',i.deliveryTicket,i.receivingTicket,i.remark];}
function r2rRow(i){const b=(Array.isArray(i.stockBalances)?i.stockBalances:[]).find(x=>Number(x.qty||0)>0)||{},wh=b.toType==='warehouse'?b.toName:b.locationType==='warehouse'?b.locationName:'';return[i.type,1,i.unit,i.name,i.alias,blank(i.coc),i.category,blank(i.size),blank(i.grade),blank(i.ppf),blank(i.connection),blank(i.range),blank(i.brand),blank(i.model),i.weight??'',i.weightUnit,i.supplierName||i.ownerBusinessName,i.ourPONumber,i.ourPOAmount??'',i.currency,wh,i.rentalStartDate,i.rentalDueDate,i.remark];}
async function exportCsv(mode){
  if(!allowedRole())return;
  const api=window.IMSRegistrationCSV;if(!api)throw new Error('Registration import/export module is unavailable.');
  const own=mode==='registration'?'owned':'third_party';
  const snap=await getDocs(query(collection(db,'inventory'),where('ownershipType','==',own)));
  const headers=mode==='registration'?api.REG_HEADERS:api.R2R_HEADERS;
  const rows=snap.docs.map(d=>mode==='registration'?regRow(d.data()):r2rRow(d.data()));
  downloadCsv(`IMS_${mode==='registration'?'Registration':'R2R'}_Export_${new Date().toISOString().slice(0,10)}.csv`,headers,rows);
}
function enhance(mode){
  if(!allowedRole())return;
  const id=mode==='registration'?'regCsvTools':'r2rCsvTools',root=$(id);
  if(!root||root.dataset.imsAuditCsv==='1')return;
  const api=window.IMSRegistrationCSV;if(!api)return;
  root.dataset.imsAuditCsv='1';
  const title=root.querySelector('.font-semibold');if(title)title.textContent=`${mode==='registration'?'Registration':'R2R Registration'} CSV Import / Export`;
  const note=root.querySelector('.text-\[11px\].text-slate-500');if(note)note.textContent='Manager / Superadmin · Audit-style CSV · UTF-8 · every cell quoted · row 1 is header · one physical IMS item per row, Qty 1.';
  const template=root.querySelector('.imsCsvTemplate'),imp=root.querySelector('.imsCsvImport'),exp=root.querySelector('.imsCsvExport'),input=root.querySelector('.imsCsvFile');
  if(template){template.textContent='Download CSV Template';template.onclick=()=>downloadCsv(mode==='registration'?'IMS_Registration_Template.csv':'IMS_R2R_Registration_Template.csv',mode==='registration'?api.REG_HEADERS:api.R2R_HEADERS);}
  if(exp){exp.textContent='Export CSV';exp.onclick=()=>exportCsv(mode).catch(e=>alert('CSV export failed: '+(e?.message||e)));}
  if(imp&&input){imp.textContent='Import CSV';input.accept='.csv,text/csv';imp.onclick=()=>{input.value='';input.click();};}
}
function install(){enhance('registration');enhance('r2r');}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(install,25);}).observe(document.body,{childList:true,subtree:true});
['ims:registration-csv-ready','ims:registration-ready','ims:renttorent-ready','ims:workspace-rendered','ims:modules-ready'].forEach(n=>window.addEventListener(n,install));
install();
window.IMSRegistrationAuditCSV=Object.freeze({install,exportCsv,downloadCsv});
window.dispatchEvent(new CustomEvent('ims:registration-audit-csv-ready'));
export{install,exportCsv,downloadCsv};