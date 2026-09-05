const $=id=>document.getElementById(id);
const INPUT='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500';
const state={stock:'',audit:'',logs:''};

function norm(v){return String(v??'').toLowerCase().trim();}
function value(cell){const s=(cell?.innerText||'').trim();const n=Number(s.replace(/[^0-9.-]/g,''));if(s&&Number.isFinite(n)&&/^[\sA-Z$RM]*-?[0-9,.]+(?:\s*[A-Za-z]*)?$/i.test(s))return{type:'n',v:n};const d=Date.parse(s);if(s&&Number.isFinite(d)&&(/[0-9]{4}[-/][0-9]{1,2}/.test(s)||/[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}/.test(s)))return{type:'n',v:d};return{type:'s',v:s.toLowerCase()};}
function tableFor(key){return key==='stock'?document.querySelector('#stockTable table'):key==='audit'?$('imsAuditBody')?.closest('table'):$('rmBody')?.closest('table');}
function applySearch(key){const table=tableFor(key),q=norm(state[key]);if(!table?.tBodies?.[0])return;[...table.tBodies[0].rows].forEach(r=>{r.hidden=Boolean(q)&&!norm(r.textContent).includes(q);});}
function addSearch(key,host,placeholder){if(!host)return;let input=host.querySelector(`[data-ims-search="${key}"]`);if(!input){input=document.createElement('input');input.type='search';input.className=INPUT;input.placeholder=placeholder;input.dataset.imsSearch=key;input.addEventListener('input',()=>{state[key]=input.value;applySearch(key);});host.prepend(input);}input.value=state[key];}
function installSort(key,table,skipFirst=false){if(!table||table.dataset.imsTableUiSort==='1')return;table.dataset.imsTableUiSort='1';table.dataset.imsSortable='1';const heads=[...(table.tHead?.rows?.[0]?.cells||[])];heads.forEach((th,index)=>{if((skipFirst&&index===0)||th.querySelector('input,select')||!th.textContent.trim())return;th.style.cursor='pointer';th.title='Sort ascending / descending';let mark=th.querySelector('.imsTableUiSortMark');if(!mark){mark=document.createElement('span');mark.className='imsTableUiSortMark text-slate-600';mark.textContent=' ↕';th.appendChild(mark);}th.addEventListener('click',e=>{if(e.target.closest('button,a,input,select'))return;e.preventDefault();e.stopImmediatePropagation();const body=table.tBodies?.[0];if(!body)return;const dir=th.dataset.imsTableUiDir==='asc'?'desc':'asc';heads.forEach(h=>{delete h.dataset.imsTableUiDir;const m=h.querySelector('.imsTableUiSortMark');if(m)m.textContent=' ↕';});th.dataset.imsTableUiDir=dir;mark.textContent=dir==='asc'?' ↑':' ↓';const rows=[...body.rows];rows.sort((a,b)=>{const av=value(a.cells[index]),bv=value(b.cells[index]);let c;if(av.type==='n'&&bv.type==='n')c=av.v-bv.v;else c=String(av.v).localeCompare(String(bv.v),undefined,{numeric:true,sensitivity:'base'});return dir==='asc'?c:-c;});rows.forEach(r=>body.appendChild(r));applySearch(key);},true);});}

function cleanupStock(){const tableMount=$('stockTable');if(!tableMount)return;const section=tableMount.closest('section');if(!section)return;
  const oldSearch=$('stockSearchField')?.parentElement||$('stockSearchBtn')?.parentElement||($('stockSearch')?.dataset.imsSearch?'':$('stockSearch')?.parentElement);if(oldSearch&&oldSearch!==section)oldSearch.remove();
  $('stockFilter')?.parentElement?.remove();$('stockClearFilters')?.parentElement?.remove();$('imsGeneralStockFilter')?.remove();
  [...section.children].forEach(el=>{const t=el.textContent||'';if(t.includes('Exact search or one server-side filter at a time')||t.includes('Search and filter are single-field server queries'))el.remove();});
  let toolbar=section.querySelector('[data-ims-toolbar="stock"]');if(!toolbar){toolbar=document.createElement('div');toolbar.dataset.imsToolbar='stock';toolbar.className='mb-3';tableMount.before(toolbar);}addSearch('stock',toolbar,'Search this inventory page...');
  const table=tableMount.querySelector('table');if(table){table.dataset.imsSortable='1';applySearch('stock');}
}

function cleanupAudit(){const body=$('imsAuditBody');if(!body)return;const table=body.closest('table'),systemSection=table?.closest('section');if(!systemSection)return;const container=systemSection.parentElement;const filterSection=[...(container?.children||[])].find(s=>s.querySelector?.('#imsAuditRole,#imsAuditModuleFilter,#imsAuditFrom,#imsAuditTo'));
  let toolbar=systemSection.querySelector('[data-ims-toolbar="audit"]');if(!toolbar){toolbar=document.createElement('div');toolbar.dataset.imsToolbar='audit';toolbar.className='space-y-3 mb-3';const count=$('imsAuditCount');count?.before(toolbar);}if(filterSection){const exports=[...filterSection.querySelectorAll('#imsAuditExport,#imsAuditExportSelected')],note=filterSection.querySelector('#imsAuditIndexNote');if(exports.length){let buttons=toolbar.querySelector('[data-ims-actions]');if(!buttons){buttons=document.createElement('div');buttons.dataset.imsActions='1';buttons.className='flex flex-wrap gap-2';toolbar.appendChild(buttons);}exports.forEach(b=>buttons.appendChild(b));}if(note)toolbar.appendChild(note);filterSection.remove();}
  addSearch('audit',toolbar,'Search this audit page...');installSort('audit',table,true);applySearch('audit');
}

function cleanupLogs(){const body=$('rmBody');if(!body)return;const table=body.closest('table'),tableSection=table?.closest('section');if(!tableSection)return;const container=tableSection.parentElement;const filterSection=[...(container?.children||[])].find(s=>s.querySelector?.('#rmFilterType,#rmFilterValue,#rmFrom,#rmTo,#rmApply,#rmReset'));
  let toolbar=tableSection.querySelector('[data-ims-toolbar="logs"]');if(!toolbar){toolbar=document.createElement('div');toolbar.dataset.imsToolbar='logs';toolbar.className='space-y-3 mb-3';const count=$('rmCount');count?.before(toolbar);}if(filterSection){const actions=[...filterSection.querySelectorAll('#rmExcel,#rmCsv,#rmPrint')],note=filterSection.querySelector('#rmIndexNote');if(actions.length){let buttons=toolbar.querySelector('[data-ims-actions]');if(!buttons){buttons=document.createElement('div');buttons.dataset.imsActions='1';buttons.className='flex flex-wrap gap-2';toolbar.appendChild(buttons);}actions.forEach(b=>buttons.appendChild(b));}if(note)toolbar.appendChild(note);filterSection.remove();}
  addSearch('logs',toolbar,'Search this logs page...');installSort('logs',table,false);applySearch('logs');
}

function scan(){cleanupStock();cleanupAudit();cleanupLogs();}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,20);}).observe(document.body,{childList:true,subtree:true});scan();
window.IMSTableUI=Object.freeze({scan,cleanupStock,cleanupAudit,cleanupLogs});
window.dispatchEvent(new CustomEvent('ims:table-ui-ready'));
