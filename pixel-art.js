/* D14 · shared pixel characters, quiet breathing and one geographical village. */
(function(){
  'use strict';
  const P=Object.freeze({ink:'#151421',deep:'#202238',night:'#292f50',sky:'#363e68',stone:'#626478',edge:'#91909b',pale:'#c0b5a5',gold:'#bf8d4f',light:'#ebc583',flame:'#ef7d42',hot:'#ffd27b',ember:'#913f43',violet:'#ac6bef',violetDark:'#533675',cyan:'#8bc8c6',green:'#43594f',greenLight:'#718572',plum:'#713e60',plumLight:'#995477',skin:'#d79b70',skinShade:'#ad6c53',hair:'#302a38'});
  const CHARACTERS=Object.freeze({
    demon:Object.freeze({name:'修钟人',skin:P.skin,hair:P.hair,cloth:P.plum,shade:'#442d46',light:P.plumLight,headY:13,height:102}),
    lian:Object.freeze({name:'黎安',skin:'#d5ad85',hair:'#b5aa87',cloth:'#496658',shade:'#30463f',light:'#74907a',headY:16,height:84,braidSide:'right',clasp:P.gold}),
    hero:Object.freeze({name:'勇者',skin:'#d6ab83',hair:'#8b704f',cloth:P.gold,shade:'#705b43',light:P.light,headY:8,height:114}),
    militia:Object.freeze({name:'民兵',skin:'#d1a880',hair:'#65544c',cloth:'#64778c',shade:'#39465d',light:'#94a2a7',headY:17,height:81}),
    guard:Object.freeze({name:'钟楼守卫',skin:'#c49b79',hair:'#716148',cloth:'#8b7553',shade:'#51463f',light:'#c2a36d',headY:17,height:81}),
    villager:Object.freeze({name:'村民',skin:'#d0a17d',hair:'#695044',cloth:'#607b75',shade:'#384a4c',light:'#8eaa91',headY:18,height:75}),
    tide:Object.freeze({name:'黑潮',skin:'#716088',hair:'#322a44',cloth:'#524068',shade:'#26223a',light:'#88669b',headY:16,height:84})
  });
  const sprites=new Map(),portraits=new Map(),props=new Map(),motion=new Map();
  let trackedGame=null,trackedTime=-1,cleanupAt=0,cover=null;
  const STANCES=new Set(['idle','stand','breathe','breathe-bound','breathe-kneel','walk','fire','lance','ignition','seed-placed','roar','judgment','dash','return-dash','plunge','player-hit','attack','kneel','bound','dragged']);
  function rect(c,x,y,w,h,col){if(w<=0||h<=0)return;c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function pixels(w,h,draw){const s=document.createElement('canvas');s.width=w;s.height=h;const c=s.getContext('2d');c.imageSmoothingEnabled=false;draw(c);return s;}
  function blit(c,s,x,y,w=s.width,h=s.height){c.imageSmoothingEnabled=false;c.drawImage(s,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function ring(c,x,y,r,col,size=3){const grid=Math.max(2,Math.round(size)),steps=Math.max(12,Math.ceil(2*Math.PI*r/(grid*2)));for(let i=0;i<steps;i++){const a=i*Math.PI*2/steps;rect(c,Math.round((x+Math.cos(a)*r)/grid)*grid,Math.round((y+Math.sin(a)*r)/grid)*grid,grid,grid,col);}}
  function stroke(c,a,b,col,size=3){const grid=Math.max(2,Math.round(size)),len=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(len/grid));for(let i=0;i<=n;i++)rect(c,Math.round((a.x+(b.x-a.x)*i/n)/grid)*grid-grid/2,Math.round((a.y+(b.y-a.y)*i/n)/grid)*grid-grid/2,grid,grid,col);}
  function box(c,x,y,w,h,fill,edge=P.ink){rect(c,x,y,w,h,edge);rect(c,x+1,y+1,w-2,h-2,fill);}
  function label(c,s,x,y,color=P.pale){c.fillStyle=color;c.textAlign='center';c.font='12px "Microsoft YaHei",sans-serif';c.fillText(s,Math.round(x),Math.round(y));}

  // Every portrait calls this same sprite renderer. 32 × 40 is the shared canvas;
  // the figures occupy 25–38 cells in height and use a fixed 3-world-unit cell.
  function actorSprite(kind,dir=1,frame=0,state='idle',variant=0){
    kind=CHARACTERS[kind]?kind:'villager';dir=((Math.round(dir)%4)+4)%4;if(dir===3)dir=1;frame=((Math.floor(frame)%4)+4)%4;variant=((Math.floor(Number(variant)||0)%4)+4)%4;state=STANCES.has(state)?state:'idle';
    const key=[kind,dir,frame,state,variant].join(':');if(sprites.has(key))return sprites.get(key);
    const s=pixels(32,40,c=>{
      const def=CHARACTERS[kind],demon=kind==='demon',lian=kind==='lian',hero=kind==='hero',soldier=kind==='militia'||kind==='guard',tide=kind==='tide';
      const side=dir===0||dir===2,walking=state==='walk',step=walking?[0,1,0,-1][frame]:0;
      const breathing=state.startsWith('breathe'),breath=breathing?frame%3:0;
      const fire=['fire','lance','ignition'].includes(state),roar=['roar','judgment'].includes(state),dash=['dash','return-dash'].includes(state),plunge=state==='plunge',hurt=state==='player-hit',kneel=['kneel','dragged','breathe-kneel'].includes(state),bound=state==='bound'||state==='breathe-bound';
      const phase=frame,inhale=fire&&phase===0,exhale=fire&&phase!==0&&phase!==3,release=roar&&phase>0&&phase<3;
      const crouch=kneel?3:dash?(phase===0?4:2):plunge?3:inhale?1:0;
      const shift=dash?(side?3:0):exhale?(side?2:0):inhale?(side?-1:0):hurt?-2:0,bob=walking&&frame%2?-1:0;
      // Never mirror Lian's asymmetric braid: its physical right side remains her right side.
      if(dir===2&&!lian){c.translate(32,0);c.scale(-1,1);}
      if(state==='dragged'){c.translate(2,10);c.scale(.9,.75);}
      c.translate(shift,bob);
      let cloth=def.cloth,shade=def.shade,light=def.light,skin=def.skin,hair=def.hair;
      if(kind==='villager'){cloth=['#607b75','#92714e','#7d5b77','#6a7188'][variant];shade=['#384a4c','#5b4438','#483a53','#414759'][variant];light=['#8eaa91','#bc9763','#ae8397','#9b9faf'][variant];hair=['#695044','#a78c63','#413641','#bab19a'][variant];skin=['#d0a17d','#bc875f','#dbb38f','#9e745d'][variant];}
      const hy=def.headY+crouch-(release?2:0)-(breath===1?1:0),ty=hy+9,bodyBottom=kneel?36:35,bodyHeight=Math.max(3,bodyBottom-ty),headW=hero?13:12;
      // Long white cloak and heavy shoulders distinguish the hero before any icon or name.
      if(hero){rect(c,6,ty-1,20,18,P.ink);rect(c,7,ty,18,17,'#d6d0ba');rect(c,7,ty+10,4,7,'#9d9da0');rect(c,21,ty+4,4,13,'#ece1bf');rect(c,5,33+step,8,4,'#b4b7b1');rect(c,21,33-step,8,4,'#ddd9c0');}
      else if(demon||lian||tide){rect(c,7,ty+1,18,bodyHeight+2,shade);rect(c,dash?3:6,ty+6,4,Math.max(3,bodyHeight-2),cloth);rect(c,22,ty+4,4,Math.max(4,bodyHeight-1),shade);rect(c,9,bodyBottom,13,3,shade);}
      if(breathing&&breath){const swing=breath===1?1:-1;rect(c,6+swing,bodyBottom-3,3,3,cloth);rect(c,23+swing,bodyBottom-2,3,3,shade);}
      // Feet change separation and length; the dash has a tucked rear leg and extended leading leg.
      if(dash&&phase>0&&phase<3){rect(c,8,35,8,3,P.ink);rect(c,18,35,10,3,P.ink);rect(c,24,36,5,3,'#4d414b');}
      else{rect(c,10,bodyBottom+1,5,4+Math.min(0,step),P.ink);rect(c,18,bodyBottom+1,5,4-Math.max(0,step),P.ink);rect(c,9,38+Math.min(0,step),7,2,'#4d414b');rect(c,18,38-Math.max(0,step),7,2,'#4d414b');}
      box(c,9,ty,15,bodyHeight+1,cloth);rect(c,11,ty+1,3,Math.max(2,bodyHeight-2),light);rect(c,21,ty+1,2,Math.max(2,bodyHeight-1),shade);
      if(demon||hero||soldier){rect(c,9,bodyBottom-2,15,2,'#795539');rect(c,16,bodyBottom-3,3,3,P.gold);rect(c,17,bodyBottom-2,1,1,P.ink);}
      if(lian){rect(c,10,ty,13,3,shade);rect(c,15,ty+2,3,3,P.gold);rect(c,16,ty+2,1,1,P.light);rect(c,12,bodyBottom-4,8,4,'#c4b28e');}
      // Arms are distinct poses, not the standing pose translated across the screen.
      const ay=ty+2;
      if(roar){if(release){const lift=phase===1?4:2;box(c,1,ay-lift,8,4,cloth);box(c,24,ay-lift,7,4,cloth);rect(c,0,ay-lift-1,4,4,skin);rect(c,28,ay-lift-1,4,4,skin);rect(c,3,ay-lift-4,3,4,skin);rect(c,27,ay-lift-4,3,4,skin);}else if(phase===3){box(c,5,ay+2,5,6,cloth);box(c,24,ay+2,5,6,cloth);rect(c,6,ay+7,4,3,skin);rect(c,24,ay+7,4,3,skin);}else{box(c,8,ay+2,6,5,cloth);box(c,20,ay+2,5,5,cloth);rect(c,12,ay+1,4,4,skin);rect(c,18,ay+1,4,4,skin);}}
      else if(plunge){box(c,7,ay-5,5,8,cloth);box(c,22,ay-5,5,8,cloth);rect(c,7,ay-8,5,4,skin);rect(c,22,ay-8,5,4,skin);}
      else if(dash){box(c,6,ay+3,6,4,cloth);rect(c,5,ay+5,4,3,skin);box(c,22,ay,6,5,cloth);rect(c,26,ay,3,4,skin);}
      else if(fire){const recovery=phase===3;box(c,6,ay+1+(inhale?1:0),5,7,cloth);rect(c,7,ay+6,4,3,skin);box(c,23,ay+(recovery?2:0),5,recovery?7:5,cloth);rect(c,recovery?24:25,ay+(recovery?7:2),4,3,skin);if(inhale)rect(c,15,ty+2,7,3,light);}
      else if(state==='seed-placed'){box(c,6,ay+1,5,6,cloth);rect(c,7,ay+5,4,3,skin);box(c,23,ay+4,5,5,cloth);rect(c,25,ay+7,4,3,skin);rect(c,26,ay+9,2,2,P.flame);}
      else{const settle=breath===2?1:0;box(c,6,ay+step+settle,5,7,cloth);rect(c,7,ay+5+step+settle,4,3,skin);box(c,23,ay-step,5,7,cloth);rect(c,24,ay+5-step,4,3,skin);}
      if(hero){box(c,5,ty-1,7,5,P.gold);rect(c,6,ty,5,1,P.light);box(c,22,ty-1,7,5,P.gold);rect(c,23,ty,5,1,P.light);rect(c,15,ty+3,5,5,P.light);rect(c,17,ty+4,1,3,'#f4dfaa');}
      if(soldier){box(c,5,ay+4,5,8,shade);rect(c,6,ay+5,3,2,light);rect(c,27,ay-4,2,12,'#c5cbc4');rect(c,25,ay+8,6,1,P.gold);rect(c,27,ay+9,2,3,'#5d483a');}
      // Large simple head with two dark point eyes. No detailed facial portrait variant exists.
      rect(c,9,hy,headW+2,10,P.ink);rect(c,10,hy+1,headW,8,skin);rect(c,11,hy+8,headW-2,2,def.skin===P.skin?P.skinShade:'#a9795e');rect(c,8,hy+4,2,3,skin);rect(c,23,hy+4,2,3,skin);
      if(demon){rect(c,8,hy-3,17,5,hair);rect(c,10,hy-5,7,3,hair);rect(c,17,hy-4,5,2,hair);rect(c,8,hy,3,5,hair);rect(c,21,hy,4,3,hair);rect(c,14,hy-1,4,4,hair);rect(c,18,hy,3,2,hair);rect(c,9,hy-5,3,4,'#e8cf9e');rect(c,10,hy-7,2,3,'#f2ddb2');rect(c,22,hy-5,3,4,'#d5b987');rect(c,23,hy-7,2,3,'#f2ddb2');}
      else if(lian){rect(c,8,hy-3,17,5,hair);rect(c,10,hy-4,11,2,'#d4c49c');rect(c,8,hy+1,3,7,'#918d74');rect(c,11,hy-1,8,3,hair);rect(c,23,hy+1,3,7,hair);const bx=23;for(let i=0;i<4;i++)rect(c,bx+(i%2),hy+7+i*2,3,3,i%2?'#a59977':'#cfba8e');rect(c,bx+1,hy+15,3,2,P.gold);}
      else if(hero){rect(c,9,hy-2,15,4,hair);rect(c,10,hy-3,10,2,'#b99564');rect(c,8,hy+1,3,5,hair);rect(c,22,hy+1,3,3,hair);rect(c,10,hy+1,6,2,hair);rect(c,18,hy,3,3,hair);rect(c,10,hy+8,2,1,'#b77b60');}
      else if(soldier){rect(c,8,hy-3,17,6,shade);rect(c,10,hy-4,13,3,light);rect(c,9,hy-1,15,2,cloth);rect(c,7,hy+2,19,2,kind==='guard'?P.gold:'#b0b3a7');rect(c,8,hy+4,3,4,shade);rect(c,23,hy+4,2,4,shade);}
      else if(tide){rect(c,8,hy-3,17,7,hair);rect(c,7,hy+1,4,10,shade);rect(c,23,hy+1,3,10,shade);rect(c,11,hy-5,3,4,cloth);rect(c,21,hy-4,3,4,cloth);}
      else{rect(c,9,hy-2,15,4,hair);rect(c,8,hy,3,5,hair);rect(c,22,hy,3,4,hair);if(variant===1){rect(c,7,hy-2,20,2,P.gold);rect(c,11,hy-5,12,3,'#a98a59');}if(variant===2)rect(c,23,hy+3,3,10,hair);if(variant===3){rect(c,11,hy+8,11,2,hair);rect(c,12,hy+10,9,2,hair);}}
      // A shallow turn keeps both eyes visible; Lian's braid is never mirrored.
      const eye=tide?'#dcc0ff':P.ink,faceShift=side?(lian&&dir===2?-1:1):0;
      rect(c,12+faceShift,hy+5,2,3,eye);rect(c,(side?19:20)+faceShift,hy+5,2,3,eye);
      if(roar&&release)rect(c,15+faceShift,hy+8,5,3,P.ink);
      else if(exhale){const mx=side?(lian&&dir===2?12:19):16;rect(c,mx,hy+8,3,2,P.ink);rect(c,mx,hy+8,2,1,P.hot);}
      else if(hurt){rect(c,11+faceShift,hy+5,3,1,P.ink);rect(c,20+faceShift,hy+5,3,1,P.ink);}
      if(bound){rect(c,5,ty+5,24,2,'#b99567');rect(c,13,ty+3,2,6,'#876344');rect(c,21,ty+4,2,4,'#876344');}
      // The hero has a broken greatsword, never the militia's tiny shield-and-helmet kit.
      if(hero){const sx=26,sy=state==='attack'?4:17;rect(c,sx-1,sy+2,5,16,P.ink);rect(c,sx,sy,3,17,'#d0d6cd');rect(c,sx,sy+1,1,15,'#f0e6c9');rect(c,sx+1,sy,2,3,P.ink);rect(c,sx-3,sy+17,9,2,P.gold);rect(c,sx,sy+19,2,4,'#775239');}
      // Breathing shoulders may raise a shield; its edge never shifts the planted boots.
      if(breathing){rect(c,9,38,7,2,'#4d414b');rect(c,18,38,7,2,'#4d414b');}
    });
    sprites.set(key,s);return s;
  }
  // Near-vertical motion retains the last horizontal facing rather than flickering.
  function facingFor(angle,previous=0){const horizontal=Math.cos(Number(angle)||0);return horizontal>.18?0:horizontal<-.18?2:previous===2?2:0;}
  function variantFor(e){const id=e.id??0;if(typeof id==='number')return Math.abs(id)%4;let n=0;for(const ch of String(id))n=(n*31+ch.charCodeAt(0))>>>0;return n%4;}
  function idleFrame(e,time){let seed=0;for(const ch of String(e.id??e.storyActor??'player'))seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;seed=Math.imul(seed^(seed>>>16),0x45d9f3b)>>>0;seed=(seed^(seed>>>16))>>>0;const cycle=e.state==='wounded'||e.pose==='kneel'?2.2:1.6;return Math.floor((((time+(seed%1600)/1000)%cycle)+cycle)%cycle/cycle*3);}
  function kindFor(e,g){const src=e._source||e;return src===g.player?'demon':src===g.hero?'hero':e.storyActor==='lian'?'lian':e.name==='黑潮'?'tide':e.storyActor==='execution-guard'||e.storyActor==='original-courier'&&g.campaignStory?.flags?.doorHelped?'guard':e.type==='militia'?'militia':'villager';}
  function actorHeight(e,g){return CHARACTERS[kindFor(e,g)].height;}
  function actor(c,e,g,o={}){
    const src=e._source||e,kind=kindFor(e,g),isPlayer=src===g.player,t=g.totalTime||0;
    if(trackedGame!==g||t<trackedTime){motion.clear();trackedGame=g;cleanupAt=0;}trackedTime=t;
    if(t>=cleanupAt){for(const[id,m]of motion)if(t-m.seen>2)motion.delete(id);cleanupAt=t+2;}
    const id=isPlayer?'player':e.id??kind,old=motion.get(id),movingNow=old&&Math.hypot(old.x-e.x,old.y-e.y)>.1,until=movingNow?t+.1:old?.until||0;
    const a=isPlayer?e.angle:movingNow?Math.atan2(e.y-old.y,e.x-old.x):e.angle??e.aim??old?.angle??Math.PI/2,dir=facingFor(a,old?.facing);
    const fireStart=e.fireActive?(old?.fireOn?old.fireStart:t):0,fireEnd=!e.fireActive&&old?.fireOn?t:old?.fireEnd??-1;
    motion.set(id,{x:e.x,y:e.y,until,angle:a,facing:dir,seen:t,fireOn:!!e.fireActive,fireStart,fireEnd});
    let state=o.scene?(e.pose||'idle'):until>t?'walk':'idle';const action=e.visualAction,elapsed=action?t-action.at:99,active=action&&elapsed>=0&&elapsed<action.duration;
    if(isPlayer&&!o.scene){if(e.fireActive)state='fire';else if(e.plunge)state='plunge';else if(e.dashTime>0)state=e.dashReturning?'return-dash':'dash';else if(e.roarCharge>0)state='judgment';else if(e.dashCharge>0)state='plunge';else if(active)state=action.type;}
    if(!isPlayer&&!o.scene&&(e.state==='windup'||e.attackTimer>0))state='attack';
    if(isPlayer&&!o.scene&&!e.fireActive&&t-fireEnd<.14&&!['dash','return-dash','roar','judgment','plunge','player-hit'].includes(state))state='fire';
    let frame=state==='walk'?Math.floor(t*8)%4:state==='fire'?(e.fireActive?(t-fireStart<.1?0:1+Math.floor(t*10)%2):3):active?Math.min(3,Math.floor(elapsed/action.duration*4)):0;
    if(state==='dash'||state==='return-dash')frame=e.dashTime>.2?0:1+Math.floor((t*12)%2);
    if(state==='judgment'&&e.roarCharge>0)frame=0;
    if(['idle','stand','bound','kneel'].includes(state)){frame=idleFrame(e,t);state=state==='bound'?'breathe-bound':state==='kneel'?'breathe-kneel':'breathe';}
    const x=Math.round(e.x/3)*3-48,y=Math.round((e.y+12)/3)*3-120-(e.plunge?Math.round(Math.sin(Math.PI*e.plunge.progress)*18)*3:0);
    rect(c,e.x-18,e.y+6,36,6,'#12142580');rect(c,e.x-12,e.y+3,24,12,'#12142560');
    c.save();const alpha=isPlayer&&e.invuln>0&&Math.floor(t*16)%2?.65:1;
    if(isPlayer&&e.dashTime>0)for(let i=3;i>0;i--){c.globalAlpha=.1*i;blit(c,actorSprite(kind,dir,frame,state),x-Math.round(Math.cos(e.dashAngle)*i*5)*3,y-Math.round(Math.sin(e.dashAngle)*i*5)*3,96,120);}
    c.globalAlpha=alpha;const body=actorSprite(kind,dir,frame,state,variantFor(e));if(window.DemonCombatFX&&!o.scene)window.DemonCombatFX.actorSprite(c,body,x,y,96,120,g,e,{player:isPlayer,state});else blit(c,body,x,y,96,120);c.restore();
    if(isPlayer&&!o.scene){if(g.path==='dragon'){rect(c,e.x-9,e.y-96,18,3,P.flame);rect(c,e.x-3,e.y-102,6,6,P.hot);}if(g.path==='field')for(let i=0;i<3;i++)rect(c,e.x-15+i*15,e.y+9,3,3,P.flame);
      if(g.path==='chain'){rect(c,e.x-27,e.y-30,3,12,P.gold);rect(c,e.x-30,e.y-24,9,3,P.flame);}if(g.ranks.SQ01||g.ranks.SQ03)for(let i=0;i<3;i++)rect(c,e.x-12+i*12,e.y-99-(i%2)*6,3,6,P.violet);if(g.ranks.SQ02)ring(c,e.x,e.y-25,30,P.violet,3);
      if(g.ranks.MQ01||g.ranks.MQ03){rect(c,e.x-27,e.y-30,3,9,P.cyan);rect(c,e.x+24,e.y-30,3,9,P.cyan);}if(g.ranks.MQ02)ring(c,e.x,e.y+6,27,P.cyan,3);}
  }
  function portrait(kind,options={}){kind=CHARACTERS[kind]?kind:'villager';const half=!!options.halfBody,key=kind+(half?':half':':face');if(portraits.has(key))return portraits.get(key);const d=CHARACTERS[kind],s=pixels(80,96,c=>{
      rect(c,0,0,80,96,P.deep);rect(c,4,4,72,88,P.night);rect(c,8,8,64,80,kind==='lian'?'#35453f':kind==='hero'?'#4c433c':'#423347');
      rect(c,12,70,56,18,P.deep);rect(c,8,82,64,10,P.ink);const sprite=actorSprite(kind,1,0,'idle');
      const sy=half?Math.max(0,d.headY-8):Math.max(0,d.headY-7),sh=half?32:25;c.drawImage(sprite,3,sy,26,sh,1,half?0:4,78,half?96:75);
      rect(c,4,4,72,2,P.gold);rect(c,4,90,72,2,P.gold);rect(c,4,4,2,88,P.gold);rect(c,74,4,2,88,P.gold);for(const[x,y]of[[2,2],[72,2],[2,88],[72,88]])rect(c,x,y,6,6,P.light);
    });portraits.set(key,s);return s;}
  const portraitURLs=new Map();
  function portraitURL(kind,options={}){const key=(CHARACTERS[kind]?kind:'villager')+(options.halfBody?':half':':face');if(!portraitURLs.has(key))portraitURLs.set(key,portrait(kind,options).toDataURL('image/png'));return portraitURLs.get(key);}

  function ground(c,w,h,bell,posts,layout){
    if(layout?.roads&&layout?.locations){villageGround(c,w,h,layout);return;}
    let seed=73391;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    rect(c,0,0,w,h,'#343849');for(let y=0;y<h;y+=24)for(let x=0;x<w;x+=24){const n=random();if(n<.26)rect(c,x,y,24,24,n<.12?'#303344':'#3a4050');if(n>.9){rect(c,x+6,y+12,6,3,'#59685d');rect(c,x+12,y+9,3,6,'#59685d');}}
    // Roads are quiet broad shapes, so targets, field seeds and courier markers stand out.
    for(const p of posts){stroke(c,bell,p,'#292c3b',78);stroke(c,bell,p,'#575565',60);stroke(c,bell,p,'#686372',12);}
    rect(c,654,708,804,486,'#4c4d5d');for(let y=720;y<1180;y+=36)for(let x=666;x<1450;x+=48){const shift=Math.floor(y/36)%2?24:0;rect(c,x+shift,y,42,30,'#65616b');rect(c,x+shift,y,42,3,'#78717a');rect(c,x+shift+42,y+3,3,27,'#393d51');}
    for(let i=0;i<250;i++){const x=Math.floor(random()*w/6)*6,y=Math.floor(random()*h/6)*6;rect(c,x,y,6,3,'#727060');}
    for(let x=72;x<w-54;x+=36)for(const y of [162,198,234,1218,1254]){rect(c,x,y,3,15,'#8a7859');rect(c,x-3,y+3,9,3,'#b29663');rect(c,x-3,y+9,6,3,'#8a7859');}
    for(const[x,y]of[[54,402],[162,828],[1854,978],[1788,312],[540,90],[1500,90],[1662,1224],[540,1272]])tree(c,x,y);
    for(let x=0;x<w;x+=24){const depth=24+(Math.floor(x/24)%4)*12;rect(c,x,0,24,depth,P.deep);rect(c,x+6,depth-6,12,6,'#4c3a67');if(x%72===0)rect(c,x+6,depth,6,12,'#8052a3');}
    rect(c,0,0,w,6,P.ink);rect(c,0,h-6,w,6,P.ink);rect(c,0,0,6,h,P.ink);rect(c,w-6,0,6,h,P.ink);
  }
  function house(c,b,p){
    if(b.interior){interiorHouse(c,b);return;}
    if(b.open){infirmary(c,b,p);return;}
    const x=Math.round(b.x/3)*3,y=Math.round(b.y/3)*3,w=Math.round(b.w/3)*3,h=Math.round(b.h/3)*3,occluded=p&&p.x>x-20&&p.x<x+w+20&&p.y>y&&p.y<y+h;
    c.save();if(occluded)c.globalAlpha=.38;
    rect(c,x+6,y+12,w,h,P.ink);rect(c,x,y+h*.3,w,h*.7,P.stone);rect(c,x+6,y+h*.32,9,h*.63,'#85818b');rect(c,x+w-12,y+h*.32,12,h*.68,'#44485d');
    for(let row=0;row<3;row++)for(let col=0;col<Math.floor(w/33);col++){const xx=x+12+col*33+(row%2)*12,yy=y+h*.53+row*18;if(xx+15<x+w-12&&yy<y+h-9)rect(c,xx,yy,15,3,'#77727d');}
    const rh=Math.ceil(h*.43/6)*6;for(let ry=0;ry<rh;ry+=6){const inset=Math.floor(w*.48*(1-ry/rh)/6)*6;rect(c,x+inset-9,y+ry-12,w-inset*2+18,6,ry<rh*.4?'#936778':ry<rh*.75?'#714a62':'#523a50');}
    rect(c,x-9,y+rh-12,w+18,6,P.ink);rect(c,x-6,y+rh-12,w+12,3,'#a1747b');
    const dx=x+Math.round(w*.45/3)*3,dy=y+Math.round(h*.62/3)*3;rect(c,dx-3,dy-3,27,h-(dy-y)+3,P.ink);rect(c,dx,dy,21,h-(dy-y),'#705044');rect(c,dx+3,dy+3,3,h-(dy-y)-6,'#977253');rect(c,dx+15,dy+15,3,3,P.gold);
    for(const k of [.16,.72]){const wx=x+Math.round(w*k/3)*3,wy=y+Math.round(h*.58/3)*3;rect(c,wx-3,wy-3,24,27,P.ink);rect(c,wx,wy,18,21,P.gold);rect(c,wx+3,wy+3,6,15,P.hot);rect(c,wx+9,wy,3,21,'#705044');rect(c,wx,wy+9,18,3,'#705044');}
    rect(c,x+w*.75,y-3,15,30,'#575769');rect(c,x+w*.75-3,y-6,21,6,'#89828a');
    if(b.role==='post'){rect(c,x+w-51,y+h-54,27,24,P.deep);rect(c,x+w-48,y+h-51,21,15,P.pale);stroke(c,{x:x+w-48,y:y+h-51},{x:x+w-38,y:y+h-42},P.gold,3);stroke(c,{x:x+w-27,y:y+h-51},{x:x+w-38,y:y+h-42},P.gold,3);}
    c.restore();label(c,b.name||'',x+w/2,y+h+21);
  }
  function paving(c,b,color='#666170',brick=48){
    rect(c,b.x,b.y,b.w,b.h,'#444555');
    for(let y=b.y+3,row=0;y<b.y+b.h-3;y+=30,row++)for(let x=b.x+3+(row%2)*24;x<b.x+b.w-3;x+=brick){const bw=Math.min(brick-6,b.x+b.w-3-x),bh=Math.min(24,b.y+b.h-3-y);if(bw>0&&bh>0){rect(c,x,y,bw,bh,color);rect(c,x,y,bw,3,'#79737b');}}
  }
  function villageGround(c,w,h,map){
    let seed=8417;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    rect(c,0,0,w,h,'#343f40');
    for(let y=0;y<h;y+=24)for(let x=0;x<w;x+=24){const n=random();if(n<.3)rect(c,x,y,24,24,n<.15?'#30383d':'#394749');if(n>.85){rect(c,x+6,y+12,6,3,'#59665b');rect(c,x+12,y+9,3,6,'#59665b');}}
    for(const f of map.fields||[]){rect(c,f.x-6,f.y-6,f.w+12,f.h+12,'#4a423b');rect(c,f.x,f.y,f.w,f.h,'#5a4c3f');for(let y=f.y+12;y<f.y+f.h-12;y+=30){rect(c,f.x+6,y+12,f.w-12,6,'#403c35');for(let x=f.x+12;x<f.x+f.w-12;x+=21){const ripe=(Math.floor(x/21)+Math.floor(y/30))%3;rect(c,x,y,3,15,ripe?'#998555':'#768050');rect(c,x-3,y+3,9,3,ripe?'#bc9b61':'#9ca664');rect(c,x-3,y+9,6,3,'#8e8054');}}}
    for(const road of map.roads){rect(c,road.x-6,road.y-6,road.w+12,road.h+12,'#292d3b');paving(c,road,road.id==='main-street'?'#706775':'#635f6d');}
    // Courtyards join the real building entrances; no scenery invents another door.
    for(const b of map.buildings||[]){const entry=Object.values(map.locations).find(p=>p.bounds&&p.bounds.x===b.x&&p.bounds.y===b.y)?.entry;const bottom=b.y+b.h;rect(c,b.x-12,bottom,b.w+24,24,'#58535d');if(entry&&entry.y>bottom)rect(c,entry.x-51,bottom,102,entry.y-bottom+12,'#635e69');}
    const bell=map.locations.bell;const plaza={x:bell.x-342,y:bell.y-190,w:684,h:690};paving(c,plaza,'#68616d');
    // A single old ward network appears here; the seven new wards belong to the ending.
    for(const id of ['supply-west','supply-east']){const endpoint=map.locations[id];if(endpoint){stroke(c,{x:bell.x,y:bell.y+12},endpoint,'#4f4b59',12);stroke(c,{x:bell.x,y:bell.y+12},endpoint,'#97734e',3);}}
    const market=map.locations.market?.bounds;if(market){rect(c,market.x,market.y,market.w,market.h,'#665b55');for(let i=0;i<45;i++)rect(c,market.x+12+i*37%(market.w-24),market.y+12+i*71%(market.h-24),9,3,'#938270');}
    for(const d of map.decorations||[])if(d.kind==='river')landmark(c,d,0);
    // Orchard silhouettes stay by the borders, beyond houses and marked roads.
    for(const[x,y]of[[330,240],[90,470],[350,490],[2760,190],[2928,450],[2960,1030],[2990,1480],[95,1500],[256,1450],[2760,1950],[445,1880],[1135,1800],[1200,1900]])tree(c,x,y);
    for(const gate of [map.locations['north-gate'],map.locations['south-gate']]){if(!gate)continue;rect(c,gate.x-114,gate.y-12,48,24,'#3f4458');rect(c,gate.x+66,gate.y-12,48,24,'#3f4458');for(const side of [-1,1]){rect(c,gate.x+side*99-12,gate.y-57,24,51,P.stone);rect(c,gate.x+side*99-15,gate.y-60,30,9,'#96909a');}}
    for(let x=12;x<w-12;x+=36){if(Math.abs(x-map.locations['north-gate'].x)<90)continue;rect(c,x,24,30,18,'#454454');rect(c,x+3,21,27,3,'#666073');}
    rect(c,0,0,w,6,P.ink);rect(c,0,h-6,w,6,P.ink);rect(c,0,0,6,h,P.ink);rect(c,w-6,0,6,h,P.ink);
  }
  function interiorHouse(c,b){
    const{x,y,w,h}=b,t=15,door=110,side=(w-door)/2;
    rect(c,x+3,y+3,w,h,'#191923');rect(c,x+t,y+t,w-t*2,h-t*2,b.role==='smith'?'#4b4750':'#65584f');
    for(let yy=y+t+3;yy<y+h-t;yy+=24){rect(c,x+t,yy,w-t*2,3,'#3d3b43');for(let xx=x+t+36+(Math.floor(yy/24)%2)*45;xx<x+w-t;xx+=90)rect(c,xx,yy,3,21,'#49444a');}
    const wall=(xx,yy,ww,hh)=>{rect(c,xx,yy-15,ww,hh+15,P.ink);rect(c,xx+3,yy-12,ww-6,hh+9,'#72707d');rect(c,xx+3,yy-12,ww-6,6,'#999099');rect(c,xx+6,yy,ww-12,3,'#565665');};
    wall(x,y,w,t);wall(x,y+t,t,h-t);wall(x+w-t,y+t,t,h-t);wall(x,y+h-t,side,t);wall(x+side+door,y+h-t,side,t);
    rect(c,x+side,y+h-t,door,t,'#a28463');rect(c,x+side,y+h-3,door,3,P.gold);
    // Wall-mounted shelves identify the room without blocking its usable floor.
    if(b.role==='scribe'){rect(c,x+36,y+18,w-72,9,'#9e7652');for(let i=0;i<7;i++){rect(c,x+42+i*21,y+2,15,18,i%2?P.pale:'#866c73');rect(c,x+45+i*21,y+5,9,3,'#efce96');}rect(c,x+w-69,y+39,30,3,P.gold);}
    if(b.role==='smith'){rect(c,x+30,y+18,72,12,'#2c2d3d');rect(c,x+39,y+18,54,6,P.ember);for(let i=0;i<4;i++){rect(c,x+w-39-i*24,y+18,3,27,'#a28a70');rect(c,x+w-45-i*24,y+15,15,6,P.edge);}}
    if(b.role==='granary'){for(let i=0;i<4;i++){rect(c,x+27+i*54,y+18,42,24,'#9b8154');rect(c,x+30+i*54,y+21,36,3,'#c3a471');rect(c,x+45+i*54,y+18,3,24,'#69593e');}}
    if(b.role==='mill'){rect(c,x+30,y+21,60,6,'#a28a64');for(let i=0;i<3;i++){rect(c,x+w-42-i*30,y+21,21,21,'#8d7758');rect(c,x+w-39-i*30,y+21,15,3,'#bd9f6c');}}
    label(c,b.role==='scribe'?'旧屋 · 抄写台':b.name,x+w/2,y+h+21);
  }
  function infirmary(c,b,p){
    const{x,y,w,h}=b;rect(c,x+9,y+12,w-18,h-6,'#686453');
    for(let i=0;i<3;i++){const bx=x+27+i*72;rect(c,bx,y+54,48,75,'#3b4547');rect(c,bx+3,y+57,42,12,'#c8c0a2');rect(c,bx+3,y+72,42,51,'#929f8a');rect(c,bx+12,y+87,24,3,'#b7b99b');}
    for(const px of[x+9,x+w-15]){rect(c,px,y-9,9,h+15,'#554236');rect(c,px+3,y-9,3,h+12,'#a3835d');}
    c.save();if(p&&p.x>x&&p.x<x+w&&p.y>y&&p.y<y+h)c.globalAlpha=.5;
    rect(c,x-6,y-39,w+12,60,P.deep);for(let i=0;i<Math.ceil(w/30);i++)rect(c,x-3+i*30,y-36,Math.min(30,w+6-i*30),51,i%2?'#bcb99c':'#6d8979');rect(c,x-6,y+12,w+12,6,'#d5c396');c.restore();
    rect(c,x+w/2-18,y-30,36,33,'#e0d3ac');rect(c,x+w/2-3,y-27,6,27,'#6b836d');rect(c,x+w/2-12,y-18,24,6,'#6b836d');label(c,'包扎棚',x+w/2,y+h+21);
  }
  function landmark(c,d,time=0,player){
    const{x,y,w,h}=d;
    if(d.kind==='river'){rect(c,x,y,w,h,'#28384c');for(let row=0;row<3;row++)for(let xx=x+12+(row%2)*36;xx<x+w-24;xx+=72)rect(c,xx,y+9+row*18,36,3,row%2?'#617e87':'#435f75');rect(c,x,y-6,w,6,'#8b816a');rect(c,x,y+h,w,6,'#464b4e');return;}
    if(d.kind==='well'){rect(c,x-6,y+h-9,w+12,12,P.ink);rect(c,x,y+12,w,h-12,'#777784');rect(c,x+6,y+21,w-12,h-24,'#282638');rect(c,x+12,y+27,w-24,h-36,'#456375');rect(c,x,y+9,w,9,'#a19b9e');for(const xx of [x+3,x+w-9]){rect(c,xx,y-36,6,54,'#6b513e');rect(c,xx,y-36,3,54,'#a8855c');}rect(c,x,y-39,w,9,'#ad8857');rect(c,x+w/2-3,y-30,3,60,'#c5ad79');rect(c,x+w/2-12,y+27,21,15,'#9e7951');return;}
    if(d.kind==='table'){rect(c,x+3,y+9,w,h,'#17182288');for(const xx of[x+6,x+w-12])rect(c,xx,y+6,6,h+3,'#6e523d');rect(c,x,y-6,w,h-3,'#986f4e');rect(c,x+3,y-3,w-6,3,'#c49b64');rect(c,x+12,y+3,27,15,'#d9c5a0');rect(c,x+45,y,30,18,'#ddd0ae');for(let i=0;i<3;i++){rect(c,x+15,y+6+i*3,18,1,'#8e7963');rect(c,x+48,y+3+i*3,21,1,'#8e7963');}rect(c,x+w-21,y+3,9,9,P.ink);rect(c,x+w-27,y+3,6,9,P.gold);return;}
    if(d.kind==='wheel'){rect(c,x+w/2-3,y,6,h,'#503f3b');rect(c,x,y+h/2-3,w,6,'#503f3b');for(let i=0;i<12;i++){const a=i*Math.PI/6;rect(c,x+w/2+Math.cos(a)*(w/2-3)-3,y+h/2+Math.sin(a)*(h/2-3)-3,6,9,P.gold);}for(let i=0;i<8;i++){const a=i*Math.PI/4;stroke(c,{x:x+w/2,y:y+h/2},{x:x+w/2+Math.cos(a)*(w/2-3),y:y+h/2+Math.sin(a)*(h/2-3)},'#946b49',3);}rect(c,x+w/2-6,y+h/2-6,12,12,P.light);return;}
    if(d.kind==='stall'){rect(c,x+6,y+12,w,h,'#1a192788');rect(c,x,y+9,w,h-9,'#856148');rect(c,x+6,y+12,w-12,6,'#b48f64');for(const xx of[x+3,x+w-9])rect(c,xx,y-39,6,h+39,'#594839');c.save();if(player&&player.x>x-9&&player.x<x+w+9&&player.y>y-12&&player.y<y+h)c.globalAlpha=.5;rect(c,x-6,y-45,w+12,30,P.ink);for(let i=0;i<Math.ceil(w/24);i++)rect(c,x-3+i*24,y-42,Math.min(24,w+6-i*24),24,i%2?'#b49a6f':'#76586a');rect(c,x-6,y-21,w+12,9,'#c1a47c');c.restore();for(let i=0;i<4;i++)rect(c,x+12+i*24,y+15,15,12,i%2?'#aaa36f':'#77885c');}
  }
  function bell(c,b,time,night,state={}){
    const{x,y}=b;c.save();if(state.player&&Math.abs(state.player.x-x)<96&&state.player.y<y+24&&state.player.y>y-186)c.globalAlpha=.36;
    rect(c,x-96,y+12,192,24,P.ink);rect(c,x-87,y+6,174,18,'#555669');rect(c,x-75,y,150,9,'#9a8c86');
    for(const side of[-1,1]){const px=x+side*66-9;rect(c,px-3,y-180,24,186,P.ink);rect(c,px,y-174,18,180,P.stone);rect(c,px,y-174,6,174,'#908592');for(let i=0;i<5;i++)rect(c,px,y-147+i*33,18,3,'#43495e');rect(c,px-6,y-6,30,9,'#908592');}
    rect(c,x-93,y-195,186,21,P.ink);rect(c,x-90,y-192,180,12,'#877982');rect(c,x-87,y-192,174,3,'#b29b8f');rect(c,x-69,y-204,138,12,'#665365');rect(c,x-57,y-210,114,6,'#997779');
    rect(c,x-6,y-180,12,21,'#594933');rect(c,x-18,y-162,36,9,'#76583a');rect(c,x-30,y-153,60,42,P.gold);rect(c,x-36,y-126,72,24,'#bd884b');rect(c,x-45,y-108,90,18,'#c99859');rect(c,x-54,y-93,108,12,P.light);rect(c,x-45,y-84,90,6,'#795b43');rect(c,x-36,y-78,72,6,P.ink);rect(c,x-27,y-150,9,33,'#e9b972');rect(c,x-33,y-111,9,15,'#e9b972');rect(c,x+24,y-144,6,42,'#996b3e');
    // Nine days ago the core fractured. Its scar remains on the right of the bell,
    // matching the prologue's silhouette even before the final bell decision.
    for(const[dx,dy,ww,hh]of[[9,-153,6,15],[12,-141,6,12],[18,-132,6,12],[15,-123,6,9],[21,-117,6,12],[24,-108,6,15],[30,-96,6,15]])rect(c,x+dx,y+dy,ww,hh,P.deep);
    rect(c,x+21,y-114,3,9,P.violetDark);rect(c,x+30,y-93,3,6,P.violetDark);
    // The bronze bell survives; the small magic core beneath it is what shattered.
    if(state.broken){for(let i=0;i<5;i++)rect(c,x-30+i*15,y-12+(i%2)*6,9,6,i%2?P.gold:P.violetDark);rect(c,x-3,y-75,6,15,'#584254');}
    else{rect(c,x-6,y-75,12,18,P.gold);rect(c,x-3,y-69,6,9,P.light);}
    rect(c,x-24,y-6,48,6,'#a27e53');c.restore();if(!state.hideLabel)label(c,state.broken?'圣钟 · 钟芯已碎':'圣钟 · 旧庇护阵',x,y-222,P.light);
  }
  function post(c,p){rect(c,p.x-6,p.y-60,12,72,P.ink);rect(c,p.x-3,p.y-57,6,69,'#89674b');rect(c,p.x+3,p.y-57,30,24,'#9d774e');rect(c,p.x+6,p.y-54,24,18,P.gold);rect(c,p.x+9,p.y-51,15,3,P.light);rect(c,p.x+12,p.y-45,15,3,P.light);rect(c,p.x-18,p.y+12,36,6,'#686372');label(c,'驿站',p.x,p.y+36);}
  function fence(c,b){if(b.hp<=0){for(let i=0;i<b.w;i+=18){rect(c,b.x+i,b.y+6,12,3,'#806044');rect(c,b.x+i+6,b.y+9,9,3,'#a78053');}return;}rect(c,b.x+3,b.y+9,b.w+3,12,'#15142188');rect(c,b.x,b.y,b.w,6,'#a78053');rect(c,b.x,b.y+3,b.w,3,'#795539');for(let i=0;i<=b.w;i+=18){rect(c,b.x+i,b.y-9,9,27,P.ink);rect(c,b.x+i+3,b.y-6,3,24,'#a78053');rect(c,b.x+i,b.y-9,9,3,P.gold);}if(b.type==='beam'){rect(c,b.x-3,b.y-12,b.w+9,3,P.light);rect(c,b.x-3,b.y+21,b.w+9,3,P.gold);}}
  function tree(c,x,y){rect(c,x-6,y-21,12,45,P.ink);rect(c,x-3,y-18,6,39,'#89674b');for(const[yy,ww,col]of[[-39,60,'#273b3b'],[-57,72,'#344c47'],[-78,54,'#486153'],[-90,30,'#657a5f']]){rect(c,x-ww/2-3,y+yy-3,ww+6,24,P.ink);rect(c,x-ww/2,y+yy,ww,18,col);}rect(c,x-18,y-54,18,6,'#627b61');rect(c,x+6,y-75,12,6,'#789070');}
  function prop(c,p){const spent=['spent','broken','fallen'].includes(p.state),key=[p.kind,spent,p.state==='open'].join(':');let s=props.get(key);if(!s){s=pixels(24,30,q=>{
      if(p.kind==='barrel'){box(q,4,2,16,27,spent?'#625243':'#906649');rect(q,6,4,3,23,'#b48c60');rect(q,3,7,18,3,'#51596c');rect(q,3,23,18,3,'#51596c');rect(q,5,3,14,2,P.gold);if(spent){rect(q,11,2,4,21,P.deep);rect(q,15,20,5,3,P.deep);}}
      else if(p.kind==='alarm'){box(q,2,0,4,30,'#89674b');box(q,18,0,4,30,'#89674b');box(q,0,0,24,5,P.gold);rect(q,9,8,6,8,P.gold);rect(q,7,14,10,4,P.light);rect(q,11,17,2,4,P.gold);if(spent)rect(q,11,7,2,12,P.deep);}
      else if(p.kind==='support'){if(spent)for(let i=0;i<5;i++)rect(q,3+i*4,19-i,5,4,'#a88053');else{box(q,2,0,4,30,'#89674b');box(q,18,0,4,30,'#89674b');box(q,0,0,24,5,P.gold);for(let i=0;i<6;i++)rect(q,5+i*2,23-i*4,4,4,'#b08b5b');}}
      else{box(q,0,0,4,30,'#997551');box(q,20,0,4,30,'#997551');box(q,0,0,24,4,P.gold);if(!spent&&p.state!=='open'){rect(q,4,4,16,26,'#60483d');for(let i=0;i<4;i++)rect(q,5+i*4,5,2,24,'#97704a');rect(q,4,11,16,3,P.gold);rect(q,4,24,16,3,P.gold);}}
    });props.set(key,s);}blit(c,s,p.x,p.y,p.w||48,p.h||60);if(p.outlined){ring(c,p.x+(p.w||48)/2,p.y+(p.h||60)/2,Math.max(p.w||48,p.h||60)*.63,P.light,3);}}

  function flame(c,x,y,size,alpha=1,time=0){const s=Math.max(3,Math.round(size/12)*3),f=((Math.floor(time*10)+Math.floor(x/9))%4+4)%4;c.save();c.globalAlpha=alpha;rect(c,x-s*2,y-s*2,s*4,s*2,P.ember);rect(c,x-s,y-s*4,s*2,s*4,P.flame);rect(c,x+(f%2?s:0),y-s*(5+f%2),s,s*3,P.gold);rect(c,x-s,y-s*2,s*2,s*2,P.hot);rect(c,x,y-s*3,s,s*2,'#f4dfaa');c.restore();}
  function mouthPosition(p){const dir=facingFor(p.angle,motion.get('player')?.facing);return{x:p.x+(dir===2?-15:15),y:p.y-45};}
  function fireCone(c,p,s,t){
    const mouth=mouthPosition(p);
    // The mouth connection and the ground footprint use different origins deliberately:
    // damage remains ground-plane geometry while the stream visibly leaves the mouth.
    c.save();c.globalAlpha=.35;for(let i=0;i<9;i++){const a=p.angle-s.width+i*s.width/4;stroke(c,{x:p.x+Math.cos(a)*30,y:p.y+Math.sin(a)*30},{x:p.x+Math.cos(a)*s.range,y:p.y+Math.sin(a)*s.range},P.ember,6);}c.restore();
    const count=Math.min(40,Math.max(18,Math.ceil(s.range/9)));for(let i=0;i<count;i++){const u=(i/count+t*1.2)%1,a=p.angle+Math.sin(i*2.3+t*9)*s.width*u;const xx=mouth.x*(1-u)+(p.x+Math.cos(a)*s.range)*u,yy=mouth.y*(1-u)+(p.y+Math.sin(a)*s.range)*u;flame(c,xx,yy,9+u*18,.94,t+i);}
    stroke(c,mouth,{x:mouth.x+Math.cos(p.angle)*24,y:mouth.y+Math.sin(p.angle)*24},P.hot,6);
  }
  function field(c,f,t){if(f.state==='seed'){rect(c,f.x-9,f.y-6,18,12,P.ink);rect(c,f.x-6,f.y-9,12,18,P.ember);rect(c,f.x-3,f.y-6,6,9,P.flame);rect(c,f.x,f.y-3,3,3,P.hot);return;}
    c.save();c.globalAlpha=.5*Math.min(1,f.life);ring(c,f.x,f.y,f.r*.8,P.flame,6);c.restore();for(let i=0;i<7;i++){const a=i*2.4;flame(c,f.x+Math.cos(a)*f.r*.6,f.y+Math.sin(a)*f.r*.6,15,Math.min(1,f.life),t+i);}}
  // Optional visual aggregation for hundreds of overlapping fields. It does not touch game fields.
  function fields(c,list,t){const buckets=new Map();for(const f of list){const cell=f.state==='seed'?18:30,key=f.state+':'+Math.floor(f.x/cell)+':'+Math.floor(f.y/cell);const found=buckets.get(key);if(!found)buckets.set(key,{...f,count:1});else{found.count++;found.r=Math.max(found.r,f.r);found.life=Math.max(found.life,f.life);}}for(const f of buckets.values()){field(c,f,t);if(f.state==='seed'&&f.count>1){rect(c,f.x+6,f.y-24,30,18,P.deep);label(c,'×'+f.count,f.x+21,f.y-10,P.hot);}}}
  function pet(c,p,t){c.save();c.globalAlpha=Math.min(1,p.life);rect(c,p.x-15,p.y-21,30,24,P.violetDark);rect(c,p.x-12,p.y-27,24,18,'#8e65af');rect(c,p.x-18,p.y-15,6,15,'#614782');rect(c,p.x+12,p.y-15,6,15,'#614782');rect(c,p.x-9,p.y-21,3,6,'#e6c7fa');rect(c,p.x+6,p.y-21,3,6,'#e6c7fa');rect(c,p.x-12,p.y+3,24,3,P.deep);c.restore();}
  function corpse(c,e){c.save();c.globalAlpha=Math.min(1,e.life/2)*.65;const k=e.type==='villager'?'villager':'militia';c.translate(Math.round(e.x),Math.round(e.y));c.rotate(Math.PI/2);blit(c,actorSprite(k,1,0,'kneel',variantFor(e)),-66,-24,72,90);c.restore();}
  function effect(c,f,g){
    const u=1-f.life/f.maxLife,r=f.radius*(.2+.8*u),fear=['roar','echo','phantom-summon','phantom-hit','judgement','voice-mark'].includes(f.kind),color=fear?P.violet:['dash','return-dash','earth','plunge-tell','plunge-impact'].includes(f.kind)?P.cyan:P.flame;
    c.save();c.globalAlpha=Math.min(1,f.life*4);
    if(f.kind==='arrival'){ring(c,f.x,f.y,21,P.gold,3);rect(c,f.x-3,f.y-24,6,15,P.light);rect(c,f.x-3,f.y-3,6,3,P.light);}
    else if(['beam','chain-link','earth'].includes(f.kind)){const end={x:f.x+Math.cos(f.angle)*f.radius,y:f.y+Math.sin(f.angle)*f.radius};stroke(c,f,end,color,f.kind==='beam'?18:f.kind==='earth'?24:6);stroke(c,f,end,f.kind==='earth'?'#d9e2c4':P.hot,6);for(let i=0;i<8;i++){const q=i/8;rect(c,f.x+(end.x-f.x)*q-6,f.y+(end.y-f.y)*q+(i%2?9:-12),9,6,color);}}
    else if(f.kind==='slash'){for(let a=-1;a<1;a+=.12)rect(c,f.x+Math.cos(f.angle+a)*r,f.y+Math.sin(f.angle+a)*r,6,6,P.light);}
    else if(f.kind==='dash'||f.kind==='return-dash'){for(let i=-1;i<=1;i++){const a={x:f.x-Math.cos(f.angle)*30-Math.sin(f.angle)*i*15,y:f.y-Math.sin(f.angle)*30+Math.cos(f.angle)*i*15},b={x:a.x+Math.cos(f.angle)*66,y:a.y+Math.sin(f.angle)*66};stroke(c,a,b,P.cyan,3);}}
    else if(f.kind==='panic')label(c,'!',f.x,f.y-24-u*15,P.light);
    else if(f.kind==='ignition'){ring(c,f.x,f.y,r,P.hot,6);for(let i=0;i<5;i++)flame(c,f.x+(i-2)*12,f.y,30+i%2*12,1,g.totalTime);}
    else{ring(c,f.x,f.y,r,color,6);if(fear){ring(c,f.x,f.y,r*.75,'#dcb6ed',3);for(let i=0;i<8;i++){const a=i*Math.PI/4;rect(c,f.x+Math.cos(a)*r-3,f.y+Math.sin(a)*r-3,6,6,color);}}
      if(['roar','echo'].includes(f.kind))ring(c,f.x,f.y,g.roarStats().inner*(f.kind==='echo'?1.25:1)*(.2+.8*u),'#dcb6ed',3);
      if(f.kind==='judgement'){stroke(c,{x:f.x,y:f.y-150},f,P.violet,15);stroke(c,{x:f.x,y:f.y-150},f,'#efe0f5',3);rect(c,f.x-24,f.y-117,48,6,P.violet);}
      if(f.kind==='plunge-impact'||f.kind==='explosion')for(let i=0;i<12;i++){const a=i*Math.PI/6;stroke(c,{x:f.x+Math.cos(a)*r*.55,y:f.y+Math.sin(a)*r*.55},{x:f.x+Math.cos(a)*r,y:f.y+Math.sin(a)*r},color,3);rect(c,f.x+Math.cos(a)*r,f.y+Math.sin(a)*r-9,6,9,color);}}
    c.restore();
  }
  function atmosphere(c,w,h,night,t){c.save();rect(c,0,0,w,h,night===3?'#4a294410':'#2022380a');for(let i=0;i<12;i++){const x=Math.floor(((i*167+13)%w)/3)*3,y=Math.floor(((i*71-t*(i%3+1)*3+h*100)%h)/3)*3;rect(c,x,y,3,3,i%4?'#b9b7bd33':'#e8b17455');}c.restore();}
  // First-person framing uses the same palette and Lian sprite as the village.
  // Progress is supplied by the story controller, so pausing does not advance it.
  function awakening(c,w,h,progress=0,options={}){
    const p=Math.max(0,Math.min(1,Number(progress)||0)),released=!!options.release&&p>=.82,view=pixels(384,216,q=>{
      rect(q,0,0,384,216,P.night);rect(q,0,34,384,78,P.sky);
      for(let i=0;i<20;i++)rect(q,11+i*83%360,8+i*31%78,1,1,'#c5bbb0');
      rect(q,284,23,20,20,'#bdb4a3');rect(q,280,28,28,11,'#bdb4a3');rect(q,294,23,7,20,P.sky);
      for(const[x,y,ww,hh]of[[0,91,66,52],[61,106,53,36],[277,99,61,46],[336,91,48,62]]){rect(q,x,y,ww,hh,'#45455b');for(let roof=0;roof<4;roof++)rect(q,x+roof*6,y-roof*4,ww-roof*12,4,'#6b4d63');rect(q,x+12,y+18,7,11,P.gold);rect(q,x+ww-20,y+18,7,11,'#aa8256');}
      rect(q,0,143,384,73,'#575363');for(let yy=148,row=0;yy<216;yy+=16,row++)for(let xx=-12+(row%2)*16;xx<384;xx+=36){rect(q,xx,yy,32,12,'#74707a');rect(q,xx,yy+12,32,2,'#343848');}
      q.save();q.translate(188,135);q.scale(.52,.52);bell(q,{x:0,y:0},0,1,{broken:true,hideLabel:true});q.restore();
      // The close wooden bars and forearms establish that the camera is the bound repairer.
      rect(q,0,121,384,15,P.ink);rect(q,0,124,384,9,'#765239');rect(q,0,124,384,2,'#aa7c50');
      for(const xx of[27,334]){rect(q,xx-4,112,27,104,P.ink);rect(q,xx,112,19,104,'#775038');rect(q,xx+3,112,3,104,'#aa7b50');for(let i=0;i<5;i++)rect(q,xx+9,123+i*17,6,2,'#523d34');}
      // Lian approaches only after the first narrow opening of the eyelids.
      if(p>.28){const lift=p<.55?5:0;blit(q,actorSprite('lian',1,0,'idle'),237,97+lift,80,100);const knifeY=released?171:182;rect(q,294,knifeY-3,9,6,CHARACTERS.lian.skin);rect(q,302,knifeY,15,3,'#d5d1bc');rect(q,297,knifeY,6,3,'#a37b4c');}
      for(const side of[-1,1]){const x=side<0?31:281;rect(q,x-3,180,75,36,P.ink);rect(q,x,183,69,33,P.plum);rect(q,x+6,183,9,33,P.plumLight);rect(q,x+18,164,39,33,P.skinShade);rect(q,x+18,161,33,30,P.skin);rect(q,x+21,156,9,12,P.skin);rect(q,x+33,153,9,15,P.skin);rect(q,x+45,156,9,12,P.skin);rect(q,x+15,168,6,18,P.skin);rect(q,x+18,184,39,9,'#ead5a0');rect(q,x+18,187,39,3,'#8e6546');rect(q,x+30,181,9,15,'#b69164');rect(q,x+33,181,3,15,'#ebd1a0');
        if(!released){rect(q,x+21,194,6,22,'#b59164');rect(q,x+24,194,3,22,'#ebd1a0');}
        else{rect(q,x+18,195,9,3,'#b59164');rect(q,x+12,198,9,3,'#b59164');rect(q,x+51,195,9,3,'#ebd1a0');}}
      // Stepped dark lids retain the pixel aesthetic and leave no blurry filter.
      const open=p*p*(3-2*p),lid=Math.round((1-open)*108);if(lid>0){rect(q,0,0,384,lid,P.ink);rect(q,0,216-lid,384,lid,P.ink);rect(q,0,lid,72,3,P.ink);rect(q,312,lid,72,3,P.ink);rect(q,0,213-lid,54,3,P.ink);rect(q,330,213-lid,54,3,P.ink);}
    });
    c.save();c.imageSmoothingEnabled=false;rect(c,0,0,w,h,P.ink);const scale=Math.min(w/384,h/216),dw=384*scale,dh=216*scale;blit(c,view,(w-dw)/2,(h-dh)/2,dw,dh);c.restore();
  }
  function coverCanvas(){if(cover)return cover;cover=pixels(384,216,c=>{
    rect(c,0,0,384,216,P.night);rect(c,0,32,384,80,P.sky);for(let i=0;i<18;i++){rect(c,(i*47)%384,14+(i*19)%66,1,1,'#b1a7ac');}
    rect(c,291,16,22,22,P.pale);rect(c,286,22,31,11,P.pale);rect(c,295,16,9,9,'#e5d2aa');
    for(let i=0;i<13;i++){const x=i*33;rect(c,x,87-i%3*8,36,73,P.deep);rect(c,x+9,73-i%3*8,18,23,P.deep);}
    // Distant village lights underneath a black-tide rift.
    for(let i=0;i<8;i++){const x=113+i*33,y=126+(i%2)*10;rect(c,x,y,26,29,'#3e3f57');rect(c,x-3,y-3,32,5,'#655269');rect(c,x+3,y-8,20,5,'#655269');rect(c,x+9,y-13,8,5,'#655269');rect(c,x+7,y+9,4,7,P.gold);rect(c,x+18,y+9,4,7,P.gold);}
    for(let i=0;i<18;i++){const x=i*8,y=55+i*5;rect(c,x,y,29,12,P.ink);rect(c,x+5,y+10,25,3,P.violetDark);if(i%2===0)rect(c,x+17,y+10,8,2,P.violet);}
    rect(c,0,164,384,52,'#4c4d5d');for(let i=0;i<32;i++){const x=i*19%384,y=171+Math.floor(i/10)*13;rect(c,x,y,25,8,'#626071');rect(c,x,y+8,25,1,'#34394e');}
    // Same monumental bell renderer as gameplay, with no title burnt into the asset.
    c.save();c.translate(272,162);c.scale(.58,.58);bell(c,{x:0,y:0},0,1,{broken:true,hideLabel:true});c.restore();
    blit(c,actorSprite('demon',1,0,'idle'),221,147,48,60);blit(c,actorSprite('lian',1,0,'idle'),281,153,40,50);
    rect(c,210,203,115,3,P.ink);flame(c,195,184,9,1,0);rect(c,191,184,9,15,'#343447');rect(c,188,183,15,3,P.ink);
    // An uncluttered dark area is reserved for the live title and buttons.
    rect(c,0,0,120,216,'#151421cc');rect(c,120,0,6,216,'#151421aa');rect(c,126,0,6,216,'#15142166');rect(c,132,0,6,216,'#15142133');
  });return cover;}
  function coverURL(){return coverCanvas().toDataURL('image/png');}
  window.DemonArt={ground,house,bell,post,fence,tree,landmark,actor,actorHeight,idleFrame,facingFor,awakening,atmosphere,flame,fireCone,mouthPosition,field,fields,pet,corpse,effect,prop,actorSprite,pixels,rect,ring,stroke,portrait,portraitURL,coverCanvas,coverURL,characters:CHARACTERS,palette:P,style:'pixel-v2',cacheInfo:()=>({sprites:sprites.size,portraits:portraits.size,props:props.size,motion:motion.size})};
})();
