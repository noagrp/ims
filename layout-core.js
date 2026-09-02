(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;
  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* IMS GLOBAL LAYOUT STANDARD
       - Main working area always uses full available width.
       - Containers and form/control grids stack vertically on every device.
       - Wide tabular/data content scrolls horizontally inside its own container.
       - Individual modules must not create separate PC/mobile left-right layouts. */

    main>div.max-w-7xl{
      max-width:none!important;
      width:100%!important;
      min-width:0!important;
    }

    #appContent{
      width:100%!important;
      min-width:0!important;
    }

    #appContent>*,
    #appContent section,
    #appContent form{
      width:100%;
      min-width:0;
      box-sizing:border-box;
    }

    /* One universal content flow: up/down, never desktop-only left/right. */
    #appContent .grid{
      grid-template-columns:minmax(0,1fr)!important;
    }

    /* Wide data stays wide and is scrolled inside its container. */
    #appContent .overflow-x-auto{
      width:100%;
      max-width:100%;
      overflow-x:auto!important;
      overflow-y:visible;
      -webkit-overflow-scrolling:touch;
    }

    #appContent table{
      max-width:none;
    }

    @media(max-width:639px){
      main{padding-left:.75rem!important;padding-right:.75rem!important}
      #appContent section{padding-left:1rem;padding-right:1rem}
    }

    @media print{
      aside,#navTabs,button:not(.print-keep){display:none!important}
      main{padding:0!important}
      body{background:#fff!important;color:#000!important}
      section{box-shadow:none!important;border-color:#bbb!important}
      #appContent .overflow-x-auto{overflow:visible!important}
    }
  `;
  document.head.appendChild(s);

  const clean=()=>{
    if(document.getElementById('pageTitle')?.textContent.trim()==='Main Workspace'){
      const cards=[...document.querySelectorAll('#appContent .statLog')];
      if(cards.length){
        const wrap=cards[0].parentElement;
        if(wrap&&cards.every(x=>x.parentElement===wrap))wrap.remove();
        else cards.forEach(x=>x.remove());
      }
      document.querySelectorAll('#registerForm #trackingType').forEach(x=>x.closest('label')?.remove());
    }
  };

  let t;
  new MutationObserver(()=>{
    clearTimeout(t);
    t=setTimeout(clean,20);
  }).observe(document.body,{childList:true,subtree:true});
  clean();
})();
