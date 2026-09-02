import { auth, db } from '../../firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { can } from '../../ims-permissions.js';

// Optional Supplier / Client business-master module.
// If this file is removed or fails to load, the legacy core remains available
// as a fallback. This module does not own inventory or operational workflows.

const inputCls = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500';
let suppliers = [];
let clients = [];
let activeKind = '';

const byId = id => document.getElementById(id);
const nowISO = () => new Date().toISOString();
const norm = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = (txt, html) => `<label class="block text-xs text-slate-400"><span class="block mb-1">${txt}</span>${html}</label>`;
const card = (title, body, extra='') => `<section class="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl ${extra}"><h2 class="font-bold text-sm sm:text-base mb-4">${title}</h2>${body}</section>`;

async function loadCollection(name) {
  const out = [];
  const snap = await getDocs(collection(db, name));
  snap.forEach(d => out.push({ id:d.id, ...d.data() }));
  return out;
}

async function reload() {
  [suppliers, clients] = await Promise.all([
    loadCollection('supplier_profiles'),
    loadCollection('client_profiles')
  ]);
}

async function writeAudit(actionType, module, targetType, targetName, beforeValue=null, afterValue=null, remark='', targetId='') {
  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, 'audit_traces'), {
    traceVersion:3,
    actionType,
    module,
    targetType,
    targetName:String(targetName || ''),
    targetId:String(targetId || ''),
    summary:`${String(actionType || '').replace(/_/g,' ')}: ${targetName || targetType || module}`,
    beforeValue,
    afterValue,
    changedFields:[],
    remark:String(remark || ''),
    metadata:{ source:'business-module' },
    performedBy:user.email || '',
    performedByRole:window.IMS_ROLE || '',
    performedAt:nowISO()
  });
}

function businessFields(kind, x={}) {
  const pre = kind === 'supplier' ? 'supplier' : 'client';
  return `<input type="hidden" id="bizId" value="${esc(x.id || '')}"><div class="grid sm:grid-cols-2 gap-3">
    ${label('Company Name', `<input id="bizCompany" required class="${inputCls}" value="${esc(x.companyName || x[pre+'Name'] || '')}">`)}
    ${label('Registration No.', `<input id="bizReg" class="${inputCls}" value="${esc(x.registrationNo || '')}">`)}
    ${label('Contact Person', `<input id="bizContact" class="${inputCls}" value="${esc(x.contactPerson || x.contact || '')}">`)}
    ${label('Telephone', `<input id="bizTel" class="${inputCls}" value="${esc(x.tel || '')}">`)}
    ${label('Mobile', `<input id="bizMobile" class="${inputCls}" value="${esc(x.mobile || '')}">`)}
    ${label('Fax', `<input id="bizFax" class="${inputCls}" value="${esc(x.fax || '')}">`)}
    ${label('Email', `<input type="email" id="bizEmail" class="${inputCls}" value="${esc(x.email || '')}">`)}
    ${label('Website', `<input id="bizWebsite" class="${inputCls}" value="${esc(x.website || '')}">`)}
    <div class="sm:col-span-2">${label('Address', `<textarea id="bizAddress" rows="2" class="${inputCls}">${esc(x.address || '')}</textarea>`)}</div>
    ${label('Country', `<input id="bizCountry" class="${inputCls}" value="${esc(x.country || 'Malaysia')}">`)}
    ${label('Business Code', `<input id="bizCode" class="${inputCls}" value="${esc(x.businessCode || '')}">`)}
    <div class="sm:col-span-2">${label('Remark', `<textarea id="bizRemark" rows="2" class="${inputCls}">${esc(x.remark || '')}</textarea>`)}</div>
  </div>`;
}

