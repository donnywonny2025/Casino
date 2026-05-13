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
  // Targets (informational only — color is the bet)
  let hTargets = document.getElementById('hTargets');
  hTargets.innerHTML = p.targets.length ? 'SECTOR: ' + p.targets.map(t => dn(t)).join(' · ') : '';

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

  // ===== WHEEL HEAT MAP (physical wheel order) =====
  let wgrid = document.getElementById('wgrid');
  let targetSet = new Set(p.targets || []);
  let lastNum = hist.length ? hist[0].num : -1;
  // Use full history for frequency, not just last 50
  let allFreq = {};
  hist.forEach(h => { allFreq[h.num] = (allFreq[h.num]||0)+1; });
  let maxFreq = Math.max(1, ...Object.values(allFreq));

  wgrid.innerHTML = WHEEL.map(n => {
    let c = allFreq[n]||0;
    let heat = c / maxFreq; // 0-1 normalized
    let col = getC(n);
    let bg, txtCol;
    if (col === 'red') {
      bg = `rgba(255,45,85,${0.06 + heat*0.5})`;
      txtCol = `rgba(255,45,85,${0.5 + heat*0.5})`;
    } else if (col === 'green') {
      bg = `rgba(52,199,89,${0.06 + heat*0.5})`;
      txtCol = `rgba(52,199,89,${0.5 + heat*0.5})`;
    } else {
      bg = `rgba(180,190,210,${0.03 + heat*0.25})`;
      txtCol = `rgba(200,210,220,${0.4 + heat*0.6})`;
    }
    let cls = 'wc';
    if (targetSet.has(n)) cls += ' wc-target';
    if (n === lastNum) cls += ' wc-last';
    return `<div class="${cls}" style="background:${bg}"><span class="nn" style="color:${txtCol}">${dn(n)}</span><span class="ct">${c||''}</span></div>`;
  }).join('');

  // ===== TABLE HEAT MAP (standard betting layout) =====
  let tgrid = document.getElementById('tgrid');
  // Row 1: 0 spanning row 1, 00 spanning row 2 in column 1
  // Numbers: 3-column layout, rows of (1,2,3), (4,5,6) ... (34,35,36)
  let tableHTML = '';
  // 0 cell
  let z0c = allFreq[0]||0, z0h = z0c/maxFreq;
  let z0cls = 'tc tc-zero' + (targetSet.has(0) ? ' tc-target' : '') + (lastNum===0 ? ' tc-last' : '');
  tableHTML += `<div class="${z0cls}" style="background:rgba(52,199,89,${0.06+z0h*0.5});grid-row:1"><span class="nn" style="color:rgba(52,199,89,${0.5+z0h*0.5})">${dn(0)}</span><span class="ct">${z0c||''}</span></div>`;
  // Row 1 numbers: 1, 2, 3
  for (let n = 1; n <= 3; n++) {
    let c = allFreq[n]||0, h = c/maxFreq, col = getC(n);
    let bg = col==='red' ? `rgba(255,45,85,${0.06+h*0.5})` : `rgba(180,190,210,${0.03+h*0.25})`;
    let tc = col==='red' ? `rgba(255,45,85,${0.5+h*0.5})` : `rgba(200,210,220,${0.4+h*0.6})`;
    let cls = 'tc' + (targetSet.has(n) ? ' tc-target' : '') + (lastNum===n ? ' tc-last' : '');
    tableHTML += `<div class="${cls}" style="background:${bg};grid-row:1"><span class="nn" style="color:${tc}">${n}</span><span class="ct">${c||''}</span></div>`;
  }
  // 00 cell
  let z00c = allFreq[100]||0, z00h = z00c/maxFreq;
  let z00cls = 'tc tc-zero' + (targetSet.has(100) ? ' tc-target' : '') + (lastNum===100 ? ' tc-last' : '');
  tableHTML += `<div class="${z00cls}" style="background:rgba(52,199,89,${0.06+z00h*0.5});grid-row:2"><span class="nn" style="color:rgba(52,199,89,${0.5+z00h*0.5})">${dn(100)}</span><span class="ct">${z00c||''}</span></div>`;
  // Row 2 numbers: 4, 5, 6
  for (let n = 4; n <= 6; n++) {
    let c = allFreq[n]||0, h = c/maxFreq, col = getC(n);
    let bg = col==='red' ? `rgba(255,45,85,${0.06+h*0.5})` : `rgba(180,190,210,${0.03+h*0.25})`;
    let tc = col==='red' ? `rgba(255,45,85,${0.5+h*0.5})` : `rgba(200,210,220,${0.4+h*0.6})`;
    let cls = 'tc' + (targetSet.has(n) ? ' tc-target' : '') + (lastNum===n ? ' tc-last' : '');
    tableHTML += `<div class="${cls}" style="background:${bg};grid-row:2"><span class="nn" style="color:${tc}">${n}</span><span class="ct">${c||''}</span></div>`;
  }
  // Rows 3-12: numbers 7-36 (no zero column)
  for (let row = 3; row <= 12; row++) {
    let base = (row - 1) * 3 + 1; // row3=7, row4=10, ...
    // Empty zero column cell
    tableHTML += `<div style="grid-row:${row}"></div>`;
    for (let col = 0; col < 3; col++) {
      let n = base + col;
      let c = allFreq[n]||0, h = c/maxFreq, clr = getC(n);
      let bg = clr==='red' ? `rgba(255,45,85,${0.06+h*0.5})` : `rgba(180,190,210,${0.03+h*0.25})`;
      let tc = clr==='red' ? `rgba(255,45,85,${0.5+h*0.5})` : `rgba(200,210,220,${0.4+h*0.6})`;
      let cls = 'tc' + (targetSet.has(n) ? ' tc-target' : '') + (lastNum===n ? ' tc-last' : '');
      tableHTML += `<div class="${cls}" style="background:${bg};grid-row:${row}"><span class="nn" style="color:${tc}">${n}</span><span class="ct">${c||''}</span></div>`;
    }
  }
  tgrid.innerHTML = tableHTML;

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
