// ===== GEMINI FLASH — Analytical Layer =====
// Calls Gemini 2.0 Flash every N spins for pattern analysis
// Falls back gracefully if API unavailable

// ===== CONFIG =====
const GEMINI_CONFIG = {
  model: 'gemini-2.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
  callEveryN: 1,        // Call on EVERY spin for agentic learning
  maxHistoryTokens: 50,  // Send at most this many spins
  enabled: true,
  apiKey: 'AIzaSyDuJ5kKIL1KJO1U6Ov1UnOjzSACALEvlQc'
};

let geminiLastCall = 0;   // Spin count at last Gemini call
let geminiInsight = null;  // Latest Gemini analysis
let geminiWeights = null;  // Weight adjustments from Gemini
let geminiPending = null;  // Awaiting the result of the next spin
let geminiMemory = [];     // History of Gemini's predictions and actual outcomes

// ===== PUBLIC API =====

/** Set the API key and enable Gemini */
function setGeminiKey(key) {
  GEMINI_CONFIG.apiKey = key.trim();
  GEMINI_CONFIG.enabled = !!GEMINI_CONFIG.apiKey;
  console.log('[Gemini]', GEMINI_CONFIG.enabled ? 'Enabled' : 'Disabled');
  updateGeminiUI();
}

/** Check if Gemini should fire, and call if so */
function maybeCallGemini() {
  if (!GEMINI_CONFIG.enabled) return;

  // Evaluate pending prediction as soon as the spin arrives
  if (geminiPending && hist.length >= geminiPending.targetSpin) {
    if (geminiPending.prediction !== 'pass' && hist[0].color !== 'green') {
      const won = (hist[0].color === geminiPending.prediction);
      geminiMemory.push({
        predicted: geminiPending.prediction.toUpperCase(),
        actual: hist[0].color.toUpperCase(),
        won: won,
        insight: geminiPending.insight
      });
      if (geminiMemory.length > 5) geminiMemory.shift(); // Keep last 5
    }
    geminiPending = null;
  }

  if (hist.length < 10) return;
  if (hist.length - geminiLastCall < GEMINI_CONFIG.callEveryN) return;

  geminiLastCall = hist.length;
  callGemini();
}

/** Get Gemini's weight adjustments (returns null if no data) */
function getGeminiWeights() {
  return geminiWeights;
}

/** Get Gemini's latest insight text */
function getGeminiInsight() {
  return geminiInsight;
}

// ===== CORE =====

// ===== PAYLOAD BUILDER =====

function buildPayload() {
  const recentHist = hist.slice(0, GEMINI_CONFIG.maxHistoryTokens);
  const deltas = getD(hist, 20);
  const dp = dealerP(hist);
  const p = pred || predict(hist);

  // Flight timing stats (from live spacebar taps)
  let flightStats = null;
  if (typeof flightTimes !== 'undefined' && flightTimes.length >= 3) {
    const ft = flightTimes.slice(-10);
    const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
    const sd = Math.sqrt(ft.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / ft.length);
    flightStats = { avg: Math.round(avg), sd: Math.round(sd), count: flightTimes.length, cv: (sd/avg).toFixed(2) };
  }

  return {
    spinCount: hist.length,
    history: recentHist.map(h => `${dn(h.num)}-${h.color.toUpperCase()}`),
    deltas: deltas,
    dealer: {
      stdev: dp.sd,
      consistency: dp.con,
      changed: dp.changed
    },
    prediction: p,
    accuracy: { wins, losses, streak, pct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0 },
    flightStats: flightStats,
    outcomes: (typeof outcomeLog !== 'undefined') ? outcomeLog.slice(-10) : []
  };
}

