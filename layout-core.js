(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;

  const IMS_LAYOUT=Object.freeze({
    version:2,
    majorFlow:'vertical',
    majorWidth:'full',
    fieldFlow:'responsive-row',
    fieldMinWidth:180,
    mobileFieldMinWidth:145,
    wideData:'horizontal-scroll',
    autoNormalize:true,
    classes:Object.freeze({
      stack:'ims-stack',
      container:'ims-container',
      fields:'ims-field-grid',
      wide:'ims-wide-data',
      autoFields:'ims-auto-field-host',
      fullRow:'ims-full-row'
    })
  });

  window.IMSLayout=IMS_LAYOUT;
  document.documentElement.dataset.imsLayout='full-width-responsive-fields-v2';

  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* =========================================================
       IMS GLOBAL LAYOUT CONTRACT — V2
       =========================================================
       CURRENT + FUTURE MODULES:
       - Major containers use the complete content width.
       - Major containers stack vertically, never as left/right peers.
       - Small fields inside a container pack into responsive rows.
       - Field rows wrap naturally on narrower devices.
       - Structural content remains full-row within a field container.
       - Wide tables/data scroll horizontally inside the container.
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

    /* Major containers: always top-to-bottom. */
    #appContent>.grid,
    #workspaceOperation>.grid,
    #workspaceOperation>.space-y-5>.grid,
    #appContent .ims-stack{
      grid-template-columns:minmax(0,1fr)!important;
      width:100%;
    }

    /* Explicit field grids + automatically detected field hosts. */
    #appContent form>section,
    #appContent form section[data-ims-field-section],
    #appContent .ims-field-grid,
    #appContent .ims-auto-field-host{
      display:grid!important;
      grid-template-columns:repeat(auto-fit,minmax(${IMS_LAYOUT.fieldMinWidth}px,1fr));
      gap:.75rem!important;
      align-items:end;
      width:100%;
      min-width:0;
    }

    /* Structural children stay across the whole field container. */
    #appContent .ims-auto-field-host>.ims-full-row,
    #appContent .ims-field-grid>.ims-full-row,
    #appContent form>section>.ims-full-row{
      grid-column:1/-1!important;
      width:100%;
      min-width:0;
    }

    /* Section headings/messages span the complete field row. */
    #appContent form>section>div:first-child:not([id]),
    #appContent form section[data-ims-field-section]>div:first-child:not([id]),
    #appContent .ims-field-grid>[data-ims-field-heading]{
      grid-column:1/-1;
    }

    /* Existing intentional inner grids remain usable for compact rows. */
    #appContent form .grid{
      width:100%;
      min-width:0;
    }

    #appContent label,
    #appContent input,
    #appContent select,
    #appContent textarea{
      min-width:0;
      box-sizing:border-box;
    }

    #appContent input,
    #appContent select,
    #appContent textarea{
      width:100%;
    }

    /* Textareas are wider fields without forcing one field per line. */
    #appContent .ims-auto-field-host>label:has(textarea),
    #appContent .ims-field-grid>label:has(textarea),
    #appContent form>section>label:has(textarea){
      grid-column:span 2;
    }

    /* Wide data remains structurally identical across devices. */
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
      #appContent .ims-field-grid,
      #appContent .ims-auto-field-host{
        grid-template-columns:repeat(auto-fit,minmax(${IMS_LAYOUT.mobileFieldMinWidth}px,1fr));
      }
    }

    @media(max-width:360px){
      #appContent form>section,
      #appContent form section[data-ims-field-section],
      #appContent .ims-field-grid,
      #appContent .ims-auto-field-host{
        grid-template-columns:minmax(0,1fr);
      }
      #appContent .ims-auto-field-host>label:has(textarea),
      #appContent .ims-field-grid>label:has(textarea),
      #appContent form>section>label:has(textarea){grid-column:auto}
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

  function normalizeFieldHosts(root=document){
    const scope=root.querySelectorAll?root:document;
    const nodes=[];
    if(scope.matches?.('form,section,div'))nodes.push(scope);
    nodes.push(...scope.querySelectorAll?.('#appContent form,#appContent section,#appContent div')||[]);

    nodes.forEach(host=>{
      if(!host.closest('#appContent'))return;
      const direct=[...host.children];
      const labels=direct.filter(x=>x.tagName==='LABEL');
      if(labels.length<2)return;

      host.classList.add('ims-auto-field-host');
      direct.forEach(child=>{
        if(child.tagName==='LABEL')return;
        child.classList.add('ims-full-row');
      });
    });
  }

  function clean(){
    normalizeFieldHosts(document);

    if(document.getElementById('pageTitle')?.textContent.trim()==='Main Workspace'){
      const cards=[...document.querySelectorAll('#appContent .statLog')];
      if(cards.length){
        const wrap=cards[0].parentElement;
        if(wrap&&cards.every(x=>x.parentElement===wrap))wrap.remove();
        else cards.forEach(x=>x.remove());
      }
      document.querySelectorAll('#registerForm #trackingType').forEach(x=>x.closest('label')?.remove());
    }
  }

  let t;
  new MutationObserver(records=>{
    records.forEach(r=>r.addedNodes.forEach(n=>{
      if(n.nodeType===1)normalizeFieldHosts(n);
    }));
    clearTimeout(t);
    t=setTimeout(clean,20);
  }).observe(document.body,{childList:true,subtree:true});

  clean();
  window.dispatchEvent(new CustomEvent('ims:layout-ready',{detail:IMS_LAYOUT}));
})();
