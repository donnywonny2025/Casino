// ===== GEMINI FLASH — Analytical Layer (v3.0) =====
// Advises bet sizing based on engine telemetry
// RULE: Gemini NEVER overrides the Bayesian prediction — advisory only

// ===== CONFIG =====
const GEMINI_CONFIG = {
  model: 'gemini-2.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
  callEveryN: 5,         // Call every 5 spins — not every spin
  maxHistoryTokens: 50,
  enabled: true,
  apiKey: 'AIzaSyDuJ5kKIL1KJO1U6Ov1UnOjzSACALEvlQc'
};

let geminiLastCall = 0;
let geminiInsight = null;
let geminiMemory = [];

// ===== PUBLIC API =====

function setGeminiKey(key) {
  GEMINI_CONFIG.apiKey = key.trim();
  GEMINI_CONFIG.enabled = !!GEMINI_CONFIG.apiKey;
  console.log('[Gemini]', GEMINI_CONFIG.enabled ? 'Enabled' : 'Disabled');
  updateGeminiUI();
}

function maybeCallGemini() {
  if (!GEMINI_CONFIG.enabled) return;
  if (hist.length < 10) return;
  if (hist.length - geminiLastCall < GEMINI_CONFIG.callEveryN) return;

  geminiLastCall = hist.length;
  callGemini();
}

function getGeminiInsight() {
  return geminiInsight;
}

// ===== PAYLOAD BUILDER (v3 — includes Bayesian data) =====

function buildPayload() {
  const recentHist = hist.slice(0, GEMINI_CONFIG.maxHistoryTokens);
  const dp = dealerP(hist);
  const p = pred || {};

  // Flight timing stats
  let flightStats = null;
  if (typeof flightTimes !== 'undefined' && flightTimes.length >= 3) {
    const ft = flightTimes.slice(-10);
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    const sd = Math.sqrt(ft.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / ft.length);
    flightStats = { avg: Math.round(avg), sd: Math.round(sd), count: flightTimes.length, cv: (sd/avg).toFixed(2) };
  }

  return {
    spinCount: hist.length,
    history: recentHist.slice(0, 20).map(h => `${dn(h.num)}-${h.color.toUpperCase()}`),
    dealer: { stdev: dp.sd, consistency: dp.con, changed: dp.changed },
    prediction: {
      color: p.color || 'pass',
      confidence: p.conf || 0,
      posterior: p.posterior || null,
      entropy: p.entropy || 0,
      momentum: p.momentum || 'neutral',
      votingSignals: p.votingSignals || 0,
      bet: p.bet || { size:0, label:'WAIT' }
    },
    accuracy: {
      wins, losses, streak,
      pct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0
    },
    flightStats: flightStats,
    outcomes: (typeof outcomeLog !== 'undefined') ? outcomeLog.slice(-10) : [],
    // Signal performance
    signalReliability: Object.keys(signalTotal).reduce((acc, k) => {
      acc[k] = signalTotal[k] >= 5 ? Math.round((signalHits[k] / signalTotal[k]) * 100) + '%' : 'calibrating';
      return acc;
    }, {})
  };
}

function buildPrompt(payload) {
  const p = payload.prediction;
  const flightLine = payload.flightStats
    ? `\n- Flight Timing: AVG ${(payload.flightStats.avg/1000).toFixed(1)}s, σ${(payload.flightStats.sd/1000).toFixed(2)}s, CV ${payload.flightStats.cv}`
    : '';

  const outcomesBlock = payload.outcomes.length > 0
    ? '\n\nRECENT OUTCOMES:\n' + payload.outcomes.slice(-5).map(o =>
        `- Predicted ${o.predicted} → Actual ${o.actual} = ${o.result}`
    ).join('\n')
    : '';

  const sigBlock = '\nSIGNAL RELIABILITY: ' + Object.entries(payload.signalReliability).map(([k,v]) => `${k}:${v}`).join(', ');

  return `You are a professional casino bankroll manager for a live roulette session. A Bayesian inference engine predicts the next color. Your job is to advise on bet sizing based on the engine's real-time accuracy and confidence.

DATA:
- ${payload.spinCount} spins tracked
- Engine Prediction: ${p.color.toUpperCase()} at ${p.confidence}% confidence
- Bayesian Posterior: ${p.posterior ? `Red ${p.posterior.red}% / Black ${p.posterior.black}%` : 'N/A'}
- Entropy: ${p.entropy}% (0=patterns, 100=random)
- Session Momentum: ${p.momentum.toUpperCase()}
- Kelly Recommendation: $${p.bet.size} ${p.bet.label}
- Engine Record: W${payload.accuracy.wins} L${payload.accuracy.losses} (${payload.accuracy.pct}% win rate)
- Streak: ${payload.accuracy.streak > 0 ? '+' + payload.accuracy.streak + ' wins' : payload.accuracy.streak + ' losses'}
- Active Signals: ${p.votingSignals} of 6${flightLine}${sigBlock}${outcomesBlock}

YOUR TASK:
Evaluate the engine's current state and recommend bet sizing. You are ADVISORY ONLY — the engine's prediction stands.

SIZING OPTIONS:
- MAX ($5): Engine hitting consistently AND high confidence AND strong streak
- STRONG ($3): Good accuracy, solid confidence, positive momentum
- BASE ($2): Normal performance, decent confidence
- HALF ($1): Engine struggling, low confidence, or recovering from losses
- LEAN ($0): Extreme uncertainty or cold streak — observe only

RULES:
- Do NOT override the engine's color prediction — ever
- Speak like a sharp friend at the table
- One sentence max

RESPOND IN PLAIN TEXT. NO JSON. NO MARKDOWN.
Format: [SIZING] - [One sentence why]`;
}

