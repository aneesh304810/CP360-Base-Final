// EnvTopology.jsx — Environment 360 · Network Topology (workbook-driven, probe-live)
// LIVE-first: GET /env-infra + /probes/live; DEMO fallback: embedded workbook + sim pulse.
// House patterns: inline styles, DEMO→LIVE banner, event delegation on SVG strings.
import { useEffect, useRef, useState } from "react";

/* ============ engine (ported 1:1 from the approved mockup) ============ */

var SHEET=`Layer\tSystem\tNew_SEI_Hosts_or_Endpoint\tSizing_RAM\tSizing_CPU\tSizing_Storage_or_Capacity\tGrowth\tHosting\tDirection\tProtocol_Port\tStatus_or_Notes
Platform\tCP Integration Hub\tOCPQ shared OpenShift cluster - RD DEV namespace\t4 GB\t2\t10GB\tTBD\tBBH OpenShift\tBidirectional\tTBD\tnamespace TBD
File System\tCPHUB Landing Share\t\\\\rdwebfs.testbbh.com\\cphub$\tNA\tNA\t20GB\tTBD\tBBH\tInternal\tTBD\tregional share
Database\tIMDS\tdvlimdsdb.testbbh.com; dvlimdsapp.testbbh.com\t62 GB\t8\t6 TB\tMin\tBBH\tInternal\tOracle JDBC port TBD\tDEV
Database\tPBDW\tdvlpbdb1.testbbh.com; rtlodiapp3t.testbbh.com\t62 GB\t8\t4 TB\tMin\tBBH\tInternal\tTBD\tDEV
Consumer\tPivotal\tQCWPIVDEVSEI2; QCWPIVDEVSEI4; QCWPIVDEVSEI5\t16 GB\t4\tC100 D250\tMin\tBBH\tOutbound\tTBD\tDEV
Consumer\tCRD\tAzure-hosted vendor application\tVM\tVM\tVM\tTBD\tVendor Azure\tOutbound\tTBD\tCRD TBD
Consumer\tClient Portal\tdvltasap235.testbbh.com\t12 GB\t2\t350 GB\tTBD\tBBH RHEL\tOutbound\tTBD\tDEV
Consumer\tPORT\tNew PORT test instance\tVM\tVM\t25 accts\tTBD\tBloomberg\tOutbound\tTBD\ttest care
Platform\tCP Integration Hub\tOCPQ shared OpenShift cluster - RD SIT namespace\t4 GB\t2\t10GB\tTBD\tBBH OpenShift\tBidirectional\tTBD\tSIT on RD
File System\tCPHUB Landing Share\t\\\\rdwebfs.testbbh.com\\cphub$\tNA\tNA\t20GB\tTBD\tBBH\tInternal\tTBD\tfolder TBD
Database\tIMDS\tqblimdsdb.testbbh.com; qblimdsapp.testbbh.com\t62 GB\t8\t6 TB\tMin\tBBH\tInternal\tOracle JDBC port TBD\tSIT
Database\tPBDW\tQALPBDB3; qalodiapp3sei; qalodidb3sei\t62 GB\t8\t4 TB\tMin\tBBH\tInternal\tTBD\tSIT
Consumer\tPivotal\tQCWPIVAPMTRSEI; QCWPIVSEIDB6; QCWPIVINTSEI1\t16 GB\t4\tC100 D250\tMin\tBBH\tOutbound\tTBD\tSIT
Consumer\tCRD\tAzure-hosted vendor application\tVM\tVM\tVM\tTBD\tVendor Azure\tOutbound\tTBD\tCRD TBD
Consumer\tClient Portal\trdltasap235.testbbh.com\t12 GB\t2\t350 GB\tTBD\tBBH RHEL\tOutbound\tTBD\tSIT
Consumer\tPORT\tNew PORT test instance\tVM\tVM\t25 accts\tTBD\tBloomberg\tOutbound\tTBD\ttest care
Platform\tCP Integration Hub\tOCPQ shared OpenShift cluster - QC namespace\t4 GB\t2\t10GB\tTBD\tBBH OpenShift\tBidirectional\tTBD\tUAT on QC
File System\tCPHUB Landing Share\t\\\\qcwebfs.testbbh.com\\cphub$\tNA\tNA\t20GB\tTBD\tBBH\tInternal\tTBD\tQC share
Database\tIMDS\trdlimdsdb.testbbh.com; rdlimdsapp.testbbh.com\t62 GB\t8\t6 TB\tMin\tBBH\tInternal\tOracle JDBC port TBD\tUAT
Database\tPBDW\tQCLPBDB3; qclodiapp3sei; qclodidb3sei\t62 GB\t8\t4 TB\tMin\tBBH\tInternal\tTBD\tUAT
Consumer\tPivotal\tAUPGSEI1/2; SEIDB4/5; INTSEI2\t16 GB\t4\tC100 D250\tMin\tBBH\tOutbound\tTBD\tUAT
Consumer\tCRD\tAzure-hosted vendor application\tVM\tVM\tTBD\tTBD\tVendor Azure\tOutbound\tTBD\tCRD TBD
Consumer\tClient Portal\tqcltasap235.testbbh.com\t12 GB\t2\t350 GB\tTBD\tBBH RHEL\tOutbound\tTBD\tUAT
Consumer\tPORT\tNew PORT test instance\tVM\tVM\t25 accts\tTBD\tBloomberg\tOutbound\tTBD\ttest care
Platform\tCP Integration Hub\tProduction OpenShift cluster and namespace TBD\t16GB\t16\t25GB\tTBD\tBBH OpenShift\tBidirectional\tTBD\tPROD TBD
File System\tCPHUB Landing Share\tProduction cphub share TBD\tNA\tNA\t20GB\tTBD\tBBH\tInternal\tTBD\tPROD TBD
Database\tIMDS\tnjlimdsdb.bbh.com; njlimdsapp.bbh.com\t62GB\t8\t6TB\tTBD\tBBH\tInternal\tOracle JDBC port TBD\tPROD
Database\tPBDW\tnjlpbdb3; njlodiapp3sei; njlodidb3sei\t62GB\t8\t6TB\tTBD\tBBH\tInternal\tTBD\tPROD
Consumer\tPivotal\tNJWPIVCRM x6\t16GB\t4\t100GB\tTBD\tBBH\tOutbound\tTBD\tPROD
Consumer\tCRD\tCRD production vendor environment\tVM\tVM\tVM\tTBD\tVendor Azure\tOutbound\tTBD\tPROD
Consumer\tClient Portal\tnjtasap12 x4\t12GB\t2\t350GB\tTBD\tBBH RHEL\tOutbound\tTBD\tPROD
Consumer\tPORT\tBloomberg PORT production\tVM\tVM\t25 accts\tTBD\tBloomberg\tOutbound\tTBD\tPROD
External API\tSEI API Proxy Egress\t192.200.8.0/24; 192.200.5.0/24; 204.136.26.0/24\tNA\tNA\tNA\tTBD\tBBH to SEI\tOutbound\tHTTPS 443\twhitelist at SEI
External SFTP\tSEI to BBH SFTP\tqcsecureftp.bbh.com\tNA\tNA\tNA\tTBD\tBBH MFT\tInbound\tSFTP 22\tSEI IPs at BBH
External SFTP\tSEI to BBH SFTP\tsecureftp.bbh.com\tNA\tNA\tNA\tTBD\tBBH MFT\tInbound\tSFTP 22\tPROD seiswp_sftp`;
var ENVO=["DEV","SIT","TRIAL_UAT","PROD"];
function wbParse(text){
 var lines=text.replace(/\r/g,"").split("\n").filter(function(l){return l.trim();});
 var hdr=lines[0].split("\t"),out=[],idx=-1;
 if(hdr[0]!=="Layer")throw "missing Layer column";
 for(var li=1;li<lines.length;li++){
  var c=lines[li].split("\t"),r={};hdr.forEach(function(h,k){r[h]=(c[k]||"").trim();});
  if(!r.Layer)continue;
  var envs;
  if(r.Layer==="Platform"&&r.System.indexOf("Integration Hub")>=0){idx++;if(idx>3)throw "too many Platform blocks";}
  if(r.Layer.indexOf("External")===0){
   envs=r.New_SEI_Hosts_or_Endpoint.indexOf("qcsecureftp")>=0?["DEV","SIT","TRIAL_UAT"]:
    (r.New_SEI_Hosts_or_Endpoint.indexOf("secureftp")>=0?["PROD"]:ENVO.slice());
  }else{
   if(idx<0)throw "row before first Platform block";
   envs=[ENVO[idx]];
  }
  envs.forEach(function(env){out.push({env:env,layer:r.Layer,system:r.System,
   hosts:r.New_SEI_Hosts_or_Endpoint,port:r.Protocol_Port||"",notes:r.Status_or_Notes||""});});
 }
 if(idx!==3)throw "expected 4 environment blocks, found "+(idx+1);
 return out;
}
var ROWS=wbParse(SHEET);
function fRow(env,layer,frag){return ROWS.filter(function(r){return r.env===env&&r.layer===layer&&r.system.indexOf(frag)>=0;})[0];}
function short(h){return (h||"").split(";")[0].split(".")[0].trim();}
function envModel(env){
 var hub=fRow(env,"Platform","Integration Hub"),cif=fRow(env,"File System","Landing"),
     im=fRow(env,"Database","IMDS"),pb=fRow(env,"Database","PBDW"),
     pv=fRow(env,"Consumer","Pivotal"),po=fRow(env,"Consumer","Client Portal"),
     sf=fRow(env,"External SFTP","SFTP");
 return {tag:hub?hub.hosts.replace(/OCPQ shared OpenShift cluster - /,"").slice(0,22):"?",
  sftp:sf?sf.hosts:"?",share:cif?short(cif.hosts.replace(/\\\\/g,"")).slice(0,20)+" · cphub$":"?",
  imds:im?short(im.hosts):"?",pbdw:pb?short(pb.hosts):"?",
  piv:pv?pv.hosts.slice(0,26):"?",portal:po?short(po.hosts):"?"};
}
var KNOWN=[["Platform","Integration Hub"],["File System","Landing"],["Database","IMDS"],["Database","PBDW"],["Consumer","Pivotal"],["Consumer","Client Portal"],["Consumer","CRD"],["Consumer","PORT"],["External SFTP","SFTP"],["External API","Egress"]];
var AUTOZ={"Database":{x:1062,base:400,step:96,src:"app.hub",fw:1030},"Consumer":{x:1312,base:300,step:80,src:"data.pbdw",fw:1280},"File System":{x:282,base:300,step:80,src:"app.hub",fw:740},"External API":{x:30,base:240,step:80,src:"dmz.apigee",fw:250},"External SFTP":{x:30,base:240,step:80,src:"dmz.apigee",fw:250}};
function autoRows(env){
 return ROWS.filter(function(r){
  if(r.env!==env||!(r.layer in AUTOZ))return false;
  return !KNOWN.some(function(k){return r.layer===k[0]&&r.system.indexOf(k[1])>=0;});
 });
}
var RULEQ={"sei-mft":["External SFTP","SFTP"],"cifs-hub":["File System","Landing"],
 "hub-imds":["Database","IMDS"],"hub-pbdw":["Database","PBDW"],
 "pbdw-piv":["Consumer","Pivotal"],"pbdw-portal":["Consumer","Client Portal"],
 "apigee-sei":["External API","Egress"],"apigee-vendor":["Consumer","CRD"]};
