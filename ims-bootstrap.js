import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { NAVIGATION, can, currentRole } from './ims-permissions.js';

const ROLE=currentRole();
const byId=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function allowedNavigation(){return NAVIGATION.filter(x=>!x.permission||can(x.permission));}
function rolePage(role){return role==='superadmin'?'superadmin.html':role==='manager'?'manager.html':role==='admin'?'admin.html':'index.html';}

function renderShell(profile,user){
  document.body.innerHTML=`<div class="min-h-screen bg-slate-950 text-slate-100 lg:flex">
    <aside class="lg:w-64 lg:min-h-screen bg-slate-900 border-r border-slate-800 p-4 lg:sticky lg:top-0 lg:h-screen">
      <div class="flex items-center justify-between lg:block mb-4"><div><div class="text-xl font-black tracking-tight text-red-400">IMS</div><div class="text-[11px] text-slate-500 uppercase">${esc(profile.role)}</div></div><button id="logoutBtn" class="lg:hidden bg-slate-800 px-3 py-2 rounded-lg text-xs">Logout</button></div>
      <nav id="navTabs" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2">${allowedNavigation().map(x=>`<button data-tab="${esc(x.id)}" class="navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/50 hover:bg-slate-800">${esc(x.label)}</button>`).join('')}</nav>
      <div class="hidden lg:block mt-6 pt-4 border-t border-slate-800"><div id="currentUser" class="text-xs text-slate-400 break-all">${esc(profile.email||user.email||'')}</div><button id="logoutBtnDesktop" class="mt-3 w-full bg-red-600 hover:bg-red-500 py-2 rounded-lg text-xs font-bold">Logout</button></div>
    </aside>
    <main class="flex-1 p-3 sm:p-5 lg:p-7 overflow-x-hidden"><div class="max-w-7xl mx-auto"><div class="mb-5"><h1 id="pageTitle" class="text-xl sm:text-2xl font-bold">Main Workspace</h1><p id="pageSubtitle" class="text-xs text-slate-500 mt-1">Loading IMS modules…</p></div><div id="appContent"><section class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-sm text-slate-400">Loading authorized modules…</section></div></div></main>
  </div>`;
  const logout=()=>signOut(auth).then(()=>location.href='index.html');
  byId('logoutBtn').onclick=logout;byId('logoutBtnDesktop').onclick=logout;
  window.IMSUser=Object.freeze({uid:user.uid,email:profile.email||user.email||'',role:profile.role,status:profile.status||'active'});
  window.dispatchEvent(new CustomEvent('ims:auth-ready',{detail:window.IMSUser}));
}

function activateWorkspace(){
  if(!byId('appContent'))return;
  if(window.IMSWorkspace?.show){window.IMSWorkspace.show();return;}
  const onReady=()=>{window.removeEventListener('ims:workspace-ready',onReady);window.IMSWorkspace?.show?.();};
  window.addEventListener('ims:workspace-ready',onReady,{once:true});
}

function showStartupError(err){document.body.innerHTML=`<div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"><div class="w-full max-w-xl bg-red-950/40 border border-red-900 rounded-2xl p-5"><div class="text-lg font-bold text-red-300">IMS failed to start</div><div class="text-sm text-slate-300 mt-3">${esc(err?.message||String(err))}</div><div class="text-xs text-slate-500 mt-3">Role page: ${esc(ROLE)}. Check the Firestore user profile and browser console.</div><button id="imsStartupBack" class="mt-4 bg-slate-700 px-4 py-2 rounded-lg text-sm">Back to Login</button></div></div>`;byId('imsStartupBack').onclick=()=>location.href='index.html';}

document.body.innerHTML=`<div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"><div class="text-center"><div class="text-xl font-bold text-red-400">IMS</div><div class="text-sm text-slate-400 mt-2">Authenticating ${esc(ROLE)}…</div></div></div>`;

onAuthStateChanged(auth,async user=>{
  try{
    if(!user){location.href='index.html';return;}
    const snap=await getDoc(doc(db,'users',user.uid));
    if(!snap.exists())throw new Error('User profile record is missing in Firestore.');
    const profile=snap.data();
    if(profile.status!=='active'){await signOut(auth);location.href='index.html';return;}
    if(profile.role!==ROLE){location.href=rolePage(profile.role);return;}
    renderShell(profile,user);
    activateWorkspace();
  }catch(err){console.error('IMS startup failed:',err);showStartupError(err);}
});

window.IMSBootstrap=Object.freeze({allowedNavigation,activateWorkspace});
window.dispatchEvent(new CustomEvent('ims:bootstrap-ready'));
