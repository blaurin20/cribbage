import { useState, useEffect, useRef, useCallback } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
// Replace this with your Railway WebSocket URL after deploying
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";

// ── Constants ─────────────────────────────────────────────────────────────────
const RED_SUITS = new Set(["♥", "♦"]);
const RANK_VALUES = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:10,Q:10,K:10 };

// ── Card Component ────────────────────────────────────────────────────────────
function Card({ card, selected, onClick, faceDown, small, disabled }) {
  const isRed = card && RED_SUITS.has(card.suit);
  return (
    <div onClick={!disabled ? onClick : undefined} style={{
      width: small ? 50 : 70, height: small ? 74 : 104,
      borderRadius: 9,
      border: selected ? "2.5px solid #f0c040" : "1.5px solid #2a4060",
      background: faceDown ? "linear-gradient(135deg,#1a2a4a,#0d1b2e)" :
                  disabled ? "#101820" : "#faf8f2",
      color: isRed ? "#c0392b" : "#1a1a2e",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      cursor: onClick && !disabled ? "pointer" : "default",
      transform: selected ? "translateY(-12px)" : "none",
      transition: "transform 0.15s, box-shadow 0.15s, opacity 0.2s",
      boxShadow: selected ? "0 10px 24px #f0c04055" : "0 2px 8px #0005",
      userSelect: "none", flexShrink: 0, position: "relative",
      opacity: disabled ? 0.4 : 1,
    }}>
      {!card || faceDown ? (
        <div style={{ fontSize: small?20:28, color:"#3a6fc4", opacity:0.5 }}>🂠</div>
      ) : <>
        <div style={{ position:"absolute",top:4,left:6,fontWeight:700,fontSize:small?11:14,lineHeight:1 }}>{card.rank}</div>
        <div style={{ fontSize:small?20:28,lineHeight:1 }}>{card.suit}</div>
        <div style={{ position:"absolute",bottom:4,right:6,fontWeight:700,fontSize:small?11:14,lineHeight:1,transform:"rotate(180deg)" }}>{card.rank}</div>
      </>}
    </div>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
function Board({ scores, winScore=121, yourIndex }) {
  return (
    <div style={{ padding:"10px 16px", background:"#0a1628", borderRadius:12, border:"1px solid #1e3a5e" }}>
      <div style={{ fontSize:11, color:"#4a6a90", letterSpacing:1, marginBottom:6 }}>SCOREBOARD</div>
      {[0,1].map(i => {
        const label = i===yourIndex ? "You" : "Opponent";
        const color = i===yourIndex ? "#4a9fff" : "#ff6b6b";
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <div style={{ width:72, fontSize:12, color }}>{label}</div>
            <div style={{ flex:1, height:12, background:"#0d1f35", borderRadius:6, overflow:"hidden" }}>
              <div style={{ width:`${Math.min(scores[i]/winScore,1)*100}%`, height:"100%", background:color, borderRadius:6, transition:"width 0.5s" }} />
            </div>
            <div style={{ width:32, fontSize:15, fontWeight:700, color, textAlign:"right" }}>{scores[i]}</div>
          </div>
        );
      })}
      <div style={{ fontSize:11, color:"#2a4a6a", textAlign:"right" }}>First to {winScore}</div>
    </div>
  );
}

// ── Score Results Modal ───────────────────────────────────────────────────────
function ScoreModal({ results, yourIndex, onClose }) {
  const [idx, setIdx] = useState(0);
  if (!results || results.length===0) return null;
  const r = results[idx];
  const isYours = r.who===yourIndex;
  return (
    <div style={{ position:"fixed",inset:0,background:"#000a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}>
      <div style={{ background:"#0f1b2d",border:"1px solid #2a3d5e",borderRadius:16,padding:28,maxWidth:360,width:"90%",color:"#e8dfc8" }}>
        <h3 style={{ margin:"0 0 8px",color:"#f0c040",fontSize:18 }}>{r.label} {isYours?"(Yours)":"(Opponent)"}</h3>
        <div style={{ fontSize:34,fontWeight:700,marginBottom:10 }}>{r.points} pts</div>
        {r.breakdown.length===0 && <div style={{ color:"#556" }}>No score</div>}
        {r.breakdown.map((b,i)=><div key={i} style={{ padding:"5px 0",borderBottom:"1px solid #1e3050",fontSize:14 }}>• {b}</div>)}
        <button onClick={()=>{ if(idx<results.length-1) setIdx(i=>i+1); else onClose(); }}
          style={{ marginTop:18,width:"100%",padding:10,background:"#1a4a8a",border:"none",borderRadius:8,color:"#fff",fontSize:15,cursor:"pointer" }}>
          {idx<results.length-1 ? "Next →" : "Continue"}
        </button>
      </div>
    </div>
  );
}

// ── Custom Scoring ────────────────────────────────────────────────────────────
function CustomScoring({ rules, setRules, onSave, onClose, isHost }) {
  const toggle = k => setRules(r=>({...r,[k]:!r[k]}));
  const setNum = (k,v) => setRules(r=>({...r,[k]:Number(v)}));
  const Row = ({label,disableKey,children}) => (
    <div style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #1e3050" }}>
      <label style={{ flex:1,fontSize:13 }}>{label}</label>
      {children}
      <button onClick={()=>toggle(disableKey)} style={{ padding:"3px 10px",borderRadius:6,border:"none",background:rules[disableKey]?"#5a1a1a":"#1a5a2a",color:"#fff",cursor:isHost?"pointer":"default",fontSize:12,opacity:isHost?1:0.6 }} disabled={!isHost}>
        {rules[disableKey]?"OFF":"ON"}
      </button>
    </div>
  );
  const inp = { width:50,background:"#1a2d4a",border:"1px solid #2a4a70",borderRadius:6,color:"#fff",padding:"3px 6px",textAlign:"center" };
  return (
    <div style={{ position:"fixed",inset:0,background:"#000a",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}>
      <div style={{ background:"#0f1b2d",border:"1px solid #2a3d5e",borderRadius:16,padding:22,maxWidth:400,width:"92%",color:"#e8dfc8",maxHeight:"82vh",overflowY:"auto" }}>
        <h3 style={{ margin:"0 0 4px",color:"#f0c040" }}>⚙️ Custom Rules {!isHost&&<span style={{ fontSize:12,color:"#556" }}>(Host only)</span>}</h3>
        <Row label="Fifteens (pts each)" disableKey="disableFifteens"><input type="number" min={1} max={10} value={rules.fifteenPoints??2} onChange={e=>setNum("fifteenPoints",e.target.value)} style={inp} disabled={!isHost}/></Row>
        <Row label="Pairs (pts each)" disableKey="disablePairs"><input type="number" min={1} max={10} value={rules.pairPoints??2} onChange={e=>setNum("pairPoints",e.target.value)} style={inp} disabled={!isHost}/></Row>
        <Row label="Runs (bonus pts/card)" disableKey="disableRuns"><input type="number" min={0} max={5} value={rules.runBonus??0} onChange={e=>setNum("runBonus",e.target.value)} style={inp} disabled={!isHost}/></Row>
        <Row label="Flush (pts/card)" disableKey="disableFlush"><input type="number" min={1} max={5} value={rules.flushPoints??1} onChange={e=>setNum("flushPoints",e.target.value)} style={inp} disabled={!isHost}/></Row>
        <Row label="Nobs (pts)" disableKey="disableNobs"><input type="number" min={1} max={5} value={rules.nobPoints??1} onChange={e=>setNum("nobPoints",e.target.value)} style={inp} disabled={!isHost}/></Row>
        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #1e3050" }}>
          <label style={{ flex:1,fontSize:13 }}>🎲 Double All Scoring</label>
          <button onClick={()=>toggle("doubleScoring")} style={{ padding:"3px 10px",borderRadius:6,border:"none",background:rules.doubleScoring?"#1a5a2a":"#5a1a1a",color:"#fff",cursor:isHost?"pointer":"default",fontSize:12,opacity:isHost?1:0.6 }} disabled={!isHost}>{rules.doubleScoring?"ON":"OFF"}</button>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0" }}>
          <label style={{ flex:1,fontSize:13 }}>🏁 Winning Score</label>
          <input type="number" min={61} max={361} step={60} value={rules.winScore??121} onChange={e=>setNum("winScore",e.target.value)} style={{ ...inp,width:70 }} disabled={!isHost}/>
        </div>
        <div style={{ display:"flex",gap:8,marginTop:16 }}>
          {isHost && <button onClick={onSave} style={{ flex:2,padding:10,background:"#1a4a8a",border:"none",borderRadius:8,color:"#fff",fontSize:14,cursor:"pointer" }}>Save & Sync</button>}
          <button onClick={onClose} style={{ flex:1,padding:10,background:"#1a2a3a",border:"none",borderRadius:8,color:"#fff",fontSize:14,cursor:"pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Lobby ─────────────────────────────────────────────────────────────────────
function Lobby({ onCreate, onJoin, error }) {
  const [code, setCode] = useState("");
  return (
    <div style={{ minHeight:"100vh",background:"#060f1e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",padding:20 }}>
      <div style={{ textAlign:"center",maxWidth:360,width:"100%" }}>
        <div style={{ fontSize:48,marginBottom:8 }}>♣</div>
        <h1 style={{ fontSize:28,color:"#f0c040",margin:"0 0 4px",letterSpacing:3 }}>CRIBBAGE V2</h1>
        <p style={{ color:"#4a7aaa",fontSize:13,marginBottom:32,letterSpacing:1 }}>MULTIPLAYER</p>

        <button onClick={onCreate} style={lobbyBtn("#1a5a2a")}>🃏 Create New Room</button>
        <div style={{ margin:"20px 0",color:"#2a4a6a",fontSize:13 }}>— or join a friend's room —</div>
        <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ENTER ROOM CODE"
          maxLength={6}
          style={{ width:"100%",padding:"12px 16px",background:"#0d1f35",border:"1px solid #2a4a6a",borderRadius:10,color:"#e8dfc8",fontSize:18,letterSpacing:4,textAlign:"center",boxSizing:"border-box",marginBottom:10,fontFamily:"monospace" }} />
        <button onClick={()=>onJoin(code)} style={lobbyBtn("#1a2a8a")}>→ Join Room</button>
        {error && <div style={{ marginTop:14,color:"#f66",fontSize:13 }}>{error}</div>}
      </div>
    </div>
  );
}
function lobbyBtn(bg) { return { width:"100%",padding:"13px",background:bg,border:"1px solid #2a4a6a",borderRadius:10,color:"#e8dfc8",fontSize:15,cursor:"pointer",letterSpacing:1,marginBottom:6 }; }

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const ws = useRef(null);
  const [screen, setScreen] = useState("lobby"); // lobby | waiting | game
  const [roomCode, setRoomCode] = useState(null);
  const [lobbyError, setLobbyError] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [yourIndex, setYourIndex] = useState(null);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [scoreResults, setScoreResults] = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [localRules, setLocalRules] = useState({});
  const [toast, setToast] = useState(null);

  const send = useCallback(msg => {
    if (ws.current && ws.current.readyState===1) ws.current.send(JSON.stringify(msg));
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(()=>setToast(null), 3000);
  }

  function connect(onOpen) {
    if (ws.current) ws.current.close();
    const socket = new WebSocket(WS_URL);
    ws.current = socket;
    socket.onopen = onOpen;
    socket.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type==="created") {
        setRoomCode(msg.code);
        setYourIndex(0);
        setScreen("waiting");
      } else if (msg.type==="joined") {
        setRoomCode(msg.code);
        setYourIndex(1);
      } else if (msg.type==="state") {
        setGameState(msg);
        if (msg.yourIndex!==undefined) setYourIndex(msg.yourIndex);
        if (msg.rules) setLocalRules(msg.rules);
        setScreen("game");
        if (msg.scoreResults) setScoreResults(msg.scoreResults);
        if (msg.toast) showToast(msg.toast);
      } else if (msg.type==="error") {
        setLobbyError(msg.msg);
        showToast(msg.msg);
      }
    };
    socket.onclose = () => {
      if (screen!=="lobby") showToast("Connection lost. Returning to lobby.");
      setTimeout(()=>{ setScreen("lobby"); setGameState(null); setRoomCode(null); }, 1500);
    };
  }

  function handleCreate() {
    setLobbyError(null);
    connect(()=>{ ws.current.send(JSON.stringify({type:"create",rules:localRules})); });
  }
  function handleJoin(code) {
    if (!code || code.length!==6) { setLobbyError("Enter a 6-character room code"); return; }
    setLobbyError(null);
    connect(()=>{ ws.current.send(JSON.stringify({type:"join",code})); });
  }

  function toggleSelect(cardId) {
    setSelectedCards(s=>{
      const n=new Set(s);
      if(n.has(cardId)) n.delete(cardId);
      else if(n.size<2) n.add(cardId);
      return n;
    });
  }

  function sendDiscard() {
    if(selectedCards.size!==2) return;
    send({type:"discard", cardIds:[...selectedCards]});
    setSelectedCards(new Set());
  }

  function sendPeg(cardId) { send({type:"peg",cardId}); }
  function sendGo() { send({type:"go"}); }
  function sendCut() { send({type:"cut"}); }
  function sendScoreShow() { send({type:"scoreShow"}); }
  function saveRules() { send({type:"updateRules",rules:localRules}); setShowCustom(false); }

  // ── Screens ───────────────────────────────────────────────────────────────
  if (screen==="lobby") return <Lobby onCreate={handleCreate} onJoin={handleJoin} error={lobbyError}/>;

  if (screen==="waiting") return (
    <div style={{ minHeight:"100vh",background:"#060f1e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",color:"#e8dfc8",flexDirection:"column",gap:24 }}>
      <div style={{ fontSize:36,color:"#f0c040" }}>♣ CRIBBAGE</div>
      <div style={{ fontSize:16,color:"#8aaccc" }}>Waiting for opponent to join…</div>
      <div style={{ background:"#0d1f35",border:"1px solid #2a4a6a",borderRadius:14,padding:"20px 36px",textAlign:"center" }}>
        <div style={{ fontSize:12,color:"#4a6a90",letterSpacing:2,marginBottom:8 }}>ROOM CODE</div>
        <div style={{ fontSize:42,fontWeight:700,letterSpacing:6,fontFamily:"monospace",color:"#f0c040" }}>{roomCode}</div>
        <div style={{ fontSize:12,color:"#4a6a90",marginTop:8 }}>Share this code with your friend</div>
      </div>
      <button onClick={()=>navigator.clipboard?.writeText(roomCode).then(()=>showToast("Code copied!"))}
        style={{ padding:"10px 24px",background:"#1a3a5a",border:"1px solid #2a5a8a",borderRadius:8,color:"#8aaccc",cursor:"pointer",fontSize:14 }}>
        📋 Copy Code
      </button>
      {toast && <div style={{ position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1a3a1a",border:"1px solid #2a6a2a",borderRadius:8,padding:"10px 20px",color:"#8af08a",fontSize:14 }}>{toast}</div>}
    </div>
  );

  // ── Game Screen ───────────────────────────────────────────────────────────
  if (!gameState) return null;
  const g = gameState;
  const isDealer = g.dealer === yourIndex;
  const isMyPegTurn = g.pegTurn === yourIndex;
  const winScore = localRules.winScore ?? 121;
  const myHand = g.yourHand || [];
  const phase = g.phase;

  const canPeg = card => g.pegTotal + (RANK_VALUES[card.rank]||0) <= 31;
  const hasPlayable = myHand.some(canPeg);

  return (
    <div style={{ minHeight:"100vh",background:"#060f1e",color:"#e8dfc8",fontFamily:"Georgia,serif",display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 8px 40px" }}>

      {/* Header */}
      <div style={{ width:"100%",maxWidth:480,display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <div>
          <div style={{ fontSize:20,fontWeight:700,color:"#f0c040",letterSpacing:2 }}>♣ CRIBBAGE</div>
          <div style={{ fontSize:11,color:"#4a7aaa",letterSpacing:1 }}>
            {isDealer?"YOU ARE DEALER":"OPPONENT IS DEALER"} &nbsp;|&nbsp; Room: <span style={{ fontFamily:"monospace",color:"#8aaccc" }}>{roomCode}</span>
          </div>
        </div>
        <button onClick={()=>setShowCustom(true)} style={{ padding:"7px 12px",background:"#1a2d4a",border:"1px solid #2a4a6a",borderRadius:8,color:"#8abcf0",cursor:"pointer",fontSize:12 }}>⚙️ Rules</button>
      </div>

      {/* Scoreboard */}
      <div style={{ width:"100%",maxWidth:480,marginBottom:12 }}>
        <Board scores={g.scores} winScore={winScore} yourIndex={yourIndex}/>
      </div>

      {/* Opponent hand */}
      <div style={{ width:"100%",maxWidth:480,marginBottom:10 }}>
        <div style={{ fontSize:11,color:"#6a8ab0",marginBottom:5,letterSpacing:1 }}>OPPONENT ({g.opponentCardCount} cards) {g.opponentDiscarded?"✓":""}</div>
        <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
          {(g.opponentHand||[]).map((c,i)=><Card key={i} card={c} small/>)}
          {!g.opponentHand && Array.from({length:g.opponentCardCount}).map((_,i)=><Card key={i} card={{}} faceDown small/>)}
        </div>
      </div>

      {/* Center: starter + peg area */}
      <div style={{ width:"100%",maxWidth:480,display:"flex",gap:12,marginBottom:12,alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:11,color:"#6a8ab0",marginBottom:4 }}>STARTER</div>
          {g.starter ? <Card card={g.starter}/> : (
            <div style={{ width:70,height:104,borderRadius:9,border:"1.5px dashed #1e3a5e",display:"flex",alignItems:"center",justifyContent:"center",color:"#1e3a5e",fontSize:24 }}>?</div>
          )}
        </div>
        {phase==="pegging" && (
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11,color:"#6a8ab0",marginBottom:4 }}>
              PLAYED — Total: <span style={{ color:g.pegTotal>31?"#f66":"#f0c040",fontWeight:700 }}>{g.pegTotal}</span>
              {isMyPegTurn ? <span style={{ color:"#4af04a",marginLeft:8 }}>← YOUR TURN</span> : <span style={{ color:"#f0c040",marginLeft:8 }}>Opponent's turn</span>}
            </div>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:6 }}>
              {(g.pegPile||[]).map((c,i)=><Card key={i} card={c} small/>)}
            </div>
            <div style={{ maxHeight:72,overflowY:"auto" }}>
              {(g.pegLog||[]).map((l,i)=><div key={i} style={{ fontSize:11,color:"#7a9abc",lineHeight:1.7 }}>{l}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* Crib */}
      {(g.crib?.length>0||g.savedCrib?.length>0) && (
        <div style={{ width:"100%",maxWidth:480,marginBottom:10 }}>
          <div style={{ fontSize:11,color:"#6a8ab0",marginBottom:4 }}>CRIB ({isDealer?"Yours":"Opponent's"}) — {(g.crib||[]).length} cards</div>
          <div style={{ display:"flex",gap:4 }}>
            {(g.savedCrib||g.crib||[]).map((c,i)=><Card key={i} card={c} faceDown={!g.savedCrib} small/>)}
          </div>
        </div>
      )}

      {/* Your hand */}
      <div style={{ width:"100%",maxWidth:480,marginBottom:14 }}>
        <div style={{ fontSize:11,color:"#6a8ab0",marginBottom:5,letterSpacing:1 }}>
          YOUR HAND {phase==="discard"&&`— select 2 for crib (${selectedCards.size}/2)`}
          {g.discarded&&phase==="discard"&&<span style={{ color:"#4af04a" }}> ✓ Waiting for opponent…</span>}
        </div>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {myHand.map((c,i)=>{
            const isSelected = selectedCards.has(c.id);
            const isPegging = phase==="pegging";
            const notPlayable = isPegging && !canPeg(c);
            return (
              <Card key={c.id} card={c}
                selected={isSelected}
                disabled={notPlayable || (isPegging && !isMyPegTurn) || (phase==="discard" && g.discarded)}
                onClick={
                  phase==="discard" && !g.discarded ? ()=>toggleSelect(c.id) :
                  phase==="pegging" && isMyPegTurn && canPeg(c) ? ()=>sendPeg(c.id) :
                  undefined
                }
              />
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={{ width:"100%",maxWidth:480 }}>
        {phase==="discard" && !g.discarded && (
          <button onClick={sendDiscard} disabled={selectedCards.size!==2}
            style={aBtn(selectedCards.size===2?"#1a5a2a":"#1a2a3a")}>
            Send {selectedCards.size}/2 Cards to Crib
          </button>
        )}
        {phase==="cut" && (
          <button onClick={sendCut} style={aBtn("#5a3a1a")}>✂️ Cut the Deck</button>
        )}
        {phase==="pegging" && isMyPegTurn && (
          <div style={{ display:"flex",gap:8 }}>
            <div style={{ flex:1,fontSize:13,color:"#8aaccc",alignSelf:"center" }}>
              {hasPlayable ? "Tap a card to play" : "No playable cards"}
            </div>
            <button onClick={sendGo} style={aBtn("#5a1a1a",true)}>Say Go</button>
          </div>
        )}
        {(phase==="show"||phase==="crib") && yourIndex===0 && (
          <button onClick={sendScoreShow} style={aBtn("#4a1a6a")}>📊 Score Hands</button>
        )}
        {(phase==="show"||phase==="crib") && yourIndex!==0 && (
          <div style={{ textAlign:"center",color:"#6a8ab0",fontSize:14,padding:12 }}>Waiting for host to score hands…</div>
        )}
        {phase==="gameover" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:32,fontWeight:700,color:"#f0c040",marginBottom:16 }}>
              {g.winner===yourIndex ? "You Win! 🎉" : "Opponent Wins 🤝"}
            </div>
            <button onClick={()=>{ setScreen("lobby"); setGameState(null); setRoomCode(null); ws.current?.close(); }}
              style={aBtn("#1a4a1a")}>Back to Lobby</button>
          </div>
        )}
      </div>

      {/* Modals */}
      {scoreResults && <ScoreModal results={scoreResults} yourIndex={yourIndex} onClose={()=>setScoreResults(null)}/>}
      {showCustom && <CustomScoring rules={localRules} setRules={setLocalRules} onSave={saveRules} onClose={()=>setShowCustom(false)} isHost={yourIndex===0}/>}
      {toast && <div style={{ position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1a1a2e",border:"1px solid #2a4a6a",borderRadius:8,padding:"10px 20px",color:"#8aaccc",fontSize:13,whiteSpace:"nowrap",zIndex:200 }}>{toast}</div>}
    </div>
  );
}

function aBtn(bg, small=false) {
  return { width:small?"auto":"100%", padding:small?"10px 18px":"13px", background:bg, border:"1px solid #2a4a6a", borderRadius:10, color:"#e8dfc8", fontSize:small?14:15, cursor:"pointer", letterSpacing:1 };
}
