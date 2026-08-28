(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;
  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    main>div.max-w-7xl{max-width:none!important;width:100%!important}
    #appContent>.grid:has(>section){grid-template-columns:minmax(0,1fr)!important}
    #appContent>.grid:has(>section)>section{width:100%;min-width:0}
    @media print{aside,#navTabs,button:not(.print-keep){display:none!important}main{padding:0!important}body{background:#fff!important;color:#000!important}section{box-shadow:none!important;border-color:#bbb!important}}
  `;
  document.head.appendChild(s);
  const clean=()=>{
    if(document.getElementById('pageTitle')?.textContent.trim()==='Main Workspace'){
      const cards=[...document.querySelectorAll('#appContent .statLog')];
      if(cards.length){const wrap=cards[0].parentElement;if(wrap&&cards.every(x=>x.parentElement===wrap))wrap.remove();else cards.forEach(x=>x.remove());}
      document.querySelectorAll('#registerForm #trackingType').forEach(x=>x.closest('label')?.remove());
    }
  };
  let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(clean,20)}).observe(document.body,{childList:true,subtree:true});clean();
})();
