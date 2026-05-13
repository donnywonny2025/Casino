// ===== INPUT.JS — Submit, keyboard, simulate, undo, flash, timing, voice, boot =====
// Depends on: state.js, signals.js, predict.js, render.js

// ===== INPUT HANDLING =====
function submit(val) {
  let tokens = val.trim().split(/[\s,]+/);
  tokens.reverse();
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
            signalHits[s.label] = (signalHits[s.label]||0) * 0.95;
            signalTotal[s.label] = (signalTotal[s.label]||0) * 0.95;
            signalTotal[s.label] += 1;
            if (s.vote === color) signalHits[s.label] += 1;
          }
        });
      }
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
