(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;

  const IMS_LAYOUT=Object.freeze({
    version:3,
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
      generatedFields:'ims-generated-field-row'
    })
  });

  window.IMSLayout=IMS_LAYOUT;
  document.documentElement.dataset.imsLayout='full-width-responsive-fields-v3';

  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* =========================================================
       IMS GLOBAL LAYOUT CONTRACT — V3
       =========================================================
       - Major containers: full width, stacked vertically.
       - Fields inside a container: compact responsive rows.
       - layout-core automatically groups consecutive direct fields.
       - Structural blocks/headings/buttons retain their own full-width row.
       - Wide tables/data: horizontal scroll inside full-width container.
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

    /* Major containers are never side-by-side peers. */
    #appContent>.grid,
    #workspaceOperation>.grid,
    #workspaceOperation>.space-y-5>.grid,
    #appContent .ims-stack{
      grid-template-columns:minmax(0,1fr)!important;
      width:100%;
    }

    /* Explicit and automatically generated compact field rows. */
    #appContent .ims-field-grid,
    #appContent .ims-generated-field-row{
      display:grid!important;
      grid-template-columns:repeat(auto-fit,minmax(${IMS_LAYOUT.fieldMinWidth}px,1fr));
      gap:.75rem!important;
      align-items:end;
      width:100%;
      min-width:0;
    }

    /* Existing intentional module field grids remain intact. */
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

    #appContent .ims-generated-field-row>label:has(textarea),
    #appContent .ims-field-grid>label:has(textarea){
      grid-column:span 2;
    }

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

      #appContent .ims-field-grid,
      #appContent .ims-generated-field-row{
        grid-template-columns:repeat(auto-fit,minmax(${IMS_LAYOUT.mobileFieldMinWidth}px,1fr));
      }
    }

    @media(max-width:360px){
      #appContent .ims-field-grid,
      #appContent .ims-generated-field-row{
        grid-template-columns:minmax(0,1fr);
      }
      #appContent .ims-generated-field-row>label:has(textarea),
      #appContent .ims-field-grid>label:has(textarea){grid-column:auto}
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

  function eligibleHost(el){
    if(!el?.children||!el.closest?.('#appContent'))return false;
    if(el.classList.contains('ims-generated-field-row'))return false;
    if(el.tagName==='TABLE'||el.tagName==='TBODY'||el.tagName==='TR')return false;
    return el.matches('form,section,div');
  }

  function wrapLabelRun(host,run){
    if(run.length<2)return;
    const row=document.createElement('div');
    row.className='ims-generated-field-row';
    row.dataset.imsGeneratedFieldRow='1';
    host.insertBefore(row,run[0]);
    run.forEach(label=>row.appendChild(label));
  }

  function normalizeHost(host){
    if(!eligibleHost(host))return;
    const children=[...host.children];
    let run=[];
    const flush=()=>{wrapLabelRun(host,run);run=[];};

    children.forEach(child=>{
      if(child.tagName==='LABEL')run.push(child);
      else flush();
    });
    flush();
  }

  function normalizeFieldRows(root=document){
    const nodes=[];
    if(root.nodeType===1&&eligibleHost(root))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll('#appContent form,#appContent section,#appContent div'));
    nodes.forEach(normalizeHost);
  }

  function clean(){
    normalizeFieldRows(document);

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
      if(n.nodeType===1)normalizeFieldRows(n);
    }));
    clearTimeout(t);
    t=setTimeout(clean,20);
  }).observe(document.body,{childList:true,subtree:true});

  clean();
  window.dispatchEvent(new CustomEvent('ims:layout-ready',{detail:IMS_LAYOUT}));
})();