function setHeader(kind) {
  const title = kind === 'supplier' ? 'Suppliers' : 'Clients';
  const pageTitle = byId('pageTitle');
  const pageSubtitle = byId('pageSubtitle');
  if (pageTitle) pageTitle.textContent = title;
  if (pageSubtitle) pageSubtitle.textContent = `${title} are business master records; operational work stays in Main Workspace.`;
  document.querySelectorAll('.navBtn[data-tab]').forEach(btn => {
    btn.className = `navBtn text-left px-3 py-2.5 rounded-xl text-xs font-semibold ${btn.dataset.tab === kind ? 'bg-red-600 text-white' : 'bg-slate-800/50 hover:bg-slate-800'}`;
  });
}

function render(kind) {
  activeKind = kind;
  const data = kind === 'supplier' ? suppliers : clients;
  const title = kind === 'supplier' ? 'Suppliers' : 'Clients';
  const singular = kind === 'supplier' ? 'Supplier' : 'Client';
  const mount = byId('appContent');
  if (!mount) return;

  setHeader(kind);
  mount.innerHTML = `<div class="grid lg:grid-cols-2 gap-5">
    ${card(`${singular} Details`, `<form id="bizForm" class="space-y-3">${businessFields(kind)}<div class="flex gap-2"><button class="flex-1 bg-red-600 py-2.5 rounded-lg text-sm font-bold">Save ${singular}</button><button type="button" id="bizReset" class="bg-slate-700 px-4 rounded-lg text-xs">Clear</button></div></form>`)}
    ${card(`${title} Directory`, `<input id="bizSearch" class="${inputCls}" placeholder="Search company, contact, email, phone..."><div id="bizList" class="mt-3 space-y-2 max-h-[70vh] overflow-y-auto"></div>`)}
  </div>`;

  const form = byId('bizForm');
  if (!can(`${kind}.add`)) form?.querySelector('button[type="submit"], button:not([type])')?.setAttribute('disabled','disabled');
  if (form) form.onsubmit = e => saveBusiness(e, kind);
  byId('bizReset').onclick = () => render(kind);
  byId('bizSearch').onkeyup = () => renderList(kind);
  renderList(kind);
}

function renderList(kind) {
  const data = kind === 'supplier' ? suppliers : clients;
  const q = norm(byId('bizSearch')?.value || '');
  const mount = byId('bizList');
  if (!mount) return;

  mount.innerHTML = data.filter(x => !q || norm(JSON.stringify(x)).includes(q)).map(x => {
    const name = x.companyName || x[kind+'Name'];
    const editBtn = can(`${kind}.edit`) ? `<button data-biz-edit="${x.id}" class="bg-slate-700 px-2 py-1 rounded text-[10px]">Edit</button>` : '';
    const statusBtn = can(`${kind}.status`) ? `<button data-biz-status="${x.id}" class="bg-slate-700 px-2 py-1 rounded text-[10px]">${x.status === 'inactive' ? 'Activate' : 'Deactivate'}</button>` : '';
    return `<div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><div class="flex justify-between gap-2"><div><div class="font-semibold text-sm">${esc(name)}</div><div class="text-[11px] text-slate-500">${esc(x.contactPerson || x.contact || '')} · ${esc(x.tel || x.mobile || '')} · ${esc(x.email || '')}</div><div class="text-[10px] mt-1 ${x.status === 'inactive' ? 'text-amber-400' : 'text-emerald-400'}">${x.status || 'active'}</div></div><div class="flex gap-1">${editBtn}${statusBtn}</div></div></div>`;
  }).join('') || '<div class="text-sm text-slate-500">No records.</div>';

  mount.querySelectorAll('[data-biz-edit]').forEach(btn => btn.onclick = () => editBusiness(kind, btn.dataset.bizEdit));
  mount.querySelectorAll('[data-biz-status]').forEach(btn => btn.onclick = () => toggleBusiness(kind, btn.dataset.bizStatus));
}

