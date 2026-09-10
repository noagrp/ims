const STAR='<span class="ims-required-star text-red-400"> *</span>';

const REQUIRED_IDS=new Set([
  'r2rType','r2rQty','r2rUnit','r2rName','r2rAliases','r2rCategory','r2rSupplier','r2rPO','r2rWarehouse',
  'resLocation','resClient',
  'bmAction','bmSource','bmDestination',
  'scType','scSrcType','scSrc','scMode','scNo','scDate','scEndG','scEndDate','scRetG','scDstType','scDst',
  'incLookupValue','incType','incDate','dispLookupValue','dispType','dispDate',
  'docInvNo','docInvDate','docInvAmount'
]);

const REQUIRED_CLASSES=['resLookupValue','resQty','bmQty'];

const BUTTON_REQUIREMENTS={
  resSave:['#resLocation','#resClient','.resRow .resLookupValue','.resRow .resQty'],
  incSave:['#incLookupValue','#incDate'],
  dispSave:['#dispLookupValue','#dispDate'],
  scStart:['#scSrc','#scNo','#scDate'],
  scEnd:['#scEndG','#scEndDate'],
  scReturn:['#scRetG','#scDst'],
  attachInvoice:['#docInvNo','#docInvDate','#docInvAmount']
};

function labelFor(el){return el.closest('label')||document.querySelector(`label[for="${CSS.escape(el.id||'')}"]`);}
function markLabel(el){const label=labelFor(el);if(!label||label.querySelector('.ims-required-star'))return;const firstText=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(firstText){const span=document.createElement('span');span.className='ims-required-star text-red-400';span.textContent=' *';firstText.after(span);return;}label.insertAdjacentHTML('afterbegin',STAR);}
function clearRequired(el){if(!el)return;el.required=false;el.removeAttribute('aria-required');}
function requireEl(el){if(!el||el.disabled)return;el.required=true;el.setAttribute('aria-required','true');markLabel(el);}
function syncServiceProvider(){const mode=document.getElementById('scMode'),provider=document.getElementById('scProv');if(!provider)return;if(mode?.value==='Sent To')requireEl(provider);else clearRequired(provider);}
function syncMovementReference(){const mode=document.getElementById('bmGroupMode'),reference=document.getElementById('bmReference'),existing=document.getElementById('bmExistingGroup');if(!mode)return;if(mode.value==='existing'){clearRequired(reference);requireEl(existing);}else{clearRequired(existing);requireEl(reference);}}
function syncConditional(){syncServiceProvider();syncMovementReference();}
function apply(){for(const id of REQUIRED_IDS){const el=document.getElementById(id);if(el)requireEl(el);}for(const cls of REQUIRED_CLASSES)document.querySelectorAll(`.${cls}`).forEach(requireEl);syncConditional();}
function invalidElement(selectors){for(const selector of selectors){const els=[...document.querySelectorAll(selector)];if(!els.length)continue;for(const el of els){if(el.disabled)continue;if(el.matches('input,select,textarea')&&(!String(el.value||'').trim()||!el.checkValidity()))return el;}}return null;}
function validateButton(button){const selectors=BUTTON_REQUIREMENTS[button.id];if(!selectors)return true;const bad=invalidElement(selectors);if(!bad)return true;bad.reportValidity?.();bad.focus?.();return false;}

document.addEventListener('change',e=>{if(e.target?.id==='scMode'||e.target?.id==='bmGroupMode')syncConditional();},true);
document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(!button||!BUTTON_REQUIREMENTS[button.id])return;if(!validateButton(button)){e.preventDefault();e.stopImmediatePropagation();}},true);

let timer;
const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,20);});
observer.observe(document.documentElement,{childList:true,subtree:true});
apply();

window.IMSRequiredFields=Object.freeze({apply});
