import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const byId=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const field=(t,h)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${t}</span>${h}</label>`;
let cache=null;

async function loadSettings(){
  if(cache)return cache;
  const snap=await getDocs(collection(db,'settings'));
  cache=snap.docs.map(d=>({id:d.id,...d.data()}));
  return cache;
}
function selected(id){const e=byId(id),o=e?.selectedOptions?.[0];return{id:e?.value||'',value:o?.dataset?.v||o?.textContent?.trim()||''};}
function option(x){return `<option value="${esc(x.id)}" data-v="${esc(x.value)}">${esc(x.value)}</option>`;}

async function refresh(level='category'){
  const all=(await loadSettings()).filter(x=>x.status!=='inactive');
  const cat=byId('itemCategory')?.value||'',b=byId('itemBrand'),m=byId('itemModel'),s=byId('itemSpecification');if(!b||!m||!s)return;
  if(level==='category'){
    const old=b.value,rows=all.filter(x=>x.type==='brand'&&(!x.category||!cat||norm(x.category)===norm(cat)));
    b.innerHTML='<option value="">-- Brand --</option>'+rows.map(option).join('');if([...b.options].some(o=>o.value===old))b.value=old;
  }
  const brand=selected('itemBrand');
  if(level!=='model'){
    const old=m.value,rows=all.filter(x=>x.type==='model'&&(!x.category||!cat||norm(x.category)===norm(cat))&&(!x.brand&&!x.brandId||x.brandId===brand.id||norm(x.brand)===norm(brand.value)));
    m.innerHTML='<option value="">-- Model --</option>'+rows.map(option).join('');if([...m.options].some(o=>o.value===old))m.value=old;
  }
  const model=selected('itemModel');
  const old=s.value,rows=all.filter(x=>x.type==='specification'&&(!x.category||!cat||norm(x.category)===norm(cat))&&(!x.brand&&!x.brandId||x.brandId===brand.id||norm(x.brand)===norm(brand.value))&&(!x.model&&!x.modelId||x.modelId===model.id||norm(x.model)===norm(model.value)));
  s.innerHTML='<option value="">-- Specification --</option>'+rows.map(option).join('');if([...s.options].some(o=>o.value===old))s.value=old;
}

async function mount(){
  const form=byId('registerForm'),cat=byId('itemCategory');if(!form||!cat||byId('itemBrand'))return;
  const wrap=document.createElement('div');wrap.id='imsRegistrationClassification';wrap.className='sm:col-span-2 grid sm:grid-cols-3 gap-3';
  wrap.innerHTML=field('Brand (optional)',`<select id="itemBrand" class="${cls}"><option value="">-- Brand --</option></select>`)+field('Model (optional)',`<select id="itemModel" class="${cls}"><option value="">-- Model --</option></select>`)+field('Specification (optional)',`<select id="itemSpecification" class="${cls}"><option value="">-- Specification --</option></select>`);
  cat.closest('label')?.insertAdjacentElement('afterend',wrap);
  cat.addEventListener('change',()=>refresh('category'));
  byId('itemBrand').addEventListener('change',()=>refresh('brand'));
  byId('itemModel').addEventListener('change',()=>refresh('model'));
  try{await refresh('category');}catch(err){console.warn('IMS registration classifications unavailable:',err);}
}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mount,20);}).observe(document.body,{childList:true,subtree:true});mount();
