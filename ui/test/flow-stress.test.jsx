import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlowDiagram } from "../src/CrosswalkFlow.jsx";
const t = { panel:"#fff", panel2:"#dfe6e9", navy:"#10193b", sub:"#666", muted:"#999" };
const V = ["PROVEN_MATCH","UNKNOWN","DECODE_NEEDED","NO_SOURCE","TYPE_SHIFT","OUT_OF_SCOPE"];
let seed = 7; const rnd = () => (seed = (seed*1103515245+12345) % 2147483648) / 2147483648;
const pick = (a) => a[Math.floor(rnd()*a.length)];
let fails = 0;
for (let trial = 0; trial < 300; trial++) {
  const nS = 1+Math.floor(rnd()*7), nM = 1+Math.floor(rnd()*6), nR = 1+Math.floor(rnd()*8);
  const S=[...Array(nS)].map((_,i)=>i?`SRC_${i}`:"no SEI source");
  const Mm=[...Array(nM)].map((_,i)=>`FEED_${i}`), Rr=[...Array(nR)].map((_,i)=>`TBL_${i}`);
  const left=[], right=[], bypass=[];
  for (let i=0;i<1+Math.floor(rnd()*14);i++)
    left.push({src:pick(S),mid:pick(Mm),verdict:pick(V),n:1+Math.floor(rnd()*40)});
  for (let i=0;i<1+Math.floor(rnd()*14);i++)
    right.push({mid:pick(Mm),tgt:pick(Rr),n:1+Math.floor(rnd()*40)});
  if (rnd()<0.4) bypass.push({src:pick(S),tgt:pick(Rr),n:1+Math.floor(rnd()*6)});
  let html;
  try { html = renderToStaticMarkup(<FlowDiagram t={t} flow={{left,right,bypass}} />); }
  catch (e) { console.log(`trial ${trial} THREW ${e.message}`); fails++; continue; }
  if (/NaN|Infinity/.test(html)) { console.log(`trial ${trial} NaN/Infinity`); fails++; continue; }
  const svgH = Number((html.match(/<svg[^>]*height="([\d.]+)"/)||[])[1]);
  const st=[...html.matchAll(/ d="([^"]+)" stroke="[^"]*" stroke-width="([\d.]+)"/g)];
  let lo=Infinity, hi=-Infinity;
  st.forEach((m)=>{ const w=Number(m[2]);
    const n=(m[1].match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);
    for(let i=1;i<n.length;i+=2){ lo=Math.min(lo,n[i]-w/2); hi=Math.max(hi,n[i]+w/2); } });
  [...html.matchAll(/<rect[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/g)].forEach((m)=>{
    lo=Math.min(lo,Number(m[1])); hi=Math.max(hi,Number(m[1])+Number(m[2])); });
  if (st.length && (lo < -1.5 || hi > svgH + 1.5)) {
    console.log(`trial ${trial} SPILL svgH=${svgH.toFixed(0)} y=[${lo.toFixed(0)}..${hi.toFixed(0)}] `
      +`(${nS}/${nM}/${nR} nodes, ${left.length}L ${right.length}R)`); fails++;
  }
}
console.log(fails ? `${fails} of 300 trials failed` : "300/300 random topologies render inside the canvas");
