import { auth, db, firebaseConfig } from '../../firebase-config.js';
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';

// Optional consolidated User Management module.
// If unavailable, the legacy user-management screen remains the fallback.

const inputCls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500';
let users=[];
const byId=id=>document.getElementById(id);
const nowISO=()=>new Date().toISOString();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=(txt,html)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${txt}</span>${html}</label>`;
const card=(title,body,extra='')=>`<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl ${extra}"><h2 class="font-bold text-sm sm:text-base mb-4">${title}</h2>${body}</section>`;

async function reload(){
  if(!can('users.view')){users=[];return users;}
  if(can('users.role.edit')){
    const snap=await getDocs(collection(db,'users'));
    users=snap.docs.map(d=>({id:d.id,...d.data()}));
  }else{
    const snap=await getDocs(query(collection(db,'users'),where('role','==','admin')));
    users=snap.docs.map(d=>({id:d.id,...d.data()}));
  }
  users.sort((a,b)=>String(a.email||'').localeCompare(String(b.email||''),undefined,{sensitivity:'base'}));
  return users;
}

async function writeAudit(actionType,targetName,beforeValue=null,afterValue=null,remark='',targetId=''){
  const user=auth.currentUser;
  if(!user)return;
  await addDoc(collection(db,'audit_traces'),{
    traceVersion:3,
    actionType,
    module:'User Management',
    targetType:'user',
    targetName:String(targetName||''),
    targetId:String(targetId||''),
    summary:`${String(actionType||'').replace(/_/g,' ')}: ${targetName||'user'}`,
    beforeValue,
    afterValue,
    changedFields:[],
    remark:String(remark||''),
    metadata:{source:'users-module'},
    performedBy:user.email||'',
    performedByRole:window.IMS_ROLE||'',
    performedAt:nowISO()
  });
}

function setHeader(){
  if(byId('pageTitle'))byId('pageTitle').textContent='User Management';
  if(byId('pageSubtitle'))byId('pageSubtitle').textContent='No user deletion. Accounts are activated/inactivated and role changes are traced.';
  document.querySelectorAll('.navBtn[data-tab]').forEach(btn=>{
    btn.className=`navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold ${btn.dataset.tab==='users'?'bg-red-600 text-white':'bg-slate-800/50 hover:bg-slate-800'}`;
  });
}

function createRoleOptions(){
  return can('users.role.edit')
    ? ['admin','manager','superadmin']
    : ['admin'];
}

function canManageTarget(user){
  if(!can('users.status'))return false;
  if(user.uid===auth.currentUser?.uid||user.id===auth.currentUser?.uid)return false;
  if(user.role==='admin')return true;
  return can('users.role.edit');
}

