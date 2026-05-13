// ===== ROULETTE EDGE ENGINE v3.0 — Bayesian Inference Core =====
// Signals: DEALER (EMA+flight), ZONE (circular cluster), FREQ (z-score),
//          FLOW (N-2 Markov), HOT (number spikes), ACCEL (delta derivative)
// Meta: ENTROPY (pattern density modifier)
// Architecture: Bayesian posterior updating, Kelly criterion sizing

const WHEEL = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,100,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2];
const RED  = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLK  = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

let hist = [];
let wins = 0, losses = 0, streak = 0;
let pred = null;
let bankroll = 22.03;
let sessionHigh = 22.03;
let signalHits = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
let signalTotal = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
let softReset = 0; // countdown after auto dealer detection

// Flight CV helper
function flightCV() {
  if (flightTimes.length < 3) return 999;
  let a = flightTimes.reduce((s,v)=>s+v,0)/flightTimes.length;
  let sd = Math.sqrt(flightTimes.reduce((s,v)=>s+Math.pow(v-a,2),0)/flightTimes.length);
  return sd/a;
}
let outcomeLog = [];
let flightTimes = [];
let flightStart = 0;
let timingActive = false;
let chronoEnabled = false;
let dealerChanged = false;

function getC(n) { if (n===0||n===100) return 'green'; return RED.has(n)?'red':'black'; }
function dn(n) { return n===100?'00':String(n); }
function parseNum(v) { v=v.trim().toLowerCase(); if(v==='00') return 100; let n=parseInt(v); if(isNaN(n)||n<0||n>36) return null; return n; }

// ===== PHYSICS: Wheel Deltas =====
function getD(h, count) {
  let d = [];
  let c = Math.min(count, h.length-1);
  for (let i=0; i<c; i++) {
    let ci = WHEEL.indexOf(h[i].num), pi = WHEEL.indexOf(h[i+1].num);
    if (ci===-1||pi===-1) continue;
    let diff = ci - pi;
    if (diff < -19) diff += 38;
    if (diff > 19) diff -= 38;
    d.push(diff);
  }
  return d;
}

// ===== DEALER PROFILING (EMA — Exponential Moving Average) =====
function dealerP(h) {
  let d = getD(h, 20);
  if (d.length < 2) return { sd:99, con:'UNKNOWN', changed:dealerChanged, velocity:0, dir:'?', drift:0 };
  // EMA: exponential decay weighting — recent throws count more
  let alpha = 0.3; // decay factor — higher = more weight on recent
  let ema = d[0];
  for (let i = 1; i < d.length; i++) ema = alpha * d[i] + (1 - alpha) * ema;
  // Variance still uses full window for stability
  let avg = d.reduce((a,b)=>a+b,0)/d.length;
  let variance = d.reduce((a,b)=>a+Math.pow(b-avg,2),0)/d.length;
  let sd = Math.round(Math.sqrt(variance)*10)/10;
  let con = sd < 4 ? 'READABLE' : sd < 8 ? 'MODERATE' : 'ERRATIC';
  let dir = ema >= 0 ? 'CW' : 'CCW';
  let drift = d.length > 5 ? Math.abs(d.slice(0,3).reduce((a,b)=>a+b,0)/3 - d.slice(-3).reduce((a,b)=>a+b,0)/3) : 0;
  return { sd, con, changed:dealerChanged, velocity:Math.round(Math.abs(ema)), dir, drift:Math.round(drift*10)/10, readable: sd < 8, ema };
}

// ===== SIGNAL: DEALER (EMA Physics + Flight Timing) =====
function sigDealer(h) {
  let d = getD(h, 10);
  if (d.length < 2) return { vote:'pass', str:0, label:'DEALER', reliability:0 };
  let dp = dealerP(h);
  if (!dp.readable) return { vote:'pass', str:0, label:'DEALER', reliability:0.1 };
  let ema = dp.ema || d.slice(0,3).reduce((a,b)=>a+b,0)/Math.min(3,d.length);
  let lastIdx = WHEEL.indexOf(h[0].num);
  let projIdx = Math.round(lastIdx + ema);
  projIdx = ((projIdx % 38) + 38) % 38;
  let projNum = WHEEL[projIdx];
  let projColor = getC(projNum);
  if (projColor === 'green') return { vote:'pass', str:0, label:'DEALER', reliability:0 };
  let str = Math.max(0, 1 - dp.sd/15);
  // Flight timing multiplier
  let cv = flightCV();
  if (cv < 0.08) str *= 1.5;
  else if (cv < 0.15) str *= 1.2;
  else if (cv < 999 && cv > 0.30) str *= 0.5;
  str = Math.min(str, 1);
  let rel = getReliability('DEALER');
  return { vote:projColor, str, label:'DEALER', target:projNum, reliability:rel };
}

