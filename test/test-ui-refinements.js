function replaceDirectText(el,from,to){
  if(!el)return;
  for(const node of el.childNodes){
    if(node.nodeType!==Node.TEXT_NODE)continue;
    if(node.textContent.includes(from))node.textContent=node.textContent.replaceAll(from,to);
  }
}

function refineRegistration(){
  const form=document.getElementById('registerForm');
  if(!form||form.dataset.testRefined==='1')return;
  form.dataset.testRefined='1';

  const name=document.getElementById('regName');
  const nameLabel=name?.closest('label');
  replaceDirectText(nameLabel,'Item Name','Description');
  if(nameLabel)nameLabel.style.gridColumn='span 2';

  const alias=document.getElementById('regAliases');
  const aliasLabel=alias?.closest('label');
  replaceDirectText(aliasLabel,'Alias','Wellora SN');
  if(alias)alias.placeholder='One Wellora SN per unit';

  const sn=document.getElementById('regSN');
  const snLabel=sn?.closest('label');
  if(snLabel)snLabel.style.display='none';
  if(sn){sn.required=false;sn.value='';}

  const coc=document.getElementById('regCOC');
  replaceDirectText(coc?.closest('label'),'COC','COC / Mill No');
  if(coc)coc.placeholder='One COC / Mill No per unit if used';

  const po=document.getElementById('regPO');
  const poLabel=po?.closest('label');
  replaceDirectText(poLabel,'Our PO Number','Wellora PO');
  replaceDirectText(poLabel,'Our PO','Wellora PO');

  form.querySelectorAll('*').forEach(el=>{
    for(const node of el.childNodes){
      if(node.nodeType!==Node.TEXT_NODE)continue;
      node.textContent=node.textContent
        .replaceAll('Alias/SN/COC','Wellora SN / COC / Mill No')
        .replaceAll('Alias/SN','Wellora SN')
        .replaceAll('Alias','Wellora SN')
        .replaceAll('Our PO Number','Wellora PO');
    }
  });
}

refineRegistration();
new MutationObserver(()=>refineRegistration()).observe(document.body,{childList:true,subtree:true});