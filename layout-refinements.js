(()=>{
  function addCss(){
    if(document.getElementById('imsLayoutRefineCss'))return;
    const s=document.createElement('style');s.id='imsLayoutRefineCss';
    s.textContent=`
      /* Stock Overview: two rows on wide screens instead of eight crowded columns. */
      #imsStockSearch,#imsStockCategory,#imsStockBrand,#imsStockModel,#imsStockSpec,#imsStockStatus,#imsStockLocation,#imsStockClient{min-width:0}
      @media (min-width:1280px){
        #imsStockSearch{grid-column:auto}
        #imsStockSearch,#imsStockCategory,#imsStockBrand,#imsStockModel,#imsStockSpec,#imsStockStatus,#imsStockLocation,#imsStockClient{width:100%}
        #imsStockSearch:where(input),#imsStockCategory:where(select),#imsStockBrand:where(select),#imsStockModel:where(select),#imsStockSpec:where(select),#imsStockStatus:where(select),#imsStockLocation:where(select),#imsStockClient:where(select){min-width:0}
        #imsStockSearch{ }
      }
      /* Core Logs filter grid: keep fields compact; no tall multi-select boxes. */
      #logStatus,#logItems,#logSuppliers,#logClients{height:42px!important;min-height:42px!important}
    `;
    document.head.appendChild(s);
  }

  function refineStockGrid(){
    const search=document.getElementById('imsStockSearch');if(!search)return;
    const grid=search.parentElement;if(!grid||grid.dataset.imsTwoRows==='1')return;
    grid.dataset.imsTwoRows='1';
    grid.className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2';
  }

  function refineLogs(){
    const title=document.getElementById('pageTitle')?.textContent||'';
    if(!/Logs \/ Records/i.test(title))return;
    const ids=['logStatus','logItems','logSuppliers','logClients'];
    ids.forEach(id=>{
      const e=document.getElementById(id);if(!e||e.dataset.imsSingleLine==='1')return;
      e.dataset.imsSingleLine='1';
      e.multiple=false;
      e.removeAttribute('multiple');
      e.classList.remove('h-28');
      e.size=1;
    });
    const search=document.getElementById('logSearch');
    const grid=search?.closest('.grid');
    if(grid&&grid.dataset.imsLogGridRefined!=='1'){
      grid.dataset.imsLogGridRefined='1';
      grid.className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2';
    }
  }

  function run(){addCss();refineStockGrid();refineLogs();}
  let timer;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,20);}).observe(document.body,{childList:true,subtree:true});
  run();
})();