function ruleFor(env,id){
 var q=RULEQ[id];if(!q)return null;
 var r=fRow(env,q[0],q[1]);if(!r)return {label:"?",tbd:true};
 var pp=r.port||"TBD",tbd=pp.toUpperCase().indexOf("TBD")>=0;
 var m=pp.match(/(\d{2,5})/);
 return {label:tbd?"port TBD":(m?m[1]:pp),tbd:tbd};
}
var NODEQ={"dmz.mft":["External SFTP","SFTP"],"dmz.cifs":["File System","Landing"],
 "app.hub":["Platform","Integration Hub"],"data.imds":["Database","IMDS"],"data.pbdw":["Database","PBDW"],
 "cons.piv":["Consumer","Pivotal"],"cons.portal":["Consumer","Client Portal"],"cons.vendor":["Consumer","CRD"],
 "ext.seiapi":["External API","Egress"]};
function probeDef(env,nid){
 var q=NODEQ[nid];var r=q?fRow(env,q[0],q[1]):null;
 if(!r){ // auto components
  var a=autoRows(env).filter(function(x){
   var id2=(x.layer==="Database"?"data.":x.layer==="Consumer"?"cons.":x.layer==="File System"?"dmz.":"ext.")+x.system.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,14);
   return id2===nid;})[0];
  r=a||null;
 }
 if(!r)return null;
 var pp=r.port||"TBD";
 if(q&&q[0]==="External SFTP")return {armed:true,port:22};
 var m=pp.match(/(\d{2,5})/);
 return {armed:pp.toUpperCase().indexOf("TBD")<0&&!!m,port:m?m[1]:null};
}
function probeCounts(env){
 var a=0,w=0;
 Object.keys(NODEQ).forEach(function(nid){var d=probeDef(env,nid);if(d){d.armed?a++:w++;}});
 autoRows(env).forEach(function(x){var pp=(x.port||"TBD").toUpperCase();pp.indexOf("TBD")<0&&/\d/.test(pp)?a++:w++;});
 return {armed:a,waiting:w};
}
var WBDIFF=null;
function dl(){var b=new Blob([SHEET],{type:"text/tab-separated-values"});
 var a=document.createElement("a");a.href=URL.createObjectURL(b);
 a.download="cp_env_infrastructure.tsv";a.click();}
