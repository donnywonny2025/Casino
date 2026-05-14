// ===== INPUT.JS — Submit, keyboard, simulate, undo, flash, timing, voice, boot =====
// Depends on: state.js, signals.js, predict.js, render.js

// ===== ENGINE LOG WRITER =====
// Writes every spin to .tmp/engine_log.jsonl via server
// AI reads this via: tail -5 .tmp/engine_log.jsonl (sub-second, no screenshots)
function writeLog(num, color) {
  if (!pred) return;
  
  // Compute live confluence metrics
  let last20 = hist.slice(0, 20);
  let rc = last20.filter(h => h.color === 'red').length;
  let bc = last20.filter(h => h.color === 'black').length;
  let hc = last20.filter(h => h.num >= 19 && h.num <= 36).length;
  let lc = last20.filter(h => h.num >= 1 && h.num <= 18).length;
  let oc = last20.filter(h => h.num > 0 && h.num !== 100 && h.num % 2 === 1).length;
  let ec = last20.filter(h => h.num > 0 && h.num !== 100 && h.num % 2 === 0).length;
  let d1 = last20.filter(h => h.num >= 1 && h.num <= 12).length;
  let d2 = last20.filter(h => h.num >= 13 && h.num <= 24).length;
  let d3 = last20.filter(h => h.num >= 25 && h.num <= 36).length;
  
  // Color streak
  let streakColor = hist.length > 0 ? hist[0].color : 'none';
  let streakLen = 0;
  for (let i = 0; i < hist.length; i++) {
    if (hist[i].color === streakColor) streakLen++;
    else break;
  }
  
  // Confluence count: how many dimensions agree with the prediction
  let confluence = 0;
  if (pred.color !== 'pass') {
    // Color trend (last 20)
    if (pred.color === 'red' && rc > bc) confluence++;
    if (pred.color === 'black' && bc > rc) confluence++;
    // Color streak (3+)
    if (streakLen >= 3 && streakColor === pred.color) confluence++;
    // High/Low alignment
    if (pred.color === 'red' || pred.color === 'black') {
      // RED numbers lean toward odd/high statistically
      if (hc > lc + 2) confluence++; // HIGH is running
      if (ec > oc + 2) confluence++; // EVEN is running
    }
    // Dozen heat
    if (d2 > d1 + 2 || d3 > d1 + 2) confluence++;
  }
  
  let logEntry = {
    spin: hist.length,
    num: dn(num),
    color: color,
    pred: pred.color,
    conf: pred.conf,
    bet: pred.bet || { label: 'WAIT', size: 0 },
    streak: { color: streakColor, length: streakLen },
    dozens: { d1, d2, d3 },
    highLow: { high: hc, low: lc },
    oddEven: { odd: oc, even: ec },
    redBlack: { red: rc, black: bc },
    confluence: confluence,
    bankroll: Math.round(bankroll * 100) / 100,
    wl: { w: wins, l: losses, pct: (wins + losses) > 0 ? Math.round(wins / (wins + losses) * 100) + '%' : '-' },
    result: null // filled in after scoring
  };
  
  // If we just scored this spin, add the result
  if (outcomeLog.length > 0) {
    let lastOutcome = outcomeLog[outcomeLog.length - 1];
    logEntry.result = lastOutcome.result;
  }
  
  // Fire and forget — don't wait for response
  fetch('/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logEntry)
  }).catch(() => {}); // Silent fail — never block the UI
}

