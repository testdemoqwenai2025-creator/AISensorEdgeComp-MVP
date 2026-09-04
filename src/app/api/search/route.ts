import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// =====================================================================
// /api/search — Natural-language query over AISensorEdgeComp
// ---------------------------------------------------------------------
// Uses z-ai-web-dev-sdk (server-side only) with a system prompt that
// grounds the model in the platform's architecture, verticals, team,
// and roadmap. Falls back to a rule-based answer if the LLM call fails.
// =====================================================================

const SYSTEM_PROMPT = `You are the AI assistant for AISensorEdgeComp — a planetary-scale IoT + edge AI platform that fuses multi-modal sensors (vibration, gas, vision, hyperspectral, mmWave, soil, weather, AIS, Earth observation) with edge AI silicon and time-series foundation models.

You answer questions from investors, design partners, and engineers. Always be:
- Specific: cite numbers (e.g., "0.89 AUC-ROC", "$547B TAM", "−63% inference cost")
- Concise: 2-4 sentences for direct questions, longer for "explain X" questions
- Honest: if you don't know something, say so and suggest emailing partners@aisensoredgecomp.ai

Key facts to draw on:
- TAM (2030): $547B (IoT Analytics). SAM: $84B. SOM (5-yr): $3.2B. CAGR: 21.7%.
- Four-layer stack: (1) Sensing — multi-modal sensor ontology + self-calibration mesh, (2) Connectivity — protocol-agnostic (OPC-UA/Modbus/MQTT/LoRaWAN/5G mMTC), LLM-assisted semantic normalization, (3) Edge Compute — KubeEdge + TinyML + WASM + liquid workload placement scheduler, (4) Intelligence — 350M-parameter time-series foundation model + Graph RAG + causal inference + LLM-native query.
- TS-FM benchmarks: 0.89 AUC-ROC zero-shot anomaly (vs. 0.82 Chronos baseline), 0.93 with 10-shot. Trained on 50M hours of public industrial data (NASA bearings, Case Western Reserve, SECOM, ARPA-E).
- Edge-cloud liquid placement: −63% inference cost, 4× lower p99 latency vs. cloud-only.
- Self-calibration mesh: 6.7% of manual recalibration cost, equivalent accuracy.
- Onboarding: 3 weeks vs. 6 months industry typical.
- Vertical wedges: Agriculture (v1 shipping Q1 2026, +18% yield / −30% input cost), Manufacturing (v2 Q3 2026, −42% downtime), Environment (v2 Q3 2026, −85% calibration cost), Energy (v3 2027), Smart City (v3 2027).
- Founders: Dr. Aarav Kapoor (CEO, ex-Cognite), Maya Rodriguez (CTO, ex-Microsoft Azure IoT), Dr. Jian Liu (Chief Scientist, ex-Augury), Sofia Costa (CRO, ex-Planet Labs). Combined 60+ years.
- Series A: $15–25M raising Q4 2026. Use of funds: 50% eng, 25% GTM, 15% compute+data, 10% G&A.
- Roadmap: Q1 2026 Agri MVP, Q3 2026 Manufacturing v1, Q4 2026 Series A close, Q1 2027 Platform GA, Q2 2027 International (EU+APAC).
- Compliance: SOC 2 Type II (Q1 2027), ISO 27001 (Q2 2027), IEC 62443 (Q3 2027), GDPR (live at GA), HIPAA (2028).
- Contacts: partners@aisensoredgecomp.ai (investors), design@aisensoredgecomp.ai (design partners), press@aisensoredgecomp.ai (press).

Differentiation:
- vs AWS IoT / Azure IoT: they sell plumbing, we sell the intelligence layer (TS-FM + Graph RAG + causal). We integrate with them.
- vs Cognite / Augury / Uptake: they go deep in one vertical with bespoke models. We go horizontal with a foundation model.
- vs Chronos / TimeGPT / Moment: they are models, not products. We are a product built on the same model family, with sensor fusion + edge runtime + query layer.

If asked about competitors, pricing specifics not in the briefing, or anything confidential: redirect to partners@aisensoredgecomp.ai.`;

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string" || query.length < 3) {
      return NextResponse.json(
        { error: "Query must be a non-empty string of at least 3 characters." },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      thinking: { type: "disabled" },
      temperature: 0.4,
      max_tokens: 600,
    });

    const answer =
      completion?.choices?.[0]?.message?.content ??
      "I couldn't generate an answer. Please try rephrasing, or email partners@aisensoredgecomp.ai for a direct response.";

    return NextResponse.json({
      query,
      answer: answer.trim(),
      timestamp: Date.now(),
      grounded: true,
    });
  } catch (err: any) {
    // Fallback: rule-based answers for common questions
    const fallback = ruleBasedFallback(request);
    return NextResponse.json({
      query: fallback.query,
      answer: fallback.answer,
      timestamp: Date.now(),
      grounded: false,
      fallback: true,
      error: err?.message,
    });
  }
}

