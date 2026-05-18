// ===== GEMINI FLASH — Background Table Analyst (v4.0) =====
// Runs every 10 spins. Writes statistical table analysis to server log.
// AI co-pilot reads this alongside engine_log.jsonl for faster analysis.
// DOES NOT predict. DOES NOT size bets. Just crunches numbers.

// ===== CONFIG =====
const GEMINI_CONFIG = {
  model: 'gemini-2.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
  callEveryN: 10,        // Analyze every 10 spins — background task
  maxHistoryTokens: 50,
  enabled: false,  // Starts disabled, enabled once key loads from server
  apiKey: ''       // NEVER hardcode — loaded from /api/config (reads .env)
};

let geminiLastCall = 0;
let geminiInsight = null;

// Auto-load API key from server (.env) on boot
(async function loadGeminiKey() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    if (cfg.geminiKey) {
      GEMINI_CONFIG.apiKey = cfg.geminiKey;
      GEMINI_CONFIG.enabled = true;
      console.log('[Gemini] API key loaded from server');
      updateGeminiUI();
    } else {
      console.warn('[Gemini] No API key in .env');
    }
  } catch(e) {
    console.warn('[Gemini] Could not load config:', e.message);
  }
})();

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

// ===== PAYLOAD BUILDER =====

function buildPayload() {
  const recent = hist.slice(0, 30);
  const dp = dealerP(hist);

  // Compute raw stats for Gemini to analyze
  let rc = recent.filter(h => h.color === 'red').length;
  let bc = recent.filter(h => h.color === 'black').length;
  let gc = recent.filter(h => h.color === 'green').length;
  let hc = recent.filter(h => h.num >= 19 && h.num <= 36).length;
  let lc = recent.filter(h => h.num >= 1 && h.num <= 18).length;
  let oc = recent.filter(h => h.num > 0 && h.num !== 100 && h.num % 2 === 1).length;
  let ec = recent.filter(h => h.num > 0 && h.num !== 100 && h.num % 2 === 0).length;
  let d1 = recent.filter(h => h.num >= 1 && h.num <= 12).length;
  let d2 = recent.filter(h => h.num >= 13 && h.num <= 24).length;
  let d3 = recent.filter(h => h.num >= 25 && h.num <= 36).length;

  // Streak analysis
  let streaks = [];
  let curStreak = { color: recent[0]?.color, len: 0 };
  recent.forEach(h => {
    if (h.color === curStreak.color) curStreak.len++;
    else { if (curStreak.len > 0) streaks.push({...curStreak}); curStreak = { color: h.color, len: 1 }; }
  });
  if (curStreak.len > 0) streaks.push(curStreak);
  let avgStreakLen = streaks.length ? (streaks.reduce((a,s) => a + s.len, 0) / streaks.length).toFixed(1) : '0';
  let maxStreak = streaks.length ? Math.max(...streaks.map(s => s.len)) : 0;

  // Current streak
  let currentStreakColor = hist.length > 0 ? hist[0].color : 'none';
  let currentStreakLen = 0;
  for (let i = 0; i < hist.length; i++) {
    if (hist[i].color === currentStreakColor) currentStreakLen++;
    else break;
  }

  // Dozen drought detection
  let d1drought = 0, d2drought = 0, d3drought = 0;
  for (let i = 0; i < Math.min(hist.length, 50); i++) {
    let n = hist[i].num;
    if (n >= 1 && n <= 12) break;
    d1drought++;
  }
  for (let i = 0; i < Math.min(hist.length, 50); i++) {
    let n = hist[i].num;
    if (n >= 13 && n <= 24) break;
    d2drought++;
  }
  for (let i = 0; i < Math.min(hist.length, 50); i++) {
    let n = hist[i].num;
    if (n >= 25 && n <= 36) break;
    d3drought++;
  }

  return {
    spinCount: hist.length,
    last10: hist.slice(0, 10).map(h => `${dn(h.num)}(${h.color[0].toUpperCase()})`).join(' → '),
    color: { red: rc, black: bc, green: gc, total: recent.length },
    highLow: { high: hc, low: lc },
    oddEven: { odd: oc, even: ec },
    dozens: { d1, d2, d3 },
    dozenDrought: { d1: d1drought, d2: d2drought, d3: d3drought },
    streaks: { current: `${currentStreakColor} × ${currentStreakLen}`, avgLen: avgStreakLen, maxLen: maxStreak },
    dealer: { stdev: dp.sd, consistency: dp.con },
    accuracy: { wins, losses, pct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0 }
  };
}

