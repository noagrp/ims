(()=>{
  const text=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const labelFor=id=>document.getElementById(id)?.closest('label');
  function replaceLabel(id,from,to){const l=labelFor(id);if(!l)return;for(const n of l.childNodes){if(n.nodeType===Node.TEXT_NODE&&n.nodeValue?.trim()===from){n.nodeValue=n.nodeValue.replace(from,to);break;}}}
  function patch(){
    document.querySelectorAll('#batchMoveForm .text-slate-500,#batchMoveForm [class*="text-slate-500"],#serviceCycleWorkflow .text-slate-500,#serviceCycleWorkflow [class*="text-slate-500"]').forEach(el=>{if(el.childElementCount===0&&el.textContent.trim()==='Wellora SN')text(el,'Wellora SN / R2R SN');});
    document.querySelectorAll('#bmItemPicker option,#scPick option').forEach(o=>{if(o.textContent.includes('No Wellora SN'))o.textContent=o.textContent.replace('No Wellora SN','No Wellora SN / R2R SN');});
    document.querySelectorAll('.resItem').forEach(s=>{const l=s.closest('label');if(l){for(const n of l.childNodes){if(n.nodeType===Node.TEXT_NODE&&/Alias\s*\/\s*Item/.test(n.nodeValue||''))n.nodeValue=(n.nodeValue||'').replace(/Alias\s*\/\s*Item/,'Wellora SN / R2R SN — Description');}}});
    replaceLabel('incItem','Item','Wellora SN / R2R SN — Description');
    replaceLabel('dispItem','Item','Wellora SN / R2R SN — Description');
    const rec=document.getElementById('imsRecordsModule');
    if(rec){
      rec.querySelectorAll('.rmSort').forEach(b=>{const field=b.dataset.field;if(field==='itemCode'){b.dataset.label='IMS Item ID';b.textContent='IMS Item ID'+(b.textContent.includes('↑')?' ↑':b.textContent.includes('↓')?' ↓':'');}if(field==='item'){b.dataset.label='Description';b.textContent='Description'+(b.textContent.includes('↑')?' ↑':b.textContent.includes('↓')?' ↓':'');}});
      const type=document.getElementById('rmFilterType');if(type){[...type.options].forEach(o=>{if(o.value==='itemCode')o.textContent='IMS Item ID';});}
      const val=document.getElementById('rmFilterValue');if(val&&val.placeholder==='Exact item code')val.placeholder='Exact IMS Item ID';
    }
    document.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='Edit Item Name')text(b,'Edit Description');});
  }
  function recordsRows(){const body=document.getElementById('rmBody');if(!body)return[];return[...body.querySelectorAll('tr')].map(tr=>{const c=[...tr.querySelectorAll('td')].map(td=>td.textContent.trim());if(c.length<14)return null;return{Date:c[0],Activity:c[1],'IMS Item ID':c[2],Description:c[3],Status:c[4],From:c[5],To:c[6],Qty:c[7],Unit:c[8],Client:c[9],Supplier:c[10],Invoice:c[11],User:c[12],Remark:c[13]};}).filter(Boolean);}
  function exportRecords(kind){const rows=recordsRows();if(!rows.length)return alert('No rows on this page.');if(typeof XLSX==='undefined')return alert('Excel library unavailable.');if(kind==='excel'){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Logs');XLSX.writeFile(wb,'IMS_Logs.xlsx');return;}const ws=XLSX.utils.json_to_sheet(rows),csv=XLSX.utils.sheet_to_csv(ws),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='IMS_Logs.csv';a.click();URL.revokeObjectURL(a.href);}
  document.addEventListener('click',e=>{const b=e.target.closest?.('#rmExcel,#rmCsv');if(!b)return;e.preventDefault();e.stopImmediatePropagation();exportRecords(b.id==='rmExcel'?'excel':'csv');},true);
  let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(patch,20);}).observe(document.body,{childList:true,subtree:true,characterData:true});
  patch();
})();