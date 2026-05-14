# Session Observation Log — v6.9.0
**Date:** 2026-05-14  
**Session Time:** ~01:00 - 06:40 AM ET

---

## Engine Status: v6.9.0 (tagged + pushed)

### Key Changes This Session
1. **Flight Timing System (NEW)** — Spacebar-based ball launch/drop timer
   - Live counting display during ball flight
   - Auto-pairs flight time with next number entry
   - Persists across refreshes via localStorage
   - Dealer consistency assessment (CV-based): VERY CONSISTENT / CONSISTENT / MODERATE / ERRATIC
   - Auto-expires after 30s, Escape to cancel, UNDO to remove bad reads
   - Chronometer enabled by default

2. **Persistence Fix** — Bootstrap no longer overwrites existing localStorage history
3. **Priming Threshold Fix** — Both UI indicators now trigger at 10 spins (was 10/20 mismatch)
4. **OCR Documentation** — Full setup saved to `directives/ocr_auto_reader.md`
5. **Profile Management** — Save/load engine presets

---

## Session Performance

### Dealer 1 (Female — "choppy/random")
- **Spins observed:** ~20 live spins
- **Table bias:** 73% Red over 11 color spins
- **Engine accuracy:** 8W-13L (38%) — engine fought the Red trend, kept calling Black (FREQ reversion)
- **Bankroll:** $27.03 → $21.03 (net -$6.00)
- **Cold detector triggered** at 38% accuracy, engine locked to PASS
- **Key insight:** FREQ signal actively fights trends (gambler's fallacy). FLOW too volatile. Engine lacks momentum-following mode.

### Dealer 2 (Male — new)
- Arrived ~06:27 AM
- Flight timing feature deployed for this dealer
- **OCR died** before flight data could be collected (Chrome CDP lost debug port)
- Manual entry mode activated as fallback

---

## Critical Findings

### 1. Color Prediction Is Fundamentally Limited
- 10R-8B in 18 spins = z-score 0.47. Not statistically significant.
- Predicting red/black is essentially a coin flip. No amount of historical analysis changes this.
- A "just bet RED" strategy would have outperformed the engine by 16 percentage points.

### 2. Physics-Based Sector Prediction Is the Real Edge
- Roulette HAS been beaten (Eudaemons 44% edge, Garcia-Pelayo millions, Niko Tosa £1.3M)
- All used physics: ball speed + rotor speed → sector prediction
- Dealer at this table has MANUAL control of rotor (can stop/start wheel)
- **Flight time approach:** Spacebar on launch, spacebar on drop. If dealer is consistent (CV < 15%), flight time maps to landing sector.
- Sector betting (5 numbers at 35:1) is profitable even at 1-in-7 hit rate.

### 3. OCR Is Flaky
- Chrome debug port (9222) drops when Chrome restarts without `--remote-debugging-port` flag
- OCR poller crashes silently on CDP connection loss
- Manual entry is more reliable for live play
- Full OCR setup documented in `directives/ocr_auto_reader.md` for restoration

---

## Bankroll Status
- **Current:** $21.03
- **Session High:** $27.03
- **Start:** $4.00 (Session 1), then $10.00 added
- **Strategy:** PASS mode active (cold detector). No bets until hit rate recovers above 40%.

---

## Next Steps
1. **Collect flight timing data** with manual entry (spacebar + type number + Enter)
2. **Evaluate dealer consistency** — need 10+ flight times to assess CV
3. **Build sigFlight signal** — correlate flight time → wheel sector if dealer is consistent
4. **Shift from color bets to sector bets** if physics approach proves viable
5. **Fix OCR reliability** — add auto-restart, health checks, reconnection logic

---

## Version History
| Version | Tag | Key Change |
|---------|-----|------------|
| v6.8.2 | ✓ | Persistence fix, priming threshold sync |
| v6.9.0 | ✓ | Flight timing system, OCR docs, profile mgmt |
