import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as d3 from "d3";
import { useI18n } from "./i18n/index.jsx";
import { apiOCR, apiScience, apiDestiny, apiRegister, apiLogin, apiLogout, apiSaveUser, apiChat } from "./api.js";

// ════════════════════════════════════════
// BAZI ENGINE
// ════════════════════════════════════════
const SC = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const BC = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const TG = {"甲":["木","阳"],"乙":["木","阴"],"丙":["火","阳"],"丁":["火","阴"],"戊":["土","阳"],"己":["土","阴"],"庚":["金","阳"],"辛":["金","阴"],"壬":["水","阳"],"癸":["水","阴"]};
const DH = {"子":[["癸",1]],"丑":[["己",.6],["癸",.2],["辛",.2]],"寅":[["甲",.6],["丙",.2],["戊",.2]],"卯":[["乙",1]],"辰":[["戊",.6],["乙",.2],["癸",.2]],"巳":[["丙",.6],["庚",.2],["戊",.2]],"午":[["丁",.6],["己",.2],["丙",.2]],"未":[["己",.6],["丁",.2],["乙",.2]],"申":[["庚",.6],["壬",.2],["戊",.2]],"酉":[["辛",1]],"戌":[["戊",.6],["辛",.2],["丁",.2]],"亥":[["壬",.6],["甲",.2]]};
const CTL = {"木":"土","土":"水","水":"火","火":"金","金":"木"};
const GEN = {"木":"火","火":"土","土":"金","金":"水","水":"木"};
const EC = {"木":"#4a8a4a","火":"#c45a30","土":"#a08a50","金":"#9898a8","水":"#3a6a9a"};
const EO = {"木":"肝·胆","火":"心·小肠","土":"脾·胃","金":"肺·大肠","水":"肾·膀胱"};

function md(n, m) { return ((n % m) + m) % m; }

function calcBazi(y, m, d, h) {
  const ys = SC[md(y-4,10)], yb = BC[md(y-4,12)];
  const mb = BC[md(m+1,12)], ms = SC[md(md(SC.indexOf(ys)%5,5)*2+m-1,10)];
  const delta = Math.round((new Date(y,m-1,d)-new Date(2000,0,7))/864e5);
  const ds = SC[md(delta,10)], db = BC[md(delta,12)];
  const hbi = Math.floor((h+1)/2)%12;
  const hs = SC[md(md(SC.indexOf(ds)%5,5)*2+hbi,10)], hb = BC[hbi];
  return { year:[ys,yb], month:[ms,mb], day:[ds,db], hour:[hs,hb], dm:ds, dme:TG[ds][0] };
}

function calcWX(bz) {
  const w = {"木":0,"火":0,"土":0,"金":0,"水":0};
  [bz.year[0],bz.month[0],bz.day[0],bz.hour[0]].forEach(s => w[TG[s][0]]+=1);
  [bz.year[1],bz.month[1],bz.day[1],bz.hour[1]].forEach(b => (DH[b]||[]).forEach(([s,wt]) => w[TG[s][0]]+=wt));
  const t = Object.values(w).reduce((a,b)=>a+b,0);
  if (t>0) Object.keys(w).forEach(k => w[k]=Math.round(w[k]/t*1000)/10);
  return w;
}

function calcDY(bz, age, sex) {
  const fwd = (TG[bz.year[0]][1]==="阳"&&sex==="M")||((TG[bz.year[0]][1]!=="阳")&&sex==="F");
  const p = Math.max(0,Math.floor((age-8)/10)), dir = fwd?1:-1;
  const cs = SC[md(SC.indexOf(bz.month[0])+dir*(p+1),10)];
  const cb = BC[md(BC.indexOf(bz.month[1])+dir*(p+1),12)];
  return { el:TG[cs][0], lbl:cs+cb };
}

function calcLN(yr) { const s=SC[md(yr-4,10)],b=BC[md(yr-4,12)]; return {el:TG[s][0],lbl:s+b}; }

// 月令五行力量 — 每个月的五行旺衰
// 寅卯月木旺、巳午月火旺、辰戌丑未月土旺、申酉月金旺、亥子月水旺
const MONTH_WX = {
  1:{主:"土",旺:"水",衰:"火"},  // 丑月
  2:{主:"木",旺:"木",衰:"金"},  // 寅月
  3:{主:"木",旺:"木",衰:"金"},  // 卯月
  4:{主:"土",旺:"木",衰:"水"},  // 辰月
  5:{主:"火",旺:"火",衰:"水"},  // 巳月
  6:{主:"火",旺:"火",衰:"水"},  // 午月 — 火最旺
  7:{主:"土",旺:"火",衰:"木"},  // 未月
  8:{主:"金",旺:"金",衰:"木"},  // 申月
  9:{主:"金",旺:"金",衰:"木"},  // 酉月
  10:{主:"土",旺:"金",衰:"水"}, // 戌月
  11:{主:"水",旺:"水",衰:"火"}, // 亥月
  12:{主:"水",旺:"水",衰:"火"}, // 子月 — 水最旺
};

function applyMonthEffect(baseWX, month) {
  const mw = MONTH_WX[month]; if(!mw) return baseWX;
  const m = {...baseWX};
  // 当月主气五行加强，被克五行减弱
  m[mw.主]=(m[mw.主]||0)+1.5;
  m[mw.旺]=(m[mw.旺]||0)+0.8;
  m[mw.衰]=Math.max(0.1,(m[mw.衰]||0)-1);
  // 重新归一化
  const t = Object.values(m).reduce((a,b)=>a+b,0);
  if(t>0) Object.keys(m).forEach(k => m[k]=Math.round(m[k]/t*1000)/10);
  return m;
}

function applyTemp(base, dy, ln) {
  const m = {...base};
  m[dy.el]=(m[dy.el]||0)+2; m[CTL[dy.el]]=Math.max(.1,(m[CTL[dy.el]]||0)-1.5); m[GEN[dy.el]]=(m[GEN[dy.el]]||0)+.8;
  m[ln.el]=(m[ln.el]||0)+1; m[CTL[ln.el]]=Math.max(.1,(m[CTL[ln.el]]||0)-.8);
  const t = Object.values(m).reduce((a,b)=>a+b,0);
  if (t>0) Object.keys(m).forEach(k => m[k]=Math.round(m[k]/t*1000)/10);
  return m;
}

// ════════════════════════════════════════
// MEDICAL REFERENCES — 五行标准化体系 (15 核心指标)
// ════════════════════════════════════════
// 五行分组顺序
// 五行分组顺序 — i18n key references
const WX_GROUPS = [
  { el:"木", sysKey:"hepatic", keys:["ALT","AST","TBIL"] },
  { el:"火", sysKey:"cardiovascular", keys:["SBP","DBP","RHR"] },
  { el:"土", sysKey:"digestive", keys:["FBG","HbA1c","TG"] },
  { el:"金", sysKey:"respiratory", keys:["FVC","SpO2","LDL_C"] },
  { el:"水", sysKey:"renal", keys:["Cr","UA","VitD"] },
];

const RR_EN = {
  ALT:"ALT (Alanine Aminotransferase)", AST:"AST (Aspartate Aminotransferase)", TBIL:"Total Bilirubin",
  SBP:"Systolic BP", DBP:"Diastolic BP", RHR:"Resting Heart Rate",
  FBG:"Fasting Blood Glucose", HbA1c:"HbA1c", TG:"Triglycerides",
  FVC:"Forced Vital Capacity", SpO2:"SpO2", LDL_C:"LDL Cholesterol",
  Cr:"Serum Creatinine", UA:"Uric Acid", VitD:"25-OH Vitamin D",
};
// Short English names for compact display
const RR_EN_SHORT = {
  ALT:"ALT", AST:"AST", TBIL:"Bilirubin",
  SBP:"Systolic", DBP:"Diastolic", RHR:"Heart Rate",
  FBG:"Glucose", HbA1c:"HbA1c", TG:"Triglycerides",
  FVC:"FVC", SpO2:"SpO2", LDL_C:"LDL-C",
  Cr:"Creatinine", UA:"Uric Acid", VitD:"Vitamin D",
};

const RR = {
  // ── 木 · 肝胆 ──
  ALT:{u:"U/L",cn:"谷丙转氨酶",o:"木",r:[{a1:0,a2:12,s:"A",l:5,h:30,n:"儿童肝脏酶基线低"},{a1:13,a2:17,s:"M",l:7,h:35,n:"青春期男性轻度升高属正常"},{a1:13,a2:17,s:"F",l:5,h:30,n:"青春期女性雌激素保护肝脏"},{a1:18,a2:59,s:"M",l:7,h:40,n:"成年男性标准"},{a1:18,a2:59,s:"F",l:7,h:35,n:"成年女性上限略低"},{a1:60,a2:120,s:"A",l:5,h:40,n:"老年肝代谢下降"}]},
  AST:{u:"U/L",cn:"谷草转氨酶",o:"木",r:[{a1:0,a2:12,s:"A",l:8,h:36,n:"儿童标准"},{a1:13,a2:17,s:"A",l:8,h:40,n:"青春期标准"},{a1:18,a2:59,s:"M",l:8,h:40,n:"成年男性标准"},{a1:18,a2:59,s:"F",l:8,h:35,n:"成年女性标准"},{a1:60,a2:120,s:"A",l:8,h:40,n:"老年人标准"}]},
  TBIL:{u:"μmol/L",cn:"总胆红素",o:"木",r:[{a1:0,a2:12,s:"A",l:2,h:17,n:"儿童标准"},{a1:13,a2:17,s:"A",l:3.4,h:17.1,n:"青少年标准"},{a1:18,a2:59,s:"A",l:3.4,h:17.1,n:"成人标准"},{a1:60,a2:120,s:"A",l:3.4,h:20,n:"老年人上限略宽"}]},
  // ── 火 · 心血管 ──
  SBP:{u:"mmHg",cn:"收缩压",o:"火",r:[{a1:0,a2:17,s:"A",l:85,h:120,n:"青少年血压波动大"},{a1:18,a2:59,s:"A",l:90,h:120,n:"成人标准"},{a1:60,a2:120,s:"A",l:90,h:140,n:"老年动脉硬化"}]},
  DBP:{u:"mmHg",cn:"舒张压",o:"火",r:[{a1:0,a2:17,s:"A",l:50,h:80,n:"青少年标准"},{a1:18,a2:59,s:"A",l:60,h:80,n:"成人标准"},{a1:60,a2:120,s:"A",l:60,h:90,n:"老年人上限放宽"}]},
  RHR:{u:"bpm",cn:"静息心率",o:"火",r:[{a1:0,a2:12,s:"A",l:70,h:120,n:"儿童心率高于成人"},{a1:13,a2:17,s:"A",l:60,h:100,n:"青春期心脏发育中"},{a1:18,a2:59,s:"A",l:60,h:100,n:"成人标准"},{a1:60,a2:120,s:"A",l:60,h:100,n:"老年窦房结退行性改变"}]},
  // ── 土 · 脾胃代谢 ──
  FBG:{u:"mmol/L",cn:"空腹血糖",o:"土",r:[{a1:0,a2:12,s:"A",l:3.3,h:5.6,n:"儿童低血糖阈值更低"},{a1:13,a2:17,s:"A",l:3.9,h:5.8,n:"青春期生长激素旺盛"},{a1:18,a2:59,s:"A",l:3.9,h:6.1,n:"成人标准"},{a1:60,a2:120,s:"A",l:4,h:6.5,n:"老年人上限放宽"}]},
  HbA1c:{u:"%",cn:"糖化血红蛋白",o:"土",r:[{a1:0,a2:17,s:"A",l:4,h:5.7,n:"青少年标准"},{a1:18,a2:59,s:"A",l:4,h:5.7,n:"成人标准（≥6.5%为糖尿病）"},{a1:60,a2:120,s:"A",l:4,h:6.5,n:"老年人目标放宽"}]},
  TG:{u:"mmol/L",cn:"甘油三酯",o:"土",r:[{a1:0,a2:17,s:"A",l:0.3,h:1.5,n:"青少年标准"},{a1:18,a2:59,s:"A",l:0.4,h:1.7,n:"成人标准（≥2.3为偏高）"},{a1:60,a2:120,s:"A",l:0.4,h:1.7,n:"老年人标准"}]},
  // ── 金 · 呼吸 ──
  FVC:{u:"L",cn:"肺活量",o:"金",r:[{a1:0,a2:12,s:"A",l:.5,h:2.5,n:"儿童肺泡发育中"},{a1:13,a2:17,s:"M",l:2.5,h:5,n:"青春期男性胸廓发育"},{a1:13,a2:17,s:"F",l:2,h:4,n:"青春期女性肺活量低于男性"},{a1:18,a2:59,s:"M",l:3,h:5.5,n:"成年男性峰值期"},{a1:18,a2:59,s:"F",l:2.5,h:4.5,n:"成年女性标准"},{a1:60,a2:120,s:"A",l:2,h:4,n:"老年肺弹性下降"}]},
  SpO2:{u:"%",cn:"血氧饱和度",o:"金",r:[{a1:0,a2:59,s:"A",l:95,h:100,n:"正常≥95%，<90%为呼吸衰竭"},{a1:60,a2:120,s:"A",l:93,h:100,n:"老年人基线略低"}]},
  LDL_C:{u:"mmol/L",cn:"低密度脂蛋白",o:"金",r:[{a1:0,a2:17,s:"A",l:1,h:2.8,n:"青少年标准"},{a1:18,a2:59,s:"A",l:1,h:3.4,n:"成人标准（≥4.1为很高）"},{a1:60,a2:120,s:"A",l:1,h:3.4,n:"老年人标准"}]},
  // ── 水 · 肾脏内分泌 ──
  Cr:{u:"μmol/L",cn:"血肌酐",o:"水",r:[{a1:0,a2:12,s:"A",l:20,h:60,n:"儿童肌肉量少"},{a1:13,a2:17,s:"M",l:40,h:90,n:"青春期男性肌肉增长"},{a1:13,a2:17,s:"F",l:35,h:80,n:"青春期女性肌肉增长较小"},{a1:18,a2:59,s:"M",l:57,h:111,n:"成年男性标准"},{a1:18,a2:59,s:"F",l:44,h:97,n:"成年女性标准"},{a1:60,a2:120,s:"A",l:44,h:106,n:"老年肌肉萎缩"}]},
  UA:{u:"μmol/L",cn:"尿酸",o:"水",r:[{a1:0,a2:17,s:"A",l:120,h:340,n:"青少年标准"},{a1:18,a2:59,s:"M",l:149,h:416,n:"成年男性标准"},{a1:18,a2:59,s:"F",l:89,h:357,n:"成年女性标准（绝经后上限升高）"},{a1:60,a2:120,s:"M",l:149,h:416,n:"老年男性标准"},{a1:60,a2:120,s:"F",l:149,h:416,n:"老年女性标准"}]},
  VitD:{u:"ng/mL",cn:"25-羟维生素D",o:"水",r:[{a1:0,a2:17,s:"A",l:20,h:100,n:"青少年标准（<20为缺乏）"},{a1:18,a2:59,s:"A",l:20,h:100,n:"成人标准（30-50为理想）"},{a1:60,a2:120,s:"A",l:20,h:100,n:"老年人骨质疏松风险需≥30"}]},
};

