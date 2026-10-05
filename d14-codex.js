/* The field guide only records knowledge. Reading it never completes a story action. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DemonCodex=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const entries=[
    {id:'bell',name:'圣钟',location:'bell',near:true,background:'圣钟立在村中央。钟芯给村外的护阵供能，让黑潮留在村界之外。九天前，钟芯在修复时破裂。',use:'圣钟将钟芯的魔力送往村界，维持护阵。'},
    {id:'execution',name:'处刑架',location:'execution',near:true,background:'处刑架搭在钟坛南侧。今晨，王庭命勇者在三日后的黎明前完成处决。你在当晚醒来。',use:'你在这里醒来。架旁的告示记着处决的日期。'},
    {id:'side-door',name:'钟坛侧门',location:'side-door',near:true,background:'这扇门通往钟坛南面的街道。塌下的门闩挡住了负伤守卫的去路。',use:'第一夜朝门闩短按空格冲撞，可以打开侧门，让守卫去东边的包扎棚包扎。'},
    {id:'infirmary',name:'包扎棚',location:'infirmary',near:true,background:'村民在东边的空地搭起包扎棚，照看黑潮和战事中的伤员。',use:'负伤守卫获救后去这里包扎。包扎棚也是辨认村落东侧的地标。'},
    {id:'scribe',name:'抄写台',location:'scribe',near:true,background:'黎安在村子西南的旧屋里替村民写信。桌上放着纸墨，也保存着寄往王庭的信件抄本。',use:'黎安在这里写信、盖印，保存寄出书信的抄本。'},
    {id:'mill',name:'旧磨坊',location:'mill',near:true,background:'村南河岸的磨坊已经停工，里面可以暂避风雨。',use:'磨坊位于抄写台以南，靠近南门。'},
    {id:'post',name:'北方驿站',location:'post',near:true,background:'驿站在村北的道路尽头。战况消息与村民的书信从这里送往王庭和勇者营地。',use:'战斗见闻送达后，影响强化方向和勇者的备战。'},
    {id:'south-gate',name:'南门',location:'south-gate',near:true,background:'南门通往村外的河岸道路。麦田和磨坊都在这条路旁。',use:'若决定带村民离开，到南门集合，等同行的人跟上。'},
    {id:'letters',name:'两封信',location:'scribe',background:'求援信请求王庭修钟。指控信却把黑潮造成的伤亡写成魔王袭村。两封信留有不同的日期。',use:'核对抄本后，由送信人带到驿站。信还在路上时，勇者尚未读到。'},
    {id:'seal',name:'寄信的印章',location:'scribe',background:'寄往王庭的信由黎安誊写、盖印。她保管印章，也保留寄出书信的底稿。',use:'盖有村印的信，会被王庭视为村落正式呈报的消息。'},
    {id:'confession',name:'黎安的认罪书',location:'lian-lock',background:'黎安承认自己改写了指控信，用魔王袭村的消息换取援军。她把改过的内容和日期写下，并签了名字。',use:'认罪书由你收下。救出黎安不等于替她抹去责任，她仍须向村民说明事实。'},
    {id:'witness-lock',name:'见证锁',location:'lian-lock',background:'旧祭仪将首位指认魔王的人也锁在钟旁。黎安作为指认者，被留在这里等待祭仪。',use:'第三夜靠近黎安按住 E，可以解开锁。解锁后，她才能参与之后的救援和撤离。'},
    {id:'supply-plan',name:'供能草图',location:'supply-east',background:'钟匠提出在旧护阵的东西两侧接入临时供能箱，尝试由不同的人分别供能。这条路尚未经过黑潮检验。',use:'勇者收到两封信和守卫证言，且黎安获救后，才能商议共同守护。到东侧供能箱接稳线路，再守住黑潮。'}
  ];
  const byId=Object.fromEntries(entries.map(e=>[e.id,e]));
  const completedDiscoveries={prologue:['bell'],opening:['execution','side-door'], 'side-door':['infirmary'], 'second-night':['scribe','seal'], original:['letters'], 'third-night':['confession','witness-lock'],'witness-lock':['supply-plan']};
  function state(game){return game.d14Codex||(game.d14Codex={known:[],tracked:null,revision:0});}
  function update(game,layout,beat){
    const s=state(game),add=id=>{if(byId[id]&&!s.known.includes(id)){s.known.push(id);s.revision++;}};
    for(const id of beat?.discover||[])add(id);
    for(const h of game.campaignStory?.history||[])for(const id of h.discoveries||completedDiscoveries[h.id]||[])add(id);
    if(['raid','boss','resolution'].includes(game.phase))for(const e of entries){const p=layout.locations[e.location];if(e.near&&p&&Math.hypot(p.x-game.player.x,p.y-game.player.y)<200)add(e.id);}
    return s;
  }
  function known(game){const s=state(game);return entries.filter(e=>s.known.includes(e.id));}
  function track(game,id){const s=state(game);if(id!==null&&!s.known.includes(id))return false;s.tracked=id;s.revision++;return true;}
  function target(game,layout){const id=state(game).tracked,e=byId[id],p=e&&layout.locations[e.location];return p?{...p,title:e.name,tracked:true}:null;}
  function status(game,id){const f=game.campaignStory?.flags||{};if(id==='letters')return f.heroReadOriginal?'勇者已读两封信':f.originalSent?'两封信已到驿站，等待勇者核对':game.campaignStory?.courier?'两封信正在送往驿站':f.letterRead?'已核对，等待送信人出发':'尚未核对两封信';if(id==='side-door')return f.doorHelped?'侧门已打开':'侧门尚未打开';if(id==='witness-lock')return f.lianFreed?'黎安已经获救':'黎安仍被锁在钟旁';return '';}
  function markers(game){
    const out=[];
    for(const e of game.entities||[]){if(e.gone||e.hp<=0)continue;let kind='enemy',color='#dc786e';
      if(e.paperCourier){kind='paper';color='#f4e8c9';}
      else if(e.report){kind='report';color={flame:'#ee9563',fear:'#b89dd6',force:'#8bbfc7'}[e.report.kind]||'#e8c080';}
      else if(e.campaignActor||e.storyActor||e.protected){kind='person';color='#edd08c';}
      else if(e.type==='villager'||e.type==='civilian'||e.kind==='villager'){kind='villager';color='#9496a8';}
      out.push({x:e.x,y:e.y,kind,color,id:e.id});
    }
    if(game.hero?.hp>0&&!game.hero.gone)out.push({...game.hero,kind:'hero',color:'#fff0b9'});
    if(game.player)out.push({...game.player,kind:'player',color:'#fff7e5'});return out;
  }
  function cluster(items,sx,sy,cell=9){const bins=new Map(),others=[];for(const p of items){if(p.kind!=='enemy'){others.push(p);continue;}const key=Math.floor(p.x*sx/cell)+':'+Math.floor(p.y*sy/cell),b=bins.get(key);if(b){b.x+=p.x;b.y+=p.y;b.count++;}else bins.set(key,{...p,count:1});}return [...bins.values()].map(b=>({...b,x:b.x/b.count,y:b.y/b.count})).concat(others);}
  function drawMap(c,w,h,layout,game,options={}){
    const sx=w/layout.width,sy=h/layout.height,large=!!options.large; c.save();c.clearRect(0,0,w,h);c.fillStyle='#191d2e';c.fillRect(0,0,w,h);c.imageSmoothingEnabled=false;
    for(const r of layout.roads||[]){c.fillStyle='#4c4d59';if(r.points){c.strokeStyle='#4c4d59';c.lineWidth=Math.max(2,(r.width||80)*sx);c.beginPath();r.points.forEach((p,i)=>{const x=(p.x??p[0])*sx,y=(p.y??p[1])*sy;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}else c.fillRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);}
    for(const b of layout.buildings||[]){c.fillStyle='#6c6373';c.fillRect(b.x*sx,b.y*sy,b.w*sx,b.h*sy);}
    const knownLocations=new Set(known(game).map(e=>e.location));
    for(const id of knownLocations){const p=layout.locations[id];if(!p)continue;c.fillStyle='#b19d79';c.fillRect(p.x*sx-2,p.y*sy-2,4,4);if(large){c.font='12px Microsoft YaHei,sans-serif';c.textAlign='center';c.fillStyle='#d5c7ae';c.fillText(p.name,p.x*sx,p.y*sy-9);}}
    const chosen=byId[options.selected||state(game).tracked],loc=chosen&&layout.locations[chosen.location];
    if(loc&&state(game).known.includes(chosen.id)){const b=loc.bounds||{x:loc.x-75,y:loc.y-65,w:150,h:130};c.fillStyle='#ffe1a52b';c.strokeStyle='#ffe1a5';c.lineWidth=2;c.fillRect(b.x*sx,b.y*sy,b.w*sx,b.h*sy);c.strokeRect(b.x*sx,b.y*sy,b.w*sx,b.h*sy);c.beginPath();c.arc(loc.x*sx,loc.y*sy,large?12:7,0,Math.PI*2);c.stroke();}
    if(options.camera){c.strokeStyle='#c8cfdf70';c.lineWidth=1;c.strokeRect(options.camera.x*sx,options.camera.y*sy,1024*sx,688*sy);}
    const sorted=cluster(markers(game),sx,sy,large?11:9).sort((a,b)=>['enemy','villager','person','report','paper','hero','player'].indexOf(a.kind)-['enemy','villager','person','report','paper','hero','player'].indexOf(b.kind));
    for(const p of sorted){const x=Math.round(p.x*sx),y=Math.round(p.y*sy),r=large?4:3;c.fillStyle=p.color;c.strokeStyle='#101423';c.lineWidth=1;
      if(p.kind==='player'){c.beginPath();c.moveTo(x,y-r-2);c.lineTo(x-r-1,y+r);c.lineTo(x+r+1,y+r);c.closePath();c.fill();c.stroke();}
      else if(p.kind==='hero'){c.beginPath();c.moveTo(x-5,y+3);c.lineTo(x-6,y-4);c.lineTo(x-2,y-1);c.lineTo(x,y-6);c.lineTo(x+2,y-1);c.lineTo(x+6,y-4);c.lineTo(x+5,y+3);c.closePath();c.fill();c.stroke();}
      else if(p.kind==='report'||p.kind==='paper'){c.fillRect(x-4,y-3,8,6);c.strokeRect(x-4,y-3,8,6);c.beginPath();c.moveTo(x-4,y-3);c.lineTo(x,y);c.lineTo(x+4,y-3);c.stroke();}
      else if(p.kind==='enemy'){c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();c.fill();if(p.count>1){c.font=(large?11:9)+'px sans-serif';c.textAlign='left';c.fillStyle='#f0a298';c.fillText(String(p.count),x+r+1,y+2);}}
      else if(p.kind==='person'){c.fillRect(x-1,y-4,3,3);c.fillRect(x-3,y,7,4);}
      else c.fillRect(x-1,y-1,2,2);
    }c.restore();
  }
  function entryView(game,id){const source=byId[id];if(!source)return null;const e={...source},s=state(game),f=game.campaignStory||{};
    if(id==='bell'&&f.battleWon)e.use='勇者已败。靠近钟坛的不同目标，可以查看每条路的代价，按住 E 才会作出选择。';
    if(id==='scribe'&&s.known.includes('letters'))e.use='第二夜到桌前按住 E，核对两封信的日期，再请送信人带给勇者。';
    if(id==='post'&&s.known.includes('letters'))e.use+='两封信也必须实际送到这里，勇者才能读到。';
    if(id==='mill'&&(f.history||[]).some(h=>h.id==='night-end'&&h.night===1))e.use+='黎安让你在前两夜战斗结束后到这里藏身，避过白天。';return e;
  }
  function panel(game,layout,tab,selected,escape){
    const list=known(game),e=entryView(game,selected),p=e&&layout.locations[e.location],tracked=state(game).tracked;
    return `<section class="panel codex-panel ${tab==='map'?'codex-map-only':''}"><div class="codex-head"><div><span class="eyebrow">村落手记 · 游戏已暂停</span><h2>图鉴与地图</h2></div><button class="secondary-button" data-action="codex-close">返回 · Esc</button></div><div class="codex-tabs" role="tablist"><button class="secondary-button" role="tab" aria-selected="${tab==='entries'}" data-action="codex-tab" data-id="entries">场景图鉴</button><button class="secondary-button" role="tab" aria-selected="${tab==='map'}" data-action="codex-tab" data-id="map">村落地图</button></div>${e?`<div class="codex-layout"><nav class="codex-list" aria-label="已发现的场景">${list.map(q=>`<button class="codex-item ${q.id===e.id?'selected':''}" data-action="codex-select" data-id="${q.id}">${escape(q.name)}${tracked===q.id?' ◇':''}</button>`).join('')}</nav><article class="codex-copy"><canvas id="codex-thumbnail" class="codex-thumb" width="360" height="126" aria-label="${escape(e.name)}的场景图"></canvas><h3>${escape(e.name)}</h3><h4>来历</h4><p>${escape(e.background)}</p><h4>作用</h4><p>${escape(e.use)}</p>${status(game,e.id)?`<p class="codex-status">${escape(status(game,e.id))}</p>`:''}<p class="codex-note">${escape(p?.zone||'')} · 右图亮框是实地位置</p><button class="secondary-button" data-action="codex-track" data-id="${e.id}">${tracked===e.id?'取消追踪':'在游戏中追踪'}</button></article><div class="codex-map-area"><canvas id="codex-map" class="codex-map" width="650" height="437" aria-label="村落地图，已选地点高亮"></canvas><div class="codex-legend"><span>▲ 你</span><span class="enemy">◆ 敌人（数字为人数）</span><span class="important">♟ 关键人物</span><span class="important">♛ 勇者</span><span class="muted">· 村民</span><span>✉ 传信人 / 两封信</span><span>□ 当前视野</span></div>${tab==='map'?`<p class="codex-note">当前地点：${escape(e.name)} · ${escape(p?.zone||'')}</p><button class="secondary-button" data-action="codex-track" data-id="${e.id}">${tracked===e.id?'取消追踪':'在游戏中追踪'}</button>`:''}</div></div>`:'<p class="codex-empty">你还没有认出村中的地标。听到介绍或走近建筑后，手记会留下记录。</p>'}<p class="codex-note">这里只收录你在本局见过的事物。阅读手记不会代替开门、核对书信或救人的行动。</p></section>`;
  }
  return {entries,byId,state,update,known,track,target,status,markers,cluster,drawMap,panel,entryView};
});
