const payload = {
  spinCount: 10,
  history: ['2-BLACK', '15-BLACK', '26-BLACK', '19-RED', '9-RED', '29-BLACK', '15-BLACK', '11-BLACK', '20-BLACK', '3-RED'],
  deltas: [13, 11, -7, -10, 20, -14, -4, 9, -17],
  dealer: { velocity: '3CW', direction: 'CW', stdev: 13.9, consistency: 'ERRATIC', drift: null, changed: false },
  signals: [{name: 'DEALER', vote: 'PASS', strength: 0}],
  prediction: { color: 'pass', confidence: 0 },
  accuracy: { wins: 0, losses: 0, pct: 0 }
};

const prompt = `You are an expert roulette analyst assisting a real-time prediction engine for live American Roulette (38 pockets: 0, 00, 1-36).

SESSION DATA (${payload.spinCount} spins):
History (newest first): ${payload.history.join(', ')}
Wheel deltas (pocket distances): ${payload.deltas.join(', ')}
Dealer: VEL ${payload.dealer.velocity}${payload.dealer.direction}, σ${payload.dealer.stdev}, ${payload.dealer.consistency}${payload.dealer.changed ? ' [DEALER CHANGED]' : ''}${payload.dealer.drift ? ', drift ' + payload.dealer.drift : ''}
Signals: ${payload.signals.map(s => `${s.name}→${s.vote}(${s.strength})`).join(', ')}
Engine prediction: ${payload.prediction.color.toUpperCase()} @ ${payload.prediction.confidence}%
Accuracy: W${payload.accuracy.wins} L${payload.accuracy.losses} (${payload.accuracy.pct}%)

ANALYZE:
1. Which signals have been reliable vs unreliable based on the actual results?
2. Any sequence patterns the heuristic signals are missing?
3. Is the dealer showing fatigue, rhythm change, or consistency shift?
4. Should any signal weights be adjusted?
5. Your independent assessment: RED, BLACK, or PASS?

RESPOND IN THIS EXACT JSON FORMAT:
{
  "weightAdjust": {"DEALER": 1.0, "SECTOR": 1.0, "FREQ": 1.0, "FLOW": 1.0},
  "prediction": "red|black|pass",
  "confidence": 0-100,
  "insight": "one sentence summary",
  "reasoning": "brief explanation"
}

Rules:
- weightAdjust values between 0.0 (ignore signal) and 2.0 (double weight)
- Be conservative. Default to PASS if uncertain.
- Prioritize not losing over winning.`;

const data = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 1500,
    responseMimeType: 'application/json',
    responseSchema: {
      type: "OBJECT",
      properties: {
        weightAdjust: {
          type: "OBJECT",
          properties: {
            DEALER: { type: "NUMBER" },
            SECTOR: { type: "NUMBER" },
            FREQ: { type: "NUMBER" },
            FLOW: { type: "NUMBER" }
          }
        },
        prediction: { type: "STRING" },
        confidence: { type: "NUMBER" },
        insight: { type: "STRING" },
        reasoning: { type: "STRING" }
      },
      required: ["weightAdjust", "prediction", "confidence", "insight", "reasoning"]
    }
  }
};

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=AIzaSyDuJ5kKIL1KJO1U6Ov1UnOjzSACALEvlQc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(res => res.text())
.then(text => console.log("RESPONSE:", text))
.catch(err => console.error("ERROR:", err));