function ul(ev){var f=ev.target.files[0];if(!f)return;
 var rd=new FileReader();
 rd.onload=function(){
  try{var nw=wbParse(rd.result);
   var cm={};ROWS.forEach(function(r){cm[r.env+"|"+r.layer+"|"+r.system]=JSON.stringify(r);});
   var ch=0,ad=0;nw.forEach(function(r){var k=r.env+"|"+r.layer+"|"+r.system;
    if(!(k in cm))ad++;else if(cm[k]!==JSON.stringify(r))ch++;});
   var beforeArmed={};Object.keys(NODEQ).forEach(function(nid){var d=probeDef(cur,nid);if(d)beforeArmed[nid]=d.armed;});
   ROWS=nw;SHEET=rd.result;
   var pc=probeCounts(cur);
   WBDIFF={ok:1,msg:"IMPORT ACCEPTED · "+ad+" added · "+ch+" changed — board regenerated · probes: "+pc.armed+" ARMED / "+pc.waiting+" WAITING"};
   FEED.push(["",clock()+"  workbook import → probe registry regenerated ("+pc.armed+" armed, "+pc.waiting+" waiting)"]);
   Object.keys(NODEQ).forEach(function(nid){var d=probeDef(cur,nid);
    if(d&&d.armed&&beforeArmed[nid]===false){delete ST[nid];
     FEED.push(["",clock()+"  "+cur+"."+nid+"  ⚡ probe ARMED @ port "+d.port+" — first result next cycle"]);}});
  }catch(e){WBDIFF={ok:0,msg:"IMPORT REJECTED — "+e+" (board unchanged)"};}
  ev.target.value="";pulse();
 };rd.readAsText(f);}
var ENVS={
 DEV:{tag:"OCPQ · RD-DEV",sftp:"qcsecureftp.bbh.com",share:"rdwebfs · cphub$",imds:"dvlimdsdb",pbdw:"dvlpbdb1",piv:"QCWPIVDEVSEI2/4/5",portal:"dvltasap235"},
 SIT:{tag:"OCPQ · RD-SIT",sftp:"qcsecureftp.bbh.com",share:"rdwebfs · cphub$",imds:"qblimdsdb",pbdw:"QALPBDB3",piv:"APMTRSEI·SEIDB6·INTSEI1",portal:"rdltasap235"},
 "TRIAL/UAT":{tag:"OCPQ · QC",sftp:"qcsecureftp.bbh.com",share:"qcwebfs · cphub$",imds:"rdlimdsdb",pbdw:"QCLPBDB3",piv:"AUPGSEI1/2·SEIDB4/5",portal:"qcltasap235"},
 PROD:{tag:"PROD · TBD",sftp:"secureftp.bbh.com",share:"prod share TBD",imds:"njlimdsdb",pbdw:"njlpbdb3",piv:"NJWPIVCRM ×6",portal:"njtasap12 ×4"}
};
var cur="DEV",tick=0,ST={},FEED=[],SEL=null;
function selLane(i){SEL=(SEL===i?null:i);render();}
var W=190,H=52;
var ZONES=[["EXTERNAL · SEI / VENDOR",20,210],["DMZ · MFT / EGRESS",270,220],["CORP · USERS / MGMT",530,190],
 ["CP INTEGRATION HUB · OPENSHIFT",760,250],["DATA ZONE",1050,210],["CONSUMERS",1300,240]];
