import { useI18n } from "./i18n/index.jsx";
import { useEffect } from "react";

const L = {
  en: {
    eyebrow: "DUAL-BRAIN HEALTH INTELLIGENCE",
    h1a: "Decode Your", h1b: "Biological Blueprint",
    sub: "Where 3,000 years of Eastern wisdom meets modern clinical biomarkers. One analysis. Two perspectives. Your complete picture.",
    cta: "BEGIN FREE ANALYSIS",
    premiseTag: "THE PREMISE",
    premiseH: ["Your lab report tells you ", "what", ".", "Your birth chart tells you ", "why", "."],
    premiseP: "AnatomySelf runs your clinical biomarkers through a Science Brain (AI clinical analysis) and a Meta Brain (traditional BaZi energetics) — then collides them to find patterns neither could see alone.",
    sciTitle: "Science Brain", sciSub: "CLINICAL LAYER · BIOSELF",
    sciDesc: "AI-powered analysis of 15 standardized biomarkers across five organ systems. Age and sex-adjusted reference ranges. Precise clinical language.",
    metaTitle: "Meta Brain", metaSub: "ENERGETIC LAYER · METASELF",
    metaDesc: "Traditional Four Pillars analysis mapping your constitutional energy blueprint. Major cycles, annual influences, and organ-element correlations spanning millennia of pattern recognition.",
    howTag: "HOW IT WORKS",
    steps: [
      ["01", "Enter your birth time", "Date, hour, and one biomarker — your resting heart rate. Measured with two fingers on your wrist. That's all you need to begin."],
      ["02", "Dual-Brain Analysis fires", "The Science Brain processes your clinical data. The Meta Brain maps your energetic blueprint. Then they collide — debating your results in real-time."],
      ["03", "Your Life Blueprint emerges", "A resonance radar reveals where your clinical reality and constitutional energy align — or diverge. Impact cards show what matters most."],
      ["04", "Upload lab data to go deeper", "Start with Discovery Mode for free. Upload your lab report anytime to unlock full clinical collision analysis."],
    ],
    quote: '"The only system that told me my ALT elevation and my Wood-Fire clash were the same story told in two languages."',
    quoteAttr: "— EARLY ACCESS USER · SINGAPORE",
    finalH: "Your blueprint is waiting.",
    finalP: "No credit card. No lab data required. Just your birth time.",
    footer1: "ANATOMYSELF · DUAL-BRAIN HEALTH INTELLIGENCE",
    footer2: "Science Brain for reference only — not medical advice. Meta Brain based on traditional metaphysics — cultural reference only.",
    sciMetrics: [
      ["Hepatocellular injury markers", "ALT · AST · TBIL"],
      ["Cardiovascular strain", "SBP · DBP · RHR"],
      ["Metabolic syndrome", "FBG · HbA1c · TG"],
      ["Respiratory function", "FVC · SpO2 · LDL-C"],
      ["Renal & endocrine", "Cr · UA · VitD"],
    ],
    metaMetrics: [
      ["Four Pillars", "Year · Month · Day · Hour"],
      ["Five Elements", "Wood · Fire · Earth · Metal · Water"],
      ["Temporal Cycles", "Major · Annual · Monthly"],
      ["Organ Mapping", "Liver · Heart · Spleen · Lung · Kidney"],
      ["Collision Analysis", "Clinical × Energetic overlay"],
    ],
  },
  zh: {
    eyebrow: "双脑健康智能系统",
    h1a: "解码你的", h1b: "生命蓝图",
    sub: "三千年东方智慧与现代临床指标的交汇。一次分析，两个视角，你的完整图景。",
    cta: "开始免费分析",
    premiseTag: "核心理念",
    premiseH: ["体检报告告诉你「", "是什么", "」。", "八字命盘告诉你「", "为什么", "」。"],
    premiseP: "AnatomySelf 用科学脑（AI 临床分析）和命理脑（传统八字能量学）同时处理你的健康数据——然后让它们对撞，发现单一视角看不到的模式。",
    sciTitle: "科学脑", sciSub: "临床层 · BIOSELF",
    sciDesc: "AI 驱动的 15 项标准化指标分析，覆盖五大脏器系统。年龄与性别校正参考范围。精准临床术语。",
    metaTitle: "命理脑", metaSub: "能量层 · METASELF",
    metaDesc: "传统四柱八字分析，映射先天能量蓝图。大运流年影响，脏腑五行对应，跨越千年的模式识别。",
    howTag: "使用流程",
    steps: [
      ["01", "输入你的出生时间", "日期、时辰，加一个生物标记——静息心率。两根手指搭在手腕上就能测。这就是你需要的全部。"],
      ["02", "双脑分析启动", "科学脑处理临床数据，命理脑映射能量蓝图。然后它们碰撞——实时辩证你的结果。"],
      ["03", "生命蓝图浮现", "共振雷达揭示你的临床现实与先天能量在哪里一致、在哪里分歧。影响力卡片展示最重要的信息。"],
      ["04", "上传体检数据深入分析", "先用探索模式免费体验。随时上传体检报告，解锁完整的临床对撞分析。"],
    ],
    quote: '"唯一一个告诉我，ALT 升高和木火相克其实是同一个故事的两种语言的系统。"',
    quoteAttr: "— 内测用户 · 新加坡",
    finalH: "你的蓝图在等你。",
    finalP: "无需信用卡。无需体检数据。只需你的出生时间。",
    footer1: "ANATOMYSELF · 双脑健康智能",
    footer2: "科学脑仅供参考，不构成医疗建议。命理脑基于传统命理学，属文化参考。",
    sciMetrics: [
      ["肝细胞损伤标记", "ALT · AST · TBIL"],
      ["心血管负荷", "SBP · DBP · RHR"],
      ["代谢综合征", "FBG · HbA1c · TG"],
      ["呼吸功能", "FVC · SpO2 · LDL-C"],
      ["肾脏与内分泌", "Cr · UA · VitD"],
    ],
    metaMetrics: [
      ["四柱", "年柱 · 月柱 · 日柱 · 时柱"],
      ["五行", "木 · 火 · 土 · 金 · 水"],
      ["时运周期", "大运 · 流年 · 流月"],
      ["脏腑映射", "肝 · 心 · 脾 · 肺 · 肾"],
      ["对撞分析", "临床 × 能量 叠加"],
    ],
  },
};

