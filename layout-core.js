(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;
  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* IMS GLOBAL LAYOUT STANDARD
       - Main working area and major containers use full available width.
       - Major sections stack vertically, top to bottom.
       - Short fields/controls may share a row inside a full-width container.
       - Internal field rows wrap naturally on narrower screens.
       - Wide tables/data scroll horizontally inside their own container. */

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

    /* Major module/section containers stay vertically stacked. */
    #appContent>.grid,
    #appContent>[data-ims-workspace-module]>.grid:not(.ims-field-grid),
    #appContent>[data-ims-module]>.grid:not(.ims-field-grid){
      grid-template-columns:minmax(0,1fr)!important;
    }

    /* Internal grids are intentionally NOT globally collapsed.
       Existing sm/md/lg/xl grid classes may arrange short fields in rows. */
    #appContent .ims-field-grid{
      width:100%;
      min-width:0;
    }

    #appContent input,
    #appContent select,
    #appContent textarea{
      min-width:0;
      box-sizing:border-box;
    }

    /* Wide data stays wide and scrolls within its full-width container. */
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
