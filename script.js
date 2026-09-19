let books=[],editing=null,sortAZ=true;
const $=id=>document.getElementById(id);
const gradients=[["#0f172a","#475569"],["#3b0764","#9333ea"],["#064e3b","#10b981"],["#172554","#3b82f6"],["#431407","#ea580c"],["#3f3f46","#a1a1aa"]];
async function init(){let saved=localStorage.getItem("auroraBooks");books=saved?JSON.parse(saved):await (await fetch("books.json")).json();render();$("yearNow").textContent=new Date().getFullYear()}
function persist(){localStorage.setItem("auroraBooks",JSON.stringify(books))}
function render(){
 let q=$("search").value.toLowerCase(),tag=$("tagFilter").value;
 let list=books.map((b,i)=>({...b,index:i})).filter(b=>(!q||`${b.title} ${b.author} ${b.tag}`.toLowerCase().includes(q))&&(!tag||b.tag===tag));
 list.sort((a,b)=>sortAZ?a.title.localeCompare(b.title):Number(b.year)-Number(a.year));
 $("bookGrid").innerHTML=list.map((b,n)=>card(b,n)).join("");
 $("empty").classList.toggle("hidden",list.length>0);
 $("total").textContent=books.length;
 $("authors").textContent=new Set(books.map(b=>b.author.toLowerCase())).size;
 $("tagged").textContent=new Set(books.filter(b=>b.tag).map(b=>b.tag)).size;
 $("latest").textContent=books.length?Math.max(...books.map(b=>Number(b.year)||0)):"—";
 let tags=[...new Set(books.map(b=>b.tag).filter(Boolean))].sort();
 $("tagFilter").innerHTML='<option value="">All collections</option>'+tags.map(t=>`<option ${t===tag?"selected":""}>${esc(t)}</option>`).join("");
}
function card(b,n){
 let g=gradients[b.index%gradients.length];
 return `<article class="book"><div class="cover" style="--c1:${g[0]};--c2:${g[1]}">
 <div class="cover-title">${esc(b.title)}</div><div class="cover-author">${esc(b.author)}</div><div class="cover-num">${String(n+1).padStart(2,"0")}</div></div>
 <h3 title="${esc(b.title)}">${esc(b.title)}</h3><div class="author">${esc(b.author)}</div>
 <div class="meta"><span class="pill">${esc(b.tag||"Unsorted")}</span><span class="book-actions"><button onclick="editBook(${b.index})">Edit</button><button onclick="removeBook(${b.index})">Delete</button></span></div></article>`
}
function openModal(i=null){editing=i;$("modal").classList.remove("hidden");$("modalTitle").textContent=i===null?"Add a book":"Edit book";if(i!==null){let b=books[i];$("title").value=b.title;$("author").value=b.author;$("year").value=b.year;$("tag").value=b.tag||""}else $("bookForm").reset();setTimeout(()=>$("title").focus(),100)}
function closeModal(){$("modal").classList.add("hidden");editing=null}
function editBook(i){openModal(i)}
function removeBook(i){if(confirm(`Remove “${books[i].title}” from your library?`)){books.splice(i,1);persist();render()}}
$("bookForm").onsubmit=e=>{e.preventDefault();let b={title:$("title").value.trim(),author:$("author").value.trim(),year:Number($("year").value),tag:$("tag").value.trim()};if(!b.title||!b.author||!b.year)return;if(editing===null)books.push(b);else books[editing]=b;persist();render();closeModal()}
$("addBtn").onclick=$("heroAdd").onclick=()=>openModal();
$("closeBtn").onclick=closeModal;$("modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
$("search").oninput=render;$("tagFilter").onchange=render;
$("sortBtn").onclick=()=>{sortAZ=!sortAZ;$("sortBtn").textContent=sortAZ?"A–Z ↕":"Year ↕";render()};
$("themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("auroraDark",document.body.classList.contains("dark"))};
if(localStorage.getItem("auroraDark")==="true")document.body.classList.add("dark");
document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("search").focus()}if(e.key==="Escape")closeModal()});
$("exportBtn").onclick=()=>{let blob=new Blob([JSON.stringify(books,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="aurora-books.json";a.click();URL.revokeObjectURL(a.href)};
$("importBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let d=JSON.parse(r.result);if(!Array.isArray(d))throw Error();books=d;persist();render()}catch{alert("Invalid JSON library file.")}};r.readAsText(f)};
document.querySelectorAll(".nav[data-view]").forEach(x=>x.onclick=()=>{document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active"));x.classList.add("active");let v=x.dataset.view;if(v==="recent"){sortAZ=false;$("sectionTitle").textContent="Recently added";$("sectionMeta").textContent="Your newest additions";}else if(v==="tags"){$("sectionTitle").textContent="Collections";$("sectionMeta").textContent="Browse by subject";}else{$("sectionTitle").textContent="Your Library";$("sectionMeta").textContent="All your books in one place"}render()});
function esc(x){return String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
init();
