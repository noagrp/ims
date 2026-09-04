import { NAVIGATION, can, currentRole } from './ims-permissions.js';

// Consolidated UI permission layer. Business modules declare their own can(...)
// checks; this file only applies navigation and explicit data-ims-permission UI.
const navPermission=new Map(NAVIGATION.map(x=>[x.id,x.permission]));

function permissionForTab(tabId){return navPermission.get(String(tabId||''))||null;}
function setAllowed(el,allowed){el.hidden=!allowed;el.setAttribute('aria-hidden',allowed?'false':'true');if('disabled'in el)el.disabled=!allowed;if(!allowed&&'tabIndex'in el)el.tabIndex=-1;}
function applyNavigationPermissions(root=document){root.querySelectorAll?.('.navBtn[data-tab]').forEach(btn=>{const permission=permissionForTab(btn.dataset.tab);setAllowed(btn,!permission||can(permission));});}
function applyDeclaredActionPermissions(root=document){root.querySelectorAll?.('[data-ims-permission]').forEach(el=>{const permission=el.dataset.imsPermission;setAllowed(el,!permission||can(permission));});}
function applyPermissions(root=document){applyNavigationPermissions(root);applyDeclaredActionPermissions(root);}
function guard(permission,fn){return function guardedAction(...args){if(!can(permission)){console.warn(`IMS permission denied: ${permission} for role ${currentRole()}`);return undefined;}return fn.apply(this,args);};}

let timer;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>applyPermissions(document),20);});observer.observe(document.documentElement,{childList:true,subtree:true});applyPermissions(document);

window.IMSAccessUI=Object.freeze({permissionForTab,applyNavigationPermissions,applyDeclaredActionPermissions,applyPermissions,guard});
window.dispatchEvent(new CustomEvent('ims:access-ui-ready',{detail:{role:currentRole()}}));
export { permissionForTab,applyNavigationPermissions,applyDeclaredActionPermissions,applyPermissions,guard };
