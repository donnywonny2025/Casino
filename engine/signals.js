// ===== SIGNALS.JS — All prediction signals + meta-signals =====
// Depends on: state.js (WHEEL, RED, BLK, hist, getD, flightCV, signalHits, signalTotal)

// ===== RELIABILITY (recency-decayed signal tracking) =====
function getReliability(label) {
  let t = signalTotal[label] || 0;
  if (t < 5) return 0.4;
  return Math.max(0.1, Math.min(0.9, signalHits[label] / t));
}

// ===== DEALER PROFILING (EMA) =====
function dealerP(h) {
  let d = getD(h, 20);
  if (d.length < 2) return { sd:99, con:'UNKNOWN', changed:dealerChanged, velocity:0, dir:'?', drift:0 };
  let alpha = 0.3;
  let ema = d[0];
  for (let i = 1; i < d.length; i++) ema = alpha * d[i] + (1 - alpha) * ema;
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

// ===== SIGNAL: ZONE (Circular Centroid Clustering) =====
function sigZone(h) {
  let dp = dealerP(h);
  // Expand memory to 30 spins if dealer is erratic to filter out noise, keep it tight (8) if dealer is streaking
  let windowSize = dp.sd > 9.0 ? 30 : dp.sd > 6.0 ? 15 : 8;

  if (h.length < 8) return { vote:'pass', str:0, label:'ZONE', reliability:0 };
  let positions = h.slice(0, windowSize).map(s => WHEEL.indexOf(s.num)).filter(i => i >= 0);
  if (positions.length < 5) return { vote:'pass', str:0, label:'ZONE', reliability:0 };
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
  let dp = dealerP(h);
  // Expand frequency analysis window if erratic
  let windowSize = dp.sd > 9.0 ? 35 : 15;

  if (h.length < 8) return { vote:'pass', str:0, label:'FREQ', reliability:0 };
  let w = h.slice(0, windowSize).filter(s => s.color !== 'green');
  if (w.length < 8) return { vote:'pass', str:0, label:'FREQ', reliability:0 };
  let r = w.filter(s => s.color === 'red').length;
  let n = w.length, p = 18/38, expected = n*p, sd = Math.sqrt(n*p*(1-p));
  let z = (r - expected) / sd;
  if (Math.abs(z) < 0.8) return { vote:'pass', str:0, label:'FREQ', reliability:0 };
  let rel = getReliability('FREQ');
  return { vote: z > 0 ? 'red' : 'black', str: Math.min(Math.abs(z)/3, 1), label:'FREQ', reliability:rel };
}

// ===== SIGNAL: FLOW (N-2 Markov Chain) =====
function sigFlow(h) {
  if (h.length < 12) return { vote:'pass', str:0, label:'FLOW' };
  let valid = h.filter(s => s.color !== 'green');
  if (valid.length < 8) return { vote:'pass', str:0, label:'FLOW' };
  let c0 = valid[0].color, c1 = valid[1].color;
  let trans = { red:0, black:0 }, total = 0;
  for (let i = 2; i < valid.length - 1; i++) {
    if (valid[i].color === c1 && valid[i+1].color === c0) {
      if (i >= 1) { trans[valid[i-1].color]++; total++; }
    }
  }
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

// ===== SIGNAL: HOT (Number frequency spikes) =====
function sigHot(h) {
  if (h.length < 15) return { vote:'pass', str:0, label:'HOT', reliability:0 };
  let w = h.slice(0, 20), freq = {};
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

// ===== SIGNAL: ACCEL (Delta acceleration — second derivative) =====
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

// ===== META-SIGNAL: ENTROPY (pattern density modifier) =====
function getEntropy(h) {
  let valid = h.slice(0,12).filter(s => s.color !== 'green');
  if (valid.length < 10) return 1;
  let bigrams = {RR:0, RB:0, BR:0, BB:0};
  for (let i=0; i<valid.length-1; i++) {
    let k = (valid[i].color==='red'?'R':'B') + (valid[i+1].color==='red'?'R':'B');
    bigrams[k]++;
  }
  let total = Object.values(bigrams).reduce((a,b)=>a+b,0);
  let entropy = 0;
  Object.values(bigrams).forEach(c => { if(c>0){let p=c/total; entropy -= p*Math.log2(p);} });
  return entropy / 2.0;
}

console.log('[Signals] Module loaded — 6 signals + entropy');