var FWS=[["FW-EDGE",250],["FW-DMZ",510],["FW-APP",740],["FW-DATA",1030],["FW-CONS",1280]];
function esc(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;");}
function stCol(s){return s==="ok"?"#2fb344":s==="warn"?"#e8a013":s==="wait"?"#9aa7b2":"#d43a3a";}
function nodes(e){return [
 {id:"ext.sei",x:30,y:110,ic:"🏦",t:"SEI SWP",sub:"extracts · loaders · APIs"},
 {id:"ext.seiapi",x:30,y:560,ic:"🌐",t:"SEI API targets",sub:"192.200.8/5 · 204.136.26/24"},
 {id:"dmz.mft",x:282,y:110,ic:"📥",t:"MFT · Momentum",sub:e.sftp},
 {id:"dmz.cifs",x:282,y:210,ic:"🗄",t:"Landing share · CIFS",sub:e.share},
 {id:"dmz.apigee",x:282,y:560,ic:"🛡",t:"Apigee egress",sub:"passthrough · corr-id"},
 {id:"corp.users",x:540,y:90,ic:"👤",t:"Users · analysts",sub:"browser → F5 → route"},
 {id:"corp.f5",x:540,y:180,ic:"🎯",t:"F5 / LTM VIP",sub:"TLS terminate · monitors"},
 {id:"mgmt.stack",x:540,y:560,ic:"🛰",t:"Splunk · Vault · OIDC",sub:"HEC 8088 · vault 8200"},
 {id:"app.ingress",x:772,y:90,ic:"🚪",t:"OCP ingress · "+e.tag,sub:"router · NetworkPolicy"},
 {id:"app.hub",x:772,y:190,ic:"⚙️",t:"Hub pods",sub:"Airflow · dbt · ingestion"},
 {id:"app.envoy",x:772,y:290,ic:"🔀",t:"Envoy data plane",sub:"consumer APIs · fat JWT"},
 {id:"app.out",x:772,y:560,ic:"📤",t:"Outbound producers",sub:"16 loaders · idem keys"},
 {id:"data.imds",x:1062,y:150,ic:"🛢",t:"IMDS · "+e.imds,sub:"62G · 8c · 6TB"},
 {id:"data.pbdw",x:1062,y:270,ic:"🛢",t:"PBDW · "+e.pbdw,sub:"62G · 8c · 4-6TB"},
 {id:"cons.piv",x:1312,y:110,ic:"🏢",t:"Pivotal",sub:e.piv},
 {id:"cons.portal",x:1312,y:210,ic:"🖥",t:"Client Portal",sub:e.portal},
 {id:"cons.vendor",x:1312,y:560,ic:"☁️",t:"CRD · Azure | PORT · BBG",sub:"vendor-managed"}
];}
var LANES=[
 {id:"sei-mft",al:"al_in",alLabel:"SEI source IPs @ BBH MFT",pts:[[220,136],[282,136]],chips:[[250,122,"SFTP 22 · Momentum pull",0]]},
 {id:"mft-cifs",pts:[[377,162],[377,210]],chips:[[377,186,"Momentum · rename-atomic drop",0]]},
 {id:"cifs-hub",pts:[[472,236],[500,236],[500,410],[758,410],[758,232],[772,232]],chips:[[510,222,"CIFS 445",0],[740,396,"RWX PVC",0]]},
 {id:"users-f5",pts:[[635,142],[635,180]],chips:[]},
 {id:"f5-ingress",pts:[[730,206],[746,206],[746,116],[772,116]],chips:[[740,192,"443 route",0]]},
 {id:"f5-envoy",pts:[[730,220],[752,220],[752,316],[772,316]],chips:[[740,340,"API 443",0]]},
 {id:"ingress-hub",pts:[[867,142],[867,190]],chips:[]},
 {id:"hub-imds",pts:[[962,216],[1040,216],[1040,176],[1062,176]],chips:[[1030,202,"JDBC TBD",1]]},
 {id:"hub-pbdw",pts:[[962,232],[1034,232],[1034,296],[1062,296]],chips:[[1030,320,"JDBC TBD",1]]},
 {id:"pbdw-piv",pts:[[1252,296],[1292,296],[1292,136],[1312,136]],chips:[[1280,282,"feeds TBD",1]]},
 {id:"pbdw-portal",pts:[[1252,312],[1286,312],[1286,236],[1312,236]],chips:[[1280,336,"feeds TBD",1]]},
 {id:"out-apigee",pts:[[772,586],[472,586]],chips:[[740,572,"submit 443",0],[510,572,"corr-id",0]]},
 {id:"apigee-sei",al:"al_out",alLabel:"BBH egress ranges ×3 @ SEI",pts:[[282,586],[220,586]],chips:[[250,572,"HTTPS 443",0]]},
 {id:"apigee-vendor",pts:[[377,612],[377,780],[1296,780],[1296,586],[1312,586]],chips:[[510,766,"vendor 443",0],[1280,766,"egress",0]]},
 {id:"hub-mgmt",pts:[[820,242],[820,470],[660,470],[660,560]],chips:[[740,456,"HEC 8088",0]]}
];
function alChip(x,y,label,state){
 var col=state==="VERIFIED"?"#2fb344":state==="APPROVED"?"#e8a013":"#d43a3a";
 var bg=state==="VERIFIED"?"#eef9f0":state==="APPROVED"?"#fdf3d7":"#fdecec";
 var lb=label+" · "+state,w=lb.length*5.4+14;
 return '<g><rect x="'+(x-w/2)+'" y="'+(y-8)+'" width="'+w+'" height="17" rx="8.5" fill="'+bg+'" stroke="'+col+'"/>'
  +'<text x="'+x+'" y="'+(y+3)+'" font-size="8.8" font-weight="800" fill="'+col+'" text-anchor="middle">'+lb+'</text></g>';
}
function composite(x,y,sig){
 var fails=[!sig.syn,!sig.tgt,!sig.batch,!sig.ack].filter(Boolean).length;
 var state=(!sig.syn&&!sig.tgt)?"DOWN":(fails?"DEGRADED":"UP");
 var col=state==="UP"?"#2fb344":state==="DEGRADED"?"#e8a013":"#d43a3a";
 var rows=[["synthetic txn via Apigee",sig.syn],["real traffic TARGET-class",sig.tgt],["batch manifests on time",sig.batch],["outbound ack latency",sig.ack]];
 var o='<g data-probe="ext.sei.composite"><rect x="'+x+'" y="'+y+'" width="'+W+'" height="98" rx="9" fill="#fff" stroke="'+col+'" stroke-width="1.8" filter="drop-shadow(0 1px 3px rgba(16,40,60,.14))"/>'
  +'<text x="'+(x+10)+'" y="'+(y+17)+'" font-size="9.6" font-weight="800" fill="#10193b">🩺 SEI composite</text>'
  +'<rect x="'+(x+W-66)+'" y="'+(y+6)+'" width="58" height="17" rx="8.5" fill="'+col+'"/>'
  +'<text x="'+(x+W-37)+'" y="'+(y+17)+'" font-size="8" font-weight="800" fill="#fff" text-anchor="middle">'+state+'</text>';
 rows.forEach(function(r,i){o+='<circle cx="'+(x+15)+'" cy="'+(y+32+i*16)+'" r="3.6" fill="'+(r[1]?"#2fb344":"#d43a3a")+'"/>'
  +'<text x="'+(x+25)+'" y="'+(y+35+i*16)+'" font-size="8.8" fill="#4a5d6e" font-family="Consolas,monospace">'+r[0]+'</text>';});
 return o+'</g>';
}
function render(){
 var e=envModel(cur),NS=nodes(e);
 var byId0={};NS.forEach(function(n){byId0[n.id]=n;});
 var AUTON=[],AUTOL=[],zc={};
 autoRows(cur).forEach(function(r){
  var z=AUTOZ[r.layer];zc[r.layer]=(zc[r.layer]||0);
  var nid=(r.layer==="Database"?"data.":r.layer==="Consumer"?"cons.":r.layer==="File System"?"dmz.":"ext.")+r.system.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,14);
  var node={id:nid,x:z.x,y:z.base+zc[r.layer]*z.step,ic:"◈",t:r.system,sub:r.hosts.slice(0,26),auto:1};
  AUTON.push(node);NS.push(node);
  var src=byId0[z.src];if(src){
   var sy=src.y+H/2+6+zc[r.layer]*9, ty=node.y+H/2, mx=z.fw+16+zc[r.layer]*10;
   var pts=z.x>src.x?[[src.x+W,sy],[mx,sy],[mx,ty],[node.x,ty]]:[[src.x,sy],[mx,sy],[mx,ty],[node.x+W,ty]];
   AUTOL.push({id:nid+"-auto",pts:pts,row:r,fw:z.fw,cy:sy});
  }
  zc[r.layer]++;
 });
 var s='<defs><marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9fb4c8"/></marker></defs>';
 ZONES.forEach(function(z,i){s+='<rect x="'+z[1]+'" y="34" width="'+z[2]+'" height="770" rx="12" fill="'+(i%2?'#f3f7fa':'#f9fbfd')+'" stroke="#e2e9ee"/>'
  +'<text x="'+(z[1]+10)+'" y="52" font-size="9.6" font-weight="800" fill="#56718a" letter-spacing="1.8">'+z[0]+'</text>';});
 FWS.forEach(function(f){s+='<line x1="'+f[1]+'" y1="38" x2="'+f[1]+'" y2="800" stroke="#c96a76" stroke-width="3" stroke-dasharray="4,7"/>'
  +'<rect x="'+(f[1]-26)+'" y="806" width="52" height="15" rx="7" fill="#8a1f2d"/><text x="'+f[1]+'" y="817" font-size="8.6" font-weight="800" fill="#fff" text-anchor="middle">'+f[0]+'</text>';});
 LANES.forEach(function(L,i){
  var st=ST["p"+i]||{ok:1,ms:20};
  var ri=ruleFor(cur,L.id);
  var tbd=ri?ri.tbd:L.chips.some(function(c){return c[3];});
  var col=tbd?"#c98d1a":(st.ok?"#8fbfa5":"#d43a3a");
  s+='<path data-path="'+L.id+'" d="M '+L.pts.map(function(p){return p[0]+" "+p[1];}).join(" L ")+'" fill="none" stroke="'+col+'" stroke-width="'+(tbd?1.3:1.8)+'" stroke-dasharray="'+(tbd?'2,4':'7,5')+'" marker-end="url(#a)"/>';
  if(L.chips.length){
  var c0=L.chips[0], bcol=tbd?"#c98d1a":(st.ok?"#2fb344":"#d43a3a");
  s+='<g data-act="lane:'+i+'" style="cursor:pointer"><circle cx="'+c0[0]+'" cy="'+c0[1]+'" r="9" fill="#fff" stroke="'+bcol+'" stroke-width="2"'+(tbd?' stroke-dasharray="3,2.5"':'')+'/>'
   +'<text x="'+c0[0]+'" y="'+(c0[1]+3.5)+'" font-size="9.5" font-weight="900" fill="'+bcol+'" text-anchor="middle">'+(tbd?"?":(st.ok?"i":"!"))+'</text></g>';
 }
 });
 AUTOL.forEach(function(L,k){
  var pp=(L.row.port||"TBD"),tbd=pp.toUpperCase().indexOf("TBD")>=0;
  var m=pp.match(/(\d{2,5})/);var col=tbd?"#c98d1a":"#8fbfa5";
  s+='<path data-path="'+L.id+'" d="M '+L.pts.map(function(p){return p[0]+" "+p[1];}).join(" L ")+'" fill="none" stroke="'+col+'" stroke-width="'+(tbd?1.3:1.8)+'" stroke-dasharray="'+(tbd?'2,4':'7,5')+'" marker-end="url(#a)"/>';
  s+='<g data-act="lane:'+(1000+k)+'" style="cursor:pointer"><circle cx="'+L.fw+'" cy="'+(L.cy-14)+'" r="9" fill="#fff" stroke="'+(tbd?"#c98d1a":"#2fb344")+'" stroke-width="2"'+(tbd?' stroke-dasharray="3,2.5"':'')+'/><text x="'+L.fw+'" y="'+(L.cy-10.5)+'" font-size="9.5" font-weight="900" fill="'+(tbd?"#c98d1a":"#2fb344")+'" text-anchor="middle">'+(tbd?"?":(m?"i":"i"))+'</text></g>';
 });

 NS.forEach(function(n){
  var st=(ST[n.id]||{s:"ok"}).s;
  s+='<g data-probe="'+n.id+'"><rect x="'+n.x+'" y="'+n.y+'" width="'+W+'" height="'+H+'" rx="10" fill="#fff" stroke="'+(n.auto?"#7b4dbb":"#dde6ec")+'"'+(n.auto?' stroke-dasharray="5,4" stroke-width="1.5"':'')+'  filter="drop-shadow(0 1.5px 3px rgba(16,40,60,.13))"/>'
   +'<text x="'+(n.x+10)+'" y="'+(n.y+21)+'" font-size="11" font-weight="800" fill="#10193b">'+n.ic+' '+esc(n.t)+'</text>'
   +'<text x="'+(n.x+10)+'" y="'+(n.y+38)+'" font-size="9.2" fill="#4a5d6e" font-family="Consolas,monospace">'+esc(n.sub)+'</text>'
   +(n.auto?'<rect x="'+(n.x+W-52)+'" y="'+(n.y+H-15)+'" width="44" height="11" rx="5.5" fill="#7b4dbb"/><text x="'+(n.x+W-30)+'" y="'+(n.y+H-6.5)+'" font-size="7" font-weight="800" fill="#fff" text-anchor="middle">AUTO</text>':'')
   +'<circle'+((st==="ok"||st==="wait")?'':' class="pd"')+(st==="wait"?' stroke-dasharray="2.5,2"':'')+' cx="'+(n.x+W-13)+'" cy="'+(n.y+14)+'" r="5.2" fill="'+(st==="wait"?"#fff":stCol(st))+'" stroke="'+(st==="wait"?"#9aa7b2":"#fff")+'" stroke-width="1.6"><title>'+n.id+' · '+st+'</title></circle>'
   +(st==="warn"?'<text x="'+(n.x+W-13)+'" y="'+(n.y+17.5)+'" font-size="8" font-weight="900" fill="#fff" text-anchor="middle">!</text>':'')
   +(st==="down"?'<text x="'+(n.x+W-13)+'" y="'+(n.y+17.5)+'" font-size="8" font-weight="900" fill="#fff" text-anchor="middle">×</text>':'')
   +'</g>';});
 var sig=ST.sei||{syn:1,tgt:1,batch:1,ack:1};
 s+=composite(30,680,sig);

 // detail popovers LAST = always on top (SVG paints in document order)
 if(SEL!==null&&SEL>=1000){
  var L=AUTOL[SEL-1000];
  if(L){var pp=(L.row.port||"TBD"),tbd=pp.toUpperCase().indexOf("TBD")>=0,m=pp.match(/(\d{2,5})/);
   var px=Math.min(L.fw+18,1290),py=Math.min(L.cy,640),rows=[["PATH","(auto) "+L.row.system],["RULE",tbd?"◌ awaiting firewall decision":(m?m[1]:pp)],["HOSTS",L.row.hosts.slice(0,34)],["STATUS",tbd?"port TBD — probe waiting":"probe ARMED on next runner cycle"],["PROBE ID","data-path: "+L.id]];
   var ph=34+rows.length*17;
   s+='<g><rect x="'+px+'" y="'+py+'" width="252" height="'+ph+'" rx="10" fill="#10193b" filter="drop-shadow(0 3px 8px rgba(16,25,59,.35))"/><text x="'+(px+12)+'" y="'+(py+19)+'" font-size="9.6" font-weight="800" fill="#7cc0ff" letter-spacing="1">PATH DETAIL · AUTO</text><g data-act="close" style="cursor:pointer"><text x="'+(px+238)+'" y="'+(py+19)+'" font-size="11" font-weight="800" fill="#8fa3b5" text-anchor="middle">✕</text></g>';
   rows.forEach(function(r,k2){s+='<text x="'+(px+12)+'" y="'+(py+38+k2*17)+'" font-size="7.8" font-weight="800" fill="#5f7a94">'+r[0]+'</text><text x="'+(px+72)+'" y="'+(py+38+k2*17)+'" font-size="9" fill="#e6eef6" font-family="Consolas,monospace">'+esc(r[1])+'</text>';});
   s+='</g>';
  }
 }
 if(SEL!==null&&SEL<1000){
  var L=LANES[SEL], st=ST["p"+SEL]||{ok:1,ms:20};
  var riX=ruleFor(cur,L.id), tbd0=riX?riX.tbd:L.chips.some(function(c){return c[3];});
  var byId2={};nodes(ENVS[cur]).forEach(function(n){byId2[n.id]=n;});
  var pr=L.id.split("-"), fromN=null,toN=null;
  nodes(ENVS[cur]).forEach(function(n){var k=n.id.split(".")[1];if(k===pr[0]||n.id.indexOf(pr[0])>=0)fromN=fromN||n;if(k===pr[1]||n.id.indexOf(pr[1])>=0)toN=toN||n;});
  var c0=L.chips.length?L.chips[0]:[700,300];
  var px=Math.min(Math.max(c0[0]+16,20),1290), py=Math.min(Math.max(c0[1]-14,44),640);
  var rows=[];
  rows.push(["PATH", (fromN?fromN.t.replace(/^[^ ]+ /,""):pr[0])+"  →  "+(toN?toN.t.replace(/^[^ ]+ /,""):pr[1])]);
  var ri2=ruleFor(cur,L.id);
  if(ri2){rows.push(["RULE", (ri2.tbd?"◌ awaiting firewall decision":ri2.label)]);
   var q=RULEQ[L.id],src=q&&fRow(cur,q[0],q[1]);
   if(src)rows.push(["HOSTS", src.hosts.slice(0,34)]);
  } else {L.chips.forEach(function(c){rows.push(["RULE", c[2]]);});}
  rows.push(["STATUS", tbd0?"port TBD — probe not yet possible":(st.ok?"OK · "+st.ms+"ms round-trip":"FAILING — path probe timeout")]);
  if(L.al)rows.push(["ALLOWLIST", L.alLabel+"  ·  "+(ST[L.al]||"VERIFIED")]);
  rows.push(["PROBE ID", "data-path: "+L.id]);
  var ph=34+rows.length*17;
  s+='<g><rect x="'+px+'" y="'+py+'" width="252" height="'+ph+'" rx="10" fill="#10193b" filter="drop-shadow(0 3px 8px rgba(16,25,59,.35))"/>'
   +'<text x="'+(px+12)+'" y="'+(py+19)+'" font-size="9.6" font-weight="800" fill="#7cc0ff" letter-spacing="1">PATH DETAIL</text>'
   +'<g data-act="close" style="cursor:pointer"><text x="'+(px+238)+'" y="'+(py+19)+'" font-size="11" font-weight="800" fill="#8fa3b5" text-anchor="middle">✕</text></g>';
  rows.forEach(function(r,k){
   s+='<text x="'+(px+12)+'" y="'+(py+38+k*17)+'" font-size="7.8" font-weight="800" fill="#5f7a94">'+r[0]+'</text>'
    +'<text x="'+(px+72)+'" y="'+(py+38+k*17)+'" font-size="9" fill="#e6eef6" font-family="Consolas,monospace">'+esc(r[1])+'</text>';});
  s+='</g>';
 }
 return {svg:s};
}
function clock(){var m=(17*60+21+Math.floor(tick*0.72))%1440;var s2=(tick*26)%60;
 return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+m%60).slice(-2)+':'+('0'+s2).slice(-2);}
