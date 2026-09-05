const $=id=>document.getElementById(id);

function refine(){
  const input=$('stockSearch');
  const button=$('stockSearchBtn');
  if(!input||!button)return;

  const field=$('stockSearchField');
  if(field){field.value='alias';field.remove();}

  const searchRow=input.parentElement;
  if(searchRow){
    searchRow.className='grid md:grid-cols-[minmax(0,1fr)_auto] gap-2';
    input.placeholder='Wellora SN / R2R SN';
    button.textContent='Search';
  }

  const filter=$('stockFilter');
  if(filter?.parentElement)filter.parentElement.remove();
  const clear=$('stockClearFilters');
  if(clear?.parentElement)clear.parentElement.remove();

  const section=input.closest('section');
  if(section){
    [...section.children].forEach(el=>{
      const t=(el.textContent||'').trim();
      if(t.includes('Exact search or one server-side filter at a time')){
        el.innerHTML='<div class="text-sm font-bold">Find Inventory</div><div class="text-[10px] text-slate-500">Search Wellora SN / R2R SN. Firestore returns only matching server-paginated records.</div>';
      }else if(t.includes('Search and filter are single-field server queries')){
        el.remove();
      }
    });
  }
}

let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refine,20);}).observe(document.body,{childList:true,subtree:true});
refine();
window.IMSInventorySearchUI=Object.freeze({refine});
window.dispatchEvent(new CustomEvent('ims:inventory-search-ui-ready'));