// ===== SIGNAL: ZONE (Circular Centroid Clustering — replaces SECTOR) =====
function sigZone(h) {
  if (h.length < 15) return { vote:'pass', str:0, label:'ZONE', reliability:0 };
  let positions = h.slice(0, 15).map(s => WHEEL.indexOf(s.num)).filter(i => i >= 0);
  if (positions.length < 10) return { vote:'pass', str:0, label:'ZONE', reliability:0 };
  let sinSum = positions.reduce((a,p) => a + Math.sin(2*Math.PI*p/38), 0);
  let cosSum = positions.reduce((a,p) => a + Math.cos(2*Math.PI*p/38), 0);
  let R = Math.sqrt(sinSum*sinSum + cosSum*cosSum) / positions.length;
  if (R < 0.2) return { vote:'pass', str:0, label:'ZONE', reliability:0 };
  let centroid = Math.atan2(sinSum, cosSum) / (2*Math.PI) * 38;
  if (centroid < 0) centroid += 38;
  let centIdx = Math.round(centroid) % 38;
  let zone = [];
  for (let o=-3; o<=3; o++) zone.push(WHEEL[((centIdx+o)%38+38)%38]);
  let rZ = zone.filter(n => RED.has(n)).length;
  let bZ = zone.filter(n => BLK.has(n)).length;
  let vote = rZ > bZ ? 'red' : 'black';
  let rel = getReliability('ZONE');
  return { vote, str: R*0.8, label:'ZONE', reliability:rel, centroid:centIdx, concentration:R };
}

// ===== SIGNAL: FREQ (Z-Score Red/Black Distribution) =====
function sigFreq(h) {
  if (h.length < 12) return { vote:'pass', str:0, label:'FREQ', reliability:0 };
  let w = h.slice(0, 30).filter(s => s.color !== 'green');
  if (w.length < 8) return { vote:'pass', str:0, label:'FREQ', reliability:0 };
  let r = w.filter(s => s.color === 'red').length;
  let n = w.length, p = 18/38, expected = n*p, sd = Math.sqrt(n*p*(1-p));
  let z = (r - expected) / sd;
  if (Math.abs(z) < 0.8) return { vote:'pass', str:0, label:'FREQ', reliability:0 };
  let rel = getReliability('FREQ');
  return { vote: z > 0 ? 'red' : 'black', str: Math.min(Math.abs(z)/3, 1), label:'FREQ', reliability:rel };
}

// ===== SIGNAL: FLOW (N-2 Markov Chain — two-step-back transitions) =====
function sigFlow(h) {
  if (h.length < 12) return { vote:'pass', str:0, label:'FLOW' };
  let valid = h.filter(s => s.color !== 'green');
  if (valid.length < 8) return { vote:'pass', str:0, label:'FLOW' };
  // N-2: look at the TWO most recent colors, then count what followed that pair
  let c0 = valid[0].color, c1 = valid[1].color; // current pair
  let trans = { red:0, black:0 }, total = 0;
  for (let i = 2; i < valid.length - 1; i++) {
    if (valid[i].color === c1 && valid[i+1].color === c0) {
      // Found the same N-2 pair in history — what came before it?
      if (i >= 1) { trans[valid[i-1].color]++; total++; }
    }
  }
  // Fallback to N-1 if not enough N-2 matches
  if (total < 2) {
    trans = { red:0, black:0 }; total = 0;
    for (let i=1; i<valid.length-1; i++) {
      if (valid[i].color === c0) { trans[valid[i-1].color]++; total++; }
    }
  }
  if (total < 3) return { vote:'pass', str:0, label:'FLOW' };
  let rPct = trans.red/total, bPct = trans.black/total;
  let bias = Math.abs(rPct - bPct);
  if (bias < 0.08) return { vote:'pass', str:0, label:'FLOW' };
  let rel = getReliability('FLOW');
  return { vote: rPct > bPct ? 'red' : 'black', str: bias*3, label:'FLOW', reliability:rel };
}

