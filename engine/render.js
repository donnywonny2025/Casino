// ===== RENDER.JS — All DOM updates =====
// Depends on: state.js, predict.js

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

console.log('[Render] Module loaded');
