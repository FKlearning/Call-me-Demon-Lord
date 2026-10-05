/* D15-B: presentation observes resolved combat; it never writes simulation state. */
(function(root){
  'use strict';
  const C={ink:'#201d32',coal:'#713747',red:'#c6573e',fire:'#f49b45',gold:'#ffd47b',hot:'#fff1c2',purple:'#9b74cf',dark:'#4f3c75',pale:'#efdcff',blue:'#70babd',ice:'#d7efe1',wood:'#b78b57'};
  const worlds=new WeakMap(),installed=new WeakSet(),masks=new WeakMap(),petMotion=new WeakMap();
  let art;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),snap=v=>Math.round(v/3)*3;
  const hash=n=>{n=Math.imul(n^n>>>16,0x45d9f3b);return((n^n>>>16)>>>0)/4294967296;};
  function state(g){let s=worlds.get(g);const t=g.totalTime||0;if(!s||t<s.time){s={time:t,hits:new Map(),bursts:[],fallen:new WeakMap(),sounds:[],previousGuard:null};worlds.set(g,s);}s.time=t;return s;}
  function prune(g){const s=state(g),t=g.totalTime||0;for(const[e,h]of s.hits)if(t-h.at>.3)s.hits.delete(e);s.bursts=s.bursts.filter(b=>t-b.at<b.life);return s;}
  function classify(kind){return /roar|echo|judg|phantom|fear/.test(kind)?'fear':/fire|burn|beam|field|ignition|explosion|flame/.test(kind)?'fire':'force';}
  function sound(s,kind,t){if(!s.sounds.some(x=>x.kind===kind&&t-x.at<.08))s.sounds.push({kind,at:t});if(s.sounds.length>18)s.sounds.shift();}
  function addBurst(s,b){s.bursts.push(b);if(s.bursts.length>128)s.bursts.splice(0,s.bursts.length-128);}
  function hit(g,e,amount,kind,source){
    const s=prune(g),t=g.totalTime||0,group=classify(kind),heavy=amount>=24||/dash|judg|plunge|beam|explosion|ignition/.test(kind),old=s.hits.get(e);
    if(old&&t-old.at<.085){old.amount+=amount;old.heavy||=heavy;return;}
    const angle=Math.atan2(e.y-(source?.y??g.player.y),e.x-(source?.x??g.player.x));
    const h={at:t,x:e.x,y:e.y-36,angle,group,heavy,amount};s.hits.set(e,h);
    if(s.hits.size>160)s.hits.delete(s.hits.keys().next().value);
    addBurst(s,{...h,kind:'contact',life:heavy?.3:.18});sound(s,group+'-hit',t);
  }
  function installGame(Klass){
    const p=Klass.prototype;if(installed.has(p))return;installed.add(p);
    const damage=p.damageEnemy,solid=p.damageSolid,player=p.playerDamage;
    p.damageEnemy=function(e,amount,kind,source,...rest){
      const before=e?.hp,down=this.downed?.length||0,result=damage.call(this,e,amount,kind,source,...rest);
      if(before>0&&e.hp<before){hit(this,e,before-e.hp,kind||'hit',source);if((this.downed?.length||0)>down){
        const body=this.downed[this.downed.length-1],a=state(this).hits.get(e);
        state(this).fallen.set(body,{at:this.totalTime||0,angle:a?.angle||0,kind:e.name==='黑潮'?'tide':e.storyActor==='execution-guard'?'guard':e.type==='militia'?'militia':'villager',variant:typeof e.id==='number'?Math.abs(e.id)%4:0});
      }}return result;
    };
    p.damageSolid=function(b,...args){const hp=b?.hp,result=solid.call(this,b,...args);if(hp>0&&b.hp<=0){const s=state(this);addBurst(s,{kind:'wood',x:b.x+(b.w||0)/2,y:b.y+(b.h||0)/2,at:this.totalTime||0,life:.55});sound(s,'wood',this.totalTime||0);}return result;};
    p.playerDamage=function(...args){const hp=this.player.hp,result=player.apply(this,args);if(this.player.hp<hp)hit(this,this.player,hp-this.player.hp,'force',this.hero||this.player);return result;};
    for(const name of['tickPlayer','shout','breakHeroDevices']){const fn=p[name];if(typeof fn!=='function')continue;p[name]=function(...args){const hero=this.hero,ward=hero?.ward,anchor=hero?.anchor,guard=hero?.guard,result=fn.apply(this,args),s=state(this);
      for(const [before,after]of[[ward,hero?.ward],[anchor,hero?.anchor]])if(before&&!after&&!s.bursts.some(b=>b.kind==='shield'&&b.at===(this.totalTime||0)&&b.x===before.x&&b.y===before.y)){addBurst(s,{kind:'shield',x:before.x,y:before.y,at:this.totalTime||0,life:.5});sound(s,'shield',this.totalTime||0);}
      if(guard>0&&hero.guard<=0&&!this.effects.some(f=>f.kind==='shield-crack'&&f.life===f.maxLife)){addBurst(s,{kind:'shield',x:hero.x,y:hero.y-24,at:this.totalTime||0,life:.4});sound(s,'shield',this.totalTime||0);}return result;};}
  }
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(snap(x),snap(y),Math.max(3,snap(w)),Math.max(3,snap(h)));}
  function line(c,a,b,color,width=3){const dx=b.x-a.x,dy=b.y-a.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3));for(let i=0;i<=n;i++)rect(c,a.x+dx*i/n-width/2,a.y+dy*i/n-width/2,width,width,color);}
  function poly(c,points,color){ // Scanline fill preserves the world's three-pixel grid at every angle.
    let lo=Math.min(...points.map(p=>p.y)),hi=Math.max(...points.map(p=>p.y));c.fillStyle=color;
    for(let y=Math.floor(lo/3)*3;y<=hi;y+=3){const xs=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if((a.y>y)!==(b.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)c.fillRect(snap(xs[i]),y,Math.max(3,snap(xs[i+1]-xs[i])),3);}
  }
  function ring(c,x,y,r,color,width=3,segments=32,phase=0,dashed=false){for(let i=0;i<segments;i++){if(dashed&&i%3===2)continue;const a=i/segments*Math.PI*2+phase,b=(i+1)/segments*Math.PI*2+phase;line(c,{x:x+Math.cos(a)*r,y:y+Math.sin(a)*r},{x:x+Math.cos(b)*r,y:y+Math.sin(b)*r},color,width);}}
  function ray(c,x,y,a,len,width,color,t=0){const points=[],dx=Math.cos(a),dy=Math.sin(a);for(let side of[-1,1])for(let k=0;k<=14;k++){const i=side===-1?k:14-k,u=i/14,w=width*(.2+.8*Math.sin(Math.PI*u*.87))*(u>.78?(1-u)/.22:1)*(1+.19*Math.sin(i*2+t*16));points.push({x:x+dx*len*u-dy*w*side,y:y+dy*len*u+dx*w*side});}poly(c,points,color);}
  function star(c,x,y,r,col,phase=0){for(let i=0;i<4;i++){const a=phase+i*Math.PI/2;poly(c,[{x,y},{x:x+Math.cos(a-.25)*r*.3,y:y+Math.sin(a-.25)*r*.3},{x:x+Math.cos(a)*r,y:y+Math.sin(a)*r},{x:x+Math.cos(a+.25)*r*.3,y:y+Math.sin(a+.25)*r*.3}],col);}}
  function crown(c,x,y,size,col){poly(c,[{x:x-size,y},{x:x-size,y:y-size*.65},{x:x-size*.45,y:y-size*.3},{x,y:y-size},{x:x+size*.45,y:y-size*.3},{x:x+size,y:y-size*.65},{x:x+size,y}],col);rect(c,x-size,y+3,size*2,3,C.pale);}
  function spark(c,x,y,u,group,seed=1,count=9){const col=group==='fear'?C.purple:group==='force'?C.blue:C.fire,light=group==='fear'?C.pale:group==='force'?C.ice:C.hot;
    for(let i=0;i<count;i++){const a=hash(seed+i*99)*Math.PI*2,d=(12+hash(i+seed*11)*34)*u;line(c,{x:x+Math.cos(a)*d*.6,y:y+Math.sin(a)*d*.6+u*u*12},{x:x+Math.cos(a)*d,y:y+Math.sin(a)*d+u*u*12},i%3?col:light,i%2?3:6);}if(u<.32)star(c,x,y,27*(1-u),light,.2);
  }
  function fireCone(c,p,s,t){
    const m=art.mouthPosition(p),end={x:p.x+Math.cos(p.angle)*s.range,y:p.y+Math.sin(p.angle)*s.range},a=Math.atan2(end.y-m.y,end.x-m.x),length=Math.hypot(end.x-m.x,end.y-m.y);
    c.save();c.globalAlpha=.23;for(const side of[-1,1])line(c,{x:p.x+Math.cos(p.angle+side*s.width)*24,y:p.y+Math.sin(p.angle+side*s.width)*24},{x:p.x+Math.cos(p.angle+side*s.width)*s.range,y:p.y+Math.sin(p.angle+side*s.width)*s.range},C.red,3);c.globalAlpha=.9;
    const width=Math.min(40,Math.sin(s.width)*s.range*.56);ray(c,m.x,m.y,a,length,width+6,C.coal,t);ray(c,m.x,m.y,a,length*.98,width,C.red,t+.1);ray(c,m.x,m.y,a,length*.94,width*.73,C.fire,t+.25);ray(c,m.x,m.y,a,length*.78,width*.37,C.gold,t+.4);ray(c,m.x,m.y,a,length*.5,5,C.hot,t);
    for(let i=0;i<10;i++){const u=(i/10+t*1.6)%1,spread=Math.sin(i*2.3+t*9)*width*u,x=m.x+(end.x-m.x)*u-Math.sin(a)*spread,y=m.y+(end.y-m.y)*u+Math.cos(a)*spread;line(c,{x,y},{x:x-Math.cos(a)*12,y:y-Math.sin(a)*12},i%3?C.gold:C.hot,3);}
    star(c,m.x,m.y,10+Math.sin(t*25)*3,C.hot,p.angle);c.restore();
  }
  function breath(c,g){const s=state(g),p=g.player,t=g.totalTime||0;
    if(p.fireActive&&g.path!=='field'){s.breath={p:{x:p.x,y:p.y,angle:p.angle},stats:g.flameStats(),at:t};fireCone(c,p,s.breath.stats,t);}
    else if(s.breath&&t-s.breath.at<.12){c.save();c.globalAlpha=.65*(1-(t-s.breath.at)/.12);fireCone(c,s.breath.p,s.breath.stats,t);c.restore();}
  }
  const stamps=new Map(),outlines=new Map();
  function fieldOutline(radius){const r=Math.max(3,snap(radius));if(outlines.has(r))return outlines.get(r);const s=art.pixels(r*2+12,r*2+12,c=>ring(c,r+6,r+6,r,C.red,3,32,0,true));outlines.set(r,s);if(outlines.size>32)outlines.delete(outlines.keys().next().value);return s;}
  function plume(frame){if(stamps.has(frame))return stamps.get(frame);const s=art.pixels(48,60,c=>{for(let layer=0;layer<4;layer++){const col=[C.coal,C.red,C.fire,C.gold][layer],w=18-layer*4,h=38-layer*6;const pts=[{x:24-w,y:57},{x:24-w,y:40},{x:20-w/2,y:32},{x:24-w/2,y:15+frame%3*3},{x:29,y:25},{x:32,y:4+frame*3},{x:38,y:24},{x:28+w,y:36},{x:24+w,y:57}];poly(c,pts,col);}rect(c,22,39,6,18,C.hot);});stamps.set(frame,s);return s;}
  function field(c,f,t){if(f.state==='seed'){
    const phase=Math.floor(t*8+f.x/13)%4;ring(c,f.x,f.y,12,C.coal,3,12);rect(c,f.x-6,f.y-6,12,9,C.red);rect(c,f.x-3,f.y-6,6,6,C.gold);rect(c,f.x-3,f.y-9-phase*3,3,3,C.hot);line(c,{x:f.x-15,y:f.y+6},{x:f.x+15,y:f.y+6},C.coal,3);return;
    }c.save();c.globalAlpha=Math.min(1,f.life);c.drawImage(plume(Math.abs(Math.floor(t*10+f.x))%4),snap(f.x-24),snap(f.y-54));c.restore();
  }
  function fields(c,list,t){const bucket=new Map(),boundaries=new Set();c.save();for(const f of list){const seed=f.state==='seed',key=seed+':'+Math.floor(f.x/30)+':'+Math.floor(f.y/30),b=bucket.get(key);if(!b)bucket.set(key,{f,count:1});else b.count++;
      if(!seed){const edge=snap(f.x)+':'+snap(f.y)+':'+snap(f.r);if(!boundaries.has(edge)){boundaries.add(edge);c.globalAlpha=.28*Math.min(1,f.life);const edgeImage=fieldOutline(f.r);c.drawImage(edgeImage,snap(f.x-edgeImage.width/2),snap(f.y-edgeImage.height/2));}}}
    c.globalAlpha=1;for(const {f,count}of bucket.values()){field(c,f,t);if(f.state==='seed'&&count>1){rect(c,f.x+9,f.y-27,30,15,C.ink);c.fillStyle=C.gold;c.font='11px sans-serif';c.textAlign='center';c.fillText('×'+count,snap(f.x+24),snap(f.y-15));}else if(f.state!=='seed'){c.globalAlpha=.75*Math.min(1,f.life);for(let i=0;i<3;i++){const a=i*2.4;c.drawImage(plume((Math.floor(t*10)+i)%4),snap(f.x+Math.cos(a)*f.r*.55-18),snap(f.y+Math.sin(a)*f.r*.55-39),36,45);}c.globalAlpha=1;}}c.restore();return{sources:list.length,plumes:bucket.size,boundaries:boundaries.size};}
  function fieldLink(c,a,b,t){const burning=a.state==='burning'&&b.state==='burning';c.save();c.globalAlpha=burning?.4:.65;const length=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(length/12));if(burning)line(c,a,b,C.coal,12);for(let i=0;i<n;i++){const u=(i/n+t*(burning?.45:.12))%1;rect(c,a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,burning?6:3,3,burning?C.fire:C.red);}c.restore();}
  function effect(c,f,g){
    const u=clamp(1-f.life/f.maxLife,0,1),t=g.totalTime||0,r=f.radius||30,a=f.angle||0,x=f.x,y=f.y,old=original.effect;
    c.save();c.globalAlpha=Math.min(1,f.life*5)*(1-u*.65);
    switch(f.kind){
      case 'beam':{const m={x:x+Math.cos(a)*15,y:y-45},end={x:x+Math.cos(a)*r,y:y+Math.sin(a)*r},angle=Math.atan2(end.y-m.y,end.x-m.x),len=Math.hypot(end.x-m.x,end.y-m.y);ray(c,m.x,m.y,angle,len,13*(1-u)+3,C.red,t);ray(c,m.x,m.y,angle,len,7*(1-u)+3,C.gold,t);line(c,m,end,C.hot,Math.max(3,9*(1-u)));star(c,m.x,m.y,28*(1-u),C.hot,a);break;}
      case 'chain-link':{c.globalAlpha*=1-u;const points=[{x,y:y-24}];for(let i=1;i<=8;i++)points.push({x:x+Math.cos(a)*r*i/8-Math.sin(a)*(i%2?8:-8),y:y+Math.sin(a)*r*i/8-24+Math.cos(a)*(i%2?8:-8)});for(let i=1;i<points.length;i++){line(c,points[i-1],points[i],C.red,9);line(c,points[i-1],points[i],C.gold,3);}break;}
      case 'roar':case 'echo':{
        const echo=f.kind==='echo',reach=r*Math.min(1,.25+u*5),col=echo?C.pale:C.purple;c.globalAlpha*=.75;ring(c,x,y,reach,col,6,48,echo?.12:0,true);ring(c,x,y,reach*.9,C.dark,3,48,0,true);
        const inner=g.roarStats().inner*(echo?1.25:1)*Math.min(1,.25+u*5);ring(c,x,y,inner,C.pale,3,32,0,true);
        for(let i=0;i<12;i++){const q=i*Math.PI/6;poly(c,[{x:x+Math.cos(q)*reach,y:y+Math.sin(q)*reach},{x:x+Math.cos(q+.07)*(reach-15),y:y+Math.sin(q+.07)*(reach-15)},{x:x+Math.cos(q)*(reach-23),y:y+Math.sin(q)*(reach-23)}],col);}
        if(g.ranks?.SQ01)crown(c,x,y-95-u*18,echo?21:30,col);break;}
      case 'judgement':{
        ring(c,x,y-45,30*(1-u),C.purple,3,12,u*2);if(u<.65){poly(c,[{x:x-12*(1-u),y:y-170},{x:x+12*(1-u),y:y-170},{x:x+6,y:y-18},{x,y:y+3},{x:x-6,y:y-18}],C.purple);line(c,{x,y:y-168},{x,y},C.pale,3);crown(c,x,y-120,24*(1-u),C.pale);}spark(c,x,y-24,u,'fear',7,12);break;}
      case 'voice-mark':sigil(c,{x,y,voiceMarks:1},100-u*10,t,.8*(1-u));break;
      case 'phantom-summon':for(let i=0;i<3;i++){const q=i*2.1;ray(c,x+Math.cos(q)*50,y+Math.sin(q)*30,q+Math.PI,40*(1-u),8,C.dark,t);}break;
      case 'phantom-hit':for(let i=-1;i<=1;i++)line(c,{x:x-20+i*10,y:y-65-u*9},{x:x+14+i*10,y:y-24+u*9},i===0?C.pale:C.purple,3);break;
      case 'dash':case 'return-dash':{
        const returning=f.kind==='return-dash'||g.player.dashReturning;for(let i=-1;i<=1;i++){const offset=i*18,tail=45+u*65;line(c,{x:x-Math.cos(a)*tail-Math.sin(a)*offset,y:y-Math.sin(a)*tail+Math.cos(a)*offset-20},{x:x+Math.cos(a)*12-Math.sin(a)*offset*.3,y:y+Math.sin(a)*12+Math.cos(a)*offset*.3-20},returning?C.pale:i?C.blue:C.ice,3);}break;}
      case 'earth':{
        const len=r*Math.min(1,u*6+.15);for(let i=0;i<12;i++){const q=i/12;if(q*r>len)break;const xx=x+Math.cos(a)*r*q,yy=y+Math.sin(a)*r*q,j=(i%2?1:-1)*10;line(c,{x:xx,y:yy},{x:xx+Math.cos(a)*r/12-Math.sin(a)*j,y:yy+Math.sin(a)*r/12+Math.cos(a)*j},C.ink,12);line(c,{x:xx,y:yy},{x:xx+Math.cos(a)*r/12-Math.sin(a)*j,y:yy+Math.sin(a)*r/12+Math.cos(a)*j},C.blue,3);rect(c,xx-Math.sin(a)*j*2,yy+Math.cos(a)*j*2-Math.sin(u*Math.PI)*18,9,6,C.ice);}break;}
      case 'plunge-tell':ring(c,x,y,r,C.blue,3,40,u*.2,true);star(c,x,y,12+Math.sin(u*Math.PI*3)*6,C.ice,Math.PI/4);break;
      case 'plunge-impact':ring(c,x,y,r*Math.min(1,u*5+.2),C.ice,6,40,0,true);for(let i=0;i<10;i++){const q=i*Math.PI/5,d=r*(.3+.65*u);line(c,{x:x+Math.cos(q)*d*.55,y:y+Math.sin(q)*d*.55},{x:x+Math.cos(q)*d,y:y+Math.sin(q)*d},C.ink,9);rect(c,x+Math.cos(q)*d,y+Math.sin(q)*d-Math.sin(u*Math.PI)*36,9,9,i%2?C.blue:C.ice);}break;
      case 'ignition':case 'explosion':{
        ring(c,x,y,r*Math.min(1,.2+u*5),C.gold,3,32,0,true);const height=(f.kind==='ignition'?132:90)*Math.sin(Math.PI*Math.min(1,u*1.4));poly(c,[{x:x-30,y},{x:x-24,y:y-height*.6},{x:x-12,y:y-height*.5},{x,y:y-height},{x:x+12,y:y-height*.45},{x:x+27,y:y-height*.7},{x:x+33,y}],C.red);poly(c,[{x:x-15,y},{x:x-9,y:y-height*.65},{x,y:y-height*.9},{x:x+15,y}],C.gold);rect(c,x-3,y-height*.52,6,height*.52,C.hot);break;}
      case 'shield-crack':case 'ward-break':case 'ward-debris':fragments(c,{x,y,kind:'shield'},u);break;
      case 'debris':break; // Actual solid destruction is observed once; do not duplicate debris.
      default:c.restore();return old(c,f,g);
    }c.restore();
  }
  const original={};
  function fragments(c,b,u){for(let i=0;i<10;i++){const a=hash(i+71)*Math.PI*2,d=(20+i*3)*u,x=b.x+Math.cos(a)*d,y=b.y-12+Math.sin(a)*d-40*Math.sin(Math.PI*u);const col=b.kind==='wood'?(i%2?C.wood:C.coal):(i%2?C.ice:C.blue);line(c,{x,y},{x:x+Math.cos(a+u*5)*12,y:y+Math.sin(a+u*5)*12},col,i%2?3:6);}}
  function drawEffects(c,g,visible=()=>true){let drawn=0;const cells=new Set();for(let i=g.effects.length-1;i>=0;i--){const f=g.effects[i];if(!visible(f,Math.max(180,f.radius||0)))continue;if(f.kind==='ignition'){const key=Math.floor(f.x/36)+':'+Math.floor(f.y/36);if(cells.has(key))continue;cells.add(key);}if(drawn>=160)break;effect(c,f,g);drawn++;}return drawn;}
  function drawContacts(c,g,visible=()=>true){const s=prune(g);for(const [e,h]of s.hits)if(h.draw&&!e.gone&&e.hp>0&&visible(e,140)&&(g.totalTime||0)-h.at<.11){const d=h.draw;c.save();c.globalAlpha=.65;c.translate(d.x,d.y);c.scale(d.sx,d.sy);c.drawImage(d.outline,-d.w/2-3,-d.h-3,d.w+6,d.h+6);c.restore();}for(const b of s.bursts){if(!visible(b,100))continue;const u=clamp(((g.totalTime||0)-b.at)/b.life,0,1);c.save();c.globalAlpha=1-u;if(b.kind==='contact')spark(c,b.x,b.y,u,b.group,Math.floor(b.x+b.y),b.heavy?12:6);else fragments(c,b,u);c.restore();}}
  function sigil(c,e,height,t,alpha=1){const n=Math.min(3,e.voiceMarks||0);if(!n)return;const x=e.x,y=e.y-height-15;c.save();c.globalAlpha=alpha;rect(c,x-20,y-21,40,32,C.ink);for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/3;const xx=x+Math.cos(a)*13,yy=y-5+Math.sin(a)*13;poly(c,[{x:xx,y:yy-6},{x:xx+5,y:yy},{x:xx,y:yy+6},{x:xx-5,y:yy}],C.pale);}if(n===3){ring(c,x,y-5,20,C.purple,3,12);line(c,{x:x-12,y:y+10},{x:x+12,y:y+10},C.pale,3);}c.restore();}
  function actorSprite(c,s,x,y,w,h,g,e,options={}){
    const hitState=prune(g).hits.get(e._source||e),elapsed=hitState?(g.totalTime||0)-hitState.at:99;let dx=0,dy=0,sx=1,sy=1;
    if(hitState?.heavy&&elapsed<.045){if(!hitState.pose)hitState.pose=s;else s=hitState.pose;}
    if(elapsed<.23){const punch=Math.sin(Math.min(1,elapsed/.055)*Math.PI/2)*Math.max(0,1-elapsed/.23);dx=Math.cos(hitState.angle)*punch*(hitState.heavy?9:4);dy=Math.sin(hitState.angle)*punch*4;sx=1+punch*.045;sy=1-punch*.055;}
    if(options.player&&e.dashTime>0){sx*=1.04;sy*=.95;}if(options.player&&options.state==='roar'){sx*=1.03;sy*=.97;}
    c.save();c.translate(snap(x+w/2+dx),snap(y+h+dy));c.scale(sx,sy);c.imageSmoothingEnabled=false;c.drawImage(s,-w/2,-h,w,h);
    if(elapsed<.11){let m=masks.get(s);if(!m){const fill=art.pixels(s.width,s.height,q=>{q.drawImage(s,0,0);q.globalCompositeOperation='source-in';q.fillStyle=C.hot;q.fillRect(0,0,s.width,s.height);}),outline=art.pixels(s.width+2,s.height+2,q=>{for(const[xx,yy]of[[0,1],[2,1],[1,0],[1,2]])q.drawImage(fill,xx,yy);q.globalCompositeOperation='destination-out';q.drawImage(s,1,1);});m={fill,outline};masks.set(s,m);}c.globalAlpha*=elapsed<.055?.8:.35;c.drawImage(m.fill,-w/2,-h,w,h);hitState.draw={x:snap(x+w/2+dx),y:snap(y+h+dy),sx,sy,w,h,outline:m.outline};}c.restore();
  }
  function pet(c,p,t){const previous=petMotion.get(p),facing=previous&&Math.abs(p.x-previous.x)>.1?Math.sign(p.x-previous.x):previous?.facing||1;petMotion.set(p,{x:p.x,facing});const frame=Math.floor(t*10)%4,bite=p.cooldown>.45,scale=clamp((6-p.life)*6,0,1);
    c.save();c.translate(snap(p.x),snap(p.y));c.scale(scale,scale);poly(c,[{x:-24,y:3},{x:-20,y:-15},{x:-12,y:-33},{x:-6,y:-21},{x:9,y:-24},{x:18,y:-36},{x:24,y:-15},{x:21,y:0},{x:9,y:6},{x:0,y:3},{x:-9,y:9}],C.dark);rect(c,-15,-21,27,15,C.purple);rect(c,-12,-21,6,3,C.pale);rect(c,6,-21,6,3,C.pale);if(bite){poly(c,[{x:-12,y:-9},{x:0,y:-3},{x:12,y:-9},{x:9,y:3},{x:-9,y:3}],C.ink);for(let i=0;i<3;i++)rect(c,-9+i*9,-9,3,6,C.pale);}for(let i=0;i<3;i++)rect(c,-18+i*15,-frame*3+6,6,6,C.dark);line(c,{x:-facing*15,y:0},{x:-facing*(30+frame*6),y:6},C.dark,6);c.restore();}
  function corpse(c,e,g){const d=g&&state(g).fallen.get(e);if(!d)return original.corpse(c,e);const u=clamp(((g.totalTime||0)-d.at)/.23,0,1);c.save();c.globalAlpha=Math.min(1,e.life/2)*.72;c.translate(snap(e.x+Math.cos(d.angle)*u*12),snap(e.y));c.rotate((Math.cos(d.angle)<0?-1:1)*u*Math.PI/2);c.scale(1,1-u*.18);c.drawImage(art.actorSprite(d.kind,Math.cos(d.angle)<0?2:0,0,'kneel',d.variant),-36,-84,72,90);c.restore();}
  function returnAnchor(c,g){const p=g.player,tr=p.returnTrail;if(!tr||tr.life<=0)return;const col=tr.blocked?C.red:C.blue; c.save();c.globalAlpha=.3;c.drawImage(art.actorSprite('demon',art.facingFor(p.angle),0,'idle'),snap(tr.start.x-48),snap(tr.start.y-108),96,120);c.globalAlpha=.65;ring(c,tr.start.x,tr.start.y,24,col,3,16);const dx=p.x-tr.start.x,dy=p.y-tr.start.y;for(let i=0;i<7;i++){const u=(i/7+(g.totalTime||0)*.7)%1;rect(c,tr.start.x+dx*u,tr.start.y+dy*u,3,3,col);}c.restore();}
  function charge(c,g){const p=g.player,flame=g.path==='dragon'&&p.fireActive;if(!(flame||p.roarCharge>0||p.dashCharge>0))return;const m=art.mouthPosition(p),n=flame?clamp(p.breathTime/1.2,0,1):clamp((p.roarCharge||p.dashCharge)/.45,0,1),x=flame?m.x:p.x,y=flame?m.y:p.y-50,col=flame?C.gold:p.roarCharge>0?C.purple:C.blue;
    for(let i=0;i<6;i++){const a=i*Math.PI/3+(g.totalTime||0)*3,r=30*(1-n)+10;line(c,{x:x+Math.cos(a)*r,y:y+Math.sin(a)*r},{x:x+Math.cos(a)*(r+9),y:y+Math.sin(a)*(r+9)},col,3);}star(c,x,y,6+n*9,col,0);}
  function installArt(A){if(art)return;art=A;for(const key of['fireCone','field','fields','pet','corpse','effect']){original[key]=A[key];A[key]=({fireCone,field,fields,pet,corpse,effect})[key];}A.combatStyle='pixel-combat-v3';}
  class SoundBank{
    constructor(){this.context=null;this.last=new Map();this.voices=0;this.buffer=null;this.peak=0;}
    play(context,kind,muted=false){if(muted||!context||context.state!=='running')return false;const time=context.currentTime,gap=kind==='fire-hit'?.22:kind==='fire-loop'?.13:kind.endsWith('hit')?.07:.09;if(time-(this.last.get(kind)??-99)<gap||this.voices>=16)return false;this.last.set(kind,time);if(this.context!==context){this.context=context;this.buffer=context.createBuffer(1,context.sampleRate*.6,context.sampleRate);const data=this.buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=hash(i+472)*2-1;}
      const fear=/fear|roar|echo|judg|shadow/.test(kind),fire=/fire|ignition|explosion|lance/.test(kind),heavy=/ignition|plunge|roar|judg|wood|shield|explosion/.test(kind),duration=kind==='fire-loop'?.15:heavy?.3:.12,volume=kind==='fire-loop'?.023:kind.endsWith('hit')?.033:.065;
      const noise=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();noise.buffer=this.buffer;filter.type='bandpass';filter.frequency.setValueAtTime(fire?1300:fear?450:2200,time);filter.frequency.exponentialRampToValueAtTime(fire?320:120,time+duration);filter.Q.value=.7;gain.gain.setValueAtTime(.001,time);gain.gain.linearRampToValueAtTime(volume,time+.008);gain.gain.exponentialRampToValueAtTime(.001,time+duration);noise.connect(filter);filter.connect(gain);gain.connect(context.destination);noise.start();noise.stop(time+duration);this.voices++;this.peak=Math.max(this.peak,this.voices);noise.onended=()=>{this.voices--;noise.disconnect();filter.disconnect();gain.disconnect();};
      if(heavy||fear){const tone=context.createOscillator(),body=context.createGain();tone.type=fear?'sine':'triangle';tone.frequency.setValueAtTime(fear?155:85,time);tone.frequency.exponentialRampToValueAtTime(fear?50:28,time+duration);body.gain.setValueAtTime(volume*.8,time);body.gain.exponentialRampToValueAtTime(.001,time+duration);tone.connect(body);body.connect(context.destination);tone.start();tone.stop(time+duration);tone.onended=()=>{tone.disconnect();body.disconnect();};}return true;
    }
  }
  const API={installGame,installArt,drawEffects,drawContacts,actorSprite,sigil,returnAnchor,charge,breath,fieldLink,SoundBank,drainSounds(g){const s=state(g),a=s.sounds;s.sounds=[];return a;},stats(g){const s=prune(g);return{hits:s.hits.size,bursts:s.bursts.length,stamps:stamps.size,outlines:outlines.size,sounds:s.sounds.length};}};
  if(typeof module==='object'&&module.exports)module.exports=API;root.DemonCombatFX=API;
})(typeof window==='object'?window:globalThis);