// ===== SIGNAL: HOT (Statistically significant number frequency) =====
function sigHot(h) {
  if (h.length < 30) return { vote:'pass', str:0, label:'HOT', reliability:0 };
  let w = h.slice(0, 50), freq = {};
  w.forEach(s => { freq[s.num] = (freq[s.num]||0)+1; });
  let expected = w.length / 38;
  let hotNums = [];
  for (let [num, count] of Object.entries(freq)) {
    let z = (count - expected) / Math.sqrt(expected * (1 - 1/38));
    if (z > 1.5) hotNums.push({ num:parseInt(num), count, z });
  }
  if (!hotNums.length) return { vote:'pass', str:0, label:'HOT', reliability:0 };
  let hotR = hotNums.filter(h => RED.has(h.num)).length;
  let hotB = hotNums.filter(h => BLK.has(h.num)).length;
  let vote = hotR > hotB ? 'red' : hotB > hotR ? 'black' : 'pass';
  let rel = getReliability('HOT');
  return { vote, str: Math.min(hotNums[0].z/3, 1), label:'HOT', reliability:rel||0.3, hotNums };
}

// ===== SIGNAL: ACCEL (Delta Acceleration — second derivative) =====
function sigAccel(h) {
  let d = getD(h, 12);
  if (d.length < 6) return { vote:'pass', str:0, label:'ACCEL', reliability:0 };
  let accel = [];
  for (let i=0; i<d.length-1; i++) accel.push(d[i] - d[i+1]);
  let avgA = accel.reduce((a,b)=>a+b,0)/accel.length;
  let aSD = Math.sqrt(accel.reduce((a,b)=>a+Math.pow(b-avgA,2),0)/accel.length);
  if (aSD > 3 || Math.abs(avgA) < 0.5) return { vote:'pass', str:0, label:'ACCEL', reliability:0 };
  let projDelta = d[0] + avgA;
  let lastIdx = WHEEL.indexOf(h[0].num);
  let projIdx = Math.round(lastIdx + projDelta);
  projIdx = ((projIdx % 38) + 38) % 38;
  let projNum = WHEEL[projIdx];
  let projColor = getC(projNum);
  if (projColor === 'green') return { vote:'pass', str:0, label:'ACCEL', reliability:0 };
  let rel = getReliability('ACCEL');
  return { vote:projColor, str:Math.min(Math.abs(avgA)/3, 0.8), label:'ACCEL', reliability:rel||0.3, target:projNum };
}

// ===== META-SIGNAL: ENTROPY (pattern density — modifies other signals) =====
function getEntropy(h) {
  let valid = h.slice(0,20).filter(s => s.color !== 'green');
  if (valid.length < 10) return 1; // assume random
  let bigrams = {RR:0, RB:0, BR:0, BB:0};
  for (let i=0; i<valid.length-1; i++) {
    let k = (valid[i].color==='red'?'R':'B') + (valid[i+1].color==='red'?'R':'B');
    bigrams[k]++;
  }
  let total = Object.values(bigrams).reduce((a,b)=>a+b,0);
  let entropy = 0;
  Object.values(bigrams).forEach(c => { if(c>0){let p=c/total; entropy -= p*Math.log2(p);} });
  return entropy / 2.0; // 0=pure pattern, 1=pure random
}

// ===== RELIABILITY (recency-decayed signal tracking) =====
function getReliability(label) {
  let t = signalTotal[label] || 0;
  if (t < 5) return 0.4; // default until enough data
  return Math.max(0.1, Math.min(0.9, signalHits[label] / t));
}

// ===== SESSION MOMENTUM =====
function getMomentum() {
  let recent = outcomeLog.slice(-15);
  if (recent.length < 5) return 'neutral';
  let w = recent.filter(o => o.result === 'WIN').length;
  let rate = w / recent.length;
  if (rate > 0.65) return 'hot';
  if (rate < 0.35) return 'cold';
  return 'neutral';
}