function buildPrompt(payload) {
  const flightLine = payload.flightStats
    ? `\n- Flight Timing: AVG ${(payload.flightStats.avg/1000).toFixed(1)}s, σ${(payload.flightStats.sd/1000).toFixed(2)}s, CV ${payload.flightStats.cv} (${payload.flightStats.count} throws)`
    : '';

  const outcomesBlock = payload.outcomes.length > 0
    ? '\n\nRECENT OUTCOMES (Learn from these):\n' + payload.outcomes.map(o =>
        `- Predicted ${o.predicted} → Actual ${o.actual} = ${o.result}${o.tof ? ' (' + (o.tof/1000).toFixed(1) + 's flight)' : ''}`
    ).join('\n')
    : '';

  return `You are a professional casino bankroll manager for a live roulette session. A separate deterministic math engine predicts the next color based on wheel physics and statistical flow. 
Your ONLY job is to tell the player how much to bet (sizing) on the current spin based on the engine's real-time accuracy and confidence.

DATA:
- ${payload.spinCount} spins tracked
- Engine Prediction: ${payload.prediction.color.toUpperCase()} (${payload.prediction.conf || 0}% confidence)
- Engine Record: W${payload.accuracy.wins} L${payload.accuracy.losses} (${payload.accuracy.pct}% win rate)
- Engine Streak: ${payload.accuracy.streak > 0 ? '+' + payload.accuracy.streak + ' wins' : payload.accuracy.streak + ' losses'}${flightLine}${outcomesBlock}

YOUR TASK:
Analyze the engine's performance and the current confidence level to determine the optimal bet sizing to protect the bankroll and maximize returns.

SIZING OPTIONS:
- MAX: Use only when the engine is hitting consistently (strong win rate/streak) AND the current confidence is very high.
- BASE: The standard bet. Use when the engine is performing normally and confidence is solid.
- HALF: Use when the engine is struggling, confidence is low, or you are recovering from a bad streak. Default to this instead of sitting out.

RULES:
- Do NOT mention dealers, stdev, volatility, or technical jargon.
- Speak like a sharp friend at the table giving you real risk-management advice.

RESPOND IN PLAIN TEXT. NO JSON. NO MARKDOWN.
Format: [SIZING] - [One sentence explaining why]`;
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

    // Since we output plain text, there is ZERO chance of a JSON parse error!
    let sizing = 'PASS';
    if (text.includes('MAX')) sizing = 'MAX';
    else if (text.includes('BASE')) sizing = 'BASE';
    else if (text.includes('HALF')) sizing = 'HALF';

    geminiInsight = {
      prediction: sizing, // We use the prediction field to store the bet size visually
      confidence: payload.prediction.conf,
      insight: text.trim().replace(/^.*?- /, ''), // Strip the prefix from the sentence
      reasoning: '',
      timestamp: Date.now(),
      spinCount: hist.length
    };
    
    // Auto-save memory
    try { localStorage.setItem('casino_gemini_memory', JSON.stringify(geminiMemory)); } catch(e){}

    renderGeminiInsight();
    updateGeminiUI('ready');

    // Override the top UI if Gemini decides the risk is too high to bet
    if (sizing === 'PASS') {
      const hp = document.getElementById('hPred');
      if (hp) {
        hp.className = 'hero-pred h-pass';
        hp.textContent = 'PASS';
      }
      const hs = document.getElementById('hSub');
      if (hs) {
        hs.innerHTML = `<span class="hero-conf hc-lo" style="color: #ff9f0a">Gemini Risk Override</span><span class="hero-bet" style="opacity: 0.5">SIT OUT</span>`;
      }
      const ht = document.getElementById('hTargets');
      if (ht) ht.innerHTML = '';
    }

  } catch (e) {
    window.LAST_ERR = 'Network Error: ' + e.message;
    updateGeminiUI('offline');
    localAnalyticFallback(payload);
  }
}

// FALLBACK ANALYTICS (When API fails)
function localAnalyticFallback(payload) {
  let sizing = 'PASS';
  let reason = 'API OFFLINE: Local Safety Protocol Active';
  
  if (payload.prediction.conf > 70 && payload.dealer.stdev < 8.0) {
     sizing = 'BASE';
     reason = 'Strong physical lock with stable dealer. Sizing up.';
  } else if (payload.prediction.conf > 40 && payload.dealer.stdev < 10.0) {
     sizing = 'HALF';
     reason = 'Moderate edge detected. Conservative sizing advised.';
  } else if (payload.accuracy.streak <= -3) {
     sizing = 'PASS';
     reason = 'Cold streak detected. Halting all bets for recovery.';
  } else {
     sizing = 'PASS';
     reason = 'Establishing new baseline. Sit this one out.';
  }
  
  geminiInsight = {
    prediction: sizing,
    confidence: payload.prediction.conf,
    insight: reason,
    reasoning: 'LOCAL FALLBACK',
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
      el.textContent = '⚠️ API Error (Auto-Retrying)';
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
  const colorStyle = g.prediction === 'red' ? 'color:#ff2d55'
    : g.prediction === 'black' ? 'color:#ccc'
      : 'color:#556';

  el.innerHTML =
    `<div class="gem-pred" style="${colorStyle}">${g.prediction.toUpperCase()} ${g.confidence}%</div>` +
    `<div class="gem-text">${g.insight}</div>` +
    `<div class="gem-meta">@ spin ${g.spinCount}</div>`;
}

// Init UI
updateGeminiUI();
