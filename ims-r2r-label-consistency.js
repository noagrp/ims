const LABELS=new Map([
  ['R2R Warehouse to Owner','R2R Warehouse to Supplier'],
  ['R2R Warehouse to Owner Transit','R2R Warehouse to Supplier Transit'],
  ['R2R Movement Arrived at Owner','R2R Movement Arrived at Supplier'],
  ['Return to Owner · In Transit','Return to Supplier · In Transit'],
  ['Arrive Selected at Owner','Arrive Selected at Supplier']
]);

function normalizeTextNode(node){
  if(node.nodeType!==Node.TEXT_NODE)return;
  const raw=node.nodeValue||'',trim=raw.trim(),replacement=LABELS.get(trim);
  if(!replacement)return;
  node.nodeValue=raw.replace(trim,replacement);
}

function normalize(root=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;while((node=walker.nextNode()))normalizeTextNode(node);
}

let timer;
new MutationObserver(mutations=>{
  clearTimeout(timer);
  timer=setTimeout(()=>{
    for(const m of mutations)for(const n of m.addedNodes){
      if(n.nodeType===Node.TEXT_NODE)normalizeTextNode(n);
      else if(n.nodeType===Node.ELEMENT_NODE)normalize(n);
    }
  },25);
}).observe(document.body,{childList:true,subtree:true});

normalize();
window.IMSR2RLabelConsistency=Object.freeze({normalize});
window.dispatchEvent(new CustomEvent('ims:r2r-label-consistency-ready'));
export{normalize};