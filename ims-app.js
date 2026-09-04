import 'https://cdn.jsdelivr.net/gh/noagrp/ims@52f1f153acc56c00a9ad026434ac51039e579af0/ims-app.js';

function relabelWelloraPO(root=document){
  root.querySelectorAll?.('label, span, div').forEach(el=>{
    for(const node of el.childNodes){
      if(node.nodeType!==Node.TEXT_NODE)continue;
      const text=node.textContent.trim();
      if(text==='Our PO'||text==='Our PO Number')node.textContent=node.textContent.replace(/Our PO(?: Number)?/g,'Wellora PO');
    }
  });
}

relabelWelloraPO();
new MutationObserver(mutations=>{
  for(const mutation of mutations){
    mutation.addedNodes.forEach(node=>{
      if(node.nodeType===Node.ELEMENT_NODE)relabelWelloraPO(node);
    });
  }
}).observe(document.body,{childList:true,subtree:true});