// OCR 别名映射：不同医院使用的名称/缩写 → 标准 key
const OCR_ALIASES = {
  // 直接匹配
  "ALT":"ALT","AST":"AST","TBIL":"TBIL","SBP":"SBP","DBP":"DBP","RHR":"RHR",
  "FBG":"FBG","HbA1c":"HbA1c","TG":"TG","FVC":"FVC","SpO2":"SpO2","Cr":"Cr","UA":"UA","VitD":"VitD",
  // 英文别名
  "LDL-C":"LDL_C","LDL_C":"LDL_C","LDL":"LDL_C","LDLC":"LDL_C",
  "25-OH-D":"VitD","25OHD":"VitD","VD":"VitD","VITD":"VitD",
  "GLU":"FBG","FPG":"FBG",
  "CREA":"Cr","CRE":"Cr","SCr":"Cr",
  "URIC":"UA","UREA":"UA",
  "SPO2":"SpO2","SAO2":"SpO2",
  "HR":"RHR","PULSE":"RHR",
  "BP":"SBP", // 旧 key 兼容
  "TC":"TG", // 旧 TC 映射到 TG（最接近的代谢指标）
  // 中文别名
  "谷丙转氨酶":"ALT","谷草转氨酶":"AST","总胆红素":"TBIL",
  "收缩压":"SBP","舒张压":"DBP","心率":"RHR","静息心率":"RHR",
  "空腹血糖":"FBG","糖化血红蛋白":"HbA1c","甘油三酯":"TG",
  "肺活量":"FVC","血氧":"SpO2","血氧饱和度":"SpO2",
  "低密度脂蛋白":"LDL_C","低密度脂蛋白胆固醇":"LDL_C",
  "肌酐":"Cr","血肌酐":"Cr","尿酸":"UA",
  "维生素D":"VitD","25羟维生素D":"VitD",
};

// 单位换算：将常见非标准单位统一到标准单位
function normalizeUnit(key, value, sourceUnit) {
  if (value == null || isNaN(value)) return null;
  const std = RR[key]?.u;
  if (!std || !sourceUnit) return value;
  const su = sourceUnit.toLowerCase().replace(/\s/g,"");
  const tu = std.toLowerCase().replace(/\s/g,"");
  if (su === tu) return value;
  // 血糖 mg/dL → mmol/L
  if (key === "FBG" && su.includes("mg/dl")) return Math.round(value / 18.02 * 100) / 100;
  // 胆红素 mg/dL → μmol/L
  if (key === "TBIL" && su.includes("mg/dl")) return Math.round(value * 17.1 * 100) / 100;
  // 肌酐 mg/dL → μmol/L
  if (key === "Cr" && su.includes("mg/dl")) return Math.round(value * 88.4 * 100) / 100;
  // 尿酸 mg/dL → μmol/L
  if (key === "UA" && su.includes("mg/dl")) return Math.round(value * 59.48 * 100) / 100;
  // 胆固醇/TG/LDL mg/dL → mmol/L
  if ((key === "TG" || key === "LDL_C") && su.includes("mg/dl")) return Math.round(value / 38.67 * 100) / 100;
  // VitD nmol/L → ng/mL
  if (key === "VitD" && su.includes("nmol")) return Math.round(value / 2.496 * 100) / 100;
  return value;
}

function gR(k,age,sex) {
  const sp=RR[k]; if(!sp) return null;
  let best=null;
  for (const r of sp.r) { if(age>=r.a1&&age<=r.a2&&(r.s==="A"||r.s===sex)){best=r;break;} if(age>=r.a1&&age<=r.a2&&r.s==="A"&&!best)best=r; }
  if(!best) best=sp.r[sp.r.length-1];
  return {l:best.l,h:best.h,n:best.n,u:sp.u,cn:sp.cn,o:sp.o};
}

function oScore(ms,organ,age,sex) {
  const om=ms.filter(m=>RR[m.key]&&RR[m.key].o===organ&&m.value!=null); if(!om.length) return 50;
  const scores=om.map(m=>{const r=gR(m.key,age,sex);if(!r)return 50;const mid=(r.l+r.h)/2,half=(r.h-r.l)/2;if(half<=0)return 50;if(m.value<r.l)return Math.max(0,50-((r.l-m.value)/half)*40);if(m.value>r.h)return Math.max(0,50-((m.value-r.h)/half)*40);return 100-(Math.abs(m.value-mid)/half)*40;});
  return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10;
}

function calcColls(med,dest) {
  return ["火","土","金","水","木"].map(el=>{
    const ms=med[el]||50,ds=dest[el]||50,dv=Math.abs(ms-ds);
    const corr=(ms<50&&ds<50)?Math.min(100,100-dv+20):Math.max(0,100-dv*1.5);
    // 判断逻辑：区分"实际异常"和"先天短板"
    // med<45 = 体检有实际异常指标
    // dest<35 = 命理五行严重偏弱
    // dv>30 = 医学与命理偏离大（未必是坏事，可能是命理弱但体检正常）
    const hasRealAnomaly = ms < 45; // 体检层有实际问题
    const hasDestinyWeakness = ds < 35; // 命理层严重偏弱
    const lv = hasRealAnomaly ? "alert" :
               (hasRealAnomaly && hasDestinyWeakness) ? "alert" :
               (dv > 30 || hasDestinyWeakness || ms < 55) ? "caution" : "optimal";
    return {el,med:Math.round(ms*10)/10,dest:Math.round(ds*10)/10,dv:Math.round(dv*10)/10,corr:Math.round(corr*10)/10,lv,hasRealAnomaly,hasDestinyWeakness};
  });
}

// AI calls now go through Express backend at /api/* — see server/index.js
// Frontend uses src/api.js (apiOCR, apiScience, apiDestiny)

// ════════════════════════════════════════
// D3 INTERACTIVE RADAR COMPONENT
// ════════════════════════════════════════
function InteractiveRadar({ med, dest, colls, onSelectDimension, selectedDim, timeOffset = 0, radarLabels, tooltipLabels }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [hoveredDim, setHoveredDim] = useState(null);

  const order = ["火","土","金","水","木"];
  const labels = radarLabels || [["Fire","#c45a30"],["Earth","#a08a50"],["Metal","#9898a8"],["Water","#3a6a9a"],["Wood","#4a8a4a"]];
  const tl = tooltipLabels || { clinical:"Clinical", energetic:"Energetic", divergence:"Divergence", resonance:"Resonance" };
  const organMap = {"火":labels[0][0],"土":labels[1][0],"金":labels[2][0],"水":labels[3][0],"木":labels[4][0]};

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 340, height = 340;
    const cx = width / 2, cy = height / 2, r = 120;
    const angles = order.map((_, i) => (i * 2 * Math.PI / 5) - Math.PI / 2);

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");

    // Grid rings with subtle animation
    [1, 0.75, 0.5, 0.25].forEach((scale, idx) => {
      const pts = angles.map(a => [cx + r * scale * Math.cos(a), cy + r * scale * Math.sin(a)]);
      g.append("polygon")
        .attr("points", pts.map(p => p.join(",")).join(" "))
        .attr("fill", "none")
        .attr("stroke", "rgba(196,162,101,0.07)")
        .attr("stroke-width", idx === 0 ? 0.8 : 0.4);
    });

    // Axis lines
    angles.forEach(a => {
      g.append("line")
        .attr("x1", cx).attr("y1", cy)
        .attr("x2", cx + r * Math.cos(a)).attr("y2", cy + r * Math.sin(a))
        .attr("stroke", "rgba(196,162,101,0.05)")
        .attr("stroke-width", 0.5);
    });

    // Destiny polygon (filled area)
    const destPts = order.map((e, i) => [
      cx + r * (dest[e] || 50) / 100 * Math.cos(angles[i]),
      cy + r * (dest[e] || 50) / 100 * Math.sin(angles[i])
    ]);
    g.append("polygon")
      .attr("points", destPts.map(p => p.join(",")).join(" "))
      .attr("fill", "rgba(196,162,101,0.06)")
      .attr("stroke", "#c4a265")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0)
      .transition().duration(800).attr("opacity", 0.75);

    // Medical polygon (dashed)
    const medPts = order.map((e, i) => [
      cx + r * (med[e] || 50) / 100 * Math.cos(angles[i]),
      cy + r * (med[e] || 50) / 100 * Math.sin(angles[i])
    ]);
    g.append("polygon")
      .attr("points", medPts.map(p => p.join(",")).join(" "))
      .attr("fill", "rgba(224,220,212,0.04)")
      .attr("stroke", "#e0dcd4")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "5 3")
      .attr("opacity", 0)
      .transition().duration(800).delay(200).attr("opacity", 0.55);

    // Pulse warning for deviations > 30%
    colls.filter(c => c.lv === "alert").forEach(c => {
      const idx = order.indexOf(c.el);
      const pr = Math.max(c.med, c.dest) / 100;
      const px = cx + r * pr * Math.cos(angles[idx]);
      const py = cy + r * pr * Math.sin(angles[idx]);

      // Outer pulse ring
      const pulse = g.append("circle")
        .attr("cx", px).attr("cy", py).attr("r", 10)
        .attr("fill", "none").attr("stroke", "#c44040").attr("stroke-width", 1.2)
        .attr("opacity", 0.6);

      // Animate pulse
      (function pulsate() {
        pulse.transition().duration(1200)
          .attr("r", 22).attr("opacity", 0)
          .transition().duration(0)
          .attr("r", 10).attr("opacity", 0.6)
          .on("end", pulsate);
      })();

      // Inner warning dot
      g.append("circle")
        .attr("cx", px).attr("cy", py).attr("r", 4)
        .attr("fill", "#c44040").attr("opacity", 0.7);
    });

    // Interactive hit areas + data points
    order.forEach((el, i) => {
      const dv = dest[el] || 50, mv = med[el] || 50;
      const dx = cx + r * dv / 100 * Math.cos(angles[i]);
      const dy2 = cy + r * dv / 100 * Math.sin(angles[i]);
      const mx = cx + r * mv / 100 * Math.cos(angles[i]);
      const my = cy + r * mv / 100 * Math.sin(angles[i]);
      const coll = colls.find(c => c.el === el);
      const isSelected = selectedDim === el;

      // Destiny data point
      g.append("circle")
        .attr("cx", dx).attr("cy", dy2).attr("r", isSelected ? 5 : 3.5)
        .attr("fill", "#c4a265")
        .attr("stroke", isSelected ? "#fff" : "none")
        .attr("stroke-width", isSelected ? 1.5 : 0)
        .attr("opacity", 0.85)
        .attr("class", "dest-dot-" + el);

      // Medical data point
      g.append("circle")
        .attr("cx", mx).attr("cy", my).attr("r", isSelected ? 4.5 : 3)
        .attr("fill", "#e0dcd4")
        .attr("stroke", isSelected ? "#fff" : "none")
        .attr("stroke-width", isSelected ? 1.2 : 0)
        .attr("opacity", 0.65)
        .attr("class", "med-dot-" + el);

      // Invisible hit area for interaction
      const lx = cx + (r + 28) * Math.cos(angles[i]);
      const ly = cy + (r + 28) * Math.sin(angles[i]);

      g.append("circle")
        .attr("cx", lx).attr("cy", ly).attr("r", 28)
        .attr("fill", "transparent")
        .attr("cursor", "pointer")
        .on("mouseenter", (event) => {
          setHoveredDim(el);
          const tooltip = tooltipRef.current;
          if (tooltip) {
            const svgRect = svgRef.current.getBoundingClientRect();
            const scaleX = svgRect.width / width;
            const scaleY = svgRect.height / height;
            tooltip.style.opacity = 1;
            tooltip.style.left = (lx * scaleX - 80) + "px";
            tooltip.style.top = (ly * scaleY - 70) + "px";
          }
          // Highlight dots on hover
          svg.select(".dest-dot-" + el).transition().duration(150).attr("r", 6);
          svg.select(".med-dot-" + el).transition().duration(150).attr("r", 5);
        })
        .on("mouseleave", () => {
          setHoveredDim(null);
          if (tooltipRef.current) tooltipRef.current.style.opacity = 0;
          svg.select(".dest-dot-" + el).transition().duration(150).attr("r", isSelected ? 5 : 3.5);
          svg.select(".med-dot-" + el).transition().duration(150).attr("r", isSelected ? 4.5 : 3);
        })
        .on("click", () => {
          if (onSelectDimension) onSelectDimension(el === selectedDim ? null : el);
        });

      // Axis labels
      const labelR = r + 24;
      const labelX = cx + labelR * Math.cos(angles[i]);
      const labelY = cy + labelR * Math.sin(angles[i]);
      g.append("text")
        .attr("x", labelX).attr("y", labelY + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", isSelected ? 13 : 11)
        .attr("font-weight", isSelected ? 600 : 400)
        .attr("fill", isSelected ? "#fff" : labels[i][1])
        .attr("font-family", "'Noto Serif SC',serif")
        .attr("pointer-events", "none")
        .text(labels[i][0]);
    });

    // Center ornament
    g.append("circle")
      .attr("cx", cx).attr("cy", cy).attr("r", 7)
      .attr("fill", "#1a1a22").attr("stroke", "rgba(196,162,101,0.25)").attr("stroke-width", 0.5);
    g.append("text")
      .attr("x", cx).attr("y", cy + 3.5)
      .attr("text-anchor", "middle").attr("font-size", 8)
      .attr("fill", "#c4a265").attr("opacity", 0.5)
      .attr("font-family", "'Noto Serif SC',serif")
      .text("⟡");

  }, [med, dest, colls, selectedDim, timeOffset]);

  const hoveredColl = hoveredDim ? colls.find(c => c.el === hoveredDim) : null;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ width: "100%", maxWidth: 340, margin: "0 auto", display: "block" }} />
      {/* Tooltip */}
      <div ref={tooltipRef} style={{
        position: "absolute", pointerEvents: "none", opacity: 0, transition: "opacity .2s",
        background: "rgba(15,16,20,0.95)", border: "1px solid rgba(196,162,101,0.2)",
        padding: "10px 14px", minWidth: 160, zIndex: 20, backdropFilter: "blur(8px)"
      }}>
        {hoveredColl && (
          <>
            <div style={{ fontSize: ".8rem", color: EC[hoveredColl.el], fontWeight: 600, marginBottom: 4 }}>
              {organMap[hoveredColl.el]}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", marginBottom: 2 }}>
              <span style={{ color: "#e0dcd4" }}>{tl.clinical}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e0dcd4" }}>{hoveredColl.med}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", marginBottom: 2 }}>
              <span style={{ color: "#c4a265" }}>{tl.energetic}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#c4a265" }}>{hoveredColl.dest}%</span>
            </div>
            <div style={{ height: 1, background: "rgba(196,162,101,0.1)", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem" }}>
              <span style={{ color: "#9a9488" }}>{tl.divergence}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: sC[hoveredColl.lv] }}>{hoveredColl.dv}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem" }}>
              <span style={{ color: "#9a9488" }}>{tl.resonance}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: sC[hoveredColl.lv] }}>{hoveredColl.corr}%</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 4, fontSize: ".7rem", color: sC[hoveredColl.lv], fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".1em" }}>
              {sL[hoveredColl.lv]}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// STYLES
