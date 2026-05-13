import { useState, useRef, useEffect } from 'react';
import './index.css';

const RED_NUMS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);
const WHEEL = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 100, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];

function getColor(n) {
  if (RED_NUMS.has(n)) return 'red';
  if (BLACK_NUMS.has(n)) return 'black';
  return 'green';
}

function App() {
  const [history, setHistory] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [stats, setStats] = useState({ wins: 0, losses: 0, streak: 0 });
  const [prediction, setPrediction] = useState(null);
  const [flash, setFlash] = useState(null);
  
  const inputRef = useRef(null);

  // Keep focus on input
  useEffect(() => {
    const handleClick = () => inputRef.current?.focus();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const triggerFlash = (type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), 400);
  };

  const processInput = () => {
    if (!inputVal.trim()) return;
    
    const tokens = inputVal.trim().split(/[\s,]+/).reverse();
    let newHistory = [...history];
    let newStats = { ...stats };
    let currentPred = prediction;

    for (const token of tokens) {
      let val = token.toLowerCase() === '00' ? 100 : parseInt(token);
      if (isNaN(val) || val < 0 || (val > 36 && val !== 100)) continue;

      const color = getColor(val);

      if (currentPred && color !== 'green') {
        if (currentPred.color === color) {
          newStats.wins++;
          newStats.streak = newStats.streak >= 0 ? newStats.streak + 1 : 1;
          triggerFlash('win');
        } else {
          newStats.losses++;
          newStats.streak = newStats.streak <= 0 ? newStats.streak - 1 : -1;
          triggerFlash('loss');
        }
      }

      newHistory.unshift({ num: val, color });
      currentPred = computePrediction(newHistory);
    }

    setHistory(newHistory);
    setStats(newStats);
    setPrediction(currentPred);
    setInputVal('');
  };

  const computePrediction = (hist) => {
    if (hist.length < 3) return null;

    let deltas = [];
    for (let i = 0; i < hist.length - 1; i++) {
      let currIdx = WHEEL.indexOf(hist[i].num);
      let prevIdx = WHEEL.indexOf(hist[i+1].num);
      if (currIdx === -1 || prevIdx === -1) continue;
      
      let diff = currIdx - prevIdx;
      if (diff < -19) diff += 38;
      if (diff > 19) diff -= 38;
      deltas.push(diff);
    }

    if (deltas.length === 0) return null;

    let recentDeltas = deltas.slice(0, 3);
    let avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;
    
    let lastIdx = WHEEL.indexOf(hist[0].num);
    let projectedIdx = Math.round(lastIdx + avgDelta);
    
    if (projectedIdx < 0) projectedIdx += 38;
    if (projectedIdx >= 38) projectedIdx -= 38;
    
    let projectedNum = WHEEL[projectedIdx];
    let projectedColor = getColor(projectedNum);

    let variance = recentDeltas.reduce((a, b) => a + Math.pow(b - avgDelta, 2), 0) / recentDeltas.length;
    let conf = variance < 15 ? 85 : variance < 40 ? 75 : 60;

    let dir = avgDelta > 0 ? "CW" : "CCW";
    let dispTarget = projectedNum === 100 ? '00' : projectedNum;
    
    return {
      color: projectedColor,
      confidence: conf,
      reason: `Velocity: ${Math.round(Math.abs(avgDelta))} pockets ${dir}. Target: [${dispTarget}]. Variance: ${variance.toFixed(1)}`,
      bet: conf >= 65 ? '$5' : conf >= 58 ? '$2' : '$1'
    };
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') processInput();
  };

  const pct = stats.wins + stats.losses > 0 
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
    : '--';

  return (
    <>
      <div className={`result-flash ${flash || ''}`} />
      
      <div className="header">
        <h1>Stealth Engine OS</h1>
        <div className="stats">
          <div className="stat"><span className="stat-label">W</span><span className="stat-val green">{stats.wins}</span></div>
          <div className="stat"><span className="stat-label">L</span><span className="stat-val red-text">{stats.losses}</span></div>
          <div className="stat"><span className="stat-label">Win %</span><span className="stat-val gold">{pct}%</span></div>
          <div className="stat">
            <span className="stat-label">Streak</span>
            <span className={`stat-val ${stats.streak > 0 ? 'green' : stats.streak < 0 ? 'red-text' : ''}`}>
              {stats.streak > 0 ? `W${stats.streak}` : stats.streak < 0 ? `L${Math.abs(stats.streak)}` : '--'}
            </span>
          </div>
        </div>
      </div>

      <div className="main">
        <div className="glass-panel">
          <div className="pred-label">Target Color</div>
          <div className={`prediction ${prediction ? prediction.color : 'waiting'}`}>
            {prediction ? prediction.color : 'READY'}
          </div>
          
          {prediction && (
            <>
              <div className="confidence-bar">
                <div 
                  className="confidence-fill" 
                  style={{ 
                    width: `${prediction.confidence}%`,
                    backgroundColor: prediction.confidence >= 75 ? '#00e676' : prediction.confidence >= 65 ? '#ffd740' : '#ff1744'
                  }} 
                />
              </div>
              <div className="metrics">
                <span>CONF: {prediction.confidence}%</span>
                <span>BET: {prediction.bet}</span>
              </div>
            </>
          )}
        </div>

        <div className="input-zone">
          <input 
            ref={inputRef}
            type="text" 
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="#" 
            autoFocus 
          />
          <button onClick={processInput}>Execute</button>
        </div>

        <div className="history-strip">
          {history.slice(0, 30).map((h, i) => (
            <div key={i} className={`history-chip ${h.color} ${i === 0 ? 'newest' : ''}`}>
              {h.num === 100 ? '00' : h.num}
            </div>
          ))}
        </div>

        {prediction && <div className="analysis">{prediction.reason}</div>}
      </div>
    </>
  );
}

export default App;