function render(){
  if(!can('users.view'))return;
  const mount=byId('appContent');
  if(!mount)return;
  setHeader();

  const createCard=can('users.add')?card('Create Account',`<form id="imsUserForm" class="space-y-3">
    ${label('Email',`<input type="email" id="imsUserEmail" required class="${inputCls}">`)}
    ${label('Temporary Password',`<input type="password" id="imsUserPassword" minlength="8" required class="${inputCls}">`)}
    ${label('Role',`<select id="imsUserRole" class="${inputCls}">${createRoleOptions().map(x=>`<option value="${x}">${x}</option>`).join('')}</select>`)}
    <button class="w-full bg-red-600 py-2.5 rounded-lg text-sm font-bold">Create Account</button>
  </form>`):'';

  const directory=card('Account Directory',`<div class="overflow-x-auto"><table class="w-full min-w-[700px] text-xs"><thead class="text-slate-500"><tr><th class="p-2 text-left">Email</th><th class="p-2">Role</th><th class="p-2">Status</th><th class="p-2">Created</th><th class="p-2">Actions</th></tr></thead><tbody>${users.map(u=>{
    const statusAction=canManageTarget(u)?`<button data-user-status="${u.id}" class="bg-slate-700 px-2 py-1 rounded text-[10px]">${u.status==='inactive'?'Activate':'Deactivate'}</button>`:'';
    const roleAction=can('users.role.edit')&&u.uid!==auth.currentUser?.uid&&u.id!==auth.currentUser?.uid?` <button data-user-role="${u.id}" class="bg-violet-700 px-2 py-1 rounded text-[10px]">Role</button>`:'';
    return `<tr class="border-t border-slate-800"><td class="p-2">${esc(u.email)}</td><td class="p-2 text-center">${esc(u.role)}</td><td class="p-2 text-center">${esc(u.status||'active')}</td><td class="p-2 text-center">${esc(u.createdAt?.slice(0,10)||'')}</td><td class="p-2 text-center">${statusAction}${roleAction||''}${!statusAction&&!roleAction?'—':''}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="p-4 text-center text-slate-500">No visible accounts.</td></tr>'}</tbody></table></div>`);

  mount.innerHTML=`<div id="imsUsersModule" class="grid ${createCard?'lg:grid-cols-3':''} gap-5">${createCard}${createCard?`<div class="lg:col-span-2">${directory}</div>`:directory}</div>`;
  if(byId('imsUserForm'))byId('imsUserForm').onsubmit=createUserAccount;
  mount.querySelectorAll('[data-user-status]').forEach(btn=>btn.onclick=()=>toggleUser(btn.dataset.userStatus));
  mount.querySelectorAll('[data-user-role]').forEach(btn=>btn.onclick=()=>changeRole(btn.dataset.userRole));
}

async function createUserAccount(e){
  e.preventDefault();
  if(!can('users.add'))return;
  const email=byId('imsUserEmail').value.trim().toLowerCase();
  const password=byId('imsUserPassword').value;
  const role=byId('imsUserRole').value;
  const allowedRoles=createRoleOptions();
  if(!allowedRoles.includes(role))return;
  if(password.length<8){alert('Password must be at least 8 characters.');return;}

  let app;
  try{
    app=initializeApp(firebaseConfig,`ims-provision-${Date.now()}`);
    const secondaryAuth=getAuth(app);
    const cred=await createUserWithEmailAndPassword(secondaryAuth,email,password);
    await setDoc(doc(db,'users',cred.user.uid),{
      uid:cred.user.uid,
      email,
      role,
      status:'active',
      createdAt:nowISO(),
      createdBy:auth.currentUser?.email||''
    });
    await writeAudit('CREATE_USER',email,null,{role,status:'active'},'',cred.user.uid);
    await reload();
    render();
    alert('Account created.');
  }catch(err){
    alert('Create user failed: '+(err?.message||String(err)));
  }finally{
    if(app)try{await deleteApp(app);}catch{}
  }
}

async function toggleUser(id){
  const u=users.find(x=>x.id===id);
  if(!u||!canManageTarget(u))return;
  const status=u.status==='inactive'?'active':'inactive';
  const reason=prompt(`Reason for ${status==='inactive'?'deactivating':'activating'} ${u.email} (required)`,'');
  if(!reason?.trim())return;
  await updateDoc(doc(db,'users',id),{status});
  await writeAudit('CHANGE_USER_STATUS',u.email,{status:u.status||'active'},{status},reason.trim(),id);
  await reload();
  render();
}

async function changeRole(id){
  if(!can('users.role.edit'))return;
  const u=users.find(x=>x.id===id);
  if(!u||u.uid===auth.currentUser?.uid||u.id===auth.currentUser?.uid)return;
  const role=prompt('New role: admin, manager or superadmin',u.role);
  if(!['admin','manager','superadmin'].includes(role)||role===u.role)return;
  const reason=prompt('Reason for role change (required)','');
  if(!reason?.trim())return;
  await updateDoc(doc(db,'users',id),{role});
  await writeAudit('CHANGE_USER_ROLE',u.email,{role:u.role},{role},reason.trim(),id);
  await reload();
  render();
}

function interceptNavigation(){
  document.addEventListener('click',async event=>{
    const btn=event.target.closest?.('.navBtn[data-tab="users"]');
    if(!btn||!can('users.view'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      await reload();
      render();
    }catch(error){
      console.warn('IMS users module failed; legacy fallback remains available.',error);
    }
  },true);
}

interceptNavigation();
window.IMSUsers=Object.freeze({reload,render});
window.dispatchEvent(new CustomEvent('ims:users-ready'));

export { reload, render };
