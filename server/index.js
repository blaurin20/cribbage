const { WebSocketServer } = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/health") { res.writeHead(200); res.end("OK"); }
  else { res.writeHead(404); res.end(); }
});

const wss = new WebSocketServer({ server });

// ── State ────────────────────────────────────────────────────────────────────
const rooms = new Map(); // roomCode → { players: [ws, ws], state }

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Deck ─────────────────────────────────────────────────────────────────────
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RANK_VALUES = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:10,Q:10,K:10 };
const RANK_ORDER  = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13 };

function createDeck() {
  return SUITS.flatMap(s => RANKS.map(r => ({ suit:s, rank:r, id:`${r}${s}` })));
}
function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
function scoreHand(hand, starter, isCrib=false, rules={}) {
  const all = [...hand, starter];
  const vals = all.map(c => RANK_VALUES[c.rank]);
  const orders = all.map(c => RANK_ORDER[c.rank]);
  const ranks = all.map(c => c.rank);
  const suits = all.map(c => c.suit);
  let pts = 0; const breakdown = [];
  const m = rules.doubleScoring ? 2 : 1;

  if (!rules.disableFifteens) {
    const fp = rules.fifteenPoints ?? 2;
    let f = 0;
    for (let mask=1;mask<32;mask++){let s=0;for(let i=0;i<5;i++)if(mask&(1<<i))s+=vals[i];if(s===15)f++;}
    if(f){const p=f*fp*m;pts+=p;breakdown.push(`Fifteens (${f}×${fp}) = ${p}`);}
  }
  if (!rules.disablePairs) {
    const pp = rules.pairPoints ?? 2;
    let pairs=0;
    for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)if(ranks[i]===ranks[j])pairs++;
    if(pairs){const p=pairs*pp*m;pts+=p;breakdown.push(`Pairs (${pairs}×${pp}) = ${p}`);}
  }
  if (!rules.disableRuns) {
    const rb = rules.runBonus ?? 0;
    const sorted=[...orders].sort((a,b)=>a-b);
    let bestRun=0,runCount=0;
    for(let len=5;len>=3;len--)for(let start=0;start<=5-len;start++){
      const sl=sorted.slice(start,start+len);
      if(sl.every((v,i)=>i===0||v===sl[i-1]+1)){if(len>bestRun){bestRun=len;runCount=1;}else if(len===bestRun)runCount++;}
    }
    if(bestRun>=3){const p=(bestRun+rb)*runCount*m;pts+=p;breakdown.push(`Run${runCount>1?"s":""} of ${bestRun}${runCount>1?` ×${runCount}`:""} = ${p}`);}
  }
  if (!rules.disableFlush) {
    const fp = rules.flushPoints ?? 1;
    const hs = hand.map(c=>c.suit);
    if(hs.every(s=>s===hs[0])){
      if(suits[4]===hs[0]){const p=5*fp*m;pts+=p;breakdown.push(`Flush (5) = ${p}`);}
      else if(!isCrib){const p=4*fp*m;pts+=p;breakdown.push(`Flush (4) = ${p}`);}
    }
  }
  if (!rules.disableNobs) {
    const np = rules.nobPoints ?? 1;
    if(hand.some(c=>c.rank==="J"&&c.suit===starter.suit)){const p=np*m;pts+=p;breakdown.push(`Nobs = ${p}`);}
  }
  return { points:pts, breakdown };
}

function scorePegging(played, newCard) {
  const cards=[...played,newCard];
  const total=cards.reduce((s,c)=>s+RANK_VALUES[c.rank],0);
  const ranks=cards.map(c=>c.rank);
  const orders=cards.map(c=>RANK_ORDER[c.rank]);
  let pts=0; const msgs=[];
  if(total===15){pts+=2;msgs.push("Fifteen for 2");}
  if(total===31){pts+=2;msgs.push("31 for 2");}
  let pairs=1;
  for(let i=cards.length-2;i>=0;i--){if(ranks[i]===ranks[cards.length-1])pairs++;else break;}
  if(pairs===2){pts+=2;msgs.push("Pair for 2");}
  if(pairs===3){pts+=6;msgs.push("Pair royal for 6");}
  if(pairs===4){pts+=12;msgs.push("Double pair royal for 12");}
  for(let len=cards.length;len>=3;len--){
    const sl=orders.slice(cards.length-len).sort((a,b)=>a-b);
    if(sl.every((v,i)=>i===0||v===sl[i-1]+1)){pts+=len;msgs.push(`Run of ${len} for ${len}`);break;}
  }
  return {pts,msgs};
}

// ── Game Logic ────────────────────────────────────────────────────────────────
function initGameState() {
  return {
    phase: "waiting",   // waiting | discard | cut | pegging | show | crib | gameover
    deck: [],
    hands: [[], []],    // hands[0]=p0, hands[1]=p1
    crib: [],
    starter: null,
    scores: [0, 0],
    dealer: 0,          // index of dealer
    discards: [null, null], // null = not yet discarded
    pegPile: [],
    pegTotal: 0,
    pegLog: [],
    pegTurn: null,
    savedHands: [[], []],
    savedCrib: [],
    rules: {},
    winner: null,
  };
}

