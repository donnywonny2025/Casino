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

// ===== KELLY CRITERION BET SIZING (bankroll-aware & variance-throttled) =====
// Calibrated for $10 bankroll: LEAN=$0.50, BASE=$1.00, STRONG=$1.50, MAX=$2.00
function kellyBet(prob, sd) {
  let edge = prob * 2 - 1; // Edge over even-money bet
  let health = startBankroll > 0 ? bankroll / startBankroll : 1;

  // === LIMITS ===
  if (bankroll <= 2) return { size:0, label:'STOP', reason:'Bankroll critical — walk away' };
  if (edge <= 0.02) return { size:0, label:'LEAN', reason:'No edge detected' };

  // === BANKROLL-PROPORTIONAL SIZING ===
  // Quarter-Kelly limits variance while maximizing compound growth
  let fraction = edge * 0.25; 
  let rawBet = bankroll * fraction;

  // Cold streak dampening
  if (streak <= -3) rawBet = Math.min(rawBet, 0.5);
  if (streak <= -5) return { size:0, label:'LEAN', reason:'High variance — sit out' };

  // Round to nearest $0.50 increment, minimum $0.50
  let bet = Math.max(0.5, Math.round(rawBet * 2) / 2);
  
  // === PHYSICAL VARIANCE THROTTLE ===
  if (sd >= 9.0) {
    bet = Math.min(bet, 0.5); // Cap at LEAN
  }

  // Hard cap: never risk more than 20% of remaining bankroll
  bet = Math.min(bet, bankroll * 0.20);
  bet = Math.min(bet, 2.00); // Absolute max $2.00 on a $10 roll
  bet = Math.max(0.5, Math.round(bet * 2) / 2); // Re-snap to $0.50 grid

  let label;
  if (bet >= 2.0) label = 'MAX';
  else if (bet >= 1.5) label = 'STRONG';
  else if (bet >= 1.0) label = 'BASE';
  else label = 'LEAN';

  return { size: bet, label };
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

  // Momentum adjustment — cold = sit out, hot = tiny nudge only
  let momentum = getMomentum();
  if (momentum === 'hot') { pRed *= 1.02; pBlack *= 1.02; } // Was 1.05 — too aggressive
  if (momentum === 'cold') {
    // Force PASS when cold — engine was 23W/16R wrong during cold streaks
    return pred = { color:'pass', conf:0, reason:'Cold streak — sitting out', signals, dp, targets:[], bet:{size:0,label:'SIT'}, momentum:'cold' };
  }

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
  let bet = kellyBet(Math.max(pRed, pBlack), dp.sd);

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