// ===== AUTO DEALER DETECTION =====
function detectDealerShift() {
  if (hist.length < 10) return false;
  let r5 = getD(hist, 5), p5 = getD(hist.slice(5), 5);
  if (r5.length < 3 || p5.length < 3) return false;
  let rAvg = r5.reduce((a,b)=>a+b,0)/r5.length;
  let pAvg = p5.reduce((a,b)=>a+b,0)/p5.length;
  let rSD = Math.sqrt(r5.reduce((a,b)=>a+Math.pow(b-rAvg,2),0)/r5.length);
  let pSD = Math.sqrt(p5.reduce((a,b)=>a+Math.pow(b-pAvg,2),0)/p5.length);
  return Math.abs(rSD - pSD) > 4 || Math.abs(rAvg - pAvg) > 6;
}

// ===== KELLY CRITERION BET SIZING =====
function kellyBet(prob) {
  let edge = prob * 2 - 1; // for even-money bet
  if (edge <= 0.02) return { size:0, label:'LEAN' };
  let fraction = edge * 0.25; // quarter-Kelly for safety
  let bet = Math.max(1, Math.min(5, Math.round(bankroll * fraction)));
  // Anti-ruin guardrails
  if (bet > bankroll * 0.25) bet = Math.max(1, Math.floor(bankroll * 0.25));
  if (streak <= -3) bet = Math.min(bet, 1);
  if (streak <= -5) { bet = 0; return { size:0, label:'LEAN' }; }
  if (bankroll < sessionHigh * 0.6) { bet = 0; return { size:0, label:'STOP' }; }
  let label = bet >= 5 ? 'MAX' : bet >= 3 ? 'STRONG' : bet >= 2 ? 'BASE' : 'HALF';
  return { size:bet, label };
}

// ===== BAYESIAN PREDICTION ENGINE =====
function predict() {
  let dp = dealerP(hist);
  if (hist.length < 3) return pred = { color:'pass', conf:0, reason:'Priming (need 3+ spins)', signals:[], dp, targets:[], bet:{size:0,label:'WAIT'} };

  // Auto dealer detection
  if (detectDealerShift() && !dealerChanged) {
    softReset = 8; // dampen for 8 spins
    console.log('[Engine] Auto dealer shift detected — soft reset active');
  }
  if (softReset > 0) softReset--;

  // Collect all signals
  let signals = [sigDealer(hist), sigZone(hist), sigFreq(hist), sigFlow(hist), sigHot(hist), sigAccel(hist)];

  // Entropy meta-signal — modifies reliability
  let entropy = getEntropy(hist);
  // Low entropy = patterns dominate → boost FLOW/HOT reliability
  // High entropy = random → boost DEALER/ACCEL reliability
  signals.forEach(s => {
    if (s.label === 'FLOW' || s.label === 'HOT') s.reliability *= (1 + (1-entropy)*0.3);
    if (s.label === 'DEALER' || s.label === 'ACCEL') s.reliability *= (1 + entropy*0.2);
  });

  // Bayesian posterior updating
  let pRed = 18/38, pBlack = 18/38;
  let votingSignals = 0;

  signals.forEach(s => {
    if (s.vote === 'pass' || !s.str) return;
    let lr = 1 + (s.str * (s.reliability || 0.3)); // likelihood ratio
    votingSignals++;
    if (s.vote === 'red') { pRed *= lr; pBlack /= (lr * 0.5 + 0.5); }
    else { pBlack *= lr; pRed /= (lr * 0.5 + 0.5); }
  });

  // Normalize
  let pGreen = 2/38;
  let total = pRed + pBlack + pGreen;
  pRed /= total; pBlack /= total;

  // Momentum adjustment
  let momentum = getMomentum();
  if (momentum === 'hot') { pRed *= 1.05; pBlack *= 1.05; } // small boost to winner
  if (momentum === 'cold') { let d = 0.92; pRed = 0.5 + (pRed-0.5)*d; pBlack = 0.5 + (pBlack-0.5)*d; }

  // Re-normalize after momentum
  total = pRed + pBlack;
  pRed /= total; pBlack /= total;

  // Soft reset dampening
  if (softReset > 0) {
    let d = 0.6 + (8-softReset)*0.05; // gradually restore
    pRed = 0.5 + (pRed - 0.5) * d;
    pBlack = 0.5 + (pBlack - 0.5) * d;
  }

  let winner = pRed >= pBlack ? 'red' : 'black';
  let conf = Math.round(Math.max(pRed, pBlack) * 100);
  conf = Math.min(conf, 95);
  if (dealerChanged && softReset > 4) conf = Math.min(conf, 55);

  // Kelly bet sizing
  let bet = kellyBet(Math.max(pRed, pBlack));

  // Targets (pocket prediction when physics is strong)
  let targets = [];
  let dealerSig = signals.find(s => s.label === 'DEALER');
  let accelSig = signals.find(s => s.label === 'ACCEL');
  let bestPhys = (dealerSig && dealerSig.target !== undefined && dp.sd < 6) ? dealerSig :
                 (accelSig && accelSig.target !== undefined && dp.sd < 8) ? accelSig : null;
  if (bestPhys) {
    let ti = WHEEL.indexOf(bestPhys.target);
    for (let o=-2; o<=2; o++) targets.push(WHEEL[((ti+o)%38+38)%38]);
  }

  let reason = dp.con === 'ERRATIC' ? `High Variance (σ ${dp.sd})` :
    `Dealer ${dp.velocity}${dp.dir} σ${dp.sd} (${dp.con})`;
  if (momentum !== 'neutral') reason += ` [${momentum.toUpperCase()}]`;

  return pred = { color:winner, conf, reason, signals, dp, targets, bet,
    posterior:{ red:Math.round(pRed*1000)/10, black:Math.round(pBlack*1000)/10 },
    entropy:Math.round(entropy*100), momentum, votingSignals };
}

