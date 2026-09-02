(()=>{
  if(document.getElementById('imsCoreLayoutCss'))return;

  const IMS_LAYOUT=Object.freeze({
    version:5,
    majorContainers:'full-width-vertical',
    compactFields:'row-wrap',
    fieldMinWidth:180,
    tabletFieldMinWidth:160,
    mobileFieldMinWidth:145,
    wideData:'horizontal-scroll',
    strategy:'css-only-explicit'
  });

  window.IMSLayout=IMS_LAYOUT;
  document.documentElement.dataset.imsLayout='site-design-v5';

  const s=document.createElement('style');
  s.id='imsCoreLayoutCss';
  s.textContent=`
    /* =========================================================
       IMS SITE DESIGN — GLOBAL / CSS ONLY
       =========================================================
       1. Content area always uses full available width.
       2. Major cards/sections/tabs stack vertically.
       3. Short fields inside a section align in compact rows.
       4. Existing operational line-item grids remain untouched.
       5. Tables stay wide and scroll horizontally.
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
    #appContent form{
      width:100%;
      min-width:0;
      box-sizing:border-box;
    }

    /* ---------- MAJOR CONTAINERS ---------- */
    /* Any grid whose direct children are major SECTION cards becomes vertical. */
    #appContent .grid:has(>section),
    #appContent .grid:has(>div>section),
    #workspaceOperation>.grid,
    #workspaceOperation>.space-y-5>.grid,
    #imsMastersModule>.grid,
    #imsUsersModule,
    #itemDetailMount>section>.grid{
      grid-template-columns:minmax(0,1fr)!important;
    }

    #appContent section+section{
      margin-top:1.25rem;
    }

    /* Workspace major operation containers always remain one below another. */
    [data-ims-workspace-module] #workspaceOperation,
    [data-ims-workspace-module] #imsMovementStates,
    #maintenanceWorkflowForm,
    #inspectionWorkflowForm,
    #imsRecordsModule,
    #imsAuditModule,
    #imsMastersModule,
    #imsBackupRecoveryModule{
      width:100%;
      min-width:0;
    }

    /* ---------- GENERIC COMPACT FIELD HOST ---------- */
    /* CSS-only: if a non-grid/non-flex container has 2+ direct labels,
       it is a field group. Structural children stay full-row. */
    #appContent :is(form,section,div):not(.grid):not(.flex):has(>label:nth-of-type(2)){
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:flex-end;
      gap:.75rem!important;
    }

    #appContent :is(form,section,div):not(.grid):not(.flex):has(>label:nth-of-type(2))>label{
      flex:1 1 ${IMS_LAYOUT.fieldMinWidth}px!important;
      width:auto!important;
      min-width:${IMS_LAYOUT.fieldMinWidth}px!important;
      max-width:100%;
      margin:0!important;
    }

    #appContent :is(form,section,div):not(.grid):not(.flex):has(>label:nth-of-type(2))>label:has(textarea){
      flex-basis:360px!important;
    }

    #appContent :is(form,section,div):not(.grid):not(.flex):has(>label:nth-of-type(2))>:not(label){
      flex:1 0 100%;
      width:100%;
      min-width:0;
      margin-top:0!important;
      margin-bottom:0!important;
    }

    /* Registration: explicit compact layout for all registration sections. */
    #registerForm>section{
      display:grid!important;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      gap:.75rem!important;
      align-items:end;
    }

    #registerForm>section>div:first-child:not([id]){
      grid-column:1/-1!important;
    }

    #registerForm>section>label{
      width:100%!important;
      min-width:0!important;
      margin:0!important;
    }

    #registerForm>section>label:has(textarea){
      grid-column:span 2;
    }

    #registerForm #initialLocationWrap{
      grid-column:auto!important;
      width:100%!important;
      min-width:0!important;
    }

    #registerForm #initialLocationWrap>label{
      width:100%!important;
    }

    /* Movement: top controls use a compact single operational row where possible. */
    #batchMoveForm #bmTopGrid{
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
    }

    /* Do not disturb dense item rows / adjustment rows. */
    #batchMoveForm .bmRowGrid,
    #batchMoveForm .bmAdjustment,
    #maintenanceWorkflowForm .mwSendRow>.grid{
      width:100%;
      min-width:0;
    }

    /* Maintenance: provider / remark and result controls stay compact. */
    #maintenanceWorkflowForm section>.grid:not([class*="grid-cols-["]){
      grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important;
    }

    #maintenanceWorkflowForm #mwBody>div:has(>label:nth-of-type(2)){
      display:flex!important;
      flex-wrap:wrap!important;
      gap:.75rem!important;
      align-items:flex-end;
    }

    #maintenanceWorkflowForm #mwBody>div:has(>label:nth-of-type(2))>label{
      flex:1 1 220px!important;
      min-width:180px!important;
      width:auto!important;
    }

    #maintenanceWorkflowForm #mwBody>div:has(>label:nth-of-type(2))>:not(label){
      flex:1 0 100%;
      width:100%;
    }

    /* Inspection: start fields compact; text areas share available space. */
    #inspectionWorkflowForm section>.grid{
      grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important;
    }

    #inspectionWorkflowForm section:has(>label:nth-of-type(2))>label{
      flex:1 1 260px!important;
    }

    /* Suppliers / Clients: denser details form, directory remains below full width. */
    #bizForm>div.grid{
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
    }

    #bizForm>div.grid>.sm\:col-span-2{
      grid-column:span 2!important;
    }

    /* Users: create-account fields share one row; action button is full-row. */
    #imsUserForm{
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:.75rem!important;
      align-items:end;
    }

    #imsUserForm>button{
      grid-column:1/-1;
    }

    /* Masters: every Master card remains full width. Normal add forms stay compact. */
    #imsMastersModule .imsMasterForm:not([data-special="itemType"]){
      align-items:end;
    }

    #imsMastersModule .imsMasterForm[data-special="itemType"]{
      display:grid!important;
      grid-template-columns:minmax(220px,1.2fr) minmax(360px,2fr) auto!important;
      gap:.75rem!important;
      align-items:end;
    }

    #imsMastersModule .imsMasterForm[data-special="itemType"]>div.grid{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }

    #imsMastersModule .imsMasterForm[data-special="itemType"]>button{
      width:auto!important;
      min-width:120px;
    }

    /* Stock Inventory: filter fields pack across the Filters container. */
    #appContent section:has(>#fType):has(>#fCat),
    #appContent section:has(>label>#fType):has(>label>#fCat){
      display:flex!important;
      flex-wrap:wrap!important;
      align-items:flex-end;
      gap:.75rem!important;
    }

    #appContent section:has(>label>#fType)>label{
      flex:1 1 180px!important;
      min-width:160px!important;
      width:auto!important;
      margin:0!important;
    }

    #appContent section:has(>label>#fType)>div:first-child{
      flex:1 0 100%;
    }

    /* Records + Audit filter bars: compact rows. */
    #imsRecordsModule>section:first-child>.grid{
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
    }

    #imsAuditModule>section:first-child .grid{
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
    }

    /* Item Detail is always vertical at major-card level; small summary fields stay compact. */
    #itemDetailMount section>.grid{
      grid-template-columns:minmax(0,1fr)!important;
    }

    #itemDetailMount section>.grid>div>.grid{
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;
    }

    /* ---------- INPUTS / TABLES ---------- */
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
    #appContent .overflow-auto,
    #appContent .ims-wide-data{
      width:100%;
      max-width:100%;
      overflow-x:auto!important;
      -webkit-overflow-scrolling:touch;
    }

    #appContent table{
      max-width:none;
    }

    /* ---------- RESPONSIVE DENSITY ---------- */
    @media(max-width:1199px){
      #registerForm>section{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      #bizForm>div.grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      #imsAuditModule>section:first-child .grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      #imsMastersModule .imsMasterForm[data-special="itemType"]{grid-template-columns:minmax(200px,1fr) minmax(300px,1.7fr)!important}
      #imsMastersModule .imsMasterForm[data-special="itemType"]>button{grid-column:1/-1;width:100%!important}
    }

    @media(max-width:767px){
      main{padding-left:.75rem!important;padding-right:.75rem!important}
      #appContent section{padding-left:1rem;padding-right:1rem}
      #registerForm>section,
      #bizForm>div.grid,
      #imsUserForm,
      #imsRecordsModule>section:first-child>.grid,
      #imsAuditModule>section:first-child .grid,
      #batchMoveForm #bmTopGrid{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
      }
      #imsMastersModule .imsMasterForm[data-special="itemType"]{grid-template-columns:minmax(0,1fr)!important}
      #imsMastersModule .imsMasterForm[data-special="itemType"]>div.grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      #appContent :is(form,section,div):not(.grid):not(.flex):has(>label:nth-of-type(2))>label{
        flex-basis:${IMS_LAYOUT.tabletFieldMinWidth}px!important;
        min-width:${IMS_LAYOUT.tabletFieldMinWidth}px!important;
      }
    }

    @media(max-width:479px){
      #registerForm>section,
      #bizForm>div.grid,
      #imsUserForm,
      #imsRecordsModule>section:first-child>.grid,
      #imsAuditModule>section:first-child .grid,
      #batchMoveForm #bmTopGrid,
      #imsMastersModule .imsMasterForm[data-special="itemType"]>div.grid{
        grid-template-columns:minmax(0,1fr)!important;
      }
      #registerForm>section>label:has(textarea){grid-column:auto}
      #bizForm>div.grid>.sm\:col-span-2{grid-column:auto!important}
      #appContent :is(form,section,div):not(.grid):not(.flex):has(>label:nth-of-type(2))>label{
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
      #appContent .overflow-auto,
      #appContent .ims-wide-data{overflow:visible!important}
    }
  `;
  document.head.appendChild(s);

  /* Preserve existing workspace-only cleanup; layout itself is CSS-only. */
  const cleanWorkspace=()=>{
    if(document.getElementById('pageTitle')?.textContent.trim()!=='Main Workspace')return;
    const cards=[...document.querySelectorAll('#appContent .statLog')];
    if(cards.length){
      const wrap=cards[0].parentElement;
      if(wrap&&cards.every(x=>x.parentElement===wrap))wrap.remove();
      else cards.forEach(x=>x.remove());
    }
    document.querySelectorAll('#registerForm #trackingType').forEach(x=>x.closest('label')?.remove());
  };

  let timer;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(cleanWorkspace,20);
  }).observe(document.body,{childList:true,subtree:true});
  cleanWorkspace();

  window.dispatchEvent(new CustomEvent('ims:layout-ready',{detail:IMS_LAYOUT}));
})();