function editBusiness(kind, id) {
  if (!can(`${kind}.edit`)) return;
  const x = (kind === 'supplier' ? suppliers : clients).find(y => y.id === id);
  const form = byId('bizForm');
  if (!x || !form) return;
  form.innerHTML = `${businessFields(kind, x)}<div class="flex gap-2"><button class="flex-1 bg-red-600 py-2.5 rounded-lg text-sm font-bold">Save Changes</button><button type="button" id="bizCancel" class="bg-slate-700 px-4 rounded-lg text-xs">Cancel</button></div>`;
  form.onsubmit = e => saveBusiness(e, kind);
  byId('bizCancel').onclick = () => render(kind);
}

async function saveBusiness(e, kind) {
  e.preventDefault();
  const id = byId('bizId').value;
  const old = (kind === 'supplier' ? suppliers : clients).find(x => x.id === id);
  const permission = old ? `${kind}.edit` : `${kind}.add`;
  if (!can(permission)) return;

  const company = byId('bizCompany').value.trim();
  if (!company) return;

  const rec = {
    companyName:company,
    [kind+'Name']:company,
    registrationNo:byId('bizReg').value.trim(),
    contactPerson:byId('bizContact').value.trim(),
    contact:byId('bizContact').value.trim(),
    tel:byId('bizTel').value.trim(),
    mobile:byId('bizMobile').value.trim(),
    fax:byId('bizFax').value.trim(),
    email:byId('bizEmail').value.trim(),
    website:byId('bizWebsite').value.trim(),
    address:byId('bizAddress').value.trim(),
    country:byId('bizCountry').value.trim(),
    businessCode:byId('bizCode').value.trim(),
    remark:byId('bizRemark').value.trim(),
    status:old?.status || 'active',
    updatedAt:nowISO(),
    updatedBy:auth.currentUser?.email || ''
  };

  if (old) {
    const reason = prompt('Reason for editing this business record (required)', '');
    if (!reason?.trim()) return;
    await updateDoc(doc(db, kind+'_profiles', id), rec);
    await writeAudit('EDIT_BUSINESS', kind === 'supplier' ? 'Suppliers' : 'Clients', kind, company, old, rec, reason.trim(), id);
  } else {
    rec.createdAt = nowISO();
    rec.createdBy = auth.currentUser?.email || '';
    const ref = await addDoc(collection(db, kind+'_profiles'), rec);
    await writeAudit('CREATE_BUSINESS', kind === 'supplier' ? 'Suppliers' : 'Clients', kind, company, null, rec, '', ref.id);
  }

  await reload();
  render(kind);
}

async function toggleBusiness(kind, id) {
  if (!can(`${kind}.status`)) return;
  const x = (kind === 'supplier' ? suppliers : clients).find(y => y.id === id);
  if (!x) return;
  const status = x.status === 'inactive' ? 'active' : 'inactive';
  const reason = prompt(`Reason for ${status === 'inactive' ? 'deactivating' : 'activating'} this business (required)`, '');
  if (!reason?.trim()) return;

  await updateDoc(doc(db, kind+'_profiles', id), {
    status,
    updatedAt:nowISO(),
    updatedBy:auth.currentUser?.email || ''
  });
  await writeAudit('CHANGE_BUSINESS_STATUS', kind === 'supplier' ? 'Suppliers' : 'Clients', kind, x.companyName || x[kind+'Name'], {status:x.status || 'active'}, {status}, reason.trim(), id);
  await reload();
  render(kind);
}

function interceptNavigation() {
  document.addEventListener('click', async event => {
    const btn = event.target.closest?.('.navBtn[data-tab="suppliers"], .navBtn[data-tab="clients"]');
    if (!btn) return;
    const kind = btn.dataset.tab === 'suppliers' ? 'supplier' : 'client';
    if (!can(`${kind}.view`)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      await reload();
      render(kind);
    } catch (error) {
      console.warn('IMS business module failed; legacy fallback remains available.', error);
    }
  }, true);
}

interceptNavigation();

window.IMSBusinesses = Object.freeze({ reload, render });
window.dispatchEvent(new CustomEvent('ims:businesses-ready'));

export { reload, render };
