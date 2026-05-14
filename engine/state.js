// ===== STATE.JS — Constants, Variables, Helpers, Persistence =====

const WHEEL = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,100,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2];
const RED  = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLK  = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

let hist = [];
let wins = 0, losses = 0, streak = 0;
let pred = null;
let bankroll = 10.00;
let startBankroll = 10.00;
let sessionHigh = 10.00;
let plLog = [];  // P&L history: [{spin, bet, result, delta, balance}]
let signalHits = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
let signalTotal = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
let softReset = 0;
let outcomeLog = [];
let flightTimes = [];
let flightStart = 0;
let timingActive = false;
let chronoEnabled = true;
let dealerChanged = false;

// ===== HELPERS =====
function getC(n) { if (n===0||n===100) return 'green'; return RED.has(n)?'red':'black'; }
function dn(n) { return n===100?'00':String(n); }
function parseNum(v) { v=v.trim().toLowerCase(); if(v==='00') return 100; let n=parseInt(v); if(isNaN(n)||n<0||n>36) return null; return n; }

function flightCV() {
  if (flightTimes.length < 3) return 999;
  let a = flightTimes.reduce((s,v)=>s+v,0)/flightTimes.length;
  let sd = Math.sqrt(flightTimes.reduce((s,v)=>s+Math.pow(v-a,2),0)/flightTimes.length);
  return sd/a;
}

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

// ===== BANKROLL =====
function setBankroll(amount) {
  bankroll = amount;
  startBankroll = amount;
  sessionHigh = amount;
  plLog = [];
  wins = 0; losses = 0; streak = 0; outcomeLog = [];
  saveState();
  console.log(`[Bankroll] Set to $${amount.toFixed(2)}`);
  updateBankrollUI();
}

function updateBankrollUI() {
  let el = document.getElementById('bankrollVal');
  if (el) el.textContent = '$' + bankroll.toFixed(2);
}

// ===== PERSISTENCE =====
function saveState() {
  try {
    localStorage.setItem('casino_state', JSON.stringify({
      hist, wins, losses, streak, pred, outcomeLog, bankroll, startBankroll,
      sessionHigh, signalHits, signalTotal, plLog, flightTimes
    }));
  } catch(e) {}
}
function loadState() {
  try {
    let s = JSON.parse(localStorage.getItem('casino_state'));
    if (s && s.hist && s.hist.length) {
      hist = s.hist; wins = s.wins||0; losses = s.losses||0; streak = s.streak||0;
      outcomeLog = s.outcomeLog||[];
      bankroll = s.bankroll || 10.00;
      startBankroll = s.startBankroll || bankroll;
      sessionHigh = s.sessionHigh || bankroll;
      plLog = s.plLog || [];
      flightTimes = s.flightTimes || [];
      let defSig = { DEALER:0, ZONE:0, FREQ:0, FLOW:0, HOT:0, ACCEL:0 };
      signalHits = { ...defSig, ...(s.signalHits||{}) };
      signalTotal = { ...defSig, ...(s.signalTotal||{}) };
      return true;
    }
  } catch(e) {}
  return false;
}

// ===== TELEMETRY =====
async function loadTelemetry() {
  try {
    let res = await fetch('telemetry.json?t=' + Date.now());
    let data = await res.json();
    if (data.hist && data.hist.length) {
      hist = data.hist;
      wins = data.wins || 0; losses = data.losses || 0; streak = data.streak || 0;
      console.log('[State] Loaded', hist.length, 'spins from telemetry.json');
      return true;
    }
  } catch(e) { console.warn('[State] telemetry.json not available:', e.message); }
  return false;
}

function saveTelemetry() {
  try {
    let data = JSON.stringify({ hist, wins, losses, streak, pred, geminiInsight: typeof geminiInsight !== 'undefined' ? geminiInsight : null });
    localStorage.setItem('casino_telemetry', data);
  } catch(e) {}
}

console.log('[State] Module loaded');
