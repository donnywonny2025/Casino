// ===== PROFILES.JS — Save/Load Signal Tuning Presets =====
// Captures the engine's tunable parameters so you can recall what was working

// Current tuning knobs — extracted from signals.js & predict.js
function getCurrentProfile() {
  return {
    version: '6.7.1',
    signals: {
      FREQ: {
        zThreshold: 1.2,      // Min z-score to activate (higher = less reactive)
        maxStrength: 0.4,      // Cap on signal strength
        window: 20,            // Lookback window
      },
      FLOW: {
        minSpins: 12,          // Min spins before activating
        window: 20,            // Lookback window
        biasThreshold: 0.10,   // Min bias to vote
        multiplier: 2.5,       // Bias-to-strength multiplier
        maxStrength: 0.8,      // Cap on signal strength
      },
      HOT: {
        zThreshold: 1.8,       // Min z-score for hot number
        maxStrength: 0.5,      // Cap on signal strength
        window: 15,            // Lookback window
      },
      ACCEL: {
        sdCap: 3,              // Max SD for activation
        minAvgA: 0.5,          // Min avg acceleration
        maxStrength: 0.8,      // Cap on signal strength
      },
      DEALER: {
        lookback: 12,          // Delta lookback
      },
      ZONE: {
        sectorWidth: 5,        // Pocket coverage per side
      }
    },
    predict: {
      streakBoost: 1.8,        // FLOW boost on 4+ color streak
      streakFreqDampen: 0.3,   // FREQ dampening during streak
      flowWinBoost: 1.5,       // FLOW boost when outperforming FREQ
      freqLoseDampen: 0.4,     // FREQ dampening when underperforming FLOW
      coldThreshold: 0.35,     // Momentum cold cutoff
      hotThreshold: 0.65,      // Momentum hot cutoff
      maxConf: 95,             // Confidence ceiling
      dealerShiftConf: 55,     // Max confidence during dealer shift
    },
    kelly: {
      fraction: 0.25,          // Quarter-Kelly
      coldStreakCap: 0.5,      // Max bet on -3 streak
      maxBetPct: 0.20,         // Max % of bankroll per bet
      absoluteMax: 2.00,       // Hard dollar cap
    },
    entropy: {
      flowBoost: 0.3,          // FLOW reliability boost from low entropy
      physicsBoost: 0.2,       // DEALER/ACCEL boost from high entropy
    }
  };
}

// Save current profile to server
function saveProfile(name, notes) {
  let profile = getCurrentProfile();
  profile.name = name;
  profile.notes = notes || '';
  profile.savedAt = new Date().toISOString();
  profile.spins = hist.length;
  profile.record = { ...record };
  profile.recentHistory = hist.slice(0, 20).map(s => ({ num: s.num, color: s.color }));

  fetch('/save-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  }).then(r => r.json()).then(d => {
    if (d.ok) {
      console.log(`[Profile] Saved: "${name}"`);
      loadProfileList();
    }
  }).catch(e => console.error('[Profile] Save failed:', e));
}

// Load profile list from server
function loadProfileList() {
  fetch('/list-profiles')
    .then(r => r.json())
    .then(profiles => {
      let sel = document.getElementById('profile-select');
      if (!sel) return;
      sel.innerHTML = '<option value="">-- Load Profile --</option>';
      profiles.forEach(p => {
        let opt = document.createElement('option');
        opt.value = p.file;
        let rec = p.record ? `${p.record.w}W-${p.record.l}L` : '';
        opt.textContent = `${p.name} (${rec}) — ${new Date(p.savedAt).toLocaleDateString()}`;
        sel.appendChild(opt);
      });
    })
    .catch(e => console.error('[Profile] List failed:', e));
}

// Load a specific profile — returns the tuning data (caller applies it)
function loadProfile(filename) {
  return fetch(`/load-profile?file=${encodeURIComponent(filename)}`)
    .then(r => r.json())
    .then(profile => {
      console.log(`[Profile] Loaded: "${profile.name}" — ${profile.notes}`);
      console.log(`[Profile] Record when saved: ${profile.record?.w}W-${profile.record?.l}L`);
      return profile;
    });
}

console.log('[Profiles] Module loaded — save/load signal tuning presets');