async function ruleBasedFallback(request: Request): Promise<{ query: string; answer: string }> {
  let query = "";
  try {
    const body = await request.json();
    query = body?.query ?? "";
  } catch {
    query = "";
  }
  const lower = query.toLowerCase();
  let answer = "For detailed questions, please email partners@aisensoredgecomp.ai — our team responds within 24 hours.";

  if (/tam|market.*size/i.test(lower)) {
    answer = "TAM (2030): $547B (global IoT market, IoT Analytics). SAM (AI-enabled IIoT): $84B. SOM (5-yr target across agri + manufacturing + environment wedges): $3.2B. CAGR 2024–2030: 21.7%.";
  } else if (/zero.?shot|anomaly/i.test(lower)) {
    answer = "Our TS-FM achieves 0.89 AUC-ROC zero-shot on unseen asset classes — no labeled failures required. 10-shot raises to 0.93, 100-shot to 0.95. Beats Chronos-B1 baseline of 0.82. Trained on 50M hours of public industrial time-series.";
  } else if (/vertical|wedge/i.test(lower)) {
    answer = "Vertical-first go-to-market: Agriculture v1 (Q1 2026, +18% yield / −30% input cost), Manufacturing v2 (Q3 2026, −42% downtime), Environment v2 (Q3 2026, −85% calibration cost), Energy & Smart City v3 (2027).";
  } else if (/funding|series.*a|use of funds/i.test(lower)) {
    answer = "Raising $15–25M Series A, closing Q4 2026. Use of funds: 50% engineering (TS-FM v2, edge runtime v2, vertical teams), 25% GTM (sales + design partners), 15% compute + data, 10% G&A + runway. 18-month runway post-close.";
  } else if (/edge.*cloud|workload/i.test(lower)) {
    answer = "Liquid placement scheduler runs every 30s, scoring each inference job across latency, bandwidth cost, model accuracy drift, battery state, and carbon intensity. Reduces inference cost by 63% and p99 latency by 4× vs. hardcoded cloud-only placement.";
  } else if (/team|founder/i.test(lower)) {
    answer = "Four founders: Dr. Aarav Kapoor (CEO, ex-Cognite Eng Director), Maya Rodriguez (CTO, ex-Microsoft Azure IoT Principal Eng, KubeEdge maintainer), Dr. Jian Liu (Chief Scientist, ex-Augury Head of ML, 28 NeurIPS/ICML papers), Sofia Costa (CRO, ex-Planet Labs VP Sales Agri, $0→$40M ARR). Combined 60+ years.";
  } else if (/roi|return/i.test(lower)) {
    answer = "Vertical ROI: Agriculture +18% yield / −30% input cost. Manufacturing −42% unplanned downtime. Environment −85% calibration cost. Energy grid resilience (pending pilot).";
  } else if (/differ|competitor/i.test(lower)) {
    answer = "Unlike horizontal platforms (AWS IoT, Azure IoT) we sell the intelligence layer, not plumbing. Unlike vertical specialists (Augury, Cognite) we build a universal foundation model — every wedge compounds the same model. Unlike DIY open source (ThingsBoard, Eclipse Ditto) we ship the intelligence layer, not just plumbing.";
  }

  return { query, answer };
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/search",
    method: "POST",
    description: "Natural-language query grounded in AISensorEdgeComp's architecture, verticals, team, and roadmap.",
    body: { query: "string (min 3 chars)" },
    response: { query: "string", answer: "string", timestamp: "number", grounded: "boolean" },
  });
}
