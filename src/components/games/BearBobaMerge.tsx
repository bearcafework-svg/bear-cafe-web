import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
type BC = typeof BC_DARK;
const BC_DARK = {
  bg:"#12100E", bgTop:"#1C1208", bgBot:"#110D08",
  honey:"#E9A84E", honeyDim:"#C4862A",
  cream:"#F8EBD8", creamDim:"#D4B896",
  brownDark:"#5A3820",
  wall:"#3D2410", wallLight:"#6B3E1E", floor:"#2A1608",
  uiBg:"rgba(233,168,78,0.07)", uiBorder:"rgba(233,168,78,0.18)",
  uiShadow:"0 2px 12px rgba(0,0,0,0.3)",
  textMain:"#F8EBD8", textSub:"#D4B896",
  dark:true,
};
const BC_LIGHT = {
  bg:"#F5E6CC", bgTop:"#FDF3E3", bgBot:"#EDD9B8",
  honey:"#C4862A", honeyDim:"#A06018",
  cream:"#3D2008", creamDim:"#7A4A20",
  brownDark:"#3D2008",
  wall:"#C8A070", wallLight:"#E8C090", floor:"#C09060",
  uiBg:"rgba(196,134,42,0.08)", uiBorder:"rgba(196,134,42,0.25)",
  uiShadow:"0 2px 12px rgba(100,60,10,0.12)",
  textMain:"#3D2008", textSub:"#7A4A20",
  dark:false,
};
// Module-level ref used by drawScene (outside React render)
let _bc: BC = BC_DARK;

// ─── CANVAS CONSTANTS ─────────────────────────────────────────────────────────
const CW = 320, CH = 512, WALL_W = 14, FLOOR_H = 14, DROP_Y = 68;

// ─── PHYSICS ──────────────────────────────────────────────────────────────────
const GRAVITY = 0.46, DAMPING = 0.56, FRICTION = 0.981, SUBSTEPS = 5;
const ASCEND_BONUS = 250, COMBO_WINDOW = 2000;

// ─── ITEMS — bear images ──────────────────────────────────────────────────────
const ITEMS = [
  { id:0, img:"/game1/bearG1.svg", name:"ไข่มุกหมีจิ๋ว",  r:16, score:1,  glow:"rgba(139,94,60,0.6)"  },
  { id:1, img:"/game1/bearG2.svg", name:"แก้วคุมะเล็ก",  r:22, score:3,  glow:"rgba(200,168,122,0.5)" },
  { id:2, img:"/game1/bearG3.svg", name:"ชานมหมีนุ่ม",  r:28, score:7,  glow:"rgba(143,167,122,0.6)" },
  { id:3, img:"/game1/bearG4.svg", name:"แก้วโต๊ะสั่น",  r:35, score:12, glow:"rgba(233,168,78,0.5)"  },
  { id:4, img:"/game1/bearG5.svg", name:"ถังชานมหมี",  r:44, score:22, glow:"rgba(233,168,78,0.7)"  },
  { id:5, img:"/game1/bearG6.svg", name:"หมีทองหน้าร้าน", r:54, score:55, glow:"rgba(233,168,78,0.9)"  },
];

// ─── KUMA MESSAGES ────────────────────────────────────────────────────────────
const KUMA: Record<string, string[]> = {
  idle: [
    "คุมะรับออเดอร์อยู่ วางแก้วเลย!",
    "ไข่มุกเด้ง ๆ พร้อมเสิร์ฟแล้ว",
    "แตะตรงราง แล้วปล่อยให้ร้านวุ่นวาย",
    "รวมแก้วให้ไว ลูกค้ารอหน้าร้านแล้ว",
  ],
  combo: [
    "โอ๊ย รวมกันเฉยเลย 😭",
    "ไข่มุกล้นแล้ววว 🧋",
    "คุมะชงไม่ทันแล้ว!",
    "โต๊ะสั่น แต่คะแนนพุ่ง!",
    "ชานมถล่มร้านแล้วว",
  ],
  danger: [
    "แก้วจะชนป้ายร้านแล้วนะ!",
    "คุมะรับไม่ทันแล้ว ☕",
    "โอเค อันนี้เริ่มน่ากลัว 😂",
    "ขยับนิดนึง ร้านแน่นมาก",
  ],
  ascend: [
    "หมีทองมาแล้ว?!?",
    "แก้วนั่นใหญ่มาก!",
    "ทั้งร้านเงียบไปหนึ่งวิ",
    "หมีทองเด้งกลับมาเสิร์ฟต่อ!",
  ],
  best: [
    "ป้ายสถิติหน้าร้านต้องเขียนใหม่!",
    "ยอดขายวันนี้แตกแตนแล้ว",
    "คุมะจดคะแนนแทบไม่ทัน",
  ],
};
const tip = (k: string) => { const a = KUMA[k] ?? KUMA.idle; return a[Math.floor(Math.random()*a.length)]; };
const rnd3 = () => Math.floor(Math.random()*3);

