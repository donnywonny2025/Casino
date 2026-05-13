// ===== PREDICT.JS — Bayesian inference, Kelly sizing, momentum, dealer detection =====
// Depends on: state.js, signals.js

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
  let edge = prob * 2 - 1;
  if (edge <= 0.02) return { size:0, label:'LEAN' };
  let fraction = edge * 0.25;
  let bet = Math.max(1, Math.min(5, Math.round(bankroll * fraction)));
  if (bet > bankroll * 0.25) bet = Math.max(1, Math.floor(bankroll * 0.25));
  if (streak <= -3) bet = Math.min(bet, 1);
  if (streak <= -5) { return { size:0, label:'LEAN' }; }
  if (bankroll < sessionHigh * 0.6) { return { size:0, label:'STOP' }; }
  let label = bet >= 5 ? 'MAX' : bet >= 3 ? 'STRONG' : bet >= 2 ? 'BASE' : 'HALF';
  return { size:bet, label };
}

// ===== BAYESIAN PREDICTION ENGINE =====
function predict() {
  let dp = dealerP(hist);
  if (hist.length < 3) return pred = { color:'pass', conf:0, reason:'Priming (need 3+ spins)', signals:[], dp, targets:[], bet:{size:0,label:'WAIT'} };

  // Auto dealer detection
  if (detectDealerShift() && !dealerChanged) {
    softReset = 8;
    console.log('[Predict] Auto dealer shift detected — soft reset active');
  }
  if (softReset > 0) softReset--;

  // Collect all signals
  let signals = [sigDealer(hist), sigZone(hist), sigFreq(hist), sigFlow(hist), sigHot(hist), sigAccel(hist)];

  // Entropy meta-signal — modifies reliability
  let entropy = getEntropy(hist);
  signals.forEach(s => {
    if (s.label === 'FLOW' || s.label === 'HOT') s.reliability *= (1 + (1-entropy)*0.3);
    if (s.label === 'DEALER' || s.label === 'ACCEL') s.reliability *= (1 + entropy*0.2);
  });

  // Bayesian posterior updating
  let pRed = 18/38, pBlack = 18/38;
  let votingSignals = 0;

  signals.forEach(s => {
    if (s.vote === 'pass' || !s.str) return;
    let lr = 1 + (s.str * (s.reliability || 0.3));
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
  if (momentum === 'hot') { pRed *= 1.05; pBlack *= 1.05; }
  if (momentum === 'cold') { let d = 0.92; pRed = 0.5 + (pRed-0.5)*d; pBlack = 0.5 + (pBlack-0.5)*d; }

  // Re-normalize
  total = pRed + pBlack;
  pRed /= total; pBlack /= total;

  // Soft reset dampening
  if (softReset > 0) {
    let d = 0.6 + (8-softReset)*0.05;
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

console.log('[Predict] Module loaded — Bayesian inference + Kelly');