// ===== INPUT HANDLING =====
function submit(val) {
  let tokens = val.trim().split(/[\s,]+/).filter(t => t.length);
  let isBulk = tokens.length > 1; // Multi-number paste = bulk mode

  if (isBulk) {
    tokens.reverse(); // Board reads newest-left, so reverse for chronological
    console.log(`[Input] Bulk priming ${tokens.length} spins — scoring & Gemini suppressed`);
    // Reset W/L before priming so phantom results don't pollute
    wins = 0; losses = 0; streak = 0;
    outcomeLog = [];
    signalHits = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
    signalTotal = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
    hist = []; // Clear history — fresh prime
  }

  tokens.forEach(tok => {
    let n = parseNum(tok);
    if (n === null) return;
    let color = getC(n);

    // Score against prediction — ONLY in live mode (single number entry)
    if (!isBulk && pred && pred.color !== 'pass' && color !== 'green') {
      let won = pred.color === color;
      let betAmount = (pred.bet && pred.bet.size) || 0;
      if (won) {
        wins++; streak = streak >= 0 ? streak+1 : 1; flash('win');
        bankroll += betAmount; // 1:1 payout on color bet
      } else {
        losses++; streak = streak <= 0 ? streak-1 : -1; flash('loss');
        bankroll -= betAmount;
      }
      if (bankroll < 0) bankroll = 0; // Can't go negative
      if (bankroll > sessionHigh) sessionHigh = bankroll;

      // P&L log entry
      if (betAmount > 0) {
        plLog.push({
          spin: hist.length + 1,
          bet: betAmount,
          label: pred.bet.label,
          predicted: pred.color.toUpperCase(),
          actual: color.toUpperCase(),
          result: won ? 'WIN' : 'LOSS',
          delta: won ? betAmount : -betAmount,
          balance: bankroll
        });
        if (plLog.length > 200) plLog.shift();
      }

      outcomeLog.push({ predicted:pred.color.toUpperCase(), actual:color.toUpperCase(), result:won?'WIN':'LOSS', tof:0 });
      if (outcomeLog.length > 50) outcomeLog.shift();
      // Track per-signal accuracy with recency decay
      if (pred.signals) {
        pred.signals.forEach(s => {
          if (s.vote !== 'pass') {
            signalHits[s.label] = (signalHits[s.label]||0) * 0.95;
            signalTotal[s.label] = (signalTotal[s.label]||0) * 0.95;
            signalTotal[s.label] += 1;
            if (s.vote === color) signalHits[s.label] += 1;
          }
        });
      }
    }
    // Green (0/00) still costs the bet if we were betting
    if (!isBulk && color === 'green' && pred && pred.bet && pred.bet.size > 0 && pred.color !== 'pass') {
      bankroll -= pred.bet.size;
      if (bankroll < 0) bankroll = 0;
      losses++; streak = streak <= 0 ? streak-1 : -1;
      plLog.push({ spin: hist.length+1, bet: pred.bet.size, label: pred.bet.label, predicted: pred.color.toUpperCase(), actual: 'GREEN', result: 'LOSS', delta: -pred.bet.size, balance: bankroll });
      flash('green');
    } else if (!isBulk && color === 'green') {
      flash('green');
    }

    hist.unshift({ num:n, color, tof:0 });
    dealerChanged = false;
  });

  // Run prediction once after all numbers are loaded
  predict();
  render();
  updateBankrollUI();

  // Gemini: call in live mode normally, force-call on bulk prime for baseline analysis
  if (!isBulk && typeof maybeCallGemini === 'function') maybeCallGemini();
  if (!isBulk) speak();

  // Write to engine log for AI co-pilot (live mode only)
  if (!isBulk && tokens.length === 1) {
    let lastSpin = hist[0];
    if (lastSpin) writeLog(lastSpin.num, lastSpin.color);
  }

  if (isBulk) {
    console.log(`[Input] Prime complete — ${hist.length} spins loaded, engine ready`);
    flash('win'); // Green flash to confirm
    // Clear the log for new session, then write baseline
    fetch('/clear-log', { method: 'POST' }).then(() => {
      // Fire Gemini immediately — pre-compute the full statistical landscape
      // This gives the AI co-pilot a ready-made analysis before live play starts
      if (typeof callGemini === 'function') {
        console.log('[Input] Firing Gemini baseline analysis...');
        geminiLastCall = 0; // Reset so it fires immediately
        callGemini();
      }
    }).catch(() => {});
  }
}

document.getElementById('inp').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    let v = e.target.value;
    if (v.trim()) { submit(v); e.target.value = ''; }
  }
});

// ===== SIMULATE =====
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

// ===== BOOT =====
if (loadState()) {
  predict(); render(); updateBankrollUI();
} else {
  loadTelemetry().then(loaded => {
    if (loaded) { predict(); render(); updateBankrollUI(); }
    else { render(); }
  });
}
console.log('[Edge Engine v3.0] Booted —', hist.length, 'spins loaded');
