function refine(){const root=document.getElementById('imsBackupRecoveryModule');if(!root)return;for(const p of root.querySelectorAll('p'))if(p.textContent.includes('Manager and Superadmin can create backups.'))p.textContent='System backup, restore and clean reset are Superadmin-only. Inventory Summary is rebuilt after restore.';}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refine,30);}).observe(document.body,{childList:true,subtree:true});
refine();
window.IMSPermissionCopy=Object.freeze({refine});
window.dispatchEvent(new CustomEvent('ims:permission-copy-ready'));
export{refine};