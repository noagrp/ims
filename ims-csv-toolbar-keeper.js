const role=String(window.IMS_ROLE||'').trim().toLowerCase();
const allowed=['manager','superadmin'].includes(role);

function stabilizeOne(formId,toolId){
  if(!allowed)return;
  const form=document.getElementById(formId);
  if(!form)return;
  const tool=document.getElementById(toolId);
  if(tool&&tool.parentElement===form){
    form.parentElement?.insertBefore(tool,form);
    tool.dataset.imsCsvStable='true';
  }
  if(!document.getElementById(toolId)&&window.IMSRegistrationCSV?.install){
    window.IMSRegistrationCSV.install();
    const added=document.getElementById(toolId);
    if(added&&added.parentElement===form){
      form.parentElement?.insertBefore(added,form);
      added.dataset.imsCsvStable='true';
    }
  }
}

function stabilize(){
  if(!allowed)return;
  stabilizeOne('registerForm','regCsvTools');
  stabilizeOne('r2rForm','r2rCsvTools');
}

let timer;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(stabilize,10);
}).observe(document.body,{childList:true,subtree:true});

['ims:registration-ready','ims:renttorent-ready','ims:registration-csv-ready','ims:modules-ready'].forEach(name=>window.addEventListener(name,stabilize));
setInterval(stabilize,500);
stabilize();

window.IMSCsvToolbarKeeper=Object.freeze({stabilize});
export{stabilize};