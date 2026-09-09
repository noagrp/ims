import {db} from './firebase-config.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import {can} from './ims-permissions.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const meta=(label,value)=>value===undefined||value===null||value===''?'':`<div class="min-w-0"><span class="text-[9px] uppercase tracking-wide text-slate-600">${esc(label)}</span><div class="text-[11px] text-slate-300 break-words">${esc(value)}</div></div>`;
const cardIdentity=m=>`<div class="min-w-0"><div class="font-semibold text-sm"><span class="text-cyan-300">${esc(m.itemAlias||m.itemCode||'No Alias')}</span>${m.itemNameSnapshot||m.itemName?` · <span class="text-slate-100">${esc(m.itemNameSnapshot||m.itemName)}</span>`:''}</div>${m.itemCode?`<div class="font-mono text-[9px] text-slate-600 mt-0.5">IMS Item ID: ${esc(m.itemCode)}</div>`:''}</div>`;
const actionLabel=kind=>kind==='incoming'?'Arrive':kind==='warehouse'?'Return to Supplier':'Arrive';
const statusLabel=kind=>kind==='warehouse'?'Available':'In Transit';
const canAct=kind=>kind==='incoming'||kind==='returning'?can('renttorent.edit'):can('renttorent.edit');

async function openItem(itemId){if(!itemId)return;return window.IMSAlphaUsability?.openItemDetail?window.IMSAlphaUsability.openItemDetail(itemId):window.IMSItems?.showItem?window.IMSItems.showItem(itemId):window.openItem?.(itemId);}
async function runSingle(kind,movementId){const check=document.querySelector(`#${kind}List input.${kind}Pick[value="${CSS.escape(movementId)}"]`);if(!check)return;document.querySelectorAll(`#${kind}List input.${kind}Pick`).forEach(x=>x.checked=false);check.checked=true;const api=window.IMSRentToRent;if(kind==='incoming')return api?.arriveIncoming?.();if(kind==='warehouse')return api?.startReturn?.();return api?.arriveOwner?.();}
function normalizeSection(kind){const mount=document.getElementById(`${kind}List`);const section=mount?.closest('section');if(!section)return;const h=section.querySelector('h2');const batch=document.getElementById(`${kind}Action`);if(kind==='incoming'){if(h)h.textContent='R2R Supplier → Warehouse · In Transit';if(batch)batch.textContent='Arrive Selected';}
if(kind==='warehouse'){if(h)h.textContent='R2R in Warehouse';if(batch)batch.textContent='Return Selected to Supplier';}
if(kind==='returning'){if(h)h.textContent='R2R Warehouse → Supplier · In Transit';if(batch)batch.textContent='Arrive Selected at Supplier';}}
async function decorateCard(label,kind){if(label.dataset.imsR2RCard==='1')return;const pick=label.querySelector(`input.${kind}Pick`);if(!pick?.value)return;label.dataset.imsR2RCard='1';try{const snap=await getDoc(doc(db,'movements',pick.value));if(!snap.exists())return;const m={id:snap.id,...snap.data()};const ref=m.referenceNumber||m.ourPONumber||'';const from=m.fromName||'';const to=m.toName||'';label.className='block bg-slate-950 border border-slate-800 rounded-xl p-3';label.innerHTML=`<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div class="min-w-0 flex-1"><div class="flex items-start gap-3"><input type="checkbox" class="${kind}Pick mt-1 shrink-0" value="${esc(m.id)}"><button type="button" class="imsR2ROpen text-left min-w-0 flex-1" data-item="${esc(m.itemId||'')}">${cardIdentity(m)}<div class="grid sm:grid-cols-2 lg:grid-cols-6 gap-2 mt-2">${meta('Reference',`Our PO ${ref}`.trim())}${meta('From',from)}${meta('To',to)}${meta('Qty',`${Number(m.qty||1)} ${m.unit||''}`.trim())}${meta('Ownership','R2R / Third-Party')}${meta('Status',statusLabel(kind))}</div><div class="font-mono text-[9px] text-slate-700 mt-2">Movement ${esc(m.movementId||m.id)}</div></button></div></div>${canAct(kind)?`<button type="button" class="imsR2RSingle shrink-0 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-xs font-bold" data-kind="${kind}" data-id="${esc(m.id)}">${actionLabel(kind)}</button>`:''}</div>`;
label.querySelector('.imsR2ROpen')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openItem(e.currentTarget.dataset.item).catch(console.error);});
label.querySelector('.imsR2RSingle')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();runSingle(e.currentTarget.dataset.kind,e.currentTarget.dataset.id).catch(err=>alert(err?.message||err));});
}catch(e){console.warn('R2R card normalization failed:',e);}}
async function decorateKind(kind){normalizeSection(kind);const mount=document.getElementById(`${kind}List`);if(!mount)return;const labels=[...mount.querySelectorAll(':scope > label')];await Promise.all(labels.map(x=>decorateCard(x,kind)));}
async function refresh(){await Promise.all(['incoming','warehouse','returning'].map(decorateKind));}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>refresh().catch(console.error),60);}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('ims:renttorent-ready',()=>setTimeout(()=>refresh().catch(console.error),50));
refresh().catch(console.error);
window.IMSR2ROpCards=Object.freeze({refresh});
window.dispatchEvent(new CustomEvent('ims:r2r-op-cards-ready'));
export{refresh};