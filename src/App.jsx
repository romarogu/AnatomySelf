import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as d3 from "d3";
import { apiOCR, apiScience, apiDestiny, apiRegister, apiLogin, apiSaveUser, apiChat } from "./api.js";

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
// D3 INTERACTIVE RADAR COMPONENT
// ════════════════════════════════════════
function InteractiveRadar({ med, dest, colls, onSelectDimension, selectedDim, timeOffset = 0 }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [hoveredDim, setHoveredDim] = useState(null);

  const order = ["火","土","金","水","木"];
  const labels = [["火·心","#c45a30"],["土·脾","#a08a50"],["金·肺","#9898a8"],["水·肾","#3a6a9a"],["木·肝","#4a8a4a"]];
  const organs = {"火":"心·小肠","土":"脾·胃","金":"肺·大肠","水":"肾·膀胱","木":"肝·胆"};

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
      .text("撞");

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
              {hoveredColl.el} · {organs[hoveredColl.el]}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", marginBottom: 2 }}>
              <span style={{ color: "#e0dcd4" }}>医学层</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e0dcd4" }}>{hoveredColl.med}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", marginBottom: 2 }}>
              <span style={{ color: "#c4a265" }}>命理层</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#c4a265" }}>{hoveredColl.dest}%</span>
            </div>
            <div style={{ height: 1, background: "rgba(196,162,101,0.1)", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem" }}>
              <span style={{ color: "#9a9488" }}>偏离度</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: sC[hoveredColl.lv] }}>{hoveredColl.dv}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem" }}>
              <span style={{ color: "#9a9488" }}>共振度</span>
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
      setOcr(res);
      if (res.ocr_unavailable) {
        // OCR not available — show message, keep pipeline going
        setPipe(p=>p.map((s,i)=>i===1?{...s,st:"done"}:s));
      } else {
        setPipe(p=>p.map((s,i)=>i===1?{...s,st:"done"}:s));
        if(res.metrics?.length) {
          const ks=Object.keys(RR);
          const newM=[...metrics];
          res.metrics.filter(m=>m.value!=null).forEach(m=>{const code=ks.find(k=>k===m.code)||m.code;const idx=newM.findIndex(x=>x.key===code);if(idx>=0)newM[idx]={...newM[idx],value:m.value};else newM.push({key:code,value:m.value});});
          setMetrics(newM); saveData(newM);
        }
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
        baziPillars: {
          year: bazi.year[0] + bazi.year[1],
          month: bazi.month[0] + bazi.month[1],
          day: bazi.day[0] + bazi.day[1],
          hour: bazi.hour[0] + bazi.hour[1],
        },
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

  // ── CHAT FUNCTION ──
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", text: q, brain: chatBrain }]);
    setChatLoading(true);
    try {
      // Build context for the AI
      let ctx = `用户: ${age}岁${sex === "M" ? "男" : "女"}性, 日主${bazi.dm}(${bazi.dme}), 大运${dy.lbl}, 流年${ln.lbl}\n`;
      if (sci?.summary) ctx += `科学大脑总结: ${sci.summary}\n`;
      if (dst?.temporal_outlook) ctx += `命理大脑总结: ${dst.temporal_outlook}\n`;
      if (sci?.items?.length) ctx += `异常指标: ${sci.items.map(i => i.metric_cn).join("、")}\n`;
      // Add last few chat messages for continuity
      const recent = chatHistory.slice(-4).map(m => `${m.role === "user" ? "用户" : (m.brain === "science" ? "科学脑" : "命理脑")}: ${m.text}`).join("\n");
      if (recent) ctx += `\n对话历史:\n${recent}`;

      const res = await apiChat({ brain: chatBrain, question: q, context: ctx });
      setChatHistory(prev => [...prev, { role: "assistant", text: res.answer || "无回答", brain: chatBrain }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "assistant", text: "对话失败: " + err.message, brain: chatBrain }]);
    }
    setChatLoading(false);
  }, [chatInput, chatBrain, chatLoading, chatHistory, age, sex, bazi, dy, ln, sci, dst]);

  const tabs = [
    { id: "upload", lb: "📄 数据中心" },
    { id: "radar", lb: "⚡ 对撞分析" },
    { id: "tuning", lb: "🎯 生命微调" },
    { id: "chat", lb: "💬 深度对话" },
    { id: "metrics", lb: "📊 体检指标" },
  ];

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
                    <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={doOCR} style={{ display:"none" }}/>
                    {file ? (
                      <div><div style={{ fontSize:"1rem", color:"#52b09a" }}>✓ {file.name}</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>{(file.size/1024).toFixed(1)}KB · 点击更换</div></div>
                    ) : (
                      <div><div style={{ fontSize:"2rem", color:"#6a5a35", marginBottom:8 }}>⬆</div><div style={{ fontSize:".95rem", color:"#9a9488" }}>上传体检报告截图</div><div style={{ fontSize:".8rem", color:"#5e5a52", marginTop:4 }}>支持 PNG / JPG（拍照或截图）</div></div>
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
                      {ocr.ocr_unavailable && (
                        <div style={{ padding:"14px 16px", background:"rgba(196,162,101,0.06)", border:"1px solid rgba(196,162,101,0.15)", marginBottom:10 }}>
                          <div style={{ fontSize:".9rem", color:"#c4a265", marginBottom:6 }}>📝 请手动输入体检数据</div>
                          <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.7 }}>{ocr.message || "图片OCR自动识别暂未开启。请在下方「当前指标」区域直接修改您的体检数值，然后点击「启动双脑对撞分析」。"}</div>
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
                  ) : <div style={{ fontSize:".85rem", color:"#3a3832", textAlign:"center", padding:20, marginTop:10 }}>上传报告或直接在下方手动输入指标</div>}
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

          {/* ══ COLLISION ANALYSIS (merged radar + insights) ══ */}
          {tab==="radar" && (
            <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:20 }}>
              {/* LEFT: Radar + dimension list */}
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={S.card}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={S.label}>对撞共振雷达</div>
                    <div style={{ ...S.mono, fontSize:".65rem", color:"#3a3832" }}>time_offset: {timeOffset}</div>
                  </div>
                  <InteractiveRadar
                    med={medWX} dest={destWX} colls={colls}
                    onSelectDimension={setSelectedDim}
                    selectedDim={selectedDim}
                    timeOffset={timeOffset}
                  />
                  <div style={{ display:"flex", gap:14, justifyContent:"center", marginTop:10, fontSize:".78rem" }}>
                    <span style={{ color:"#c4a265" }}>● 命理层</span>
                    <span style={{ color:"#e0dcd4" }}>◌ 医学层</span>
                    <span style={{ color:"#c44040" }}>◎ 预警</span>
                  </div>
                </div>

                {/* Dimension quick-select list */}
                <div style={S.card}>
                  <div style={S.label}>五维概览（点击聚焦）</div>
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
                          <span style={{ fontSize:".85rem", color: isActive ? "#e0dcd4" : "#9a9488" }}>{EO[c.el]}</span>
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

                {/* BaZi deep analysis (collapsible) */}
                {dst?.bazi_analysis && (
                  <div style={{ ...S.card, borderColor:"rgba(196,162,101,.08)" }}>
                    <div style={{ ...S.mono, fontSize:".72rem", color:"#c4a265", marginBottom:8, letterSpacing:".15em" }}>八字命理详析</div>
                    {[
                      ["📋", "pillars_detail", "四柱"],
                      ["📐", "pattern", "格局"],
                      ["⚡", "tiangang_relations", "天干"],
                      ["🔄", "dizhi_relations", "地支"],
                      ["🌡", "tiaohou", "调候"],
                      ["🌉", "tongguan", "通关"],
                      ["🔄", "twelve_stages", "长生"],
                      ["💪", "wangxiang", "旺相"],
                      ["⭐", "shenshas", "神煞"],
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
                            <span style={{ fontSize:"1.1rem", color:"#e0dcd4", marginLeft:10 }}>{EO[selectedDim]}</span>
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
                          <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(196,64,64,0.06)", border:"1px solid rgba(196,64,64,0.12)", fontSize:".85rem", color:"#c44040" }}>
                            ⚠ 偏离度 {coll.dv}% — 医学与命理在此维度存在显著分歧，需要关注
                          </div>
                        )}
                      </div>

                      {hasData ? (
                        /* Dialogue-style cross analysis */
                        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
                          <div style={{ padding:"12px 16px", background:"rgba(196,162,101,0.03)", borderBottom:"1px solid rgba(196,162,101,0.06)" }}>
                            <div style={{ ...S.mono, fontSize:".75rem", color:"#6a5a35", letterSpacing:".15em" }}>双脑对话式关联分析 · {selectedDim} {EO[selectedDim]}</div>
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
                                      <span style={{ ...S.mono, fontSize:".72rem", color:"#52b09a" }}>科学脑 · {it.metric_cn}</span>
                                      {it.severity && <span style={{ ...S.mono, fontSize:".65rem", padding:"1px 6px", background:it.severity==="severe"?"rgba(196,64,64,.1)":"rgba(212,168,64,.1)", color:it.severity==="severe"?"#c44040":"#d4a840" }}>{it.severity.toUpperCase()}</span>}
                                    </div>
                                    {it.anatomical_context && <div style={{ fontSize:".85rem", color:"#c4a265", marginBottom:4 }}>🔬 {it.anatomical_context}</div>}
                                    <div style={{ fontSize:".88rem", color:"#d0ccc4", lineHeight:1.8 }}>{it.physiological_analysis}</div>
                                    {it.demographic_specific && <div style={{ fontSize:".82rem", color:"#5a9ad4", background:"rgba(58,106,154,.06)", padding:"5px 10px", marginTop:4 }}>👤 {age}岁{sex==="M"?"男":"女"}性：{it.demographic_specific}</div>}
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
                                        <span style={{ ...S.mono, fontSize:".72rem", color:"#c4a265" }}>命理脑 · 对撞回应</span>
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
                                    <span style={{ ...S.mono, fontSize:".72rem", color:"#c4a265" }}>命理脑 · 独立洞察</span>
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
                                此维度暂无异常数据，双脑未生成分析
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ ...S.card, textAlign:"center", padding:32, color:"#3a3832" }}>
                          <div style={{ fontSize:"1.1rem", marginBottom:8 }}>{selectedDim} {EO[selectedDim]} 维度暂无异常</div>
                          <div style={{ fontSize:".85rem" }}>此维度医学指标均在正常范围，命理脑未发现对撞冲突</div>
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
                      <div style={{ fontSize:"1rem", color:"#e0dcd4", marginBottom:12 }}>点击雷达或左侧维度，查看双脑关联分析</div>
                      <div style={{ fontSize:".85rem", color:"#9a9488", lineHeight:1.8 }}>
                        雷达展示了五行维度上「医学层」与「命理层」的对撞状态。当偏离度超过 30% 时，该维度触发脉冲预警。
                        点击任意维度可展开科学脑与命理脑的对话式关联分析——两个大脑不再各自罗列，而是围绕同一异常进行交叉对话。
                      </div>
                    </div>

                    {/* Quick overview of all science + destiny findings */}
                    {(sci?.items?.length > 0 || dst?.collision_items?.length > 0) && (
                      <div style={{ ...S.card }}>
                        <div style={S.label}>全局异常概览</div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:8 }}>
                          <div>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                              <div style={{ width:6, height:6, borderRadius:"50%", background:"#52b09a" }}/>
                              <span style={{ ...S.mono, fontSize:".75rem", color:"#52b09a" }}>科学脑发现</span>
                            </div>
                            {sci?.items?.length ? sci.items.map((it,i) => (
                              <div key={i} onClick={() => setSelectedDim(it.organ_system)} style={{
                                padding:"6px 10px", background:"#16161c", borderLeft:`2px solid ${EC[it.organ_system]||"#52b09a"}`,
                                marginBottom:4, cursor:"pointer", transition:"background .2s"
                              }}>
                                <span style={{ fontSize:".85rem", color:"#e0dcd4" }}>{it.metric_cn}</span>
                                <span style={{ fontSize:".75rem", color:"#5e5a52", marginLeft:6 }}>{it.organ_system}</span>
                              </div>
                            )) : <div style={{ fontSize:".8rem", color:"#3a3832" }}>暂无数据</div>}
                          </div>
                          <div>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                              <div style={{ width:6, height:6, borderRadius:"50%", background:"#c4a265" }}/>
                              <span style={{ ...S.mono, fontSize:".75rem", color:"#c4a265" }}>命理脑发现</span>
                            </div>
                            {dst?.collision_items?.length ? dst.collision_items.map((it,i) => (
                              <div key={i} onClick={() => setSelectedDim(it.organ_wuxing)} style={{
                                padding:"6px 10px", background:"#16161c", borderLeft:`2px solid ${EC[it.organ_wuxing]||"#c4a265"}`,
                                marginBottom:4, cursor:"pointer", transition:"background .2s"
                              }}>
                                <span style={{ fontSize:".85rem", color:"#e0dcd4" }}>{it.organ_wuxing} {EO[it.organ_wuxing]}</span>
                                {it.risk_window && <span style={{ fontSize:".72rem", color:"#d4a840", marginLeft:6 }}>{it.risk_window}</span>}
                              </div>
                            )) : <div style={{ fontSize:".8rem", color:"#3a3832" }}>暂无数据</div>}
                          </div>
                        </div>
                      </div>
                    )}

                    {sci?.summary && (
                      <div style={{ ...S.card, borderColor:"rgba(82,176,154,.08)" }}>
                        <div style={{ ...S.mono, fontSize:".72rem", color:"#52b09a", marginBottom:6 }}>科学脑综合判断</div>
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
                        <div style={S.label}>关键时间节点</div>
                        {dst.key_dates.map((d,i) => <div key={i} style={{ fontSize:".85rem", color:"#d4a840", marginBottom:4 }}>📅 {d}</div>)}
                      </div>
                    )}
                  </>
                )}
              </div>
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
                        <div style={{ ...S.mono, fontSize:".85rem", color:"#52b09a" }}>左脑 · 医学建议</div>
                        <div style={{ fontSize:".75rem", color:"#3a3832", fontStyle:"italic" }}>Science-Based Recommendations</div>
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
                        <div style={{ ...S.mono, fontSize:".85rem", color:"#c4a265" }}>右脑 · 命理建议</div>
                        <div style={{ fontSize:".75rem", color:"#3a3832", fontStyle:"italic" }}>Destiny-Based Life Tuning</div>
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
                  请先在「数据中心」启动双脑对撞分析，生成个性化生命微调建议。
                </div>
              )}

              {/* Key dates */}
              {dst?.key_dates?.length > 0 && (
                <div style={{ ...S.card, marginTop:16 }}>
                  <div style={S.label}>关键时间节点</div>
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
                {[["science","🔬 科学脑","#52b09a"],["destiny","🌟 命理脑","#c4a265"]].map(([id, lb, c]) => (
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
                }}>清空对话</button>
              </div>

              {/* Chat history */}
              <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, padding:"8px 0" }}>
                {chatHistory.length === 0 && (
                  <div style={{ textAlign:"center", padding:48, color:"#3a3832" }}>
                    <div style={{ fontSize:"1.2rem", marginBottom:8 }}>选择一个大脑，开始深度对话</div>
                    <div style={{ fontSize:".85rem" }}>
                      🔬 科学脑：追问解剖学、生理学、用药、检查建议<br/>
                      🌟 命理脑：追问五行调节、流年趋势、养生时机
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
                      {m.role === "user" ? "你" : m.brain === "science" ? "🔬 科学脑" : "🌟 命理脑"}
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
                  placeholder={chatBrain === "science" ? "向科学脑提问（如：ALT偏高需要做什么进一步检查？）" : "向命理脑提问（如：今年下半年健康运势如何？）"}
                  style={{ flex:1, ...S.input, fontSize:".9rem" }}
                />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
                  ...S.btn, padding:"10px 24px", opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                  cursor: chatLoading ? "wait" : "pointer",
                }}>发送</button>
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