// ===== DOM RENDERING =====
function render() {
  let p = pred || predict();

  // Hero Prediction
  let hPred = document.getElementById('hPred');
  let hLabel = document.getElementById('hLabel');
  if (p.color === 'pass') {
    hPred.textContent = 'PASS'; hPred.className = 'hero-pred h-pass';
    hLabel.textContent = 'Awaiting Signal';
  } else {
    hPred.textContent = p.color.toUpperCase(); hPred.className = 'hero-pred h-' + p.color;
    hLabel.textContent = 'Strike Zone: ' + p.color.toUpperCase();
  }

  // Confidence + Kelly Bet Sizing
  let hSub = document.getElementById('hSub');
  let confClass = p.conf >= 70 ? 'hc-hi' : p.conf >= 55 ? 'hc-md' : 'hc-lo';
  let betInfo = p.bet || { size:0, label:'LEAN' };
  let betText = betInfo.size > 0 ? `$${betInfo.size} ${betInfo.label}` : betInfo.label;
  if (p.color !== 'pass') {
    let postStr = p.posterior ? ` <span style="font-size:9px;opacity:0.5">(${p.posterior.red}R/${p.posterior.black}B)</span>` : '';
    hSub.innerHTML = `<span class="hero-conf ${confClass}">${p.conf}%${postStr}</span><span class="hero-bet">${betText}</span>`;
  } else {
    hSub.innerHTML = `<span class="hero-conf hc-lo">—</span><span class="hero-bet">${betInfo.label === 'STOP' ? '⛔ WALK AWAY' : 'SIT OUT'}</span>`;
  }

  // Targets
  let hTargets = document.getElementById('hTargets');
  hTargets.innerHTML = p.targets.length ? 'TARGET: ' + p.targets.map(t => dn(t)).join(' · ') : '';
  let hNT = document.getElementById('hNumberTarget');
  let hNum = document.getElementById('hNum');
  if (p.targets.length) { hNT.style.display = 'flex'; hNum.textContent = dn(p.targets[2]); }
  else { hNT.style.display = 'none'; }

  // Zero Probability
  let greens = hist.filter(h => h.color === 'green').length;
  let zeroPct = hist.length ? Math.round((greens/hist.length)*100) : 0;
  document.getElementById('hZero').textContent = zeroPct + '%';
  document.getElementById('hZeroBar').style.width = Math.min(zeroPct*5, 100) + '%';

  // Hottest Pockets
  let freq = {};
  hist.slice(0,50).forEach(h => { freq[h.num] = (freq[h.num]||0)+1; });
  let sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,5);
  document.getElementById('hHot').innerHTML = sorted.map(([n,c]) => {
    let col = getC(parseInt(n)||0);
    let border = col==='red'?'rgba(255,45,85,0.4)':col==='green'?'rgba(52,199,89,0.4)':'rgba(255,255,255,0.15)';
    let color = col==='red'?'#ff2d55':col==='green'?'#34c759':'#ccc';
    return `<span class="hot-pocket" style="border-color:${border};color:${color}">${dn(parseInt(n))} <span style="font-size:9px;opacity:0.5">×${c}</span></span>`;
  }).join('');

  // Stats
  document.getElementById('sW').textContent = wins;
  document.getElementById('sL').textContent = losses;
  document.getElementById('sP').textContent = (wins+losses) ? Math.round(wins/(wins+losses)*100)+'%' : '—';
  let sK = document.getElementById('sK');
  if (streak > 0) { sK.textContent = 'W'+streak; sK.className = 'g'; }
  else if (streak < 0) { sK.textContent = 'L'+Math.abs(streak); sK.className = 'r'; }
  else { sK.textContent = '—'; sK.className = ''; }
  document.getElementById('sN').textContent = hist.length;

  // Dealer Telemetry
  let dp = p.dp || dealerP(hist);
  let conClass = dp.con==='READABLE'?'rd':dp.con==='MODERATE'?'md':'er';
  document.getElementById('dlr').innerHTML =
    `<div>VEL <b>${dp.velocity}${dp.dir}</b></div>` +
    `<div>σ <b class="${conClass}">${dp.sd}</b></div>` +
    `<div><b class="${conClass}">${dp.con}</b></div>` +
    (dp.drift > 3 ? `<div>DRIFT <b class="er">${dp.drift}</b></div>` : '') +
    (dp.changed ? `<div><b class="er">⚠ NEW DEALER</b></div>` : '');
  let alertText = dp.changed ? '⚠ Dealer change detected — recalibrating' :
    (softReset > 0 ? `⚠ Auto dealer shift — recalibrating (${softReset})` : '');
  document.getElementById('dA').textContent = alertText;

  // Signal Indicators (with reliability)
  document.getElementById('sigs').innerHTML = (p.signals||[]).map(s => {
    let dotClass = s.vote==='red'?'dr':s.vote==='black'?'db':'dp';
    let relBar = s.reliability ? `<span style="font-size:7px;opacity:0.4"> r${Math.round((s.reliability||0)*100)}</span>` : '';
    return `<div class="sig"><span class="dot ${dotClass}"></span>${s.label} ${s.vote!=='pass'?Math.round(s.str*100)+'%':'—'}${relBar}</div>`;
  }).join('') + (p.entropy !== undefined ? `<div class="sig" style="opacity:0.5">ENT ${p.entropy}%</div>` : '')
    + (p.momentum && p.momentum !== 'neutral' ? `<div class="sig" style="color:${p.momentum==='hot'?'#34c759':'#ff2d55'}">⚡ ${p.momentum.toUpperCase()}</div>` : '');

  // Frequency Counts
  let rc = hist.filter(h=>h.color==='red').length;
  let bc = hist.filter(h=>h.color==='black').length;
  let gc = hist.filter(h=>h.color==='green').length;
  document.getElementById('fR').textContent = rc;
  document.getElementById('fB').textContent = bc;
  document.getElementById('fG').textContent = gc;

  // Red/Black Balance
  let t = rc+bc||1;
  document.getElementById('balR').style.width = (rc/t*100)+'%';
  document.getElementById('balB').style.width = (bc/t*100)+'%';
  document.getElementById('bRI').textContent = 'Red: '+rc;
  document.getElementById('bBI').textContent = 'Black: '+bc;

  // Number Frequency Grid
  let ngrid = document.getElementById('ngrid');
  let allNums = [0,100,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36];
  ngrid.innerHTML = allNums.map(n => {
    let c = freq[n]||0;
    let col = getC(n);
    let bg = col==='red'?'rgba(255,45,85,'+(0.05+c*0.08)+')':col==='green'?'rgba(52,199,89,'+(0.05+c*0.08)+')':'rgba(255,255,255,'+(0.02+c*0.04)+')';
    let border = c>=3?'1px solid rgba(255,255,255,0.2)':'1px solid transparent';
    return `<div class="nc" style="background:${bg};border:${border}"><span class="nn">${dn(n)}</span><span class="ct">${c||''}</span></div>`;
  }).join('');

  // Session Timeline
  document.getElementById('tl').innerHTML = hist.slice(0,60).map(h => {
    let cls = h.color==='red'?'tr':h.color==='green'?'tg':'tbb';
    return `<div class="tb ${cls}" style="height:${8+Math.random()*14}px"></div>`;
  }).join('');

  // Spin Log
  let sl = document.getElementById('spinLog');
  sl.innerHTML = hist.map((h,i) => {
    let cls = h.color==='red'?'sr':h.color==='green'?'sg':'sb';
    return `<div class="se" onclick="deleteSpin(${i})"><div class="sc ${cls}">${dn(h.num)}</div><span class="si">#${hist.length-i}</span><span class="sx">✕</span></div>`;
  }).join('');

  // Persist state
  saveState();
}

