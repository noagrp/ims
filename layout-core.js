(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;

  const IMS_LAYOUT=Object.freeze({
    version:1,
    majorFlow:'vertical',
    majorWidth:'full',
    fieldFlow:'responsive-row',
    fieldMinWidth:180,
    mobileFieldMinWidth:145,
    wideData:'horizontal-scroll',
    classes:Object.freeze({
      stack:'ims-stack',
      container:'ims-container',
      fields:'ims-field-grid',
      wide:'ims-wide-data'
    })
  });

  window.IMSLayout=IMS_LAYOUT;
  document.documentElement.dataset.imsLayout='full-width-responsive-fields-v1';

  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* =========================================================
       IMS GLOBAL LAYOUT CONTRACT
       =========================================================
       Applies automatically to current and future modules:
       - Major containers: full width, stacked vertically.
       - Fields inside containers: compact responsive rows.
       - Narrow screens: field rows wrap, not alternate layouts.
       - Wide tables/data: horizontal scroll within full-width container.

       Optional semantic classes for future modules:
       .ims-stack       = vertical major-container flow
       .ims-container   = one full-width major container
       .ims-field-grid  = responsive compact field row/grid
       .ims-wide-data   = horizontal-scroll data area
       ========================================================= */

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
    #appContent form,
    #appContent .ims-container{
      width:100%;
      min-width:0;
      box-sizing:border-box;
    }

    /* Major content containers always flow vertically. */
    #appContent>.grid,
    #workspaceOperation>.grid,
    #workspaceOperation>.space-y-5>.grid,
    #appContent .ims-stack{
      grid-template-columns:minmax(0,1fr)!important;
      width:100%;
    }

    /* Compact fields inside a full-width container. */
    #appContent form>section,
    #appContent form section[data-ims-field-section],
    #appContent .ims-field-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(${IMS_LAYOUT.fieldMinWidth}px,1fr));
      gap:.75rem;
      align-items:end;
      width:100%;
      min-width:0;
    }

    /* Existing internal module grids remain available for short field rows.
       Major grids above are the only grids forced to one column. */
    #appContent form .grid{
      width:100%;
      min-width:0;
    }

    /* Section heading/message spans all compact field columns. */
    #appContent form>section>div:first-child:not([id]),
    #appContent form section[data-ims-field-section]>div:first-child:not([id]),
    #appContent .ims-field-grid>[data-ims-field-heading]{
      grid-column:1/-1;
    }

    #appContent input,
    #appContent select,
    #appContent textarea{
      width:100%;
      min-width:0;
      box-sizing:border-box;
    }

    /* Wide data is never squeezed into a different device layout. */
    #appContent .overflow-x-auto,
    #appContent .ims-wide-data{
      width:100%;
      max-width:100%;
      overflow-x:auto!important;
      overflow-y:visible;
      -webkit-overflow-scrolling:touch;
    }

    #appContent table{max-width:none}

    @media(max-width:639px){
      main{padding-left:.75rem!important;padding-right:.75rem!important}
      #appContent section{padding-left:1rem;padding-right:1rem}

      #appContent form>section,
      #appContent form section[data-ims-field-section],
      #appContent .ims-field-grid{
        grid-template-columns:repeat(auto-fit,minmax(${IMS_LAYOUT.mobileFieldMinWidth}px,1fr));
      }
    }

    @media print{
      aside,#navTabs,button:not(.print-keep){display:none!important}
      main{padding:0!important}
      body{background:#fff!important;color:#000!important}
      section{box-shadow:none!important;border-color:#bbb!important}
      #appContent .overflow-x-auto,
      #appContent .ims-wide-data{overflow:visible!important}
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

  window.dispatchEvent(new CustomEvent('ims:layout-ready',{detail:IMS_LAYOUT}));
})();
