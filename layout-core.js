(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;

  const IMS_LAYOUT=Object.freeze({
    version:4,
    majorFlow:'vertical',
    majorWidth:'full',
    fieldFlow:'flex-wrap',
    fieldMinWidth:180,
    mobileFieldMinWidth:145,
    wideData:'horizontal-scroll',
    autoNormalize:true,
    classes:Object.freeze({
      stack:'ims-stack',
      container:'ims-container',
      fields:'ims-field-row',
      wide:'ims-wide-data'
    })
  });

  window.IMSLayout=IMS_LAYOUT;
  document.documentElement.dataset.imsLayout='full-width-flex-fields-v4';

  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* IMS GLOBAL LAYOUT CONTRACT V4
       Major containers = full width + vertical.
       Small fields inside containers = flex-wrap rows.
       Wide tables/data = horizontal scroll. */

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

    /* Major containers stay stacked vertically. */
    #appContent>.grid,
    #workspaceOperation>.grid,
    #workspaceOperation>.space-y-5>.grid,
    #appContent .ims-stack{
      grid-template-columns:minmax(0,1fr)!important;
      width:100%;
    }

    /* Global compact field row. */
    #appContent .ims-field-row{
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:flex-end;
      gap:.75rem!important;
      width:100%;
      min-width:0;
    }

    #appContent .ims-field-row>label{
      flex:1 1 ${IMS_LAYOUT.fieldMinWidth}px!important;
      width:auto!important;
      min-width:${IMS_LAYOUT.fieldMinWidth}px!important;
      max-width:100%;
      box-sizing:border-box;
    }

    #appContent .ims-field-row>label:has(textarea){
      flex-basis:360px!important;
    }

    /* Existing intentional grids in modules remain valid compact field rows. */
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

      #appContent .ims-field-row>label{
        flex-basis:${IMS_LAYOUT.mobileFieldMinWidth}px!important;
        min-width:${IMS_LAYOUT.mobileFieldMinWidth}px!important;
      }
    }

    @media(max-width:360px){
      #appContent .ims-field-row>label{
        flex:1 1 100%!important;
        min-width:0!important;
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

  function eligibleHost(el){
    if(!el?.children||!el.closest?.('#appContent'))return false;
    if(el.classList.contains('ims-field-row'))return false;
    if(['TABLE','TBODY','TR','THEAD'].includes(el.tagName))return false;
    return el.matches('form,section,div');
  }

  function normalizeHost(host){
    if(!eligibleHost(host))return;
    const direct=[...host.children];
    const labels=direct.filter(x=>x.tagName==='LABEL');
    if(labels.length<2)return;

    let run=[];
    const flush=()=>{
      if(run.length<2){run=[];return;}
      const row=document.createElement('div');
      row.className='ims-field-row';
      row.dataset.imsFieldRow='1';
      host.insertBefore(row,run[0]);
      run.forEach(label=>row.appendChild(label));
      run=[];
    };

    direct.forEach(child=>{
      if(child.tagName==='LABEL')run.push(child);
      else flush();
    });
    flush();
  }

  function normalize(root=document){
    const nodes=[];
    if(root.nodeType===1&&eligibleHost(root))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll('#appContent form,#appContent section,#appContent div'));
    nodes.forEach(normalizeHost);
  }

  function clean(){
    normalize(document);

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
    records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)normalize(n);}));
    clearTimeout(t);
    t=setTimeout(clean,20);
  }).observe(document.body,{childList:true,subtree:true});

  clean();
  window.dispatchEvent(new CustomEvent('ims:layout-ready',{detail:IMS_LAYOUT}));
})();
