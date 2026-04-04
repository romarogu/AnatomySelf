import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiOCR, apiScience, apiDestiny, apiRegister, apiLogin, apiSaveUser } from "./api.js";

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

function applyTemp(base, dy, ln) {
  const m = {...base};
  m[dy.el]=(m[dy.el]||0)+2; m[CTL[dy.el]]=Math.max(.1,(m[CTL[dy.el]]||0)-1.5); m[GEN[dy.el]]=(m[GEN[dy.el]]||0)+.8;
  m[ln.el]=(m[ln.el]||0)+1; m[CTL[ln.el]]=Math.max(.1,(m[CTL[ln.el]]||0)-.8);
  const t = Object.values(m).reduce((a,b)=>a+b,0);
  if (t>0) Object.keys(m).forEach(k => m[k]=Math.round(m[k]/t*1000)/10);
  return m;
}

// ════════════════════════════════════════
// MEDICAL REFERENCES
// ════════════════════════════════════════
const RR = {
  RHR:{u:"bpm",cn:"静息心率",o:"火",r:[{a1:0,a2:12,s:"A",l:70,h:120,n:"儿童心率高于成人"},{a1:13,a2:17,s:"A",l:60,h:100,n:"青春期心脏发育中"},{a1:18,a2:59,s:"A",l:60,h:100,n:"成人标准"},{a1:60,a2:120,s:"A",l:60,h:100,n:"老年窦房结退行性改变"}]},
  ALT:{u:"U/L",cn:"谷丙转氨酶",o:"木",r:[{a1:0,a2:12,s:"A",l:5,h:30,n:"儿童肝脏酶基线低"},{a1:13,a2:17,s:"M",l:7,h:35,n:"青春期男性轻度升高属正常"},{a1:13,a2:17,s:"F",l:5,h:30,n:"青春期女性雌激素保护肝脏"},{a1:18,a2:59,s:"M",l:7,h:40,n:"成年男性标准"},{a1:18,a2:59,s:"F",l:7,h:35,n:"成年女性上限略低"},{a1:60,a2:120,s:"A",l:5,h:40,n:"老年肝代谢下降"}]},
  FBG:{u:"mmol/L",cn:"空腹血糖",o:"土",r:[{a1:0,a2:12,s:"A",l:3.3,h:5.6,n:"儿童低血糖阈值更低"},{a1:13,a2:17,s:"A",l:3.9,h:5.8,n:"青春期生长激素旺盛"},{a1:18,a2:59,s:"A",l:3.9,h:6.1,n:"成人标准"},{a1:60,a2:120,s:"A",l:4,h:6.5,n:"老年人上限放宽"}]},
  FVC:{u:"L",cn:"肺活量",o:"金",r:[{a1:0,a2:12,s:"A",l:.5,h:2.5,n:"儿童肺泡发育中"},{a1:13,a2:17,s:"M",l:2.5,h:5,n:"青春期男性胸廓发育"},{a1:13,a2:17,s:"F",l:2,h:4,n:"青春期女性肺活量低于男性"},{a1:18,a2:59,s:"M",l:3,h:5.5,n:"成年男性峰值期"},{a1:18,a2:59,s:"F",l:2.5,h:4.5,n:"成年女性标准"},{a1:60,a2:120,s:"A",l:2,h:4,n:"老年肺弹性下降"}]},
  Cr:{u:"μmol/L",cn:"肌酐",o:"水",r:[{a1:0,a2:12,s:"A",l:20,h:60,n:"儿童肌肉量少"},{a1:13,a2:17,s:"M",l:40,h:90,n:"青春期男性肌肉增长"},{a1:13,a2:17,s:"F",l:35,h:80,n:"青春期女性肌肉增长较小"},{a1:18,a2:59,s:"M",l:57,h:111,n:"成年男性标准"},{a1:18,a2:59,s:"F",l:44,h:97,n:"成年女性标准"},{a1:60,a2:120,s:"A",l:44,h:106,n:"老年肌肉萎缩"}]},
  BP:{u:"mmHg",cn:"收缩压",o:"火",r:[{a1:0,a2:17,s:"A",l:85,h:120,n:"青少年血压波动大"},{a1:18,a2:59,s:"A",l:90,h:120,n:"成人标准"},{a1:60,a2:120,s:"A",l:90,h:140,n:"老年动脉硬化"}]},
  TC:{u:"mmol/L",cn:"总胆固醇",o:"土",r:[{a1:0,a2:17,s:"A",l:2.8,h:5,n:"儿童青少年标准"},{a1:18,a2:59,s:"A",l:3,h:5.2,n:"成人标准"},{a1:60,a2:120,s:"A",l:3,h:5.6,n:"老年人放宽"}]}
};

function gR(k,age,sex) {
  const sp=RR[k]; if(!sp) return null;
  let best=null;
  for (const r of sp.r) { if(age>=r.a1&&age<=r.a2&&(r.s==="A"||r.s===sex)){best=r;break;} if(age>=r.a1&&age<=r.a2&&r.s==="A"&&!best)best=r; }
  if(!best) best=sp.r[sp.r.length-1];
  return {l:best.l,h:best.h,n:best.n,u:sp.u,cn:sp.cn,o:sp.o};
}