function dealGame(state) {
  const deck = shuffle(createDeck());
  state.hands[0] = deck.slice(0, 6);
  state.hands[1] = deck.slice(6, 12);
  state.deck = deck.slice(12);
  state.crib = [];
  state.starter = null;
  state.discards = [null, null];
  state.pegPile = [];
  state.pegTotal = 0;
  state.pegLog = [];
  state.pegTurn = null;
  state.phase = "discard";
}

function tryFinishDiscard(room) {
  const s = room.state;
  if (!s.discards[0] || !s.discards[1]) return;
  const d = s.dealer;
  s.crib = [...s.discards[d], ...s.discards[1-d]];
  s.hands[0] = s.hands[0].filter(c => !s.discards[0].some(d=>d.id===c.id));
  s.hands[1] = s.hands[1].filter(c => !s.discards[1].some(d=>d.id===c.id));
  s.phase = "cut";
  broadcast(room);
}

function cutAndPeg(room) {
  const s = room.state;
  const cut = s.deck[Math.floor(Math.random()*s.deck.length)];
  s.starter = cut;
  if (cut.rank === "J") {
    s.scores[s.dealer] = Math.min(s.scores[s.dealer] + 2, winScore(s));
    s.pegLog.push(`Dealer gets 2 pts for cutting a Jack!`);
  }
  s.savedHands = [s.hands[0].map(c=>({...c})), s.hands[1].map(c=>({...c}))];
  s.savedCrib = s.crib.map(c=>({...c}));
  s.pegTurn = 1 - s.dealer; // non-dealer goes first
  s.phase = "pegging";
  broadcast(room);
}

function winScore(s) { return s.rules.winScore ?? 121; }

function checkWin(room) {
  const s = room.state;
  const ws = winScore(s);
  if (s.scores[0] >= ws) { s.winner = 0; s.phase = "gameover"; return true; }
  if (s.scores[1] >= ws) { s.winner = 1; s.phase = "gameover"; return true; }
  return false;
}

function playPegCard(room, playerIdx, cardId) {
  const s = room.state;
  if (s.pegTurn !== playerIdx) return;
  const hand = s.hands[playerIdx];
  const card = hand.find(c=>c.id===cardId);
  if (!card) return;
  if (s.pegTotal + RANK_VALUES[card.rank] > 31) return;

  s.hands[playerIdx] = hand.filter(c=>c.id!==cardId);
  const {pts,msgs} = scorePegging(s.pegPile, card);
  s.pegPile.push(card);
  s.pegTotal += RANK_VALUES[card.rank];

  if (pts > 0) {
    s.scores[playerIdx] = Math.min(s.scores[playerIdx]+pts, winScore(s));
    s.pegLog.push(`P${playerIdx+1}: ${msgs.join(", ")} +${pts}`);
  } else {
    s.pegLog.push(`P${playerIdx+1} plays ${card.rank}${card.suit} (${s.pegTotal})`);
  }

  if (s.pegTotal === 31) { s.pegPile=[]; s.pegTotal=0; }

  if (checkWin(room)) { broadcast(room); return; }

  // Check if both hands empty → move to show
  if (s.hands[0].length===0 && s.hands[1].length===0) {
    s.scores[playerIdx] = Math.min(s.scores[playerIdx]+1, winScore(s)); // last card
    s.pegLog.push(`P${playerIdx+1} gets last card +1`);
    if (!checkWin(room)) s.phase = "show";
    broadcast(room); return;
  }

  // Switch turn
  s.pegTurn = 1 - playerIdx;
  broadcast(room);
}

function sayGo(room, playerIdx) {
  const s = room.state;
  if (s.pegTurn !== playerIdx) return;
  const other = 1 - playerIdx;
  s.pegLog.push(`P${playerIdx+1} says Go`);
  const otherHasPlay = s.hands[other].some(c => s.pegTotal+RANK_VALUES[c.rank]<=31);
  if (!otherHasPlay) {
    s.scores[other] = Math.min(s.scores[other]+1, winScore(s));
    s.pegLog.push(`P${other+1} gets 1 for Go`);
    s.pegPile=[]; s.pegTotal=0;
    if (!checkWin(room)) {
      if (s.hands[0].length===0&&s.hands[1].length===0) s.phase="show";
      else s.pegTurn = s.hands[other].length>0 ? other : playerIdx;
    }
  } else {
    s.pegTurn = other;
  }
  broadcast(room);
}

