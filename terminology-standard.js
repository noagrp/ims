(()=>{
  const text=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const labelFor=id=>document.getElementById(id)?.closest('label');
  function replaceLabel(id,from,to){const l=labelFor(id);if(!l)return;for(const n of l.childNodes){if(n.nodeType===Node.TEXT_NODE&&n.nodeValue?.trim()===from){n.nodeValue=n.nodeValue.replace(from,to);break;}}}
  function patch(){
    // Mixed-stock workflows: ownership-aware identity terminology.
    replaceLabel('bmItemPicker','Item','Item');
    document.querySelectorAll('#batchMoveForm .text-slate-500,#batchMoveForm [class*="text-slate-500"],#serviceCycleWorkflow .text-slate-500,#serviceCycleWorkflow [class*="text-slate-500"]').forEach(el=>{
      if(el.childElementCount===0&&el.textContent.trim()==='Wellora SN')text(el,'Wellora SN / R2R SN');
    });
    document.querySelectorAll('#bmItemPicker option,#scPick option').forEach(o=>{
      if(o.textContent.includes('No Wellora SN'))o.textContent=o.textContent.replace('No Wellora SN','No Wellora SN / R2R SN');
    });

    // Reservation identity selector.
    replaceLabel('resItem','Alias / Item','Wellora SN / R2R SN — Description');
    document.querySelectorAll('.resItem').forEach(s=>{const l=s.closest('label');if(l){for(const n of l.childNodes){if(n.nodeType===Node.TEXT_NODE&&/Alias\s*\/\s*Item/.test(n.nodeValue||''))n.nodeValue=(n.nodeValue||'').replace(/Alias\s*\/\s*Item/,'Wellora SN / R2R SN — Description');}}});

    // Incident and disposition selectors show alias + description; make the label explicit.
    replaceLabel('incItem','Item','Wellora SN / R2R SN — Description');
    replaceLabel('dispItem','Item','Wellora SN / R2R SN — Description');

    // Logs / Records terminology.
    const rec=document.getElementById('imsRecordsModule');
    if(rec){
      rec.querySelectorAll('.rmSort').forEach(b=>{
        const field=b.dataset.field;
        if(field==='itemCode'){b.dataset.label='IMS Item ID';b.textContent='IMS Item ID'+(b.textContent.includes('↑')?' ↑':b.textContent.includes('↓')?' ↓':'');}
        if(field==='item'){b.dataset.label='Description';b.textContent='Description'+(b.textContent.includes('↑')?' ↑':b.textContent.includes('↓')?' ↓':'');}
      });
      const type=document.getElementById('rmFilterType');if(type){[...type.options].forEach(o=>{if(o.value==='itemCode')o.textContent='IMS Item ID';});}
      const val=document.getElementById('rmFilterValue');if(val&&val.placeholder==='Exact item code')val.placeholder='Exact IMS Item ID';
    }

    // Generic legacy visible wording that should no longer appear in current item UI.
    document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='Edit Item Name')text(b,'Edit Description');});
  }
  let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(patch,20);}).observe(document.body,{childList:true,subtree:true,characterData:true});
  patch();
})();