function oScore(ms,organ,age,sex) {
  const om=ms.filter(m=>RR[m.key]&&RR[m.key].o===organ); if(!om.length) return 50;
  const scores=om.map(m=>{const r=gR(m.key,age,sex);if(!r)return 50;const mid=(r.l+r.h)/2,half=(r.h-r.l)/2;if(half<=0)return 50;if(m.value<r.l)return Math.max(0,50-((r.l-m.value)/half)*40);if(m.value>r.h)return Math.max(0,50-((m.value-r.h)/half)*40);return 100-(Math.abs(m.value-mid)/half)*40;});
  return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10;
}

function calcColls(med,dest) {
  return ["火","土","金","水","木"].map(el=>{
    const ms=med[el]||50,ds=dest[el]||50,dv=Math.abs(ms-ds);
    const corr=(ms<50&&ds<50)?Math.min(100,100-dv+20):Math.max(0,100-dv*1.5);
    const lv=(dv>30||(ms<45&&ds<40))?"alert":(dv>15||ms<55)?"caution":"optimal";
    return {el,med:Math.round(ms*10)/10,dest:Math.round(ds*10)/10,dv:Math.round(dv*10)/10,corr:Math.round(corr*10)/10,lv};
  });
}

// AI calls now go through Express backend at /api/* — see server/index.js
// Frontend uses src/api.js (apiOCR, apiScience, apiDestiny)