// ===== INPUT HANDLING =====
function submit(val) {
  let tokens = val.trim().split(/[\s,]+/);
  tokens.reverse(); // Pasted boards are newest-left, so reverse for chronological processing
  tokens.forEach(tok => {
    let n = parseNum(tok);
    if (n === null) return;
    let color = getC(n);

    // Score against prediction
    if (pred && pred.color !== 'pass' && color !== 'green') {
      let won = pred.color === color;
      if (won) { wins++; streak = streak >= 0 ? streak+1 : 1; flash('win'); }
      else { losses++; streak = streak <= 0 ? streak-1 : -1; flash('loss'); }
      outcomeLog.push({ predicted:pred.color.toUpperCase(), actual:color.toUpperCase(), result:won?'WIN':'LOSS', tof:0 });
      if (outcomeLog.length > 50) outcomeLog.shift();
      // Track per-signal accuracy with recency decay
      if (pred.signals) {
        pred.signals.forEach(s => {
          if (s.vote !== 'pass') {
            // Decay old data so recent performance dominates
            signalHits[s.label] = (signalHits[s.label]||0) * 0.95;
            signalTotal[s.label] = (signalTotal[s.label]||0) * 0.95;
            signalTotal[s.label] += 1;
            if (s.vote === color) signalHits[s.label] += 1;
          }
        });
      }
      // Update session high
      if (bankroll > sessionHigh) sessionHigh = bankroll;
    }
    if (color === 'green') flash('green');

    hist.unshift({ num:n, color, tof:0 });
    dealerChanged = false;
    predict();
  });
  render();
  updateBankrollUI();
  if (typeof maybeCallGemini === 'function') maybeCallGemini();
  speak();
}