function buildPrompt(p) {
  return `You are a professional statistical analyst for a live American Roulette session. Analyze the following data comprehensively. This analysis will be read by an AI co-pilot who is advising a human player in real-time. Make every word count.

DATA (last ${p.color.total} spins of ${p.spinCount} total):
- Last 10: ${p.last10}
- Colors: Red ${p.color.red} / Black ${p.color.black} / Green ${p.color.green}
- High(19-36)/Low(1-18): High ${p.highLow.high} / Low ${p.highLow.low}
- Odd/Even: Odd ${p.oddEven.odd} / Even ${p.oddEven.even}
- Dozens: D1(1-12)=${p.dozens.d1} D2(13-24)=${p.dozens.d2} D3(25-36)=${p.dozens.d3}
- Dozen Droughts: D1 last hit ${p.dozenDrought.d1} spins ago, D2 last hit ${p.dozenDrought.d2} spins ago, D3 last hit ${p.dozenDrought.d3} spins ago
- Streaks: Current ${p.streaks.current}, Avg streak length ${p.streaks.avgLen}, Max streak ${p.streaks.maxLen}
- Dealer: σ${p.dealer.stdev} (${p.dealer.consistency})
- Engine Record: W${p.accuracy.wins}/L${p.accuracy.losses} (${p.accuracy.pct}%)

Expected baseline for American Roulette (38 pockets): Red 47.4%, Black 47.4%, Green 5.3%, High 47.4%, Low 47.4%, Each Dozen 31.6%.

PRODUCE A FULL ANALYSIS (plain text, no markdown). Include ALL of the following:

1. TABLE MODE: Streak mode (long runs) or chop mode (rapid alternating)? How pronounced?

2. DISTRIBUTION DEVIATIONS: For each dimension (Red/Black, High/Low, Odd/Even, Dozens), state the ACTUAL percentage vs EXPECTED percentage. Flag anything more than 5% off baseline.

3. TRANSITION PATTERNS: Based on the last 10 sequence, what tends to follow RED? What follows BLACK? Is there an alternating or continuation pattern?

4. STREAK ANALYSIS: Current streak details. Historical streak continuation rate from this data. After a streak of 3+, how often does it continue vs break in this session?

5. DOZEN ROTATION: Which dozen is hottest? Which is coldest? Any rotation pattern visible? (e.g., D2-D3-D2-D3 cycling, D1 frozen out)

6. HOT ZONES: Based on the High/Low and Dozen data combined, which region of the board (1-6, 7-12, 13-18, 19-24, 25-30, 31-36) seems most active?

7. DANGER SIGNALS: Anything that suggests the table is about to shift character? Dealer variance issues? Approaching mean reversion?

8. NEXT 3 PREDICTIONS: Give your best statistical read for the next 3 spins:
   - Next spin: RED or BLACK? Why?
   - Spin after: Same or different? Why?  
   - Third spin: What do you expect? Why?

9. CONFIDENCE: On a scale of 1-10, how readable is this table right now? (10 = strong clear patterns, 1 = pure noise)`;
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
      window.LAST_ERR = 'HTTP ' + res.status;
      updateGeminiUI('offline');
      localFallback(payload);
      return;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      window.LAST_ERR = 'Empty response';
      updateGeminiUI('offline');
      localFallback(payload);
      return;
    }

    geminiInsight = {
      analysis: text.trim(),
      timestamp: Date.now(),
      spinCount: hist.length
    };

    renderGeminiInsight();
    updateGeminiUI('ready');

    // Also write to server log so AI co-pilot can read it
    fetch('/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'gemini_analysis',
        spin: hist.length,
        analysis: text.trim(),
        raw: payload
      })
    }).catch(() => {});

  } catch (e) {
    window.LAST_ERR = 'Network Error: ' + e.message;
    updateGeminiUI('offline');
    localFallback(payload);
  }
}

// LOCAL FALLBACK (when API is unavailable)
function localFallback(p) {
  let lines = [];
  
  // Table mode
  let avgStreak = parseFloat(p.streaks.avgLen);
  if (avgStreak >= 2.5) lines.push('TABLE MODE: STREAKY — long runs forming, ride them');
  else if (avgStreak <= 1.5) lines.push('TABLE MODE: CHOPPY — alternating, wait for patterns');
  else lines.push('TABLE MODE: MIXED — no clear rhythm');
  
  // Dominant bias
  let biases = [];
  if (p.color.red > p.color.black + 3) biases.push('RED dominant');
  if (p.color.black > p.color.red + 3) biases.push('BLACK dominant');
  if (p.highLow.high > p.highLow.low + 3) biases.push('HIGH running');
  if (p.highLow.low > p.highLow.high + 3) biases.push('LOW running');
  if (p.oddEven.even > p.oddEven.odd + 3) biases.push('EVEN hot');
  if (p.oddEven.odd > p.oddEven.even + 3) biases.push('ODD hot');
  lines.push('BIAS: ' + (biases.length ? biases.join(', ') : 'No strong bias'));
  
  // Droughts
  let droughts = [];
  if (p.dozenDrought.d1 >= 8) droughts.push(`D1 drought (${p.dozenDrought.d1} spins)`);
  if (p.dozenDrought.d2 >= 8) droughts.push(`D2 drought (${p.dozenDrought.d2} spins)`);
  if (p.dozenDrought.d3 >= 8) droughts.push(`D3 drought (${p.dozenDrought.d3} spins)`);
  lines.push('WATCH: ' + (droughts.length ? droughts.join(', ') : 'No significant droughts'));

  let analysis = lines.join('\n');
  
  geminiInsight = {
    analysis: analysis,
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
      el.textContent = '✓ Analyst Active';
      el.style.color = '#34c759';
      break;
    case 'offline':
      el.textContent = '⚠ Local Fallback';
      el.style.color = '#ffcc00';
      break;
    default:
      el.textContent = GEMINI_CONFIG.enabled ? '● Analyst Ready' : '○ Analyst Offline';
      el.style.color = GEMINI_CONFIG.enabled ? '#34c759' : '#556';
  }
}

function renderGeminiInsight() {
  const el = document.getElementById('geminiInsight');
  if (!el || !geminiInsight) return;

  const g = geminiInsight;
  el.innerHTML =
    `<div style="white-space:pre-line; font-family:'Inter',monospace; font-size:11px; line-height:1.5; color:#aab;">${g.analysis}</div>` +
    `<div class="gem-meta" style="font-size:9px; opacity:0.4; margin-top:6px;">@ spin ${g.spinCount}</div>`;
}

// Init UI
updateGeminiUI();
console.log('[Gemini v4.0] Table Analyst — background stats, no predictions');
