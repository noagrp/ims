(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;
  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* IMS GLOBAL LAYOUT STANDARD
       1. Every major section/container uses the full available content width.
       2. Major containers stack vertically: never left/right peer containers.
       3. Fields INSIDE a container pack horizontally into sensible rows.
       4. Field rows wrap naturally as device width becomes smaller.
       5. Wide tables/data scroll horizontally inside their full-width container. */

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

    /* Major content groups stack one below another. */
    #appContent>.grid,
    #workspaceOperation>.grid,
    #workspaceOperation>.space-y-5>.grid{
      grid-template-columns:minmax(0,1fr)!important;
    }

    /* Existing internal field grids stay compact and responsive. */
    #appContent .ims-field-grid,
    #appContent form .grid{
      width:100%;
      min-width:0;
    }

    /* Forms that use full-width SECTION containers but direct field labels
       automatically pack those fields into rows. This is the site-wide form
       behavior: full-width container, compact fields inside. */
    #appContent form>section,
    #appContent form section[data-ims-field-section]{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
      gap:.75rem;
      align-items:end;
    }

    /* Section headings/messages span the complete container width. */
    #appContent form>section>div:first-child:not([id]),
    #appContent form section[data-ims-field-section]>div:first-child:not([id]){
      grid-column:1/-1;
    }

    /* Explicit mount/wrapper rows may consume available width where needed. */
    #appContent form>section>[id$="Wrap"],
    #appContent form>section>[id$="Mount"],
    #appContent form>section>.w-full{
      min-width:0;
    }

    #appContent input,
    #appContent select,
    #appContent textarea{
      width:100%;
      min-width:0;
      box-sizing:border-box;
    }

    #appContent .overflow-x-auto{
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
      #appContent form section[data-ims-field-section]{
        grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
      }
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
