/* ===================== hub app: C4 drill + status dashboard + doc editor ===================== */
function docFor(c){
 var i,d,hay=(c.component+" "+c.plane+" "+c.deliverable).toLowerCase();
 for(i=0;i<DATA.docs.length;i++){d=DATA.docs[i];
  if(d.component_ids&&d.component_ids.indexOf(c.id)>=0)return d.id;}
 for(i=0;i<DATA.docs.length;i++){d=DATA.docs[i];
  if(d.match&&new RegExp(d.match).test(hay))return d.id;}
 for(i=0;i<DATA.docs.length;i++){d=DATA.docs[i];
  if(d.zone_default&&c.zone===d.zone_default)return d.id;}
 return DEFAULT_DOC;
}
var CONTAINERS={
 LZ:["Landing Zone","📥","sFTP / CIFS · file reception + manifest"],
 RAW:["Stage 1 RAW","🧱","Oracle · immutable append-only AD-8 · Python AD-7"],
 ENR:["Stage 2 Enriched","🧪","Oracle · dbt · dedup · conform"],
 GOLD:["Gold (Exadata)","🏆","SCD2 · facts · tie-out AD-9 · Hub-owned AD-1"],
 OUT:["Outbound Producers","📤","one framework · 16 SEI loaders · gated on AD-11"],
 ORCH:["Orchestration","🛠","Airflow on OpenShift · 9-domain fan-out"],
 GW:["API Gateway","🛡","Envoy / Data Plane · real-time lane"],
 META:["Metadata & Config","⚙","feed registry · DQ rules · drives everything"],
 PLATFORM:["OpenShift Platform","🖧","zone 4 — runtime, CI/CD, operations"],
 CROSS:["Cross-cutting & consumers","🧭","monitoring · recon · consumers"]};
var STATUSES=["Not Started","In Design","In Review","Approved","In Build","Complete"];
var STPCT={"Not Started":0,"In Design":20,"In Review":45,"Approved":60,"In Build":80,"Complete":100};
var STCOL={"Not Started":"#9aa7b2","In Design":"#0b5e83","In Review":"#6d3ac0","Approved":"#a8560f","In Build":"#e0a13d","Complete":"#159943"};