// ===== API CALL =====

async function callGemini() {
  if (!GEMINI_CONFIG.enabled) return;

  const payload = buildPayload();
  const prompt = buildPrompt(payload);

  updateGeminiUI('analyzing');

  try {
    const url = `${GEMINI_CONFIG.endpoint}?key=${GEMINI_CONFIG.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!res.ok) {
      if (res.status === 429) {
         window.LAST_ERR = 'Rate Limited. Waiting...';
         updateGeminiUI('offline');
         localAnalyticFallback(payload);
         return;
      }
      window.LAST_ERR = 'HTTP ' + res.status;
      updateGeminiUI('offline');
      localAnalyticFallback(payload);
      return;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      window.LAST_ERR = 'API Error: ' + (data.error?.message || 'Empty Response');
      updateGeminiUI('offline');
      localAnalyticFallback(payload);
      return;
    }

    // Parse sizing from response
    let sizing = 'BASE';
    if (text.includes('MAX')) sizing = 'MAX';
    else if (text.includes('STRONG')) sizing = 'STRONG';
    else if (text.includes('BASE')) sizing = 'BASE';
    else if (text.includes('HALF')) sizing = 'HALF';
    else if (text.includes('LEAN')) sizing = 'LEAN';

    geminiInsight = {
      sizing: sizing,
      confidence: payload.prediction.confidence,
      insight: text.trim().replace(/^.*?-\s*/, ''),
      timestamp: Date.now(),
      spinCount: hist.length
    };

    // Track Gemini sizing accuracy
    geminiMemory.push({
      sizing: sizing,
      engineColor: payload.prediction.color,
      engineConf: payload.prediction.confidence,
      kelly: payload.prediction.bet.label,
      spin: hist.length
    });
    if (geminiMemory.length > 20) geminiMemory.shift();
    try { localStorage.setItem('casino_gemini_memory', JSON.stringify(geminiMemory)); } catch(e){}

    renderGeminiInsight();
    updateGeminiUI('ready');

    // NO OVERRIDE — Gemini's opinion stays in its panel, period.

  } catch (e) {
    window.LAST_ERR = 'Network Error: ' + e.message;
    updateGeminiUI('offline');
    localAnalyticFallback(payload);
  }
}

// FALLBACK ANALYTICS (When API fails)
function localAnalyticFallback(payload) {
  let sizing = 'HALF';
  let reason = 'API offline — defaulting to conservative sizing.';
  const p = payload.prediction;

  if (p.confidence > 70 && payload.accuracy.pct > 55 && payload.accuracy.streak > 0) {
     sizing = 'STRONG';
     reason = 'Strong engine accuracy with positive momentum — sizing up.';
  } else if (p.confidence > 55 && payload.dealer.stdev < 8) {
     sizing = 'BASE';
     reason = 'Solid confidence with readable dealer.';
  } else if (payload.accuracy.streak <= -3) {
     sizing = 'LEAN';
     reason = 'Cold streak — observe until momentum shifts.';
  }

  geminiInsight = {
    sizing: sizing,
    confidence: p.confidence,
    insight: reason,
    timestamp: Date.now(),
    spinCount: hist.length
  };
  renderGeminiInsight();
}

// ===== UI =====

function updateGeminiUI(state) {
  const el = document.getElementById('geminiStatus');
  if (!el) return;

  switch (state) {
    case 'analyzing':
      el.textContent = '⟳ Analyzing...';
      el.style.color = '#8af';
      break;
    case 'ready':
      el.textContent = '✓ Gemini Active';
      el.style.color = '#34c759';
      break;
    case 'offline':
      el.textContent = '⚠️ API Error (Fallback Active)';
      el.style.color = '#ffcc00';
      break;
    default:
      el.textContent = GEMINI_CONFIG.enabled ? '● Gemini Ready' : '○ Gemini Offline';
      el.style.color = GEMINI_CONFIG.enabled ? '#34c759' : '#556';
  }
}

function renderGeminiInsight() {
  const el = document.getElementById('geminiInsight');
  if (!el || !geminiInsight) return;

  const g = geminiInsight;
  const sizingColors = {
    'MAX': '#ff2d55', 'STRONG': '#ff9f0a', 'BASE': '#34c759',
    'HALF': '#8af', 'LEAN': '#556'
  };
  const color = sizingColors[g.sizing] || '#889';

  el.innerHTML =
    `<div class="gem-pred" style="color:${color}; font-weight:700">${g.sizing} · ${g.confidence}%</div>` +
    `<div class="gem-text">${g.insight}</div>` +
    `<div class="gem-meta">@ spin ${g.spinCount}</div>`;
}

// Init UI
updateGeminiUI();
console.log('[Gemini v3.0] Module loaded — advisory mode, no override');