// ════════════════════════════════════════
const S = {
  card: { background:"#1a1a22", border:"1px solid rgba(196,162,101,0.08)", padding:"18px 20px", borderRadius:2 },
  mono: { fontFamily:"'JetBrains Mono',monospace" },
  label: { fontFamily:"'JetBrains Mono',monospace", fontSize:"0.72rem", color:"#6a5a35", letterSpacing:"0.2em", marginBottom:6 },
  btn: { padding:"12px 32px", background:"linear-gradient(135deg,#6a5a35,#c4a265)", border:"none", color:"#08080a", fontSize:"0.95rem", cursor:"pointer", fontFamily:"'Noto Serif SC',serif", letterSpacing:"0.08em", borderRadius:2 },
  btnGhost: { padding:"12px 32px", background:"transparent", border:"1px solid rgba(196,162,101,0.2)", color:"#c4a265", fontSize:"0.95rem", cursor:"pointer", fontFamily:"'Noto Serif SC',serif", letterSpacing:"0.08em", borderRadius:2 },
  input: { width:"100%", background:"#16161c", border:"1px solid rgba(196,162,101,0.12)", color:"#f0ece4", padding:"10px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:"0.95rem", outline:"none", borderRadius:2 },
};
const sC = {alert:"#c44040",caution:"#d4a840",optimal:"#52b09a"};
const sL = {alert:"重点关注",caution:"留意",optimal:"和谐"};

// ════════════════════════════════════════
// DEMO DATA — 15 标准化槽位
// ════════════════════════════════════════
const INIT_M = [
  {key:"ALT",value:null},{key:"AST",value:null},{key:"TBIL",value:null},
  {key:"SBP",value:null},{key:"DBP",value:null},{key:"RHR",value:null},
  {key:"FBG",value:null},{key:"HbA1c",value:null},{key:"TG",value:null},
  {key:"FVC",value:null},{key:"SpO2",value:null},{key:"LDL_C",value:null},
  {key:"Cr",value:null},{key:"UA",value:null},{key:"VitD",value:null},
];

// ════════════════════════════════════════
// LOGIN / REGISTER SCREEN
// ════════════════════════════════════════
function AuthScreen({ onLogin }) {
  const { t, locale, toggleLang } = useI18n();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) { setError(t('auth.fillBoth')); return; }
    try {
      if (mode === "register") {
        const res = await apiRegister(username.trim(), password);
        if (res.error) { setError(res.error); return; }
        onLogin({ userId: res.userId, username: res.username, birthYear:1990, birthMonth:6, birthDay:15, birthHour:12, sex:"M", metrics:INIT_M });
      } else {
        const res = await apiLogin(username.trim(), password);
        if (res.error) { setError(res.error); return; }
        const userData = { userId: res.userId, username: res.username, ...res.data };
        if (!userData.metrics) userData.metrics = INIT_M;
        onLogin(userData);
      }
    } catch (err) { setError(t('auth.networkError') + ": " + err.message); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Serif SC',serif",
      backgroundImage:"linear-gradient(rgba(196,162,101,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }}>
      <div style={{ width:420, padding:48, background:"#0f1014", border:"1px solid rgba(196,162,101,0.1)" }}>
        {/* Language toggle */}
        <div style={{ textAlign:"right", marginBottom:12 }}>
          <button onClick={toggleLang} style={{ background:"transparent", border:"1px solid rgba(196,162,101,.15)", color:"#5e5a52", padding:"3px 10px", fontSize:".72rem", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", borderRadius:2 }}>
            {locale === 'en' ? '中文' : 'EN'}
          </button>
        </div>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <svg viewBox="0 0 60 60" width="48" height="48" fill="none" style={{margin:"0 auto 16px",display:"block"}}>
            <circle cx="30" cy="30" r="28" stroke="#c4a265" strokeWidth=".6" opacity=".3"/>
            <circle cx="30" cy="22" r="5" stroke="#e0dcd4" strokeWidth=".5" opacity=".4"/>
            <path d="M30 27L30 48M30 34L22 40M30 34L38 40" stroke="#e0dcd4" strokeWidth=".5" opacity=".4"/>
            <circle cx="30" cy="30" r="18" stroke="#c4a265" strokeWidth=".3" strokeDasharray="3 6" opacity=".2">
              <animateTransform attributeName="transform" type="rotate" from="0 30 30" to="360 30 30" dur="30s" repeatCount="indefinite"/>
            </circle>
          </svg>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.5rem", fontWeight:300, letterSpacing:".15em", color:"#e0dcd4" }}>ANATOMYSELF</div>
          <div style={{ fontSize:"0.78rem", color:"#5e5a52", letterSpacing:".15em", marginTop:4 }}>{t('brand.tagline')}</div>
        </div>

        {/* Toggle */}
        <div style={{ display:"flex", marginBottom:28, border:"1px solid rgba(196,162,101,0.1)" }}>
          {[["login",t('auth.login')],["register",t('auth.register')]].map(([m,l]) => (
            <button key={m} onClick={()=>{setMode(m);setError("");}} style={{
              flex:1, padding:"10px", background:mode===m?"rgba(196,162,101,0.08)":"transparent",
              border:"none", color:mode===m?"#c4a265":"#5e5a52", fontSize:"0.95rem", cursor:"pointer",
              fontFamily:"'Noto Serif SC',serif", borderBottom:mode===m?"2px solid #c4a265":"2px solid transparent"
            }}>{l}</button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{t('auth.username')}</div>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder={t('auth.usernamePh')}
              style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          <div>
            <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{t('auth.password')}</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={t('auth.passwordPh')}
              style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          {error && <div style={{ fontSize:"0.85rem", color:"#c44040", padding:"8px 12px", background:"rgba(196,64,64,0.06)", border:"1px solid rgba(196,64,64,0.15)" }}>{error}</div>}
          <button onClick={handleSubmit} style={{...S.btn, width:"100%", marginTop:8}}>
            {mode==="login"?t('auth.loginBtn'):t('auth.registerBtn')}
          </button>
        </div>

        <div style={{ textAlign:"center", marginTop:24, fontSize:"0.8rem", color:"#3a3832", fontStyle:"italic", fontFamily:"'Cormorant Garamond',serif" }}>
          {t('brand.subtitle')}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// BIRTH SETUP SCREEN
// ════════════════════════════════════════
function BirthSetup({ user, onSave }) {
  const [by, setBY] = useState(user.birthYear || 1990);
  const [bm, setBM] = useState(user.birthMonth || 6);
  const [bd, setBD] = useState(user.birthDay || 15);
  const [bh, setBH] = useState(user.birthHour || 12);
  const [sex, setSex] = useState(user.sex || "M");

  const bazi = useMemo(() => calcBazi(by, bm, bd, bh), [by, bm, bd, bh]);
  const pls = [{lb:"年柱",s:bazi.year[0],b:bazi.year[1]},{lb:"月柱",s:bazi.month[0],b:bazi.month[1]},{lb:"日柱",s:bazi.day[0],b:bazi.day[1]},{lb:"时柱",s:bazi.hour[0],b:bazi.hour[1]}];

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Serif SC',serif",
      backgroundImage:"linear-gradient(rgba(196,162,101,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }}>
      <div style={{ width:480, padding:48, background:"#0f1014", border:"1px solid rgba(196,162,101,0.1)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.3rem", fontWeight:300, letterSpacing:".12em", color:"#e0dcd4" }}>设置您的生辰信息</div>
          <div style={{ fontSize:"0.85rem", color:"#5e5a52", marginTop:4 }}>欢迎, {user.username}</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
          {[["出生年",by,setBY,1940,2025],["月",bm,setBM,1,12],["日",bd,setBD,1,31]].map(([l,v,fn,min,max]) => (
            <div key={l}>
              <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{l}</div>
              <input type="number" value={v} min={min} max={max} onChange={e=>fn(parseInt(e.target.value)||min)} style={S.input} />
            </div>
          ))}
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>出生时辰（24小时制）</div>
          <input type="range" min="0" max="23" value={bh} onChange={e=>setBH(parseInt(e.target.value))} style={{ width:"100%", accentColor:"#c4a265" }} />
          <div style={{ textAlign:"center", ...S.mono, fontSize:"1.1rem", color:"#c4a265", marginTop:4 }}>{bh}:00</div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>生理性别</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["M","男"],["F","女"]].map(([v,l]) => (
              <button key={v} onClick={()=>setSex(v)} style={{
                flex:1, padding:"10px", fontSize:"1rem",
                background:sex===v?"rgba(196,162,101,0.1)":"#16161c",
                border:`1px solid ${sex===v?"rgba(196,162,101,0.3)":"rgba(196,162,101,0.08)"}`,
                color:sex===v?"#c4a265":"#5e5a52", cursor:"pointer", fontFamily:"'Noto Serif SC',serif"
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Live BaZi preview */}
        <div style={{ marginBottom:24 }}>
          <div style={S.label}>实时八字预览</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
            {pls.map(p => (
              <div key={p.lb} style={{ textAlign:"center", padding:"12px 6px", background:"#16161c", border:p.lb==="日柱"?`2px solid ${EC[bazi.dme]}`:"1px solid rgba(196,162,101,0.06)" }}>
                <div style={{ fontSize:"0.72rem", color:"#5e5a52", marginBottom:6 }}>{p.lb}</div>
                <div style={{ fontSize:"1.5rem", color:"#e0dcd4", fontWeight:300, lineHeight:1.2 }}>{p.s}</div>
                <div style={{ fontSize:"1.5rem", color:"#c4a265", fontWeight:400, lineHeight:1.2 }}>{p.b}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:10, fontSize:"0.9rem", color:EC[bazi.dme] }}>
            日主：{bazi.dm} ({bazi.dme})
          </div>
        </div>

        <button onClick={()=>onSave({birthYear:by,birthMonth:bm,birthDay:bd,birthHour:bh,sex})} style={{...S.btn, width:"100%"}}>
          保存并进入系统 →
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [setupDone, setSetupDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { setTimeout(()=>setReady(true), 100); }, []);

  // Auth handlers
  const handleLogin = useCallback((userData) => { setUser(userData); setSetupDone(!!userData.setupComplete); }, []);

  const handleBirthSave = useCallback(async (birthData) => {
    const updated = { ...user, ...birthData, setupComplete: true };
    setUser(updated);
    setSetupDone(true);
    try { if (updated.userId) await apiSaveUser(updated.userId, updated); } catch {}
  }, [user]);

  const handleLogout = useCallback(() => { apiLogout(); setUser(null); setSetupDone(false); }, []);

  // Show auth screen
  if (!user) return <AuthScreen onLogin={handleLogin} />;
  if (!setupDone) return <BirthSetup user={user} onSave={handleBirthSave} />;

  return <Dashboard user={user} setUser={setUser} onLogout={handleLogout} />;
}

// ════════════════════════════════════════
// DASHBOARD (post-login)
// ════════════════════════════════════════
function Dashboard({ user, setUser, onLogout }) {
  const { t, locale, toggleLang } = useI18n();
  // Helper: get system label from WX element
  const sysLabel = (el) => t(`systems.${t(`systemMap.${el}`)}.name`);
  const sysOrgan = (el) => t(`systems.${t(`systemMap.${el}`)}.organ`);
  const elName = (el) => t(`elements.${el}`);
  // Metric display name based on locale
  const mName = (key) => locale === 'en' ? (RR_EN_SHORT[key] || key) : (RR[key]?.cn || key);
  const mNameFull = (key) => locale === 'en' ? (RR_EN[key] || key) : (RR[key]?.cn || key);
  const statusText = (st) => locale === 'en' ? (st === '偏高' ? 'High' : st === '偏低' ? 'Low' : st) : st;
  // Ensure all 15 standard slots exist, merging any saved data
  const initMetrics = useMemo(() => {
    const saved = user.metrics || [];
    // Start from 15 standard slots
    return INIT_M.map(slot => {
      const existing = saved.find(m => m.key === slot.key);
      // Also check old key aliases (BP→SBP, TC→TG)
      const aliased = !existing && slot.key === "SBP" ? saved.find(m => m.key === "BP") :
                      !existing && slot.key === "TG" ? saved.find(m => m.key === "TC") : null;
      return existing ? { ...slot, value: existing.value } :
             aliased ? { ...slot, value: aliased.value } : slot;
    });
  }, []);
  const [metrics, setMetrics] = useState(initMetrics);
  const [file, setFile] = useState(null);
  const [ocr, setOcr] = useState(null);
  const [ocrL, setOcrL] = useState(false);
  const [sci, setSci] = useState(null);
  const [sciL, setSciL] = useState(false);
  const [dst, setDst] = useState(null);
  const [dstL, setDstL] = useState(false);
  const [tab, setTab] = useState("upload");
  const [pipe, setPipe] = useState([{lb:"Upload",st:"idle"},{lb:"OCR",st:"idle"},{lb:"Science",st:"idle"},{lb:"Meta",st:"idle"}]);
  const fileRef = useRef(null);
  // Analysis ceremony state
  const [analysisActive, setAnalysisActive] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState(-1);
  const analysisTimerRef = useRef(null);
  // Chat state
  const [chatBrain, setChatBrain] = useState("science"); // "science" or "destiny"
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  // Radar interaction state
  const [selectedDim, setSelectedDim] = useState(null);
  const [timeOffset, setTimeOffset] = useState(0); // Reserved for temporal navigation

  const by=user.birthYear, bm=user.birthMonth, bd=user.birthDay, bh=user.birthHour, sex=user.sex;

  const age = useMemo(() => {
    const t=new Date(); let a=t.getFullYear()-by;
    if(t.getMonth()+1<bm||(t.getMonth()+1===bm&&t.getDate()<bd)) a--;
    return Math.max(0,a);
  }, [by,bm,bd]);

  const bazi = useMemo(()=>calcBazi(by,bm,bd,bh), [by,bm,bd,bh]);
  const dy = useMemo(()=>calcDY(bazi,age,sex), [bazi,age,sex]);
  const ln = useMemo(()=>calcLN(new Date().getFullYear()), []);
  // 时空快进：根据 timeOffset 计算目标月份的五行力量
  const targetMonth = useMemo(() => {
    const now = new Date();
    const m = now.getMonth() + 1 + timeOffset; // 1-based
    return ((m - 1) % 12 + 12) % 12 + 1; // wrap 1-12
  }, [timeOffset]);
  const targetYear = useMemo(() => {
    const now = new Date();
    return now.getFullYear() + Math.floor((now.getMonth() + timeOffset) / 12);
  }, [timeOffset]);
  const targetLN = useMemo(() => calcLN(targetYear), [targetYear]);
  const destWX = useMemo(() => {
    const base = applyTemp(calcWX(bazi), dy, targetLN);
    return timeOffset === 0 ? base : applyMonthEffect(base, targetMonth);
  }, [bazi, dy, targetLN, timeOffset, targetMonth]);
  const medWX = useMemo(()=>{const r={};["木","火","土","金","水"].forEach(e=>r[e]=oScore(metrics,e,age,sex));return r;}, [metrics,age,sex]);
  const colls = useMemo(()=>calcColls(medWX,destWX), [medWX,destWX]);
  const anoms = useMemo(()=>metrics.filter(m=>{if(m.value==null)return false;const r=gR(m.key,age,sex);return r&&(m.value<r.l||m.value>r.h);}).map(m=>({...m,ref:gR(m.key,age,sex),st:m.value>(gR(m.key,age,sex)?.h||999)?"偏高":"偏低"})), [metrics,age,sex]);

  const _pl = locale==="en" ? ["Year","Month","Day","Hour"] : ["年柱","月柱","日柱","时柱"];
  const pls = [{lb:_pl[0],s:bazi.year[0],b:bazi.year[1]},{lb:_pl[1],s:bazi.month[0],b:bazi.month[1]},{lb:_pl[2],s:bazi.day[0],b:bazi.day[1]},{lb:_pl[3],s:bazi.hour[0],b:bazi.hour[1]}];
  const baziStr = pls.map(p=>p.s+p.b).join(" ");

  // Save metrics to storage
  const saveData = useCallback(async (newMetrics) => {
    const updated = {...user, metrics: newMetrics};
    setUser(updated);
    try { if (user.userId) await apiSaveUser(user.userId, updated); } catch {}
  }, [user, setUser]);

  const updateMetric = useCallback((key, value) => {
    const parsed = (value === null || value === "" || value === undefined) ? null : parseFloat(value);
    const finalVal = (parsed !== null && isNaN(parsed)) ? null : parsed;
    const exists = metrics.some(m => m.key === key);
    const newM = exists
      ? metrics.map(m => m.key === key ? { ...m, value: finalVal } : m)
      : [...metrics, { key, value: finalVal }];
    setMetrics(newM);
    saveData(newM);
  }, [metrics, saveData]);

  // ── OCR ──
  const doOCR = useCallback(async (e) => {
    const f = e.target.files?.[0]; if(!f) return;
    setFile(f); setOcr(null); setSci(null); setDst(null);
    setPipe(p=>p.map((s,i)=>({...s,st:i===0?"done":"idle"})));
    setOcrL(true); setPipe(p=>p.map((s,i)=>i===1?{...s,st:"running"}:s));
    try {
      const res = await apiOCR(f);
      setOcr(res);
      if (res.ocr_unavailable) {
        // OCR not available — show message, keep pipeline going
        setPipe(p=>p.map((s,i)=>i===1?{...s,st:"done"}:s));
      } else {
        setPipe(p=>p.map((s,i)=>i===1?{...s,st:"done"}:s));
        if(res.metrics?.length) {
          const newM=[...metrics];
          res.metrics.filter(m=>m.value!=null).forEach(m=>{
            // 通过别名映射找到标准key
            const stdKey = OCR_ALIASES[m.code] || OCR_ALIASES[m.name] || m.code;
            if (!RR[stdKey]) return; // 不在15个标准指标中则跳过
            // 单位换算
            const normalized = normalizeUnit(stdKey, m.value, m.unit);
            if (normalized == null) return;
            const idx=newM.findIndex(x=>x.key===stdKey);
            if(idx>=0) newM[idx]={...newM[idx],value:normalized};
          });
          setMetrics(newM); saveData(newM);
        }
      }
    } catch(err) { setOcr({error:err.message}); setPipe(p=>p.map((s,i)=>i===1?{...s,st:"idle"}:s)); }
    setOcrL(false);
  }, [metrics, saveData]);

  // ── SCIENCE BRAIN ──
  const doSci = useCallback(async () => {
    setSciL(true); setSci(null); setPipe(p=>p.map((s,i)=>i===2?{...s,st:"running"}:s));
    try {
      // 构建全部已录入指标的概况（不只是异常项）
      const filledMetrics = metrics.filter(m => m.value != null);
      const allData = filledMetrics.map(m => {
        const ref = gR(m.key, age, sex);
        if (!ref) return null;
        const inRange = m.value >= ref.l && m.value <= ref.h;
        return { key: m.key, cn: ref.cn, value: m.value, unit: ref.u, low: ref.l, high: ref.h, status: inRange ? "正常" : (m.value > ref.h ? "偏高" : "偏低"), organ: ref.o };
      }).filter(Boolean);

      if (anoms.length > 0) {
        // 有异常 → 重点分析异常项
        const anomalyData = anoms.map(a => ({ key: a.key, cn: a.ref.cn, value: a.value, unit: a.ref.u, low: a.ref.l, high: a.ref.h, status: a.st }));
        const res = await apiScience({ age, sex, anomalies: anomalyData, lang: locale });
        setSci(res);
      } else {
        // 全部正常 → 发送全部数据做健康确认
        const res = await apiScience({ age, sex, anomalies: [], allMetrics: allData, lang: locale });
        setSci(res);
      }
      setPipe(p=>p.map((s,i)=>i===2?{...s,st:"done"}:s));
    } catch (err) {
      setSci({ items: [], summary: (locale==='en'?"Science Brain error: ":"科学大脑分析失败: ") + err.message });
      setPipe(p=>p.map((s,i)=>i===2?{...s,st:"idle"}:s));
    }
    setSciL(false);
  }, [anoms, metrics, age, sex, locale]);

  // ── DESTINY BRAIN — 始终独立工作 ──
  const doDst = useCallback(async () => {
    setDstL(true); setDst(null); setPipe(p=>p.map((s,i)=>i===3?{...s,st:"running"}:s));

    // 构建 findings：优先用科学脑结果，否则用原始指标概况
    let findings;
    if (sci && sci.items && sci.items.length > 0) {
      findings = sci.items.map(it => it.metric_cn + "(" + it.organ_system + "): " + it.physiological_analysis).join("\n");
    } else if (anoms.length > 0) {
      findings = anoms.map(a => a.ref.cn + "(" + a.ref.o + "): " + a.key + "=" + a.value + a.ref.u + " " + a.st).join("\n");
    } else {
      // 全部正常 → 告知命理脑当前健康状况良好，让它聚焦先天格局分析
      const filledMetrics = metrics.filter(m => m.value != null);
      const summary = filledMetrics.map(m => {
        const ref = gR(m.key, age, sex);
        return ref ? `${ref.cn}(${ref.o}): ${m.value}${ref.u} 正常` : null;
      }).filter(Boolean).join("\n");
      findings = "所有体检指标均在正常范围内。\n" + (summary || "暂无录入指标。") +
        "\n\n请重点分析：1) 八字先天五行格局中哪些脏腑为薄弱环节；2) 当前大运流年对各脏腑的影响趋势；3) 虽然体检正常但命理上需要长期关注的方向。";
    }

    try {
      const res = await apiDestiny({
        baziPillars: {
          year: bazi.year[0] + bazi.year[1],
          month: bazi.month[0] + bazi.month[1],
          day: bazi.day[0] + bazi.day[1],
          hour: bazi.hour[0] + bazi.hour[1],
        },
        baziStr, dayMaster: bazi.dm, dayMasterElement: bazi.dme,
        dayun: dy, liunian: ln, wuxing: destWX, findings, lang: locale
      });
      setDst(res);
      setPipe(p=>p.map((s,i)=>i===3?{...s,st:"done"}:s));
    } catch (err) {
      setDst({ collision_items: [], temporal_outlook: (locale==='en'?"Meta Brain error: ":"命理大脑分析失败: ") + err.message, bazi_analysis: null });
      setPipe(p=>p.map((s,i)=>i===3?{...s,st:"idle"}:s));
    }
    setDstL(false);
  }, [sci, anoms, metrics, age, sex, baziStr, bazi, dy, ln, destWX, locale]);

  useEffect(() => {
    // Auto-trigger destiny brain when science completes
    // Trigger if: sci exists AND (has items OR has summary) AND destiny not yet started
    if (sci && !dst && !dstL) {
      if ((sci.items && sci.items.length > 0) || sci.summary) {
        doDst();
      }
    }
  }, [sci, dst, dstL, doDst]);

  // ── CHAT FUNCTION ──
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", text: q, brain: chatBrain }]);
    setChatLoading(true);
    try {
      // Build context for the AI
      let ctx = `User: ${age}y/o ${sex === "M" ? "male" : "female"}, Day Master ${bazi.dm}(${bazi.dme}), Major Cycle ${dy.lbl}, Annual Cycle ${ln.lbl}\n`;
      if (sci?.summary) ctx += `Science Brain Summary: ${sci.summary}\n`;
      if (dst?.temporal_outlook) ctx += `Meta Brain Summary: ${dst.temporal_outlook}\n`;
      if (sci?.items?.length) ctx += `Anomalies: ${sci.items.map(i => i.metric || i.metric_cn).join(", ")}\n`;
      // Add last few chat messages for continuity
      const recent = chatHistory.slice(-4).map(m => `${m.role === "user" ? "User" : (m.brain === "science" ? "Science Brain" : "Meta Brain")}: ${m.text}`).join("\n");
      if (recent) ctx += `\nChat History:\n${recent}`;

      const res = await apiChat({ brain: chatBrain, question: q, context: ctx, lang: locale });
      setChatHistory(prev => [...prev, { role: "assistant", text: res.answer || (locale==='en'?"No response":"无回答"), brain: chatBrain }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "assistant", text: (locale==='en'?"Chat error: ":"对话失败: ") + err.message, brain: chatBrain }]);
    }
    setChatLoading(false);
  }, [chatInput, chatBrain, chatLoading, chatHistory, age, sex, bazi, dy, ln, sci, dst, locale]);

  // ── 科学脑报告：生命说明书 ──
  const generateScienceReport = useCallback(() => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    const filledM = metrics.filter(m => m.value != null);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AnatomySelf · 生命说明书</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300;400;600&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08080a;color:#e0dcd4;font-family:'Noto Serif SC',serif;padding:40px;min-height:100vh}
.container{max-width:680px;margin:0 auto}
.header{text-align:center;padding:40px 0 30px;border-bottom:1px solid rgba(196,162,101,.12)}
.header h1{font-size:1.8rem;font-weight:300;letter-spacing:.2em;color:#c4a265}
.header .sub{font-size:.85rem;color:#5e5a52;margin-top:8px;letter-spacing:.15em}
.header .date{font-family:'JetBrains Mono',monospace;font-size:.75rem;color:#3a3832;margin-top:12px}
.section{margin:28px 0;padding:20px 0;border-bottom:1px solid rgba(196,162,101,.06)}
.section-title{font-size:.72rem;font-family:'JetBrains Mono',monospace;color:#6a5a35;letter-spacing:.2em;margin-bottom:14px}
.wx-group{display:flex;gap:6px;margin-bottom:12px;align-items:center}
.wx-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.wx-label{font-size:.9rem;width:80px}
.metric-row{display:flex;justify-content:space-between;padding:6px 12px;margin:3px 0;background:#16161c}
.metric-name{font-size:.88rem}
.metric-val{font-family:'JetBrains Mono',monospace;font-size:.88rem}
.normal{color:#52b09a}.abnormal{color:#c44040}
.summary-box{padding:16px 20px;background:rgba(82,176,154,.04);border:1px solid rgba(82,176,154,.1);margin:16px 0;line-height:1.8;font-size:.88rem;color:#9a9488}
.item-card{padding:14px 16px;background:#16161c;margin:8px 0;border-left:3px solid #52b09a}
.item-title{font-size:.95rem;color:#e0dcd4;margin-bottom:6px}
.item-body{font-size:.85rem;color:#9a9488;line-height:1.8}
.item-rec{font-size:.82rem;color:#52b09a;margin-top:6px}
.footer{text-align:center;padding:30px 0;font-size:.7rem;color:#3a3832;border-top:1px solid rgba(196,162,101,.06);margin-top:30px}
.disclaimer{font-size:.7rem;color:#4a4a44;line-height:1.7;padding:12px 16px;background:rgba(196,162,101,.02);border:1px solid rgba(196,162,101,.06);margin-top:20px}
@media print{body{padding:20px}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="container">
<div class="header">
<div style="font-size:.75rem;color:#3a3832;letter-spacing:.3em">ANATOMYSELF</div>
<h1>生 命 说 明 书</h1>
<div class="sub">${user.username} · ${age}y/o ${sex==="M"?"Male":"Female"} · Day Master ${bazi.dm}(${bazi.dme})</div>
<div class="date">${dateStr} · 大运${dy.lbl} · 流年${targetLN.lbl}</div>
</div>

<div class="section">
<div class="section-title">VITAL SIGNS · 生命体征概览</div>
${WX_GROUPS.map(g => {
  const items = g.keys.map(k => {
    const m = metrics.find(x=>x.key===k);
    const ref = gR(k,age,sex);
    if(!ref) return '';
    const hasVal = m?.value != null;
    const inR = hasVal && m.value>=ref.l && m.value<=ref.h;
    return `<div class="metric-row"><span class="metric-name">${ref.cn} <span style="font-size:.65rem;color:#5e5a52">${k}</span></span><span class="metric-val ${hasVal?(inR?'normal':'abnormal'):''}">${hasVal?m.value:'—'} <span style="font-size:.68rem;color:#3a3832">${ref.u}</span></span></div>`;
  }).join('');
  return `<div style="margin-bottom:16px"><div class="wx-group"><div class="wx-dot" style="background:${EC[g.el]}"></div><div class="wx-label" style="color:${EC[g.el]}">${g.el} · ${sysLabel(g.el)}</div></div>${items}</div>`;
}).join('')}
</div>

${sci?.items?.length ? `<div class="section">
<div class="section-title">ANALYSIS · 科学脑深度解读</div>
${sci.items.map(it => `<div class="item-card" style="border-color:${EC[it.organ_system]||'#52b09a'}">
<div class="item-title">${it.metric_cn} <span style="font-size:.75rem;color:${EC[it.organ_system]}">${it.organ_system}</span></div>
<div class="item-body">${it.physiological_analysis}</div>
${it.recommendation ? `<div class="item-rec">💡 ${it.recommendation}</div>` : ''}
</div>`).join('')}
</div>` : ''}

${sci?.summary ? `<div class="summary-box">📋 ${sci.summary}</div>` : ''}

<div class="disclaimer">⚕ 本报告由 AI 模型基于体检数据生成，仅供健康参考，不构成医疗诊断或治疗建议。如有健康问题，请咨询专业医疗机构。</div>

<div class="footer">
ANATOMYSELF · 个人生命实验室<br>
Where anatomical precision meets celestial cartography
</div>
</div></body></html>`;
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `AnatomySelf_生命说明书_${dateStr}.html`; a.click();
    URL.revokeObjectURL(url);
  }, [metrics, sci, age, sex, user, bazi, dy, targetLN]);

  // ── 命理脑报告：一周能量防御指南 ──
  const generateDestinyGuide = useCallback(() => {
    const now = new Date();
    const weekDays = ["日","一","二","三","四","五","六"];
    // 生成未来7天的五行能量分布
    const days = Array.from({length:7}, (_, i) => {
      const d = new Date(now.getTime() + i * 864e5);
      const ds = SC[md(Math.round((d - new Date(2000,0,7))/864e5), 10)];
      const db = BC[md(Math.round((d - new Date(2000,0,7))/864e5), 12)];
      const dayEl = TG[ds][0];
      // 日干与日主的关系
      const rel = dayEl === bazi.dme ? "比肩" :
                  GEN[bazi.dme] === dayEl ? "食伤" :
                  CTL[bazi.dme] === dayEl ? "财星" :
                  GEN[dayEl] === bazi.dme ? "印星" : "官杀";
      const energy = dayEl === bazi.dme ? 90 :
                     GEN[dayEl] === bazi.dme ? 80 :
                     GEN[bazi.dme] === dayEl ? 60 :
                     CTL[dayEl] === bazi.dme ? 30 : 45;
      return {
        date: `${d.getMonth()+1}/${d.getDate()}`,
        weekday: weekDays[d.getDay()],
        gan: ds, zhi: db, el: dayEl, rel, energy,
        advice: energy >= 80 ? "宜进取" : energy >= 60 ? "宜平稳" : "宜守护",
        organ: sysOrgan(dayEl),
      };
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AnatomySelf · 一周能量防御指南</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300;400;600&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08080a;color:#e0dcd4;font-family:'Noto Serif SC',serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{width:400px;padding:36px 32px;background:linear-gradient(160deg,#0f1014,#16161c,#0f1014);border:1px solid rgba(196,162,101,.12);position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#4a8a4a,#c45a30,#a08a50,#9898a8,#3a6a9a)}
.title{text-align:center;margin-bottom:24px}
.title h2{font-size:1.1rem;font-weight:300;color:#c4a265;letter-spacing:.25em}
.title .sub{font-size:.72rem;color:#5e5a52;margin-top:6px;font-family:'JetBrains Mono',monospace}
.day{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(196,162,101,.05)}
.day:last-child{border:none}
.day-date{width:48px;text-align:center}
.day-date .d{font-size:.88rem;color:#9a9488}
.day-date .w{font-size:.65rem;color:#5e5a52;font-family:'JetBrains Mono',monospace}
.day-el{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:600}
.day-info{flex:1}
.day-info .gz{font-size:.82rem;color:#e0dcd4}
.day-info .rel{font-size:.7rem;color:#5e5a52;margin-top:2px}
.day-bar{width:80px}
.day-bar .bar{height:3px;background:#08080a;border-radius:2px}
.day-bar .fill{height:100%;border-radius:2px;transition:width .4s}
.day-advice{font-size:.72rem;width:50px;text-align:right}
.footer{text-align:center;margin-top:20px;font-size:.6rem;color:#3a3832;letter-spacing:.1em}
.dm{text-align:center;margin-bottom:16px;padding:8px 12px;background:rgba(196,162,101,.03);border:1px solid rgba(196,162,101,.06)}
.dm span{font-size:.82rem;color:#c4a265}
.disclaimer{font-size:.58rem;color:#3a3832;text-align:center;margin-top:14px;line-height:1.5}
</style></head><body><div class="card">
<div class="title">
<div style="font-size:.6rem;color:#3a3832;letter-spacing:.3em;margin-bottom:4px">ANATOMYSELF</div>
<h2>一周能量防御指南</h2>
<div class="sub">${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} – ${new Date(now.getTime()+6*864e5).getMonth()+1}/${new Date(now.getTime()+6*864e5).getDate()}</div>
</div>
<div class="dm">日主 <span>${bazi.dm}(${bazi.dme})</span> · 大运 <span>${dy.lbl}</span> · ${targetLN.lbl}年</div>
${days.map(d => `<div class="day">
<div class="day-date"><div class="d">${d.date}</div><div class="w">周${d.weekday}</div></div>
<div class="day-el" style="background:${EC[d.el]}22;color:${EC[d.el]}">${d.el}</div>
<div class="day-info"><div class="gz">${d.gan}${d.zhi} <span style="font-size:.7rem;color:${EC[d.el]}">${d.organ}</span></div><div class="rel">${d.rel}</div></div>
<div class="day-bar"><div class="bar"><div class="fill" style="width:${d.energy}%;background:${d.energy>=80?'#52b09a':d.energy>=60?'#d4a840':'#c44040'}"></div></div></div>
<div class="day-advice" style="color:${d.energy>=80?'#52b09a':d.energy>=60?'#d4a840':'#c44040'}">${d.advice}</div>
</div>`).join('')}
<div class="disclaimer">☯ 基于传统八字命理推演，属文化参考，不构成医疗建议</div>
<div class="footer">ANATOMYSELF · 个人生命实验室</div>
</div></body></html>`;
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `AnatomySelf_能量防御指南_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.html`; a.click();
    URL.revokeObjectURL(url);
  }, [bazi, dy, targetLN]);

  // Analysis ceremony phases
  const analysisPhases = useMemo(() => {
    const yr = bazi.year[0]+bazi.year[1];
    const filled = metrics.filter(m=>m.value!=null).length;
    return locale === 'en' ? [
      { t:0, msg:`Normalizing ${filled} clinical biomarkers...`, icon:"◎" },
      { t:3000, msg:`Mapping ${by} ${bazi.dme}-element energetic blueprint...`, icon:"☯" },
      { t:6000, msg:"BioSelf: Analyzing cardiovascular & metabolic risks...", icon:"🔬" },
      { t:12000, msg:`MetaSelf: Calculating ${bazi.dme} resonance for ${targetLN.lbl} year...`, icon:"⟡" },
      { t:20000, msg:"Dual-Brain engine debating your results...", icon:"⚡" },
      { t:30000, msg:"Synthesizing personalized recommendations...", icon:"◉" },
    ] : [
      { t:0, msg:`正在标准化 ${filled} 项临床指标...`, icon:"◎" },
      { t:3000, msg:`映射 ${yr} ${bazi.dme}行能量蓝图...`, icon:"☯" },
      { t:6000, msg:"科学脑：分析心血管与代谢风险...", icon:"🔬" },
      { t:12000, msg:`命理脑：推演${bazi.dme}行在${targetLN.lbl}年的共振...`, icon:"⟡" },
      { t:20000, msg:"双脑引擎正在交叉辩证...", icon:"⚡" },
      { t:30000, msg:"生成个性化建议中...", icon:"◉" },
    ];
  }, [locale, bazi, by, metrics, targetLN]);

  const startAnalysisCeremony = useCallback(async () => {
    setAnalysisActive(true);
    setAnalysisPhase(0);
    // Progress through phases on timers
    const timers = [];
    analysisPhases.forEach((p, i) => {
      if (i > 0) timers.push(setTimeout(() => setAnalysisPhase(i), p.t));
    });
    analysisTimerRef.current = timers;
    // Actually run the analysis
    setPipe(p=>p.map((s,i)=>i>=2?{...s,st:"idle"}:s));
    setDst(null);
    await doSci();
  }, [analysisPhases, doSci]);

  // End ceremony when both brains complete
  useEffect(() => {
    if (analysisActive && sci && dst && !sciL && !dstL) {
      // Both done — show final phase briefly then close
      setAnalysisPhase(analysisPhases.length - 1);
      const t = setTimeout(() => {
        setAnalysisActive(false);
        setAnalysisPhase(-1);
        if (analysisTimerRef.current) analysisTimerRef.current.forEach(clearTimeout);
        setTab("radar"); // Auto-navigate to results
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [analysisActive, sci, dst, sciL, dstL, analysisPhases]);

  const tabs = [
    { id: "upload", lb: "📄 " + t('nav.dataCenter') },
    { id: "radar", lb: "⚡ " + t('nav.collisionAnalysis') },
    { id: "tuning", lb: "🎯 " + t('nav.lifeTuning') },
    { id: "chat", lb: "💬 " + t('nav.deepChat') },
    { id: "metrics", lb: "📊 " + t('nav.biomarkers') },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", color:"#e0dcd4", fontFamily:"'Noto Serif SC',serif", fontSize:"14px",
      backgroundImage:"linear-gradient(rgba(196,162,101,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }}>

      {/* ANALYSIS CEREMONY OVERLAY */}
      {analysisActive && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(8,8,10,0.92)", backdropFilter:"blur(16px)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          animation:"fadeIn .4s ease-out",
        }}>
          {/* Dual-brain collision animation */}
          <div style={{ position:"relative", width:200, height:120, marginBottom:32 }}>
            {/* Science orb — left */}
            <div style={{
              position:"absolute", left: analysisPhase >= 4 ? 60 : 20, top:20,
              width:60, height:60, borderRadius:"50%",
              background:"radial-gradient(circle, rgba(82,176,154,0.15), rgba(82,176,154,0.03))",
              border:"1px solid rgba(82,176,154,0.2)",
              transition:"left 8s ease-in-out",
              animation:"breathe 3s ease-in-out infinite",
            }}>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".7rem", color:"#52b09a", fontFamily:"'JetBrains Mono',monospace" }}>BIO</div>
            </div>
            {/* Meta orb — right */}
            <div style={{
              position:"absolute", right: analysisPhase >= 4 ? 60 : 20, top:20,
              width:60, height:60, borderRadius:"50%",
              background:"radial-gradient(circle, rgba(196,162,101,0.15), rgba(196,162,101,0.03))",
              border:"1px solid rgba(196,162,101,0.2)",
              transition:"right 8s ease-in-out",
              animation:"breathe 3s ease-in-out infinite 1.5s",
            }}>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".7rem", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace" }}>META</div>
            </div>
            {/* Collision spark — center */}
            {analysisPhase >= 4 && (
              <div style={{
                position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)",
                width:8, height:8, borderRadius:"50%", background:"#e0dcd4",
                boxShadow:"0 0 20px rgba(224,220,212,0.4), 0 0 40px rgba(196,162,101,0.2)",
                animation:"pulse 1.5s ease-in-out infinite",
              }}/>
            )}
          </div>

          {/* Phase status — typewriter */}
          <div style={{ textAlign:"center", maxWidth:500 }}>
            <div style={{ ...S.mono, fontSize:".7rem", color:"#3a3832", letterSpacing:".2em", marginBottom:12 }}>
              {locale === 'en' ? 'DUAL-BRAIN ANALYSIS' : '双脑对撞分析'}
            </div>
            {analysisPhases.slice(0, analysisPhase + 1).map((p, i) => (
              <div key={i} style={{
                fontSize:".82rem", color: i === analysisPhase ? "#e0dcd4" : "#3a3832",
                marginBottom:6, transition:"color .5s",
                fontFamily:"'JetBrains Mono',monospace",
                animation: i === analysisPhase ? "fadeIn .5s ease-out" : "none",
              }}>
                <span style={{ color: i === analysisPhase ? "#c4a265" : "#2a2a2a", marginRight:8 }}>{p.icon}</span>
                {p.msg}
              </div>
            ))}
          </div>

          {/* Breathing indicator */}
          <div style={{ marginTop:24, width:120, height:2, background:"#16161c", borderRadius:1, overflow:"hidden" }}>
            <div style={{
              height:"100%", width:"30%", background:"linear-gradient(90deg, #52b09a, #c4a265)",
              borderRadius:1, animation:"shimmer 2s ease-in-out infinite",
            }}/>
          </div>

          <div style={{ marginTop:16, fontSize:".72rem", color:"#3a3832", fontStyle:"italic", fontFamily:"'Cormorant Garamond',serif" }}>
            {locale === 'en'
              ? 'Our Dual-Brain engine is debating your results. This takes 30-60 seconds for deep precision.'
              : '双脑引擎正在交叉辩证，深度精准分析需要 30-60 秒。'}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(196,162,101,.08)", background:"rgba(8,8,10,.92)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <svg viewBox="0 0 28 28" width="22" height="22" fill="none"><circle cx="14" cy="14" r="13" stroke="#c4a265" strokeWidth=".5" opacity=".4"/><circle cx="14" cy="10" r="2.5" stroke="#e0dcd4" strokeWidth=".4" opacity=".4"/><path d="M14 12.5L14 22M14 16L10 19M14 16L18 19" stroke="#e0dcd4" strokeWidth=".4" opacity=".4"/></svg>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:"1rem", letterSpacing:".12em" }}>ANATOMYSELF</div>
            <div style={{ fontSize:".65rem", color:"#5e5a52", letterSpacing:".2em" }}>{t('header.dualBrain')}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
            {pls.map(p => <div key={p.lb} style={{ textAlign:"center", padding:"2px 5px", background:"#16161c", border:"1px solid rgba(196,162,101,.06)" }}>
              <div style={{ fontSize:".8rem", color:"#e0dcd4", lineHeight:1.1 }}>{p.s}{p.b}</div>
            </div>)}
          </div>
          <span style={{ ...S.mono, fontSize:".75rem", color:"#5e5a52" }}>{user.username} · {age}{t('sidebar.age')}</span>
          <div onClick={toggleLang} style={{ cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:"50%", background:"rgba(196,162,101,.04)", border:"1px solid rgba(196,162,101,.06)", transition:"all .25s", position:"relative" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(196,162,101,.25)";e.currentTarget.style.background="rgba(196,162,101,.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(196,162,101,.06)";e.currentTarget.style.background="rgba(196,162,101,.04)";}}>
            <span style={{ fontSize:".62rem", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace", fontWeight:600, letterSpacing:"-0.5px" }}>
              {locale === 'en' ? '中' : 'EN'}
            </span>
          </div>
          <button onClick={onLogout} style={{ background:"rgba(196,64,64,.06)", border:"1px solid rgba(196,64,64,.2)", color:"#c44040", padding:"4px 14px", fontSize:".8rem", cursor:"pointer", fontFamily:"'Noto Serif SC',serif", borderRadius:2, transition:"all .2s" }}
            onMouseEnter={e=>{e.target.style.background="rgba(196,64,64,.15)";}} onMouseLeave={e=>{e.target.style.background="rgba(196,64,64,.06)";}}>
            {t('header.logout')}
          </button>
        </div>
      </div>

      <div style={{ display:"flex", minHeight:"calc(100vh - 50px)" }}>
        {/* SIDEBAR */}
        <div style={{ width:220, minWidth:220, background:"#0c0c0f", borderRight:"1px solid rgba(196,162,101,.08)", padding:"16px 14px", display:"flex", flexDirection:"column", gap:12, overflowY:"auto" }}>
          <div style={S.label}>{t('sidebar.userInfo')}</div>
          <div style={{ fontSize:".85rem", color:"#9a9488" }}>
            {by}/{bm}/{bd} {bh}:00<br/>
            {sex==="M"?t('sidebar.male'):t('sidebar.female')} · {age}{t('sidebar.age')}<br/>
            {t('sidebar.dayMaster')}：<span style={{color:EC[bazi.dme]}}>{bazi.dm}({bazi.dme})</span>
          </div>

          <div style={{ borderTop:"1px solid rgba(196,162,101,.06)", paddingTop:10 }}>
            <div style={S.label}>{t('sidebar.organScan')}</div>
            {["火","木","土","金","水"].map(el => {
              const sc = Math.round(medWX[el]);
              return (
                <div key={el} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                  <span style={{ fontSize:".9rem", color:EC[el], width:16 }}>{el}</span>
                  <div style={{ flex:1, height:4, background:"#08080a", borderRadius:1 }}>
                    <div style={{ height:"100%", width:sc+"%", background:sc<50?"#c44040":EC[el], transition:"width .4s", borderRadius:1 }}/>
                  </div>
                  <span style={{ ...S.mono, fontSize:".75rem", color:sc<50?"#c44040":"#9a9488", width:28, textAlign:"right" }}>{sc}</span>
                </div>
              );
            })}
          </div>

          {anoms.length>0 && (
            <div style={{ borderTop:"1px solid rgba(196,64,64,.15)", paddingTop:8 }}>
              <div style={{ ...S.mono, fontSize:".72rem", color:"#c44040", letterSpacing:".1em" }}>⚠ {t('sidebar.anomalies')} {anoms.length} {t('sidebar.items')}</div>
              {anoms.map(a => <div key={a.key} style={{ fontSize:".8rem", color:"#c44040", marginTop:3 }}>{mName(a.key)} {statusText(a.st)}</div>)}
            </div>
          )}

          <div style={{ borderTop:"1px solid rgba(196,162,101,.06)", paddingTop:8 }}>
            <div style={S.label}>{t('sidebar.currentCycle')}</div>
            <div style={{ fontSize:".85rem", color:"#9a9488" }}>
              {t('sidebar.majorCycle')}：<span style={{color:EC[dy.el]}}>{dy.lbl}({dy.el})</span><br/>
              {t('sidebar.annualCycle')}：<span style={{color:EC[ln.el]}}>{ln.lbl}({ln.el})</span>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
          {/* TABS */}
          <div style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(196,162,101,.08)" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"10px 18px", background:"transparent", border:"none",
                borderBottom:tab===t.id?"2px solid #c4a265":"2px solid transparent",
                color:tab===t.id?"#c4a265":"#5e5a52", fontSize:".95rem", cursor:"pointer",
                fontFamily:"'Noto Serif SC',serif", transition:"all .3s"
              }}>{t.lb}</button>
            ))}
          </div>

          {/* ══ UPLOAD ══ */}
          {tab==="upload" && (
            <div>
              {/* Pipeline */}
              <div style={{ display:"flex", alignItems:"center", gap:0, margin:"10px 0", flexWrap:"wrap" }}>
                {pipe.map((s,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center" }}>
                    <div style={{ padding:"6px 12px", background:s.st==="done"?"rgba(82,176,154,.06)":s.st==="running"?"rgba(196,162,101,.06)":"transparent", border:`1px solid ${s.st==="done"?"#52b09a22":s.st==="running"?"#c4a26522":"#3a383222"}` }}>
                      <span style={{ ...S.mono, fontSize:".75rem", color:s.st==="done"?"#52b09a":s.st==="running"?"#c4a265":"#3a3832" }}>
                        {s.st==="done"?"✓ ":s.st==="running"?"◎ ":"○ "}{s.lb}
                      </span>
                    </div>
                    {i<pipe.length-1 && <div style={{ width:20, height:1, background:s.st==="done"?"#52b09a33":"#3a383233" }}/>}
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {/* Upload */}
                <div style={S.card}>
                  <div style={S.label}>{t("upload.step1")}</div>
                  <div onClick={()=>fileRef.current?.click()} style={{
                    border:"1px dashed rgba(196,162,101,.2)", padding:"36px 20px", textAlign:"center",
                    cursor:"pointer", background:file?"rgba(82,176,154,.04)":"transparent", marginTop:10, transition:"all .3s"
                  }}>
                    <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={doOCR} style={{ display:"none" }}/>
                    {file ? (
                      <div><div style={{ fontSize:"1rem", color:"#52b09a" }}>✓ {file.name}</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>{(file.size/1024).toFixed(1)}KB · 点击更换</div></div>
                    ) : (
                      <div><div style={{ fontSize:"2rem", color:"#6a5a35", marginBottom:8 }}>⬆</div><div style={{ fontSize:".95rem", color:"#9a9488" }}>{t("upload.uploadPrompt")}</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>{t('upload.uploadSub')}</div></div>
                    )}
                  </div>
                  {ocrL && <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:12, height:12, border:"2px solid #c4a265", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
                    <span style={{ fontSize:".85rem", color:"#c4a265" }}>{t("upload.ocrRunning")}</span>
                  </div>}
                </div>

                {/* OCR result */}
                <div style={S.card}>
                  <div style={S.label}>{t("upload.step2")}</div>
                  {ocr ? (
                    <div style={{ marginTop:10 }}>
                      {ocr.ocr_unavailable && (
                        <div style={{ padding:"14px 16px", background:"rgba(196,162,101,0.06)", border:"1px solid rgba(196,162,101,0.15)", marginBottom:10 }}>
                          <div style={{ fontSize:".9rem", color:"#c4a265", marginBottom:6 }}>📝 {t("upload.ocrManual")}</div>
                          <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{ocr.message || t("upload.ocrEmpty")}</div>
                        </div>
                      )}
                      {ocr.error && <div style={{ fontSize:".85rem", color:"#d4a840", marginBottom:8 }}>⚠ {ocr.error}</div>}
                      {ocr._raw && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.6 }}>{String(ocr._raw).substring(0,400)}</div>}
                      {ocr.metrics?.length > 0 && ocr.metrics.map((m,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:"#16161c", marginBottom:4 }}>
                          <span style={{ fontSize:".9rem", color:"#e0dcd4" }}>{m.name} <span style={{ fontSize:".75rem", color:"#5e5a52" }}>{m.code}</span></span>
                          <span style={{ ...S.mono, fontSize:".9rem", color:"#f0ece4" }}>{m.value} <span style={{ fontSize:".75rem", color:"#5e5a52" }}>{m.unit}</span></span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize:".85rem", color:"#3a3832", textAlign:"center", padding:20, marginTop:10 }}>{t("upload.ocrEmpty")}</div>}
                </div>
              </div>

              <div style={{ marginTop:16, display:"flex", gap:12, alignItems:"center" }}>
                <button onClick={startAnalysisCeremony} disabled={sciL||dstL||analysisActive}
                  style={{ ...S.btn, opacity:sciL||dstL||analysisActive?.5:1, cursor:sciL||dstL||analysisActive?"wait":"pointer" }}>
                  {analysisActive?"⏳ "+t('upload.sciRunning'):"⚡ "+t('upload.launchBtn')}
                </button>
                <span style={{ fontSize:".85rem", color:"#5e5a52" }}>
                  {metrics.filter(m=>m.value!=null).length} {t('upload.itemsFilled')}
                  {anoms.length > 0 ? ` · ${anoms.length} ${t('upload.anomalyCount')}` : ` · ${t('upload.allNormal')}`}
                </span>
              </div>

              {/* Editable metrics — Bento 五行阵列 */}
              <div style={{ ...S.card, marginTop:16, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={S.label}>{t('upload.metricsTitle')}</div>
                  <div style={{ ...S.mono, fontSize:".75rem", color:metrics.filter(m=>m.value!=null).length===15?"#52b09a":"#5e5a52" }}>
                    {metrics.filter(m=>m.value!=null).length}/15
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5, minmax(0, 180px))", gap:8, justifyContent:"center" }}>
                  {WX_GROUPS.map(g => (
                    <div key={g.el} style={{ background:"rgba(0,0,0,.25)", borderTop:`2px solid ${EC[g.el]}`, padding:"8px 10px" }}>
                      <div style={{ fontSize:".82rem", color:EC[g.el], marginBottom:6, textAlign:"center", fontWeight:500 }}>{g.el} · {sysLabel(g.el)}</div>
                      {g.keys.map(k => {
                        const m = metrics.find(x=>x.key===k);
                        const ref = gR(k,age,sex);
                        const hasVal = m?.value != null;
                        const inRange = hasVal && ref && m.value>=ref.l && m.value<=ref.h;
                        const isAnom = hasVal && ref && (m.value<ref.l || m.value>ref.h);
                        return (
                          <div key={k} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, padding:"3px 0" }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <span style={{ fontSize:".82rem", color: hasVal ? "#d0ccc4" : "#6a6560" }}>
                                {mName(k)}
                              </span>
                              <sup style={{ fontSize:".55rem", color:"#5e5a52", marginLeft:2 }}>{k.replace("_","-")}</sup>
                            </div>
                            <input
                              type="number" step="0.1" inputMode="decimal"
                              value={hasVal ? m.value : ""}
                              placeholder={t('upload.pending')}
                              onChange={e => updateMetric(k, e.target.value === "" ? null : e.target.value)}
                              style={{
                                width:72, background:"#0c0c0f", padding:"5px 4px", outline:"none", textAlign:"center",
                                ...S.mono, fontSize:".88rem", borderRadius:2,
                                color: !hasVal ? "#6a6560" : inRange ? "#f0ece4" : "#c44040",
                                border: isAnom ? "1px solid rgba(196,64,64,0.5)" : "1px solid rgba(196,162,101,.12)",
                                animation: isAnom ? "breathe 2s ease-in-out infinite" : "none",
                              }}
                            />
                            <span style={{ ...S.mono, fontSize:".65rem", color:"#5e5a52", width:32, textAlign:"right" }}>{ref?.u}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ COLLISION ANALYSIS (merged radar + insights) ══ */}
          {tab==="radar" && (
            <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:20 }}>
              {/* LEFT: Radar + dimension list */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={S.card}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={S.label}>{t('radar.title')}</div>
                    <div style={{ ...S.mono, fontSize:".72rem", color: timeOffset===0 ? "#5e5a52" : "#c4a265" }}>
                      {locale==="en" ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][targetMonth-1]} ${targetYear}` : `${targetYear}年${targetMonth}月`}
                      {timeOffset !== 0 && <span style={{ color:"#5e5a52" }}> (+{timeOffset}月)</span>}
                    </div>
                  </div>
                  <InteractiveRadar
                    med={medWX} dest={destWX} colls={colls}
                    onSelectDimension={setSelectedDim}
                    selectedDim={selectedDim}
                    timeOffset={timeOffset}
                    radarLabels={locale === 'en'
                      ? [["Cardio","#c45a30"],["Metabolic","#a08a50"],["Respiratory","#9898a8"],["Renal","#3a6a9a"],["Hepatic","#4a8a4a"]]
                      : [["火·心","#c45a30"],["土·脾","#a08a50"],["金·肺","#9898a8"],["水·肾","#3a6a9a"],["木·肝","#4a8a4a"]]
                    }
                    tooltipLabels={{ clinical:t('radar.clinicalScore'), energetic:t('radar.energeticScore'), divergence:t('radar.divergence'), resonance:t('radar.resonance') }}
                  />
                  <div style={{ display:"flex", gap:14, justifyContent:"center", marginTop:10, fontSize:".78rem" }}>
                    <span style={{ color:"#c4a265" }}>{t('radar.destinyLayer')}</span>
                    <span style={{ color:"#e0dcd4" }}>{t('radar.medicalLayer')}</span>
                    <span style={{ color:"#c44040" }}>{t('radar.alertDot')}</span>
                  </div>

                  {/* 时空快进滑动条 */}
                  <div style={{ marginTop:14, padding:"10px 0 4px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:".75rem", color:"#6a5a35" }}>{t('radar.timeTravel')}</span>
                      {timeOffset !== 0 && (
                        <button onClick={() => setTimeOffset(0)} style={{
                          background:"transparent", border:"1px solid rgba(196,162,101,.15)",
                          color:"#5e5a52", fontSize:".68rem", padding:"2px 8px", cursor:"pointer",
                          fontFamily:"'JetBrains Mono',monospace",
                        }}>{t('radar.backToNow')}</button>
                      )}
                    </div>
                    <input type="range" min="0" max="11" value={timeOffset}
                      onChange={e => setTimeOffset(parseInt(e.target.value))}
                      style={{ width:"100%", accentColor:"#c4a265", height:4 }}
                    />
                    {/* 12个月刻度标签 */}
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                      {Array.from({length:12}, (_, i) => {
                        const m = ((new Date().getMonth() + i) % 12) + 1;
                        const mwx = MONTH_WX[m];
                        return (
                          <div key={i} onClick={() => setTimeOffset(i)} style={{
                            fontSize:".58rem", cursor:"pointer", textAlign:"center", width:20,
                            color: i === timeOffset ? "#e0dcd4" : EC[mwx.主],
                            fontWeight: i === timeOffset ? 700 : 400,
                            fontFamily:"'JetBrains Mono',monospace",
                          }}>
                            {locale==="en" ? ["J","F","M","A","M","J","J","A","S","O","N","D"][m-1] : m+"月"}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 当月五行旺衰速览 */}
                  {timeOffset > 0 && (
                    <div style={{ marginTop:8, padding:"8px 10px", background:"rgba(196,162,101,.03)", border:"1px solid rgba(196,162,101,.06)", fontSize:".78rem" }}>
                      <span style={{ color:"#6a5a35" }}>{locale==="en" ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][targetMonth-1]} ${targetYear}` : `${targetYear}年${targetMonth}月`}</span>
                      <span style={{ color:EC[MONTH_WX[targetMonth].主], marginLeft:8 }}>主气 {MONTH_WX[targetMonth].主}</span>
                      <span style={{ color:EC[MONTH_WX[targetMonth].旺], marginLeft:6 }}>旺 {MONTH_WX[targetMonth].旺}</span>
                      <span style={{ color:"#c44040", marginLeft:6 }}>衰 {MONTH_WX[targetMonth].衰}</span>
                    </div>
                  )}
                </div>

                {/* Dimension quick-select list */}
                <div style={S.card}>
                  <div style={S.label}>{t('radar.dimOverview')}</div>
                  {colls.map(c => {
                    const isActive = selectedDim === c.el;
                    return (
                      <div key={c.el} onClick={() => setSelectedDim(isActive ? null : c.el)} style={{
                        display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"8px 12px", marginTop:4, cursor:"pointer",
                        borderLeft:`3px solid ${isActive ? EC[c.el] : sC[c.lv]}`,
                        background: isActive ? "rgba(196,162,101,0.06)" : "#16161c",
                        transition:"all .25s"
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:"1rem", color:EC[c.el] }}>{c.el}</span>
                          <span style={{ fontSize:".85rem", color: isActive ? "#e0dcd4" : "#9a9488" }}>{sysOrgan(c.el)}</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:40, height:4, background:"#08080a", borderRadius:1 }}>
                            <div style={{ height:"100%", width:Math.min(100, c.corr)+"%", background:sC[c.lv], borderRadius:1, transition:"width .4s" }}/>
                          </div>
                          <span style={{ ...S.mono, fontSize:".72rem", color:sC[c.lv], width:42, textAlign:"right" }}>{sL[c.lv]} {c.corr}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* BaZi deep analysis */}
                {dst?.bazi_analysis && (
                  <div style={{ ...S.card, borderColor:"rgba(196,162,101,.08)" }}>
                    <div style={{ ...S.mono, fontSize:".72rem", color:"#c4a265", marginBottom:8, letterSpacing:".15em" }}>{t('analysis.dualBrainTitle')}</div>
                    {[
                      ["📋", "pillars", locale==='en'?"Pillars":"四柱"],
                      ["📐", "pattern", locale==='en'?"Pattern":"格局"],
                      ["🏥", "health_map", locale==='en'?"Health Map":"健康"],
                      // Legacy field fallbacks
                      ["📋", "pillars_detail", locale==='en'?"Pillars":"四柱"],
                      ["📐", "pattern", locale==='en'?"Pattern":"格局"],
                      ["⚡", "tiangang_relations", locale==='en'?"Stems":"天干"],
                      ["🔄", "dizhi_relations", locale==='en'?"Branches":"地支"],
                      ["⭐", "shenshas", locale==='en'?"Stars":"神煞"],
                    ].map(([icon, key, label]) => dst.bazi_analysis[key] ? (
                      <div key={key} style={{ fontSize:".8rem", color:"#9a9488", lineHeight:1.6, marginBottom:4, padding:"4px 8px", background:"rgba(196,162,101,.02)" }}>
                        <span style={{ color:"#6a5a35" }}>{icon} {label}:</span> {dst.bazi_analysis[key]}
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>

              {/* RIGHT: Dimension-focused dual-brain dialogue analysis */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {selectedDim ? (() => {
                  const coll = colls.find(c => c.el === selectedDim);
                  const sciItems = (sci?.items || []).filter(it => it.organ_system === selectedDim);
                  const dstItems = (dst?.collision_items || []).filter(it => it.organ_wuxing === selectedDim);
                  const hasData = sciItems.length > 0 || dstItems.length > 0;

                  return (
                    <>
                      {/* Dimension header */}
                      <div style={{ ...S.card, borderLeft:`4px solid ${EC[selectedDim]}`, padding:"16px 20px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <span style={{ fontSize:"1.3rem", color:EC[selectedDim], fontWeight:600 }}>{selectedDim}</span>
                            <span style={{ fontSize:"1.1rem", color:"#e0dcd4", marginLeft:10 }}>{sysOrgan(selectedDim)}</span>
                          </div>
                          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ ...S.mono, fontSize:".7rem", color:"#5e5a52" }}>医学 / 命理</div>
                              <div style={{ ...S.mono, fontSize:"1rem" }}>
                                <span style={{ color:"#e0dcd4" }}>{coll?.med}%</span>
                                <span style={{ color:"#5e5a52", margin:"0 4px" }}>/</span>
                                <span style={{ color:"#c4a265" }}>{coll?.dest}%</span>
                              </div>
                            </div>
                            <div style={{ padding:"4px 10px", background:sC[coll?.lv]+"15", border:`1px solid ${sC[coll?.lv]}33` }}>
                              <span style={{ ...S.mono, fontSize:".75rem", color:sC[coll?.lv] }}>{sL[coll?.lv]}</span>
                            </div>
                          </div>
                        </div>
                        {coll?.dv > 30 && (
                          <div style={{ marginTop:10, padding:"8px 12px",
                            background: coll.hasRealAnomaly ? "rgba(196,64,64,0.06)" : "rgba(196,162,101,0.06)",
                            border: `1px solid ${coll.hasRealAnomaly ? "rgba(196,64,64,0.12)" : "rgba(196,162,101,0.12)"}`,
                            fontSize:".85rem", color: coll.hasRealAnomaly ? "#c44040" : "#c4a265"
                          }}>
                            {coll.hasRealAnomaly
                              ? `⚠ ${t("analysis.realAnomaly", {dv: coll.dv})}`
                              : `☯ ${t("analysis.constitutionNote", {dv: coll.dv})}`
                            }
                          </div>
                        )}
                      </div>

                      {hasData ? (
                        /* Dialogue-style cross analysis */
                        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
                          <div style={{ padding:"12px 16px", background:"rgba(196,162,101,0.03)", borderBottom:"1px solid rgba(196,162,101,0.06)" }}>
                            <div style={{ ...S.mono, fontSize:".75rem", color:"#6a5a35", letterSpacing:".15em" }}>{t('analysis.dualBrainTitle')} · {selectedDim} {sysOrgan(selectedDim)}</div>
                          </div>
                          <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                            {/* Interleave science and destiny items as a dialogue */}
                            {sciItems.map((it, i) => (
                              <div key={"sci-"+i}>
                                {/* Science speaks */}
                                <div style={{ display:"flex", gap:10, marginBottom:8 }}>
                                  <div style={{ width:3, background:"#52b09a", borderRadius:1, flexShrink:0 }}/>
                                  <div style={{ flex:1 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                                      <div style={{ width:6, height:6, borderRadius:"50%", background:"#52b09a" }}/>
                                      <span style={{ ...S.mono, fontSize:".72rem", color:"#52b09a" }}>{t('analysis.scienceBrain')} · {it.metric ? mName(it.metric) : it.metric_cn}</span>
                                      {it.severity && <span style={{ ...S.mono, fontSize:".65rem", padding:"1px 6px", background:it.severity==="severe"?"rgba(196,64,64,.1)":"rgba(212,168,64,.1)", color:it.severity==="severe"?"#c44040":"#d4a840" }}>{it.severity.toUpperCase()}</span>}
                                    </div>
                                    {it.anatomical_context && <div style={{ fontSize:".85rem", color:"#c4a265", marginBottom:4 }}>🔬 {it.anatomical_context}</div>}
                                    <div style={{ fontSize:".88rem", color:"#d0ccc4", lineHeight:1.8 }}>{it.physiological_analysis}</div>
                                    {it.demographic_specific && <div style={{ fontSize:".82rem", color:"#5a9ad4", background:"rgba(58,106,154,.06)", padding:"5px 10px", marginTop:4 }}>👤 {age}{t("sidebar.age")} {sex==="M"?t("sidebar.male"):t("sidebar.female")}: {it.demographic_specific}</div>}
                                    <div style={{ fontSize:".82rem", color:"#52b09a", marginTop:4 }}>💡 {it.recommendation}</div>
                                  </div>
                                </div>

                                {/* Destiny responds — find matching item */}
                                {dstItems[i] && (
                                  <div style={{ display:"flex", gap:10, paddingLeft:20 }}>
                                    <div style={{ width:3, background:"#c4a265", borderRadius:1, flexShrink:0 }}/>
                                    <div style={{ flex:1 }}>
                                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                                        <div style={{ width:6, height:6, borderRadius:"50%", background:"#c4a265" }}/>
                                        <span style={{ ...S.mono, fontSize:".72rem", color:"#c4a265" }}>{t('analysis.metaResponse')}</span>
                                        {dstItems[i].risk_window && <span style={{ ...S.mono, fontSize:".65rem", color:"#d4a840" }}>🕐 {dstItems[i].risk_window}</span>}
                                      </div>
                                      <div style={{ fontSize:".88rem", color:"#d0ccc4", lineHeight:1.8 }}>⚡ {dstItems[i].current_forces}</div>
                                      <div style={{ fontSize:".82rem", color:"#c4a265", marginTop:3 }}>↗ {dstItems[i].evolution_path}</div>
                                      <div style={{ fontSize:".82rem", color:"#d4a840", background:"rgba(212,168,64,.04)", padding:"5px 10px", marginTop:4 }}>🛡 {dstItems[i].prevention}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Remaining destiny items that didn't have a matching science item */}
                            {dstItems.slice(sciItems.length).map((it, i) => (
                              <div key={"dst-extra-"+i} style={{ display:"flex", gap:10 }}>
                                <div style={{ width:3, background:"#c4a265", borderRadius:1, flexShrink:0 }}/>
                                <div style={{ flex:1 }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                                    <div style={{ width:6, height:6, borderRadius:"50%", background:"#c4a265" }}/>
                                    <span style={{ ...S.mono, fontSize:".72rem", color:"#c4a265" }}>{t('analysis.metaInsight')}</span>
                                    {it.risk_window && <span style={{ ...S.mono, fontSize:".65rem", color:"#d4a840" }}>🕐 {it.risk_window}</span>}
                                  </div>
                                  <div style={{ fontSize:".88rem", color:"#d0ccc4", lineHeight:1.8 }}>⚡ {it.current_forces}</div>
                                  <div style={{ fontSize:".82rem", color:"#c4a265", marginTop:3 }}>↗ {it.evolution_path}</div>
                                  <div style={{ fontSize:".82rem", color:"#d4a840", background:"rgba(212,168,64,.04)", padding:"5px 10px", marginTop:4 }}>🛡 {it.prevention}</div>
                                </div>
                              </div>
                            ))}

                            {!hasData && (
                              <div style={{ padding:20, textAlign:"center", color:"#3a3832", fontSize:".88rem" }}>
                                {t("analysis.noData")}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ ...S.card, padding:24 }}>
                          <div style={{ fontSize:"1rem", color:"#c4a265", marginBottom:8 }}>{selectedDim} {sysOrgan(selectedDim)}</div>
                          <div style={{ fontSize:".88rem", color:"#9a9488", lineHeight:1.8 }}>
                            {t("analysis.dimNormal")}
                            {coll?.dest < 40
                              ? t("analysis.dimWeakConst", {pct: coll.dest})
                              : t("analysis.dimHarmony")
                            }
                          </div>
                        </div>
                      )}

                      {/* Temporal outlook for selected dimension */}
                      {dst?.temporal_outlook && (
                        <div style={{ ...S.card, borderColor:"rgba(196,162,101,.08)" }}>
                          <div style={{ ...S.mono, fontSize:".72rem", color:"#6a5a35", marginBottom:6 }}>TEMPORAL OUTLOOK</div>
                          <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{dst.temporal_outlook}</div>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  /* No dimension selected — show overview */
                  <>
                    {/* Summary cards */}
                    <div style={{ ...S.card, borderColor:"rgba(196,162,101,.06)" }}>
                      <div style={{ fontSize:"1rem", color:"#e0dcd4", marginBottom:12 }}>{t('analysis.selectDimPrompt')}</div>
                      <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.8 }}>
                        {t('analysis.selectDimDesc')}
                      </div>
                    </div>

                    {/* Quick overview of all science + destiny findings */}
                    {(sci?.items?.length > 0 || dst?.collision_items?.length > 0) && (
                      <div style={{ ...S.card }}>
                        <div style={S.label}>{t('analysis.globalOverview')}</div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:8 }}>
                          <div>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                              <div style={{ width:6, height:6, borderRadius:"50%", background:"#52b09a" }}/>
                              <span style={{ ...S.mono, fontSize:".75rem", color:"#52b09a" }}>{t('analysis.sciFindings')}</span>
                            </div>
                            {sci?.items?.length ? sci.items.map((it,i) => (
                              <div key={i} onClick={() => setSelectedDim(it.organ_system)} style={{
                                padding:"6px 10px", background:"#16161c", borderLeft:`2px solid ${EC[it.organ_system]||"#52b09a"}`,
                                marginBottom:4, cursor:"pointer", transition:"background .2s"
                              }}>
                                <span style={{ fontSize:".85rem", color:"#e0dcd4" }}>{it.metric ? mName(it.metric) : it.metric_cn}</span>
                                <span style={{ fontSize:".75rem", color:"#5e5a52", marginLeft:6 }}>{sysLabel(it.organ_system)}</span>
                              </div>
                            )) : <div style={{ fontSize:".8rem", color:"#3a3832" }}>{t('analysis.noData')}</div>}
                          </div>
                          <div>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                              <div style={{ width:6, height:6, borderRadius:"50%", background:"#c4a265" }}/>
                              <span style={{ ...S.mono, fontSize:".75rem", color:"#c4a265" }}>{t('analysis.metaFindings')}</span>
                            </div>
                            {dst?.collision_items?.length ? dst.collision_items.map((it,i) => (
                              <div key={i} onClick={() => setSelectedDim(it.organ_wuxing)} style={{
                                padding:"6px 10px", background:"#16161c", borderLeft:`2px solid ${EC[it.organ_wuxing]||"#c4a265"}`,
                                marginBottom:4, cursor:"pointer", transition:"background .2s"
                              }}>
                                <span style={{ fontSize:".85rem", color:"#e0dcd4" }}>{it.organ_wuxing} {sysOrgan(it.organ_wuxing)}</span>
                                {it.risk_window && <span style={{ fontSize:".72rem", color:"#d4a840", marginLeft:6 }}>{it.risk_window}</span>}
                              </div>
                            )) : <div style={{ fontSize:".8rem", color:"#3a3832" }}>{t('analysis.noData')}</div>}
                          </div>
                        </div>
                      </div>
                    )}

                    {sci?.summary && (
                      <div style={{ ...S.card, borderColor:"rgba(82,176,154,.08)" }}>
                        <div style={{ ...S.mono, fontSize:".72rem", color:"#52b09a", marginBottom:6 }}>{t('analysis.sciSummary')}</div>
                        <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{sci.summary}</div>
                      </div>
                    )}
                    {dst?.temporal_outlook && (
                      <div style={{ ...S.card, borderColor:"rgba(196,162,101,.08)" }}>
                        <div style={{ ...S.mono, fontSize:".72rem", color:"#6a5a35", marginBottom:6 }}>TEMPORAL OUTLOOK</div>
                        <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{dst.temporal_outlook}</div>
                      </div>
                    )}
                    {dst?.key_dates?.length > 0 && (
                      <div style={{ ...S.card }}>
                        <div style={S.label}>{t('analysis.keyDates')}</div>
                        {dst.key_dates.map((d,i) => <div key={i} style={{ fontSize:".85rem", color:"#d4a840", marginBottom:4 }}>📅 {d}</div>)}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 报告生成按钮 + 免责声明 */}
              {(sci || dst) && (
                <div style={{ gridColumn:"1 / -1", display:"flex", flexDirection:"column", gap:10 }}>
                  {/* 报告按钮 */}
                  <div style={{ display:"flex", gap:10 }}>
                    {sci && (
                      <button onClick={() => generateScienceReport()} style={{
                        ...S.btn, flex:1, fontSize:".85rem", padding:"10px 16px",
                        background:"linear-gradient(135deg, #2a4a3a, #52b09a)",
                      }}>
                        📋 {t('reports.scienceReport')}
                      </button>
                    )}
                    {dst && (
                      <button onClick={() => generateDestinyGuide()} style={{
                        ...S.btn, flex:1, fontSize:".85rem", padding:"10px 16px",
                        background:"linear-gradient(135deg, #3a2a1a, #c4a265)",
                      }}>
                        ☯ {t('reports.destinyGuide')}
                      </button>
                    )}
                  </div>

                  {/* 免责声明 */}
                  <div style={{ padding:"12px 16px", background:"rgba(196,162,101,.02)", border:"1px solid rgba(196,162,101,.06)", fontSize:".72rem", color:"#4a4a44", lineHeight:1.7 }}>
                    <div style={{ ...S.mono, fontSize:".65rem", color:"#3a3832", marginBottom:4, letterSpacing:".1em" }}>{t('disclaimer.label')}</div>
                    <span style={{ color:"#52b09a" }}>Science Brain</span>：{t('disclaimer.science')}
                    <br/>
                    <span style={{ color:"#c4a265" }}>Meta Brain</span>：{t('disclaimer.meta')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ LIFE TUNING ══ */}
          {tab==="tuning" && (
            <div>
              {dst?.life_tuning ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  {/* Medical advice — left brain */}
                  <div style={{ ...S.card, borderLeft:"3px solid #52b09a" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"#52b09a" }}/>
                      <div>
                        <div style={{ ...S.mono, fontSize:".85rem", color:"#52b09a" }}>{t('tuning.leftBrain')}</div>
                        <div style={{ fontSize:".75rem", color:"#3a3832", fontStyle:"italic" }}>{t('tuning.leftBrainSub')}</div>
                      </div>
                    </div>
                    {(dst.life_tuning.medical_advice || []).map((a, i) => (
                      <div key={i} style={{ padding:"12px 14px", background:"#16161c", borderLeft:"2px solid #52b09a44", marginBottom:8, fontSize:".9rem", color:"#9a9488", lineHeight:1.8 }}>
                        <span style={{ color:"#52b09a", marginRight:8 }}>💊 {i + 1}.</span>{a}
                      </div>
                    ))}
                  </div>

                  {/* Destiny advice — right brain */}
                  <div style={{ ...S.card, borderLeft:"3px solid #c4a265" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"#c4a265" }}/>
                      <div>
                        <div style={{ ...S.mono, fontSize:".85rem", color:"#c4a265" }}>{t('tuning.rightBrain')}</div>
                        <div style={{ fontSize:".75rem", color:"#3a3832", fontStyle:"italic" }}>{t('tuning.rightBrainSub')}</div>
                      </div>
                    </div>
                    {(dst.life_tuning.destiny_advice || []).map((a, i) => (
                      <div key={i} style={{ padding:"12px 14px", background:"#16161c", borderLeft:"2px solid #c4a26544", marginBottom:8, fontSize:".9rem", color:"#9a9488", lineHeight:1.8 }}>
                        <span style={{ color:"#c4a265", marginRight:8 }}>🛡 {i + 1}.</span>{a}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:48, fontSize:".95rem", color:"#3a3832" }}>
                  {t('tuning.noData')}
                </div>
              )}

              {/* Key dates */}
              {dst?.key_dates?.length > 0 && (
                <div style={{ ...S.card, marginTop:16 }}>
                  <div style={S.label}>{t('tuning.keyDates')}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                    {dst.key_dates.map((d, i) => (
                      <div key={i} style={{ padding:"10px 14px", background:"#16161c", borderLeft:"2px solid #d4a840", fontSize:".9rem", color:"#d4a840", lineHeight:1.7 }}>
                        📅 {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ CHAT ══ */}
          {tab==="chat" && (
            <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 180px)" }}>
              {/* Brain selector */}
              <div style={{ display:"flex", gap:0, marginBottom:12 }}>
                {[["science","🔬 "+t('analysis.scienceBrain'),"#52b09a"],["destiny","🌟 "+t('analysis.metaBrain'),"#c4a265"]].map(([id, lb, c]) => (
                  <button key={id} onClick={() => setChatBrain(id)} style={{
                    padding:"10px 24px", background:chatBrain===id ? c+"15" : "transparent",
                    border: `1px solid ${chatBrain===id ? c+"44" : "rgba(196,162,101,.08)"}`,
                    color: chatBrain===id ? c : "#5e5a52", fontSize:".9rem", cursor:"pointer",
                    fontFamily:"'Noto Serif SC',serif",
                  }}>{lb}</button>
                ))}
                <div style={{ flex:1 }}/>
                <button onClick={() => setChatHistory([])} style={{
                  padding:"8px 16px", background:"transparent", border:"1px solid rgba(196,162,101,.08)",
                  color:"#5e5a52", fontSize:".8rem", cursor:"pointer",
                }}>{t('chat.clearChat')}</button>
              </div>

              {/* Chat history */}
              <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, padding:"8px 0" }}>
                {chatHistory.length === 0 && (
                  <div style={{ textAlign:"center", padding:48, color:"#3a3832" }}>
                    <div style={{ fontSize:"1.2rem", marginBottom:8 }}>{t('chat.selectBrain')}</div>
                    <div style={{ fontSize:".85rem" }}>
                      {t('chat.scienceDesc')}<br/>
                      {t('chat.metaDesc')}
                    </div>
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} style={{
                    padding:"12px 16px",
                    background: m.role === "user" ? "rgba(196,162,101,.06)" : m.brain === "science" ? "rgba(82,176,154,.06)" : "rgba(196,162,101,.04)",
                    borderLeft: m.role === "user" ? "3px solid #c4a265" : `3px solid ${m.brain === "science" ? "#52b09a" : "#c4a265"}`,
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                  }}>
                    <div style={{ fontSize:".72rem", color: m.role === "user" ? "#c4a265" : m.brain === "science" ? "#52b09a" : "#c4a265", marginBottom:4, ...S.mono }}>
                      {m.role === "user" ? t('chat.you') : m.brain === "science" ? "🔬 "+t('analysis.scienceBrain') : "🌟 "+t('analysis.metaBrain')}
                    </div>
                    <div style={{ fontSize:".9rem", color:"#e0dcd4", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{m.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ padding:"12px 16px", background:chatBrain === "science" ? "rgba(82,176,154,.06)" : "rgba(196,162,101,.04)", borderLeft:`3px solid ${chatBrain === "science" ? "#52b09a" : "#c4a265"}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:10, height:10, border:`2px solid ${chatBrain === "science" ? "#52b09a" : "#c4a265"}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
                      <span style={{ fontSize:".85rem", color:"#5e5a52" }}>{chatBrain === "science" ? "科学脑" : "命理脑"}思考中...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ display:"flex", gap:8, padding:"12px 0 0", borderTop:"1px solid rgba(196,162,101,.08)" }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder={chatBrain === "science" ? t('chat.sciPlaceholder') : t('chat.metaPlaceholder')}
                  style={{ flex:1, ...S.input, fontSize:".9rem" }}
                />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
                  ...S.btn, padding:"10px 24px", opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                  cursor: chatLoading ? "wait" : "pointer",
                }}>{t('chat.send')}</button>
              </div>
            </div>
          )}

          {/* ══ METRICS — Bento 五行阵列 ══ */}
          {tab==="metrics" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:".9rem", color:"#9a9488" }}>{age}{t('sidebar.age')} · {sex==="M"?t('sidebar.male'):t('sidebar.female')} — {t('metrics.refAdjusted')}</div>
                <div style={{ ...S.mono, fontSize:".78rem", color:metrics.filter(m=>m.value!=null).length===15?"#52b09a":"#5e5a52" }}>
                  {metrics.filter(m=>m.value!=null).length}/15 {t('metrics.filled')}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5, minmax(0, 200px))", gap:10, justifyContent:"center" }}>
                {WX_GROUPS.map(g => {
                  const filledCount = g.keys.filter(k => metrics.find(m=>m.key===k)?.value != null).length;
                  return (
                    <div key={g.el} style={{
                      ...S.card, padding:0, overflow:"hidden",
                      borderTop:`3px solid ${EC[g.el]}`,
                    }}>
                      {/* Group header */}
                      <div style={{
                        padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center",
                        background:`linear-gradient(135deg, ${EC[g.el]}0c, transparent)`,
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:"1.1rem", color:EC[g.el], fontWeight:600 }}>{g.el}</span>
                          <span style={{ fontSize:".82rem", color:"#9a9488" }}>{sysLabel(g.el)}</span>
                        </div>
                        <span style={{ ...S.mono, fontSize:".72rem", color:filledCount===3?"#52b09a":"#5e5a52" }}>
                          {filledCount}/3
                        </span>
                      </div>

                      {/* 3 metric slots */}
                      {g.keys.map((k, ki) => {
                        const m = metrics.find(x=>x.key===k);
                        const ref = gR(k, age, sex);
                        if (!ref) return null;
                        const hasVal = m?.value != null;
                        const inR = hasVal && m.value >= ref.l && m.value <= ref.h;
                        const isAnom = hasVal && (m.value < ref.l || m.value > ref.h);

                        return (
                          <div key={k} style={{
                            padding:"7px 12px", display:"flex", alignItems:"center", gap:8,
                            borderTop: ki > 0 ? `1px solid ${EC[g.el]}12` : "none",
                            background: isAnom ? "rgba(196,64,64,0.05)" : "transparent",
                          }}>
                            {/* Label */}
                            <div style={{ flex:1, minWidth:0 }}>
                              <span style={{ fontSize:".88rem", color: hasVal ? "#d0ccc4" : "#6a6560" }}>
                                {mName(k)}
                              </span>
                              <sup style={{ fontSize:".58rem", color:"#5e5a52", marginLeft:2, verticalAlign:"super", fontFamily:"'JetBrains Mono',monospace" }}>
                                {k.replace("_","-")}
                              </sup>
                            </div>
                            {/* Input */}
                            <input
                              type="number" step="0.1" inputMode="decimal"
                              value={hasVal ? m.value : ""}
                              placeholder={t('metrics.pending')}
                              onChange={e => updateMetric(k, e.target.value === "" ? null : e.target.value)}
                              style={{
                                width:68, background:"#0c0c0f", padding:"5px 4px", outline:"none", textAlign:"center",
                                ...S.mono, fontSize:".9rem", borderRadius:2,
                                color: !hasVal ? "#6a6560" : inR ? "#f0ece4" : "#c44040",
                                border: isAnom ? "1px solid rgba(196,64,64,0.5)" : "1px solid rgba(196,162,101,.12)",
                                animation: isAnom ? "breathe 2s ease-in-out infinite" : "none",
                              }}
                            />
                            {/* Unit + status */}
                            <div style={{ width:48, textAlign:"right" }}>
                              <div style={{ ...S.mono, fontSize:".68rem", color:"#5e5a52" }}>{ref.u}</div>
                              {hasVal && (
                                <div style={{ ...S.mono, fontSize:".65rem", color: inR ? "#52b09a" : "#c44040" }}>
                                  {inR ? t("metrics.normal") : m.value > ref.h ? t("metrics.high") : t("metrics.low")}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Range reference */}
                      <div style={{ padding:"5px 12px 7px", background:"rgba(0,0,0,.2)" }}>
                        {g.keys.map(k => {
                          const ref = gR(k, age, sex);
                          return ref ? (
                            <div key={k} style={{ fontSize:".68rem", color:"#4a4a44", lineHeight:1.5 }}>
                              {mName(k)} {ref.l}–{ref.h} {ref.u}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Noto+Serif+SC:wght@200;300;400;600&family=JetBrains+Mono:wght@300;400&display=swap');
        @keyframes pulse { 0%,100% { opacity:.4; } 50% { opacity:1; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes breathe {
          0%,100% { border-color: rgba(196,64,64,0.2); box-shadow: 0 0 0 0 rgba(196,64,64,0); }
          50% { border-color: rgba(196,64,64,0.6); box-shadow: 0 0 8px 2px rgba(196,64,64,0.15); }
        }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer {
          0% { transform:translateX(-100%); }
          50% { transform:translateX(250%); }
          100% { transform:translateX(-100%); }
        }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#6a5a35; border-radius:2px; }
        input[type=number]::-webkit-inner-spin-button { opacity:.3; }
      `}</style>
    </div>
  );
}
