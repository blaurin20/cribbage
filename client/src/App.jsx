import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
const RED_SUITS = new Set(["♥", "♦"]);
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RANK_VALUES = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:10,Q:10,K:10 };
const RANK_ORDER  = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13 };

// ── Global Styles ─────────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080e1a; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #2a4a6a; border-radius: 4px; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes cardDeal { from { opacity:0; transform:translateY(-20px) scale(0.9); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes glow { 0%,100% { box-shadow: 0 0 10px #f0c04033; } 50% { box-shadow: 0 0 24px #f0c04066; } }
    .pulse { animation: pulse 2s infinite; }
    .btn-primary { background: linear-gradient(135deg, #1a6a3a, #0d4a28); border: 1px solid #2a8a4a; color: #c8f0d8; border-radius: 12px; padding: 14px 20px; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; width: 100%; transition: all 0.2s; }
    .btn-primary:hover { background: linear-gradient(135deg, #1e7a44, #104f2d); transform: translateY(-1px); box-shadow: 0 4px 20px #1a6a3a55; }
    .btn-primary:disabled { opacity: 0.4; cursor: default; transform: none; }
    .btn-secondary { background: linear-gradient(135deg, #1a2a4a, #0d1a30); border: 1px solid #2a4a7a; color: #8abcf0; border-radius: 12px; padding: 14px 20px; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; width: 100%; transition: all 0.2s; }
    .btn-secondary:hover { background: linear-gradient(135deg, #1e3050, #101e38); transform: translateY(-1px); }
    .btn-danger { background: linear-gradient(135deg, #5a1a1a, #3a0d0d); border: 1px solid #8a2a2a; color: #f0c8c8; border-radius: 12px; padding: 10px 18px; font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; }
    .btn-danger:hover { background: linear-gradient(135deg, #6a2020, #451010); }
    .btn-purple { background: linear-gradient(135deg, #3a1a5a, #251040); border: 1px solid #6a3a8a; color: #d0b0f0; border-radius: 12px; padding: 14px 20px; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; width: 100%; transition: all 0.2s; }
    .btn-purple:hover { background: linear-gradient(135deg, #441e6a, #2a1248); transform: translateY(-1px); }
    .btn-gold { background: linear-gradient(135deg, #4a3a0a, #2a2008); border: 1px solid #8a7a2a; color: #f0e0a0; border-radius: 12px; padding: 14px 20px; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 2px; cursor: pointer; width: 100%; transition: all 0.2s; }
    .btn-gold:hover { background: linear-gradient(135deg, #5a4a10, #302510); transform: translateY(-1px); }
    .card-face { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease; }
    .card-face:hover:not(.card-disabled) { transform: translateY(-6px); }
    .card-face.card-selected { transform: translateY(-14px) !important; }
  `}</style>
);

// ── Deck Utilities ────────────────────────────────────────────────────────────
function createDeck() {
  return SUITS.flatMap(s => RANKS.map(r => ({ suit:s, rank:r, id:`${r}${s}` })));
}
function shuffleDeck(a) {
  const arr=[...a];
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}

// ── Scoring Engine ────────────────────────────────────────────────────────────
function scoreHand(hand, starter, isCrib=false, rules={}) {
  const all=[...hand,starter];
  const vals=all.map(c=>RANK_VALUES[c.rank]);
  const orders=all.map(c=>RANK_ORDER[c.rank]);
  const ranks=all.map(c=>c.rank);
  const suits=all.map(c=>c.suit);
  let pts=0; const breakdown=[];
  const m=rules.doubleScoring?2:1;
  if(!rules.disableFifteens){
    const fp=rules.fifteenPoints??2; let f=0;
    for(let mask=1;mask<32;mask++){let s=0;for(let i=0;i<5;i++)if(mask&(1<<i))s+=vals[i];if(s===15)f++;}
    if(f){const p=f*fp*m;pts+=p;breakdown.push(`Fifteens (${f}x${fp}) = ${p}`);}
  }
  if(!rules.disablePairs){
    const pp=rules.pairPoints??2; let pairs=0;
    for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)if(ranks[i]===ranks[j])pairs++;
    if(pairs){const p=pairs*pp*m;pts+=p;breakdown.push(`Pairs (${pairs}x${pp}) = ${p}`);}
  }
  if(!rules.disableRuns){
    const rb=rules.runBonus??0;
    const sorted=[...orders].sort((a,b)=>a-b);
    let bestRun=0,runCount=0;
    for(let len=5;len>=3;len--)for(let start=0;start<=5-len;start++){
      const sl=sorted.slice(start,start+len);
      if(sl.every((v,i)=>i===0||v===sl[i-1]+1)){if(len>bestRun){bestRun=len;runCount=1;}else if(len===bestRun)runCount++;}
    }
    if(bestRun>=3){const p=(bestRun+rb)*runCount*m;pts+=p;breakdown.push(`Run${runCount>1?"s":""} of ${bestRun}${runCount>1?` x${runCount}`:""} = ${p}`);}
  }
  if(!rules.disableFlush){
    const fp=rules.flushPoints??1;
    const hs=hand.map(c=>c.suit);
    if(hs.every(s=>s===hs[0])){
      if(suits[4]===hs[0]){const p=5*fp*m;pts+=p;breakdown.push(`Flush (5) = ${p}`);}
      else if(!isCrib){const p=4*fp*m;pts+=p;breakdown.push(`Flush (4) = ${p}`);}
    }
  }
  if(!rules.disableNobs){
    const np=rules.nobPoints??1;
    if(hand.some(c=>c.rank==="J"&&c.suit===starter.suit)){const p=np*m;pts+=p;breakdown.push(`Nobs = ${p}`);}
  }
  return {points:pts,breakdown};
}

function scorePegging(played, newCard, rules={}) {
  const cards=[...played,newCard];
  const total=cards.reduce((s,c)=>s+RANK_VALUES[c.rank],0);
  const prevTotal=played.reduce((s,c)=>s+RANK_VALUES[c.rank],0);
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
  if(rules.nineElevenRule&&prevTotal===9&&newCard.rank==="2"){pts+=2;msgs.push("9/11 Rule! +2");}
  if(Array.isArray(rules.customPegRules)){
    for(const rule of rules.customPegRules){
      if(prevTotal===Number(rule.totalBefore)&&newCard.rank.toUpperCase()===String(rule.cardRank).toUpperCase()&&Number(rule.points)>0){
        pts+=Number(rule.points);msgs.push(`${rule.label||"Custom rule"} +${rule.points}`);
      }
    }
  }
  return {pts,msgs};
}

// ── AI Logic ──────────────────────────────────────────────────────────────────
function aiPickDiscard(hand, difficulty, isDealer, rules={}) {
  if(difficulty==="easy"){
    const idxs=[0,1,2,3,4,5];
    for(let i=idxs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idxs[i],idxs[j]]=[idxs[j],idxs[i]];}
    return [idxs[0],idxs[1]];
  }
  const fakeCuts=[
    {rank:"5",suit:"♠",id:"5♠"},{rank:"5",suit:"♥",id:"5♥"},
    {rank:"J",suit:"♠",id:"J♠"},{rank:"A",suit:"♠",id:"A♠"},
    {rank:"7",suit:"♠",id:"7♠"},{rank:"6",suit:"♠",id:"6♠"},
    {rank:"K",suit:"♠",id:"K♠"},{rank:"3",suit:"♠",id:"3♠"},
  ];
  let bestScore=-Infinity, bestPair=[0,1];
  for(let i=0;i<hand.length;i++){
    for(let j=i+1;j<hand.length;j++){
      const kept=hand.filter((_,idx)=>idx!==i&&idx!==j);
      let avg=0;
      for(const cut of fakeCuts){const {points}=scoreHand(kept,cut,false,rules);avg+=points;}
      avg/=fakeCuts.length;
      if(difficulty==="hard"||difficulty==="expert"){
        const disc=[hand[i],hand[j]];
        const cb=disc.reduce((s,c)=>{
          if(["5","J"].includes(c.rank))return s+1.5;
          if(["6","7","8"].includes(c.rank))return s+0.8;
          return s+0.3;
        },0);
        avg+=isDealer?cb*0.5:-cb*0.3;
      }
      if(avg>bestScore){bestScore=avg;bestPair=[i,j];}
    }
  }
  return bestPair;
}

function aiPickPegCard(hand, pegPile, pegTotal, difficulty, rules={}) {
  const playable=hand.filter(c=>pegTotal+RANK_VALUES[c.rank]<=31);
  if(playable.length===0)return null;
  if(difficulty==="easy")return playable[Math.floor(Math.random()*playable.length)];
  let best=null,bestScore=-Infinity;
  for(const card of playable){
    const {pts}=scorePegging(pegPile,card,rules);
    const newTotal=pegTotal+RANK_VALUES[card.rank];
    let score=pts;
    if(difficulty==="medium"){
      if(newTotal===15||newTotal===31)score+=5;
    } else {
      if(newTotal===15||newTotal===31)score+=10;
      if(newTotal===21)score+=2;
      const rem=31-newTotal;
      if([5,10,15,21].includes(rem))score-=3;
      if(pegPile.length>0&&pegPile[pegPile.length-1].rank===card.rank)score+=4;
    }
    if(difficulty==="expert"&&pegPile.length>=2){
      const last2=pegPile.slice(-2).map(c=>RANK_ORDER[c.rank]);
      const allO=[...last2,RANK_ORDER[card.rank]].sort((a,b)=>a-b);
      if(allO.every((v,i)=>i===0||v===allO[i-1]+1))score+=3;
    }
    if(score>bestScore){bestScore=score;best=card;}
  }
  return best||playable[0];
}

// ── Card Component ────────────────────────────────────────────────────────────
function Card({ card, selected, onClick, faceDown, small, disabled }) {
  const isRed=card&&RED_SUITS.has(card.suit);
  const w=small?52:72,h=small?76:108;
  return (
    <div onClick={!disabled?onClick:undefined}
      className={`card-face${selected?" card-selected":""}${disabled?" card-disabled":""}`}
      style={{width:w,height:h,borderRadius:10,
        border:selected?"2px solid #f0c040":faceDown?"1px solid #1e3a6e":disabled?"1px solid #1a2a3a":"1px solid #c8d8e8",
        background:faceDown?"linear-gradient(135deg,#0d1b35 0%,#162844 50%,#0d1b35 100%)":disabled?"linear-gradient(160deg,#0e1820,#121e2a)":"linear-gradient(160deg,#ffffff 0%,#f5f0e8 100%)",
        color:disabled?"#2a3a4a":isRed?"#c0392b":"#1a1a2e",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        cursor:onClick&&!disabled?"pointer":"default",
        boxShadow:selected?"0 12px 32px #f0c04055,0 0 0 1px #f0c04088":faceDown?"0 4px 12px #00000066,inset 0 1px 0 #2a4a8a33":disabled?"none":"0 4px 16px #00000044,inset 0 1px 0 #ffffff88",
        userSelect:"none",flexShrink:0,position:"relative",opacity:disabled?0.35:1,animation:"cardDeal 0.25s ease forwards"}}>
      {faceDown||!card?.rank?(
        <div style={{width:"80%",height:"80%",borderRadius:6,background:"repeating-linear-gradient(45deg,#1a3a6a 0px,#1a3a6a 4px,#1e4070 4px,#1e4070 8px)",opacity:0.6,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontSize:small?16:22,color:"#4a7abc",opacity:0.7}}>♦</div>
        </div>
      ):<>
        <div style={{position:"absolute",top:4,left:6,fontWeight:700,fontSize:small?11:15,lineHeight:1,fontFamily:"'Inter',sans-serif"}}>{card.rank}</div>
        <div style={{fontSize:small?20:30,lineHeight:1,filter:disabled?"grayscale(1)":"none"}}>{card.suit}</div>
        <div style={{position:"absolute",bottom:4,right:6,fontWeight:700,fontSize:small?11:15,lineHeight:1,transform:"rotate(180deg)",fontFamily:"'Inter',sans-serif"}}>{card.rank}</div>
      </>}
    </div>
  );
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function Board({ scores, winScore=121, yourIndex, cpuMode=false }) {
  const labels=cpuMode?["You","CPU"]:["You","Opponent"];
  return (
    <div style={{padding:"14px 18px",background:"linear-gradient(135deg,#0a1628,#0d1f35)",borderRadius:14,border:"1px solid #1e3a5e",boxShadow:"0 4px 20px #00000044"}}>
      <div style={{fontSize:10,color:"#3a6a9a",letterSpacing:2,marginBottom:10,fontFamily:"'Cinzel',serif"}}>SCOREBOARD</div>
      {[0,1].map(i=>{
        const label=i===yourIndex?labels[0]:labels[1];
        const color=i===yourIndex?"#4af0a0":"#f06a6a";
        const pct=Math.min(scores[i]/winScore,1)*100;
        return (
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:i===0?8:0}}>
            <div style={{width:68,fontSize:12,color,fontFamily:"'Cinzel',serif",letterSpacing:1}}>{label}</div>
            <div style={{flex:1,height:8,background:"#0a1628",borderRadius:4,overflow:"hidden",border:"1px solid #1a3050"}}>
              <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:4,transition:"width 0.6s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:`0 0 8px ${color}66`}}/>
            </div>
            <div style={{width:36,fontSize:16,fontWeight:700,color,textAlign:"right",fontFamily:"'Cinzel',serif"}}>{scores[i]}</div>
          </div>
        );
      })}
      <div style={{fontSize:10,color:"#2a4a6a",textAlign:"right",marginTop:6,fontFamily:"'Inter',sans-serif"}}>First to {winScore}</div>
    </div>
  );
}

// ── Score Modal ───────────────────────────────────────────────────────────────
function ScoreModal({ results, yourIndex, onClose }) {
  const [idx,setIdx]=useState(0);
  if(!results||results.length===0)return null;
  const r=results[idx];
  const isYours=r.who===yourIndex;
  return (
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)"}}>
      <div style={{background:"linear-gradient(160deg,#0f1b2d,#0a1220)",border:"1px solid #2a4a6e",borderRadius:20,padding:32,maxWidth:380,width:"92%",color:"#e8dfc8",boxShadow:"0 24px 64px #000a",animation:"fadeIn 0.3s ease"}}>
        <div style={{fontSize:11,color:"#4a7aaa",letterSpacing:2,marginBottom:4,fontFamily:"'Cinzel',serif"}}>{r.label.includes("Crib")?"CRIB":isYours?"YOUR HAND":"OPPONENT'S HAND"}</div>
        <h3 style={{fontSize:20,color:"#f0c040",marginBottom:4,fontFamily:"'Cinzel',serif"}}>{r.label}</h3>
        <div style={{fontSize:42,fontWeight:700,color:"#fff",marginBottom:16,fontFamily:"'Cinzel',serif"}}>{r.points} <span style={{fontSize:18,color:"#6a8aaa"}}>pts</span></div>
        <div style={{background:"#0a1628",borderRadius:10,padding:"4px 0",marginBottom:20}}>
          {r.breakdown.length===0
            ?<div style={{color:"#3a5a7a",fontSize:13,padding:"8px 14px"}}>No score this hand</div>
            :r.breakdown.map((b,i)=>(
              <div key={i} style={{padding:"8px 14px",borderBottom:i<r.breakdown.length-1?"1px solid #1a2a40":"none",fontSize:14,color:"#b0cce8",fontFamily:"'Inter',sans-serif"}}>
                <span style={{color:"#f0c040",marginRight:8}}>◆</span>{b}
              </div>
            ))}
        </div>
        <button onClick={()=>{if(idx<results.length-1)setIdx(i=>i+1);else onClose();}} className="btn-primary">
          {idx<results.length-1?"NEXT →":"CONTINUE"}
        </button>
      </div>
    </div>
  );
}

// ── Custom Scoring ────────────────────────────────────────────────────────────
function CustomScoring({ rules, setRules, onSave, onClose, isHost }) {
  const [tab,setTab]=useState("standard");
  const toggle=k=>setRules(r=>({...r,[k]:!r[k]}));
  const setNum=(k,v)=>setRules(r=>({...r,[k]:Number(v)}));
  const [builderRules,setBuilderRules]=useState(rules.customPegRules||[]);
  const [newRule,setNewRule]=useState({totalBefore:"",cardRank:"",points:2,label:""});
  function addRule(){
    if(!newRule.totalBefore||!newRule.cardRank)return;
    const updated=[...builderRules,{...newRule,id:Date.now()}];
    setBuilderRules(updated);setRules(r=>({...r,customPegRules:updated}));
    setNewRule({totalBefore:"",cardRank:"",points:2,label:""});
  }
  function removeRule(id){const updated=builderRules.filter(r=>r.id!==id);setBuilderRules(updated);setRules(r=>({...r,customPegRules:updated}));}
  const inp={background:"#0a1628",border:"1px solid #2a4a6a",borderRadius:8,color:"#e8dfc8",padding:"6px 10px",fontFamily:"'Inter',sans-serif",fontSize:13};
  const Toggle=({on,onClick,disabled})=>(
    <button onClick={onClick} disabled={disabled} style={{width:44,height:24,borderRadius:12,border:"none",cursor:disabled?"default":"pointer",background:on?"linear-gradient(90deg,#1a8a4a,#0d6a38)":"#1a2a3a",position:"relative",transition:"all 0.2s",opacity:disabled?0.5:1,boxShadow:on?"0 0 10px #1a8a4a66":"none"}}>
      <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?23:3,transition:"left 0.2s",boxShadow:"0 1px 4px #0008"}}/>
    </button>
  );
  const SRow=({label,desc,disableKey,children})=>(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #1a2a40"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:13,color:"#c8dce8",fontFamily:"'Inter',sans-serif"}}>{label}</div>
        {desc&&<div style={{fontSize:11,color:"#4a6a8a",marginTop:2}}>{desc}</div>}
      </div>
      {children}
      {disableKey&&<Toggle on={!rules[disableKey]} onClick={()=>toggle(disableKey)} disabled={!isHost}/>}
    </div>
  );
  return (
    <div style={{position:"fixed",inset:0,background:"#000c",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)"}}>
      <div style={{background:"linear-gradient(160deg,#0f1b2d,#0a1220)",border:"1px solid #2a4a6e",borderRadius:20,padding:24,maxWidth:440,width:"94%",color:"#e8dfc8",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 24px 64px #000a",animation:"fadeIn 0.3s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:10,color:"#4a7aaa",letterSpacing:2,fontFamily:"'Cinzel',serif"}}>SETTINGS</div>
            <h3 style={{fontSize:18,color:"#f0c040",fontFamily:"'Cinzel',serif"}}>Custom Rules {!isHost&&<span style={{fontSize:11,color:"#4a5a6a"}}>(view only)</span>}</h3>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#4a6a8a",fontSize:20,cursor:"pointer"}}>x</button>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:16,background:"#0a1628",borderRadius:10,padding:4}}>
          {[["standard","Standard"],["presets","Presets"],["builder","Rule Builder"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px 4px",borderRadius:8,border:"none",background:tab===id?"linear-gradient(135deg,#1a3a5a,#0d2a45)":"none",color:tab===id?"#f0c040":"#4a6a8a",fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:1,cursor:"pointer",transition:"all 0.2s"}}>{label}</button>
          ))}
        </div>
        {tab==="standard"&&<>
          <SRow label="Fifteens" desc="Points per fifteen" disableKey="disableFifteens"><input type="number" min={1} max={10} value={rules.fifteenPoints??2} onChange={e=>setNum("fifteenPoints",e.target.value)} style={{...inp,width:52}} disabled={!isHost}/></SRow>
          <SRow label="Pairs" desc="Points per pair" disableKey="disablePairs"><input type="number" min={1} max={10} value={rules.pairPoints??2} onChange={e=>setNum("pairPoints",e.target.value)} style={{...inp,width:52}} disabled={!isHost}/></SRow>
          <SRow label="Runs" desc="Bonus pts per card in run" disableKey="disableRuns"><input type="number" min={0} max={5} value={rules.runBonus??0} onChange={e=>setNum("runBonus",e.target.value)} style={{...inp,width:52}} disabled={!isHost}/></SRow>
          <SRow label="Flush" desc="Points per card in flush" disableKey="disableFlush"><input type="number" min={1} max={5} value={rules.flushPoints??1} onChange={e=>setNum("flushPoints",e.target.value)} style={{...inp,width:52}} disabled={!isHost}/></SRow>
          <SRow label="Nobs" desc="Points for Jack of starter suit" disableKey="disableNobs"><input type="number" min={1} max={5} value={rules.nobPoints??1} onChange={e=>setNum("nobPoints",e.target.value)} style={{...inp,width:52}} disabled={!isHost}/></SRow>
          <SRow label="Double All Scoring"><Toggle on={!!rules.doubleScoring} onClick={()=>toggle("doubleScoring")} disabled={!isHost}/></SRow>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0"}}>
            <div style={{flex:1,fontSize:13,color:"#c8dce8",fontFamily:"'Inter',sans-serif"}}>Winning Score</div>
            <input type="number" min={61} max={361} step={60} value={rules.winScore??121} onChange={e=>setNum("winScore",e.target.value)} style={{...inp,width:72}} disabled={!isHost}/>
          </div>
        </>}
        {tab==="presets"&&<>
          <div style={{fontSize:12,color:"#4a6a8a",marginBottom:12,fontFamily:"'Inter',sans-serif"}}>Toggle special pegging rules.</div>
          <div style={{background:"#0a1628",borderRadius:12,padding:16,border:rules.nineElevenRule?"1px solid #f0c04044":"1px solid #1a3050",transition:"border 0.2s"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontSize:14,color:"#f0c040",fontFamily:"'Cinzel',serif",marginBottom:4}}>The 9/11 Rule</div>
                <div style={{fontSize:12,color:"#6a8aaa",fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>Running total of <strong style={{color:"#c8dce8"}}>9</strong> + a <strong style={{color:"#c8dce8"}}>2</strong> played = <strong style={{color:"#c8dce8"}}>+2 bonus points</strong>.</div>
                <div style={{marginTop:6,fontSize:11,color:rules.nineElevenRule?"#4af0a0":"#3a5a7a"}}>{rules.nineElevenRule?"Active":"Inactive"}</div>
              </div>
              <Toggle on={!!rules.nineElevenRule} onClick={()=>toggle("nineElevenRule")} disabled={!isHost}/>
            </div>
          </div>
        </>}
        {tab==="builder"&&<>
          <div style={{fontSize:12,color:"#4a6a8a",marginBottom:12,fontFamily:"'Inter',sans-serif"}}>If total is X and card played is Y, award Z points.</div>
          {builderRules.length===0&&<div style={{textAlign:"center",color:"#3a5a7a",fontSize:13,padding:"16px 0"}}>No custom rules yet.</div>}
          {builderRules.map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#0a1628",borderRadius:10,marginBottom:6,border:"1px solid #1a3050"}}>
              <div style={{flex:1,fontSize:12,color:"#a0bcd8",fontFamily:"'Inter',sans-serif"}}>{r.label||`Total ${r.totalBefore} + ${r.cardRank} = +${r.points}pts`}</div>
              {isHost&&<button onClick={()=>removeRule(r.id)} style={{background:"none",border:"none",color:"#6a3a3a",cursor:"pointer",fontSize:16}}>x</button>}
            </div>
          ))}
          {isHost&&(
            <div style={{background:"#0a1628",borderRadius:12,padding:14,marginTop:8,border:"1px solid #1a3a5a"}}>
              <div style={{fontSize:11,color:"#4a7aaa",letterSpacing:1,marginBottom:10,fontFamily:"'Cinzel',serif"}}>ADD NEW RULE</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                <div><div style={{fontSize:10,color:"#4a6a8a",marginBottom:4}}>TOTAL BEFORE</div><input type="number" min={0} max={30} placeholder="9" value={newRule.totalBefore} onChange={e=>setNewRule(r=>({...r,totalBefore:e.target.value}))} style={{...inp,width:"100%"}}/></div>
                <div><div style={{fontSize:10,color:"#4a6a8a",marginBottom:4}}>CARD PLAYED</div><input type="text" maxLength={2} placeholder="2" value={newRule.cardRank} onChange={e=>setNewRule(r=>({...r,cardRank:e.target.value.toUpperCase()}))} style={{...inp,width:"100%"}}/></div>
                <div><div style={{fontSize:10,color:"#4a6a8a",marginBottom:4}}>AWARD PTS</div><input type="number" min={1} max={20} value={newRule.points} onChange={e=>setNewRule(r=>({...r,points:Number(e.target.value)}))} style={{...inp,width:"100%"}}/></div>
              </div>
              <div style={{marginBottom:8}}><div style={{fontSize:10,color:"#4a6a8a",marginBottom:4}}>RULE NAME (optional)</div><input type="text" placeholder="My Special Rule" value={newRule.label} onChange={e=>setNewRule(r=>({...r,label:e.target.value}))} style={{...inp,width:"100%"}}/></div>
              <button onClick={addRule} className="btn-secondary" style={{fontSize:12,padding:"8px 14px"}}>+ Add Rule</button>
            </div>
          )}
        </>}
        <div style={{display:"flex",gap:8,marginTop:20}}>
          {isHost&&<button onClick={onSave} className="btn-primary" style={{flex:2}}>SAVE & SYNC</button>}
          <button onClick={onClose} className="btn-secondary" style={{flex:1}}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// ── Lobby ─────────────────────────────────────────────────────────────────────
function Lobby({ onCreate, onJoin, onVsCPU, error }) {
  const [code,setCode]=useState("");
  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 20% 50%,#0d1f3a 0%,#080e1a 60%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        {["♠","♥","♦","♣"].map((s,i)=>(
          <div key={i} style={{position:"absolute",fontSize:120,opacity:0.03,color:"#fff",top:`${[10,60,20,70][i]}%`,left:`${[5,75,85,20][i]}%`,transform:`rotate(${[-15,10,-20,5][i]}deg)`,fontFamily:"'Georgia',serif"}}>{s}</div>
        ))}
      </div>
      <div style={{textAlign:"center",maxWidth:380,width:"100%",animation:"fadeIn 0.5s ease"}}>
        <div style={{marginBottom:32}}>
          <div style={{fontSize:64,marginBottom:8,filter:"drop-shadow(0 0 20px #f0c04044)"}}>♣</div>
          <h1 style={{fontSize:36,color:"#f0c040",fontFamily:"'Cinzel',serif",letterSpacing:4,fontWeight:700,marginBottom:4}}>CRIBBAGE</h1>
          <div style={{fontSize:11,color:"#3a6a9a",letterSpacing:4,fontFamily:"'Cinzel',serif"}}>MULTIPLAYER</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,#1e3a5e)"}}/>
          <div style={{color:"#2a4a6a",fontSize:12}}>♦</div>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,#1e3a5e,transparent)"}}/>
        </div>
        <button onClick={onVsCPU} className="btn-gold" style={{marginBottom:10}}>🤖 PLAY VS COMPUTER</button>
        <button onClick={onCreate} className="btn-primary" style={{marginBottom:12}}>🃏 CREATE ONLINE ROOM</button>
        <div style={{margin:"16px 0",color:"#2a4a6a",fontSize:12,fontFamily:"'Cinzel',serif",letterSpacing:2}}>— OR JOIN —</div>
        <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6}
          style={{width:"100%",padding:"14px 16px",background:"linear-gradient(135deg,#0a1628,#0d1f35)",border:"1px solid #2a4a6a",borderRadius:12,color:"#e8dfc8",fontSize:22,letterSpacing:6,textAlign:"center",boxSizing:"border-box",marginBottom:10,fontFamily:"'Cinzel',serif",outline:"none"}}
          onFocus={e=>{e.target.style.borderColor="#f0c040";}}
          onBlur={e=>{e.target.style.borderColor="#2a4a6a";}}
        />
        <button onClick={()=>onJoin(code)} className="btn-secondary">JOIN ROOM</button>
        {error&&<div style={{marginTop:14,color:"#f06a6a",fontSize:13,background:"#2a0d0d",borderRadius:8,padding:"8px 14px",border:"1px solid #5a1a1a"}}>{error}</div>}
      </div>
    </div>
  );
}

// ── Difficulty Selector ───────────────────────────────────────────────────────
function DifficultySelect({ onSelect, onBack }) {
  const diffs=[
    {id:"easy",label:"Easy",desc:"Plays randomly. Great for beginners.",icon:"🌱",color:"#2a8a4a"},
    {id:"medium",label:"Medium",desc:"Basic strategy — discards well, pegs casually.",icon:"⚔️",color:"#8a7a2a"},
    {id:"hard",label:"Hard",desc:"Strong discard and pegging strategy.",icon:"🔥",color:"#8a4a2a"},
    {id:"expert",label:"Expert",desc:"Never misses a scoring opportunity.",icon:"💀",color:"#8a2a2a"},
  ];
  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 20% 50%,#0d1f3a 0%,#080e1a 60%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:20}}>
      <div style={{maxWidth:400,width:"100%",animation:"fadeIn 0.4s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:11,color:"#3a6a9a",letterSpacing:4,fontFamily:"'Cinzel',serif",marginBottom:8}}>VS COMPUTER</div>
          <h2 style={{fontSize:28,color:"#f0c040",fontFamily:"'Cinzel',serif",letterSpacing:3}}>CHOOSE DIFFICULTY</h2>
        </div>
        {diffs.map(d=>(
          <div key={d.id} onClick={()=>onSelect(d.id)}
            style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",background:"linear-gradient(135deg,#0a1628,#0d1f35)",border:`1px solid ${d.color}44`,borderRadius:14,marginBottom:10,cursor:"pointer",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=d.color;e.currentTarget.style.transform="translateX(4px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=`${d.color}44`;e.currentTarget.style.transform="none";}}>
            <div style={{fontSize:28}}>{d.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,color:"#e8dfc8",fontFamily:"'Cinzel',serif",letterSpacing:2,marginBottom:3}}>{d.label.toUpperCase()}</div>
              <div style={{fontSize:12,color:"#4a6a8a",fontFamily:"'Inter',sans-serif"}}>{d.desc}</div>
            </div>
            <div style={{color:d.color,fontSize:18}}>→</div>
          </div>
        ))}
        <button onClick={onBack} className="btn-secondary" style={{marginTop:8,fontSize:12}}>← BACK</button>
      </div>
    </div>
  );
}

// ── Waiting Room ──────────────────────────────────────────────────────────────
function WaitingRoom({ roomCode, onCopy, toast }) {
  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 20% 50%,#0d1f3a 0%,#080e1a 60%)",display:"flex",alignItems:"center",justifyContent:"center",color:"#e8dfc8",flexDirection:"column",gap:28}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8,filter:"drop-shadow(0 0 20px #f0c04044)"}}>♣</div>
        <div style={{fontSize:28,color:"#f0c040",fontFamily:"'Cinzel',serif",letterSpacing:4}}>CRIBBAGE</div>
      </div>
      <div style={{fontSize:14,color:"#6a8aaa",fontFamily:"'Inter',sans-serif"}} className="pulse">Waiting for opponent to join…</div>
      <div style={{background:"linear-gradient(135deg,#0a1628,#0d1f35)",border:"1px solid #2a4a6a",borderRadius:20,padding:"28px 48px",textAlign:"center",boxShadow:"0 12px 40px #00000066",animation:"glow 3s infinite"}}>
        <div style={{fontSize:10,color:"#3a6a9a",letterSpacing:3,marginBottom:10,fontFamily:"'Cinzel',serif"}}>ROOM CODE</div>
        <div style={{fontSize:48,fontWeight:700,letterSpacing:8,fontFamily:"'Cinzel',serif",color:"#f0c040"}}>{roomCode}</div>
        <div style={{fontSize:11,color:"#3a5a7a",marginTop:8}}>Share with your opponent</div>
      </div>
      <button onClick={onCopy} style={{padding:"10px 28px",background:"linear-gradient(135deg,#1a3050,#0d2040)",border:"1px solid #2a5a8a",borderRadius:10,color:"#8abcf0",cursor:"pointer",fontSize:13,transition:"all 0.2s"}}>
        Copy Code
      </button>
      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#0d2820",border:"1px solid #1a6a3a",borderRadius:10,padding:"10px 20px",color:"#4af0a0",fontSize:13}}>{toast}</div>}
    </div>
  );
}

// ── CPU Game State Machine ────────────────────────────────────────────────────
function initCPUGame() {
  const deck=shuffleDeck(createDeck());
  const playerHand=deck.slice(0,6);
  const cpuHand=deck.slice(6,12);
  const rest=deck.slice(12);
  const dealer=Math.random()<0.5?0:1; // 0=player,1=cpu
  return {
    phase:"discard",deck:rest,
    playerHand:[...playerHand],cpuHand:[...cpuHand],
    playerPegHand:[],cpuPegHand:[],
    crib:[],starter:null,
    scores:[0,0],dealer,
    pegPile:[],pegTotal:0,pegLog:[],pegTurn:1-dealer,
    savedPlayer:[],savedCpu:[],savedCrib:[],
    winner:null,scoreResults:null,
  };
}

function applyPegPlay(state, card, who, rules) {
  const ws=rules.winScore??121;
  const {pts,msgs}=scorePegging(state.pegPile,card,rules);
  const newPile=[...state.pegPile,card];
  const newTotal=state.pegTotal+RANK_VALUES[card.rank];
  const newLog=[...state.pegLog];
  let newScores=[...state.scores];
  if(pts>0){newScores[who]=Math.min(newScores[who]+pts,ws);newLog.push(`${who===0?"You":"CPU"}: ${msgs.join(", ")} +${pts}`);}
  else newLog.push(`${who===0?"You":"CPU"} plays ${card.rank}${card.suit} (${newTotal})`);
  const pile=newTotal===31?[]:newPile;
  const tot=newTotal===31?0:newTotal;
  const newPH=who===0?state.playerPegHand.filter(c=>c.id!==card.id):state.playerPegHand;
  const newCH=who===1?state.cpuPegHand.filter(c=>c.id!==card.id):state.cpuPegHand;
  if(newScores[0]>=ws)return{...state,scores:newScores,playerPegHand:newPH,cpuPegHand:newCH,pegPile:pile,pegTotal:tot,pegLog:newLog,winner:0,phase:"gameover"};
  if(newScores[1]>=ws)return{...state,scores:newScores,playerPegHand:newPH,cpuPegHand:newCH,pegPile:pile,pegTotal:tot,pegLog:newLog,winner:1,phase:"gameover"};
  if(newPH.length===0&&newCH.length===0){
    newScores[who]=Math.min(newScores[who]+1,ws);newLog.push(`${who===0?"You":"CPU"} gets last card +1`);
    if(newScores[0]>=ws)return{...state,scores:newScores,playerPegHand:newPH,cpuPegHand:newCH,pegPile:pile,pegTotal:tot,pegLog:newLog,winner:0,phase:"gameover"};
    if(newScores[1]>=ws)return{...state,scores:newScores,playerPegHand:newPH,cpuPegHand:newCH,pegPile:pile,pegTotal:tot,pegLog:newLog,winner:1,phase:"gameover"};
    return{...state,scores:newScores,playerPegHand:newPH,cpuPegHand:newCH,pegPile:pile,pegTotal:tot,pegLog:newLog,phase:"show"};
  }
  return{...state,scores:newScores,playerPegHand:newPH,cpuPegHand:newCH,pegPile:pile,pegTotal:tot,pegLog:newLog,pegTurn:1-who};
}

function applyGo(state, who, rules) {
  const ws=rules.winScore??121;
  const other=1-who;
  const newLog=[...state.pegLog,`${who===0?"You":"CPU"} say Go`];
  const otherHand=other===0?state.playerPegHand:state.cpuPegHand;
  const otherHasPlay=otherHand.some(c=>state.pegTotal+RANK_VALUES[c.rank]<=31);
  let newScores=[...state.scores];
  if(!otherHasPlay){
    newScores[other]=Math.min(newScores[other]+1,ws);newLog.push(`${other===0?"You":"CPU"} get 1 for Go`);
    const bothEmpty=state.playerPegHand.length===0&&state.cpuPegHand.length===0;
    if(newScores[0]>=ws)return{...state,scores:newScores,pegLog:newLog,winner:0,phase:"gameover"};
    if(newScores[1]>=ws)return{...state,scores:newScores,pegLog:newLog,winner:1,phase:"gameover"};
    return{...state,scores:newScores,pegLog:newLog,pegPile:[],pegTotal:0,pegTurn:other,phase:bothEmpty?"show":"pegging"};
  }
  return{...state,scores:newScores,pegLog:newLog,pegTurn:other};
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const ws=useRef(null);
  const [screen,setScreen]=useState("lobby");
  const [roomCode,setRoomCode]=useState(null);
  const [lobbyError,setLobbyError]=useState(null);
  const [gameState,setGameState]=useState(null);
  const [yourIndex,setYourIndex]=useState(null);
  const [selectedCards,setSelectedCards]=useState(new Set());
  const [scoreResults,setScoreResults]=useState(null);
  const [showCustom,setShowCustom]=useState(false);
  const [localRules,setLocalRules]=useState({});
  const [toast,setToast]=useState(null);
  const [difficulty,setDifficulty]=useState("medium");
  const [cpuGame,setCpuGame]=useState(null);

  const send=useCallback(msg=>{if(ws.current&&ws.current.readyState===1)ws.current.send(JSON.stringify(msg));},[]);
  function showToast(msg,dur=3000){setToast(msg);setTimeout(()=>setToast(null),dur);}

  // CPU auto-peg
  useEffect(()=>{
    if(screen!=="cpugame"||!cpuGame||cpuGame.phase!=="pegging"||cpuGame.pegTurn!==1)return;
    const delay={easy:1200,medium:900,hard:600,expert:400}[difficulty]||800;
    const t=setTimeout(()=>{
      setCpuGame(prev=>{
        if(!prev||prev.phase!=="pegging"||prev.pegTurn!==1)return prev;
        const card=aiPickPegCard(prev.cpuPegHand,prev.pegPile,prev.pegTotal,difficulty,localRules);
        if(!card)return applyGo(prev,1,localRules);
        return applyPegPlay(prev,card,1,localRules);
      });
    },delay);
    return()=>clearTimeout(t);
  },[cpuGame?.pegTurn,cpuGame?.phase,screen]);

  // Show score results when entering show phase in CPU game
  useEffect(()=>{
    if(cpuGame?.scoreResults){setScoreResults(cpuGame.scoreResults);}
  },[cpuGame?.scoreResults]);

  function connect(onOpen){
    if(ws.current)ws.current.close();
    const socket=new WebSocket(WS_URL);ws.current=socket;socket.onopen=onOpen;
    socket.onmessage=e=>{
      const msg=JSON.parse(e.data);
      if(msg.type==="created"){setRoomCode(msg.code);setYourIndex(0);setScreen("waiting");}
      else if(msg.type==="joined"){setRoomCode(msg.code);setYourIndex(1);}
      else if(msg.type==="state"){setGameState(msg);if(msg.yourIndex!==undefined)setYourIndex(msg.yourIndex);if(msg.rules)setLocalRules(msg.rules);setScreen("game");if(msg.scoreResults)setScoreResults(msg.scoreResults);if(msg.toast)showToast(msg.toast);}
      else if(msg.type==="error"){setLobbyError(msg.msg);showToast(msg.msg);}
    };
    socket.onclose=()=>{if(screen!=="lobby")showToast("Connection lost.");setTimeout(()=>{setScreen("lobby");setGameState(null);setRoomCode(null);},1500);};
  }

  function handleCreate(){setLobbyError(null);connect(()=>ws.current.send(JSON.stringify({type:"create",rules:localRules})));}
  function handleJoin(code){if(!code||code.length!==6){setLobbyError("Enter a 6-character room code");return;}setLobbyError(null);connect(()=>ws.current.send(JSON.stringify({type:"join",code})));}
  function toggleSelect(id){setSelectedCards(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else if(n.size<2)n.add(id);return n;});}
  function sendDiscard(){if(selectedCards.size!==2)return;send({type:"discard",cardIds:[...selectedCards]});setSelectedCards(new Set());}
  function sendPeg(cardId){send({type:"peg",cardId});}
  function sendGo(){send({type:"go"});}
  function sendCut(){send({type:"cut"});}
  function sendScoreShow(){send({type:"scoreShow"});}
  function saveRules(){send({type:"updateRules",rules:localRules});setShowCustom(false);}

  // CPU game actions
  function startCPUGame(){
    const g=initCPUGame();
    // CPU discards automatically
    const idxs=aiPickDiscard(g.cpuHand,difficulty,g.dealer===1,localRules);
    const cpuDisc=idxs.map(i=>g.cpuHand[i]);
    const cpuKept=g.cpuHand.filter((_,i)=>!idxs.includes(i));
    setCpuGame({...g,cpuHand:cpuKept,_cpuDiscards:cpuDisc});
    setSelectedCards(new Set());
    setScoreResults(null);
  }

  function cpuPlayerDiscard(){
    if(selectedCards.size!==2)return;
    setCpuGame(prev=>{
      if(!prev)return prev;
      const toDiscard=prev.playerHand.filter(c=>selectedCards.has(c.id));
      const playerKept=prev.playerHand.filter(c=>!selectedCards.has(c.id));
      const crib=prev.dealer===1?[...prev._cpuDiscards,...toDiscard]:[...toDiscard,...prev._cpuDiscards];
      return{...prev,phase:"cut",playerHand:playerKept,playerPegHand:[...playerKept],cpuPegHand:[...prev.cpuHand],crib,_cpuDiscards:undefined};
    });
    setSelectedCards(new Set());
  }

  function cpuCut(){
    setCpuGame(prev=>{
      if(!prev||prev.phase!=="cut")return prev;
      const ws2=localRules.winScore??121;
      const starter=prev.deck[Math.floor(Math.random()*prev.deck.length)];
      const newLog=[...prev.pegLog];
      let newScores=[...prev.scores];
      if(starter.rank==="J"){newScores[prev.dealer]=Math.min(newScores[prev.dealer]+2,ws2);newLog.push("Dealer gets 2 for cutting a Jack!");}
      return{...prev,phase:"pegging",starter,
        savedPlayer:[...prev.playerHand],savedCpu:[...prev.cpuHand],savedCrib:[...prev.crib],
        scores:newScores,pegLog:newLog,pegTurn:1-prev.dealer};
    });
  }

  function cpuPlayerPeg(cardId){
    setCpuGame(prev=>{
      if(!prev||prev.phase!=="pegging"||prev.pegTurn!==0)return prev;
      const card=prev.playerPegHand.find(c=>c.id===cardId);
      if(!card||prev.pegTotal+RANK_VALUES[card.rank]>31)return prev;
      return applyPegPlay(prev,card,0,localRules);
    });
  }

  function cpuPlayerGo(){setCpuGame(prev=>{if(!prev)return prev;return applyGo(prev,0,localRules);});}

  function cpuScoreHands(){
    setCpuGame(prev=>{
      if(!prev||prev.phase!=="show")return prev;
      const ws2=localRules.winScore??121;
      const nonDealer=1-prev.dealer;
      const results=[];
      let newScores=[...prev.scores];
      for(const pi of[nonDealer,prev.dealer]){
        const hand=pi===0?prev.savedPlayer:prev.savedCpu;
        const r=scoreHand(hand,prev.starter,false,localRules);
        newScores[pi]=Math.min(newScores[pi]+r.points,ws2);
        results.push({who:pi,label:pi===0?"Your Hand":"CPU Hand",...r});
        if(newScores[0]>=ws2||newScores[1]>=ws2)break;
      }
      if(newScores[0]<ws2&&newScores[1]<ws2){
        const cr=scoreHand(prev.savedCrib,prev.starter,true,localRules);
        newScores[prev.dealer]=Math.min(newScores[prev.dealer]+cr.points,ws2);
        results.push({who:prev.dealer,label:"Crib",...cr});
      }
      const winner=newScores[0]>=ws2?0:newScores[1]>=ws2?1:null;
      if(winner!==null)return{...prev,scores:newScores,winner,phase:"gameover",scoreResults:results};
      // New round
      const deck2=shuffleDeck(createDeck());
      const newDealer=1-prev.dealer;
      const pH=deck2.slice(0,6),cH=deck2.slice(6,12),rest=deck2.slice(12);
      const cpuIdxs=aiPickDiscard(cH,difficulty,newDealer===1,localRules);
      const cpuDisc2=cpuIdxs.map(i=>cH[i]);
      const cpuKept2=cH.filter((_,i)=>!cpuIdxs.includes(i));
      return{...prev,scores:newScores,phase:"discard",deck:rest,
        playerHand:pH,cpuHand:cpuKept2,playerPegHand:[],cpuPegHand:[],
        crib:[],starter:null,pegPile:[],pegTotal:0,pegLog:[],
        dealer:newDealer,pegTurn:1-newDealer,
        savedPlayer:[],savedCpu:[],savedCrib:[],
        winner:null,scoreResults:results,_cpuDiscards:cpuDisc2};
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if(screen==="lobby")return<><GlobalStyle/><Lobby onCreate={handleCreate} onJoin={handleJoin} onVsCPU={()=>setScreen("difficulty")} error={lobbyError}/></>;
  if(screen==="difficulty")return<><GlobalStyle/><DifficultySelect onSelect={d=>{setDifficulty(d);setScreen("cpugame");setTimeout(startCPUGame,50);}} onBack={()=>setScreen("lobby")}/></>;
  if(screen==="waiting")return<><GlobalStyle/><WaitingRoom roomCode={roomCode} onCopy={()=>navigator.clipboard?.writeText(roomCode).then(()=>showToast("Copied!"))} toast={toast}/></>;

  const diffLabel={easy:"🌱 Easy",medium:"⚔️ Medium",hard:"🔥 Hard",expert:"💀 Expert"}[difficulty];

  // ── CPU Game ──────────────────────────────────────────────────────────────
  if(screen==="cpugame"&&cpuGame){
    const s=cpuGame;
    const phase=s.phase;
    const isDealer=s.dealer===0;
    const isMyPegTurn=s.pegTurn===0;
    const winScore=localRules.winScore??121;
    const myHand=phase==="show"?s.savedPlayer:phase==="pegging"?s.playerPegHand:s.playerHand;
    const cpuCardCount=phase==="show"?s.savedCpu.length:phase==="pegging"?s.cpuPegHand.length:s.cpuHand.length;
    const cpuShowHand=phase==="show"?s.savedCpu:null;
    const canPegCard=c=>s.pegTotal+(RANK_VALUES[c.rank]||0)<=31;
    const hasPlayable=(phase==="pegging"?s.playerPegHand:myHand).some(canPegCard);
    const cribDisplay=s.savedCrib.length>0?s.savedCrib:s.crib;

    return<>
      <GlobalStyle/>
      <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 10% 0%,#0d1f3a 0%,#080e1a 50%)",color:"#e8dfc8",fontFamily:"'Inter',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 12px 48px"}}>
        <div style={{width:"100%",maxWidth:500,display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#f0c040",fontFamily:"'Cinzel',serif",letterSpacing:3}}>♣ CRIBBAGE</div>
            <div style={{fontSize:10,color:"#3a6a8a",letterSpacing:1,marginTop:2}}>
              {isDealer?"YOU ARE DEALER":"CPU IS DEALER"}
              <span style={{color:"#1e3a5a",margin:"0 6px"}}>|</span>
              <span style={{color:"#8a7a2a"}}>{diffLabel}</span>
            </div>
          </div>
          <button onClick={()=>setShowCustom(true)} style={{padding:"8px 14px",background:"linear-gradient(135deg,#1a2a40,#0d1a2e)",border:"1px solid #2a4a6a",borderRadius:10,color:"#6a9acc",cursor:"pointer",fontSize:12,fontFamily:"'Cinzel',serif",letterSpacing:1}}>RULES</button>
        </div>

        <div style={{width:"100%",maxWidth:500,marginBottom:14}}><Board scores={s.scores} winScore={winScore} yourIndex={0} cpuMode/></div>

        <div style={{width:"100%",maxWidth:500,marginBottom:12}}>
          <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>CPU · {cpuCardCount} CARDS</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {cpuShowHand?cpuShowHand.map((c,i)=><Card key={i} card={c} small/>):Array.from({length:cpuCardCount}).map((_,i)=><Card key={i} card={{}} faceDown small/>)}
          </div>
        </div>

        <div style={{width:"100%",maxWidth:500,display:"flex",gap:14,marginBottom:12,alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>STARTER</div>
            {s.starter?<Card card={s.starter}/>:<div style={{width:72,height:108,borderRadius:10,border:"1.5px dashed #1e3a5e",display:"flex",alignItems:"center",justifyContent:"center",color:"#1e3a5e",fontSize:24}}>?</div>}
          </div>
          {phase==="pegging"&&(
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>
                PLAYED <span style={{color:s.pegTotal>31?"#f06a6a":"#f0c040",marginLeft:8,fontSize:16,fontWeight:700}}>{s.pegTotal}</span>
                {isMyPegTurn?<span style={{color:"#4af0a0",marginLeft:10,fontSize:10}}>YOUR TURN</span>:<span style={{color:"#f0c040",marginLeft:10,fontSize:10}}>CPU THINKING...</span>}
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{s.pegPile.map((c,i)=><Card key={i} card={c} small/>)}</div>
              <div style={{maxHeight:80,overflowY:"auto"}}>{s.pegLog.slice(-5).map((l,i)=><div key={i} style={{fontSize:11,color:"#5a8aaa",lineHeight:1.8}}><span style={{color:"#2a4a6a",marginRight:6}}>›</span>{l}</div>)}</div>
            </div>
          )}
        </div>

        {cribDisplay.length>0&&(
          <div style={{width:"100%",maxWidth:500,marginBottom:12}}>
            <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>CRIB · {isDealer?"YOURS":"CPU'S"} · {s.crib.length} CARDS</div>
            <div style={{display:"flex",gap:4}}>{cribDisplay.map((c,i)=><Card key={i} card={c} faceDown={s.savedCrib.length===0} small/>)}</div>
          </div>
        )}

        <div style={{width:"100%",maxWidth:500,marginBottom:16}}>
          <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>
            YOUR HAND {phase==="discard"&&<span style={{color:"#f0c040",marginLeft:8}}>SELECT 2 FOR CRIB ({selectedCards.size}/2)</span>}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {myHand.map(c=>{
              const sel=selectedCards.has(c.id);
              const notPlay=phase==="pegging"&&!canPegCard(c);
              return<Card key={c.id} card={c} selected={sel}
                disabled={notPlay||(phase==="pegging"&&!isMyPegTurn)}
                onClick={phase==="discard"?()=>toggleSelect(c.id):phase==="pegging"&&isMyPegTurn&&canPegCard(c)?()=>cpuPlayerPeg(c.id):undefined}/>;
            })}
          </div>
        </div>

        <div style={{width:"100%",maxWidth:500}}>
          {phase==="discard"&&<button onClick={cpuPlayerDiscard} disabled={selectedCards.size!==2} className="btn-primary">SEND {selectedCards.size}/2 CARDS TO CRIB</button>}
          {phase==="cut"&&<button onClick={cpuCut} style={{width:"100%",padding:"14px 20px",background:"linear-gradient(135deg,#4a2a0a,#2a1608)",border:"1px solid #8a5a2a",borderRadius:12,color:"#f0d0a0",fontFamily:"'Cinzel',serif",fontSize:14,letterSpacing:2,cursor:"pointer"}}>CUT THE DECK</button>}
          {phase==="pegging"&&isMyPegTurn&&<div style={{display:"flex",gap:10,alignItems:"center"}}><div style={{flex:1,fontSize:13,color:"#5a8aaa"}}>{hasPlayable?"Tap a card to play":"No playable cards"}</div><button onClick={cpuPlayerGo} className="btn-danger">SAY GO</button></div>}
          {phase==="show"&&<button onClick={cpuScoreHands} className="btn-purple">SCORE HANDS</button>}
          {phase==="gameover"&&<div style={{textAlign:"center",animation:"fadeIn 0.5s ease"}}>
            <div style={{fontSize:36,fontWeight:700,color:"#f0c040",marginBottom:8,fontFamily:"'Cinzel',serif"}}>{s.winner===0?"Victory! 🎉":"Defeated 🤖"}</div>
            <div style={{fontSize:13,color:"#4a6a8a",marginBottom:20}}>{s.winner===0?"Well played.":"The computer wins this round."}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{startCPUGame();setScoreResults(null);}} className="btn-primary" style={{flex:2}}>PLAY AGAIN</button>
              <button onClick={()=>{setScreen("lobby");setCpuGame(null);setScoreResults(null);}} className="btn-secondary" style={{flex:1}}>LOBBY</button>
            </div>
          </div>}
        </div>
      </div>
      {scoreResults&&<ScoreModal results={scoreResults} yourIndex={0} onClose={()=>setScoreResults(null)}/>}
      {showCustom&&<CustomScoring rules={localRules} setRules={setLocalRules} onSave={()=>setShowCustom(false)} onClose={()=>setShowCustom(false)} isHost={true}/>}
      {toast&&<div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#0a1628,#0d1f35)",border:"1px solid #2a4a6a",borderRadius:10,padding:"10px 22px",color:"#8abcf0",fontSize:13,whiteSpace:"nowrap",zIndex:200}}>{toast}</div>}
    </>;
  }

  // ── Multiplayer Game ──────────────────────────────────────────────────────
  if(!gameState)return null;
  const g=gameState;
  const isDealer=g.dealer===yourIndex;
  const isMyPegTurn=g.pegTurn===yourIndex;
  const winScore=localRules.winScore??121;
  const myHand=g.yourHand||[];
  const phase=g.phase;
  const canPeg=c=>g.pegTotal+(RANK_VALUES[c.rank]||0)<=31;
  const hasPlayable=myHand.some(canPeg);

  return<>
    <GlobalStyle/>
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 10% 0%,#0d1f3a 0%,#080e1a 50%)",color:"#e8dfc8",fontFamily:"'Inter',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 12px 48px"}}>
      <div style={{width:"100%",maxWidth:500,display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:"#f0c040",fontFamily:"'Cinzel',serif",letterSpacing:3}}>♣ CRIBBAGE</div>
          <div style={{fontSize:10,color:"#3a6a8a",letterSpacing:1,marginTop:2}}>
            {isDealer?"YOU ARE DEALER":"OPPONENT IS DEALER"}
            <span style={{color:"#1e3a5a",margin:"0 6px"}}>|</span>
            <span style={{fontFamily:"monospace",color:"#4a7aaa",letterSpacing:2}}>{roomCode}</span>
          </div>
        </div>
        <button onClick={()=>setShowCustom(true)} style={{padding:"8px 14px",background:"linear-gradient(135deg,#1a2a40,#0d1a2e)",border:"1px solid #2a4a6a",borderRadius:10,color:"#6a9acc",cursor:"pointer",fontSize:12,fontFamily:"'Cinzel',serif",letterSpacing:1}}>RULES</button>
      </div>
      <div style={{width:"100%",maxWidth:500,marginBottom:14}}><Board scores={g.scores} winScore={winScore} yourIndex={yourIndex}/></div>
      <div style={{width:"100%",maxWidth:500,marginBottom:12}}>
        <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>OPPONENT · {g.opponentCardCount} CARDS {g.opponentDiscarded?<span style={{color:"#4af0a0"}}>✓</span>:""}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {g.opponentHand?g.opponentHand.map((c,i)=><Card key={i} card={c} small/>):Array.from({length:g.opponentCardCount}).map((_,i)=><Card key={i} card={{}} faceDown small/>)}
        </div>
      </div>
      <div style={{width:"100%",maxWidth:500,display:"flex",gap:14,marginBottom:12,alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>STARTER</div>
          {g.starter?<Card card={g.starter}/>:<div style={{width:72,height:108,borderRadius:10,border:"1.5px dashed #1e3a5e",display:"flex",alignItems:"center",justifyContent:"center",color:"#1e3a5e",fontSize:24}}>?</div>}
        </div>
        {phase==="pegging"&&<div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>
            PLAYED <span style={{color:g.pegTotal>31?"#f06a6a":"#f0c040",marginLeft:8,fontSize:16,fontWeight:700}}>{g.pegTotal}</span>
            {isMyPegTurn?<span style={{color:"#4af0a0",marginLeft:10,fontSize:10}}>YOUR TURN</span>:<span style={{color:"#f0c040",marginLeft:10,fontSize:10}}>OPPONENT'S TURN</span>}
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{(g.pegPile||[]).map((c,i)=><Card key={i} card={c} small/>)}</div>
          <div style={{maxHeight:80,overflowY:"auto"}}>{(g.pegLog||[]).map((l,i)=><div key={i} style={{fontSize:11,color:"#5a8aaa",lineHeight:1.8}}><span style={{color:"#2a4a6a",marginRight:6}}>›</span>{l}</div>)}</div>
        </div>}
      </div>
      {(g.crib?.length>0||g.savedCrib?.length>0)&&<div style={{width:"100%",maxWidth:500,marginBottom:12}}>
        <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>CRIB · {isDealer?"YOURS":"OPPONENT'S"} · {(g.crib||[]).length} CARDS</div>
        <div style={{display:"flex",gap:4}}>{(g.savedCrib||g.crib||[]).map((c,i)=><Card key={i} card={c} faceDown={!g.savedCrib} small/>)}</div>
      </div>}
      <div style={{width:"100%",maxWidth:500,marginBottom:16}}>
        <div style={{fontSize:10,color:"#3a5a7a",marginBottom:6,letterSpacing:2,fontFamily:"'Cinzel',serif"}}>
          YOUR HAND {phase==="discard"&&<span style={{color:"#f0c040",marginLeft:8}}>SELECT 2 FOR CRIB ({selectedCards.size}/2)</span>}
          {g.discarded&&phase==="discard"&&<span style={{color:"#4af0a0",marginLeft:8}}>✓ WAITING...</span>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {myHand.map(c=>{
            const sel=selectedCards.has(c.id);
            const peg=phase==="pegging";
            const notPlay=peg&&!canPeg(c);
            return<Card key={c.id} card={c} selected={sel}
              disabled={notPlay||(peg&&!isMyPegTurn)||(phase==="discard"&&g.discarded)}
              onClick={phase==="discard"&&!g.discarded?()=>toggleSelect(c.id):phase==="pegging"&&isMyPegTurn&&canPeg(c)?()=>sendPeg(c.id):undefined}/>;
          })}
        </div>
      </div>
      <div style={{width:"100%",maxWidth:500}}>
        {phase==="discard"&&!g.discarded&&<button onClick={sendDiscard} disabled={selectedCards.size!==2} className="btn-primary">SEND {selectedCards.size}/2 CARDS TO CRIB</button>}
        {phase==="cut"&&<button onClick={sendCut} style={{width:"100%",padding:"14px 20px",background:"linear-gradient(135deg,#4a2a0a,#2a1608)",border:"1px solid #8a5a2a",borderRadius:12,color:"#f0d0a0",fontFamily:"'Cinzel',serif",fontSize:14,letterSpacing:2,cursor:"pointer"}}>CUT THE DECK</button>}
        {phase==="pegging"&&isMyPegTurn&&<div style={{display:"flex",gap:10,alignItems:"center"}}><div style={{flex:1,fontSize:13,color:"#5a8aaa"}}>{hasPlayable?"Tap a card to play":"No playable cards"}</div><button onClick={sendGo} className="btn-danger">SAY GO</button></div>}
        {(phase==="show"||phase==="crib")&&yourIndex===0&&<button onClick={sendScoreShow} className="btn-purple">SCORE HANDS</button>}
        {(phase==="show"||phase==="crib")&&yourIndex!==0&&<div style={{textAlign:"center",color:"#3a6a8a",fontSize:13,padding:16,fontFamily:"'Cinzel',serif",letterSpacing:1}}>WAITING FOR HOST TO SCORE...</div>}
        {phase==="gameover"&&<div style={{textAlign:"center",animation:"fadeIn 0.5s ease"}}>
          <div style={{fontSize:36,fontWeight:700,color:"#f0c040",marginBottom:8,fontFamily:"'Cinzel',serif"}}>{g.winner===yourIndex?"Victory! 🎉":"Defeated 🤝"}</div>
          <div style={{fontSize:13,color:"#4a6a8a",marginBottom:20}}>{g.winner===yourIndex?"Well played.":"Better luck next time."}</div>
          <button onClick={()=>{setScreen("lobby");setGameState(null);setRoomCode(null);ws.current?.close();}} className="btn-primary">BACK TO LOBBY</button>
        </div>}
      </div>
    </div>
    {scoreResults&&<ScoreModal results={scoreResults} yourIndex={yourIndex} onClose={()=>setScoreResults(null)}/>}
    {showCustom&&<CustomScoring rules={localRules} setRules={setLocalRules} onSave={saveRules} onClose={()=>setShowCustom(false)} isHost={yourIndex===0}/>}
    {toast&&<div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#0a1628,#0d1f35)",border:"1px solid #2a4a6a",borderRadius:10,padding:"10px 22px",color:"#8abcf0",fontSize:13,whiteSpace:"nowrap",zIndex:200}}>{toast}</div>}
  </>;
}
