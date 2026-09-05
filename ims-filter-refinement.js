const $=id=>document.getElementById(id);
const inputCls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500';
const state={stock:{q:'',col:-1,dir:1},audit:{q:'',col:-1,dir:1},logs:{q:'',col:-1,dir:1}};

function norm(v){return String(v??'').toLowerCase().trim();}
function numeric(v){const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)?n:null;}
function compare(a,b){const na=numeric(a),nb=numeric(b);if(na!==null&&nb!==null)return na-nb;return String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'});}
function applySearch(key,tbody){const q=norm(state[key].q);if(!tbody)return;[...tbody.rows].forEach(r=>{r.hidden=Boolean(q)&&!norm(r.textContent).includes(q);});}
function sortBody(key,tbody,col){if(!tbody)return;const s=state[key];s.dir=s.col===col?-s.dir:1;s.col=col;const rows=[...tbody.rows].filter(r=>r.cells.length>1);rows.sort((a,b)=>compare(a.cells[col]?.textContent,b.cells[col]?.textContent)*s.dir).forEach(r=>tbody.appendChild(r));applySearch(key,tbody);}
function makeHeadersSortable(key,table,skipFirst=false){if(!table||table.dataset.imsFreeSort==='1')return;table.dataset.imsFreeSort='1';const cells=[...(table.tHead?.rows?.[0]?.cells||[])];cells.forEach((th,i)=>{if(skipFirst&&i===0)return;th.style.cursor='pointer';th.title='Click to sort';th.addEventListener('click',e=>{if(e.target.closest('input,button,a'))return;e.preventDefault();e.stopImmediatePropagation();sortBody(key,table.tBodies[0],i);},true);});}
function addSearch(key,host,placeholder){if(!host)return null;let input=host.querySelector(`[data-ims-free-search="${key}"]`);if(input)return input;input=document.createElement('input');input.type='search';input.className=inputCls;input.placeholder=placeholder;input.dataset.imsFreeSearch=key;input.value=state[key].q;input.addEventListener('input',()=>{state[key].q=input.value;const table=key==='stock'?document.querySelector('#stockTable table'):key==='audit'?document.querySelector('#imsAuditBody')?.closest('table'):document.querySelector('#rmBody')?.closest('table');applySearch(key,table?.tBodies?.[0]);});host.prepend(input);return input;}

function refineStock(){const search=$('stockSearch');const table=document.querySelector('#stockTable table');if(!search&&!table)return;
  const searchGrid=search?.parentElement;if(searchGrid&&searchGrid.dataset.imsFreeToolbar!=='1'){
    searchGrid.dataset.imsFreeToolbar='1';searchGrid.innerHTML='';addSearch('stock',searchGrid,'Search this inventory page...');
    searchGrid.className='grid grid-cols-1 gap-2';
  }
  const oldFilter=$('stockFilter');if(oldFilter){const row=oldFilter.parentElement;row?.remove();}
  $('imsGeneralStockFilter')?.remove();
  const clear=$('stockClearFilters');clear?.parentElement?.remove();
  if(table){makeHeadersSortable('stock',table,false);applySearch('stock',table.tBodies[0]);}
}

function refineAudit(){const role=$('imsAuditRole');const body=$('imsAuditBody');const table=body?.closest('table');if(!role&&!table)return;
  const card=role?.closest('section');if(card&&card.dataset.imsFreeToolbar!=='1'){
    card.dataset.imsFreeToolbar='1';
    const exports=[...card.querySelectorAll('#imsAuditExport,#imsAuditExportSelected')];
    const wrap=document.createElement('div');wrap.className='space-y-3';addSearch('audit',wrap,'Search this audit page...');
    if(exports.length){const btns=document.createElement('div');btns.className='flex flex-wrap gap-2';exports.forEach(b=>btns.appendChild(b));wrap.appendChild(btns);}
    const note=$('imsAuditIndexNote');if(note)wrap.appendChild(note);
    const h=card.querySelector('h2');card.innerHTML='';if(h)card.appendChild(h);card.appendChild(wrap);
  }
  if(table){makeHeadersSortable('audit',table,true);applySearch('audit',table.tBodies[0]);}
}

function refineLogs(){const type=$('rmFilterType');const body=$('rmBody');const table=body?.closest('table');if(!type&&!table)return;
  const section=type?.closest('section');if(section&&section.dataset.imsFreeToolbar!=='1'){
    section.dataset.imsFreeToolbar='1';
    const actions=[...section.querySelectorAll('#rmExcel,#rmCsv,#rmPrint')];
    const note=$('rmIndexNote');
    section.innerHTML='';
    addSearch('logs',section,'Search this logs page...');
    if(actions.length){const btns=document.createElement('div');btns.className='flex flex-wrap gap-2 mt-3';actions.forEach(b=>btns.appendChild(b));section.appendChild(btns);}
    if(note)section.appendChild(note);
  }
  if(table){makeHeadersSortable('logs',table,false);applySearch('logs',table.tBodies[0]);}
}

function refineAll(){refineStock();refineAudit();refineLogs();}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refineAll,35);}).observe(document.body,{childList:true,subtree:true});
refineAll();
window.IMSFilterRefinement=Object.freeze({refineAll,refineStock,refineAudit,refineLogs});
