import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as d3 from "d3";
import { useI18n } from "./i18n/index.jsx";
import { generateLifeBlueprintPDF, generateWeeklyGuidePDF } from "./ReportGenerator.jsx";
import { ShareCard } from "./ShareCard.jsx";
import LandingPage from "./LandingPage.jsx";
import MethodologyPage from "./MethodologyPage.jsx";
import { apiOCR, apiScience, apiDestiny, apiRegister, apiLogin, apiLogout, apiGetSession, apiSaveProfile, apiLoadMetrics, apiSaveMetrics, apiSaveAnalysis, apiLoadLatestAnalysis, apiChat } from "./api.js";

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

// True Solar Time calculation
function calcSolarCorrection(y, m, d, lon) {
  if (lon == null) return null;
  // 1. Longitude correction: offset from standard meridian
  // Standard meridians: every 15° (UTC+8 = 120°E, UTC-5 = -75°, etc)
  const stdMeridian = Math.round(lon / 15) * 15;
  const lonCorrection = (lon - stdMeridian) * 4; // minutes

  // 2. Equation of Time (Jean Meeus simplified)
  const dayOfYear = Math.floor((new Date(y, m-1, d) - new Date(y, 0, 0)) / 864e5);
  const B = (360 / 365) * (dayOfYear - 81) * Math.PI / 180;
  const EoT = 9.87 * Math.sin(2*B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes

  const totalMinutes = lonCorrection + EoT;
  const sign = totalMinutes >= 0 ? '+' : '';
  return {
    lonCorrection: Math.round(lonCorrection * 10) / 10,
    eot: Math.round(EoT * 10) / 10,
    totalMinutes: Math.round(totalMinutes * 10) / 10,
    description: `${sign}${Math.round(totalMinutes)}min (lon ${sign}${Math.round(lonCorrection)}min, EoT ${EoT>=0?'+':''}${Math.round(EoT)}min)`,
    solarNoonOffset: `${12}:${String(Math.round(Math.abs(totalMinutes))).padStart(2,'0')} ${totalMinutes>0?'PM (late)':'PM (early)'}`,
  };
}

function calcBazi(y, m, d, h, solarCorrMinutes) {
  // Apply solar time correction to hour if provided
  let adjH = h;
  if (solarCorrMinutes != null) {
    adjH = h + solarCorrMinutes / 60;
    // Handle day boundary wrap
    if (adjH >= 24) { adjH -= 24; d += 1; }
    if (adjH < 0) { adjH += 24; d -= 1; }
  }

  const ys = SC[md(y-4,10)], yb = BC[md(y-4,12)];
  const mb = BC[md(m+1,12)], ms = SC[md(md(SC.indexOf(ys)%5,5)*2+m-1,10)];
  const delta = Math.round((new Date(y,m-1,d)-new Date(2000,0,7))/864e5);
  const ds = SC[md(delta,10)], db = BC[md(delta,12)];
  const hbi = Math.floor((adjH+1)/2)%12;
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
function InteractiveRadar({ med, dest, colls, onSelectDimension, selectedDim, timeOffset = 0, radarLabels, tooltipLabels, discoveryMode, statusLabels }) {
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

    // Medical polygon (dashed) — in discovery mode, show as faint placeholder circle
    if (discoveryMode) {
      // Draw faint dashed circle as placeholder
      g.append("circle")
        .attr("cx", cx).attr("cy", cy).attr("r", r * 0.5)
        .attr("fill", "none")
        .attr("stroke", "#e0dcd4")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "4 6")
        .attr("opacity", 0.15);
      g.append("text")
        .attr("x", cx).attr("y", cy + r * 0.5 + 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#3a3832")
        .attr("font-size", "8px")
        .attr("font-family", "'JetBrains Mono',monospace")
        .text("Upload data to reveal");
    } else {
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
    }

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
              {(statusLabels||sL_ZH)[hoveredColl.lv]}
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
const sL_ZH = {alert:"重点关注",caution:"留意",optimal:"和谐"};
const sL_EN = {alert:"Focus",caution:"Watch",optimal:"Balanced"};

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
function AuthScreen({ onLogin, onBack }) {
  const { t, locale, toggleLang } = useI18n();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError(locale==='en'?'Please fill email and password':'请填写邮箱和密码'); return; }
    if (mode === 'register' && !username.trim()) { setError(locale==='en'?'Please enter a username':'请输入用户名'); return; }
    setError(''); setLoading(true);
    try {
      if (mode === "register") {
        const res = await apiRegister(email.trim(), password, username.trim());
        onLogin({ userId: res.userId, email: res.email, username: res.username });
      } else {
        const res = await apiLogin(email.trim(), password);
        onLogin(res);
      }
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Serif SC',serif",
      backgroundImage:"linear-gradient(rgba(196,162,101,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }}>
      <div style={{ width:420, padding:48, background:"#0f1014", border:"1px solid rgba(196,162,101,0.1)" }}>
        {/* Top bar: back + language */}
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          {onBack ? <button onClick={onBack} style={{ background:"none", border:"none", color:"#5e5a52", fontFamily:"'JetBrains Mono',monospace", fontSize:".72rem", cursor:"pointer" }}>← {locale==='en'?'Back':'返回'}</button> : <span/>}
          <span onClick={toggleLang} style={{ cursor:"pointer", fontSize:".72rem", color:"#5e5a52", fontFamily:"'JetBrains Mono',monospace" }}>
            {locale === 'en' ? '中文' : 'EN'}
          </span>
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
            <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{locale==='en'?'Email':'邮箱'}</div>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder={locale==='en'?'your@email.com':'your@email.com'}
              type="email" style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          {mode === 'register' && (
            <div>
              <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{locale==='en'?'Username':'用户名'}</div>
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder={locale==='en'?'Choose a username':'选择用户名'}
                style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
            </div>
          )}
          <div>
            <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{locale==='en'?'Password':'密码'}</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={locale==='en'?'Min 6 characters':'至少6位'}
              style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          {error && <div style={{ fontSize:"0.85rem", color:"#c44040", padding:"8px 12px", background:"rgba(196,64,64,0.06)", border:"1px solid rgba(196,64,64,0.15)" }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{...S.btn, width:"100%", marginTop:8, opacity:loading?.6:1}}>
            {loading ? '...' : mode==="login"?(locale==='en'?'Sign In':'登录'):(locale==='en'?'Create Account':'注册')}
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
  const { t, locale, toggleLang } = useI18n();
  const [by, setBY] = useState(user.birthYear || 1990);
  const [bm, setBM] = useState(user.birthMonth || 6);
  const [bd, setBD] = useState(user.birthDay || 15);
  const [bh, setBH] = useState(user.birthHour || 12);
  const [sex, setSex] = useState(user.sex || "M");
  const [rhr, setRhr] = useState(72);
  const [hasLabData, setHasLabData] = useState(null);
  // Optional: birth location for True Solar Time
  const [birthCity, setBirthCity] = useState(user.birthCity || "");
  const [birthLon, setBirthLon] = useState(user.birthLon || null);
  const [showLocation, setShowLocation] = useState(false);

  const isEn = locale === 'en';

  // Common cities for quick selection
  const CITIES = [
    {n:"Beijing",cn:"北京",lon:116.4}, {n:"Shanghai",cn:"上海",lon:121.5}, {n:"Hong Kong",cn:"香港",lon:114.2},
    {n:"Taipei",cn:"台北",lon:121.5}, {n:"Singapore",cn:"新加坡",lon:103.8}, {n:"Tokyo",cn:"东京",lon:139.7},
    {n:"Seoul",cn:"首尔",lon:127.0}, {n:"New York",cn:"纽约",lon:-74.0}, {n:"Los Angeles",cn:"洛杉矶",lon:-118.2},
    {n:"London",cn:"伦敦",lon:-0.1}, {n:"Sydney",cn:"悉尼",lon:151.2}, {n:"San Francisco",cn:"旧金山",lon:-122.4},
  ];

  // Calculate solar correction if longitude is set
  const solarCorr = useMemo(() => birthLon != null ? calcSolarCorrection(by, bm, bd, birthLon) : null, [by, bm, bd, birthLon]);

  // Calculate BaZi with solar correction
  const bazi = useMemo(() => calcBazi(by, bm, bd, bh, solarCorr?.totalMinutes), [by, bm, bd, bh, solarCorr]);
  const baziUncorrected = useMemo(() => solarCorr ? calcBazi(by, bm, bd, bh) : null, [by, bm, bd, bh, solarCorr]);

  const _pl = isEn ? ["Year","Month","Day","Hour"] : ["年柱","月柱","日柱","时柱"];
  const pls = [{lb:_pl[0],s:bazi.year[0],b:bazi.year[1]},{lb:_pl[1],s:bazi.month[0],b:bazi.month[1]},{lb:_pl[2],s:bazi.day[0],b:bazi.day[1]},{lb:_pl[3],s:bazi.hour[0],b:bazi.hour[1]}];

  // Check if hour pillar shifted due to solar correction
  const hourShifted = baziUncorrected && (baziUncorrected.hour[0] !== bazi.hour[0] || baziUncorrected.hour[1] !== bazi.hour[1]);

  const handleSave = () => {
    const initMetrics = INIT_M.map(m => m.key === 'RHR' ? {...m, value: rhr} : m);
    onSave({
      birthYear:by, birthMonth:bm, birthDay:bd, birthHour:bh, sex,
      birthCity, birthLon, solarCorrection: solarCorr,
      metrics: initMetrics, discoveryMode: hasLabData === false
    });
  };

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Serif SC',serif",
      backgroundImage:"linear-gradient(rgba(196,162,101,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }}>
      <div style={{ width:520, padding:48, background:"#0f1014", border:"1px solid rgba(196,162,101,0.1)" }}>
        {/* Language toggle */}
        <div style={{ textAlign:"right", marginBottom:8 }}>
          <span onClick={toggleLang} style={{ cursor:"pointer", fontSize:".72rem", color:"#5e5a52", fontFamily:"'JetBrains Mono',monospace" }}>
            {isEn ? '中文' : 'EN'}
          </span>
        </div>

        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.3rem", fontWeight:300, letterSpacing:".12em", color:"#e0dcd4" }}>
            {isEn ? 'Set Up Your Birth Profile' : '设置您的生辰信息'}
          </div>
          <div style={{ fontSize:"0.85rem", color:"#5e5a52", marginTop:4 }}>{isEn ? 'Welcome' : '欢迎'}, {user.username}</div>
        </div>

        {/* Birth date inputs */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
          {[[isEn?"Birth Year":"出生年",by,setBY,1940,2025],[isEn?"Month":"月",bm,setBM,1,12],[isEn?"Day":"日",bd,setBD,1,31]].map(([l,v,fn,min,max]) => (
            <div key={l}>
              <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{l}</div>
              <input type="number" value={v} min={min} max={max} onChange={e=>fn(parseInt(e.target.value)||min)} style={S.input} />
            </div>
          ))}
        </div>

        {/* Birth hour slider */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{isEn ? 'Birth Hour (24h)' : '出生时辰（24小时制）'}</div>
          <input type="range" min="0" max="23" value={bh} onChange={e=>setBH(parseInt(e.target.value))} style={{ width:"100%", accentColor:"#c4a265" }} />
          <div style={{ textAlign:"center", ...S.mono, fontSize:"1.1rem", color:"#c4a265", marginTop:4 }}>{bh}:00</div>
        </div>

        {/* Sex */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>{isEn ? 'Biological Sex' : '生理性别'}</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["M",isEn?"Male":"男"],["F",isEn?"Female":"女"]].map(([v,l]) => (
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
        <div style={{ marginBottom:20 }}>
          {/* Optional: Birth location for True Solar Time */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:".85rem", color:"#9a9488" }}>{isEn ? 'Birth Location (optional)' : '出生地点（可选）'}</span>
              {!showLocation && (
                <button onClick={()=>setShowLocation(true)} style={{ background:"none", border:"1px solid rgba(196,162,101,.12)", color:"#6a5a35", fontSize:".72rem", padding:"3px 10px", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace" }}>
                  {isEn ? '+ Enable True Solar Time' : '+ 启用真太阳时'}
                </button>
              )}
            </div>
            {showLocation && (
              <div style={{ padding:"12px 16px", background:"#16161c", border:"1px solid rgba(196,162,101,.06)" }}>
                <div style={{ fontSize:".78rem", color:"#5e5a52", marginBottom:10, lineHeight:1.5 }}>
                  {isEn
                    ? 'Selecting your birth city enables True Solar Time correction — the same astronomical algorithm used by observatories.'
                    : '选择出生城市可启用真太阳时校正——与天文台使用的相同算法。'}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                  {CITIES.map(c => (
                    <button key={c.n} onClick={()=>{setBirthCity(isEn?c.n:c.cn);setBirthLon(c.lon);}}
                      style={{ padding:"4px 10px", fontSize:".72rem", cursor:"pointer",
                        background: birthLon===c.lon?"rgba(196,162,101,.1)":"#0c0c0f",
                        border:`1px solid ${birthLon===c.lon?"rgba(196,162,101,.3)":"rgba(196,162,101,.06)"}`,
                        color: birthLon===c.lon?"#c4a265":"#5e5a52", fontFamily:"'JetBrains Mono',monospace" }}>
                      {isEn?c.n:c.cn}
                    </button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:".72rem", color:"#5e5a52" }}>{isEn?'Or longitude:':'或输入经度:'}</span>
                  <input type="number" step="0.1" value={birthLon||""} placeholder="e.g. 116.4"
                    onChange={e=>{const v=parseFloat(e.target.value);setBirthLon(isNaN(v)?null:v);setBirthCity(isEn?'Custom':'自定义');}}
                    style={{ ...S.input, width:100, fontSize:".85rem" }}/>
                  <span style={{ fontSize:".68rem", color:"#3a3832" }}>°E/W</span>
                </div>
                {solarCorr && (
                  <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(82,176,154,.04)", border:"1px solid rgba(82,176,154,.08)", fontSize:".75rem", color:"#52b09a", fontFamily:"'JetBrains Mono',monospace", lineHeight:1.6 }}>
                    <div>☉ {isEn?'Solar correction':'太阳时校正'}: {solarCorr.description}</div>
                    {hourShifted && <div style={{ color:"#d4a840", marginTop:4 }}>⚡ {isEn?'Hour Pillar shifted due to solar correction!':'时柱因太阳时校正发生变化！'}</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={S.label}>{isEn ? 'LIVE BIRTH CHART' : '实时八字预览'}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
            {pls.map(p => (
              <div key={p.lb} style={{ textAlign:"center", padding:"10px 6px", background:"#16161c", border:p.lb===_pl[2]?`2px solid ${EC[bazi.dme]}`:"1px solid rgba(196,162,101,0.06)" }}>
                <div style={{ fontSize:"0.68rem", color:"#5e5a52", marginBottom:4 }}>{p.lb}</div>
                <div style={{ fontSize:"1.3rem", color:"#e0dcd4", fontWeight:300, lineHeight:1.2 }}>{p.s}</div>
                <div style={{ fontSize:"1.3rem", color:"#c4a265", fontWeight:400, lineHeight:1.2 }}>{p.b}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:8, fontSize:"0.88rem", color:EC[bazi.dme] }}>
            {isEn ? 'Day Master' : '日主'}：{bazi.dm} ({bazi.dme})
          </div>
        </div>

        {/* Resting Heart Rate — the ONE biomarker */}
        <div style={{ marginBottom:20, padding:"16px 20px", background:"#16161c", border:"1px solid rgba(82,176,154,0.12)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#52b09a" }}/>
            <span style={{ ...S.mono, fontSize:".72rem", color:"#52b09a", letterSpacing:".1em" }}>
              {isEn ? 'YOUR RESTING HEART RATE' : '您的静息心率'}
            </span>
          </div>
          <div style={{ fontSize:".82rem", color:"#9a9488", marginBottom:10, lineHeight:1.6 }}>
            {isEn
              ? 'Place two fingers on your wrist. Count beats for 15 seconds, multiply by 4. This single biomarker anchors your analysis in clinical reality.'
              : '将两根手指放在手腕上，数15秒内的心跳次数，乘以4。这一个生物标记将你的分析锚定在临床现实中。'}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <input type="number" value={rhr} min={40} max={180} onChange={e=>setRhr(parseInt(e.target.value)||72)}
              style={{ ...S.input, width:80, textAlign:"center", fontSize:"1.3rem", color:"#52b09a" }} />
            <span style={{ ...S.mono, fontSize:".85rem", color:"#5e5a52" }}>BPM</span>
            <div style={{ flex:1, height:4, background:"#08080a", borderRadius:2 }}>
              <div style={{ height:"100%", width:Math.min(100,Math.max(0,(rhr-40)/140*100))+"%", background:rhr>=60&&rhr<=100?"#52b09a":"#c44040", borderRadius:2, transition:"width .3s" }}/>
            </div>
          </div>
        </div>

        {/* Lab data choice */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:".85rem", color:"#9a9488", marginBottom:10 }}>
            {isEn ? 'Do you have lab results to upload?' : '您有体检报告可以上传吗？'}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setHasLabData(true)} style={{
              flex:1, padding:"10px", fontSize:".9rem",
              background:hasLabData===true?"rgba(82,176,154,0.1)":"#16161c",
              border:`1px solid ${hasLabData===true?"rgba(82,176,154,0.3)":"rgba(196,162,101,0.08)"}`,
              color:hasLabData===true?"#52b09a":"#5e5a52", cursor:"pointer", fontFamily:"'Noto Serif SC',serif"
            }}>{isEn ? '✓ Yes, I have lab data' : '✓ 有，我有体检数据'}</button>
            <button onClick={()=>setHasLabData(false)} style={{
              flex:1, padding:"10px", fontSize:".9rem",
              background:hasLabData===false?"rgba(196,162,101,0.1)":"#16161c",
              border:`1px solid ${hasLabData===false?"rgba(196,162,101,0.3)":"rgba(196,162,101,0.08)"}`,
              color:hasLabData===false?"#c4a265":"#5e5a52", cursor:"pointer", fontFamily:"'Noto Serif SC',serif"
            }}>{isEn ? '☯ Discovery Mode' : '☯ 探索模式'}</button>
          </div>
          {hasLabData === false && (
            <div style={{ marginTop:10, padding:"10px 14px", background:"rgba(196,162,101,0.04)", border:"1px solid rgba(196,162,101,0.08)", fontSize:".82rem", color:"#c4a265", lineHeight:1.6 }}>
              {isEn
                ? '→ You\'ll receive a Theoretical Vulnerability Analysis based on your birth chart, plus Top 3 Recommended Biomarkers to monitor. Upload lab data anytime to unlock full clinical collision analysis.'
                : '→ 您将获得基于命理的理论脆弱性分析，以及推荐监测的三项关键指标。随时上传体检数据可解锁完整的临床对撞分析。'}
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={hasLabData===null} style={{...S.btn, width:"100%", opacity:hasLabData===null?.5:1, cursor:hasLabData===null?"not-allowed":"pointer"}}>
          {hasLabData === false
            ? (isEn ? 'Enter Discovery Mode →' : '进入探索模式 →')
            : (isEn ? 'Save & Enter System →' : '保存并进入系统 →')
          }
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// MAIN APP ROUTER
// ════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [setupDone, setSetupDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const session = await apiGetSession();
        if (session) {
          setUser(session);
          setSetupDone(!!session.setupComplete);
        }
      } catch {}
      setLoading(false);
      setReady(true);
    })();
  }, []);

  // Auth handlers
  const handleLogin = useCallback((userData) => {
    setUser(userData);
    setSetupDone(!!userData.setupComplete);
    setShowAuth(false);
  }, []);

  const handleBirthSave = useCallback(async (birthData) => {
    const updated = { ...user, ...birthData, setupComplete: true };
    setUser(updated);
    setSetupDone(true);
    try {
      if (updated.userId) {
        await apiSaveProfile(updated.userId, updated);
        // Save RHR metric if provided
        if (birthData.metrics) {
          await apiSaveMetrics(updated.userId, birthData.metrics);
        }
      }
    } catch (e) { console.error('Save error:', e); }
  }, [user]);

  const handleLogout = useCallback(async () => { await apiLogout(); setUser(null); setSetupDone(false); }, []);

  // Loading state
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#08080a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#3a3832", letterSpacing:3 }}>ANATOMYSELF</div>
    </div>
  );

  // Show auth screen
  if (showMethodology) return <MethodologyPage onBack={() => setShowMethodology(false)} />;
  if (!user && !showAuth) return <LandingPage onEnter={() => setShowAuth(true)} onMethodology={() => setShowMethodology(true)} />;
  if (!user) return <AuthScreen onLogin={handleLogin} onBack={() => setShowAuth(false)} />;
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
  // Normalize organ_wuxing — AI may return English element names instead of Chinese characters
  const normalizeEl = (el) => {
    if ('木火土金水'.includes(el)) return el;
    const map = { 'Wood':'木','Fire':'火','Earth':'土','Metal':'金','Water':'水',
                  'wood':'木','fire':'火','earth':'土','metal':'金','water':'水',
                  'Liver':'木','Heart':'火','Spleen':'土','Lung':'金','Kidney':'水',
                  'Hepatic':'木','Cardiovascular':'火','Metabolic':'土','Respiratory':'金','Renal':'水' };
    return map[el] || el;
  };
  const isDiscovery = !!user.discoveryMode;
  // Ensure all 15 standard slots exist, merging any saved data
  const initMetrics = useMemo(() => {
    let saved = user.metrics || [];
    return INIT_M.map(slot => {
      const existing = saved.find(m => m.key === slot.key);
      return existing ? { ...slot, value: existing.value } : slot;
    });
  }, []);
  const [metrics, setMetrics] = useState(initMetrics);
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  // Load metrics from Supabase on mount
  useEffect(() => {
    if (!user.userId) { setMetricsLoaded(true); return; }
    (async () => {
      try {
        const cloudMetrics = await apiLoadMetrics(user.userId);
        if (cloudMetrics && cloudMetrics.length > 0) {
          setMetrics(prev => {
            const merged = [...prev];
            cloudMetrics.forEach(cm => {
              const idx = merged.findIndex(m => m.key === cm.key);
              if (idx >= 0 && cm.value != null) merged[idx] = { ...merged[idx], value: cm.value };
              else if (idx < 0 && cm.value != null) merged.push({ key: cm.key, value: cm.value });
            });
            return merged;
          });
        }
      } catch (e) { console.error('Load metrics error:', e); }
      setMetricsLoaded(true);
    })();
  }, [user.userId]);
  const [file, setFile] = useState(null);
  const [ocr, setOcr] = useState(null);
  const [ocrL, setOcrL] = useState(false);
  const [sci, setSci] = useState(null);
  const [sciL, setSciL] = useState(false);
  const [dst, setDst] = useState(null);
  const [dstL, setDstL] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});
  const [tab, setTab] = useState(isDiscovery ? "radar" : "upload");
  // Mobile detection via window width — more reliable than CSS media queries
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 860);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 860);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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
  const [timeOffset, setTimeOffset] = useState(0);
  const [showShare, setShowShare] = useState(false);

  const by=user.birthYear, bm=user.birthMonth, bd=user.birthDay, bh=user.birthHour, sex=user.sex;

  const age = useMemo(() => {
    const t=new Date(); let a=t.getFullYear()-by;
    if(t.getMonth()+1<bm||(t.getMonth()+1===bm&&t.getDate()<bd)) a--;
    return Math.max(0,a);
  }, [by,bm,bd]);

  // Solar correction from user profile
  const userSolarCorr = useMemo(() =>
    user.birthLon != null ? calcSolarCorrection(by, bm, bd, user.birthLon) : (user.solarCorrection || null),
  [by, bm, bd, user.birthLon, user.solarCorrection]);

  const bazi = useMemo(()=>calcBazi(by,bm,bd,bh, userSolarCorr?.totalMinutes), [by,bm,bd,bh,userSolarCorr]);
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

  // Save metrics to Supabase
  const saveData = useCallback(async (newMetrics) => {
    const updated = {...user, metrics: newMetrics};
    setUser(updated);
    try { if (user.userId) await apiSaveMetrics(user.userId, newMetrics); } catch (e) { console.error('Metrics save error:', e); }
  }, [user, setUser]);

  // Persist analysis results to Supabase — only save real results
  useEffect(() => {
    if (sci && sci.items && sci.items.length > 0 && user.userId) {
      apiSaveAnalysis(user.userId, 'science', sci).catch(() => {});
    }
  }, [sci]);
  useEffect(() => {
    if (dst && (dst.collision_items?.length > 0 || dst.bazi_analysis) && user.userId) {
      apiSaveAnalysis(user.userId, 'destiny', dst).catch(() => {});
    }
  }, [dst]);

  // Restore cached analysis on mount — only if they have real content
  useEffect(() => {
    if (!user.userId) return;
    (async () => {
      try {
        if (!sci) {
          const cached = await apiLoadLatestAnalysis(user.userId, 'science');
          // Only restore if it has actual analysis items (not empty/error)
          if (cached && cached.items && cached.items.length > 0) setSci(cached);
        }
        if (!dst) {
          const cached = await apiLoadLatestAnalysis(user.userId, 'destiny');
          if (cached && (cached.collision_items?.length > 0 || cached.bazi_analysis)) setDst(cached);
        }
      } catch {}
    })();
  }, [user.userId]); // eslint-disable-line

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
  const doSciRef = useRef(null);
  const doSci = useCallback(async () => {
    setSciL(true); setSci(null); setPipe(p=>p.map((s,i)=>i===2?{...s,st:"running"}:s));
    try {
      const filledMetrics = metrics.filter(m => m.value != null);
      console.log('[doSci] filledMetrics count:', filledMetrics.length, filledMetrics.map(m=>m.key+'='+m.value));
      const allData = filledMetrics.map(m => {
        const ref = gR(m.key, age, sex);
        if (!ref) return null;
        const inRange = m.value >= ref.l && m.value <= ref.h;
        return { key: m.key, cn: ref.cn, value: m.value, unit: ref.u, low: ref.l, high: ref.h, status: inRange ? "正常" : (m.value > ref.h ? "偏高" : "偏低"), organ: ref.o };
      }).filter(Boolean);

      if (anoms.length > 0) {
        const anomalyData = anoms.map(a => ({ key: a.key, cn: a.ref.cn, value: a.value, unit: a.ref.u, low: a.ref.l, high: a.ref.h, status: a.st }));
        console.log('[doSci] sending anomalies:', anomalyData.length);
        const res = await apiScience({ age, sex, anomalies: anomalyData, lang: locale });
        setSci(res);
      } else if (allData.length > 0) {
        console.log('[doSci] sending allMetrics:', allData.length);
        const res = await apiScience({ age, sex, anomalies: [], allMetrics: allData, lang: locale });
        setSci(res);
      } else {
        console.log('[doSci] NO metrics to send!');
        setSci({ items: [], summary: locale==='en' ? 'No biomarkers loaded. Please wait for data to load or enter metrics in Data Center.' : '暂无录入指标，请先在数据中心录入体检数据。' });
      }
      setPipe(p=>p.map((s,i)=>i===2?{...s,st:"done"}:s));
    } catch (err) {
      console.error('[doSci] error:', err);
      setSci({ items: [], summary: (locale==='en'?"Science Brain error: ":"科学大脑分析失败: ") + err.message });
      setPipe(p=>p.map((s,i)=>i===2?{...s,st:"idle"}:s));
    }
    setSciL(false);
  }, [anoms, metrics, age, sex, locale]);
  doSciRef.current = doSci; // Always keep ref updated

  // ── DESTINY BRAIN — 始终独立工作 ──
  const doDst = useCallback(async () => {
    setDstL(true); setDst(null); setPipe(p=>p.map((s,i)=>i===3?{...s,st:"running"}:s));

    // Build findings from science brain or raw metrics
    let findings;
    if (sci && sci.items && sci.items.length > 0) {
      findings = sci.items.map(it => (it.metric||it.metric_cn) + "(" + it.organ_system + "): " + (it.clinical_fact||it.physiological_analysis)).join("\n");
    } else if (anoms.length > 0) {
      findings = anoms.map(a => a.key + "(" + a.ref.o + "): " + a.value + a.ref.u).join("\n");
    } else {
      findings = locale==='en' ? 'All biomarkers within normal range.' : '所有体检指标均在正常范围内。';
    }

    // Build comprehensive deterministic JSON — AI must NOT recalculate these
    const chartData = {
      chart: {
        year: bazi.year[0]+bazi.year[1],
        month: bazi.month[0]+bazi.month[1],
        day: bazi.day[0]+bazi.day[1],
        hour: bazi.hour[0]+bazi.hour[1],
      },
      dayMaster: bazi.dm,
      dayMasterElement: bazi.dme,
      elementsBalance: destWX,
      currentLuckPillar: dy.lbl + ' (' + dy.el + ')',
      annualPillar: ln.lbl + ' (' + ln.el + ')',
      // Astronomical note — only if solar correction was applied
      astronomicalNote: userSolarCorr ? (locale==='en'
        ? `True Solar Time correction applied: ${userSolarCorr.description}. The sun reached its zenith at 12:${String(Math.abs(Math.round(userSolarCorr.totalMinutes))).padStart(2,'0')} PM local time, not 12:00 PM. Birth hour pillar was calculated using corrected solar time.`
        : `已应用真太阳时校正：${userSolarCorr.description}。太阳在当地时间 12:${String(Math.abs(Math.round(userSolarCorr.totalMinutes))).padStart(2,'0')} 到达天顶，而非 12:00。时柱基于校正后的太阳时推算。`
      ) : null,
      healthFindings: findings,
    };

    try {
      const res = await apiDestiny({
        chartData,
        baziStr, lang: locale
      });
      setDst(res);
      setPipe(p=>p.map((s,i)=>i===3?{...s,st:"done"}:s));
    } catch (err) {
      setDst({ collision_items: [], temporal_outlook: (locale==='en'?"Meta Brain error: ":"命理大脑分析失败: ") + err.message, bazi_analysis: null });
      setPipe(p=>p.map((s,i)=>i===3?{...s,st:"idle"}:s));
    }
    setDstL(false);
  }, [sci, anoms, metrics, age, sex, baziStr, bazi, dy, ln, destWX, locale, userSolarCorr]);

  useEffect(() => {
    // Auto-trigger destiny brain when science completes
    // Trigger if: sci exists AND (has items OR has summary) AND destiny not yet started
    if (sci && !dst && !dstL) {
      if ((sci.items && sci.items.length > 0) || sci.summary) {
        doDst();
      }
    }
  }, [sci, dst, dstL, doDst]);

  // Discovery mode: auto-trigger destiny brain on mount (no science brain needed)
  useEffect(() => {
    if (isDiscovery && metricsLoaded && !dst && !dstL && !sci) {
      doDst();
    }
  }, [isDiscovery, metricsLoaded]); // eslint-disable-line -- only on mount

  // ── CHAT FUNCTION ──
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", text: q, brain: chatBrain }]);
    setChatLoading(true);
    try {
      const Y = new Date().getFullYear();
      const M = new Date().getMonth() + 1;
      // Build rich context with user's actual data
      let ctx = `Current date: ${Y}/${M}\n`;
      ctx += `User: ${age}y/o ${sex === "M" ? "male" : "female"}\n`;
      ctx += `BaZi: ${baziStr}, Day Master ${bazi.dm}(${bazi.dme})\n`;
      ctx += `Major Cycle: ${dy.lbl}(${dy.el}), Annual: ${ln.lbl}(${ln.el})\n`;
      // Include actual metrics
      const filled = metrics.filter(m => m.value != null);
      if (filled.length > 0) {
        ctx += `Biomarkers: ${filled.map(m => `${m.key}=${m.value}`).join(', ')}\n`;
      }
      if (anoms.length > 0) {
        ctx += `⚠ Abnormal: ${anoms.map(a => `${a.key}=${a.value} (${a.st})`).join(', ')}\n`;
      }
      if (sci?.sentinel) ctx += `Science sentinel: ${sci.sentinel}\n`;
      if (sci?.items?.length) ctx += `Clinical findings: ${sci.items.map(i => `${i.metric||i.metric_cn}(${i.organ_system}): ${i.clinical_fact||''}`).join('; ')}\n`;
      if (dst?.temporal_outlook) ctx += `Meta outlook: ${dst.temporal_outlook}\n`;
      // Recent chat for continuity
      const recent = chatHistory.slice(-4).map(m => `${m.role === "user" ? "User" : (m.brain === "science" ? "Science" : "Meta")}: ${m.text}`).join("\n");
      if (recent) ctx += `\nRecent chat:\n${recent}`;

      const res = await apiChat({ brain: chatBrain, question: q, context: ctx, lang: locale });
      setChatHistory(prev => [...prev, { role: "assistant", text: res.answer || (locale==='en'?"No response":"无回答"), brain: chatBrain }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "assistant", text: (locale==='en'?"Chat error: ":"对话失败: ") + err.message, brain: chatBrain }]);
    }
    setChatLoading(false);
  }, [chatInput, chatBrain, chatLoading, chatHistory, age, sex, bazi, baziStr, dy, ln, sci, dst, metrics, anoms, locale]);

  // ── Helper: open report in new window with print prompt ──
  const openReport = useCallback((title, htmlContent) => {
    const w = window.open('', '_blank');
    if (!w) { alert(locale==='en' ? 'Please allow pop-ups to view your report.' : '请允许弹出窗口以查看报告。'); return; }
    w.document.write(htmlContent);
    w.document.close();
  }, [locale]);

  // ── SVG radar string for embedding in reports ──
  const radarSVG = useMemo(() => {
    const cx=120,cy=120,r=90,order=["火","土","金","水","木"];
    const angles=order.map((_,i)=>(i*2*Math.PI/5)-Math.PI/2);
    const colors={"火":"#c45a30","土":"#a08a50","金":"#9898a8","水":"#3a6a9a","木":"#4a8a4a"};
    const labels = locale==='en' ? ["Cardio","Metabolic","Respiratory","Renal","Hepatic"] : ["火·心","土·脾","金·肺","水·肾","木·肝"];
    const grid=[1,.75,.5,.25].map(s=>angles.map(a=>`${cx+r*s*Math.cos(a)},${cy+r*s*Math.sin(a)}`).join(' ')).map(p=>`<polygon points="${p}" fill="none" stroke="rgba(196,162,101,.08)" stroke-width=".5"/>`).join('');
    const destPts=order.map((e,i)=>`${cx+r*(destWX[e]||50)/100*Math.cos(angles[i])},${cy+r*(destWX[e]||50)/100*Math.sin(angles[i])}`).join(' ');
    const medPts=order.map((e,i)=>`${cx+r*(medWX[e]||50)/100*Math.cos(angles[i])},${cy+r*(medWX[e]||50)/100*Math.sin(angles[i])}`).join(' ');
    const lbls=order.map((e,i)=>{const x=cx+(r+18)*Math.cos(angles[i]),y=cy+(r+18)*Math.sin(angles[i]);return `<text x="${x}" y="${y+4}" text-anchor="middle" font-size="9" fill="${colors[e]}" font-family="'Noto Serif SC',serif">${labels[i]}</text>`;}).join('');
    return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" style="width:220px;height:220px">${grid}<polygon points="${destPts}" fill="rgba(196,162,101,.06)" stroke="#c4a265" stroke-width="1.2" opacity=".75"/><polygon points="${medPts}" fill="rgba(224,220,212,.04)" stroke="#e0dcd4" stroke-width="1" stroke-dasharray="4 2" opacity=".55"/>${lbls}</svg>`;
  }, [destWX, medWX, locale]);

  // ── Life Blueprint Report ──
  const generateScienceReport = useCallback(() => {
    const now=new Date();
    const d=`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    const id='AS-'+Date.now().toString(36).toUpperCase();
    const isEn=locale==='en';
    const sexL=isEn?(sex==='M'?'Male':'Female'):(sex==='M'?'男':'女');

    // Build impact rows
    const impacts=WX_GROUPS.map(g=>{
      const si=(sci?.items||[]).find(it=>normalizeEl(it.organ_system)===g.el);
      const di=(dst?.collision_items||[]).find(it=>normalizeEl(it.organ_wuxing)===g.el);
      if(!si&&!di) return '';
      const isCrit=si?.severity==='critical'||si?.severity==='severe';
      return `<div class="impact" style="border-left-color:${EC[g.el]};${isCrit?'border-left-width:3px;':''}">
<div class="impact-hdr"><span class="el" style="color:${EC[g.el]}">${isEn?elName(g.el):g.el}</span> <span class="sys">${sysLabel(g.el)}</span>${si?.severity?`<span class="sev ${isCrit?'crit':''}">${si.severity.toUpperCase()}</span>`:''}</div>
<div class="impact-body"><div class="col-l"><div class="col-tag bio">CLINICAL</div><p>${si?.clinical_fact||si?.physiological_analysis||'—'}</p>${si?.recommendation?`<div class="act bio-act">→ ${si.recommendation}</div>`:''}</div>
<div class="col-r"><div class="col-tag meta">ENERGETIC</div><p>${di?.current_forces||'—'}</p>${di?.risk_window?`<div class="rw">⏱ ${di.risk_window}</div>`:''}${di?.prevention?`<div class="act meta-act">→ ${di.prevention}</div>`:''}</div></div></div>`;
    }).join('');

    // Metrics mini-table
    const mrows=metrics.filter(m=>m.value!=null).map(m=>{
      const ref=gR(m.key,age,sex);if(!ref)return '';
      const inR=m.value>=ref.l&&m.value<=ref.h;
      return `<tr><td class="mn">${isEn?mNameFull(m.key):ref.cn} <span class="code">${m.key}</span></td><td class="mv ${inR?'ok':'bad'}">${m.value}</td><td class="mu">${ref.u}</td></tr>`;
    }).join('');

    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AnatomySelf · Life Blueprint</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Noto+Serif+SC:wght@200;300;400;600&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08080a;color:#e0dcd4;font-family:'Noto Serif SC','Cormorant Garamond',serif;font-size:13px;line-height:1.6}
.page{max-width:760px;margin:0 auto;padding:40px 48px;position:relative}
.print-bar{background:#16161c;padding:10px 20px;text-align:center;font-size:12px;color:#c4a265;font-family:'JetBrains Mono',monospace;cursor:pointer;border-bottom:1px solid rgba(196,162,101,.1)}
.print-bar:hover{background:#1a1a22}
@media print{.print-bar{display:none}body{padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
/* Header */
.hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid rgba(196,162,101,.12);padding-bottom:16px;margin-bottom:24px}
.brand{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:#c4a265;letter-spacing:4px}
.brand-sub{font-size:10px;color:#5e5a52;letter-spacing:2px;margin-top:2px}
.hdr-r{text-align:right;font-family:'JetBrains Mono',monospace;font-size:9px;color:#5e5a52;line-height:1.8}
/* Sentinel */
.sentinel{border-left:3px solid #c4a265;padding:12px 16px;background:#16161c;font-size:14px;color:#e0dcd4;line-height:1.7;margin-bottom:20px}
/* Layout: radar + metrics side by side */
.top-row{display:flex;gap:24px;margin-bottom:20px;align-items:flex-start}
.radar-col{flex:0 0 220px;text-align:center}
.metrics-col{flex:1}
table{width:100%;border-collapse:collapse}
tr{border-bottom:1px solid rgba(196,162,101,.04)}
td{padding:3px 6px}
.mn{font-size:11px;color:#d0ccc4}.code{font-size:8px;color:#5e5a52}
.mv{font-family:'JetBrains Mono',monospace;font-size:11px;text-align:right}
.mu{font-size:9px;color:#3a3832;text-align:right}
.ok{color:#52b09a}.bad{color:#c44040}
/* Section */
.sec{font-family:'JetBrains Mono',monospace;font-size:9px;color:#6a5a35;letter-spacing:3px;margin:20px 0 10px}
/* Impact cards */
.impact{border-left:2px solid #c4a265;background:#16161c;margin-bottom:8px;break-inside:avoid}
.impact-hdr{padding:8px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(196,162,101,.06)}
.el{font-size:14px;font-weight:600}.sys{font-size:11px;color:#9a9488}
.sev{font-family:'JetBrains Mono',monospace;font-size:8px;padding:1px 6px;background:rgba(212,168,64,.1);color:#d4a840;margin-left:auto}
.sev.crit{background:rgba(196,64,64,.1);color:#c44040}
.impact-body{display:flex}
.col-l,.col-r{flex:1;padding:10px 14px}
.col-l{border-right:1px solid rgba(196,162,101,.06)}
.col-tag{font-family:'JetBrains Mono',monospace;font-size:7px;letter-spacing:2px;margin-bottom:6px}
.bio{color:#52b09a}.meta{color:#c4a265}
.impact-body p{font-size:11px;color:#d0ccc4;line-height:1.7}
.act{font-size:10px;margin-top:4px}.bio-act{color:#52b09a}.meta-act{color:#c4a265}
.rw{font-size:9px;color:#d4a840;margin:3px 0}
/* Temporal */
.date-item{font-size:11px;color:#d4a840;margin-bottom:4px;line-height:1.5}
/* Disclaimer */
.disc{font-size:9px;color:#4a4a44;line-height:1.6;padding:10px 14px;border-left:1px solid rgba(196,162,101,.1);margin-top:20px}
.ftr{text-align:center;font-size:8px;color:#3a3832;margin-top:24px;padding-top:12px;border-top:1px solid rgba(196,162,101,.06)}
</style></head><body>
<div class="print-bar" onclick="window.print()">⬇ ${isEn?'Click here or press Ctrl+P / Cmd+P to save as PDF':'点击此处或按 Ctrl+P / Cmd+P 保存为 PDF'}</div>
<div class="page">
<div class="hdr">
<div><div class="brand">ANATOMYSELF</div><div class="brand-sub">${isEn?'LIFE BLUEPRINT':'生命蓝图'}</div></div>
<div class="hdr-r">${user.username} · ${age}${isEn?'y/o':'岁'} ${sexL}<br>${isEn?'Day Master':'日主'}: ${bazi.dm}(${bazi.dme}) · ${dy.lbl} · ${targetLN.lbl}<br>ID: ${id} · ${d}</div>
</div>

${(sci?.sentinel||sci?.summary)?`<div class="sentinel">${sci.sentinel||sci.summary}</div>`:''}

<div class="top-row">
<div class="radar-col">${radarSVG}<div style="font-size:8px;color:#3a3832;margin-top:6px;font-family:'JetBrains Mono',monospace">● ${isEn?'Energetic':'能量'} ◌ ${isEn?'Clinical':'临床'}</div></div>
<div class="metrics-col">
<div class="sec">${isEn?'CLINICAL BIOMARKERS':'临床指标'}</div>
<table>${mrows}</table>
</div></div>

${impacts?`<div class="sec">IMPACT ANALYSIS</div>${impacts}`:''}

${dst?.temporal_outlook?`<div class="sec">TEMPORAL OUTLOOK</div><p style="font-size:11px;color:#9a9488;line-height:1.7">${dst.temporal_outlook}</p>`:''}

${dst?.key_dates?.length?`<div class="sec">${isEn?'KEY TEMPORAL NODES':'关键时间节点'}</div>${dst.key_dates.map(x=>`<div class="date-item">▪ ${x}</div>`).join('')}`:''}

<div class="disc">${isEn?'Science Brain: AI interpretation for reference only — not medical advice. Meta Brain: Traditional BaZi analysis — cultural reference only.':'科学脑：AI解读仅供参考。命理脑：传统命理推演，属文化参考。'}</div>
<div class="ftr">ANATOMYSELF · ${isEn?'Decode Your Biological Blueprint':'解码你的生命蓝图'} · ${d}</div>
</div></body></html>`;
    openReport('Life Blueprint', html);
  }, [metrics, sci, dst, age, sex, user, bazi, dy, targetLN, locale, radarSVG, colls]);

  // ── Weekly Energy Defense Guide ──
  const generateDestinyGuide = useCallback(() => {
    const now=new Date();
    const isEn=locale==='en';
    const weekDays=isEn?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]:["日","一","二","三","四","五","六"];
    const elEn={"木":"Wood","火":"Fire","土":"Earth","金":"Metal","水":"Water"};
    const days=Array.from({length:7},(_,i)=>{
      const dd=new Date(now.getTime()+i*864e5);
      const delta=Math.round((dd-new Date(2000,0,7))/864e5);
      const ds=SC[md(delta,10)],db=BC[md(delta,12)];
      const dayEl=TG[ds][0];
      const rel=dayEl===bazi.dme?(isEn?"Companion":"比肩"):GEN[bazi.dme]===dayEl?(isEn?"Output":"食伤"):CTL[bazi.dme]===dayEl?(isEn?"Wealth":"财星"):GEN[dayEl]===bazi.dme?(isEn?"Resource":"印星"):(isEn?"Authority":"官杀");
      const energy=dayEl===bazi.dme?90:GEN[dayEl]===bazi.dme?80:GEN[bazi.dme]===dayEl?60:CTL[dayEl]===bazi.dme?30:45;
      return {date:`${dd.getMonth()+1}/${dd.getDate()}`,wd:weekDays[dd.getDay()],gan:ds,zhi:db,el:dayEl,elLabel:isEn?elEn[dayEl]:dayEl,rel,energy,
        advice:energy>=80?(isEn?"Advance":"宜进取"):energy>=60?(isEn?"Steady":"宜平稳"):(isEn?"Protect":"宜守护"),
        organ:sysOrgan(dayEl)};
    });

    const d1=days[0].date,d7=days[6].date;
    const energySVG=`<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:80px;margin:12px 0">
${days.map((d,i)=>{const x=i*320/7+320/14,h=d.energy*0.6,y=70-h,c=d.energy>=80?'#52b09a':d.energy>=60?'#d4a840':'#c44040';
return `<rect x="${x-12}" y="${y}" width="24" height="${h}" rx="2" fill="${c}" opacity=".6"/><text x="${x}" y="78" text-anchor="middle" font-size="8" fill="#5e5a52" font-family="'JetBrains Mono',monospace">${d.wd}</text>`;}).join('')}</svg>`;

    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AnatomySelf · Energy Guide</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Noto+Serif+SC:wght@200;300;400;600&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08080a;color:#e0dcd4;font-family:'Noto Serif SC',serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.print-bar{position:fixed;top:0;left:0;right:0;background:#16161c;padding:8px;text-align:center;font-size:11px;color:#c4a265;font-family:'JetBrains Mono',monospace;cursor:pointer;z-index:10}
.print-bar:hover{background:#1a1a22}
@media print{.print-bar{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.card{width:420px;padding:32px 28px;background:linear-gradient(160deg,#0f1014,#16161c,#0f1014);border:1px solid rgba(196,162,101,.12);position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#4a8a4a,#c45a30,#a08a50,#9898a8,#3a6a9a)}
.title{text-align:center;margin-bottom:20px}
.title h2{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;color:#c4a265;letter-spacing:4px}
.title .sub{font-size:10px;color:#5e5a52;margin-top:4px;font-family:'JetBrains Mono',monospace}
.dm{text-align:center;margin-bottom:16px;padding:6px 12px;background:rgba(196,162,101,.03);border:1px solid rgba(196,162,101,.06);font-size:11px;color:#9a9488}
.dm span{color:#c4a265}
.day{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(196,162,101,.04)}
.day:last-of-type{border:none}
.day-d{width:42px;text-align:center}.day-d .d{font-size:12px;color:#9a9488}.day-d .w{font-size:9px;color:#5e5a52;font-family:'JetBrains Mono',monospace}
.day-el{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600}
.day-info{flex:1}.day-info .gz{font-size:12px;color:#e0dcd4}.day-info .rel{font-size:9px;color:#5e5a52;margin-top:1px}
.day-e{width:50px;text-align:right;font-size:11px;font-family:'JetBrains Mono',monospace}
.disc{font-size:8px;color:#3a3832;text-align:center;margin-top:14px;line-height:1.4}
.ftr{text-align:center;margin-top:14px;font-size:7px;color:#2a2a2a;letter-spacing:1px}
</style></head><body>
<div class="print-bar" onclick="window.print()">⬇ ${isEn?'Click here or Ctrl+P / Cmd+P to save as PDF':'点击此处或 Ctrl+P / Cmd+P 保存为 PDF'}</div>
<div class="card">
<div class="title"><div style="font-size:8px;color:#3a3832;letter-spacing:4px;margin-bottom:4px">ANATOMYSELF</div>
<h2>${isEn?'Weekly Energy Guide':'一周能量防御指南'}</h2>
<div class="sub">${d1} — ${d7}</div></div>
<div class="dm">${isEn?'Day Master':'日主'} <span>${bazi.dm}(${bazi.dme})</span> · ${dy.lbl} · ${targetLN.lbl}</div>
${energySVG}
${days.map(d=>`<div class="day">
<div class="day-d"><div class="d">${d.date}</div><div class="w">${d.wd}</div></div>
<div class="day-el" style="background:${EC[d.el]}22;color:${EC[d.el]}">${d.elLabel}</div>
<div class="day-info"><div class="gz">${d.gan}${d.zhi} <span style="font-size:9px;color:${EC[d.el]}">${d.organ}</span></div><div class="rel">${d.rel}</div></div>
<div class="day-e" style="color:${d.energy>=80?'#52b09a':d.energy>=60?'#d4a840':'#c44040'}">${d.energy}% ${d.advice}</div>
</div>`).join('')}
<div class="disc">${isEn?'Based on traditional BaZi analysis. Cultural reference only.':'基于传统八字命理推演，属文化参考。'}</div>
<div class="ftr">ANATOMYSELF · ${isEn?'Decode Your Biological Blueprint':'解码你的生命蓝图'}</div>
</div></body></html>`;
    openReport('Energy Guide', html);
  }, [bazi, dy, targetLN, locale, metrics]);

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
    const timers = [];
    analysisPhases.forEach((p, i) => {
      if (i > 0) timers.push(setTimeout(() => setAnalysisPhase(i), p.t));
    });
    analysisTimerRef.current = timers;
    setPipe(p=>p.map((s,i)=>i>=2?{...s,st:"idle"}:s));
    setDst(null);
    // Use ref to always call latest doSci (with loaded metrics)
    if (doSciRef.current) await doSciRef.current();
  }, [analysisPhases]);

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

      {/* SHARE CARD */}
      {showShare && <ShareCard bazi={bazi} destWX={destWX} locale={locale} onClose={()=>setShowShare(false)} />}

      {/* LOADING RITUAL */}
      {analysisActive && (
        <div style={{
          position:"fixed", inset:0, zIndex:100,
          background:"rgba(8,8,10,0.85)", backdropFilter:"blur(6px)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          animation:"fadeIn .5s ease-out",
        }}>
          {/* Breathing circle */}
          <div style={{ position:"relative", width:160, height:160, marginBottom:28 }}>
            {/* Outer ring — breathe */}
            <div style={{
              position:"absolute", inset:0, borderRadius:"50%",
              border:"1px solid rgba(196,162,101,0.12)",
              animation:"ringBreathe 12s ease-in-out infinite",
            }}/>
            {/* Inner ring — counter-breathe */}
            <div style={{
              position:"absolute", inset:20, borderRadius:"50%",
              border:"1px solid rgba(82,176,154,0.1)",
              animation:"ringBreathe 12s ease-in-out infinite 6s",
            }}/>
            {/* Center breathing guide */}
            <div style={{
              position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
              flexDirection:"column", gap:4,
            }}>
              <div style={{
                width:12, height:12, borderRadius:"50%",
                background:"radial-gradient(circle, rgba(196,162,101,0.4), rgba(196,162,101,0.05))",
                animation:"coreBreathe 12s ease-in-out infinite",
              }}/>
              <div style={{
                fontSize:".68rem", color:"#5e5a52", fontFamily:"'Cormorant Garamond',serif",
                fontStyle:"italic", letterSpacing:".15em",
                animation:"breatheText 12s ease-in-out infinite",
              }}>
                {/* Breathing text cycles via CSS — static fallback */}
                {analysisPhase < 2 ? (locale==='en'?'Inhale':'吸') : analysisPhase < 4 ? (locale==='en'?'Hold':'持') : (locale==='en'?'Exhale':'呼')}
              </div>
            </div>
            {/* Orbiting dot */}
            <div style={{
              position:"absolute", top:-3, left:"50%", marginLeft:-3,
              width:6, height:6, borderRadius:"50%", background:"#c4a265",
              opacity:0.4, transformOrigin:"3px 83px",
              animation:"orbit 8s linear infinite",
            }}/>
          </div>

          {/* Status header */}
          <div style={{ ...S.mono, fontSize:".65rem", color:"#3a3832", letterSpacing:".25em", marginBottom:16 }}>
            {locale === 'en' ? 'DUAL-BRAIN ANALYSIS' : '双脑对撞分析'}
          </div>

          {/* Status logs — only show current + fading previous */}
          <div style={{ textAlign:"center", maxWidth:480, minHeight:80 }}>
            {analysisPhases.slice(Math.max(0, analysisPhase - 1), analysisPhase + 1).map((p, i, arr) => {
              const isCurrent = i === arr.length - 1;
              return (
                <div key={analysisPhase - (arr.length - 1 - i)} style={{
                  fontSize: isCurrent ? ".82rem" : ".72rem",
                  color: isCurrent ? "#d0ccc4" : "#2a2a2a",
                  marginBottom:8,
                  fontFamily:"'JetBrains Mono',monospace",
                  animation: isCurrent ? "fadeIn .6s ease-out" : "none",
                  transition:"color .5s, font-size .5s",
                }}>
                  <span style={{ color: isCurrent ? "#c4a265" : "#1a1a1a", marginRight:8 }}>{p.icon}</span>
                  {p.msg}
                </div>
              );
            })}
          </div>

          {/* Shimmer line */}
          <div style={{ marginTop:20, width:100, height:1, background:"#16161c", borderRadius:1, overflow:"hidden" }}>
            <div style={{
              height:"100%", width:"30%",
              background:"linear-gradient(90deg, transparent, rgba(196,162,101,0.3), transparent)",
              animation:"shimmer 2.5s ease-in-out infinite",
            }}/>
          </div>

          {/* Anchor text */}
          <div style={{ marginTop:20, fontSize:".72rem", color:"#3a3832", fontStyle:"italic", fontFamily:"'Cormorant Garamond',serif", textAlign:"center", maxWidth:360, lineHeight:1.6 }}>
            {locale === 'en'
              ? 'Our Dual-Brain engine is conducting a deep-dive cross-analysis. Quality takes time.'
              : '双脑引擎正在进行深度交叉分析，精准需要时间。'}
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
          {!isMobile && (
            <div className="as-desktop-only" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
              {pls.map(p => <div key={p.lb} style={{ textAlign:"center", padding:"2px 5px", background:"#16161c", border:"1px solid rgba(196,162,101,.06)" }}>
                <div style={{ fontSize:".8rem", color:"#e0dcd4", lineHeight:1.1 }}>{p.s}{p.b}</div>
              </div>)}
            </div>
          )}
          {!isMobile && <span className="as-desktop-only" style={{ ...S.mono, fontSize:".75rem", color:"#5e5a52" }}>{user.username} · {age}{t('sidebar.age')}</span>}
          <div onClick={toggleLang} style={{ cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", width:28, height:28, borderRadius:"50%", background:"rgba(196,162,101,.04)", border:"1px solid rgba(196,162,101,.06)", transition:"all .25s", position:"relative" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(196,162,101,.25)";e.currentTarget.style.background="rgba(196,162,101,.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(196,162,101,.06)";e.currentTarget.style.background="rgba(196,162,101,.04)";}}>
            <span style={{ fontSize:".62rem", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace", fontWeight:600, letterSpacing:"-0.5px" }}>
              {locale === 'en' ? '中' : 'EN'}
            </span>
          </div>
          {/* Share button */}
          <button onClick={()=>setShowShare(true)} style={{ background:"none", border:"1px solid rgba(196,162,101,.1)", color:"#6a5a35", padding:"4px 10px", fontSize:".72rem", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", borderRadius:2 }}
            title={locale==='en'?'Share your blueprint':'分享你的蓝图'}>
            ⬡
          </button>
          <button onClick={onLogout} style={{ background:"rgba(196,64,64,.06)", border:"1px solid rgba(196,64,64,.2)", color:"#c44040", padding:"4px 14px", fontSize:".8rem", cursor:"pointer", fontFamily:"'Noto Serif SC',serif", borderRadius:2, transition:"all .2s" }}
            onMouseEnter={e=>{e.target.style.background="rgba(196,64,64,.15)";}} onMouseLeave={e=>{e.target.style.background="rgba(196,64,64,.06)";}}>
            {t('header.logout')}
          </button>
        </div>
      </div>

      <div className="as-main-wrap" style={{ display:"flex", minHeight:"calc(100vh - 50px)" }}>
        {/* SIDEBAR (desktop only) */}
        {!isMobile && (
        <div className="as-sidebar" style={{ width:220, minWidth:220, background:"#0c0c0f", borderRight:"1px solid rgba(196,162,101,.08)", padding:"16px 14px", display:"flex", flexDirection:"column", gap:12, overflowY:"auto" }}>
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
        )}

        {/* MAIN */}
        <div className="as-main-content" style={{ flex:1, overflowY:"auto", padding: isMobile ? "12px 14px 90px 14px" : "20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
          {/* MOBILE SUMMARY STRIP (horizontal scroll, replaces sidebar on mobile) */}
          {isMobile && (
          <div className="as-mobile-strip">
            <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8, WebkitOverflowScrolling:"touch" }}>
              {/* Day Master card */}
              <div style={{ flexShrink:0, minWidth:130, padding:"10px 14px", background:"#16161c", border:`1px solid ${EC[bazi.dme]}33`, borderRadius:4 }}>
                <div style={{ fontSize:10, color:"#6a5a35", letterSpacing:1.5, fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>DAY MASTER</div>
                <div style={{ fontSize:22, color:EC[bazi.dme], lineHeight:1, fontWeight:300 }}>{bazi.dm}</div>
                <div style={{ fontSize:11, color:"#9a9488", marginTop:2 }}>{user.username} · {age}{t('sidebar.age')}</div>
              </div>
              {/* Five Element mini-bars */}
              <div style={{ flexShrink:0, minWidth:180, padding:"10px 14px", background:"#16161c", border:"1px solid rgba(196,162,101,.1)", borderRadius:4 }}>
                <div style={{ fontSize:10, color:"#6a5a35", letterSpacing:1.5, fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>FIVE ELEMENTS</div>
                {["火","木","土","金","水"].map(el => {
                  const sc = Math.round(medWX[el]);
                  return (
                    <div key={el} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <span style={{ fontSize:11, color:EC[el], width:14 }}>{el}</span>
                      <div style={{ flex:1, height:3, background:"#08080a", borderRadius:1 }}>
                        <div style={{ height:"100%", width:sc+"%", background:sc<50?"#c44040":EC[el], borderRadius:1 }}/>
                      </div>
                      <span style={{ fontSize:10, color:sc<50?"#c44040":"#9a9488", fontFamily:"'JetBrains Mono',monospace", width:22, textAlign:"right" }}>{sc}</span>
                    </div>
                  );
                })}
              </div>
              {/* Luck pillar card */}
              <div style={{ flexShrink:0, minWidth:120, padding:"10px 14px", background:"#16161c", border:"1px solid rgba(196,162,101,.1)", borderRadius:4 }}>
                <div style={{ fontSize:10, color:"#6a5a35", letterSpacing:1.5, fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>LUCK · YEAR</div>
                <div style={{ fontSize:13, color:EC[dy.el], marginBottom:2 }}>{dy.lbl}</div>
                <div style={{ fontSize:13, color:EC[ln.el] }}>{ln.lbl}</div>
              </div>
              {/* Anomalies card */}
              {anoms.length > 0 && (
                <div style={{ flexShrink:0, minWidth:110, padding:"10px 14px", background:"rgba(196,64,64,.06)", border:"1px solid rgba(196,64,64,.2)", borderRadius:4 }}>
                  <div style={{ fontSize:10, color:"#c44040", letterSpacing:1.5, fontFamily:"'JetBrains Mono',monospace", marginBottom:4 }}>⚠ ALERTS</div>
                  <div style={{ fontSize:20, color:"#c44040", fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{anoms.length}</div>
                  <div style={{ fontSize:10, color:"#c44040", opacity:.7 }}>{t('sidebar.items')}</div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* TABS (desktop) */}
          {!isMobile && (
          <div className="as-desktop-only" style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(196,162,101,.08)" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"10px 18px", background:"transparent", border:"none",
                borderBottom:tab===t.id?"2px solid #c4a265":"2px solid transparent",
                color:tab===t.id?"#c4a265":"#5e5a52", fontSize:".95rem", cursor:"pointer",
                fontFamily:"'Noto Serif SC',serif", transition:"all .3s"
              }}>{t.lb}</button>
            ))}
          </div>
          )}

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
                      <div><div style={{ fontSize:"1rem", color:"#52b09a" }}>✓ {file.name}</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>{(file.size/1024).toFixed(1)}KB</div></div>
                    ) : (
                      <div><div style={{ fontSize:"2rem", color:"#6a5a35", marginBottom:8 }}>⬆</div><div style={{ fontSize:".95rem", color:"#9a9488" }}>{t("upload.uploadPrompt")}</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>{t('upload.uploadSub')}</div></div>
                    )}
                  </div>
                  {ocrL && <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:12, height:12, border:"2px solid #c4a265", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
                    <span style={{ fontSize:".85rem", color:"#c4a265" }}>{t("upload.ocrRunning")}</span>
                  </div>}

                  {/* Trust Shield */}
                  <div style={{ marginTop:14, padding:"10px 14px", background:"rgba(82,176,154,.03)", border:"1px solid rgba(82,176,154,.08)", fontSize:".75rem", color:"#5e5a52", lineHeight:1.6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                      <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 1L2 4v4c0 3.5 2.6 6.5 6 7.5 3.4-1 6-4 6-7.5V4L8 1z" fill="none" stroke="#52b09a" strokeWidth="1.2"/><path d="M5.5 8.5l2 2 3.5-4" fill="none" stroke="#52b09a" strokeWidth="1.2"/></svg>
                      <span style={{ ...S.mono, fontSize:".65rem", color:"#52b09a", letterSpacing:".1em" }}>ZERO-KNOWLEDGE PROCESSING</span>
                    </div>
                    {locale === 'en'
                      ? 'We read your data, but we never own it. Images are destroyed after OCR extraction. Only numerical values are stored — encrypted and anonymized.'
                      : '我们读取您的数据，但绝不拥有它。图片在OCR提取后即时销毁。仅存储数值——加密且匿名化。'}
                  </div>

                  {/* Privacy flow — expandable */}
                  <details style={{ marginTop:8 }}>
                    <summary style={{ ...S.mono, fontSize:".62rem", color:"#3a3832", cursor:"pointer", letterSpacing:".1em" }}>
                      {locale === 'en' ? '▸ DATA PROCESSING FLOW' : '▸ 数据处理流程'}
                    </summary>
                    <div style={{ marginTop:8, padding:"8px 12px", background:"#16161c", fontSize:".72rem", color:"#5e5a52", lineHeight:1.7 }}>
                      <div style={{ marginBottom:4 }}><span style={{ color:"#52b09a" }}>①</span> {locale==='en'?'OCR extracts numerical values from your image':'OCR从图片中提取数值'}</div>
                      <div style={{ marginBottom:4 }}><span style={{ color:"#52b09a" }}>②</span> {locale==='en'?'Original image destroyed immediately — never stored':'原图即时销毁——从不存储'}</div>
                      <div style={{ marginBottom:4 }}><span style={{ color:"#52b09a" }}>③</span> {locale==='en'?'Values encrypted and stored locally on your device':'数值加密存储在您的本地设备'}</div>
                      <div><span style={{ color:"#52b09a" }}>④</span> {locale==='en'?'AI analysis runs with anonymized data — no PII transmitted':'AI分析使用匿名数据——不传输个人信息'}</div>
                    </div>
                  </details>
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
                <button onClick={startAnalysisCeremony} disabled={sciL||dstL||analysisActive||!metricsLoaded}
                  style={{ ...S.btn, opacity:sciL||dstL||analysisActive||!metricsLoaded?.5:1, cursor:sciL||dstL||analysisActive||!metricsLoaded?"wait":"pointer" }}>
                  {!metricsLoaded?"⏳ "+(locale==='en'?"Loading data...":"加载数据中..."):analysisActive?"⏳ "+t('upload.sciRunning'):"⚡ "+t('upload.launchBtn')}
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
            <div className="as-main-grid" style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:20 }}>
              {/* LEFT: Radar + dimension list */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ ...S.card, position:"relative", overflow:"hidden" }}>
                  {/* Compass watermark */}
                  <svg viewBox="0 0 200 200" style={{ position:"absolute", right:-20, bottom:-20, width:160, height:160, opacity:.03, pointerEvents:"none" }}>
                    <circle cx="100" cy="100" r="90" fill="none" stroke="#c4a265" strokeWidth="1"/>
                    <circle cx="100" cy="100" r="70" fill="none" stroke="#c4a265" strokeWidth=".5"/>
                    {[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>{const a=i*Math.PI/6;return <line key={i} x1={100+72*Math.cos(a)} y1={100+72*Math.sin(a)} x2={100+90*Math.cos(a)} y2={100+90*Math.sin(a)} stroke="#c4a265" strokeWidth={i%3===0?".8":".3"}/>;
                    })}
                  </svg>
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
                    discoveryMode={isDiscovery}
                    statusLabels={locale==='en'?sL_EN:sL_ZH}
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
                    // Elemental totem SVG paths
                    const totemPath = {"木":"M10,2 L10,18 M10,8 L5,12 M10,8 L15,12","火":"M10,2 L18,18 L2,18Z","土":"M3,3 H17 V17 H3Z","金":"M10,10 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0","水":"M10,18 L18,2 L2,2Z"}[c.el];
                    return (
                      <div key={c.el} onClick={() => setSelectedDim(isActive ? null : c.el)} style={{
                        display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"10px 12px", marginTop:4, cursor:"pointer",
                        borderLeft:`3px solid ${isActive ? EC[c.el] : sC[c.lv]}`,
                        background: isActive ? "rgba(196,162,101,0.06)" : "#16161c",
                        transition:"all .25s"
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <svg viewBox="0 0 20 20" width="18" height="18" style={{flexShrink:0}}>
                            <path d={totemPath} fill="none" stroke={EC[c.el]} strokeWidth="1.2" opacity=".7"/>
                          </svg>
                          <span style={{ fontSize:".88rem", color: isActive ? "#e0dcd4" : "#9a9488" }}>{sysOrgan(c.el)}</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:40, height:4, background:"#08080a", borderRadius:1 }}>
                            <div style={{ height:"100%", width:Math.min(100, c.corr)+"%", background:sC[c.lv], borderRadius:1, transition:"width .4s" }}/>
                          </div>
                          <span style={{ ...S.mono, fontSize:".72rem", color:sC[c.lv], width:42, textAlign:"right" }}>{(locale==='en'?sL_EN:sL_ZH)[c.lv]} {c.corr}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* RIGHT: 3-Layer Analysis Architecture */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                {/* LAYER 1: Top Sentinel — one-sentence summary */}
                {(sci?.sentinel || sci?.summary) && (
                  <div style={{ ...S.card, borderLeft:"3px solid #c4a265", padding:"16px 20px" }}>
                    <div style={{ ...S.mono, fontSize:".65rem", color:"#6a5a35", letterSpacing:".2em", marginBottom:6 }}>TOP SENTINEL</div>
                    <div style={{ fontSize:"1rem", color:"#e0dcd4", lineHeight:1.7, fontWeight:400 }}>
                      {sci.sentinel || sci.summary}
                    </div>
                  </div>
                )}

                {/* LAYER 2: Impact Cards — system-by-system collision */}
                {(sci?.items?.length > 0 || dst?.collision_items?.length > 0) && (
                  <div>
                    <div style={{ ...S.mono, fontSize:".65rem", color:"#3a3832", letterSpacing:".2em", marginBottom:10 }}>IMPACT CARDS</div>
                    {WX_GROUPS.map(g => {
                      const sciItem = (sci?.items || []).find(it => normalizeEl(it.organ_system) === g.el);
                      const dstItem = (dst?.collision_items || []).find(it => normalizeEl(it.organ_wuxing) === g.el);
                      if (!sciItem && !dstItem) return null;
                      const coll = colls.find(c => c.el === g.el);
                      const isCritical = sciItem?.severity === "critical" || sciItem?.severity === "severe";

                      return (
                        <div key={g.el} style={{
                          ...S.card, padding:0, marginBottom:10, overflow:"hidden",
                          borderLeft:`3px solid ${EC[g.el]}`,
                          animation: isCritical ? "breathe 2s ease-in-out infinite" : "none",
                        }}>
                          {/* Card header */}
                          <div style={{
                            display:"flex", justifyContent:"space-between", alignItems:"center",
                            padding:"10px 16px", background:`linear-gradient(90deg, ${EC[g.el]}08, transparent)`,
                            borderBottom:`1px solid ${EC[g.el]}12`,
                          }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:"1.1rem", color:EC[g.el], fontWeight:600 }}>{locale==='en' ? elName(g.el) : g.el}</span>
                              <span style={{ fontSize:".85rem", color:"#9a9488" }}>{sysLabel(g.el)}</span>
                            </div>
                            {sciItem?.severity && (
                              <span style={{
                                ...S.mono, fontSize:".65rem", padding:"2px 8px",
                                background: isCritical ? "rgba(196,64,64,.1)" : "rgba(212,168,64,.1)",
                                color: isCritical ? "#c44040" : "#d4a840",
                                fontWeight:600,
                              }}>{sciItem.severity.toUpperCase()}</span>
                            )}
                          </div>

                          {/* Two-column: Science | Meta */}
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>
                            {/* Science Brain — Clinical */}
                            <div style={{ padding:"12px 16px", borderRight:"1px solid rgba(196,162,101,.06)" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
                                <div style={{ width:5, height:5, borderRadius:"50%", background:"#52b09a" }}/>
                                <span style={{ ...S.mono, fontSize:".62rem", color:"#52b09a", letterSpacing:".1em" }}>CLINICAL</span>
                              </div>
                              {sciItem ? (
                                <>
                                  <div style={{ fontSize:".85rem", color:"#d0ccc4", lineHeight:1.7, marginBottom:6, fontWeight: isCritical ? 600 : 400 }}>
                                    {expandedCards[g.el]
                                      ? (sciItem.clinical_fact || sciItem.physiological_analysis || '—')
                                      : (sciItem.clinical_fact || sciItem.physiological_analysis || '—').replace(/([.。！!？?])\s*/g, '$1|||').split('|||')[0]
                                    }
                                  </div>
                                  {expandedCards[g.el] && sciItem.recommendation && (
                                    <div style={{ fontSize:".88rem", color:"#52b09a", fontWeight:500, marginTop:6 }}>→ {sciItem.recommendation}</div>
                                  )}
                                </>
                              ) : <div style={{ fontSize:".8rem", color:"#3a3832" }}>—</div>}
                            </div>

                            {/* Meta Brain — Energetic */}
                            <div style={{ padding:"12px 16px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
                                <div style={{ width:5, height:5, borderRadius:"50%", background:"#c4a265" }}/>
                                <span style={{ ...S.mono, fontSize:".62rem", color:"#c4a265", letterSpacing:".1em" }}>ENERGETIC</span>
                              </div>
                              {dstItem ? (
                                <>
                                  <div style={{ fontSize:".85rem", color:"#d0ccc4", lineHeight:1.7, marginBottom:4 }}>
                                    {expandedCards[g.el]
                                      ? dstItem.current_forces
                                      : (dstItem.current_forces || '—').replace(/([.。！!？?])\s*/g, '$1|||').split('|||')[0]
                                    }
                                  </div>
                                  {expandedCards[g.el] && dstItem.risk_window && (
                                    <div style={{ fontSize:".75rem", color:"#d4a840", marginBottom:4 }}>⏱ {dstItem.risk_window}</div>
                                  )}
                                  {expandedCards[g.el] && dstItem.prevention && (
                                    <div style={{ fontSize:".88rem", color:"#c4a265", fontWeight:500, marginTop:6 }}>→ {dstItem.prevention}</div>
                                  )}
                                </>
                              ) : <div style={{ fontSize:".8rem", color:"#3a3832" }}>—</div>}
                            </div>
                          </div>

                          {/* Expand/Collapse toggle — always show */}
                          {(sciItem || dstItem) && (
                            <div
                              onClick={(e) => { e.stopPropagation(); setExpandedCards(prev => ({ ...prev, [g.el]: !prev[g.el] })); }}
                              style={{
                                padding:"8px 16px", cursor:"pointer", userSelect:"none",
                                borderTop:"1px solid rgba(196,162,101,.08)",
                                display:"flex", alignItems:"center", gap:6,
                                background: expandedCards[g.el] ? "rgba(196,162,101,.03)" : "transparent",
                                transition:"background .2s",
                              }}
                            >
                              <span style={{ ...S.mono, fontSize:".65rem", color: expandedCards[g.el] ? "#c4a265" : "#5e5a52", letterSpacing:".1em" }}>
                                {expandedCards[g.el] ? '▾' : '▸'} {locale==='en' ? (expandedCards[g.el] ? 'COLLAPSE' : 'FULL ANALYSIS') : (expandedCards[g.el] ? '收起' : '展开详情')}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* No data state */}
                {!sci && !dst && (
                  <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                    <div style={{ fontSize:"1rem", color:"#5e5a52", marginBottom:8 }}>{t('analysis.selectDimPrompt')}</div>
                    <div style={{ fontSize:".85rem", color:"#3a3832", lineHeight:1.7 }}>{t('analysis.selectDimDesc')}</div>
                  </div>
                )}

                {/* LAYER 3: Action Protocol — temporal + key dates */}
                {dst?.temporal_outlook && (
                  <div style={{ ...S.card }}>
                    <div style={{ ...S.mono, fontSize:".65rem", color:"#6a5a35", letterSpacing:".2em", marginBottom:8 }}>TEMPORAL OUTLOOK</div>
                    <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{dst.temporal_outlook}</div>
                  </div>
                )}

                {dst?.key_dates?.length > 0 && (
                  <div style={{ ...S.card }}>
                    <div style={{ ...S.mono, fontSize:".65rem", color:"#6a5a35", letterSpacing:".2em", marginBottom:8 }}>{t('analysis.keyDates').toUpperCase()}</div>
                    {dst.key_dates.map((d,i) => <div key={i} style={{ fontSize:".82rem", color:"#d4a840", marginBottom:5, lineHeight:1.6 }}>▪ {d}</div>)}
                  </div>
                )}

                {/* Methodology fold — BaZi details */}
                {dst?.bazi_analysis && (
                  <details style={{ ...S.card, cursor:"pointer" }}>
                    <summary style={{ ...S.mono, fontSize:".65rem", color:"#3a3832", letterSpacing:".15em", outline:"none", listStyle:"none" }}>
                      ▸ {locale==='en' ? 'VIEW METHODOLOGY' : '查看推演过程'}
                    </summary>
                    <div style={{ marginTop:10 }}>
                      {[
                        ["📋", "pillars", locale==='en'?"Pillars":"四柱"],
                        ["📐", "pattern", locale==='en'?"Pattern":"格局"],
                        ["🏥", "health_map", locale==='en'?"Health Map":"健康"],
                        ["📋", "pillars_detail", locale==='en'?"Pillars":"四柱"],
                        ["⚡", "tiangang_relations", locale==='en'?"Stems":"天干"],
                        ["🔄", "dizhi_relations", locale==='en'?"Branches":"地支"],
                        ["⭐", "shenshas", locale==='en'?"Stars":"神煞"],
                      ].map(([icon, key, label]) => dst.bazi_analysis[key] ? (
                        <div key={key} style={{ fontSize:".78rem", color:"#5e5a52", lineHeight:1.6, marginBottom:4, padding:"4px 8px", background:"rgba(196,162,101,.02)" }}>
                          <span style={{ color:"#6a5a35" }}>{icon} {label}:</span> {dst.bazi_analysis[key]}
                        </div>
                      ) : null)}
                    </div>
                  </details>
                )}

              </div>

              {/* Report buttons + Disclaimer */}
              {(sci || dst) && (
                <div style={{ gridColumn:"1 / -1", display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", gap:10 }}>
                    {sci && (
                      <button onClick={() => {
                        const now = new Date();
                        const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
                        generateLifeBlueprintPDF({
                          user: user.username, age, sex, bazi, dy, ln: targetLN,
                          sci, dst, metrics, med: medWX, dest: destWX, colls,
                          reportId: 'AS-' + Date.now().toString(36).toUpperCase(),
                          date: dateStr, RR_EN_SHORT, RR, gR,
                        }, locale);
                      }} style={{
                        ...S.btn, flex:1, fontSize:".85rem", padding:"10px 16px",
                        background:"linear-gradient(135deg, #2a4a3a, #52b09a)",
                      }}>
                        📋 {t('reports.scienceReport')} (PDF)
                      </button>
                    )}
                    {dst && (
                      <button onClick={() => {
                        const now = new Date();
                        const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
                        const weekDayNames = ["日","一","二","三","四","五","六"];
                        const weekDayNamesEn = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                        const days = Array.from({length:7}, (_, i) => {
                          const d = new Date(now.getTime() + i * 864e5);
                          const delta = Math.round((d - new Date(2000,0,7))/864e5);
                          const ds = SC[md(delta,10)], db = BC[md(delta,12)];
                          const dayEl = TG[ds][0];
                          const rel = dayEl===bazi.dme?"Companion":GEN[bazi.dme]===dayEl?"Output":CTL[bazi.dme]===dayEl?"Wealth":GEN[dayEl]===bazi.dme?"Resource":"Power";
                          const energy = dayEl===bazi.dme?90:GEN[dayEl]===bazi.dme?80:GEN[bazi.dme]===dayEl?60:CTL[dayEl]===bazi.dme?30:45;
                          return {
                            date:`${d.getMonth()+1}/${d.getDate()}`, weekday:weekDayNames[d.getDay()], weekdayEn:weekDayNamesEn[d.getDay()],
                            gan:ds, zhi:db, el:dayEl, rel, energy,
                            advice: energy>=80?"Advance":energy>=60?"Steady":"Guard",
                            organ: EO[dayEl],
                          };
                        });
                        generateWeeklyGuidePDF({ bazi, dy, ln: targetLN, date: dateStr, weekDays: days }, locale);
                      }} style={{
                        ...S.btn, flex:1, fontSize:".85rem", padding:"10px 16px",
                        background:"linear-gradient(135deg, #3a2a1a, #c4a265)",
                      }}>
                        ☯ {t('reports.destinyGuide')} (PDF)
                      </button>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <div style={{ padding:"12px 16px", background:"rgba(196,162,101,.02)", border:"1px solid rgba(196,162,101,.06)", fontSize:".72rem", color:"#4a4a44", lineHeight:1.7 }}>
                    <div style={{ ...S.mono, fontSize:".65rem", color:"#3a3832", marginBottom:4, letterSpacing:".1em" }}>{t('disclaimer.label')}</div>
                    <span style={{ color:"#52b09a" }}>Science Brain</span>: {t('disclaimer.science')}
                    <br/>
                    <span style={{ color:"#c4a265" }}>Meta Brain</span>: {t('disclaimer.meta')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ LIFE TUNING ══ */}
          {tab==="tuning" && (
            <div>
              {(sci?.items?.length > 0 || dst?.collision_items?.length > 0) ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  {/* Clinical Tuning — left brain */}
                  <div style={{ ...S.card, borderLeft:"3px solid #52b09a" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"#52b09a" }}/>
                      <div>
                        <div style={{ ...S.mono, fontSize:".85rem", color:"#52b09a" }}>{t('tuning.leftBrain')}</div>
                        <div style={{ fontSize:".75rem", color:"#3a3832", fontStyle:"italic" }}>{t('tuning.leftBrainSub')}</div>
                      </div>
                    </div>
                    {(sci?.items || []).filter(it => it.recommendation).map((it, i) => (
                      <div key={i} style={{ padding:"12px 14px", background:"#16161c", borderLeft:"2px solid #52b09a44", marginBottom:8, fontSize:".9rem", color:"#9a9488", lineHeight:1.8 }}>
                        <span style={{ color:"#52b09a", marginRight:8 }}>💊 {locale==='en' ? elName(normalizeEl(it.organ_system)) : normalizeEl(it.organ_system)}</span>
                        {it.recommendation}
                      </div>
                    ))}
                    {!(sci?.items || []).some(it => it.recommendation) && (
                      <div style={{ fontSize:".82rem", color:"#3a3832", padding:12 }}>{locale==='en' ? 'Run analysis to generate clinical recommendations.' : '运行分析以生成临床建议。'}</div>
                    )}
                  </div>

                  {/* Energetic Tuning — right brain */}
                  <div style={{ ...S.card, borderLeft:"3px solid #c4a265", position:"relative", overflow:"hidden" }}>
                    <svg viewBox="0 0 300 120" style={{ position:"absolute", right:0, bottom:0, width:280, height:100, opacity:.02, pointerEvents:"none" }}>
                      <path d="M0 120 Q30 60 60 80 Q90 40 120 70 Q150 20 180 50 Q210 10 240 40 Q270 30 300 60 L300 120Z" fill="#c4a265"/>
                      <path d="M0 120 Q40 80 80 95 Q120 60 160 85 Q200 50 240 75 Q280 60 300 80 L300 120Z" fill="#c4a265" opacity=".5"/>
                    </svg>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"#c4a265" }}/>
                      <div>
                        <div style={{ ...S.mono, fontSize:".85rem", color:"#c4a265" }}>{t('tuning.rightBrain')}</div>
                        <div style={{ fontSize:".75rem", color:"#3a3832", fontStyle:"italic" }}>{t('tuning.rightBrainSub')}</div>
                      </div>
                    </div>
                    {(dst?.collision_items || []).filter(it => it.prevention).map((it, i) => (
                      <div key={i} style={{ padding:"12px 14px", background:"#16161c", borderLeft:"2px solid #c4a26544", marginBottom:8, fontSize:".9rem", color:"#9a9488", lineHeight:1.8 }}>
                        <span style={{ color:"#c4a265", marginRight:8 }}>🛡 {locale==='en' ? elName(it.organ_wuxing) : it.organ_wuxing}</span>
                        {it.prevention}
                        {it.risk_window && <span style={{ fontSize:".75rem", color:"#d4a840", marginLeft:8 }}>({it.risk_window})</span>}
                      </div>
                    ))}
                    {!(dst?.collision_items || []).some(it => it.prevention) && (
                      <div style={{ fontSize:".82rem", color:"#3a3832", padding:12 }}>{locale==='en' ? 'Run analysis to generate energetic guidance.' : '运行分析以生成能量调谐建议。'}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:48, fontSize:".95rem", color:"#3a3832" }}>
                  {t('tuning.noData')}
                </div>
              )}

              {/* Key dates + temporal */}
              {dst?.temporal_outlook && (
                <div style={{ ...S.card, marginTop:16 }}>
                  <div style={{ ...S.mono, fontSize:".65rem", color:"#6a5a35", letterSpacing:".2em", marginBottom:8 }}>
                    {locale==='en' ? 'TEMPORAL RHYTHM' : '时间节律'}
                  </div>
                  <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.8 }}>{dst.temporal_outlook}</div>
                </div>
              )}
              {dst?.key_dates?.length > 0 && (
                <div style={{ ...S.card, marginTop:16 }}>
                  <div style={S.label}>{locale==='en' ? 'KEY TEMPORAL NODES' : '关键时间节点'}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                    {dst.key_dates.map((d, i) => (
                      <div key={i} style={{ padding:"10px 14px", background:"#16161c", borderLeft:"2px solid #d4a840", fontSize:".9rem", color:"#d4a840", lineHeight:1.7 }}>
                        📅 {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deep Dive — chart methodology */}
              {dst?.bazi_analysis && (
                <details style={{ ...S.card, cursor:"pointer", marginTop:16 }}>
                  <summary style={{ 
                    ...S.mono, fontSize:".7rem", color:"#6a5a35", letterSpacing:".15em", 
                    outline:"none", listStyle:"none", padding:"4px 0",
                  }}>
                    ▸ {locale==='en' ? 'DEEP DIVE · CHART METHODOLOGY' : '深层推演 · 命盘推导'}
                  </summary>
                  <div style={{ marginTop:12 }}>
                    {[
                      ["📋", "pillars", locale==='en'?"Pillars":"四柱"],
                      ["📐", "pattern", locale==='en'?"Pattern":"格局"],
                      ["🏥", "health_map", locale==='en'?"Health Map":"健康地图"],
                    ].map(([icon, key, label]) => dst.bazi_analysis[key] ? (
                      <div key={key} style={{ fontSize:".82rem", color:"#9a9488", lineHeight:1.7, marginBottom:6, padding:"6px 10px", background:"rgba(196,162,101,.02)", borderLeft:"2px solid rgba(196,162,101,.08)" }}>
                        <span style={{ color:"#c4a265", fontWeight:600 }}>{icon} {label}:</span> {dst.bazi_analysis[key]}
                      </div>
                    ) : null)}
                  </div>
                </details>
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
                                width:74, background:"#0c0c0f", padding:"6px 4px", outline:"none", textAlign:"center",
                                ...S.mono, fontSize:"1.1rem", borderRadius:2,
                                color: !hasVal ? "#6a6560" : inR ? "#f0ece4" : "#c44040",
                                border: isAnom ? "1px solid rgba(196,64,64,0.5)" : "1px solid rgba(196,162,101,.12)",
                                animation: isAnom ? "breathe 2s ease-in-out infinite" : "none",
                              }}
                            />
                            {/* Unit + status */}
                            <div style={{ width:48, textAlign:"right" }}>
                              <div style={{ ...S.mono, fontSize:".62rem", color:"#4a4a44" }}>{ref.u}</div>
                              {hasVal && (
                                <div style={{ ...S.mono, fontSize:".6rem", color: inR ? "#52b09a" : "#c44040" }}>
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

      {/* MOBILE BOTTOM TAB BAR */}
      {isMobile && (
      <div style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:50,
        background:"rgba(8,8,10,.96)", backdropFilter:"blur(16px)",
        borderTop:"1px solid rgba(196,162,101,.1)",
        paddingBottom:"env(safe-area-inset-bottom)",
        display:"flex",
      }}>
        {[
          { id:"radar", icon:"⚡", lb:locale==='en'?"Insights":"洞察" },
          { id:"tuning", icon:"📆", lb:locale==='en'?"Daily":"日程" },
          { id:"chat", icon:"💬", lb:locale==='en'?"Chat":"对话" },
          { id:"upload", icon:"📄", lb:locale==='en'?"Data":"数据" },
        ].map(item => (
          <button key={item.id} onClick={()=>setTab(item.id)} style={{
            flex:1, background:"none", border:"none", padding:"10px 4px 8px",
            display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            color: tab===item.id ? "#c4a265" : "#5e5a52",
            borderTop: tab===item.id ? "1.5px solid #c4a265" : "1.5px solid transparent",
            cursor:"pointer", fontFamily:"'Noto Serif SC',serif", transition:"all .2s",
          }}>
            <span style={{ fontSize:20, opacity: tab===item.id ? 1 : .6 }}>{item.icon}</span>
            <span style={{ fontSize:10, letterSpacing:.5 }}>{item.lb}</span>
          </button>
        ))}
      </div>
      )}

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
          50% { transform:translateX(350%); }
          100% { transform:translateX(-100%); }
        }
        @keyframes ringBreathe {
          0%,100% { transform:scale(0.92); opacity:0.3; }
          50% { transform:scale(1.08); opacity:0.6; }
        }
        @keyframes coreBreathe {
          0%,100% { transform:scale(0.8); opacity:0.3; }
          25% { transform:scale(1.6); opacity:0.7; }
          50% { transform:scale(1.2); opacity:0.5; }
          75% { transform:scale(1.6); opacity:0.7; }
        }
        @keyframes orbit {
          from { transform:rotate(0deg); }
          to { transform:rotate(360deg); }
        }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#6a5a35; border-radius:2px; }
        input[type=number]::-webkit-inner-spin-button { opacity:.3; }

        /* Mobile bottom tab bar — hidden on desktop */
        .as-mobile-tabbar {
          display: none;
        }

        @media(max-width: 1024px) {
          /* Hide desktop-only elements */
          .as-desktop-only { display: none !important; }
          .as-sidebar { display: none !important; }

          /* Show mobile summary strip */
          .as-mobile-strip { display: block !important; }

          /* Main content: adjust padding, add bottom space for tab bar */
          .as-main-content {
            padding: 14px 16px calc(90px + env(safe-area-inset-bottom)) 16px !important;
            gap: 12px !important;
          }
          .as-main-wrap {
            min-height: calc(100vh - 56px) !important;
          }

          /* Collapse all grid layouts to single column */
          .as-main-grid { grid-template-columns: 1fr !important; }
          .as-impact-grid { grid-template-columns: 1fr !important; }

          /* Global: force single column for all 2-column grids in main content */
          .as-main-content [style*="gridTemplateColumns"][style*="1fr 1fr"],
          .as-main-content [style*="grid-template-columns"][style*="1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          .as-main-content [style*="gridTemplateColumns"][style*="360px"],
          .as-main-content [style*="grid-template-columns"][style*="360px"] {
            grid-template-columns: 1fr !important;
          }

          /* Bottom tab bar — fixed, safe area aware */
          .as-mobile-tabbar {
            display: flex !important;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            background: rgba(8,8,10,.96);
            backdrop-filter: blur(16px);
            border-top: 1px solid rgba(196,162,101,.1);
            padding-bottom: env(safe-area-inset-bottom);
          }

          /* Bump up base font sizes on mobile */
          body { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
