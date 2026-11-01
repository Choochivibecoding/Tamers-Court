// Prototype engine from the first artifact, kept as an independent reference for differential tests.
/* ================= ENGINE ================= */
const W=13,H=10,FILES='abcdefghijk';
const idx=(x,y)=>y*W+x, X=i=>i%W, Y=i=>(i/W)|0;
const CIT={w:idx(12,1),b:idx(0,8)};
const isCit=i=>i===CIT.w||i===CIT.b;
const citOwner=i=>i===CIT.w?'w':'b';
const onBoard=(x,y)=>y>=0&&y<H&&((x>=1&&x<=11)||(x===12&&y===1)||(x===0&&y===8));
const opp=c=>c==='w'?'b':'w';
const ROYAL={k:1,pr:1,ak:1};
const AB={k:'K',pr:'Pr',ak:'AK',g:'G',v:'V',gi:'Gi',t:'Pk',n:'N',r:'R',e:'E',c:'C',w:'W',p:'P'};
const NAME={k:'King',pr:'Prince',ak:'Adventitious King',g:'General',v:'Vizier',gi:'Giraffe',t:'Picket',n:'Knight',r:'Rook',e:'Elephant',c:'Camel',w:'War engine',p:'Pawn'};
const SIDE={w:'White',b:'Black'};
const VAL={p:1,g:1.5,v:1.5,e:1.5,w:2,c:2.5,n:3,t:3.5,gi:4,r:5,pr:4,ak:4,k:6};
const ORTH=[[1,0],[-1,0],[0,1],[0,-1]],DIAG=[[1,1],[1,-1],[-1,1],[-1,-1]],ALL8=ORTH.concat(DIAG);
const LEAP={e:[[2,2],[2,-2],[-2,2],[-2,-2]],w:[[2,0],[-2,0],[0,2],[0,-2]],
  c:[[1,3],[1,-3],[-1,3],[-1,-3],[3,1],[3,-1],[-3,1],[-3,-1]],n:[[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]};

function boardG(b){return{
  valid:onBoard, get:(x,y)=>b[idx(x,y)], isCit:(x,y)=>isCit(idx(x,y)),
  canEnter:(p,x,y)=>{const i=idx(x,y);if(!isCit(i))return true;if(!ROYAL[p.t])return false;return citOwner(i)===p.c?p.t!=='k':true;}
};}

function targets(G,x,y,p){
  const out=[],t=p.t;
  const take=q=>q&&q.c!==p.c&&!q.rest;
  const add=(nx,ny)=>{if(!G.valid(nx,ny)||!G.canEnter(p,nx,ny))return;const q=G.get(nx,ny);if(!q)out.push([nx,ny,0]);else if(take(q))out.push([nx,ny,1]);};
  const slide=(dirs,min)=>{for(const[dx,dy]of dirs){for(let n=1;;n++){const nx=x+dx*n,ny=y+dy*n;if(!G.valid(nx,ny))break;const q=G.get(nx,ny);
    if(n>=min){if(!G.canEnter(p,nx,ny))break;if(!q){out.push([nx,ny,0]);continue;}if(take(q))out.push([nx,ny,1]);break;}else if(q||G.isCit(nx,ny))break;}}};
  switch(t){
    case 'k':case 'pr':case 'ak':for(const[a,b]of ALL8)add(x+a,y+b);break;
    case 'g':for(const[a,b]of DIAG)add(x+a,y+b);break;
    case 'v':for(const[a,b]of ORTH)add(x+a,y+b);break;
    case 'e':case 'w':case 'c':case 'n':for(const[a,b]of LEAP[t])add(x+a,y+b);break;
    case 'r':slide(ORTH,1);break;
    case 't':slide(DIAG,2);break;
    case 'gi':
      for(const[dx,dy]of DIAG){const sx=x+dx,sy=y+dy;if(!G.valid(sx,sy)||G.get(sx,sy)||G.isCit(sx,sy))continue;
        for(const[ox,oy]of[[dx,0],[0,dy]]){for(let n=1;;n++){const nx=sx+ox*n,ny=sy+oy*n;if(!G.valid(nx,ny))break;const q=G.get(nx,ny);
          if(n>=3){if(!G.canEnter(p,nx,ny))break;if(!q){out.push([nx,ny,0]);continue;}if(take(q))out.push([nx,ny,1]);break;}else if(q||G.isCit(nx,ny))break;}}}
      break;
    case 'p':{if(p.rest)break;const d=p.c==='w'?1:-1;
      if(G.valid(x,y+d)&&!G.get(x,y+d)&&G.canEnter(p,x,y+d))out.push([x,y+d,0]);
      for(const dx of[-1,1]){const nx=x+dx,ny=y+d;if(G.valid(nx,ny)&&G.canEnter(p,nx,ny)&&take(G.get(nx,ny)))out.push([nx,ny,1]);}
      break;}
  }
  return out;
}

function royalsOf(b,c){const r=[];for(let i=0;i<b.length;i++){const p=b[i];if(p&&p.c===c&&ROYAL[p.t])r.push(i);}return r;}
function attacked(b,sq,by){
  const G=boardG(b),tx=X(sq),ty=Y(sq);
  for(let i=0;i<b.length;i++){const p=b[i];if(!p||p.c!==by||p.rest)continue;
    for(const t of targets(G,X(i),Y(i),p))if(t[2]&&t[0]===tx&&t[1]===ty)return true;}
  return false;
}
function dropMoves(b,i,p,ms){
  if(p.s===2){const h=idx(6,p.c==='w'?2:7);if(!b[h])ms.push({f:i,t:h,k:'drop'});return;}
  const d=p.c==='w'?1:-1,o=opp(p.c);
  for(let y=0;y<H;y++)for(let x=1;x<=11;x++){const j=idx(x,y);if(b[j])continue;const ny=y+d;if(ny<0||ny>=H)continue;
    let n=0;for(const dx of[-1,1]){if(!onBoard(x+dx,ny))continue;const q=b[idx(x+dx,ny)];if(q&&q.c===o&&!q.rest)n++;}
    if(n>=2)ms.push({f:i,t:j,k:'drop'});}
}
function genMoves(st,c,full){
  const b=st.b,G=boardG(b),ms=[];
  for(let i=0;i<b.length;i++){const p=b[i];if(!p||p.c!==c)continue;
    if(p.t==='p'&&p.rest){dropMoves(b,i,p,ms);continue;}
    for(const[x,y,cap]of targets(G,X(i),Y(i),p))ms.push({f:i,t:idx(x,y),k:'n',cap});}
  if(full&&!st.swap[c]){
    const ki=b.findIndex(p=>p&&p.c===c&&p.t==='k');
    if(ki>=0&&!isCit(ki)&&attacked(b,ki,opp(c)))
      for(let j=0;j<b.length;j++){const q=b[j];if(q&&q.c===c&&j!==ki&&!ROYAL[q.t]&&!q.rest&&!isCit(j))ms.push({f:ki,t:j,k:'swap'});}
  }
  return ms;
}
function apply(st,m){
  const s={b:st.b.slice(),turn:opp(st.turn),swap:{w:st.swap.w,b:st.swap.b},ply:st.ply+1,quiet:st.quiet+1,last:{f:m.f,t:m.t},draw:null,promo:null};
  const b=s.b,p=b[m.f];
  if(m.k==='swap'){const q=b[m.t];b[m.t]=p;b[m.f]=q;s.swap[p.c]=true;s.last={f:m.f,t:m.t};return s;}
  if(m.k==='drop'){b[m.f]=null;b[m.t]=Object.assign({},p,{rest:false});s.quiet=0;return s;}
  if(b[m.t]||p.t==='p')s.quiet=0;
  b[m.f]=null;let np=p,dest=m.t;
  if(p.t==='p'&&Y(m.t)===(p.c==='w'?9:0)){
    if(p.of==='p'){const a=(p.s||0)+1;
      if(a===1)np=Object.assign({},p,{s:1,rest:true});
      else if(a===2){const h=idx(6,p.c==='w'?2:7);if(!b[h]){dest=h;np=Object.assign({},p,{s:2,rest:false});}else np=Object.assign({},p,{s:2,rest:true});}
      else np={t:'ak',c:p.c};
    }else np={t:p.of==='k'?'pr':p.of,c:p.c};
    if(np.t!=='p')s.promo=np.t;
  }
  b[m.t]=null;b[dest]=np;
  if(dest!==m.t)s.last={f:m.f,t:dest};
  if(isCit(dest)&&ROYAL[np.t]&&citOwner(dest)!==np.c)s.draw='citadel';
  return s;
}
function legal(st,c){
  c=c||st.turn;const ms=genMoves(st,c,true);
  if(royalsOf(st.b,c).length!==1)return ms;
  return ms.filter(m=>{const s=apply(st,m);if(s.draw)return true;const r=royalsOf(s.b,c);if(r.length!==1)return true;return !attacked(s.b,r[0],opp(c));});
}
function status(st){
  const c=st.turn,o=opp(c);
  if(st.draw==='citadel')return{over:1,res:'draw',why:'A royal piece entered the enemy citadel.'};
  const R=royalsOf(st.b,c);
  if(!R.length)return{over:1,res:o,why:SIDE[c]+' has no royal pieces left.'};
  const lm=legal(st),chk=R.length===1&&attacked(st.b,R[0],o);
  if(!lm.length)return{over:1,res:o,why:chk?'Checkmate.':'Stalemate. In Tamerlane chess the side left without a move loses.'};
  if(st.quiet>=100)return{over:1,res:'draw',why:'100 half-moves without a capture or pawn move.'};
  if(st.b.every(p=>!p||ROYAL[p.t]))return{over:1,res:'draw',why:'Only royal pieces remain.'};
  const threatened=R.filter(i=>attacked(st.b,i,o));
  return{over:0,check:chk,threatened,moves:lm};
}
const BACK=['e',null,'c',null,'w',null,'w',null,'c',null,'e'];
const MID=['r','n','t','gi','g','k','v','gi','t','n','r'];
const PAWNS=['p','w','c','e','g','k','v','gi','t','n','r'];
function initial(){
  const b=Array(W*H).fill(null);
  for(let f=0;f<11;f++){const x=f+1;
    if(BACK[f]){b[idx(x,0)]={t:BACK[f],c:'w'};b[idx(x,9)]={t:BACK[f],c:'b'};}
    b[idx(x,1)]={t:MID[f],c:'w'};b[idx(x,8)]={t:MID[f],c:'b'};
    b[idx(x,2)]={t:'p',of:PAWNS[f],c:'w',s:0};b[idx(x,7)]={t:'p',of:PAWNS[f],c:'b',s:0};}
  return{b,turn:'w',swap:{w:false,b:false},ply:0,quiet:0,last:null,draw:null,promo:null};
}


export { W, H, idx, X, Y, CIT, onBoard, initial, legal, apply, status, attacked, royalsOf };
