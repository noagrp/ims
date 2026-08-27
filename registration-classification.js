import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const ROLE=window.IMS_ROLE||'admin';
const byId=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const field=(t,h)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${t}</span>${h}</label>`;
const now=()=>new Date().toISOString();
let cache=null;

async function loadSettings(){
  if(cache)return cache;
  const snap=await getDocs(collection(db,'settings'));
  cache=snap.docs.map(d=>({id:d.id,...d.data()}));
  return cache;
}
function selected(id){const e=byId(id),o=e?.selectedOptions?.[0];return{id:e?.value||'',value:o?.dataset?.v||o?.textContent?.trim()||''};}
function option(x){return `<option value="${esc(x.id)}" data-v="${esc(x.value)}">${esc(x.value)}</option>`;}
function categoryOk(x,cat){return !x.category||!cat||norm(x.category)===norm(cat);}
function brandOk(x,b){return (!x.brand&&!x.brandId)||x.brandId===b.id||norm(x.brand)===norm(b.value);}
function modelOk(x,m){return (!x.model&&!x.modelId)||x.modelId===m.id||norm(x.model)===norm(m.value);}
function gradeOk(x,g){return (!x.grade&&!x.gradeId)||x.gradeId===g.id||norm(x.grade)===norm(g.value);}

async function refresh(level='category'){
  const all=(await loadSettings()).filter(x=>x.status!=='inactive');
  const cat=byId('itemCategory')?.value||'',b=byId('itemBrand'),m=byId('itemModel'),g=byId('itemGrade'),s=byId('itemSpecification');
  if(!b||!m||!g||!s)return;
  if(level==='category'){
    const old=b.value,rows=all.filter(x=>x.type==='brand'&&categoryOk(x,cat));
    b.innerHTML='<option value="">-- Brand --</option>'+rows.map(option).join('');if([...b.options].some(o=>o.value===old))b.value=old;
  }
  const brand=selected('itemBrand');
  if(level==='category'||level==='brand'){
    const old=m.value,rows=all.filter(x=>x.type==='model'&&categoryOk(x,cat)&&brandOk(x,brand));
    m.innerHTML='<option value="">-- Model --</option>'+rows.map(option).join('');if([...m.options].some(o=>o.value===old))m.value=old;
  }
  const model=selected('itemModel');
  if(level!=='grade'&&level!=='specification'){
    const old=g.value,rows=all.filter(x=>x.type==='grade'&&categoryOk(x,cat)&&brandOk(x,brand)&&modelOk(x,model));
    g.innerHTML='<option value="">-- Grade --</option>'+rows.map(option).join('');if([...g.options].some(o=>o.value===old))g.value=old;
  }
  const grade=selected('itemGrade');
  const old=s.value,rows=all.filter(x=>x.type==='specification'&&categoryOk(x,cat)&&brandOk(x,brand)&&modelOk(x,model)&&gradeOk(x,grade));
  s.innerHTML='<option value="">-- Specification --</option>'+rows.map(option).join('');if([...s.options].some(o=>o.value===old))s.value=old;
}

async function persistClassification(code,meta){
  for(let i=0;i<8;i++){
    const q=await getDocs(query(collection(db,'inventory'),where('itemCode','==',code)));
    if(!q.empty){
      const ref=q.docs[0];
      await updateDoc(doc(db,'inventory',ref.id),meta);
      await addDoc(collection(db,'audit_traces'),{
        traceVersion:3,actionType:'SET_ITEM_CLASSIFICATION',module:'Main Workspace',targetType:'inventory',targetName:code,targetId:ref.id,
        summary:`Set Item Classification: ${code}`,beforeValue:null,afterValue:meta,changedFields:['brand','model','grade','specification'],remark:'Classification captured during registration.',metadata:{source:'registration-classification.js'},performedBy:auth.currentUser?.email||'',performedByRole:ROLE,performedAt:now()
      });
      return;
    }
    await new Promise(r=>setTimeout(r,500));
  }
}

function captureOnSubmit(e){
  if(e.target?.id!=='registerForm')return;
  const code=byId('itemCode')?.value.trim();if(!code||!byId('itemBrand'))return;
  const b=selected('itemBrand'),m=selected('itemModel'),g=selected('itemGrade'),s=selected('itemSpecification');
  const meta={brandId:b.id,brand:b.value,modelId:m.id,model:m.value,gradeId:g.id,grade:g.value,specificationId:s.id,specification:s.value,lastEditedAt:now(),lastEditedBy:auth.currentUser?.email||''};
  setTimeout(()=>persistClassification(code,meta).catch(err=>console.warn('IMS classification save unavailable:',err)),250);
}

async function mount(){
  const form=byId('registerForm'),cat=byId('itemCategory');if(!form||!cat||byId('itemBrand'))return;
  const wrap=document.createElement('div');wrap.id='imsRegistrationClassification';wrap.className='sm:col-span-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3';
  wrap.innerHTML=field('Brand (optional)',`<select id="itemBrand" class="${cls}"><option value="">-- Brand --</option></select>`)+field('Model (optional)',`<select id="itemModel" class="${cls}"><option value="">-- Model --</option></select>`)+field('Grade (optional)',`<select id="itemGrade" class="${cls}"><option value="">-- Grade --</option></select>`)+field('Specification (optional)',`<select id="itemSpecification" class="${cls}"><option value="">-- Specification --</option></select>`);
  cat.closest('label')?.insertAdjacentElement('afterend',wrap);
  cat.addEventListener('change',()=>refresh('category'));
  byId('itemBrand').addEventListener('change',()=>refresh('brand'));
  byId('itemModel').addEventListener('change',()=>refresh('model'));
  byId('itemGrade').addEventListener('change',()=>refresh('grade'));
  try{await refresh('category');}catch(err){console.warn('IMS registration classifications unavailable:',err);}
}

document.addEventListener('submit',captureOnSubmit,true);
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mount,20);}).observe(document.body,{childList:true,subtree:true});mount();