document.getElementById('inp').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    let v = e.target.value;
    if (v.trim()) { submit(v); e.target.value = ''; }
  }
});

// ===== SIMULATE RANDOM SPIN =====
function sim() {
  let n = WHEEL[Math.floor(Math.random()*38)];
  submit(dn(n));
  document.getElementById('simRes').innerHTML = `<span style="color:${getC(n)==='red'?'#ff2d55':getC(n)==='green'?'#34c759':'#aab'}">${dn(n)}</span>`;
}

// ===== UNDO / DELETE =====
function undoLastSpin() {
  if (!hist.length) return;
  hist.shift();
  predict(); render();
}
function deleteSpin(i) {
  hist.splice(i, 1);
  predict(); render();
}

// ===== DEALER CHANGE =====
function forceDealerChange() {
  dealerChanged = true;
  wins = 0; losses = 0; streak = 0;
  predict(); render();
}

// ===== FLASH FEEDBACK =====
function flash(type) {
  let f = document.getElementById('flash');
  f.className = 'flash ' + type;
  setTimeout(() => { f.className = 'flash'; }, 500);
}

// ===== FLIGHT TIMING (SPACEBAR) =====
function triggerTiming() {
  if (!timingActive) {
    flightStart = performance.now();
    timingActive = true;
    document.getElementById('timingState').textContent = '● TIMING';
    document.getElementById('timingState').style.color = '#ff2d55';
    document.getElementById('timingClock').textContent = '...';
    document.getElementById('timingClock').style.color = '#ff2d55';
  } else {
    let dur = Math.round(performance.now() - flightStart);
    flightTimes.push(dur);
    if (flightTimes.length > 20) flightTimes.shift();
    timingActive = false;
    document.getElementById('timingState').textContent = '● IDLE';
    document.getElementById('timingState').style.color = '#556';
    document.getElementById('timingClock').textContent = (dur/1000).toFixed(2) + 's';
    document.getElementById('timingClock').style.color = '#34c759';
    renderTimingBars();
    document.getElementById('inp').focus();
  }
}
function undoFlightTime() {
  flightTimes.pop();
  renderTimingBars();
}
function renderTimingBars() {
  if (!flightTimes.length) return;
  let avg = flightTimes.reduce((a,b)=>a+b,0)/flightTimes.length;
  let sd = Math.sqrt(flightTimes.reduce((a,b)=>a+Math.pow(b-avg,2),0)/flightTimes.length);
  let cv = (sd/avg);
  document.getElementById('timingBars').innerHTML = flightTimes.slice(-10).map(t => {
    let diff = Math.abs(t-avg);
    let cls = diff < sd*0.5 ? 't-consistent' : diff < sd*1.5 ? 't-moderate' : 't-erratic';
    let h = Math.max(6, Math.min(32, (t/avg)*16));
    return `<div class="timing-bar ${cls}" style="height:${h}px"><span class="tval">${(t/1000).toFixed(1)}</span></div>`;
  }).join('');
  document.getElementById('timingStats').innerHTML =
    `AVG ${(avg/1000).toFixed(2)}s · σ${(sd/1000).toFixed(2)}s · CV ${cv.toFixed(2)} · ${flightTimes.length} throws`;
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && chronoEnabled && document.activeElement.id !== 'inp') {
    e.preventDefault(); triggerTiming();
  }
  if (e.code === 'Escape' && timingActive) {
    timingActive = false;
    document.getElementById('timingState').textContent = '● CANCELLED';
    document.getElementById('timingClock').textContent = 'TAP';
    document.getElementById('timingClock').style.color = '#2a2d3a';
  }
});

