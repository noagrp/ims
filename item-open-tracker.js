(()=>{
  function wrapOpenItem(){
    const fn=window.openItem;
    if(typeof fn!=='function'||fn.__imsTracked)return;
    const wrapped=function(id,...args){window.__imsLastOpenedItemId=id;return fn.call(this,id,...args);};
    wrapped.__imsTracked=true;
    window.openItem=wrapped;
  }
  let t;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(wrapOpenItem,20);}).observe(document.body,{childList:true,subtree:true});
  wrapOpenItem();
})();
