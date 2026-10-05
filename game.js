/* Local, dependency-free canvas client. All game rules live in core.js. */
(function () {
  'use strict';
  const { Game, W, H, NIGHT_LENGTH, XP, TERMS, DIRECTIONS, PREPARATIONS, clamp, distance } = window.DemonDemo;
  const { normalize: gameKey } = window.DemonInput;
  const UI=window.DemonD13UI, Codex=window.DemonCodex, V=window.DemonVillage;
  const WORLD_W=V.width,WORLD_H=V.height,BELL_POSITION=V.bellPosition,REPORT_POSTS=V.reportPosts;
  let codexOpen=false,codexTab='entries',codexSelected=null,pausedBeforeCodex=false;
  const ActiveGame=window.DemonCampaign?.CampaignGame||window.DemonDemo.CampaignGame;
  const FX=window.DemonCombatFX, combatSound=new FX.SoundBank();
  FX.installArt(window.DemonArt);FX.installGame(ActiveGame);
  const $ = id => document.getElementById(id);
  const canvas = $('game-canvas'), ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  let game = new ActiveGame(), paused = false, helpOpen = false, pausedBeforeHelp = false, panelKey = '';
  let camera={x:0,y:0}, cursor={x:512,y:280}, aim = { x: 512, y: 280 }, firing = false, rightHeld=false, placePressed=false, keys = new Set(), pressed = new Set();
  let healthTarget=null, particles = [], floats = [], shake = 0, last = performance.now(), hudTimer = 0, accumulator = 0;
  let audio = null, muted = false, lastFireSound = 0;
  let journalOpen = false, endingBookOpen=false, abilityCue = null, lastSeedNotice=-10, reportHint=false, guideUntil=0, causalCue=null,sceneVisualTime=0,visualBeatKey='';
  const SCENE_STORAGE='demon-demo-campaign-scenes-v1';
  const TUTORIAL_STORAGE='demon-demo-tutorial-d13-v1',noticeQueue=[];
  let doorPractice=false;
  function readTutorials(){try{const a=JSON.parse(localStorage.getItem(TUTORIAL_STORAGE)||'[]');return Array.isArray(a)?a.filter(k=>typeof k==='string'):[];}catch(_){return[];}}
  function saveTutorials(){try{localStorage.setItem(TUTORIAL_STORAGE,JSON.stringify(game.d12SeenTutorials||[]));}catch(_){}}
  function activeTutorial(){return game.tutorialView?.()||null;}
  function queueNotice(data){const last=noticeQueue[noticeQueue.length-1];if(last&&last.kind===data.kind&&last.state===data.state){last.count=(last.count||1)+1;last.traits=[...new Set([...(last.traits||[]),...(data.traits||[])])];last.newTraits=[...new Set([...(last.newTraits||[]),...(data.newTraits||[])])];}else noticeQueue.push({...data,count:1});}
  function updateNotice(){if(causalCue&&causalCue.until>game.totalTime)return;if(noticeQueue.length)causalCue={...noticeQueue.shift(),until:game.totalTime+6};else causalCue=null;}
  function traitNames(traits){return [...new Set(traits||[])].map(t=>window.DemonD12.TRAITS[t]||t).join('、');}
  function tutorialPanel(view){
    const d=DIRECTIONS[view.kind]||DIRECTIONS.flame,quality=view.id.startsWith('quality-'),term=quality?TERMS[view.key]:null;
    const content=quality?{title:term.name+'：操作变了',body:`<p><b>新操作：</b>${safe(term.tip)}</p><p>${safe(INTUITION[view.key])}</p>`}:
      view.id==='report-created'?{title:'有人记下了你的打法',body:`<p><b>${d.name}色块</b>正在送往驿站。让他送达，强化会更偏向${d.name}，勇者也会得知他看见的攻击。</p><p>你可以继续战斗；想截住这封消息，就追上按 <b>E</b>。</p>`}:
      view.id==='delivered'?{title:d.name+'见闻已送达',body:`<p><b>成长：</b>之后的强化选项更偏向${d.name}，同方向的具体词条仍随机。</p><p><b>勇者得知：</b>${safe(traitNames(view.traits)||'你的攻击')}。${view.newTraits?.length?'这会影响他的备战。':'这些打法他已经听说过。'}</p>`}:
      {title:'这封消息被截住了',body:'<p><b>成长：</b>这封消息不会增加方向偏向。</p><p><b>勇者情报：</b>他收不到这封见闻；已经送达的旧消息仍然有效。</p>'};
    return UI.guidePanel({id:view.id,title:content.title,body:content.body,color:d.color});
  }
  try { muted = localStorage.getItem('demon-demo-muted') === '1'; } catch (_) {}
  const ground = document.createElement('canvas'); ground.width = WORLD_W; ground.height = WORLD_H;
  const gc = ground.getContext('2d');
  let cosmeticSeed = 89071;
  function rnd() { cosmeticSeed = (Math.imul(1664525, cosmeticSeed) + 1013904223) >>> 0; return cosmeticSeed / 4294967296; }
  function polygon(c, points, fill, stroke = null) { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } }
  function circle(c, x, y, r, fill, stroke) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } }
  function text(str, x, y, color = '#c8d0aa', size = 12, align = 'center') { ctx.font = `${size}px "Microsoft YaHei",sans-serif`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y); }
  function seedGround(){window.DemonArt.ground(gc,WORLD_W,WORLD_H,BELL_POSITION,REPORT_POSTS,V);}
  seedGround();window.addEventListener('demon-art-ready',seedGround);
  function combat(){return ['raid','boss','resolution'].includes(game.phase);}
  function activeScene(){return game.sceneView?.()||game.currentD10Scene?.()||null;}
  function updateCamera(dt=1,snap=false){const scene=activeScene(),tutorial=activeTutorial(),focus=(tutorial?.id==='report-created'?(game.activeReport?.()||game.player):null)||scene?.currentBeat?.focus||(game.phase==='boss'&&game.hero?.hp>0&&game.campaignStory?.stage!=='defense'&&distance(game.player,game.hero)<550?{x:game.player.x*.65+game.hero.x*.35,y:game.player.y*.65+game.hero.y*.35}:game.player),tx=clamp(focus.x-W/2,0,WORLD_W-W);let ty=scene?clamp(focus.y-H*.3,0,WORLD_H-H*.45):clamp(focus.y-H/2,0,WORLD_H-H);if(scene?.id==='opening')ty=Math.min(ty,game.player.y-window.DemonArt.actorHeight(game.player,game)-20);if(tutorial?.id==='report-created')ty=clamp(focus.y-H*.3,0,WORLD_H-H);const k=snap?1:Math.min(1,dt*(scene?4:10));camera.x+=(tx-camera.x)*k;camera.y+=(ty-camera.y)*k;aim={x:cursor.x+camera.x,y:cursor.y+camera.y};}
  function onScreen(e,margin=45){return e.x>=camera.x-margin&&e.x<=camera.x+W+margin&&e.y>=camera.y-margin&&e.y<=camera.y+H+margin;}
  function safe(str){return String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function codexPanel(){const list=Codex.known(game);if(!list.some(e=>e.id===codexSelected))codexSelected=list[0]?.id||null;return Codex.panel(game,V,codexTab,codexSelected,safe);}
  function drawExecution(c){const p=V.locations.execution;c.save();c.fillStyle='#15172288';c.fillRect(p.x-78,p.y-20,158,64);c.fillStyle='#78553f';c.fillRect(p.x-69,p.y-108,14,152);c.fillRect(p.x+55,p.y-108,14,152);c.fillRect(p.x-76,p.y-111,152,15);c.fillStyle='#b59a73';c.fillRect(p.x-60,p.y-92,3,58);c.fillRect(p.x+60,p.y-92,3,58);c.fillStyle='#cfb27d';c.fillRect(p.x+59,p.y-76,66,55);c.fillStyle='#413727';c.font='10px Microsoft YaHei';c.textAlign='center';c.fillText('讨伐告示',p.x+92,p.y-57);c.fillText('今晨',p.x+92,p.y-37);c.restore();}
  function paintCodex(){const m=$('codex-map');if(m)Codex.drawMap(m.getContext('2d'),m.width,m.height,V,game,{large:true,selected:codexSelected,camera});const thumb=$('codex-thumbnail'),e=Codex.byId[codexSelected],p=e&&V.locations[e.location];if(thumb&&p){const c=thumb.getContext('2d'),sx=clamp(p.x-260,0,WORLD_W-520),sy=clamp(p.y-190,0,WORLD_H-270);c.imageSmoothingEnabled=false;c.save();c.scale(thumb.width/520,thumb.height/270);c.translate(-sx,-sy);c.drawImage(ground,0,0);for(const b of V.buildings)if(b.x+b.w>sx&&b.x<sx+520&&b.y+b.h>sy&&b.y<sy+270)window.DemonArt.house(c,b,game.player);window.DemonArt.bell(c,BELL_POSITION,game.totalTime,game.night,{broken:!!game.campaignStory?.bellBroken});for(const d of V.decorations)if(d.kind!=='river'&&Math.hypot(d.x-p.x,d.y-p.y)<260)window.DemonArt.landmark(c,d,game.totalTime,game.player);for(const prop of game.scenePropsView?.({aim})||[])if(Math.hypot(prop.x-p.x,prop.y-p.y)<260)window.DemonArt.prop(c,prop);if(e.id==='execution')drawExecution(c);c.restore();}}
  function openCodex(tab='entries',id=null){if(!codexOpen)pausedBeforeCodex=paused;codexOpen=true;codexTab=tab;Codex.update(game,V,activeScene()?.currentBeat);if(id&&Codex.state(game).known.includes(id))codexSelected=id;clearInput();updatePanel(true);}
  function closeCodex(){codexOpen=false;paused=pausedBeforeCodex;clearInput();updatePanel(true);focusGame();}
  function wakeAudio() {
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(() => {}); } catch (_) {}
  }
  function tone(freq, end, duration, type = 'sine', volume = .08) {
    if (muted || !audio || audio.state !== 'running') return;
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(.001, t + duration); o.connect(g); g.connect(audio.destination); o.start(); o.stop(t + duration);
  }
  function burst(x, y, count, colors, force = 80) {
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, speed = force * (.2 + Math.random()); particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 20, life: .35 + Math.random() * .5, color: colors[i % colors.length], size: 2 + Math.random() * 3 }); }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }
  function toast(message, hero = false) {
    const el = document.createElement('div'); el.className = 'toast' + (hero ? ' hero-toast' : ''); el.textContent = message;
    const stack = $('toast-stack'); stack.appendChild(el); while (stack.children.length > 3) stack.firstChild.remove();
    setTimeout(() => el.remove(), 6500);
  }
  function consumeEvents() {
    for (const e of game.drainEvents()) {
      if (['pool-empty','legend','story-progress','prop-used','prop-broken'].includes(e.type)&&e.text)toast(e.text);
      if(e.type==='ending')rememberEnding();
      if(['hero-tell','boss'].includes(e.type)&&e.text)toast(e.text,true);
      if(e.type==='scene-complete'&&e.seen){const saved=readScenes();saved.seenKeys=[...new Set([...saved.seenKeys,e.key])];saveScenes(saved);}
      if(e.type==='report-created')queueNotice({...e,kind:e.kind||game.activeReport?.()?.report.kind,state:'witnessed'});
      if(e.type==='delivered'){queueNotice({...e,state:'delivered'});tone(440,650,.2,'triangle',.055);}
      if(e.type==='intercepted')queueNotice({...e,kind:e.kind||causalCue?.kind,state:'intercepted'});
      if(e.type==='tutorial-read'){saveTutorials();const viewed=e.id;if(viewed==='report-created'||viewed==='delivered'||viewed==='intercepted'){for(let i=noticeQueue.length-1;i>=0;i--)if(noticeQueue[i].state===({ 'report-created':'witnessed',delivered:'delivered',intercepted:'intercepted'}[viewed]))noticeQueue.splice(i,1);}}
      if(e.type==='night-ready')toast(e.text);
      if(e.type==='skill-blocked')abilityCue={text:e.text,until:game.totalTime+2};
      if(e.type==='damage'){const target=[...game.entities,...(game.hero?[game.hero]:[])].find(q=>distance(q,e)<10),y=e.y-(target?window.DemonArt.actorHeight(target,game):40)-13,recent=floats.find(f=>f.damage&&f.life>.42&&Math.abs(f.x-e.x)<22&&Math.abs(f.originY-e.y)<20);if(recent){recent.amount+=e.amount;recent.life=.7;recent.color=recent.amount>20?'#ffe2a3':'#e8c59b';}else floats.push({x:e.x,y,originY:e.y,amount:e.amount,life:.7,color:e.amount>20?'#ffe2a3':'#e8c59b',damage:true});}
      if(e.type==='ignition-damage')floats.push({x:e.x,y:e.y-65,amount:`爆燃 ${e.amount}`,life:1.4,color:'#fff2b0',size:24});
      if(e.type==='seed-placed')combatSound.play(audio,'seed',muted);
      if(e.type==='seed-blocked'&&game.totalTime-lastSeedNotice>1){lastSeedNotice=game.totalTime;abilityCue={text:e.text,until:game.totalTime+1.5};}
      if(e.type==='ignition'){shake=Math.max(shake,Math.min(8,3+Math.log2(1+e.count)));combatSound.play(audio,'ignition',muted);}
      if (e.type === 'fear') { burst(e.x, e.y, 5, ['#b29ac5','#d4bfe2'], 45); floats.push({ x: e.x, y: e.y - 24, amount: `+${e.amount} 恐惧`, life: .9, color: '#c1a9dc' }); }
      if(e.type==='enemy-down'){floats.push({x:e.x,y:e.y-40,amount:e.text,life:1.2,color:'#ffdc91'});}
      if(e.type==='explosion'){shake=Math.max(shake,4);combatSound.play(audio,'explosion',muted);}
      if(e.type==='player-hit'){shake=Math.max(shake,5);combatSound.play(audio,'force-hit',muted);}
      if(e.type==='break')shake=Math.max(shake,4);
      if(e.type==='dash')combatSound.play(audio,e.returning?'return-dash':'dash',muted);
      if(e.type==='roar')combatSound.play(audio,'roar',muted);
      if (e.type === 'chosen' || e.type === 'legend') { tone(220, 440, .25, 'triangle'); setTimeout(() => tone(330, 660, .3, 'triangle'), 110); }
      if (e.type === 'chosen') {
        abilityCue={text:`${e.text} · ${e.tip}`,until:game.totalTime+(TERMS[e.key].quality?10:6)};
      }
      if(['lance','earth','echo','judgment','judgement','plunge','plunge-impact','return-dash','shadow'].includes(e.type)){if(e.type==='plunge-impact')shake=Math.max(shake,7);combatSound.play(audio,e.type,muted);}
      if (e.type === 'rescued') tone(390, 780, .4, 'triangle', .06);
      if (e.type === 'victory') { tone(330, 660, .6, 'triangle'); shake = 0; }
    }
  }

  function house(b){window.DemonArt.house(ctx,b,game.player);}
  function fence(b){window.DemonArt.fence(ctx,b);}
  function flame(x,y,size,alpha=1){window.DemonArt.flame(ctx,x,y,size,alpha,game.totalTime);}
  function sceneProp(prop){window.DemonArt.prop(ctx,prop);}
  function actor(e){
    const original=e._source||e,isPlayer=original===game.player,isHero=original===game.hero,top=e.y-window.DemonArt.actorHeight(e,game)+10;
    window.DemonArt.actor(ctx,e,game,{time:game.totalTime,scene:activeScene(),moving:keys.size>0});
    if(isPlayer&&!activeScene()){ctx.beginPath();ctx.arc(e.x,e.y+8,29,e.angle-.34,e.angle+.34);ctx.strokeStyle='#ebcb9388';ctx.lineWidth=2;ctx.stroke();}
    if(e.burn>0&&e.hp>0){flame(e.x-9,e.y+3,8);flame(e.x+10,e.y+5,10);}
    if(e.report){const d=DIRECTIONS[e.report.kind];circle(ctx,e.x,e.y+7,25,null,d.color);ctx.fillStyle=d.color;ctx.fillRect(e.x+16,top-12,20,20);text(d.mark,e.x+26,top+3,'#151f29',13);}
    if(e.paperCourier){ctx.fillStyle='#d9d6c8';ctx.fillRect(e.x+15,top-12,14,17);ctx.strokeStyle='#5e6e7d';ctx.lineWidth=1;ctx.strokeRect(e.x+15,top-12,14,17);text('两封信',e.x,top-16,'#ede2c8',11);}
    if(e.storyActor==='lian')text('黎安',e.x,top-9,'#e3cfaa',12);
    if(e.storyActor==='execution-guard')text('负伤守卫',e.x,top-7,'#bac7ce',10);
    if(e.storyActor==='refugee')text('幸存者',e.x,top-7,'#bac7ce',10);
    if(isPlayer&&e.stun>0)text('失衡',e.x,top-12,'#e4ab80',11);
  }
  function drawHealthAndMarks(actors){
    const hurt=new Set(UI.healthEntries(actors,game));
    for(const e of actors){if(!onScreen(e,100))continue;const top=e.y-window.DemonArt.actorHeight(e,game)+3,marks=e.voiceMarks||e.judgmentMarks||0;
      if(hurt.has(e)){window.DemonArt.rect(ctx,e.x-22,top-8,44,7,'#0a1020');window.DemonArt.rect(ctx,e.x-20,top-6,40*clamp(e.hp/e.maxHp,0,1),3,'#e99683');}
      if(marks>0)FX.sigil(ctx,{...e,voiceMarks:marks},window.DemonArt.actorHeight(e,game)+12,game.totalTime);
    }
  }
  function badge(title, subtitle, x, y, color, occupied) {
    ctx.font='15px "Microsoft YaHei",sans-serif';
    const w=Math.max(ctx.measureText(title).width,ctx.measureText(subtitle).width)+20,h=subtitle?44:26;
    x=clamp(x-w/2,camera.x+10,camera.x+W-w-10);y=clamp(y-h,camera.y+80,camera.y+H-h-20);
    let tries=0;
    while(occupied.some(b=>x<b.x+b.w+5&&x+w>b.x-5&&y<b.y+b.h+4&&y+h>b.y-4)&&tries++<5)y-=h+5;
    y=Math.max(camera.y+80,y);occupied.push({x,y,w,h});
    ctx.fillStyle='#12251eef';ctx.fillRect(x,y,w,h);ctx.strokeStyle=color;ctx.strokeRect(x,y,w,h);
    text(title,x+w/2,y+18,color,15);if(subtitle)text(subtitle,x+w/2,y+36,'#c9d8c3',13);
  }
  function drawMarkers() {
    const occupied=[];
    for(const e of game.entities.filter(e=>!e.gone&&onScreen(e,0)&&!e.storyActor&&(e.character||e.report)).sort((a,b)=>a.y-b.y)) {
      const title=e.report?`${DIRECTIONS[e.report.kind].mark} · 报信`:`★ ${e.name}`;
      const sub=e.report?(game.reportStatus?.().stageName||'前往驿站'): '见证者';
      badge(title,sub,e.x,e.y-window.DemonArt.actorHeight(e,game)-10,e.report?DIRECTIONS[e.report.kind].color:'#ebc477',occupied);
    }
    const goals=game.storyTargets?.()||[game.storyObjective?.()].filter(Boolean);for(const goal of goals){if(goal.completed||!onScreen(goal,0))continue;circle(ctx,goal.x,goal.y,goal.r||80,'#d8c88911','#d8c88966');text(goal.action==='dash'?'空格':'E',goal.x,goal.y-16,'#f6e0a6',18);text(goal.title,goal.x,goal.y+16,'#e4d1a3',13);if(goal.hold>0){ctx.lineWidth=4;ctx.beginPath();ctx.arc(goal.x,goal.y,(goal.r||80)*.6,-Math.PI/2,-Math.PI/2+goal.hold*Math.PI*2);ctx.strokeStyle='#f0d9a4';ctx.stroke();}}
  }
  function tell(e, hero) {
    if (!(hero && e.state==='windup') && !(e.attackTimer>0)) return;
    const tx=hero&&e.action==='heavy'&&e.lockedTarget?e.lockedTarget.x:e.x,ty=hero&&e.action==='heavy'&&e.lockedTarget?e.lockedTarget.y:e.y;
    ctx.save(); ctx.translate(tx,ty); ctx.rotate(e.aim);
    ctx.fillStyle='#dd675233'; ctx.strokeStyle='#ed9472'; ctx.lineWidth=1.5;
    if (hero && e.action==='thrust') { ctx.fillRect(0,-24,300,48); ctx.strokeRect(0,-24,300,48); polygon(ctx,[[305,0],[285,-9],[285,9]],'#ec9674'); }
    else if (hero && e.action==='heavy') circle(ctx,0,0,105,'#dc66552b','#ed9472');
    else { ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,hero?85:54,-1.1,1.1); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  function drawWorld() {
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);ctx.fillStyle='#101b2d';ctx.fillRect(0,0,W,H); if(activeScene()?.currentBeat?.cinematic==='awakening'){const panel=document.querySelector('.awakening-panel'),bounds=canvas.getBoundingClientRect(),available=panel?Math.max(250,H-panel.getBoundingClientRect().height/Math.max(1,bounds.height)*H-28):H*.62;window.DemonArt.awakening(ctx,W,available,activeScene().beatIndex===0?Math.min(1,sceneVisualTime/3):1,{release:activeScene().beatIndex>0});return;} ctx.save();
    if (shake>0 && !paused && !helpOpen && !journalOpen && !endingBookOpen && !activeScene()&&!activeTutorial()) ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    ctx.translate(-Math.round(camera.x*dpr)/dpr,-Math.round(camera.y*dpr)/dpr);ctx.drawImage(ground,0,0);
    window.DemonArt.bell(ctx,BELL_POSITION,game.totalTime,game.night,{broken:!!game.campaignStory?.bellBroken,player:game.player});
    for(const post of REPORT_POSTS)window.DemonArt.post(ctx,post);
    if(onScreen(V.locations.execution,220))drawExecution(ctx);
    const visibleLinks=new Set();
    for(const {a,b} of game.fieldLinks(false)){if(Math.max(a.x,b.x)<camera.x-24||Math.min(a.x,b.x)>camera.x+W+24||Math.max(a.y,b.y)<camera.y-24||Math.min(a.y,b.y)>camera.y+H+24)continue;const burning=a.state==='burning'&&b.state==='burning',ends=[`${Math.floor(a.x/18)},${Math.floor(a.y/18)}`,`${Math.floor(b.x/18)},${Math.floor(b.y/18)}`].sort(),renderKey=burning+ends.join(':');if(visibleLinks.has(renderKey))continue;visibleLinks.add(renderKey);FX.fieldLink(ctx,a,b,game.totalTime);}
    if(window.DemonArt.fields)window.DemonArt.fields(ctx,game.fields.filter(f=>onScreen(f,120)),game.totalTime);
    else for(const f of game.fields)if(onScreen(f,120))window.DemonArt.field(ctx,f,game.totalTime);
    const props=game.scenePropsView?.({aim})||[];
    for(const b of V.buildings)if(onScreen({x:b.x+b.w/2,y:b.y+b.h/2},350))house(b);
    for(const b of game.solids) {if(b.type==='house'&&!b.sceneBarrier||b.sceneProp||b.propId||props.some(p=>p.id===b.id))continue;if(b.sceneBarrier){ctx.fillStyle='#58614b';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#92916b';ctx.lineWidth=2;ctx.strokeRect(b.x,b.y,b.w,b.h);for(let y=b.y+16;y<b.y+b.h;y+=20){ctx.beginPath();ctx.moveTo(b.x,y);ctx.lineTo(b.x+b.w,y);ctx.stroke();}}else b.type==='house'?house(b):fence(b);}
    for(const prop of props)sceneProp(prop);
    const h=game.hero;
    if(h&&h.ward){const w=h.ward;circle(ctx,w.x,w.y,w.r,'#d9dfb521','#d8dca377');ctx.strokeStyle='#d9c997';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w.x,w.y+12);ctx.lineTo(w.x,w.y-35);ctx.stroke();polygon(ctx,[[w.x,w.y-35],[w.x+25,w.y-30],[w.x,w.y-17]],'#d7c380');text('净火圣旗',w.x,w.y-46,'#e0d7a8',10);}
    if(h?.anchor){const a=h.anchor;circle(ctx,a.x,a.y,a.r,'#9b92ba22','#bfb0d0');polygon(ctx,[[a.x,a.y-25],[a.x-13,a.y],[a.x,a.y+15],[a.x+13,a.y]],'#756882','#ddd0e9');text('镇魂锚 · 可击碎',a.x,a.y-35,'#ded0eb',11);}
    if(h?.focus>0){circle(ctx,h.x,h.y,31,null,'#e5dba8');text('凝神架势',h.x,h.y-46,'#eee0b1',13);}
    if(h?.counterTell){const c=h.counterTell;circle(ctx,c.x,c.y,c.r||60,'#dd6d5138','#ef9a78');text('反击预警',c.x,c.y-15,'#f4b28f',12);}

    const p=game.player;
    if(p.returnTrail?.life>0){const tr=p.returnTrail,col=tr.blocked?'#ee967e':'#8cdbdc';FX.returnAnchor(ctx,game);text(tr.blocked?'回路受阻':tr.ready?`空格回返 · ${tr.life.toFixed(1)}秒`:'回返起点',tr.start.x,tr.start.y+30,col,12);}
    if(p.plunge){const end=p.plunge.end;circle(ctx,end.x,end.y,p.plunge.radius||85,'#88d6df22','#a7e9ee');text('天坠',end.x,end.y-10,'#c9f5f4',15);}
    if(p.roarCharge>0){circle(ctx,p.x,p.y,42+p.roarCharge*8,null,'#dbc0f6');text(p.roarCharge>=.5?'松开 · 审判':'积压声印',p.x,p.y+48,'#e1c3fa',13);}
    if(p.dashCharge>0){circle(ctx,p.x,p.y,37+p.dashCharge*7,null,'#a6e3e3');text(game.ranks.MQ03?'松开 · 天坠':'松开 · 折返',p.x,p.y+50,'#b7eeeb',13);if(game.ranks.MQ03){const preview=game.plungePlacement(aim,p.dashCharge);circle(ctx,preview.x,preview.y,preview.radius,null,preview.valid?'#98d6dc88':'#c5827b88');}}
    for(const pet of game.pets||[])window.DemonArt.pet(ctx,pet,game.totalTime);

    if(game.path==='dragon'&&p.fireActive&&!activeScene()){const heat=clamp(p.breathTime/1.2,0,1),ready=heat>=1&&p.energy>=15&&!p.heatInterrupted;ctx.lineWidth=4;ctx.strokeStyle=ready?'#fff0b7':'#f39756';ctx.beginPath();ctx.arc(p.x,p.y,35,-Math.PI/2,-Math.PI/2+heat*Math.PI*2);ctx.stroke();text(ready?'松开 · 熔穿':'蓄热',p.x,p.y+49,ready?'#fff0b7':'#f3ad69',13);}
    for(const e of game.downed)window.DemonArt.corpse(ctx,e,game);
    for(const e of game.entities.filter(e=>e.report||e.paperCourier)){
      ctx.save();ctx.strokeStyle=e.paperCourier?'#e4e0d180':DIRECTIONS[e.report.kind].color+'80';ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(e.x,e.y+15);
      const route=e.path?.length?e.path:[e.paperCourier?game.campaignStory.courier.target:e.report.post||BELL_POSITION];for(const point of route)ctx.lineTo(point.x,point.y);ctx.stroke();ctx.restore();
    }
    const poses=activeScene()?game.sceneActorPresentation?.(sceneVisualTime)||[]:[];
    healthTarget=game.entities.filter(e=>!e.gone&&e.hp>0&&!e.protected&&!e.storyActor&&distance(e,aim)<40).sort((a,b)=>distance(a,aim)-distance(b,aim))[0]||null;
    const actors=[...game.entities,p,...(h?[h]:[])].filter(e=>!e.gone).map(e=>{const pose=poses.find(q=>q.id===e.id||q.id==='player'&&e===p);return pose?{...e,...pose,_source:e}:e;}).sort((a,b)=>a.y-b.y);[...actors.map(e=>({y:e.y,actor:e})),...V.decorations.filter(d=>d.kind!=='river'&&onScreen(d,200)).map(d=>({y:d.y+d.h,landmark:d}))].sort((a,b)=>a.y-b.y).forEach(item=>item.actor?actor(item.actor):window.DemonArt.landmark(ctx,item.landmark,game.totalTime,game.player));
    if(!activeScene())FX.breath(ctx,game);
    FX.charge(ctx,game);FX.drawEffects(ctx,game,onScreen);FX.drawContacts(ctx,game,onScreen);
    for(const pt of particles){ctx.globalAlpha=Math.min(1,pt.life*2);ctx.fillStyle=pt.color;ctx.fillRect(pt.x,pt.y,pt.size,pt.size);}ctx.globalAlpha=1;
    for(const f of floats){ctx.globalAlpha=Math.min(1,f.life*2);text(String(f.amount),f.x,f.y,f.color,f.size||(typeof f.amount==='number'?13:10));}ctx.globalAlpha=1;
    if(!activeScene()){for(const e of game.entities)if(onScreen(e,180))tell(e,false);if(h&&h.hp>0&&game.campaignStory?.stage!=='defense')tell(h,true);drawHealthAndMarks(actors);drawMarkers();}
    if(game.path==='field'&&!paused&&!helpOpen&&!journalOpen&&!endingBookOpen&&!activeScene()&&combat()){
      const preview=game.seedPlacement(aim),previous=game.fields.find(f=>f.id===preview.link);ctx.save();ctx.setLineDash([5,6]);ctx.lineWidth=2;ctx.strokeStyle=!preview.valid?'#b77c76':'#e6a064';circle(ctx,preview.x,preview.y,preview.r,null,ctx.strokeStyle);if(previous){ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(preview.x,preview.y);ctx.stroke();}ctx.restore();circle(ctx,preview.x,preview.y,4,'#ffd3a2');
    }
    if(!paused&&!helpOpen&&!endingBookOpen&&!activeScene()&&combat()){circle(ctx,aim.x,aim.y,8,null,'#dbc79188');ctx.strokeStyle='#dbc79199';ctx.beginPath();ctx.moveTo(aim.x-12,aim.y);ctx.lineTo(aim.x-5,aim.y);ctx.moveTo(aim.x+5,aim.y);ctx.lineTo(aim.x+12,aim.y);ctx.moveTo(aim.x,aim.y-12);ctx.lineTo(aim.x,aim.y-5);ctx.stroke();}
    ctx.restore();
    window.DemonArt.atmosphere(ctx,W,H,game.night,game.totalTime);
    drawNavigation();
  }

  function drawNavigation(){
    if(!combat())return;
    const carrier=game.activeReport?.()||game.entities.find(e=>!e.gone&&e.report),goal=Codex.target(game,V)||game.storyObjective?.();
    for(const item of [{e:carrier,isReport:true},{e:goal,isReport:false}]){const e=item.e;if(!e||item.isReport===false&&e.completed||onScreen(e,10))continue;const sx=e.x-camera.x-W/2,sy=e.y-camera.y-H/2,a=Math.atan2(sy,sx),scale=Math.min((W/2-24)/Math.max(1,Math.abs(sx)),(H/2-85)/Math.max(1,Math.abs(sy))),x=W/2+sx*scale,y=H/2+sy*scale,col=item.isReport?DIRECTIONS[e.report.kind].color:'#edd197';ctx.save();ctx.translate(x,y);ctx.rotate(a);polygon(ctx,[[15,0],[-9,-10],[-9,10]],col,'#19291f');ctx.restore();text(item.isReport?DIRECTIONS[e.report.kind].mark:e.tracked?'◇':e.action==='dash'?'空格':'E',x-Math.cos(a)*27,y-Math.sin(a)*27+5,col,15);}
    const map=$('minimap');Codex.drawMap(map.getContext('2d'),map.width,map.height,V,game,{camera});
  }

  const seal=`<div class="portrait-seal"><svg viewBox="0 0 240 280" aria-hidden="true"><circle cx="120" cy="140" r="98" fill="none" stroke="#85734b" stroke-width="1"/><circle cx="120" cy="140" r="88" fill="none" stroke="#534c35" stroke-dasharray="2 7"/><path d="M55 195 38 235 89 221 120 244 151 221 202 235 185 195 166 133 74 133Z" fill="#422c3a" stroke="#815147"/><path d="M77 120 58 69 88 83 100 115M163 120 182 69 152 83 140 115" fill="#d2b77c"/><path d="M75 112 95 98 145 98 165 112 166 162 146 190 120 201 94 190 74 162Z" fill="#a65c43" stroke="#d28760"/><path d="m84 133 26 9-23 4m69-13-26 9 23 4" fill="#f7d794"/><path d="m107 172 13 7 13-7" fill="none" stroke="#61332f" stroke-width="3"/><path d="M96 215 83 252M144 215l13 37" stroke="#895443" stroke-width="16"/><path d="M46 174 31 168 28 145 14 171 22 193 45 196" fill="#bc6945"/><path d="m30 170-1-18-9 17 3 11" fill="#f7c068"/><path d="m192 176 20-3 16 10-14 14-22-3" fill="#b56d48"/><path d="M62 44 75 38M179 43l-13-7M119 29v-9M36 86l-13-5M204 87l14-5" stroke="#9c8352"/><text x="120" y="273" fill="#98855e" text-anchor="middle" font-size="10" letter-spacing="4">THE UNWRITTEN ONE</text></svg></div>`;
  function readScenes(){
    try{const value=JSON.parse(localStorage.getItem(SCENE_STORAGE)||'{}');return{seenKeys:Array.isArray(value.seenKeys)?value.seenKeys.filter(k=>typeof k==='string'):[],autoSkipSeen:!!value.autoSkipSeen};}catch(_){return{seenKeys:[],autoSkipSeen:false};}
  }
  function saveScenes(value){try{localStorage.setItem(SCENE_STORAGE,JSON.stringify(value));}catch(_){}game.setScenePreferences?.(value);}
  function probabilityStrip(){
    const states=game.choicePage?.directionState||game.growthDirectionStatus(),protectedDir=game.choicePage?.protectedDirection;
    return `<div class="direction-probabilities">${Object.entries(DIRECTIONS).map(([k,d])=>{const q=states[k];return `<span class="${q.empty?'exhausted':''}" style="--direction:${d.color}" title="初始方向抽取权重 ${Math.round(q.weight*100)}%，每个位置随剩余候选重新计算；不是本页卡牌占比"><i>${d.mark}</i><b>${q.empty?'暂无可选':q.remaining===1?'仅剩 1 项':q.favored?'本次偏向':'可选'}</b><small>送达 ${q.reports} 封 · ${q.normal} 普通 / ${q.quality} 质变</small></span>`;}).join('')}</div><p class="probability-explanation">消息只偏向方向，具体词条随机；满级与互斥词条退出候选。${protectedDir?DIRECTIONS[protectedDir].name+'连续两页未出现，本页已触发保底。':'剩余词条少的方向，能占用的位置也会减少。'}</p>`;
  }
  const INTUITION={F01:'更快烧倒眼前敌人',F02:'够到更远的目标',F03:'更容易扫中一群人',F04:'一次能喷得更久',S01:'震击覆盖更大一圈',S02:'近身震击打得更痛',S03:'更快再次震击',S04:'把敌人推得更远',M01:'一次撞击伤害更高',M02:'撞完还能接着撞',M03:'承受更多伤害',M04:'冲撞次数恢复更快',FQ01:'松开喷火，发射穿透火束',FQ02:'先布火种，再同时引爆',FQ03:'燃烧目标接力爆炸',SQ01:'一声震击，错时打出两波',SQ02:'震击唤出追击恐影',SQ03:'积压声印，再主动审判',MQ01:'冲撞与裂地各打一段',MQ02:'冲进去，还能沿轨迹折返',MQ03:'蓄势跃起，砸向指定落点'};
  function choicePanel(){
    const options=game.getChoices(),reward=game.phase==='reward',status=game.growthStatus(),page=game.choicePage||{};
    return `<div class="panel growth-panel"><span class="eyebrow">${reward?'夜末奖励 · 额外一份，不消耗经验':`战斗升级 · Lv ${page.combatLevel||status.nextLevel}`}</span><h2>${page.guaranteedQuality?'第一次质变，改变你的打法':reward?'这一夜留下的力量':'选一种，立刻变强'}</h2>${probabilityStrip(page.probabilities||game.growthProbabilities())}<div class="choice-grid">${options.map((key,i)=>{const data=TERMS[key],preview=game.choicePreview(key),d=DIRECTIONS[data.dir];return `<button class="choice-card ${data.quality?'quality-card':''}" style="--direction:${d.color}" data-action="upgrade" data-key="${key}"><span class="choice-index">${i+1} · ${d.mark} ${data.quality?'◆ 质变':`${preview.level||game.ranks[key]+1} / ${preview.cap||data.cap}`}</span><strong>${safe(preview.title||data.name)}</strong><p class="choice-intuition">${safe(INTUITION[key]||data.description)}</p><div class="choice-comparison"><span>${safe(preview.before)}</span><b>→</b><strong>${safe(preview.after)}</strong></div>${data.quality||game.path==='field'&&['F02','F03'].includes(key)?`<small class="quality-operation">${safe(preview.operation||data.tip)}</small>`:''}</button>`;}).join('')}</div><p class="choice-note">按 1 / 2 / 3 选择 · 战斗暂停${page.guaranteedQuality?' · 第 6 战斗等级保证出现首次质变':''}</p></div>`;
  }
  function portraitFor(speaker){return /黎安/.test(speaker)?'lian':/勇者/.test(speaker)?'hero':/守卫|守门/.test(speaker)?'guard':/魔王|^你$/.test(speaker)?'demon':'';}
  function scenePanel(scene){const beat=scene.currentBeat||scene.beats[scene.beatIndex],lastBeat=scene.beatIndex===scene.beats.length-1,portrait=portraitFor(beat.speaker||'');
    if(beat.guide)return UI.guidePanel({id:'side-door',title:'用冲撞打开侧门',body:'<p>靠近亮起的<mark class="story-key place-key">侧门</mark>，鼠标朝向门闩，<mark class="story-key event-key">短按空格</mark>冲撞。</p><p>撞开后，负伤守卫才能离开。你也可以稍后回来。</p>',button:'明白了，去开门',action:'guide-practice',later:true});
    if(beat.illustration)return `<div class="panel prologue-panel" data-scene="${safe(scene.id)}" data-key="${safe(scene.key)}"><img class="prologue-image" src="${UI.PROLOGUE_IMAGES[beat.illustration]}" alt="${safe(beat.timeLabel||'往事')}的像素插画"><div class="prologue-copy"><div class="cinematic-heading"><span>${safe(beat.timeLabel||scene.title)}</span><span>前情 · ${scene.beatIndex+1} / ${scene.beats.length}</span></div><p class="scene-line">${UI.highlight(beat.text)}</p><div class="button-row"><button class="primary-button" data-action="scene-next">${lastBeat?'从这一夜开始':'继续往事'}</button>${scene.canSkip?'<button class="secondary-button" data-action="scene-skip">跳过已阅前情</button>':''}<span class="eyebrow">Enter 继续 · 手动翻页</span></div></div></div>`;
    return `<div class="panel cinematic-panel ${beat.cinematic==='awakening'?'awakening-panel':''}" data-scene="${safe(scene.id)}" data-branch="${safe(scene.branch)}" data-key="${safe(scene.key)}"><div class="cinematic-heading"><span class="eyebrow">${safe(scene.title)}</span><span>${scene.beatIndex+1} / ${scene.beats.length}</span></div><div class="scene-dialogue">${portrait?UI.portraitMarkup(portrait):''}<div><div class="scene-speaker">${safe(beat.speaker||'')}</div><p class="scene-line">${UI.highlight(beat.text||'')}</p>${beat.locate&&V.locations[beat.locate]?`<div class="scene-location">⌖ ${safe(V.locations[beat.locate].zone)} · ${safe(V.locations[beat.locate].name)} <button class="secondary-button" data-action="codex-location" data-id="${safe(beat.locate)}">查看位置</button></div>`:''}</div></div><div class="button-row"><button class="primary-button" data-action="scene-next">${lastBeat?'继续游戏':'下一句'}</button>${scene.canSkip?'<button class="secondary-button" data-action="scene-skip">跳过已阅剧情</button>':''}<span class="eyebrow">Enter / 重新按 E · 世界已暂停</span></div></div>`;
  }
  function interludePanel(){const scene=game.currentScene?.()||{title:'夜战之后',lines:[]},final=game.night===3;return `<div class="panel story-panel chapter-panel"><span class="eyebrow">第 ${game.night} 夜 · 灰烬纪事</span><h2>${safe(scene.title)}</h2><div class="story-lines">${scene.lines.map(l=>`<p>${safe(l)}</p>`).join('')}</div><div class="stat-strip"><span><b>${game.growthStatus().level}</b>战斗等级</span><span><b>${game.stats.delivered}</b>封见闻</span></div><p class="quiet-summary">未送达的战斗见闻已中止。本局构筑保留。${game.campaignStory?.courier&&!game.campaignStory.courier.delivered?'两封信仍在送往驿站。':''}</p><div class="button-row"><button class="primary-button" data-action="continue">${final?'走向黎明决战':'进入第 '+(game.night+1)+' 夜'}</button></div></div>`;}
  function readBook(){try{const b=JSON.parse(localStorage.getItem('demon-demo-ending-book-v1')||'{}');return b&&typeof b==='object'&&!Array.isArray(b)?b:{};}catch(_){return {};}}
  function rememberEnding(){const ending=game.getEnding?.();if(!ending?.id||!['victory','epilogue','ending'].includes(game.phase))return;const book=readBook();book[ending.id]={...ending,earned:book[ending.id]?.earned||new Date().toISOString()};try{localStorage.setItem('demon-demo-ending-book-v1',JSON.stringify(book));}catch(_){}}
  function bookPanel(){const book=readBook(),hints=game.endingHints?.()||[];return `<div class="panel book-panel"><span class="eyebrow">结局册 · 只记录走过的故事</span><h2>${['sealed','crown','exile','unwritten'].filter(id=>book[id]).length} / 4 页已写下</h2><div class="ending-pages">${hints.map(h=>{const earned=book[h.id];return `<article class="ending-page ${earned?'earned':'locked'} ending-${h.id}"><span class="eyebrow">${earned?'已经历':'未写下'}</span><h3>${safe(earned?.title||'仍有另一种结局')}</h3><p>${safe(earned?(earned.lines||[]).join(' '):h.hint)}</p></article>`;}).join('')}</div><p class="quiet-summary">结局只留下记忆。新一局从相同的力量开始。</p><button class="primary-button" data-action="close-book">回到故事</button></div>`;}
  function endingPanel(){const ending=game.getEnding?.(),win=!!ending;rememberEnding();return `<div class="panel ending-panel ${ending?'ending-'+safe(ending.id):''}"><span class="eyebrow">${win?'你的选择，写成了这一页':'灰烬之中 · 故事尚未结束'}</span><h2>${safe(ending?.title||'重整旗鼓')}</h2><div class="story-lines">${(ending?.lines||['黑潮尚未退去。用震击撕开包围，或用冲撞离开危险。']).map(l=>`<p>${safe(l)}</p>`).join('')}</div>${(ending?.witnesses||[]).map(t=>`<div class="end-testimony"><b>${safe(t.name||'见证')}</b>${safe(t.text||t)}</div>`).join('')}<div class="button-row">${!win&&game.checkpoint?'<button class="primary-button" data-action="retry">保留构筑 · 重试决战</button>':''}<button class="${win?'primary-button':'secondary-button'}" data-action="restart">重新写一个故事</button><button class="secondary-button" data-action="book">查看结局册</button></div></div>`;}
  function helpPanel(){const saved=readScenes();return `<div class="panel help-panel"><span class="eyebrow">灰烬与誓约 · 随时回看</span><h2>操作与见闻</h2><div class="help-list"><p><kbd>W A S D</kbd> / 方向键移动；鼠标瞄准，<kbd>左键</kbd> 喷火。<br><kbd>Q</kbd> / 右键震击，<kbd>空格</kbd> 冲撞。<br><kbd>E</kbd> 截住报信或操作附近道具。<br>织火：单击布种，<kbd>F</kbd> 引爆；其他质变的操作显示在技能栏。<br><kbd>1 / 2 / 3</kbd> 选强化；<kbd>Esc</kbd> 暂停。</p><div class="help-causal"><b>见到攻击 → 一个方向色块 → 送达</b><p>同色成长方向的候选更常出现，同时勇者得知真实打法。<br>默认让他走；追上按 E 截信，两种影响都不会增加。勇者根据收到的情报准备，不保证某一项反制。</p></div><p>击倒战斗敌人获得经验，每次战斗升级都选一次强化。第 6 次战斗升级保证出现首次质变候选，选中才获得。每夜结束再额外选一份奖励；第三夜黎明前，勇者带着真正送达的见闻而来。</p></div><label class="scene-preference"><input id="auto-skip-scenes" type="checkbox" ${saved.autoSkipSeen?'checked':''}> 重玩自动跳过已读剧情</label><p class="quiet-summary">仅跳过相同剧情、分支和版本；未见分支仍完整呈现。</p><div class="button-row"><button class="primary-button" data-action="close-help">返回</button><button class="secondary-button" data-action="codex-open">图鉴与地图</button><button class="secondary-button" data-action="tutorial-replay">重新查看见闻教学</button></div></div>`;}
  function updatePanel(force=false){
    Codex.update(game,V,activeScene()?.currentBeat);
    const scene=activeScene(),tutorial=activeTutorial(),key=`${codexOpen}|${codexTab}|${codexSelected}|${Codex.state(game).revision}|${game.phase}|${paused}|${helpOpen}|${endingBookOpen}|${game.night}|${game.campaignStory?.stage}|${game.getEnding?.()?.id}|${game.combatGrowthCount}|${game.rewardCount}|${game.choicePage?.keys?.join(',')}|${game.choicePage?.guaranteedQuality}|${scene?.key}|${scene?.beatIndex}|${tutorial?.id}`;
    const cinematic=!!scene&&!helpOpen&&!endingBookOpen&&!codexOpen;$('arena').classList.toggle('cinematic',cinematic);document.querySelector('.shell').classList.toggle('cinematic',cinematic);$('overlay').classList.toggle('scene-overlay',cinematic);
    $('overlay').classList.toggle('codex-overlay',codexOpen);$('arena').classList.toggle('awakening',scene?.currentBeat?.cinematic==='awakening');$('overlay').classList.toggle('title-overlay',game.phase==='intro'&&!helpOpen&&!endingBookOpen&&!codexOpen);document.querySelector('.shell').classList.toggle('at-title',game.phase==='intro');
    const guiding=!codexOpen&&!helpOpen&&!endingBookOpen&&(!!scene?.currentBeat?.guide||!!tutorial&&!paused);
    $('arena').classList.toggle('teaching',guiding);$('overlay').classList.toggle('guide-overlay',!!scene?.currentBeat?.guide&&!helpOpen&&!endingBookOpen&&!codexOpen);$('overlay').classList.toggle('prologue-overlay',!!scene?.currentBeat?.illustration&&!helpOpen&&!endingBookOpen&&!codexOpen);$('overlay').classList.toggle('tutorial-overlay',!!tutorial&&!helpOpen&&!endingBookOpen&&!codexOpen&&!paused&&!scene);
    if(key===panelKey&&!force)return;panelKey=key;const overlay=$('overlay');
    if(codexOpen){overlay.innerHTML=codexPanel();paintCodex();return;}
    if(helpOpen){overlay.innerHTML=helpPanel();return;}
    if(endingBookOpen){overlay.innerHTML=bookPanel();return;}
    if(scene){overlay.innerHTML=scenePanel(scene);return;}
    if(tutorial&&!paused){overlay.innerHTML=tutorialPanel(tutorial);return;}
    if(paused&&combat()){overlay.innerHTML='<div class="panel"><span class="eyebrow">灰烬纪事 · 暂停</span><h2>暂停</h2><div class="button-row"><button class="primary-button" data-action="resume">继续游戏</button><button class="secondary-button" data-action="help">设置与操作</button><button class="secondary-button" data-action="codex-open">图鉴与地图</button><button class="secondary-button" data-action="restart">重新开始</button></div></div>';return;}
    if(game.phase==='intro'){overlay.innerHTML=`<div class="title-panel epic-title"><div class="title-copy"><span class="eyebrow">THE UNWRITTEN NAME · 钟下未竟之名</span><div class="title-name">他们说<br>我是<em>魔王</em></div><p class="quote">第三夜黎明前，勇者将来取你的命。<br>有人在七天前，给你写好了一封罪状。</p><div class="button-row"><button class="primary-button" data-action="start">开始完整故事</button><button class="secondary-button" data-action="book">结局册</button><button class="secondary-button" data-action="help">操作</button></div><div class="title-controls">三夜成长 · 勇者决战 · 四种结局<br>WASD 移动 · 鼠标瞄准 · 左键攻击</div><span class="title-version">v0.12.1 · 燃烧音效调整</span></div></div>`;return;}
    if(['upgrade','reward'].includes(game.phase)){overlay.innerHTML=choicePanel();return;}
    if(game.phase==='interlude'){overlay.innerHTML=interludePanel();return;}
    if(['victory','epilogue','ending','defeat'].includes(game.phase)){overlay.innerHTML=endingPanel();return;}
    overlay.innerHTML='';
  }
  function updateHUD(){
    const p=game.player,goal=game.storyObjective?.(),report=game.activeReport?.(),status=game.reportStatus?.(),growth=game.growthStatus(),wave=game.waveStatus();
    $('health-number').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;$('health-fill').style.width=`${p.hp/p.maxHp*100}%`;
    $('energy-number').textContent=`${Math.floor(p.energy)} / ${p.maxEnergy}`;$('energy-fill').style.width=`${p.energy/p.maxEnergy*100}%`;
    $('growth-label').textContent=`Lv ${growth.level}`;$('growth-number').textContent=`${Math.floor(growth.xp)} / ${growth.nextXP}`;$('growth-fill').style.width=`${clamp(growth.progress*100,0,100)}%`;
    $('growth-directions').innerHTML=Object.entries(DIRECTIONS).map(([kind,d])=>`<span class="direction-point ${causalCue?.state==='delivered'&&causalCue.kind===kind&&causalCue.until>game.totalTime?'received':''}" style="--direction:${d.color}" title="${d.name}成长方向点"><i>${d.mark}</i><b>${game.rumors[kind]||0}</b></span>`).join('');
    $('fire-name').textContent=game.path?TERMS[{dragon:'FQ01',field:'FQ02',chain:'FQ03'}[game.path]].name:'炎息';
    $('fire-ready').textContent=p.extinguished?p.fireHeld?'松开恢复':p.energy>=p.maxEnergy*.3?'可重燃':'恢复中':p.fireHeld?'消耗中':p.energy<p.maxEnergy?'恢复中':'就绪';
    $('fire-skill').querySelector('kbd').textContent=game.path==='field'?'左键 / F':'左键';
    const seeds=game.fields.filter(f=>f.state==='seed').length;$('field-hud').classList.toggle('hidden',game.path!=='field'||!combat());$('field-hud').textContent=`F 引爆 ${seeds} 枚 · 火场半径 ${Math.round(game.flameStats().fieldRadius)} · 数量不限`;
    if(game.path==='field'&&!p.extinguished)$('fire-ready').textContent=p.fieldCooldown>0?'布种冷却':p.energy<16?'炎息不足':'16 / 枚';
    $('roar-name').textContent=game.ranks.SQ03?'敕令审判':game.ranks.SQ02?'惊惧化形':game.ranks.SQ01?'回声王冠':'震慑吼声';$('dash-name').textContent=game.ranks.MQ03?'天坠魔躯':game.ranks.MQ02?'回返魔躯':game.ranks.MQ01?'裂地冲撞':'蛮力冲撞';
    $('roar-tip').textContent=game.ranks.SQ03?'短按命中必积印 · 长按审判':game.ranks.SQ02?'震击唤出恐影':game.ranks.SQ01?'错时双波':'近圈伤害';$('dash-tip').textContent=game.ranks.MQ03?'长按松开 · 天坠':game.ranks.MQ02?'再次短按空格 · 回返' :game.ranks.MQ01?'冲撞 + 裂地':'撞击 / 破坏障碍';
    $('roar-ready').textContent=game.ranks.SQ03&&p.roarCharge>0?(p.judgementCooldown>0?`审判 ${p.judgementCooldown.toFixed(1)}秒`:'松开审判'):p.roarCooldown>0?`${p.roarCooldown.toFixed(1)}秒`:'就绪';$('dash-ready').textContent=p.returnTrail?.ready?`回返 ${p.returnTrail.life.toFixed(1)}秒`:`${p.dashCharges} / ${p.dashMax}`;
    const stage=game.campaignStory?.stage,defense=stage==='defense',boss=game.phase==='boss';
    $('chapter-label').textContent=game.phase==='intro'?'灰烬与誓约':defense?'终章 · 共同守护':boss?'终章 · 黎明决战':game.phase==='resolution'?'终章 · 改写誓约':`第 ${game.night} 夜 · ${['','告示之夜','裂缝之夜','未写之夜'][game.night]||'灰烬纪事'}`;
    $('objective-label').textContent=game.phase==='intro'?'写下属于你的结局':goal?.title||(boss?'击破勇者的誓约':wave.nightReady?'敌军已退 · 可收尾或继续探索':wave.state==='pause'?'战斗间隙 · 见闻正在远行':'守住眼前这一波');
    $('scene-intel').classList.toggle('hidden',game.phase==='intro');$('scene-intel').classList.toggle('in-boss',boss&&!defense);$('scene-goal').textContent=defense?'⚔ 共同守护':boss?`勇者 · 第 ${game.hero?.stage||1} 阶段`:game.phase==='resolution'?'E · 选择你的行动':wave.nightReady?'✓ 本夜清场':wave.state==='pause'?'◷ 间隙':`⚔ ${wave.index} / ${wave.total}`;
    $('scene-reports').innerHTML=report?`<i class="courier-colour" style="background:${DIRECTIONS[report.report.kind].color}">${DIRECTIONS[report.report.kind].mark}</i><span>⇢ ${safe(status?.stageName||'赶路')}</span>`:'◇';$('scene-legend').textContent=report?'默认放行 · E 截信':game.campaignStory?.courier&&!game.campaignStory.courier.delivered?'▤ 两封信正在送出':`◉ ${game.stats.delivered}`;
    const props=game.scenePropsView?.({aim})||[],prop=props.find(p=>p.outlined),hovered=game.entities.filter(e=>!e.gone&&distance(e,aim)<32).sort((a,b)=>distance(a,aim)-distance(b,aim))[0];
    const info=hovered?.paperCourier?'两封信 · 正在送往北方驿站':(prop?.tip||prop?.text||hovered?.report)?prop?.tip||prop?.text||'E 截信：不增加成长偏向，也不送出这封情报':hovered?.storyActor==='lian'?'黎安':hovered&&hovered.type!=='storyActor'?`${Math.ceil(hovered.hp)} / ${hovered.maxHp}`:'';
    $('target-info').classList.toggle('hidden',!info||!combat());$('target-info').textContent=info;
    $('growth-cue').classList.toggle('hidden',!abilityCue||abilityCue.until<=game.totalTime||!combat());$('growth-cue').textContent=abilityCue?.text||'';
    $('causal-cue').classList.toggle('hidden',!causalCue||causalCue.until<=game.totalTime||!combat());
    if(causalCue){const d=DIRECTIONS[causalCue.kind]||DIRECTIONS.flame,cut=causalCue.state==='intercepted',sent=causalCue.state==='delivered',names=traitNames(causalCue.newTraits);
      $('causal-cue').style.setProperty('--direction',d.color);$('causal-cue').innerHTML=`<strong>${d.name}见闻${cut?'已截住':sent?'已送达':'准备送出'}${causalCue.count>1?' ×'+causalCue.count:''}</strong><small>${cut?'成长偏向与这封勇者情报都未增加。':sent?'成长更偏向'+d.name+'。勇者'+(names?'新增情报：'+safe(names)+'。':'收到重复见闻，没有新打法。'):'默认让他走；追上按 E 可以截信。'}</small>`;}
    const bs=game.bossStatus?.(),h=game.hero;$('timer-label').textContent=game.phase==='intro'?'—':defense?`${Math.ceil(Math.max(0,24-(game.campaignStory?.defense?.time||0)))}″`:boss?'Ⅲ':game.phase==='resolution'?'—':`${Math.ceil(Math.max(0,game.nightLength()-game.time))}″`;$('timer-caption').textContent=activeScene()||activeTutorial()?'世界暂停':defense?'守住钟坛':boss?'誓约决战':game.phase==='resolution'?'结局由你完成':`第 ${game.night} 夜战斗`;
    $('boss-hud').classList.toggle('hidden',!boss||defense||!h||h.hp<=0);if(h){$('boss-name').textContent=`誓约勇者 · 第 ${h.stage||1} 阶段`;$('boss-fill').style.width=`${Math.max(0,h.hp/h.maxHp*100)}%`;$('boss-action').textContent=h.state==='windup'?'红色预警 · 立即闪避':h.state==='recover'?'攻击间隙':'观察你的打法';$('boss-preparations').innerHTML=(h.preps||[]).map(k=>`<span class="preparation" title="${safe(PREPARATIONS[k]?.description||'')}">${safe(PREPARATIONS[k]?.name||k)}</span>`).join('');}
    const quotes={flame:'送达的火焰见闻增加火焰候选权重。',fear:'送达的震慑见闻增加震慑候选权重。',force:'送达的魔躯见闻增加魔躯候选权重。'};
    for(const kind of Object.keys(DIRECTIONS)){const n=game.rumors[kind]||0;$(kind+'-count').textContent=n;$(kind+'-dots').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('');$(kind+'-quote').textContent=quotes[kind];}
    $('hero-personality').textContent=game.hero?'勇者带着两项实际准备而来':'未来的勇者只能根据送达见闻准备';$('hero-intel').textContent='勇者根据真正送达的打法选择两项准备；重复消息不会凭空增加新打法。';$('hero-clues').innerHTML=(game.hero?.preps||[]).map(k=>`<span title="${safe(PREPARATIONS[k]?.description||'')}">${safe(PREPARATIONS[k]?.name||k)}</span>`).join('');
    $('build-list').innerHTML=Object.keys(TERMS).filter(k=>game.ranks[k]).map(k=>`<span style="--direction:${DIRECTIONS[TERMS[k].dir].color}">${TERMS[k].quality?'◆ ':''}${TERMS[k].name} ${game.ranks[k]}</span>`).join('')||'<span>尚未选择强化</span>';$('witness-log').innerHTML=[...(game.messages.sent||[]).slice(-9).reverse().map(m=>({text:DIRECTIONS[m.kind].name+'见闻：勇者得知'+traitNames(m.traits)+'。'})),...game.log].slice(0,15).map(l=>`<p>${safe(l.text)}</p>`).join('');
    $('retreat-button').classList.toggle('hidden',!game.d12NightReady||game.phase!=='raid');$('retreat-button').disabled=!!activeTutorial()||!!activeScene();$('retreat-button').textContent=report?'收尾（未送达消息将中止）':'敌军已退 · 结束本夜';
    $('pause-button').disabled=codexOpen||!combat()||journalOpen||endingBookOpen||!!activeScene()||!!activeTutorial();$('pause-button').textContent=paused?'继续':'暂停';$('sound-button').textContent=muted?'声音 关':'声音 开';
    if(game.night!==1||game.campaignStory?.flags.doorHelped)doorPractice=false;let hint=doorPractice?'靠近侧门 · 朝向门闩 · 短按空格冲撞':'';if(combat()){if(prop?.outlined&&prop.interact&&distance(p,{x:prop.x+(prop.w||0)/2,y:prop.y+(prop.h||0)/2})<100)hint=prop.tip||prop.text;else if(report&&distance(p,report)<80)hint='E · 截信';else if(goal&&!goal.completed&&distance(p,goal)<(goal.r||80))hint=goal.hint||goal.title;}
    $('interaction-hint').classList.toggle('hidden',!hint);$('interaction-hint').textContent=hint;updatePanel();
  }
  function clearInput(){keys.clear();pressed.clear();firing=false;rightHeld=false;placePressed=false;if(game.clearActionInput){game.clearActionInput();return;}const p=game.player;p.fireHeld=false;p.igniteHeld=false;p.roarHeld=false;p.dashHeld=false;p.roarCharge=0;p.dashCharge=0;p.dashChargeMode=null;p.fireActive=false;p.breathTime=0;p.heatInterrupted=true;p.idleTime=0;p.igniteQueued=false;p.returnQueued=false;}
  function focusGame(){if(!codexOpen&&combat()&&!helpOpen&&!paused&&!journalOpen&&!endingBookOpen&&!activeScene()&&!activeTutorial())canvas.focus({preventScroll:true});}
  function setJournal(open){if(codexOpen)closeCodex();if(open){endingBookOpen=false;helpOpen=false;}journalOpen=open;clearInput();$('chronicle').classList.toggle('hidden',!open);$('journal-button').setAttribute('aria-expanded',String(open));updateHUD();if(!open)focusGame();}
  function restart(){codexOpen=false;codexSelected=null;doorPractice=false;game=new ActiveGame();game.setScenePreferences?.(readScenes());game.setTutorialPreferences(readTutorials());noticeQueue.length=0;paused=false;helpOpen=false;endingBookOpen=false;abilityCue=null;reportHint=false;guideUntil=0;causalCue=null;sceneVisualTime=0;visualBeatKey='';$('courier-guide').classList.add('hidden');setJournal(false);clearInput();particles=[];floats=[];shake=0;panelKey='';$('toast-stack').innerHTML='';updateCamera(1,true);updateHUD();}
  function openHelp(){if(codexOpen)closeCodex();endingBookOpen=false;journalOpen=false;$('chronicle').classList.add('hidden');$('journal-button').setAttribute('aria-expanded','false');pausedBeforeHelp=paused;helpOpen=true;clearInput();updatePanel(true);}
  function togglePause(){if(codexOpen||!combat()||journalOpen||endingBookOpen||activeScene())return;paused=!paused;clearInput();updatePanel(true);focusGame();}
  function setBook(open){if(codexOpen)closeCodex();endingBookOpen=open;if(open){journalOpen=false;helpOpen=false;$('chronicle').classList.add('hidden');$('journal-button').setAttribute('aria-expanded','false');}clearInput();updatePanel(true);if(!open)focusGame();}
  function advanceScene(skip=false){clearInput();const scene=activeScene();if(!scene)return;const result=skip?game.sceneSkip?.():game.sceneAdvance?.();if(result?.completed||result?.skipped){const saved=readScenes();saved.seenKeys=[...new Set([...saved.seenKeys,result.key])];saveScenes(saved);}sceneVisualTime=0;visualBeatKey='';consumeEvents();updateHUD();focusGame();}
  $('overlay').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;wakeAudio();clearInput();switch(b.dataset.action){case'codex-open':openCodex();break;case'codex-close':closeCodex();break;case'codex-tab':codexTab=b.dataset.id==='map'?'map':'entries';updatePanel(true);break;case'codex-select':if(Codex.state(game).known.includes(b.dataset.id))codexSelected=b.dataset.id;updatePanel(true);break;case'codex-track':Codex.track(game,Codex.state(game).tracked===b.dataset.id?null:b.dataset.id);updatePanel(true);break;case'codex-location':{const entry=Codex.known(game).find(e=>e.location===b.dataset.id);openCodex('map',entry?.id);break;}case'start':game.setScenePreferences?.(readScenes());game.setTutorialPreferences(readTutorials());game.start();updateCamera(1,true);break;case'upgrade':game.chooseUpgrade(b.dataset.key);break;case'continue':game.continue();updateCamera(1,true);break;case'retry':game.retryBoss();paused=false;updateCamera(1,true);break;case'book':setBook(true);break;case'close-book':setBook(false);break;case'restart':restart();break;case'resume':paused=false;break;case'help':openHelp();break;case'close-help':helpOpen=false;paused=pausedBeforeHelp;break;case'tutorial-next':game.acknowledgeTutorial();clearInput();break;case'tutorial-replay':game.replayTutorials();saveTutorials();helpOpen=false;paused=false;break;case'guide-practice':doorPractice=true;advanceScene();break;case'guide-later':doorPractice=false;advanceScene();break;case'scene-next':advanceScene();break;case'scene-skip':advanceScene(true);break;}consumeEvents();updateHUD();focusGame();});
  $('overlay').addEventListener('change',e=>{if(e.target.id==='auto-skip-scenes'){const saved=readScenes();saved.autoSkipSeen=e.target.checked;saveScenes(saved);updatePanel(true);}});
  $('minimap').addEventListener('click',()=>openCodex('map'));$('minimap').addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();openCodex('map');}});
  $('retreat-button').addEventListener('click',()=>{clearInput();game.endNightEarly();consumeEvents();updateHUD();});
  $('ending-book-button').addEventListener('click',()=>setBook(!endingBookOpen));
  $('journal-button').addEventListener('click',()=>setJournal(!journalOpen));$('close-journal').addEventListener('click',()=>setJournal(false));$('dismiss-courier-guide').addEventListener('click',()=>{$('courier-guide').classList.add('hidden');focusGame();});
  $('sound-button').addEventListener('click',()=>{wakeAudio();muted=!muted;try{localStorage.setItem('demon-demo-muted',muted?'1':'0');}catch(_){}updateHUD();focusGame();});$('pause-button').addEventListener('click',togglePause);$('help-button').addEventListener('click',openHelp);
  window.addEventListener('keydown',e=>{const code=gameKey(e);if(!code)return;if(e.target?.matches?.('input,textarea,select')||e.target?.closest?.('button,a')&&['Enter','Space'].includes(code))return;e.preventDefault();if(e.repeat)return;
    if(code==='Escape'){if(codexOpen)closeCodex();else if(endingBookOpen)setBook(false);else if(journalOpen)setJournal(false);else if(helpOpen){helpOpen=false;paused=pausedBeforeHelp;updatePanel(true);focusGame();}else togglePause();return;}
    if(codexOpen||helpOpen||paused||journalOpen||endingBookOpen)return;
    if(activeTutorial()){if(code==='Enter'){game.acknowledgeTutorial();clearInput();consumeEvents();updateHUD();focusGame();}return;}
    if(activeScene()){if(code==='KeyE'||code==='Enter'){if(activeScene().currentBeat?.guide)doorPractice=true;advanceScene();}return;}
    if(['upgrade','reward'].includes(game.phase)&&/^Digit[123]$/.test(code)){game.chooseUpgrade(game.getChoices()[Number(code.slice(-1))-1]);clearInput();consumeEvents();updateHUD();focusGame();return;}
    if(!combat())return;keys.add(code);pressed.add(code);
  },true);
  window.addEventListener('keyup',e=>{const code=gameKey(e);if(code){e.preventDefault();keys.delete(code);}},true);
  function updateAim(e){const rect=canvas.getBoundingClientRect();cursor={x:(e.clientX-rect.left)/rect.width*W,y:(e.clientY-rect.top)/rect.height*H};aim={x:cursor.x+camera.x,y:cursor.y+camera.y};}
  canvas.addEventListener('pointermove',updateAim);canvas.addEventListener('pointerdown',e=>{e.preventDefault();focusGame();wakeAudio();updateAim(e);if(codexOpen||paused||helpOpen||journalOpen||endingBookOpen||activeScene()||activeTutorial()||!combat())return;if(e.button===0){firing=true;placePressed=true;}if(e.button===2){pressed.add('KeyQ');rightHeld=true;}});
  window.addEventListener('pointerup',e=>{if(e.button===0)firing=false;if(e.button===2)rightHeld=false;});canvas.addEventListener('pointercancel',clearInput);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('blur',()=>{clearInput();if(combat()){paused=true;updatePanel(true);}});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(combat()){paused=true;updatePanel(true);}}});
  function updateGuideFocus(){
    const scene=activeScene(),t=activeTutorial(),guide=scene?.currentBeat?.guide,overlay=$('overlay'),focus=overlay.querySelector('.guide-focus');if(!focus)return;
    const bounds=overlay.getBoundingClientRect(),cw=bounds.width,ch=bounds.height;let x,y,w,h,label;
    const worldBox=(p,width,height)=>{x=(p.x-camera.x-width/2)/W*cw;y=(p.y-camera.y-height*.75)/H*ch;w=width/W*cw;h=height/H*ch;};
    if(guide){worldBox(guide,190,120);label='侧门 · 空格冲撞';}
    else if(t?.id==='report-created'){const e=game.activeReport?.()||game.player;worldBox(e,110,170);label='传信人 · 方向色块';}
    else if(t?.id==='delivered'){const hud=$('growth-directions').getBoundingClientRect();x=hud.x-bounds.x-8;y=hud.y-bounds.y-8;w=hud.width+16;h=hud.height+16;label='送达后，这个方向点增加';}
    else if(t?.id==='intercepted'){const hud=$('scene-intel').getBoundingClientRect();x=hud.x-bounds.x-5;y=hud.y-bounds.y-5;w=hud.width+10;h=hud.height+10;label='当前消息已中止';}
    else{worldBox(game.player,145,160);label='质变已获得 · 留意新操作';}
    w=Math.min(w,cw-16);h=Math.min(h,ch-16);x=clamp(x,8,cw-w-8);y=clamp(y,25,ch-h-8);
    const set=(selector,left,top,width,height)=>{const el=overlay.querySelector(selector);if(el)Object.assign(el.style,{left:left+'px',top:top+'px',width:Math.max(0,width)+'px',height:Math.max(0,height)+'px'});};
    set('.guide-top',0,0,cw,y);set('.guide-left',0,y,x,h);set('.guide-right',x+w,y,cw-x-w,h);set('.guide-bottom',0,y+h,cw,ch-y-h);set('.guide-focus',x,y,w,h);focus.querySelector('.focus-caption').textContent=label;
    // Leave the highlighted object exposed; teaching text occupies the other side.
    const panel=overlay.querySelector('.guide-panel');if(panel&&cw>600){panel.style.left=x>cw*.55?'14px':'auto';panel.style.right=x>cw*.55?'auto':'14px';}
  }
  function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;const scene=activeScene(),beatKey=scene?`${scene.key}:${scene.beatIndex}`:'';
    if(beatKey!==visualBeatKey){visualBeatKey=beatKey;sceneVisualTime=0;clearInput();}if(scene&&!codexOpen&&!helpOpen&&!endingBookOpen&&!journalOpen)sceneVisualTime+=dt;
    if(!codexOpen&&!paused&&!helpOpen&&!journalOpen&&!endingBookOpen&&!scene&&!activeTutorial()&&combat()){accumulator+=dt;let n=0;while(accumulator>=1/60&&n++<4){const input={aim,mx:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),my:Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp')),fire:firing,placePressed,ignite:pressed.has('KeyF'),roarPressed:pressed.has('KeyQ'),roarHeld:keys.has('KeyQ')||rightHeld,dashPressed:pressed.has('Space'),dashHeld:keys.has('Space'),interact:keys.has('KeyE'),interactPressed:pressed.has('KeyE')};game.tick(1/60,input);pressed.clear();placePressed=false;accumulator-=1/60;if(!combat()||activeTutorial()||activeScene()){clearInput();break;}}
      particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);floats.forEach(f=>{f.y-=23*dt;f.life-=dt;});floats=floats.filter(f=>f.life>0);shake=Math.max(0,shake-dt*17);if(game.player.fireActive&&now-lastFireSound>145){combatSound.play(audio,'fire-loop',muted);lastFireSound=now;}
    }else accumulator=0;
    consumeEvents();for(const cue of FX.drainSounds(game)){combatSound.play(audio,cue.kind,muted);if(cue.kind==='force-hit')shake=Math.max(shake,2);}updateNotice();if(guideUntil&&game.totalTime>guideUntil)$('courier-guide').classList.add('hidden');updateCamera(dt);drawWorld();hudTimer+=dt;if(hudTimer>.09){updateHUD();hudTimer=0;}updatePanel();updateGuideFocus();requestAnimationFrame(frame);
  }
  game.setScenePreferences?.(readScenes());game.setTutorialPreferences(readTutorials());
  if(new URLSearchParams(location.search).has('debug'))window.demo={get game(){return game;},get camera(){return{...camera};},get aim(){return{...aim};},get sceneVisualTime(){return sceneVisualTime;},get codex(){return {open:codexOpen,tab:codexTab,selected:codexSelected,...JSON.parse(JSON.stringify(Codex.state(game)))}},refresh(){updateCamera(1,true);consumeEvents();updateHUD();drawWorld();},step(seconds,input={}){const n=Math.round(seconds*60);for(let i=0;i<n;i++)game.tick(1/60,input);consumeEvents();updateCamera(1,true);updateHUD();drawWorld();},pause(value){paused=value;clearInput();updatePanel(true);},restart,advanceScene,scenePreferences:readScenes};
  updateCamera(1,true);updateHUD();drawWorld();requestAnimationFrame(frame);
})();
