const $=id=>document.getElementById(id);
const cls='w-full min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';

const INVENTORY_FILTERS=[
  ['','Filter By'],
  ['category','Category'],
  ['type','Type'],
  ['supplierName','Supplier'],
  ['ownerBusinessName','R2R Owner'],
  ['currentLocation','Location / Client'],
  ['ownershipType','Ownership'],
  ['status','Status']
];

function refineTopInventorySearch(){const select=$('stockSearchField');if(!select||select.dataset.imsIdentityOnly==='1')return;select.dataset.imsIdentityOnly='1';select.innerHTML='<option value="alias">Wellora SN / R2R SN</option><option value="itemCode">IMS Item ID</option>';}

function refineInventoryFilter(){const old=$('stockFilter');if(!old||old.dataset.imsGeneralFilter==='1')return;
  const parent=old.parentElement;if(!parent)return;
  old.dataset.imsGeneralFilter='1';old.hidden=true;
  const wrap=document.createElement('div');wrap.className='grid md:grid-cols-[190px_minmax(0,1fr)_auto] gap-2';wrap.id='imsGeneralStockFilter';
  wrap.innerHTML=`<select id="imsStockFilterField" class="${cls}">${INVENTORY_FILTERS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><input id="imsStockFilterValue" class="${cls}" placeholder="Type filter value" disabled><button id="imsStockFilterApply" type="button" class="bg-cyan-700 hover:bg-cyan-600 px-4 py-2.5 rounded-lg text-xs font-bold">Apply Filter</button>`;
  parent.before(wrap);
  const field=$('imsStockFilterField'),value=$('imsStockFilterValue'),apply=$('imsStockFilterApply');
  const sync=()=>{value.disabled=!field.value;value.value='';value.placeholder=field.value==='ownershipType'?'owned or third_party':field.value?'Type exact filter value':'Choose a general filter';};
  const run=()=>{if(!field.value)return $('stockClearFilters')?.click();const v=value.value.trim();if(!v)return alert('Enter the filter value.');const wanted=`${field.value}|${v}`,option=[...old.options].find(o=>o.value===wanted)||[...old.options].find(o=>String(o.value).toLowerCase()===wanted.toLowerCase());if(!option)return alert(`No matching ${field.selectedOptions[0]?.textContent||'filter'} value found.`);old.value=option.value;old.dispatchEvent(new Event('change',{bubbles:true}));};
  field.onchange=sync;value.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run();}};apply.onclick=run;sync();
}

function refineLogFilter(){const select=$('rmFilterType');if(!select||select.dataset.imsSimpleFilter==='1')return;select.dataset.imsSimpleFilter='1';
  select.innerHTML='<option value="">All Records</option><option value="supplierName">Supplier</option><option value="clientName">Client</option>';
  const value=$('rmFilterValue');if(value){value.value='';value.disabled=true;value.placeholder='Select Supplier or Client';}
}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{refineTopInventorySearch();refineInventoryFilter();refineLogFilter();},40);}).observe(document.body,{childList:true,subtree:true});
refineTopInventorySearch();refineInventoryFilter();refineLogFilter();
window.IMSFilterRefinement=Object.freeze({refineTopInventorySearch,refineInventoryFilter,refineLogFilter});