document.getElementById('chrono').addEventListener('click', () => {
  chronoEnabled = !chronoEnabled;
  document.getElementById('chrono').textContent = chronoEnabled ? '[SPACE] clock ON' : '[SPACE] clock off';
  document.getElementById('timingStrip').style.display = chronoEnabled ? 'block' : 'none';
});

// ===== VOICE SYNTHESIS (TTS) =====
function speak() {
  if (!pred || pred.color === 'pass' || !window.speechSynthesis) return;
  let msg = new SpeechSynthesisUtterance(pred.color);
  msg.rate = 1.5; msg.pitch = 1; msg.volume = 0.6;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(msg);
}

// ===== BANKROLL =====
function updateBankrollUI() {
  let el = document.getElementById('bankrollVal');
  if (el) el.textContent = '$' + bankroll.toFixed(2);
}

// ===== PERSISTENCE =====
function saveState() {
  try {
    localStorage.setItem('casino_state', JSON.stringify({
      hist, wins, losses, streak, pred, outcomeLog, bankroll, sessionHigh,
      signalHits, signalTotal
    }));
  } catch(e) {}
}
function loadState() {
  try {
    let s = JSON.parse(localStorage.getItem('casino_state'));
    if (s && s.hist && s.hist.length) {
      hist = s.hist; wins = s.wins||0; losses = s.losses||0; streak = s.streak||0;
      outcomeLog = s.outcomeLog||[];
      bankroll = s.bankroll || 22.03;
      sessionHigh = s.sessionHigh || bankroll;
      let defSig = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
      signalHits = { ...defSig, ...(s.signalHits||{}) };
      signalTotal = { ...defSig, ...(s.signalTotal||{}) };
      predict(); render(); updateBankrollUI();
      return true;
    }
  } catch(e) {}
  return false;
}

// ===== TELEMETRY.JSON LOADER (fallback when localStorage is empty) =====
async function loadTelemetry() {
  try {
    let res = await fetch('telemetry.json?t=' + Date.now());
    let data = await res.json();
    if (data.hist && data.hist.length) {
      hist = data.hist;
      wins = data.wins || 0; losses = data.losses || 0; streak = data.streak || 0;
      predict(); render(); updateBankrollUI();
      console.log('[Edge Engine] Loaded', hist.length, 'spins from telemetry.json');
      return true;
    }
  } catch(e) { console.warn('[Edge Engine] telemetry.json not available:', e.message); }
  return false;
}

// ===== TELEMETRY SAVE (for Gemini) =====
function saveTelemetry() {
  try {
    let data = JSON.stringify({ hist, wins, losses, streak, pred, geminiInsight: typeof geminiInsight !== 'undefined' ? geminiInsight : null });
    localStorage.setItem('casino_telemetry', data);
  } catch(e) {}
}

// ===== BOOT =====
if (!loadState()) {
  // No localStorage — try loading from telemetry.json
  loadTelemetry().then(loaded => {
    if (!loaded) render();
  });
} else {
  render();
}
console.log('[Edge Engine v3.0] Booted —', hist.length, 'spins loaded');