export default function LandingPage({ onEnter }) {
  const { locale, toggleLang } = useI18n();
  const t = L[locale] || L.en;

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('lp-visible'); obs.unobserve(e.target); }});
    }, { threshold: 0.12 });
    document.querySelectorAll('.lp-fade').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const S = {
    page: { minHeight:"100vh", background:"#08080a", color:"#e0dcd4", fontFamily:"'Noto Serif SC',serif", overflowX:"hidden" },
    nav: { position:"fixed", top:0, width:"100%", zIndex:90, padding:"14px 36px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(8,8,10,.75)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(196,162,101,.06)" },
    navBrand: { fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#c4a265", letterSpacing:3 },
    navLink: { fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#5e5a52", letterSpacing:2, cursor:"pointer", background:"none", border:"none" },
    navCta: { padding:"8px 20px", border:"1px solid rgba(196,162,101,.25)", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:1.5, cursor:"pointer", background:"transparent" },
    hero: { minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"120px 24px 80px",
      backgroundImage:"radial-gradient(ellipse 600px 400px at 50% 40%,rgba(196,162,101,.04),transparent),linear-gradient(rgba(196,162,101,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.012) 1px,transparent 1px)", backgroundSize:"100%,48px 48px,48px 48px" },
    eyebrow: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#5e5a52", letterSpacing:5, marginBottom:32 },
    h1: { fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(38px,6vw,68px)", fontWeight:300, letterSpacing:".08em", lineHeight:1.1, color:"#e0dcd4", marginBottom:20 },
    h1em: { fontStyle:"italic", color:"#c4a265", fontWeight:400 },
    sub: { fontSize:16, color:"#9a9488", maxWidth:500, lineHeight:1.8, fontWeight:300, marginBottom:40 },
    cta: { display:"inline-flex", alignItems:"center", gap:10, padding:"14px 36px", border:"1px solid rgba(196,162,101,.3)", color:"#c4a265", fontFamily:"'JetBrains Mono',monospace", fontSize:12, letterSpacing:2, cursor:"pointer", background:"transparent" },
    section: { padding:"90px 40px", textAlign:"center" },
    tag: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#5e5a52", letterSpacing:4, marginBottom:24 },
    h2: { fontFamily:"'Cormorant Garamond',serif", fontSize:30, fontWeight:300, color:"#e0dcd4", maxWidth:620, margin:"0 auto 16px", lineHeight:1.4, letterSpacing:".05em" },
    p: { fontSize:15, color:"#9a9488", maxWidth:520, margin:"0 auto", lineHeight:1.8 },
    dual: { padding:"70px 40px", display:"flex", justifyContent:"center", gap:0, maxWidth:960, margin:"0 auto" },
    brainCard: { flex:1, padding:"44px 36px", border:"1px solid rgba(196,162,101,.06)" },
    brainH3: { fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, marginBottom:6, letterSpacing:".05em" },
    brainSub: { fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#5e5a52", letterSpacing:2, marginBottom:18 },
    brainP: { fontSize:14, color:"#9a9488", lineHeight:1.8 },
    li: { fontSize:13, color:"#5e5a52", padding:"6px 0", borderBottom:"1px solid rgba(196,162,101,.04)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:.5 },
    stepsWrap: { padding:"90px 40px", maxWidth:780, margin:"0 auto" },
    step: { display:"flex", gap:28, marginBottom:36, alignItems:"flex-start" },
    stepNum: { fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#c4a265", minWidth:40, paddingTop:4, letterSpacing:2 },
    stepH4: { fontFamily:"'Cormorant Garamond',serif", fontSize:19, fontWeight:400, color:"#e0dcd4", marginBottom:6, letterSpacing:".03em" },
    stepP: { fontSize:14, color:"#9a9488", lineHeight:1.7 },
    divider: { height:1, background:"linear-gradient(90deg,rgba(196,162,101,.08),transparent)", margin:"0 0 36px 68px" },
    proof: { padding:"70px 40px", textAlign:"center", borderTop:"1px solid rgba(196,162,101,.04)", borderBottom:"1px solid rgba(196,162,101,.04)" },
    quote: { fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, fontStyle:"italic", color:"#e0dcd4", maxWidth:580, margin:"0 auto 18px", lineHeight:1.5 },
    quoteAttr: { fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#5e5a52", letterSpacing:3 },
    final: { padding:"110px 40px", textAlign:"center" },
    footer: { padding:36, textAlign:"center", borderTop:"1px solid rgba(196,162,101,.04)" },
    footerP: { fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#2a2a2a", letterSpacing:2 },
  };

  return (
    <div style={S.page}>
      <style>{`
        .lp-fade{opacity:0;transform:translateY(20px);transition:opacity .7s ease,transform .7s ease}
        .lp-fade.lp-visible{opacity:1;transform:translateY(0)}
        @media(max-width:768px){.lp-dual-wrap{flex-direction:column !important}.lp-brain-r{border-top:none !important;border-left:1px solid rgba(196,162,101,.06) !important}}
      `}</style>

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.navBrand}>ANATOMYSELF</div>
        <div style={{ display:"flex", gap:20, alignItems:"center" }}>
          <button onClick={toggleLang} style={S.navLink}>{locale==='en'?'中文':'EN'}</button>
          <button onClick={onEnter} style={S.navCta}>{t.cta}</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={S.hero}>
        <div style={S.eyebrow}>{t.eyebrow}</div>
        <h1 className="lp-fade" style={S.h1}>{t.h1a}<br/><em style={S.h1em}>{t.h1b}</em></h1>
        <p className="lp-fade" style={S.sub}>{t.sub}</p>
        <button className="lp-fade" onClick={onEnter} style={S.cta}>
          {t.cta}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
      </section>

      {/* PREMISE */}
      <section className="lp-fade" style={S.section}>
        <div style={S.tag}>{t.premiseTag}</div>
        <h2 style={S.h2}>{t.premiseH[0]}<em style={S.h1em}>{t.premiseH[1]}</em>{t.premiseH[2]}<br/>{t.premiseH[3]}<em style={S.h1em}>{t.premiseH[4]}</em>{t.premiseH[5]}</h2>
        <p style={S.p}>{t.premiseP}</p>
      </section>

      {/* DUAL BRAIN */}
      <section className="lp-dual-wrap" style={S.dual}>
        <div className="lp-fade" style={S.brainCard}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(82,176,154,.08)", border:"1px solid rgba(82,176,154,.15)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:18 }}>
            <span style={{ color:"#52b09a", fontSize:16 }}>◎</span>
          </div>
          <h3 style={{ ...S.brainH3, color:"#52b09a" }}>{t.sciTitle}</h3>
          <div style={S.brainSub}>{t.sciSub}</div>
          <p style={S.brainP}>{t.sciDesc}</p>
          <ul style={{ listStyle:"none", marginTop:16, padding:0 }}>
            {t.sciMetrics.map(([label, codes]) => (
              <li key={label} style={S.li}><span style={{ color:"#e0dcd4", fontFamily:"'Noto Serif SC',serif" }}>{label}</span> {codes}</li>
            ))}
          </ul>
        </div>
        <div className="lp-fade lp-brain-r" style={{ ...S.brainCard, borderLeft:"none" }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(196,162,101,.08)", border:"1px solid rgba(196,162,101,.15)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:18 }}>
            <span style={{ color:"#c4a265", fontSize:16 }}>☯</span>
          </div>
          <h3 style={{ ...S.brainH3, color:"#c4a265" }}>{t.metaTitle}</h3>
          <div style={S.brainSub}>{t.metaSub}</div>
          <p style={S.brainP}>{t.metaDesc}</p>
          <ul style={{ listStyle:"none", marginTop:16, padding:0 }}>
            {t.metaMetrics.map(([label, codes]) => (
              <li key={label} style={S.li}><span style={{ color:"#e0dcd4", fontFamily:"'Noto Serif SC',serif" }}>{label}</span> {codes}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={S.stepsWrap}>
        <div style={{ ...S.tag, textAlign:"center", marginBottom:44 }}>{t.howTag}</div>
        {t.steps.map(([num, title, desc], i) => (
          <div key={num}>
            <div className="lp-fade" style={S.step}>
              <div style={S.stepNum}>{num}</div>
              <div>
                <h4 style={S.stepH4}>{title}</h4>
                <p style={S.stepP}>{desc}</p>
              </div>
            </div>
            {i < t.steps.length - 1 && <div style={S.divider}/>}
          </div>
        ))}
      </section>

      {/* SOCIAL PROOF */}
      <section className="lp-fade" style={S.proof}>
        <div style={S.quote}>{t.quote}</div>
        <div style={S.quoteAttr}>{t.quoteAttr}</div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-fade" style={S.final}>
        <h2 style={{ ...S.h2, fontSize:34 }}>{t.finalH}</h2>
        <p style={{ ...S.p, marginBottom:32 }}>{t.finalP}</p>
        <button onClick={onEnter} style={{ ...S.cta, fontSize:13, padding:"16px 48px" }}>
          {t.cta}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1"/></svg>
        </button>
      </section>

      {/* FOOTER */}
      <footer style={S.footer}>
        <p style={S.footerP}>{t.footer1}</p>
        <p style={{ ...S.footerP, marginTop:8, color:"#1a1a1a" }}>{t.footer2}</p>
      </footer>
    </div>
  );
}