function pulse(){
 tick++;
 var ids=["dmz.mft","dmz.cifs","dmz.apigee","app.ingress","app.hub","app.envoy","app.out","data.imds","data.pbdw","cons.piv","cons.portal","cons.vendor","corp.f5","mgmt.stack"];
 ids.forEach(function(id,i){
  var pd=probeDef(cur,id);
  if(pd&&!pd.armed){
   if((ST[id]||{}).s!=="wait")FEED.push(["w",clock()+"  "+cur+"."+id+"  ◌ probe WAITING — port TBD in workbook"]);
   ST[id]={s:"wait"};return;
  }
  var r=(tick*7+i*13)%97, ns=r<86?"ok":(r<94?"warn":"down");
  var prev=(ST[id]||{}).s;
  if(prev&&prev!==ns&&ns!=="ok")FEED.push([ns==="warn"?"w":"d",clock()+"  "+id+"  →  "+ns.toUpperCase()+(id.indexOf("data")===0?"  · session headroom":id==="dmz.cifs"?"  · write-probe slow":"  · probe timeout")]);
  if(prev&&prev!==ns&&ns==="ok")FEED.push(["",clock()+"  "+id+"  →  recovered"]);
  ST[id]={s:ns};
 });
 for(var i=0;i<LANES.length;i++)ST["p"+i]={ok:((tick*5+i*11)%89)<84,ms:12+((tick*13+i*29)%140)};
 var r2=tick%23;
 ST.sei={syn:r2<19,tgt:r2<21,batch:(tick%17)<15,ack:(tick%13)<11};
 ST.al_in=(tick%31)<28?"VERIFIED":"APPROVED";
 ST.al_out=(tick%9)<6?"VERIFIED":((tick%9)<8?"APPROVED":"REQUESTED");

}