/* ---- status store: tracker defaults merged with browser-persisted edits ---- */
var STORE={};
function storeLoad(){
 try{var raw=localStorage.getItem('cp360-hub-status');if(raw)STORE=JSON.parse(raw);}catch(e){STORE={};}
}
function storeSave(){
 try{localStorage.setItem('cp360-hub-status',JSON.stringify(STORE));}catch(e){}
}
function stOf(c){
 var o=STORE[c.id]||{};
 var status=o.status||c.status||"Not Started";
 if(STATUSES.indexOf(status)<0)status=STATUSES.indexOf(c.status)>=0?c.status:"Not Started";
 var pct=("pct" in o)?o.pct:STPCT[status];
 return {status:status,pct:pct,edited:!!STORE[c.id]};
}
function setStatus(id,status){
 STORE[id]=STORE[id]||{};STORE[id].status=status;STORE[id].pct=STPCT[status];
 storeSave();render();
}
function setPct(id,val){
 var v=Math.max(0,Math.min(100,parseInt(val,10)||0));
 STORE[id]=STORE[id]||{};STORE[id].pct=v;
 storeSave();
 var f=document.getElementById('pf'+id);if(f)f.style.width=v+'%';
}
function pctCommit(){render();}
function resetStatus(){STORE={};storeSave();render();}
function exportStatus(){
 var lines=['id,component,container,status,pct'];
 DATA.comps.forEach(function(c){var s=stOf(c);
  lines.push([c.id,'"'+c.component.replace(/"/g,'""')+'"',c.container,'"'+s.status+'"',s.pct].join(','));});
 var a=document.createElement('a');
 a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(lines.join('\n'));
 a.download='hub-component-status.csv';
 document.body.appendChild(a);a.click();a.remove();
}
function overall(filter){
 var t=0,n=0,done=0;
 DATA.comps.forEach(function(c){
  if(filter&&c.container!==filter)return;
  var s=stOf(c);t+=s.pct;n++;if(s.status==="Complete")done++;});
 return {avg:n?Math.round(t/n):0,n:n,done:done};
}

var st={view:"L1",cont:null,doc:null,from:null,editing:false,dq:"",dc:""};
function cnt(k){var n=0;DATA.comps.forEach(function(c){if(c.container===k)n++;});return n;}
function go(v,a,b){
 if(v==="doc"){st.view="doc";st.doc=a;st.from=b||null;}
 else{st.view=v;st.cont=a||null;st.doc=null;st.from=null;st.editing=false;}
 render();window.scrollTo(0,0);
}
function crumbs(){
 var h='<span class="crumb'+(st.view==="L1"?' live':'')+'" onclick="go(\'L1\')">🏛 Hub · L1 + Dashboard</span>';
 if(st.view!=="L1")h+='<span>›</span><span class="crumb'+(st.view==="L2"?' live':'')+'" onclick="go(\'L2\')">L2 Containers</span>';
 if(st.view==="L3"||(st.view==="doc"&&st.cont))h+='<span>›</span><span class="crumb'+(st.view==="L3"?' live':'')+'" onclick="go(\'L3\',st.cont)">L3 '+esc(CONTAINERS[st.cont][0])+'</span>';
 if(st.view==="doc")h+='<span>›</span><span class="crumb live">L4 · '+esc(DOCS[st.doc].title)+'</span>';
 document.getElementById('crumbs').innerHTML=h;
}
function sysBox(x,y,w,label,sub,kind,click){
 var fill=kind==="in"?"#1168bd":kind==="ext"?"#999":"#fff";
 var stroke=kind==="fut"?' stroke="#cc3344" stroke-dasharray="6 4" stroke-width="1.6"':'';
 var tc=kind==="fut"?"#cc3344":"#fff",sc=kind==="fut"?"#c66":(kind==="ext"?"#e8e8e8":"#bcd6ef");
 var lines=sub.split("|"),h=40+lines.length*11;
 var t=lines.map(function(l,i){return '<text x="'+(x+w/2)+'" y="'+(y+40+i*11)+'" font-size="8" fill="'+sc+'" text-anchor="middle">'+l+'</text>';}).join("");
 var g='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="6" fill="'+fill+'"'+stroke+'/>'
  +'<text x="'+(x+w/2)+'" y="'+(y+28)+'" font-size="11" font-weight="700" fill="'+tc+'" text-anchor="middle">'+label+'</text>'+t;
 return click?'<g class="clk" onclick="'+click+'">'+g+'</g>':'<g>'+g+'</g>';
}
function dbBox(x,y,w,label,sub,click,accent){
 accent=accent||"#1168bd";
 var lines=sub.split("|"),h=44+lines.length*10;
 var t=lines.map(function(l,i){return '<text x="'+(x+w/2)+'" y="'+(y+38+i*10)+'" font-size="7.5" fill="#cfe0f2" text-anchor="middle">'+l+'</text>';}).join("");
 var g='<path d="M '+x+' '+(y+8)+' a '+(w/2)+' 8 0 0 1 '+w+' 0 v '+(h-16)+' a '+(w/2)+' 8 0 0 1 -'+w+' 0 z" fill="'+accent+'"/>'
  +'<ellipse cx="'+(x+w/2)+'" cy="'+(y+8)+'" rx="'+(w/2)+'" ry="8" fill="'+accent+'" stroke="#0d5296"/>'
  +'<text x="'+(x+w/2)+'" y="'+(y+27)+'" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">'+label+'</text>'+t;
 return '<g class="clk" onclick="'+click+'">'+g+'</g>';
}
var LANE={batch:"#159943",rt:"#0e8f7e",out:"#a8560f",move:"#159943",
 ctl:"#8a97a3",fut:"#cc3344"};
function relE(x1,y1,x2,y2,label,kind,thick){
 // kind: batch|rt|out|move (ANIMATED, dashes flow source->target, the env360 grammar)
 //       ctl|fut (STATIC dashed — control/ops and future links do not "flow")
 kind=kind||"batch";
 var col=LANE[kind]||"#555";
 var anim=(kind!=="ctl"&&kind!=="fut");
 var cls=anim?(kind==="rt"?"flow fast":"flow"):"still";
 var mx=(x1+x2)/2,my=(y1+y2)/2;
 var w=thick?2.6:(anim?1.8:1.3);
 var lw=label.length*4.6+10;
 return '<path class="'+cls+'" d="M '+x1+' '+y1+' C '+mx+' '+y1+', '+mx+' '+y2+', '+x2+' '+y2+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" marker-end="url(#c4a)"/>'
  +'<rect x="'+(mx-lw/2)+'" y="'+(my-9)+'" width="'+lw+'" height="14" fill="#fff" opacity=".92" rx="3"/>'
  +'<text x="'+mx+'" y="'+(my+2)+'" font-size="8.5" fill="'+col+'" font-style="italic" text-anchor="middle">'+label+'</text>';
}
var DEFS='<defs><marker id="c4a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#555"/></marker></defs>';

function renderDash(){
 var o=overall(null);
 var minis=Object.keys(CONTAINERS).map(function(k){
  var ov=overall(k);
  return '<div><div class="mc">'+CONTAINERS[k][1]+' '+esc(CONTAINERS[k][0])+' · '+ov.avg+'%</div>'
   +'<div class="mb"><div class="mf" style="width:'+ov.avg+'%"></div></div></div>';
 }).join('');
 var rows=DATA.comps.filter(function(c){
  if(st.dc&&c.container!==st.dc)return false;
  if(st.dq&&(c.component+' '+c.plane+' '+c.id).toLowerCase().indexOf(st.dq.toLowerCase())<0)return false;
  return true;});
 var opts='<option value="">all containers</option>'+Object.keys(CONTAINERS).map(function(k){
  return '<option value="'+k+'"'+(st.dc===k?' selected':'')+'>'+esc(CONTAINERS[k][0])+'</option>';}).join('');
 var h='<h2>Component delivery dashboard</h2>'
  +'<div class="sub">status + % are editable — saved in this browser (localStorage) · export CSV to feed the tracker workbook</div>'
  +'<div class="dash"><div class="dsum">'
  +'<div class="big"><b>'+o.avg+'%</b><small>overall completion</small></div>'
  +'<div class="big"><b>'+o.done+'</b><small>of '+o.n+' complete</small></div>'
  +'<div class="mini">'+minis+'</div>'
  +'<span class="xbtn" onclick="exportStatus()">⬇ export CSV</span>'
  +'<span class="xbtn" onclick="resetStatus()" title="clear browser edits, back to tracker statuses">↺ reset</span></div>'
  +'<div class="dctl"><select onchange="st.dc=this.value;render()">'+opts+'</select>'
  +'<span style="font-size:9.5px;color:var(--sub)">'+rows.length+' shown</span>'
  +'<input type="text" class="dsearch" placeholder="Search component…" value="'+esc(st.dq)+'" oninput="st.dq=this.value;render()"></div>'
  +'<div class="drow hd"><span>ID</span><span>Component</span><span>Container</span><span>Progress</span><span>Status</span><span>%</span><span></span></div>';
 rows.forEach(function(c){
  var s=stOf(c),col=STCOL[s.status]||"#9aa7b2";
  var sel=STATUSES.map(function(x){return '<option'+(x===s.status?' selected':'')+'>'+x+'</option>';}).join('');
  h+='<div class="drow"><span class="cid" style="color:'+(Z_C[c.zone]||"#888")+'">'+esc(c.id)+'</span>'
   +'<span class="cn" title="'+esc(c.component)+'">'+esc(c.component)+'</span>'
   +'<span class="ctag" title="'+esc(CONTAINERS[c.container][0])+'">'+CONTAINERS[c.container][1]+' '+esc(CONTAINERS[c.container][0])+'</span>'
   +'<span class="pbar"><span class="pfill" id="pf'+c.id+'" style="width:'+s.pct+'%;background:'+col+'"></span></span>'
   +'<span><select onchange="setStatus(\''+c.id+'\',this.value)">'+sel+'</select></span>'
   +'<span><input type="number" min="0" max="100" value="'+s.pct+'" oninput="setPct(\''+c.id+'\',this.value)" onchange="pctCommit()"></span>'
   +'<span class="edited2">'+(s.edited?'●':'')+'</span></div>';
 });
 return h+'</div>';
}

function renderL1(){
 var s='<svg viewBox="0 0 1280 590">'+DEFS
 +'<g><circle cx="640" cy="42" r="14" fill="#08427b"/><rect x="570" y="58" width="140" height="52" rx="8" fill="#08427b"/>'
 +'<text x="640" y="78" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">CP Data Ops</text>'
 +'<text x="640" y="92" font-size="8" fill="#b8c9dd" text-anchor="middle">runs batch · quarantine · overrides</text></g>'
 +sysBox(60,200,190,"SEI SWP Platform","batch extracts + LOADERS|~30 feeds in · 16 loaders back","ext")
 +sysBox(60,420,190,"SEI SWP APIs","real-time source","ext")
 +sysBox(480,250,320,"CP INTEGRATION HUB","Landing → RAW → Enriched → Gold → publish|inbound + OUTBOUND lanes · real-time lane|▼ CLICK TO OPEN · "+DATA.comps.length+" components inside","in","go('L2')")
 +sysBox(1010,120,210,"PBDW","SYSTEM OF RECORD · existing","in")
 +sysBox(1010,240,210,"Pivotal DB","existing","in")
 +sysBox(1010,345,210,"IMDS","existing","in")
 +sysBox(1010,460,210,"CP DW Canonical","not built this phase","fut")
 +relE(250,235,480,285,"sFTP feeds + manifest [EOD]","batch")
 +relE(480,350,250,270,"16 loaders · submission/ack [AD-11]","out")
 +relE(250,445,480,335,"real-time API [no batch dep]","rt")
 +relE(640,110,640,250,"operates · approves","ctl")
 +relE(800,280,1010,155,"publish [movement only]","move")
 +relE(800,300,1010,270,"publish [movement only]","move")
 +relE(800,320,1010,375,"publish [movement only]","move")
 +relE(800,345,1010,490,"forward-compatible only","fut")
 +'</svg>';
 return '<h1>CP Integration Hub <span class="c4lvl">C4 · L1 CONTEXT</span></h1>'
  +'<div class="sub">feeds in · 16 loaders back (amber, AD-11). Click the Hub to drill into containers — dashboard below tracks delivery.</div>'
  +'<div class="board">'+s+'<div class="legend">'
  +'<span class="lg"><span class="sw2" style="background:#1168bd"></span>in scope</span>'
  +'<span class="lg"><span class="sw2" style="background:#999"></span>external — SEI-owned</span>'
  +'<span class="lg"><span class="sw2" style="background:#fff;border:1.5px dashed #cc3344"></span>future</span>'
  +'<span class="lg" style="color:#159943;font-weight:700">green flow = batch / publish →</span>'
  +'<span class="lg" style="color:#0e8f7e;font-weight:700">teal fast flow = real-time →</span>'
  +'<span class="lg" style="color:#a8560f;font-weight:700">amber flow = OUTBOUND · back to SEI ←</span>'
  +'<span class="lg">static dashed = control / future — no data motion</span></div></div>'
  + renderDash();
}
function renderL2(){
 var s='<svg viewBox="0 0 1280 680">'+DEFS
 +sysBox(24,190,168,"SEI SWP","batch + APIs|+ loader endpoint","ext")
 +'<rect x="236" y="24" width="778" height="628" rx="10" fill="none" stroke="#1168bd" stroke-dasharray="8 5" stroke-width="1.5"/>'
 +'<text x="254" y="46" font-size="11" font-weight="800" fill="#1168bd">CP INTEGRATION HUB — click any container for its components</text>'
 +sysBox(276,80,178,CONTAINERS.LZ[0],"sFTP / CIFS · manifest|▼ "+cnt("LZ")+" components","in","go('L3','LZ')")
 +dbBox(276,212,178,CONTAINERS.RAW[0],"Oracle · AD-8 · AD-7|▼ "+cnt("RAW")+" components","go('L3','RAW')")
 +dbBox(276,342,178,CONTAINERS.ENR[0],"Oracle · dbt|▼ "+cnt("ENR")+" components","go('L3','ENR')")
 +dbBox(556,342,178,CONTAINERS.GOLD[0],"Exadata · AD-9 · AD-1|▼ "+cnt("GOLD")+" components","go('L3','GOLD')")
 +sysBox(556,80,178,CONTAINERS.ORCH[0],"Airflow · fan-out|▼ "+cnt("ORCH")+" components","in","go('L3','ORCH')")
 +sysBox(556,520,178,CONTAINERS.GW[0],"Envoy · real-time|▼ "+cnt("GW")+" components","in","go('L3','GW')")
 +sysBox(796,470,178,CONTAINERS.OUT[0],"16 loaders · AD-11|▼ "+cnt("OUT")+" components","in","go('L3','OUT')")
 +dbBox(796,196,172,CONTAINERS.META[0],"registry · rules|▼ "+cnt("META")+" components","go('L3','META')","#5a6472")
 +sysBox(796,330,172,CONTAINERS.PLATFORM[0],"runtime · CI/CD|▼ "+cnt("PLATFORM")+" components","in","go('L3','PLATFORM')")
 +sysBox(1050,240,200,"PBDW · Pivotal · IMDS","consumers · movement|▼ "+cnt("CROSS")+" cross-cutting","in","go('L3','CROSS')")
 +relE(192,215,276,112,"feeds","batch")+relE(365,142,365,212,"Python load","batch")
 +relE(365,292,365,342,"dbt","batch")
 +relE(454,382,556,382,"DB-link · direct-path · HCC","batch",true)
 +relE(734,382,1050,290,"simple movement","move")
 +relE(645,290,750,490,"outbound extracts","out")
 +relE(796,540,192,255,"loader files/JSON · ack [AD-11]","out")
 +relE(556,120,454,245,"orchestrates","ctl")+relE(796,245,660,135,"drives","ctl")
 +relE(192,245,556,548,"real-time","rt")+'</svg>';
 return '<span class="bk" onclick="go(\'L1\')">← up to Context + Dashboard</span>'
  +'<h1>Containers <span class="c4lvl">C4 · LEVEL 2</span></h1>'
  +'<div class="sub">live counts from the tracker. Amber = outbound lane (AD-11).</div>'
  +'<div class="board">'+s+'</div>';
}
function anatomyChip(d){
 if(!d.anatomy)return '';
 var a=d.anatomy,ok=a.missing.length===0&&a.fm.length===0;
 var iss=a.missing.concat(a.fm);
 var txt=(ok?"✓":"⚠")+" anatomy "+a.score+"/"+a.of+(iss.length?" · "+iss.join(", "):"");
 return '<span class="chip" style="background:'+(ok?"#d9f2e3":"#fae5d3")+';color:'+(ok?"#159943":"#a8560f")+'">'+txt+'</span>';
}
function renderL3(){
 var C=CONTAINERS[st.cont];
 var rows=DATA.comps.filter(function(c){return c.container===st.cont;});
 var ov=overall(st.cont);
 var ad11=st.cont==="OUT"?'<span class="chip" style="background:#fae5d3;color:#a8560f;margin-left:10px">⚠ gated on AD-11</span>':'';
 var h='<span class="bk" onclick="go(\'L2\')">← up to Containers</span>'
  +'<h1>Components <span class="c4lvl">C4 · LEVEL 3</span></h1>'
  +'<div class="chdr"><span class="ic">'+C[1]+'</span><div><b>'+esc(C[0])+'</b>'+ad11+'<small>'+esc(C[2])+'</small></div>'
  +'<div class="cnt"><b>'+ov.avg+'%</b>complete</div><div class="cnt"><b>'+rows.length+'</b>components</div></div>'
  +'<div class="tbl"><div class="trow hd"><span>ID</span><span>Plane</span><span>Component</span><span>Deliverable</span><span>Tech</span><span>Prio</span><span>Status</span><span>Design</span></div>';
 rows.forEach(function(c){
  var dk=docFor(c),d=DOCS[dk],s=stOf(c);
  var lab=d.chip||(d["default"]?"Arch":d.id==="l2-planes"?"Planes":d.id==="l3-stages"?"Stage 1/2":d.id==="l3-errors"?"Errors":d.title);
  h+='<div class="trow"><span class="cid" style="color:'+(Z_C[c.zone]||"#888")+'">'+esc(c.id)+'</span>'
   +'<span class="pl" title="'+esc(c.plane)+'">'+esc(c.plane)+'</span>'
   +'<span class="cn" title="'+esc(c.component)+'">'+esc(c.component)+'</span>'
   +'<span class="dl" title="'+esc(c.deliverable)+'">'+esc(c.deliverable)+'</span>'
   +'<span class="tech">'+esc(c.technology)+'</span>'
   +'<span><span class="chip" style="background:'+(c.priority==="P1"?"#fde8e8":"#eef1f4")+';color:'+(c.priority==="P1"?"#c0392b":"#8a97a3")+'">'+esc(c.priority||"—")+'</span></span>'
   +'<span><span class="chip" style="background:'+(STCOL[s.status]||"#eef1f4")+'22;color:'+(STCOL[s.status]||"#8a97a3")+'">'+esc(s.status.toUpperCase())+' · '+s.pct+'%</span></span>'
   +'<span class="dsg" style="background:'+d.bg+';color:'+d.color+';border-color:'+d.color+'" onclick="go(\'doc\',\''+dk+'\',\''+c.id+'\')">'+d.icon+' '+esc(lab)+' →</span></div>';
 });
 return h+'</div>';
}
function renderL4(){
 var d=DOCS[st.doc];
 var from=st.from?DATA.comps.filter(function(c){return c.id===st.from;})[0]:null;
 var editing=st.editing;
 var toc='<div class="toc"><b>Sections</b>'+d.sections.map(function(s2,i){
  var r=/^6[\.\s]/.test(s2.h.trim())?' rec6':'';
  return '<a class="'+r+'" onclick="var e=document.getElementById(\'sec'+i+'\');if(e&&e.scrollIntoView)e.scrollIntoView({behavior:\'smooth\'})">'+esc(s2.h||("§"+(i+1)))+'</a>';
 }).join("")+'</div>';
 var body='';
 d.sections.forEach(function(sec,i){
  var r=/^6[\.\s]/.test(sec.h.trim())?' rec6':'';
  body+='<div class="scard'+r+'" id="sec'+i+'" style="border-left-color:'+d.color+'">';
  if(sec.h)body+='<div class="sh">'+inline(sec.h)+(editing?'<span id="dirty'+i+'" class="dirty" style="'+((draftKey(d.id,i) in DRAFTS)?'display:inline-block':'')+'">edited</span>':'')+'</div>';
  if(editing){
   body+='<textarea class="eta" oninput="draftUpd(\''+d.id+'\','+i+',this.value,\''+d.color+'\')">'+esc(draftGet(d,i))+'</textarea>'
    +'<div class="eprevlbl">live preview</div>'
    +'<div id="prev'+i+'">'+renderMdSection(draftGet(d,i),d.color)+'</div>';
  }else{
   sec.blocks.forEach(function(b){body+=renderBlock(b,d.color);});
  }
  body+='</div>';
 });
 var meta='';
 if(d.meta&&d.meta.status){
  meta='<div class="meta">'
   +'<span class="chip" style="background:#e8ecf9;color:#4a5fc0">status · '+esc(d.meta.status)+'</span>'
   +'<span class="chip" style="background:#eef1f4;color:#5c6b7a">owner · '+esc(d.meta.owner||"TBD")+'</span>'
   +(d.meta.depends_on.length?'<span class="chip" style="background:#e0f5fd;color:#0b5e83">depends on · '+esc(d.meta.depends_on.join(", "))+'</span>':'')
   +(d.meta.decisions.length?'<span class="chip" style="background:#fde8e8;color:#c0392b">decisions · '+esc(d.meta.decisions.join(", "))+'</span>':'')
   +anatomyChip(d)+'</div>';
 }
 return '<div class="bkbar"><span class="bk" style="margin-bottom:0" onclick="go(\'L3\',st.cont||\'CROSS\')">← back</span>'
  +'<span style="font-size:18px">'+d.icon+'</span><b style="font-size:14.5px;color:var(--navy)">'+esc(d.title)+'</b>'
  +'<span class="chip" style="background:'+d.bg+';color:'+d.color+'">'+d.level+'</span>'
  +(from?'<span style="font-size:10.5px;color:var(--sub)">design context: <b style="color:'+(Z_C[from.zone]||"#333")+'">#'+esc(from.id)+' '+esc(from.component)+'</b></span>':'')
  +'<span style="margin-left:auto;display:flex;gap:8px;align-items:center">'
  +'<span class="ebtn'+(editing?' on':'')+'" onclick="st.editing=!st.editing;render()">'+(editing?'✕ close editor':'✏️ edit')+'</span>'
  +(editing?'<span class="ebtn" onclick="dlDoc(\''+d.id+'\')">⬇ download .md</span><span class="ebtn" onclick="cpyDoc(\''+d.id+'\')">⧉ copy</span><span id="cpyok" style="display:none;font-size:10px;color:#159943;font-weight:700">copied ✓</span>':'')
  +'<span class="src">source: designs-md/'+esc(d.src)+'</span></span></div>'
  +'<div class="dsub2">'+esc(d.sub)+'</div>'+meta
  +(editing?'<div class="ebanner">✏️ <b>Tier-1 local editing</b> — download the .md, drop into <code>designs-md/</code>, run <code>build_design_docs.py</code>. svg / mermaid fences render live.</div>':'')
  +'<div class="docgrid">'+toc+'<div>'+body+'</div></div>';
}
function render(){
 crumbs();
 document.getElementById('app').innerHTML =
  st.view==="L1"?renderL1():st.view==="L2"?renderL2():st.view==="L3"?renderL3():renderL4();
 var q=document.querySelector('.dsearch');
 if(q&&st.dq&&q.setSelectionRange){q.focus&&q.focus();q.setSelectionRange(q.value.length,q.value.length);}
}
document.addEventListener('keydown',function(e){
 if(e.key!=='Escape')return;
 var ov=document.getElementById('zoomov');
 if(ov&&ov.className==='on'){zoomClose();return;}
 if(st.view==="doc")go('L3',st.cont||'CROSS');
 else if(st.view==="L3")go('L2');
 else if(st.view==="L2")go('L1');
});
storeLoad();render();zoomWire();
