import { auth, db } from './firebase-config.js';
import { addDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const byId=id=>document.getElementById(id);
const norm=s=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cls='w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm';
const field=(t,h)=>`<label class="block text-xs text-slate-400"><span class="block mb-1">${t}</span>${h}</label>`;
const now=()=>new Date().toISOString();
let saving=false;

async function loadSettings(){const s=await getDocs(collection(db,'settings'));return s.docs.map(d=>({id:d.id,...d.data()}));}
async function createIfMissing(type,data,all){
  if(!data.value)return null;
  const existing=all.find(r=>r.type===type&&r.status!=='inactive'&&norm(r.value)===norm(data.value)&&norm(r.category||'')===norm(data.category||'')&&norm(r.brand||'')===norm(data.brand||'')&&norm(r.model||'')===norm(data.model||'')&&norm(r.grade||'')===norm(data.grade||''));
  if(existing)return existing;
  const rec={type,...data,status:'active',createdAt:now(),createdBy:auth.currentUser?.email||''};
  const ref=await addDoc(collection(db,'settings'),rec);const made={id:ref.id,...rec};all.push(made);return made;
}
async function save(e){
  e.preventDefault();if(saving)return;
  const category=byId('imsClassCat')?.value.trim()||'',brand=byId('imsClassBrand')?.value.trim()||'',model=byId('imsClassModel')?.value.trim()||'',grade=byId('imsClassGrade')?.value.trim()||'',specification=byId('imsClassSpec')?.value.trim()||'';
  if(!category){alert('Select a category.');return;}
  if(!brand&&!model&&!grade&&!specification){alert('Enter at least Brand, Model, Grade or Specification.');return;}
  saving=true;const btn=e.currentTarget.querySelector('button');if(btn)btn.disabled=true;
  try{
    const all=await loadSettings();
    if(brand)await createIfMissing('brand',{category,value:brand},all);
    if(model)await createIfMissing('model',{category,brand,value:model},all);
    if(grade)await createIfMissing('grade',{category,brand,model,value:grade},all);
    if(specification)await createIfMissing('specification',{category,brand,model,grade,value:specification},all);
    alert('Classification saved. Existing matching values were kept; only missing values were added.');location.reload();
  }catch(err){console.error('IMS classification save failed:',err);alert(err?.message||String(err));}
  finally{saving=false;if(btn)btn.disabled=false;}
}
async function simplify(){
  const mgr=byId('imsClassificationManager');if(!mgr||byId('imsUnifiedClassificationForm'))return;
  const old=mgr.querySelector('.space-y-4');if(!old)return;
  const settings=await loadSettings(),cats=settings.filter(x=>x.type==='category'&&x.status!=='inactive');
  const form=document.createElement('form');form.id='imsUnifiedClassificationForm';form.className='grid sm:grid-cols-2 xl:grid-cols-[200px_1fr_1fr_1fr_1fr_auto] gap-2 items-end';
  form.innerHTML=field('Category',`<select id="imsClassCat" required class="${cls}"><option value="">-- Category --</option>${cats.map(x=>`<option>${esc(x.value)}</option>`).join('')}</select>`)+field('Brand (optional)',`<input id="imsClassBrand" class="${cls}" placeholder="e.g. WELLORA">`)+field('Model (optional)',`<input id="imsClassModel" class="${cls}" placeholder="e.g. Non-Mag">`)+field('Grade (optional)',`<input id="imsClassGrade" class="${cls}" placeholder="e.g. P550">`)+field('Specification (optional)',`<input id="imsClassSpec" class="${cls}" placeholder="e.g. 1001">`)+'<button class="bg-emerald-700 px-4 py-2.5 rounded-lg text-xs font-bold">Add Classification</button>';
  old.replaceWith(form);form.addEventListener('submit',save);
  const p=mgr.querySelector('p');if(p)p.textContent='Enter the hierarchy once. Brand, Model, Grade and Specification are optional; the system creates only missing master values.';
}
let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>simplify().catch(err=>console.warn('IMS classification UI unavailable:',err)),20);}).observe(document.body,{childList:true,subtree:true});simplify().catch(err=>console.warn('IMS classification UI unavailable:',err));