/* ============ live status mapping ============ */
function applyLive(liveRows){
 // liveRows: [{probe_id:"DEV.data.pbdw", state, status, latency_ms, ...}]
 liveRows.forEach(function(r){
  var parts=r.probe_id.split(".");
  var env=parts.shift(); if(env!==cur) return;
  var id=parts.join(".");
  if(id.indexOf("path.")===0){
   // path probes -> lane ST by lane id lookup
   var lid=id.slice(5);
   var idx=LANES.findIndex(function(L){return L.id===lid;});
   if(idx>=0) ST["p"+idx]={ok:r.status==="OK", ms:r.latency_ms||0};
  } else {
   ST[id]= r.state==="WAITING" ? {s:"wait"}
        : {s: r.status==="OK"?"ok": r.status==="WARN"?"warn": r.status==="SKIP"?"wait":"down"};
  }
 });
}

/* ============ component ============ */
export default function EnvTopology({ t }) {
 const [mode, setMode] = useState("DEMO");
 const [envSel, setEnvSel] = useState("DEV");
 const [rev, setRev] = useState(0);          // bump to re-render board
 const [banner, setBanner] = useState(null);
 const fileRef = useRef(null);
 const pollRef = useRef(null);

 const bump = () => setRev(r => r + 1);

 // LIVE bootstrap: rows from API; else DEMO embedded sheet (already parsed above)
 useEffect(() => {
  let dead = false;
  fetch("/env-infra").then(r => r.ok ? r.json() : Promise.reject())
   .then(d => {
    if (dead || !d.environments || !Object.keys(d.environments).length) return;
    ROWS = Object.values(d.environments).flat().map(r => ({
     env: r.env, layer: r.layer, system: r.system_name,
     hosts: r.hosts || "", port: r.protocol_port || "", notes: r.notes || "" }));
    setMode("LIVE"); bump();
   }).catch(() => {});
  return () => { dead = true; };
 }, []);

 // pulse: LIVE polls real results; DEMO runs the simulated state machine
 useEffect(() => {
  cur = envSel;
  clearInterval(pollRef.current);
  const beat = () => {
   if (mode === "LIVE") {
    fetch("/env-infra/probes/live?env=" + encodeURIComponent(envSel))
     .then(r => r.ok ? r.json() : [])
     .then(rows => { applyLive(rows); bump(); }).catch(() => {});
   } else { pulse(); bump(); }
  };
  beat();
  pollRef.current = setInterval(beat, mode === "LIVE" ? 5000 : 2600);
  return () => clearInterval(pollRef.current);
 }, [envSel, mode]);

 const doDownload = () => {
  if (mode === "LIVE") { window.location.href = "/env-infra/export"; return; }
  dl();
 };
 const doUpload = async (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  if (mode === "LIVE") {
   const fd = new FormData(); fd.append("file", f);
   const res = await fetch("/env-infra/import", { method: "POST", body: fd });
   const d = await res.json();
   if (!res.ok) setBanner({ ok: 0, msg: "IMPORT REJECTED — " + (d.detail || res.status) });
   else {
    setBanner({ ok: 1, msg: `IMPORT ACCEPTED · ${d.added} added · ${d.changed} changed · probes: ${d.probes_armed} ARMED / ${d.probes_waiting} WAITING` });
    const rows = await fetch("/env-infra").then(r => r.json());
    ROWS = Object.values(rows.environments).flat().map(r => ({
     env: r.env, layer: r.layer, system: r.system_name,
     hosts: r.hosts || "", port: r.protocol_port || "", notes: r.notes || "" }));
   }
   bump();
  } else { ul(ev); setBanner(WBDIFF); bump(); return; }
  ev.target.value = "";
 };
 const onBoardClick = (e) => {
  const g = e.target.closest("[data-act]"); if (!g) return;
  const act = g.getAttribute("data-act");
  if (act === "close") SEL = null;
  else if (act.startsWith("lane:")) { const i = +act.slice(5); SEL = (SEL === i ? null : i); }
  bump();
 };

 const board = render();          // pure: builds svg string from ROWS/ST/SEL
 const pc = probeCounts(envSel);
 const S = {
  tab: on => ({ padding: "5px 16px", borderRadius: 999, fontSize: 10.5, fontWeight: 800,
   cursor: "pointer", border: "1.5px solid " + (on ? "#1168bd" : "#c3d0dc"),
   color: on ? "#fff" : "#3d566e", background: on ? "#1168bd" : "#fff", marginRight: 6 }),
  btn: sec => ({ padding: "8px 18px", borderRadius: 8, fontSize: 11.5, fontWeight: 800,
   cursor: "pointer", border: "1.5px solid #1168bd",
   background: sec ? "#fff" : "#1168bd", color: sec ? "#1168bd" : "#fff", marginRight: 8 }),
 };
 return (
  <div style={{ fontFamily: "'Segoe UI',sans-serif", background: "#eef2f6", padding: 14, minHeight: "100%" }}>
   <h1 style={{ fontSize: 16.5, margin: "0 0 8px", color: "#10193b" }}>
    Network Topology · CP Integration Hub
    <span style={{ fontSize: 8.5, fontWeight: 800, background: "#10193b", color: "#7cc0ff",
     borderRadius: 999, padding: "2px 9px", marginLeft: 7 }}>ENVIRONMENT 360</span>
    <span style={{ fontSize: 9.5, fontWeight: 800, marginLeft: 10,
     color: mode === "LIVE" ? "#2fb344" : "#c98d1a" }}>
     {mode === "LIVE" ? "● LIVE — real probe results" : "○ DEMO — simulated pulse (API unreachable)"}
    </span>
   </h1>
   <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", marginBottom: 9 }}>
    <span style={S.btn(false)} onClick={doDownload}>⬇ Download workbook (Excel)</span>
    <label style={S.btn(true)}>⬆ Upload updated workbook
     <input ref={fileRef} type="file" accept=".tsv,.csv,.txt,.xlsx" style={{ display: "none" }} onChange={doUpload} />
    </label>
    {ENVO.map(k => (
     <span key={k} style={S.tab(k === envSel)} onClick={() => { SEL = null; setEnvSel(k); }}>
      {k === "TRIAL_UAT" ? "TRIAL/UAT" : k}</span>))}
    <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#7d93a8" }}>
     probes: <b>{pc.armed} armed</b> · {pc.waiting} waiting (◌ = port TBD in workbook)</span>
   </div>
   {banner && (
    <div style={{ background: banner.ok ? "#eef7ff" : "#fdecec",
     border: "1.5px solid " + (banner.ok ? "#1168bd" : "#d43a3a"),
     borderRadius: 10, padding: "7px 12px", marginBottom: 9, fontSize: 10.5, fontWeight: 700 }}>
     {banner.msg} <span style={{ cursor: "pointer", float: "right" }} onClick={() => setBanner(null)}>✕</span>
    </div>)}
   <div style={{ background: "#fff", border: "1px solid #dfe6ec", borderRadius: 12, padding: 8, overflowX: "auto" }}
        onClick={onBoardClick}>
    <svg viewBox="0 0 1560 830" style={{ minWidth: 1560, display: "block" }}
         dangerouslySetInnerHTML={{ __html: board.svg }} />
   </div>
   <div style={{ marginTop: 8, fontSize: 9.4, color: "#7d93a8" }}>
    click ⓘ/?/! badges for path detail · {mode === "LIVE"
     ? "statuses from env_probe_result via /env-infra/probes/live (5s)"
     : "upload works locally in DEMO; deploy the API for real probes"} · rev {rev}
   </div>
  </div>);
}
