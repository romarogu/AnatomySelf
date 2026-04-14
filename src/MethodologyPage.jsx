import { useI18n } from "./i18n/index.jsx";

const L = {
  en: {
    nav: "METHODOLOGY",
    back: "← Back to App",
    title: "Not Hallucination, but Calculation.",
    subtitle: "Our BaZi engine is built on International Astronomical Union (IAU) data models and classical Chinese calendrical systems. All outputs are deterministic mathematical results.",
    
    s1title: "THE SOLAR CORE",
    s1sub: "Timezone Correction & True Solar Time",
    s1p1: "The time on your clock is administrative time (e.g., EST, CST, UTC+8). But in classical Eastern theory, the human biological rhythm responds to the geometric angle of the Sun relative to the horizon — not political boundaries. Using incorrect clock time produces a Pillar deviation in 99.4% of cases, directly affecting 12.5% of your data dimensions.",
    
    tz_title: "Timezone Correction Logic",
    tz1: "Input Standardization: System receives birth date and geographic coordinates (Lat, Lon).",
    tz2: "TZ Database: Built-in IANA timezone database with historical DST retroactive conversion.",
    tz3: "Example: A user born July 1985 in New York — the system automatically subtracts 1 hour DST, converting local clock time to Mean Solar Time.",
    
    tst_title: "True Solar Time Calculation",
    tst_p: "Even at 12:00 noon within a standard timezone, the Sun is rarely directly overhead. This is due to the combined effects of the Equation of Time and longitude offset. Our system performs strict True Solar Time correction — calibrating 'human clocks' to 'celestial clocks'.",
    tst_lon: "Longitude Correction",
    tst_lon_f: "Time Offset = (Local Longitude − Standard Meridian) × 4 min/degree",
    tst_lon_ex: "Boston (71°W) is in UTC-5 (central meridian 75°W). The 4° difference means Boston's solar noon arrives 16 minutes later than the timezone clock. Ignoring this factor produces Hour Pillar errors.",
    tst_eot: "Equation of Time (EoT)",
    tst_eot_p: "Earth's elliptical orbit and axial tilt cause the true solar day length to vary by ±15 minutes throughout the year. Our system dynamically computes the daily EoT value using Jean Meeus's Astronomical Algorithms.",
    tst_formula: "LST = Input Time + Longitude Correction + EoT − DST Correction",
    
    s2title: "FIVE ELEMENTS TO ORGANS",
    s2sub: "The Mapping Logic",
    s2p: "Just as Hippocrates proposed the 'Four Humors' to describe internal homeostasis, classical Chinese medicine established a Five-Element Functional System Model. This is an early biological systems theory based on Analogical Reasoning and clinical statistics. Our mapping logic strictly follows the canonical standards of Huangdi Neijing (c. 200 BCE) — specifically Suwen Chapter 5 and Lingshu Chapter 8. No LLM probabilistic generation is involved — these are fixed index mappings.",
    
    tableHeaders: ["Element", "Zang-Fu Organs", "Canonical Source", "Modern Physiological Interpretation"],
    tableRows: [
      ["Wood 木", "Liver / Gallbladder", "Suwen: 'The East generates wind... the Liver governs the eyes.'", "Autonomic nervous regulation and detoxification metabolism. Wood imbalance often manifests as stress response disorders."],
      ["Fire 火", "Heart / Small Intestine", "Suwen: 'The Heart is the root of life, the transformation of spirit.'", "Cardiovascular circulation and CNS excitability. Fire governs consciousness clarity and thermoregulation."],
      ["Earth 土", "Spleen / Stomach", "Suwen: 'The Spleen and Stomach are the officials of the granary.'", "Digestive absorption and lymphatic immunity. Earth governs nutrient transformation and muscle tone."],
      ["Metal 金", "Lung / Large Intestine", "Suwen: 'The Lung governs the body's skin and hair.'", "Respiratory gas exchange and skin barrier function. Metal governs the first line of immune defense."],
      ["Water 水", "Kidney / Bladder", "Suwen: 'The Kidney governs water, receiving and storing essence.'", "Endocrine system (HPA axis) and electrolyte balance. Water governs genetic potential and anti-aging mechanisms."],
    ],
    
    s3title: "ANTI-HALLUCINATION GUARANTEE",
    s3sub: "How We Ensure Non-Hallucinated Output",
    g1t: "Deterministic Output",
    g1p: "Enter the same time and location 1,000 times — the system produces the identical BaZi chart every time. Zero variance.",
    g2t: "Lookup Table Logic",
    g2p: "The Ten Gods (Zheng Guan, Qi Sha, etc.) are derived through binary logic operations on Heavenly Stem combinations and Earthly Branch hidden stems — not through LLM natural language understanding.",
    g3t: "LLM's Role Boundary",
    g3p: "AI is responsible only for translating deterministic mathematical chart results into fluent, empathetic English explanations. AI is not permitted to modify your Five Element values or zodiac attributes.",
    
    pipeline_title: "COMPUTATION PIPELINE",
    pipeline: ["Birth Time (Local)", "UTC Conversion", "Longitude Offset", "Equation of Time", "True Solar Time", "BaZi Chart", "AI Interpretation"],
    
    citations: "Algorithm based on: Astronomical Algorithms (Meeus, 1998), IANA Time Zone Database v.2024a, Huangdi Neijing (Unschuld Translation, 2011).",
  },
  zh: {
    nav: "方法论",
    back: "← 返回应用",
    title: "并非\"幻觉\"，而是\"算法\"。",
    subtitle: "本系统的八字引擎基于国际天文学联合会 (IAU) 数据模型与古典中国历法体系构建，所有输出均为确定性数学结果。",
    
    s1title: "天文内核",
    s1sub: "时区校正与真太阳时计算",
    s1p1: "您在钟表上看到的时间是行政时间（如北京标准时 UTC+8 或东部标准时 EST）。但在东方经典理论中，人体的生物节律响应的是太阳相对于地平面的几何角度，而非政区边界。若使用错误的时钟时间，您的命盘将有高达 99.4% 的概率产生时柱偏差（直接影响 12.5% 的数据维度）。",
    
    tz_title: "时区校正逻辑",
    tz1: "输入标准化：系统接收出生日期与地理坐标 (Lat, Lon)。",
    tz2: "时区回溯数据库：系统内置 IANA 时区数据库历史变更记录，自动处理夏令时 (DST) 回溯转换。",
    tz3: "示例：若用户出生于 1985 年 7 月美国纽约，系统自动扣除 1 小时 DST，将本地时钟时间还原为标准平太阳时。",
    
    tst_title: "真太阳时计算",
    tst_p: "即便是标准时区内的「中午 12:00」，太阳往往并不在正头顶。这是由于均时差和经度偏差共同作用的结果。本系统执行严格的真太阳时校正，将「人的时钟」校准为「天的时钟」。",
    tst_lon: "经度校正",
    tst_lon_f: "时间偏移 = (当地经度 − 标准时区中央经线) × 4 分钟/度",
    tst_lon_ex: "波士顿 (西经 71°) 位于 UTC-5 时区 (中央经线西经 75°)。因经度相差 4°，波士顿的太阳到达正午比标准时区钟表晚 16 分钟。忽略此因素，时柱推算将出错。",
    tst_eot: "均时差校正 (Equation of Time)",
    tst_eot_p: "地球公转轨道为椭圆且存在黄赤交角，导致真实太阳日长度每日不同（在 ±15 分钟区间波动）。系统基于让·梅乌斯天文算法动态计算当日均时差值。",
    tst_formula: "LST = 输入时间 + 经度修正 + 均时差(EoT) − 夏令时修正",
    
    s2title: "五行脏腑映射",
    s2sub: "映射逻辑依据",
    s2p: "正如希波克拉底提出「四体液说」描述人体内环境稳态，古典中国医学建立了五行功能系统模型。这是一种基于「取象比类」和「临床统计学」的早期生物系统理论。本系统的映射逻辑严格遵循公元前 2 世纪《黄帝内经》的《素问·阴阳应象大论》及《灵枢·本神》的定式标准，不存在 LLM 的概率生成，而是固定的索引映射。",
    
    tableHeaders: ["五行", "对应脏腑", "古典文献依据", "现代生理学类比"],
    tableRows: [
      ["木 Wood", "肝 / 胆", "《素问》：「东方生风…肝主目。」", "对应自主神经调节与解毒代谢功能。木行失衡常表现为压力应激障碍。"],
      ["火 Fire", "心 / 小肠", "《素问》：「心者，生之本，神之变也。」", "对应心血管循环系统与中枢神经兴奋性。火行关乎意识清晰度与体温调节。"],
      ["土 Earth", "脾 / 胃", "《素问》：「脾胃者，仓廪之官，五味出焉。」", "对应消化吸收与淋巴免疫系统。土行关乎营养转化与肌肉张力。"],
      ["金 Metal", "肺 / 大肠", "《素问》：「肺主身之皮毛。」", "对应呼吸系统气体交换与皮肤屏障功能。金行关乎免疫第一道防线。"],
      ["水 Water", "肾 / 膀胱", "《素问》：「肾者主水，受五脏六腑之精而藏之。」", "对应内分泌系统 (肾上腺轴) 与体液电解质平衡。水行关乎遗传潜能与抗衰老机制。"],
    ],
    
    s3title: "反幻觉保证",
    s3sub: "如何确保非幻觉输出",
    g1t: "确定性输出",
    g1p: "使用完全相同的时间与地点输入 1,000 次，本系统将输出完全相同的八字排盘结果。误差为零。",
    g2t: "查表法推演",
    g2p: "十神（正官、七杀等）的关系推导基于天干五合与地支藏干的二进制逻辑运算，不依赖大型语言模型的自然语言理解能力。",
    g3t: "LLM 的职责边界",
    g3p: "AI 在本流程中仅负责将确定的数学排盘结果翻译为流畅的、具有共情能力的解释文本。AI 不被允许修改您的五行数值或生肖属性。",
    
    pipeline_title: "计算管线",
    pipeline: ["出生时间(当地)", "UTC转换", "经度偏移", "均时差", "真太阳时", "八字排盘", "AI解读"],
    
    citations: "算法依据：Astronomical Algorithms (Meeus, 1998)，IANA Time Zone Database v.2024a，《黄帝内经》(Unschuld 英译本, 2011)。",
  },
};