// ─── BALL ─────────────────────────────────────────────────────────────────────
let UID = 0;
class Ball {
  x:number; y:number; vx:number; vy:number;
  type:number; id:number; age:number; merging:boolean;
  constructor(x:number, y:number, type:number) {
    this.x=x; this.y=y; this.vx=0; this.vy=0;
    this.type=type; this.id=UID++; this.age=0; this.merging=false;
  }
  get r() { return ITEMS[this.type].r; }
}

// ─── PARTICLES ────────────────────────────────────────────────────────────────
interface Particle { id:number; x:number; y:number; emoji:string; size:number; vx:number; vy:number; }

function useParticles() {
  const list = useRef<Particle[]>([]);
  const pid  = useRef(0);
  const [, force] = useState(0);
  const spawn = useCallback((x:number, y:number, emojis:string[], count=8) => {
    const batch: Particle[] = Array.from({length:count}, (_,i) => ({
      id:pid.current++, x, y,
      emoji:emojis[i%emojis.length],
      size:10+Math.random()*10,
      vx:(Math.random()-.5)*90,
      vy:-40-Math.random()*60,
    }));
    list.current = [...list.current, ...batch];
    force(n=>n+1);
    setTimeout(()=>{ list.current=list.current.filter(p=>!batch.some(b=>b.id===p.id)); force(n=>n+1); }, 900);
  }, []);
  return { particles:list.current, spawn };
}

// ─── SOUND ────────────────────────────────────────────────────────────────────
function playPop(freq=520, vol=0.15) {
  try {
    const AC = window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    const ctx=new AC(), osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq*1.35,ctx.currentTime+0.04);
    gain.gain.setValueAtTime(vol,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.18);
    osc.start(); osc.stop(ctx.currentTime+0.2);
    setTimeout(()=>ctx.close(),300);
  } catch {
    // AudioContext can be blocked until user interaction or unavailable in tests.
  }
}
function playAscend() { [440,554,659,880].forEach((f,i)=>setTimeout(()=>playPop(f,0.1),i*80)); }

