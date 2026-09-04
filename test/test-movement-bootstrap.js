(function(){
  function seed(){
    const old=document.getElementById('batchMoveForm');
    if(!old||document.getElementById('testMovementForm')||document.getElementById('tmAction'))return;
    const s=document.createElement('select');
    s.id='tmAction';
    s.style.display='none';
    s.innerHTML='<option value="DELIVER_CLIENT" selected>Rental / Send to Client</option>';
    old.appendChild(s);
  }
  seed();
  let t;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(seed,20);}).observe(document.body,{childList:true,subtree:true});
})();