function scoreAllHands(room) {
  const s = room.state;
  const ws = winScore(s);
  const nonDealer = 1-s.dealer;
  const order = [nonDealer, s.dealer]; // non-dealer scores hand first, then dealer hand, then crib
  const results = [];

  for (const pi of order) {
    const r = scoreHand(s.savedHands[pi], s.starter, false, s.rules);
    s.scores[pi] = Math.min(s.scores[pi]+r.points, ws);
    results.push({ who: pi, label: `P${pi+1} Hand`, ...r });
    if (checkWin(room)) break;
  }
  if (s.phase !== "gameover") {
    const cr = scoreHand(s.savedCrib, s.starter, true, s.rules);
    s.scores[s.dealer] = Math.min(s.scores[s.dealer]+cr.points, ws);
    results.push({ who: s.dealer, label: "Crib", ...cr });
    checkWin(room);
  }

  if (s.phase !== "gameover") {
    s.dealer = 1-s.dealer;
    dealGame(s);
  }

  return results;
}

// ── WebSocket broadcast ───────────────────────────────────────────────────────
function broadcast(room, extra={}) {
  const s = room.state;
  room.players.forEach((ws, idx) => {
    if (!ws || ws.readyState !== 1) return;
    // Each player only sees their own hand + opponent card count
    const msg = {
      type: "state",
      phase: s.phase,
      yourIndex: idx,
      yourHand: s.phase==="show"||s.phase==="crib" ? s.savedHands[idx] : s.hands[idx],
      opponentCardCount: s.phase==="show"||s.phase==="crib" ? s.savedHands[1-idx].length : s.hands[1-idx].length,
      opponentHand: (s.phase==="show"||s.phase==="crib") ? s.savedHands[1-idx] : null,
      crib: s.crib,
      savedCrib: s.phase==="crib" ? s.savedCrib : null,
      starter: s.starter,
      scores: s.scores,
      dealer: s.dealer,
      pegPile: s.pegPile,
      pegTotal: s.pegTotal,
      pegLog: s.pegLog.slice(-6),
      pegTurn: s.pegTurn,
      discarded: s.discards[idx] !== null,
      opponentDiscarded: s.discards[1-idx] !== null,
      winner: s.winner,
      rules: s.rules,
      ...extra,
    };
    ws.send(JSON.stringify(msg));
  });
}

// ── Connection handling ───────────────────────────────────────────────────────
wss.on("connection", ws => {
  let roomCode = null;
  let playerIdx = null;

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "create") {
      roomCode = makeCode();
      const state = initGameState();
      if (msg.rules) state.rules = msg.rules;
      rooms.set(roomCode, { players: [ws, null], state });
      playerIdx = 0;
      ws.send(JSON.stringify({ type:"created", code:roomCode }));
    }

    else if (msg.type === "join") {
      const code = (msg.code||"").toUpperCase();
      const room = rooms.get(code);
      if (!room) { ws.send(JSON.stringify({type:"error",msg:"Room not found"})); return; }
      if (room.players[1]) { ws.send(JSON.stringify({type:"error",msg:"Room is full"})); return; }
      roomCode = code;
      playerIdx = 1;
      room.players[1] = ws;
      ws.send(JSON.stringify({ type:"joined", code:roomCode }));
      // Start game
      dealGame(room.state);
      broadcast(room, { type:"state", toast:"Game started! Good luck." });
    }

    else if (msg.type === "discard") {
      const room = rooms.get(roomCode);
      if (!room || room.state.phase!=="discard") return;
      const s = room.state;
      if (s.discards[playerIdx]) return; // already discarded
      const ids = new Set(msg.cardIds);
      const toDiscard = s.hands[playerIdx].filter(c=>ids.has(c.id));
      if (toDiscard.length !== 2) return;
      s.discards[playerIdx] = toDiscard;
      broadcast(room);
      tryFinishDiscard(room);
    }

    else if (msg.type === "cut") {
      const room = rooms.get(roomCode);
      if (!room || room.state.phase!=="cut") return;
      // Only non-dealer can call cut (or either, doesn't matter)
      cutAndPeg(room);
    }

    else if (msg.type === "peg") {
      const room = rooms.get(roomCode);
      if (!room || room.state.phase!=="pegging") return;
      playPegCard(room, playerIdx, msg.cardId);
    }

    else if (msg.type === "go") {
      const room = rooms.get(roomCode);
      if (!room || room.state.phase!=="pegging") return;
      sayGo(room, playerIdx);
    }

    else if (msg.type === "scoreShow") {
      const room = rooms.get(roomCode);
      if (!room || (room.state.phase!=="show"&&room.state.phase!=="crib")) return;
      if (playerIdx !== 0) return; // only host triggers scoring
      const results = scoreAllHands(room);
      broadcast(room, { scoreResults: results });
    }

    else if (msg.type === "updateRules") {
      const room = rooms.get(roomCode);
      if (!room || playerIdx!==0) return;
      room.state.rules = msg.rules;
      broadcast(room, { toast:"Rules updated!" });
    }
  });

  ws.on("close", () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const other = room.players[1-playerIdx];
    if (other && other.readyState===1) {
      other.send(JSON.stringify({type:"error",msg:"Your opponent disconnected."}));
    }
    rooms.delete(roomCode);
  });
});

server.listen(PORT, () => console.log(`Cribbage server running on port ${PORT}`));
