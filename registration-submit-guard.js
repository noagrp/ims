(()=>{
  let locked=false;
  let lockedForm=null;
  let unlockTimer=null;

  function reset(){
    locked=false;
    lockedForm=null;
    clearTimeout(unlockTimer);
    unlockTimer=null;
  }

  function unlockIfSameForm(){
    if(!lockedForm || !document.body.contains(lockedForm)){
      reset();
      return;
    }
    const btn=lockedForm.querySelector('button[type="submit"],button:not([type])');
    if(btn){btn.disabled=false;btn.textContent=btn.dataset.imsOriginalText||'Register Item';}
    reset();
  }

  document.addEventListener('submit',e=>{
    if(e.target?.id!=='registerForm')return;

    if(locked){
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    locked=true;
    lockedForm=e.target;
    const btn=e.target.querySelector('button[type="submit"],button:not([type])');
    if(btn){
      btn.dataset.imsOriginalText=btn.textContent;
      btn.disabled=true;
      btn.textContent='Saving...';
    }

    // Successful registration re-renders the workspace and replaces the form.
    // This timeout is only a safety fallback if Firebase/network throws before rerender.
    unlockTimer=setTimeout(unlockIfSameForm,30000);
  },true);

  const observer=new MutationObserver(()=>{
    if(locked && lockedForm && !document.body.contains(lockedForm))reset();
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