// ─── CANVAS DRAW ─────────────────────────────────────────────────────────────
function drawScene(
  canvas: HTMLCanvasElement,
  balls: Ball[],
  curX: number|null,
  nextType: number,
  dangerLevel: number,
  imgs: (HTMLImageElement|null)[],
) {
  const bc = _bc;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const innerW=W-WALL_W*2, innerH=H-DROP_Y-FLOOR_H;

  // Background
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,bc.bgTop); bg.addColorStop(0.5,bc.bg); bg.addColorStop(1,bc.bgBot);
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Soft cafe wall details: shelves and order rail, kept subtle so the board stays readable
  ctx.fillStyle=bc.dark?"rgba(248,235,216,0.035)":"rgba(61,32,8,0.045)";
  ctx.fillRect(WALL_W+18,DROP_Y+44,innerW-36,2);
  ctx.fillRect(WALL_W+34,DROP_Y+84,innerW-68,2);
  ctx.fillStyle=bc.dark?"rgba(233,168,78,0.05)":"rgba(196,134,42,0.08)";
  for (let gx=WALL_W+28;gx<W-WALL_W-20;gx+=48) {
    ctx.beginPath(); ctx.roundRect(gx,DROP_Y+28,18,12,4); ctx.fill();
  }

  // Top counter light
  const tg=ctx.createLinearGradient(0,DROP_Y,0,DROP_Y+74);
  tg.addColorStop(0,"rgba(233,168,78,0.08)"); tg.addColorStop(1,"rgba(233,168,78,0)");
  ctx.fillStyle=tg; ctx.fillRect(WALL_W,DROP_Y,innerW,74);

  // Danger tint — warm honey-amber, stays on-palette
  if (dangerLevel>0) { ctx.fillStyle=`${bc.honeyDim}${Math.round(dangerLevel*0.12*255).toString(16).padStart(2,"0")}`; ctx.fillRect(WALL_W,DROP_Y,innerW,innerH+FLOOR_H); }

  // Drop guide + ghost
  if (curX!==null) {
    const item=ITEMS[nextType];
    const gx=Math.max(WALL_W+item.r+1,Math.min(W-WALL_W-item.r-1,curX));
    ctx.save();
    ctx.strokeStyle=`rgba(233,168,78,${0.18+dangerLevel*0.1})`; ctx.lineWidth=1.5; ctx.setLineDash([4,7]);
    ctx.beginPath(); ctx.moveTo(gx,DROP_Y+2); ctx.lineTo(gx,DROP_Y+28); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha=0.2;
    ctx.beginPath(); ctx.arc(gx,DROP_Y-item.r*0.5,item.r,0,Math.PI*2);
    ctx.fillStyle="rgba(233,168,78,0.3)"; ctx.fill();
    ctx.strokeStyle="rgba(233,168,78,0.5)"; ctx.lineWidth=1.5; ctx.stroke();
    const gi=imgs[nextType];
    if (gi?.complete && gi.naturalWidth>0) {
      ctx.globalAlpha=0.45;
      const d=item.r*1.8;
      ctx.drawImage(gi,gx-d/2,DROP_Y-item.r*0.5-d/2,d,d);
    }
    ctx.restore();
  }

  // Left wall
  { const wg=ctx.createLinearGradient(0,0,WALL_W*2,0);
    wg.addColorStop(0,bc.wall); wg.addColorStop(0.5,bc.wallLight); wg.addColorStop(1,bc.wall);
    ctx.fillStyle=wg; ctx.beginPath();
    ctx.moveTo(0,DROP_Y); ctx.lineTo(WALL_W,DROP_Y); ctx.lineTo(WALL_W,H-FLOOR_H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(233,168,78,0.12)"; ctx.fillRect(WALL_W-2,DROP_Y,2,H-DROP_Y-FLOOR_H); }
  // Right wall
  { const wg=ctx.createLinearGradient(W,0,W-WALL_W*2,0);
    wg.addColorStop(0,bc.wall); wg.addColorStop(0.5,bc.wallLight); wg.addColorStop(1,bc.wall);
    ctx.fillStyle=wg; ctx.beginPath();
    ctx.moveTo(W,DROP_Y); ctx.lineTo(W-WALL_W,DROP_Y); ctx.lineTo(W-WALL_W,H-FLOOR_H); ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(233,168,78,0.12)"; ctx.fillRect(W-WALL_W,DROP_Y,2,H-DROP_Y-FLOOR_H); }
  // Floor
  { const fg=ctx.createLinearGradient(0,H-FLOOR_H*2,0,H);
    fg.addColorStop(0,bc.wallLight); fg.addColorStop(1,bc.floor);
    ctx.fillStyle=fg; ctx.fillRect(0,H-FLOOR_H,W,FLOOR_H);
    ctx.fillStyle="rgba(233,168,78,0.15)"; ctx.fillRect(WALL_W,H-FLOOR_H,innerW,2); }

  // Danger/drop line
  const la=dangerLevel>0?0.55+dangerLevel*0.35:0.2;
  ctx.strokeStyle=dangerLevel>0?`${bc.honeyDim}${Math.round(la*255).toString(16).padStart(2,"0")}`:`rgba(233,168,78,${la})`;
  ctx.lineWidth=1.5; ctx.setLineDash([5,8]);
  ctx.beginPath(); ctx.moveTo(WALL_W,DROP_Y); ctx.lineTo(W-WALL_W,DROP_Y); ctx.stroke(); ctx.setLineDash([]);

  // Balls
  for (const b of balls) {
    const item=ITEMS[b.type]; ctx.save();
    if (b.type>=3) { ctx.shadowColor=item.glow; ctx.shadowBlur=12+b.type*4; }
    else { ctx.shadowColor="rgba(0,0,0,0.4)"; ctx.shadowBlur=5; }
    ctx.shadowOffsetY=2;
    // subtle circle bg
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fillStyle=`${bc.honey}1A`; ctx.fill();
    ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    // image
    const img=imgs[b.type];
    if (img?.complete && img.naturalWidth>0) {
      const d=b.r*2.1;
      ctx.drawImage(img,b.x-d/2,b.y-d/2,d,d);
    } else {
      ctx.fillStyle=`${bc.honey}B3`;
      ctx.font=`bold ${Math.round(b.r*0.9)}px sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(String(b.type+1),b.x,b.y);
    }
    // ring — use cream-tinted honey for lower tiers, honey for higher
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.strokeStyle=b.type>=4?`${bc.honey}80`:`${bc.cream}1F`;
    ctx.lineWidth=1.5; ctx.stroke();
    ctx.restore();
  }
}

// ─── MAIN GAME ────────────────────────────────────────────────────────────────
export default function BearBobaMerge() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  // ── ALL HOOKS FIRST — unconditional, fixed order ──────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const imgsRef    = useRef<(HTMLImageElement|null)[]>(ITEMS.map(()=>null));
  const gs         = useRef({balls:[] as Ball[],gameOver:false,score:0,combo:0,lastMergeAt:0,ascends:0});
  const bestRef    = useRef(0);
  const curXRef    = useRef<number|null>(null);
  const nextRef    = useRef(rnd3());
  const coolRef    = useRef(false);
  const dangerRef  = useRef(0);
  const rafRef     = useRef<number>(0);
  const stepRef    = useRef<()=>void>(()=>{});

  // mounted guard — prevents rendering before useTheme is stable
  const [mounted, setMounted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({w:CW,h:CH});
  const [ui, setUI] = useState({
    score:0,best:0,combo:0,ascends:0,
    next:nextRef.current,kuma:tip("idle"),
    gameOver:false,danger:0,ascFlash:false,
  });

  const {particles,spawn} = useParticles();

  // Mark mounted after first paint — useTheme is stable from here
  useEffect(()=>{ setMounted(true); },[]);

  // Derive palette — safe because we only use it after mounted
  const bc: BC = resolvedTheme === "light" ? BC_LIGHT : BC_DARK;

  // Sync module-level palette ref for drawScene
  useEffect(()=>{ _bc = bc; });

  // Preload images once
  useEffect(()=>{
    ITEMS.forEach((item,i)=>{
      const img=new Image(); img.src=item.img; imgsRef.current[i]=img;
    });
  },[]);

  // Responsive canvas size
  useEffect(()=>{
    const update=()=>{
      const maxW=Math.min(window.innerWidth-16,440);
      const maxH=window.innerHeight-200;
      let w=maxW, h=Math.round(w*(CH/CW));
      if (h>maxH){h=maxH;w=Math.round(h*(CW/CH));}
      setCanvasSize({w:Math.max(w,260),h:Math.max(h,400)});
    };
    update();
    window.addEventListener("resize",update);
    return ()=>window.removeEventListener("resize",update);
  },[]);

  // ── Physics step — defined with useCallback, stored in stepRef ───────────
  const step = useCallback(()=>{
    const g=gs.current; if (g.gameOver) return;
    const balls=g.balls;
    for (let s=0;s<SUBSTEPS;s++) {
      for (const b of balls) {
        if (b.age<10){b.age++;continue;}
        b.vy+=GRAVITY/SUBSTEPS; b.vx*=FRICTION; b.x+=b.vx/SUBSTEPS; b.y+=b.vy/SUBSTEPS;
        if (b.x-b.r<WALL_W)    {b.x=WALL_W+b.r;      b.vx= Math.abs(b.vx)*DAMPING;}
        if (b.x+b.r>CW-WALL_W) {b.x=CW-WALL_W-b.r;   b.vx=-Math.abs(b.vx)*DAMPING;}
        if (b.y+b.r>CH-FLOOR_H){b.y=CH-FLOOR_H-b.r;  b.vy=-Math.abs(b.vy)*DAMPING; b.vx*=0.93;}
        if (b.y-b.r<DROP_Y&&b.vy<0) b.vy*=-0.1;
      }
      for (let i=0;i<balls.length;i++) for (let j=i+1;j<balls.length;j++) {
        const a=balls[i],b=balls[j]; if (a.age<10||b.age<10) continue;
        const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy,md=a.r+b.r;
        if (d2<md*md&&d2>0.0001) {
          const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,ov=(md-d)/2;
          a.x-=nx*ov; a.y-=ny*ov; b.x+=nx*ov; b.y+=ny*ov;
          if (a.x-a.r<WALL_W) a.x=WALL_W+a.r; if (a.x+a.r>CW-WALL_W) a.x=CW-WALL_W-a.r;
          if (b.x-b.r<WALL_W) b.x=WALL_W+b.r; if (b.x+b.r>CW-WALL_W) b.x=CW-WALL_W-b.r;
          const rv=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
          if (rv>0){const imp=rv*DAMPING; a.vx-=imp*nx; a.vy-=imp*ny; b.vx+=imp*nx; b.vy+=imp*ny;}
        }
      }
    }
    const bs=g.balls; let merged=false;
    outer: for (let i=0;i<bs.length;i++) for (let j=i+1;j<bs.length;j++) {
      const a=bs[i],b=bs[j];
      if (a.merging||b.merging||a.type!==b.type) continue;
      if (a.age<6&&b.age<6) continue;
      const dx=b.x-a.x,dy=b.y-a.y;
      if (dx*dx+dy*dy<(a.r+b.r+1)*(a.r+b.r+1)) {
        a.merging=b.merging=true;
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
        g.balls=bs.filter(bb=>bb!==a&&bb!==b);
        if (a.type===ITEMS.length-1) {
          const nb=new Ball(mx,Math.min(my,CH-FLOOR_H-ITEMS[0].r-5),0); nb.vy=-9; nb.age=0; g.balls.push(nb);
          g.score+=ASCEND_BONUS; g.ascends++;
          if (g.score>bestRef.current) bestRef.current=g.score;
          spawn(mx,my,["🧋","🐻","👑","🧋","☕"],18); playAscend();
          setUI(u=>({...u,score:g.score,best:bestRef.current,ascends:g.ascends,kuma:tip("ascend"),ascFlash:true}));
          setTimeout(()=>setUI(u=>({...u,ascFlash:false})),1400);
        } else {
          const nt=a.type+1;
          const nb=new Ball(mx,Math.min(my,CH-FLOOR_H-ITEMS[nt].r-5),nt); nb.vy=-4; nb.age=0; g.balls.push(nb);
          const now=Date.now();
          g.combo=(now-g.lastMergeAt<COMBO_WINDOW)?g.combo+1:1; g.lastMergeAt=now;
          g.score+=ITEMS[nt].score*Math.max(1,g.combo);
          const wasBest = g.score>bestRef.current;
          if (wasBest) bestRef.current=g.score;
          spawn(mx,my,nt>=4?["🧋","🐻","☕","🧋"]:["🧋","•","☕"],nt>=3?12:7);
          playPop(360+nt*80,0.13);
          const uk=g.combo>=2?tip("combo"):wasBest?tip("best"):undefined;
          setUI(u=>({...u,score:g.score,best:bestRef.current,combo:g.combo,...(uk?{kuma:uk}:{})}));
        }
        merged=true; break outer;
      }
    }
    void merged;
    const now=Date.now();
    if (g.combo>0&&now-g.lastMergeAt>COMBO_WINDOW+400){g.combo=0;setUI(u=>({...u,combo:0}));}
    let maxD=0;
    for (const b of g.balls) {
      if (b.age<30) continue;
      const cl=(b.y-b.r)-DROP_Y;
      if (cl<0){g.gameOver=true;setUI(u=>({...u,gameOver:true,score:g.score,best:bestRef.current}));return;}
      if (cl<40) maxD=Math.max(maxD,1-cl/40);
    }
    if (Math.abs(maxD-dangerRef.current)>0.05){
      dangerRef.current=maxD;
      if (maxD>0.5) setUI(u=>({...u,kuma:tip("danger")}));
      setUI(u=>({...u,danger:maxD}));
    }
  },[spawn]);

  // Keep stepRef current without restarting the loop
  useEffect(()=>{ stepRef.current=step; },[step]);

  // ── Game loop — starts once, never restarts ───────────────────────────────
  useEffect(()=>{
    let last=0;
    const loop=(t:number)=>{
      if (t-last>14){
        last=t;
        stepRef.current();
        if (canvasRef.current){
          canvasRef.current.width=CW; canvasRef.current.height=CH;
          drawScene(canvasRef.current,gs.current.balls,curXRef.current,nextRef.current,dangerRef.current,imgsRef.current);
        }
      }
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(rafRef.current);
  },[]);

  // ── Drop ──────────────────────────────────────────────────────────────────
  const drop=useCallback((clientX:number)=>{
    if (gs.current.gameOver||coolRef.current) return;
    const c=canvasRef.current; if (!c) return;
    const rect=c.getBoundingClientRect();
    const nt=nextRef.current,r=ITEMS[nt].r;
    const x=Math.max(WALL_W+r+1,Math.min(CW-WALL_W-r-1,(clientX-rect.left)*(CW/rect.width)));
    gs.current.balls.push(new Ball(x,DROP_Y+r+1,nt));
    playPop(280+nt*40,0.08);
    coolRef.current=true; setTimeout(()=>coolRef.current=false,320);
    const nn=rnd3(); nextRef.current=nn; setUI(u=>({...u,next:nn}));
  },[]);

  // ── Input handlers ────────────────────────────────────────────────────────
  const getX=useCallback((cx:number)=>{
    const c=canvasRef.current; if(!c) return null;
    const r=c.getBoundingClientRect(); return(cx-r.left)*(CW/r.width);
  },[]);
  const onMM=useCallback((e:React.MouseEvent)=>{curXRef.current=getX(e.clientX);},[getX]);
  const onML=useCallback(()=>{curXRef.current=null;},[]);
  const onMC=useCallback((e:React.MouseEvent)=>{drop(e.clientX);},[drop]);
  const onTM=useCallback((e:React.TouchEvent)=>{e.preventDefault();if(e.touches[0])curXRef.current=getX(e.touches[0].clientX);},[getX]);
  const onTS=useCallback((e:React.TouchEvent)=>{
    e.preventDefault();
    const t=e.touches[0]||e.changedTouches[0];
    if(t){curXRef.current=getX(t.clientX);drop(t.clientX);}
  },[getX,drop]);

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart=useCallback(()=>{
    gs.current={balls:[],gameOver:false,score:0,combo:0,lastMergeAt:0,ascends:0};
    dangerRef.current=0;
    const nn=rnd3(); nextRef.current=nn;
    setUI({score:0,best:bestRef.current,combo:0,ascends:0,next:nn,kuma:tip("idle"),gameOver:false,danger:0,ascFlash:false});
  },[]);

  const {score,best,combo,ascends,next:nextId,kuma,gameOver:isOver,danger,ascFlash}=ui;

  // Don't render until theme is resolved — prevents hook count mismatch
  if (!mounted) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width:"100%",minHeight:"100dvh",
      background:`linear-gradient(160deg,${bc.bgTop} 0%,${bc.bg} 50%,${bc.bgBot} 100%)`,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",
      fontFamily:"'Noto Sans Thai','Hiragino Kaku Gothic Pro',system-ui,sans-serif",
      padding:"12px 8px 16px",boxSizing:"border-box",
      userSelect:"none",touchAction:"none",position:"relative",overflow:"hidden",
    }}>
      <GameCSS/>
      <CafeBackdrop bc={bc}/>

      {/* HEADER */}
      <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",maxWidth:canvasSize.w+8,marginBottom:8}}>
        <button onClick={()=>navigate("/")} aria-label="กลับ" style={{
          width:34,height:34,borderRadius:"50%",border:`1.5px solid ${bc.uiBorder}`,
          background:bc.uiBg,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",
          color:bc.textSub,transition:"all .2s",flexShrink:0,boxShadow:bc.uiShadow,
        }}
          onMouseEnter={e=>{e.currentTarget.style.background=bc.dark?"rgba(233,168,78,0.2)":"rgba(196,134,42,0.18)";e.currentTarget.style.color=bc.textMain;}}
          onMouseLeave={e=>{e.currentTarget.style.background=bc.uiBg;e.currentTarget.style.color=bc.textSub;}}
        >←</button>

        <div style={{lineHeight:1.05,textAlign:"left",flex:1,minWidth:0,marginLeft:10}}>
          <div style={{fontSize:16,fontWeight:950,color:bc.textMain,letterSpacing:"-0.03em"}}>Bear Boba Rush</div>
          <div style={{fontSize:10,fontWeight:800,color:bc.honey,letterSpacing:"0.08em",textTransform:"uppercase"}}>ร้านเริ่มวุ่นแล้ว</div>
        </div>

        <div style={{display:"flex",gap:5}}>
          <ScorePill label="ยอด" value={score} bc={bc}/>
          <ScorePill label="ท็อป"  value={best}  bc={bc} gold/>
          <ScorePill label="ทอง"    value={ascends} bc={bc} sm/>
        </div>

        <button onClick={restart} aria-label="เริ่มใหม่" style={{
          width:34,height:34,borderRadius:"50%",border:`1.5px solid ${bc.uiBorder}`,
          background:bc.uiBg,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",
          color:bc.honey,transition:"all .2s",boxShadow:bc.uiShadow,
        }}
          onMouseEnter={e=>{e.currentTarget.style.background=bc.dark?"rgba(233,168,78,0.22)":"rgba(196,134,42,0.2)";e.currentTarget.style.transform="scale(1.1)";}}
          onMouseLeave={e=>{e.currentTarget.style.background=bc.uiBg;e.currentTarget.style.transform="scale(1)";}}
        >↺</button>
      </header>

      {/* COMBO */}
      <div style={{height:24,marginBottom:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {combo>=2&&(
          <div style={{
            padding:"3px 16px",background:`linear-gradient(90deg,${bc.honeyDim},${bc.honey})`,
            borderRadius:20,fontSize:11,fontWeight:800,color:bc.brownDark,letterSpacing:"0.06em",
            boxShadow:`0 2px 12px ${bc.honey}70`,animation:"comboBounce .3s ease-out",
          }}>🧋 คอมโบ ×{combo} — ไข่มุกเด้ง!</div>
        )}
      </div>

      {/* CANVAS */}
      <div ref={wrapRef} style={{
        position:"relative",borderRadius:20,overflow:"hidden",
        width:canvasSize.w,height:canvasSize.h,
        boxShadow:danger>0.4
          ?`0 0 0 2px ${bc.honeyDim}${Math.round(danger*0.5*255).toString(16).padStart(2,"0")},0 8px 32px rgba(0,0,0,${bc.dark?0.6:0.22}),0 0 40px ${bc.honeyDim}${Math.round(danger*0.18*255).toString(16).padStart(2,"0")}`
          :`0 0 0 1.5px ${bc.uiBorder},0 8px 32px rgba(0,0,0,${bc.dark?0.55:0.18})`,
        transition:"box-shadow 0.4s",outline:`1px solid ${bc.uiBorder}`,
        animation:danger>0.65?"boardNudge .18s ease-in-out 2":"none",
      }}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{display:"block",width:canvasSize.w,height:canvasSize.h,cursor:"none",touchAction:"none"}}
          onClick={onMC} onMouseMove={onMM} onMouseLeave={onML} onTouchStart={onTS} onTouchMove={onTM}
        />

        {ascFlash&&(
          <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:18,display:"flex",alignItems:"center",justifyContent:"center",
            background:`radial-gradient(circle,${bc.honey}55 0%,transparent 65%)`}}>
            <span style={{fontSize:72,filter:`drop-shadow(0 0 28px ${bc.honey})`,animation:"ascendBounce .6s ease-out"}}>👑</span>
          </div>
        )}

        <ParticleOverlay particles={particles} canvasRef={canvasRef}/>

        {isOver&&(
          <div style={{position:"absolute",inset:0,zIndex:30,
            background:bc.dark?`${bc.bg}EB`:`${bc.bgTop}EE`,
            backdropFilter:"blur(8px)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
            <div style={{fontSize:52}}>🧋</div>
            <div style={{fontSize:20,fontWeight:900,color:bc.textMain}}>ชานมล้นเคาน์เตอร์!</div>
            <div style={{fontSize:13,color:bc.textSub,textAlign:"center",lineHeight:1.5}}>
              {score>0&&score>=best?"ป้ายสถิติใหม่หน้าร้าน! ":"คุมะขอเช็ดพื้นแป๊บ "}<span style={{color:bc.honey,fontWeight:900}}>{score}</span> แต้ม
            </div>
            {ascends>0&&<div style={{fontSize:12,color:bc.honey}}>หมีทองออกหน้าร้าน {ascends} รอบ</div>}
            <button onClick={restart} style={{
              marginTop:8,padding:"10px 28px",borderRadius:24,border:"none",
              background:`linear-gradient(135deg,${bc.honey},${bc.honeyDim})`,
              color:bc.brownDark,fontSize:14,fontWeight:800,cursor:"pointer",
              boxShadow:`0 4px 16px ${bc.honey}66`,transition:"transform .15s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.06)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}
            >เปิดร้านใหม่</button>
          </div>
        )}
      </div>

      {/* BOTTOM PANEL */}
      <div style={{display:"flex",alignItems:"stretch",gap:8,marginTop:10,width:"100%",maxWidth:canvasSize.w+8}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          background:bc.uiBg,borderRadius:16,padding:"8px 14px",
          border:`1.5px solid ${bc.uiBorder}`,boxShadow:bc.uiShadow,minWidth:72}}>
          <span style={{fontSize:8,color:bc.honey,letterSpacing:"0.08em",fontWeight:900,marginBottom:4}}>ถ้วยต่อไป</span>
          <img src={ITEMS[nextId].img} alt={ITEMS[nextId].name} style={{width:36,height:36,objectFit:"contain"}}/>
          <span style={{fontSize:8,color:bc.textSub,marginTop:3}}>{ITEMS[nextId].name}</span>
        </div>
        <div style={{flex:1,background:bc.uiBg,borderRadius:16,padding:"10px 14px",
          border:`1.5px solid ${bc.uiBorder}`,boxShadow:bc.uiShadow,
          display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22,lineHeight:1,flexShrink:0}}>🧸</span>
          <span style={{fontSize:12,color:bc.textSub,lineHeight:1.55,fontWeight:700}}>{kuma}</span>
        </div>
      </div>

      {/* RECIPE CHAIN */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10,padding:"6px 14px",
        background:bc.uiBg,borderRadius:14,border:`1px solid ${bc.uiBorder}`,
        maxWidth:canvasSize.w+8,flexWrap:"wrap",justifyContent:"center"}}>
        {ITEMS.map((item,i)=>(
          <span key={i} style={{display:"flex",alignItems:"center",gap:3}}>
            <img src={item.img} alt={item.name} title={item.name} style={{width:20,height:20,objectFit:"contain",opacity:0.9}}/>
            <span style={{fontSize:9,color:i===ITEMS.length-1?bc.honey:`${bc.honey}50`,fontWeight:i===ITEMS.length-1?700:400}}>
              {i===ITEMS.length-1?"↩":"→"}
            </span>
          </span>
        ))}
        <span style={{fontSize:9,color:bc.honey,fontWeight:900}}>วนกลับไข่มุก</span>
      </div>
    </div>
  );
}

// ─── ScorePill ────────────────────────────────────────────────────────────────
function ScorePill({label,value,bc,gold,sm}:{label:string;value:number;bc:BC;gold?:boolean;sm?:boolean}) {
  return (
    <div style={{
      display:"flex",flexDirection:"column",alignItems:"center",
      background:gold?`${bc.honey}1E`:bc.uiBg,
      borderRadius:10,padding:sm?"3px 8px":"4px 10px",
      border:`1.5px solid ${gold?bc.honey+"4D":bc.uiBorder}`,
      boxShadow:gold?`0 0 8px ${bc.honey}33`:"none",
      minWidth:sm?30:40,
    }}>
      <span style={{fontSize:7,color:bc.honey,letterSpacing:"0.08em",fontWeight:700,textTransform:"uppercase"}}>{label}</span>
      <span style={{fontSize:sm?11:13,fontWeight:800,color:gold?bc.honey:bc.textMain,lineHeight:1.1}}>{value}</span>
    </div>
  );
}

// ─── CSS keyframes ────────────────────────────────────────────────────────────
function GameCSS() {
  return (
    <style>{`
      @keyframes comboBounce{0%{transform:translateY(8px) scale(.86);opacity:0}55%{transform:translateY(-2px) scale(1.08)}100%{transform:translateY(0) scale(1);opacity:1}}
      @keyframes ascendBounce{0%{transform:scale(.3) rotate(-8deg);opacity:0}55%{transform:scale(1.22) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
      @keyframes boardNudge{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
      @keyframes particleFly{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(var(--px),var(--py)) scale(.2)}}
    `}</style>
  );
}

// ─── Subtle cafe backdrop ─────────────────────────────────────────────────────
function CafeBackdrop({bc}:{bc:BC}) {
  const shelfColor = bc.dark ? "rgba(248,235,216,0.045)" : "rgba(61,32,8,0.07)";
  const cupColor = bc.dark ? "rgba(233,168,78,0.07)" : "rgba(196,134,42,0.09)";
  return (
    <div aria-hidden="true" style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
      <div style={{position:"absolute",left:"7%",right:"7%",top:"14%",height:2,background:shelfColor,borderRadius:999}}/>
      <div style={{position:"absolute",left:"12%",right:"12%",bottom:"13%",height:2,background:shelfColor,borderRadius:999}}/>
      {[14,22,72,80].map((left,i)=>(
        <span key={left} style={{
          position:"absolute",left:`${left}%`,top:i<2?"10%":"82%",
          width:18,height:24,borderRadius:"5px 5px 8px 8px",
          border:`1px solid ${cupColor}`,background:cupColor,
        }}/>
      ))}
    </div>
  );
}

// ─── Particle overlay ─────────────────────────────────────────────────────────
function ParticleOverlay({particles,canvasRef}:{particles:Particle[];canvasRef:React.RefObject<HTMLCanvasElement|null>}) {
  const canvas = canvasRef.current;
  const rect = canvas?.getBoundingClientRect();
  const sx = rect ? rect.width / CW : 1;
  const sy = rect ? rect.height / CH : 1;

  // Single conditional return — after all variable declarations
  if (!particles.length || !canvas) return null;

  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:15}}>
      {particles.map(p=>{
        const angle=Math.atan2(p.vy,p.vx);
        const dist=Math.sqrt(p.vx*p.vx+p.vy*p.vy)*0.75;
        const px=`${Math.round(Math.cos(angle)*dist)}px`;
        const py=`${Math.round(Math.sin(angle)*dist)}px`;
        return (
          <span key={p.id}
            style={{position:"absolute",left:p.x*sx,top:p.y*sy,fontSize:p.size,pointerEvents:"none",animation:"particleFly .85s ease-out forwards"} as React.CSSProperties}
            {...{"--px":px,"--py":py} as Record<string,string>}
          >{p.emoji}</span>
        );
      })}
    </div>
  );
}