// ════════════════════════════════════════
// RADAR COMPONENT
// ════════════════════════════════════════
function RadarChart({ med, dest, colls }) {
  const cx=150,cy=150,r=110,angs=[-90,-18,54,126,198],order=["火","土","金","水","木"];
  const lbls=[["火·心","#c45a30"],["土·脾","#a08a50"],["金·肺","#9898a8"],["水·肾","#3a6a9a"],["木·肝","#4a8a4a"]];
  const xy = (a,rd) => [cx+rd*Math.cos(a*Math.PI/180), cy+rd*Math.sin(a*Math.PI/180)];
  const mP = order.map((e,i) => xy(angs[i], r*(med[e]||50)/100));
  const dP = order.map((e,i) => xy(angs[i], r*(dest[e]||50)/100));

  return (
    <svg viewBox="0 0 300 300" style={{width:"100%",maxWidth:300,margin:"0 auto",display:"block"}}>
      {[1,.75,.5,.25].map((s,i) => <polygon key={i} points={angs.map(a=>xy(a,r*s).join(",")).join(" ")} fill="none" stroke="rgba(196,162,101,0.08)" strokeWidth=".5"/>)}
      {angs.map((a,i) => {const[x,y]=xy(a,r);return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(196,162,101,0.06)" strokeWidth=".5"/>;})}
      <polygon points={dP.map(p=>p.join(",")).join(" ")} fill="rgba(196,162,101,0.07)" stroke="#c4a265" strokeWidth="1.2" opacity=".75"/>
      <polygon points={mP.map(p=>p.join(",")).join(" ")} fill="rgba(224,220,212,0.05)" stroke="#e0dcd4" strokeWidth="1" strokeDasharray="5 3" opacity=".55"/>
      {lbls.map(([l,c],i) => {const[x,y]=xy(angs[i],r+20);return <text key={i} x={x} y={y+(angs[i]>0&&angs[i]<180?4:0)} textAnchor="middle" fontSize="11" fill={c} fontFamily="'Noto Serif SC',serif">{l}</text>;})}
      {colls.filter(c=>c.lv==="alert").map((c,i) => {const idx=order.indexOf(c.el);const[x,y]=xy(angs[idx],r*Math.max(c.med,c.dest)/100);return <g key={i}><circle cx={x} cy={y} r="12" fill="none" stroke="#c44040" strokeWidth="1.5" strokeDasharray="3 3" opacity=".5"><animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite"/></circle></g>;})}
      {dP.map(([x,y],i) => <circle key={"d"+i} cx={x} cy={y} r="3.5" fill="#c4a265" opacity=".8"/>)}
      {mP.map(([x,y],i) => <circle key={"m"+i} cx={x} cy={y} r="3" fill="#e0dcd4" opacity=".6"/>)}
      <circle cx={cx} cy={cy} r="6" fill="#1a1a22" stroke="rgba(196,162,101,0.3)" strokeWidth=".5"/>
      <text x={cx} y={cy+3.5} textAnchor="middle" fontSize="8" fill="#c4a265" opacity=".5" fontFamily="'Noto Serif SC',serif">撞</text>
    </svg>
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
const sL = {alert:"预警",caution:"观察",optimal:"稳定"};

// ════════════════════════════════════════
// DEMO DATA
// ════════════════════════════════════════
const INIT_M = [{key:"RHR",value:68},{key:"ALT",value:52},{key:"FBG",value:5.2},{key:"FVC",value:3.1},{key:"Cr",value:82},{key:"BP",value:126},{key:"TC",value:4.8}];

// ════════════════════════════════════════
// LOGIN / REGISTER SCREEN
// ════════════════════════════════════════
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) { setError("请填写用户名和密码"); return; }
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
    } catch (err) { setError("网络错误: " + err.message); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Serif SC',serif",
      backgroundImage:"linear-gradient(rgba(196,162,101,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }}>
      <div style={{ width:420, padding:48, background:"#0f1014", border:"1px solid rgba(196,162,101,0.1)" }}>
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
          <div style={{ fontSize:"0.85rem", color:"#5e5a52", letterSpacing:".3em", marginTop:4 }}>个 人 生 命 实 验 室</div>
        </div>

        {/* Toggle */}
        <div style={{ display:"flex", marginBottom:28, border:"1px solid rgba(196,162,101,0.1)" }}>
          {[["login","登录"],["register","注册"]].map(([m,l]) => (
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
            <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>用户名</div>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="请输入用户名"
              style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          <div>
            <div style={{ fontSize:"0.85rem", color:"#9a9488", marginBottom:6 }}>密码</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="请输入密码"
              style={S.input} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          {error && <div style={{ fontSize:"0.85rem", color:"#c44040", padding:"8px 12px", background:"rgba(196,64,64,0.06)", border:"1px solid rgba(196,64,64,0.15)" }}>{error}</div>}
          <button onClick={handleSubmit} style={{...S.btn, width:"100%", marginTop:8}}>
            {mode==="login"?"登录 · Enter":"注册新账户"}
          </button>
        </div>

        <div style={{ textAlign:"center", marginTop:24, fontSize:"0.8rem", color:"#3a3832", fontStyle:"italic", fontFamily:"'Cormorant Garamond',serif" }}>
          Where anatomical precision meets celestial cartography
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

  const handleLogout = useCallback(() => { setUser(null); setSetupDone(false); }, []);

  // Show auth screen
  if (!user) return <AuthScreen onLogin={handleLogin} />;
  if (!setupDone) return <BirthSetup user={user} onSave={handleBirthSave} />;

  return <Dashboard user={user} setUser={setUser} onLogout={handleLogout} />;
}

// ════════════════════════════════════════
// DASHBOARD (post-login)
// ════════════════════════════════════════
function Dashboard({ user, setUser, onLogout }) {
  const [metrics, setMetrics] = useState(user.metrics || INIT_M);
  const [file, setFile] = useState(null);
  const [ocr, setOcr] = useState(null);
  const [ocrL, setOcrL] = useState(false);
  const [sci, setSci] = useState(null);
  const [sciL, setSciL] = useState(false);
  const [dst, setDst] = useState(null);
  const [dstL, setDstL] = useState(false);
  const [tab, setTab] = useState("upload");
  const [pipe, setPipe] = useState([{lb:"上传",st:"idle"},{lb:"OCR",st:"idle"},{lb:"科学脑",st:"idle"},{lb:"命理脑",st:"idle"}]);
  const fileRef = useRef(null);

  const by=user.birthYear, bm=user.birthMonth, bd=user.birthDay, bh=user.birthHour, sex=user.sex;

  const age = useMemo(() => {
    const t=new Date(); let a=t.getFullYear()-by;
    if(t.getMonth()+1<bm||(t.getMonth()+1===bm&&t.getDate()<bd)) a--;
    return Math.max(0,a);
  }, [by,bm,bd]);

  const bazi = useMemo(()=>calcBazi(by,bm,bd,bh), [by,bm,bd,bh]);
  const dy = useMemo(()=>calcDY(bazi,age,sex), [bazi,age,sex]);
  const ln = useMemo(()=>calcLN(new Date().getFullYear()), []);
  const destWX = useMemo(()=>applyTemp(calcWX(bazi),dy,ln), [bazi,dy,ln]);
  const medWX = useMemo(()=>{const r={};["木","火","土","金","水"].forEach(e=>r[e]=oScore(metrics,e,age,sex));return r;}, [metrics,age,sex]);
  const colls = useMemo(()=>calcColls(medWX,destWX), [medWX,destWX]);
  const anoms = useMemo(()=>metrics.filter(m=>{const r=gR(m.key,age,sex);return r&&(m.value<r.l||m.value>r.h);}).map(m=>({...m,ref:gR(m.key,age,sex),st:m.value>(gR(m.key,age,sex)?.h||999)?"偏高":"偏低"})), [metrics,age,sex]);

  const pls = [{lb:"年柱",s:bazi.year[0],b:bazi.year[1]},{lb:"月柱",s:bazi.month[0],b:bazi.month[1]},{lb:"日柱",s:bazi.day[0],b:bazi.day[1]},{lb:"时柱",s:bazi.hour[0],b:bazi.hour[1]}];
  const baziStr = pls.map(p=>p.s+p.b).join(" ");

  // Save metrics to storage
  const saveData = useCallback(async (newMetrics) => {
    const updated = {...user, metrics: newMetrics};
    setUser(updated);
    try { if (user.userId) await apiSaveUser(user.userId, updated); } catch {}
  }, [user, setUser]);

  const updateMetric = useCallback((key, value) => {
    const newM = metrics.map(m => m.key===key ? {...m, value:parseFloat(value)||0} : m);
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
      setOcr(res); setPipe(p=>p.map((s,i)=>i===1?{...s,st:"done"}:s));
      if(res.metrics?.length) {
        const ks=Object.keys(RR);
        const newM=[...metrics];
        res.metrics.filter(m=>m.value!=null).forEach(m=>{const code=ks.find(k=>k===m.code)||m.code;const idx=newM.findIndex(x=>x.key===code);if(idx>=0)newM[idx]={...newM[idx],value:m.value};else newM.push({key:code,value:m.value});});
        setMetrics(newM); saveData(newM);
      }
    } catch(err) { setOcr({error:err.message}); setPipe(p=>p.map((s,i)=>i===1?{...s,st:"idle"}:s)); }
    setOcrL(false);
  }, [metrics, saveData]);

  // ── SCIENCE BRAIN ──
  const doSci = useCallback(async () => {
    if (!anoms.length) { setSci({ items: [], summary: "所有指标均在正常范围内，无需科学解读。" }); setPipe(p=>p.map((s,i)=>i===2?{...s,st:"done"}:s)); return; }
    setSciL(true); setSci(null); setPipe(p=>p.map((s,i)=>i===2?{...s,st:"running"}:s));
    try {
      const anomalyData = anoms.map(a => ({ key: a.key, cn: a.ref.cn, value: a.value, unit: a.ref.u, low: a.ref.l, high: a.ref.h, status: a.st }));
      const res = await apiScience({ age, sex, anomalies: anomalyData });
      setSci(res);
      setPipe(p=>p.map((s,i)=>i===2?{...s,st:"done"}:s));
    } catch (err) {
      setSci({ items: [], summary: "科学大脑分析失败: " + err.message });
      setPipe(p=>p.map((s,i)=>i===2?{...s,st:"idle"}:s));
    }
    setSciL(false);
  }, [anoms, age, sex]);

  // ── DESTINY BRAIN ──
  const doDst = useCallback(async () => {
    if (!anoms.length && (!sci || !sci.items || !sci.items.length)) {
      setDst({ collision_items: [], temporal_outlook: "无异常指标，无需命理对撞。" });
      setPipe(p=>p.map((s,i)=>i===3?{...s,st:"done"}:s)); return;
    }
    setDstL(true); setDst(null); setPipe(p=>p.map((s,i)=>i===3?{...s,st:"running"}:s));

    let findings;
    if (sci && sci.items && sci.items.length > 0) {
      findings = sci.items.map(it => it.metric_cn + "(" + it.organ_system + "): " + it.physiological_analysis).join("\n");
    } else {
      findings = anoms.map(a => a.ref.cn + "(" + a.ref.o + "): " + a.key + "=" + a.value + a.ref.u + " " + a.st).join("\n");
    }

    try {
      const res = await apiDestiny({
        baziStr, dayMaster: bazi.dm, dayMasterElement: bazi.dme,
        dayun: dy, liunian: ln, wuxing: destWX, findings
      });
      setDst(res);
      setPipe(p=>p.map((s,i)=>i===3?{...s,st:"done"}:s));
    } catch (err) {
      setDst({ collision_items: [], temporal_outlook: "命理大脑分析失败: " + err.message, bazi_analysis: null });
      setPipe(p=>p.map((s,i)=>i===3?{...s,st:"idle"}:s));
    }
    setDstL(false);
  }, [sci, anoms, baziStr, bazi, dy, ln, destWX]);

  useEffect(() => {
    // Auto-trigger destiny brain when science completes
    // Trigger if: sci exists AND (has items OR has summary) AND destiny not yet started
    if (sci && !dst && !dstL) {
      if ((sci.items && sci.items.length > 0) || sci.summary) {
        doDst();
      }
    }
  }, [sci, dst, dstL, doDst]);

  const tabs = [{id:"upload",lb:"📄 数据中心"},{id:"radar",lb:"⚡ 对撞雷达"},{id:"insights",lb:"🧠 双脑洞察"},{id:"metrics",lb:"📊 体检指标"}];

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", color:"#e0dcd4", fontFamily:"'Noto Serif SC',serif", fontSize:"14px",
      backgroundImage:"linear-gradient(rgba(196,162,101,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.015) 1px,transparent 1px)", backgroundSize:"60px 60px" }}>

      {/* HEADER */}
      <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(196,162,101,.08)", background:"rgba(8,8,10,.92)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <svg viewBox="0 0 28 28" width="22" height="22" fill="none"><circle cx="14" cy="14" r="13" stroke="#c4a265" strokeWidth=".5" opacity=".4"/><circle cx="14" cy="10" r="2.5" stroke="#e0dcd4" strokeWidth=".4" opacity=".4"/><path d="M14 12.5L14 22M14 16L10 19M14 16L18 19" stroke="#e0dcd4" strokeWidth=".4" opacity=".4"/></svg>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:"1rem", letterSpacing:".12em" }}>ANATOMYSELF</div>
            <div style={{ fontSize:".65rem", color:"#5e5a52", letterSpacing:".2em" }}>双模型解耦 · DUAL-BRAIN</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
            {pls.map(p => <div key={p.lb} style={{ textAlign:"center", padding:"2px 5px", background:"#16161c", border:"1px solid rgba(196,162,101,.06)" }}>
              <div style={{ fontSize:".8rem", color:"#e0dcd4", lineHeight:1.1 }}>{p.s}{p.b}</div>
            </div>)}
          </div>
          <span style={{ ...S.mono, fontSize:".75rem", color:"#5e5a52" }}>{user.username} · {age}岁</span>
          <button onClick={onLogout} style={{ background:"transparent", border:"1px solid rgba(196,162,101,.12)", color:"#5e5a52", padding:"4px 12px", fontSize:".8rem", cursor:"pointer", fontFamily:"'Noto Serif SC',serif" }}>退出</button>
        </div>
      </div>

      <div style={{ display:"flex", minHeight:"calc(100vh - 50px)" }}>
        {/* SIDEBAR */}
        <div style={{ width:220, minWidth:220, background:"#0c0c0f", borderRight:"1px solid rgba(196,162,101,.08)", padding:"16px 14px", display:"flex", flexDirection:"column", gap:12, overflowY:"auto" }}>
          <div style={S.label}>用户信息</div>
          <div style={{ fontSize:".85rem", color:"#9a9488" }}>
            {by}年{bm}月{bd}日 {bh}时<br/>
            {sex==="M"?"男":"女"}性 · {age}岁<br/>
            日主：<span style={{color:EC[bazi.dme]}}>{bazi.dm}({bazi.dme})</span>
          </div>

          <div style={{ borderTop:"1px solid rgba(196,162,101,.06)", paddingTop:10 }}>
            <div style={S.label}>五脏速扫</div>
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
              <div style={{ ...S.mono, fontSize:".72rem", color:"#c44040", letterSpacing:".1em" }}>⚠ 异常 {anoms.length} 项</div>
              {anoms.map(a => <div key={a.key} style={{ fontSize:".8rem", color:"#c44040", marginTop:3 }}>{a.ref.cn} {a.st}</div>)}
            </div>
          )}

          <div style={{ borderTop:"1px solid rgba(196,162,101,.06)", paddingTop:8 }}>
            <div style={S.label}>大运·流年</div>
            <div style={{ fontSize:".85rem", color:"#9a9488" }}>
              大运：<span style={{color:EC[dy.el]}}>{dy.lbl}({dy.el})</span><br/>
              流年：<span style={{color:EC[ln.el]}}>{ln.lbl}({ln.el})</span>
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
                  <div style={S.label}>步骤1 · 文件导入</div>
                  <div onClick={()=>fileRef.current?.click()} style={{
                    border:"1px dashed rgba(196,162,101,.2)", padding:"36px 20px", textAlign:"center",
                    cursor:"pointer", background:file?"rgba(82,176,154,.04)":"transparent", marginTop:10, transition:"all .3s"
                  }}>
                    <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={doOCR} style={{ display:"none" }}/>
                    {file ? (
                      <div><div style={{ fontSize:"1rem", color:"#52b09a" }}>✓ {file.name}</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>{(file.size/1024).toFixed(1)}KB · 点击更换</div></div>
                    ) : (
                      <div><div style={{ fontSize:"2rem", color:"#6a5a35", marginBottom:8 }}>⬆</div><div style={{ fontSize:".95rem", color:"#9a9488" }}>上传体检报告</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>支持 PDF / PNG / JPG</div></div>
                    )}
                  </div>
                  {ocrL && <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:12, height:12, border:"2px solid #c4a265", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
                    <span style={{ fontSize:".85rem", color:"#c4a265" }}>多模态 OCR 提取中...</span>
                  </div>}
                </div>

                {/* OCR result */}
                <div style={S.card}>
                  <div style={S.label}>步骤2 · OCR 结果</div>
                  {ocr ? (
                    <div style={{ marginTop:10 }}>
                      {ocr.error && <div style={{ fontSize:".85rem", color:"#d4a840", marginBottom:8 }}>⚠ {ocr.error}</div>}
                      {ocr._raw && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.6 }}>{String(ocr._raw).substring(0,400)}</div>}
                      {ocr.metrics?.map((m,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:"#16161c", marginBottom:4 }}>
                          <span style={{ fontSize:".9rem", color:"#e0dcd4" }}>{m.name} <span style={{ fontSize:".75rem", color:"#5e5a52" }}>{m.code}</span></span>
                          <span style={{ ...S.mono, fontSize:".9rem", color:"#f0ece4" }}>{m.value} <span style={{ fontSize:".75rem", color:"#5e5a52" }}>{m.unit}</span></span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize:".85rem", color:"#3a3832", textAlign:"center", padding:20, marginTop:10 }}>等待上传...</div>}
                </div>
              </div>

              <div style={{ marginTop:16, display:"flex", gap:12, alignItems:"center" }}>
                <button onClick={async()=>{setPipe(p=>p.map((s,i)=>i>=2?{...s,st:"idle"}:s));await doSci();}} disabled={sciL||dstL}
                  style={{ ...S.btn, opacity:sciL||dstL?.5:1, cursor:sciL||dstL?"wait":"pointer" }}>
                  {sciL?"⏳ 科学大脑分析中...":dstL?"⏳ 命理大脑对撞中...":"⚡ 启动双脑对撞分析"}
                </button>
                <span style={{ fontSize:".85rem", color:"#5e5a52" }}>{anoms.length} 个异常项待分析</span>
              </div>

              {/* Editable metrics */}
              <div style={{ ...S.card, marginTop:16 }}>
                <div style={S.label}>当前指标（可直接调整数值）</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:6, marginTop:10 }}>
                  {metrics.map(m => {
                    const ref = gR(m.key,age,sex); const ok2 = ref && m.value>=ref.l && m.value<=ref.h;
                    return (
                      <div key={m.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#16161c", borderLeft:`2px solid ${ref?EC[ref.o]:"#5e5a52"}` }}>
                        <span style={{ fontSize:".85rem", color:"#9a9488", width:60 }}>{ref?.cn||m.key}</span>
                        <input type="number" value={m.value} step="0.1" onChange={e=>updateMetric(m.key,e.target.value)}
                          style={{ width:64, background:"#0c0c0f", border:"1px solid rgba(196,162,101,.08)", color:ok2?"#f0ece4":"#c44040", padding:"4px 6px", ...S.mono, fontSize:".9rem", outline:"none", textAlign:"center" }}/>
                        <span style={{ fontSize:".72rem", color:"#3a3832" }}>{ref?.u}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ RADAR ══ */}
          {tab==="radar" && (
            <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:16 }}>
              <div style={S.card}>
                <div style={S.label}>对撞共振雷达</div>
                <RadarChart med={medWX} dest={destWX} colls={colls}/>
                <div style={{ display:"flex", gap:14, justifyContent:"center", marginTop:10, fontSize:".8rem" }}>
                  <span style={{ color:"#c4a265" }}>● 命理层</span><span style={{ color:"#e0dcd4" }}>◌ 医学层</span><span style={{ color:"#c44040" }}>◎ 偏差</span>
                </div>
                {colls.map(c => (
                  <div key={c.el} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderLeft:`2px solid ${sC[c.lv]}`, background:"#16161c", marginTop:5 }}>
                    <span style={{ fontSize:".9rem", color:"#e0dcd4" }}>{c.el} {EO[c.el]}</span>
                    <span style={{ ...S.mono, fontSize:".75rem", color:sC[c.lv] }}>{sL[c.lv]} {c.corr}%</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {/* Science brain */}
                <div style={{ ...S.card, borderColor:"rgba(82,176,154,.12)", flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#52b09a" }}/>
                    <span style={{ ...S.mono, fontSize:".8rem", color:"#52b09a", letterSpacing:".15em" }}>科学大脑 SCIENCE</span>
                    {sciL && <div style={{ width:12, height:12, border:"2px solid #52b09a", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite", marginLeft:"auto" }}/>}
                  </div>
                  {sci?.items?.length ? sci.items.map((it,i) => (
                    <div key={i} style={{ padding:"10px 12px", background:"#16161c", borderLeft:"2px solid " + (EC[it.organ_system]||"#52b09a"), marginBottom:6 }}>
                      <div style={{ fontSize:".95rem", color:"#e0dcd4", marginBottom:4 }}>{it.metric_cn}</div>
                      <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{it.physiological_analysis}</div>
                      <div style={{ fontSize:".8rem", color:"#52b09a", marginTop:4 }}>💡 {it.recommendation}</div>
                    </div>
                  )) : sci?.summary ? (
                    <div style={{ fontSize:".85rem", color:"#9a9488", padding:12, lineHeight:1.7 }}>{sci.summary}</div>
                  ) : sci?._raw ? (
                    <div style={{ fontSize:".85rem", color:"#9a9488", padding:12, lineHeight:1.7 }}>{String(sci._raw).substring(0,500)}</div>
                  ) : <div style={{ fontSize:".85rem", color:"#3a3832", textAlign:"center", padding:16 }}>在数据中心启动分析</div>}
                </div>
                {/* Destiny brain */}
                <div style={{ ...S.card, borderColor:"rgba(196,162,101,.12)", flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#c4a265" }}/>
                    <span style={{ ...S.mono, fontSize:".8rem", color:"#c4a265", letterSpacing:".15em" }}>命理大脑 DESTINY</span>
                    {dstL && <div style={{ width:12, height:12, border:"2px solid #c4a265", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite", marginLeft:"auto" }}/>}
                  </div>
                  {dst?.collision_items?.length ? dst.collision_items.map((it,i) => (
                    <div key={i} style={{ padding:"10px 12px", background:"#16161c", borderLeft:"2px solid " + (EC[it.organ_wuxing]||"#c4a265"), marginBottom:6 }}>
                      <div style={{ fontSize:".95rem", color:"#e0dcd4", marginBottom:4 }}>{it.organ_wuxing} {EO[it.organ_wuxing]} <span style={{ ...S.mono, fontSize:".72rem", color:"#d4a840" }}>{it.risk_window}</span></div>
                      <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{it.current_forces}</div>
                      <div style={{ fontSize:".8rem", color:"#c4a265", marginTop:2 }}>↗ {it.evolution_path}</div>
                      <div style={{ fontSize:".8rem", color:"#d4a840", marginTop:4 }}>🛡 {it.prevention}</div>
                    </div>
                  )) : dst?.temporal_outlook ? (
                    <div style={{ fontSize:".85rem", color:"#9a9488", padding:12, lineHeight:1.7 }}>{dst.temporal_outlook}</div>
                  ) : dst?._raw ? (
                    <div style={{ fontSize:".85rem", color:"#9a9488", padding:12, lineHeight:1.7 }}>{String(dst._raw).substring(0,500)}</div>
                  ) : <div style={{ fontSize:".85rem", color:"#3a3832", textAlign:"center", padding:16 }}>等待科学大脑完成后自动触发</div>}
                  {dst?.temporal_outlook && (
                    <div style={{ padding:"10px 12px", background:"rgba(196,162,101,.03)", border:"1px solid rgba(196,162,101,.08)", marginTop:8 }}>
                      <div style={{ ...S.mono, fontSize:".72rem", color:"#6a5a35", marginBottom:4 }}>TEMPORAL OUTLOOK</div>
                      <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{dst.temporal_outlook}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ INSIGHTS ══ */}
          {tab==="insights" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {/* Science full */}
              <div style={{ ...S.card, borderColor:"rgba(82,176,154,.12)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:"#52b09a" }}/>
                  <div><div style={{ ...S.mono, fontSize:".8rem", color:"#52b09a" }}>科学大脑</div><div style={{ fontSize:".72rem", color:"#3a3832", fontStyle:"italic" }}>Anatomical & Physiological</div></div>
                </div>
                {sci?.items?.length ? sci.items.map((it,i) => (
                  <div key={i} style={{ padding:"12px 14px", background:"#16161c", borderLeft:`3px solid ${EC[it.organ_system]||"#52b09a"}`, marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:"1rem", color:"#e0dcd4" }}>{it.metric_cn} <span style={{ fontSize:".8rem", color:EC[it.organ_system] }}>{it.organ_system}</span></span>
                      <span style={{ ...S.mono, fontSize:".72rem", padding:"2px 8px", background:it.severity==="severe"?"rgba(196,64,64,.1)":"rgba(212,168,64,.1)", color:it.severity==="severe"?"#c44040":"#d4a840" }}>{(it.severity||"").toUpperCase()}</span>
                    </div>
                    {it.anatomical_context && <div style={{ fontSize:".85rem", color:"#c4a265", marginBottom:4 }}>🔬 {it.anatomical_context}</div>}
                    <div style={{ fontSize:".9rem", color:"#9a9488", lineHeight:1.8, marginBottom:6 }}>{it.physiological_analysis}</div>
                    {it.demographic_specific && <div style={{ fontSize:".85rem", color:"#5a9ad4", background:"rgba(58,106,154,.06)", padding:"6px 10px", marginBottom:6 }}>👤 {age}岁{sex==="M"?"男":"女"}性：{it.demographic_specific}</div>}
                    <div style={{ fontSize:".85rem", color:"#52b09a" }}>💡 {it.recommendation}</div>
                  </div>
                )) : <div style={{ textAlign:"center", padding:32, fontSize:".9rem", color:"#3a3832" }}>在数据中心启动分析管线</div>}
                {sci?.summary && <div style={{ padding:"10px 12px", background:"rgba(82,176,154,.04)", border:"1px solid rgba(82,176,154,.1)", marginTop:8 }}>
                  <div style={{ ...S.mono, fontSize:".72rem", color:"#52b09a", marginBottom:4 }}>SUMMARY</div>
                  <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{sci.summary}</div>
                </div>}
              </div>

              {/* Destiny full */}
              <div style={{ ...S.card, borderColor:"rgba(196,162,101,.12)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:"#c4a265" }}/>
                  <div><div style={{ ...S.mono, fontSize:".8rem", color:"#c4a265" }}>命理大脑</div><div style={{ fontSize:".72rem", color:"#3a3832", fontStyle:"italic" }}>BaZi Destiny Collision</div></div>
                </div>
                {dst?.collision_items?.length ? dst.collision_items.map((it,i) => (
                  <div key={i} style={{ padding:"12px 14px", background:"#16161c", borderLeft:`3px solid ${EC[it.organ_wuxing]||"#c4a265"}`, marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:"1rem", color:"#e0dcd4" }}>{it.organ_wuxing} {EO[it.organ_wuxing]}</span>
                      <span style={{ ...S.mono, fontSize:".72rem", color:"#d4a840" }}>{it.risk_window}</span>
                    </div>
                    <div style={{ fontSize:".9rem", color:"#9a9488", lineHeight:1.8, marginBottom:4 }}>⚡ {it.current_forces}</div>
                    <div style={{ fontSize:".85rem", color:"#c4a265", lineHeight:1.8 }}>↗ {it.evolution_path}</div>
                    <div style={{ fontSize:".85rem", color:"#d4a840", background:"rgba(212,168,64,.06)", padding:"6px 10px", marginTop:6 }}>🛡 {it.prevention}</div>
                  </div>
                )) : <div style={{ textAlign:"center", padding:32, fontSize:".9rem", color:"#3a3832" }}>等待科学大脑完成</div>}
                {dst?.bazi_analysis && (
                  <div style={{ padding:"12px 14px", background:"#16161c", border:"1px solid rgba(196,162,101,.08)", marginTop:8, marginBottom:8 }}>
                    <div style={{ ...S.mono, fontSize:".72rem", color:"#c4a265", marginBottom:8 }}>八字命理详析 BAZI DEEP ANALYSIS</div>
                    {dst.bazi_analysis.pattern && <div style={{ fontSize:".85rem", color:"#e0dcd4", marginBottom:6 }}>📐 格局: {dst.bazi_analysis.pattern}</div>}
                    {dst.bazi_analysis.tiangang_relations && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7, marginBottom:4 }}>天干生克: {dst.bazi_analysis.tiangang_relations}</div>}
                    {dst.bazi_analysis.dizhi_relations && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7, marginBottom:4 }}>地支刑冲合会: {dst.bazi_analysis.dizhi_relations}</div>}
                    {dst.bazi_analysis.tiaohou && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7, marginBottom:4 }}>调候: {dst.bazi_analysis.tiaohou}</div>}
                    {dst.bazi_analysis.tongguan && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7, marginBottom:4 }}>通关: {dst.bazi_analysis.tongguan}</div>}
                    {dst.bazi_analysis.twelve_stages && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7, marginBottom:4 }}>十二长生: {dst.bazi_analysis.twelve_stages}</div>}
                    {dst.bazi_analysis.wangxiang && <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7, marginBottom:4 }}>旺相休囚死: {dst.bazi_analysis.wangxiang}</div>}
                    {dst.bazi_analysis.shenshas && <div style={{ fontSize:".85rem", color:"#d4a840", lineHeight:1.7 }}>神煞: {dst.bazi_analysis.shenshas}</div>}
                  </div>
                )}
                {dst?.temporal_outlook && <div style={{ padding:"10px 12px", background:"rgba(196,162,101,.04)", border:"1px solid rgba(196,162,101,.08)", marginTop:8 }}>
                  <div style={{ ...S.mono, fontSize:".72rem", color:"#6a5a35", marginBottom:4 }}>TEMPORAL OUTLOOK</div>
                  <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{dst.temporal_outlook}</div>
                </div>}
                {dst?.key_dates?.length>0 && <div style={{ marginTop:8 }}>{dst.key_dates.map((d,i)=><div key={i} style={{ fontSize:".85rem", color:"#d4a840", marginBottom:3 }}>📅 {d}</div>)}</div>}
              </div>
            </div>
          )}

          {/* ══ METRICS ══ */}
          {tab==="metrics" && (
            <div>
              <div style={{ fontSize:".9rem", color:"#9a9488", marginBottom:14 }}>{age}岁 · {sex==="M"?"男":"女"}性 — 参考范围已按人口统计学调整</div>
              {metrics.map(m => {
                const ref = gR(m.key, age, sex); if (!ref) return null;
                const inR = m.value>=ref.l && m.value<=ref.h;
                const pct = Math.min(100,Math.max(0,(m.value-ref.l)/(ref.h-ref.l)*100));
                return (
                  <div key={m.key} style={{ padding:"14px 18px", ...S.card, borderLeft:`3px solid ${EC[ref.o]}`, marginBottom:6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <div>
                        <span style={{ fontSize:"1rem", color:"#e0dcd4" }}>{ref.cn}</span>
                        <span style={{ ...S.mono, fontSize:".75rem", color:"#5e5a52", marginLeft:8 }}>{m.key}</span>
                        <span style={{ fontSize:".85rem", color:EC[ref.o], marginLeft:8 }}>{ref.o}</span>
                      </div>
                      <span style={{ ...S.mono, fontSize:".75rem", padding:"2px 8px", background:inR?"rgba(82,176,154,.08)":"rgba(196,64,64,.08)", color:inR?"#52b09a":"#c44040" }}>
                        {inR?"正常":m.value>ref.h?"偏高":"偏低"}
                      </span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                      <input type="number" value={m.value} step="0.1" onChange={e=>updateMetric(m.key,e.target.value)}
                        style={{ width:80, background:"#16161c", border:"1px solid rgba(196,162,101,.1)", color:inR?"#f0ece4":"#c44040", padding:"6px 8px", ...S.mono, fontSize:"1.1rem", outline:"none", textAlign:"center" }}/>
                      <span style={{ fontSize:".8rem", color:"#5e5a52" }}>{ref.u}</span>
                      <span style={{ fontSize:".75rem", color:"#3a3832" }}>参考 {ref.l}–{ref.h}</span>
                    </div>
                    <div style={{ height:4, background:"#08080a", marginBottom:8, borderRadius:1 }}>
                      <div style={{ height:"100%", width:pct+"%", background:inR?"#52b09a":"#c44040", opacity:.6, transition:"width .4s", borderRadius:1 }}/>
                    </div>
                    <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.8 }}>
                      <span style={{ ...S.mono, fontSize:".72rem", color:"#6a5a35" }}>📖 {age}岁{sex==="M"?"男":"女"}性</span> — {ref.n}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Noto+Serif+SC:wght@200;300;400;600&family=JetBrains+Mono:wght@300;400&display=swap');
        @keyframes pulse { 0%,100% { opacity:.4; } 50% { opacity:1; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#6a5a35; border-radius:2px; }
        input[type=number]::-webkit-inner-spin-button { opacity:.3; }
      `}</style>
    </div>
  );
}