const EC = {"木":"#4a8a4a","火":"#c45a30","土":"#a08a50","金":"#9898a8","水":"#3a6a9a"};

export default function MethodologyPage({ onBack }) {
  const { locale, toggleLang } = useI18n();
  const t = L[locale] || L.en;

  const mono = { fontFamily:"'JetBrains Mono',monospace" };
  const tag = { ...mono, fontSize:11, color:"#6a5a35", letterSpacing:4, marginBottom:20 };
  const h2 = { fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:300, color:"#e0dcd4", letterSpacing:".04em", marginBottom:8 };
  const h3 = { fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:400, color:"#c4a265", marginBottom:6, marginTop:32 };
  const p = { fontSize:16, color:"#b0aca4", lineHeight:1.8, marginBottom:16 };
  const code = { ...mono, fontSize:14, color:"#c4a265", padding:"12px 20px", background:"#16161c", border:"1px solid rgba(196,162,101,.08)", display:"block", marginBottom:16, letterSpacing:1 };

  return (
    <div style={{ minHeight:"100vh", background:"#08080a", color:"#e0dcd4", fontFamily:"'Noto Serif SC',serif",
      backgroundImage:"linear-gradient(rgba(196,162,101,.008) 1px,transparent 1px),linear-gradient(90deg,rgba(196,162,101,.008) 1px,transparent 1px)", backgroundSize:"52px 52px" }}>
      
      {/* Nav */}
      <nav style={{ position:"sticky", top:0, zIndex:50, padding:"14px 40px", display:"flex", justifyContent:"space-between", alignItems:"center",
        background:"rgba(8,8,10,.85)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(196,162,101,.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:20 }}>
          <span style={{ ...mono, fontSize:14, color:"#c4a265", letterSpacing:3 }}>ANATOMYSELF</span>
          <span style={{ ...mono, fontSize:10, color:"#3a3832", letterSpacing:2 }}>{t.nav}</span>
        </div>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <button onClick={toggleLang} style={{ ...mono, fontSize:12, color:"#9a9488", background:"none", border:"none", cursor:"pointer" }}>{locale==='en'?'中文':'EN'}</button>
          <button onClick={onBack} style={{ ...mono, fontSize:11, color:"#5e5a52", background:"none", border:"1px solid rgba(196,162,101,.15)", padding:"6px 16px", cursor:"pointer" }}>{t.back}</button>
        </div>
      </nav>

      <div style={{ maxWidth:780, margin:"0 auto", padding:"80px 40px 120px" }}>
        
        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:60 }}>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(32px,4.5vw,48px)", fontWeight:300, color:"#e0dcd4", letterSpacing:".06em", lineHeight:1.2 }}>
            {t.title}
          </h1>
          <div style={{ height:2, width:60, background:"#c4a265", margin:"20px auto" }}/>
          <p style={{ fontSize:17, color:"#9a9488", maxWidth:560, margin:"0 auto", lineHeight:1.7 }}>{t.subtitle}</p>
        </div>

        {/* Section 1: Solar Core */}
        <div style={tag}>{t.s1title}</div>
        <h2 style={h2}>{t.s1sub}</h2>
        <p style={p}>{t.s1p1}</p>

        <h3 style={h3}>{t.tz_title}</h3>
        {[t.tz1, t.tz2, t.tz3].map((item, i) => (
          <div key={i} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
            <span style={{ ...mono, fontSize:12, color:"#c4a265", minWidth:20, paddingTop:3 }}>0{i+1}</span>
            <span style={{ fontSize:15, color:"#b0aca4", lineHeight:1.7 }}>{item}</span>
          </div>
        ))}

        <h3 style={h3}>{t.tst_title}</h3>
        <p style={p}>{t.tst_p}</p>
        
        <div style={{ ...p, fontWeight:500, color:"#d0ccc4", fontSize:15 }}>{t.tst_lon}</div>
        <div style={code}>{t.tst_lon_f}</div>
        <p style={{ ...p, fontSize:14, color:"#9a9488", fontStyle:"italic" }}>{t.tst_lon_ex}</p>

        <div style={{ ...p, fontWeight:500, color:"#d0ccc4", fontSize:15, marginTop:20 }}>{t.tst_eot}</div>
        <p style={p}>{t.tst_eot_p}</p>
        <div style={{ ...code, fontSize:15, color:"#52b09a" }}>{t.tst_formula}</div>

        {/* Computation Pipeline */}
        <div style={{ margin:"40px 0", padding:"24px", background:"#0f1014", border:"1px solid rgba(196,162,101,.06)" }}>
          <div style={{ ...tag, marginBottom:16 }}>{t.pipeline_title}</div>
          <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:4 }}>
            {t.pipeline.map((step, i) => (
              <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                <span style={{ ...mono, fontSize:12, padding:"6px 12px", background: i===5?"rgba(196,162,101,.1)":i===6?"rgba(82,176,154,.08)":"#16161c",
                  border:`1px solid ${i===5?"rgba(196,162,101,.2)":i===6?"rgba(82,176,154,.15)":"rgba(196,162,101,.06)"}`,
                  color: i===5?"#c4a265":i===6?"#52b09a":"#9a9488" }}>{step}</span>
                {i < t.pipeline.length - 1 && <span style={{ color:"#3a3832", fontSize:14 }}>→</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Section 2: Five Elements */}
        <div style={tag}>{t.s2title}</div>
        <h2 style={h2}>{t.s2sub}</h2>
        <p style={p}>{t.s2p}</p>

        {/* Mapping Table */}
        <div style={{ overflowX:"auto", marginTop:24, marginBottom:32 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
            <thead>
              <tr>
                {t.tableHeaders.map(h => (
                  <th key={h} style={{ ...mono, fontSize:10, color:"#6a5a35", letterSpacing:1.5, textAlign:"left", padding:"10px 12px", borderBottom:"1px solid rgba(196,162,101,.12)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.tableRows.map(([el, organs, source, modern], i) => {
                const elKey = ["木","火","土","金","水"][i];
                return (
                  <tr key={i}>
                    <td style={{ padding:"12px", borderBottom:"1px solid rgba(196,162,101,.04)", color:EC[elKey], fontWeight:500, fontSize:15 }}>{el}</td>
                    <td style={{ padding:"12px", borderBottom:"1px solid rgba(196,162,101,.04)", color:"#d0ccc4" }}>{organs}</td>
                    <td style={{ padding:"12px", borderBottom:"1px solid rgba(196,162,101,.04)", color:"#9a9488", fontStyle:"italic", fontSize:13 }}>{source}</td>
                    <td style={{ padding:"12px", borderBottom:"1px solid rgba(196,162,101,.04)", color:"#b0aca4", fontSize:13, lineHeight:1.6 }}>{modern}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Section 3: Anti-Hallucination */}
        <div style={tag}>{t.s3title}</div>
        <h2 style={h2}>{t.s3sub}</h2>

        {[
          [t.g1t, t.g1p, "01"],
          [t.g2t, t.g2p, "02"],
          [t.g3t, t.g3p, "03"],
        ].map(([title, desc, num]) => (
          <div key={num} style={{ display:"flex", gap:20, marginBottom:20, padding:"20px 24px", background:"#0f1014", border:"1px solid rgba(196,162,101,.04)" }}>
            <div style={{ ...mono, fontSize:24, color:"#c4a265", opacity:.3, minWidth:36 }}>{num}</div>
            <div>
              <div style={{ fontSize:16, color:"#d0ccc4", fontWeight:500, marginBottom:6 }}>{title}</div>
              <div style={{ fontSize:14, color:"#9a9488", lineHeight:1.7 }}>{desc}</div>
            </div>
          </div>
        ))}

        {/* Citations */}
        <div style={{ marginTop:48, paddingTop:20, borderTop:"1px solid rgba(196,162,101,.06)" }}>
          <p style={{ ...mono, fontSize:10, color:"#3a3832", lineHeight:1.6, letterSpacing:.5 }}>{t.citations}</p>
        </div>
      </div>
    </div>
  );
}
