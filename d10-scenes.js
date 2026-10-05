/* D10 first-night objects and safely paused, branch-aware scenes. No persistence or DOM. */
(function(root,factory){
  const plugin=factory();
  if(typeof module==='object'&&module.exports)module.exports=plugin;
  else{root.DemonD10Scenes=plugin;if(root.DemonDemo&&root.DemonDemo.D10Game)plugin.install(root.DemonDemo.D10Game,root.DemonDemo);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='D10-1';
  function install(D10Game,api){
    if(!D10Game)return;
    api=api||(typeof require==='function'?require('./core.js'):globalThis.DemonDemo);
    const P=D10Game.prototype;if(Object.prototype.hasOwnProperty.call(P,'d10ScenesInstalled'))return D10Game;P.d10ScenesInstalled=true;
    const {distance,clamp}=api,baseStart=P.start,baseTick=P.tick,baseActorDamage=P.damageStoryActor,baseActorTick=P.tickStoryActor;
    const clone=v=>JSON.parse(JSON.stringify(v));
    const centre=p=>({x:p.x+p.w/2,y:p.y+p.h/2});
    const dirOf=kind=>['dash','earth','plunge','return','force'].includes(kind)?'force':['roar','echo','phantom','judgement','fear'].includes(kind)?'fear':'flame';
    P.initD10Scenes=function(){
      this.d10Scene=null;this.d10SceneQueue=[];this.d10ScenePreferences={seenKeys:[],autoSkipSeen:false};this.sceneProps=[];
      this.d10SceneState={openingDone:false,doorOpened:false,doorSceneDone:false,retreating:false,evacuated:false,evacuatedCount:0,alarmRings:0,barrels:0,supports:0,nightEndDone:false,nightEndQueued:false,damageDirection:null,sceneHistory:[],exit:{x:1150,y:1320}};
      if(this.village)this.d10SceneState.exit={x:this.village.locations.infirmary.x,y:this.village.locations.infirmary.y};
      if(this.story){this.story.disabled=true;this.story.flags.escaped=true;}
      this.addD10Props();
    };
    P.addD10Props=function(){
      if(this.sceneProps.length)return;
      const add=(id,kind,x,y,w,h,state='ready',hp=1)=>{
        const prop={id,scenePropId:id,kind,type:'scene-prop',x,y,w,h,r:Math.max(w,h)/2,hp,maxHp:hp,state,active:hp>0};
        this.sceneProps.push(prop);this.solids.push(prop);return prop;
      };
      if(this.village){for(const p of this.village.props)add(p.id,p.kind,p.x,p.y,p.w,p.h,p.state||'ready',p.hp===undefined?1:p.hp);return;}
      add('barrel-west','barrel',1014,774,32,32);add('barrel-east','barrel',1124,784,32,32);
      add('wood-support','support',786,780,28,40);add('fallen-gate','gate',760,840,160,18,'waiting',0);
      add('alarm-bell','alarm',1356,764,28,32);
      add('side-door','side-door',1060,1160,180,18);
      this.solids=this.solids.filter(p=>p.id!=='fence-south');
      this.solids.push({id:'d10-side-west',type:'house',name:'侧门墙',x:1040,y:1080,w:20,h:190,hp:1e9,sceneBarrier:true},
        {id:'d10-side-east',type:'house',name:'侧门墙',x:1240,y:1080,w:20,h:190,hp:1e9,sceneBarrier:true});
    };
    P.spawnD10SceneActors=function(){
      const actor=(key,name,x,y,role)=>{let e=this.entities.find(a=>a.storyActor===key&&!a.gone);if(e)return e;
        e=this.spawn('villager',x,y);Object.assign(e,{type:'storyActor',storyActor:key,name,role,hp:90,maxHp:90,protected:true,d10Actor:true,status:'等待侧门打开'});return e;};
      actor('lian','黎安',1150,980,'誓约抄写员');actor('execution-guard','押送过你的守卫',1230,890,'负伤守卫');
    };
    P.setScenePreferences=function(options={}){
      this.d10ScenePreferences={seenKeys:[...new Set((options.seenKeys||[]).filter(k=>typeof k==='string'))],autoSkipSeen:!!options.autoSkipSeen};
      return clone(this.d10ScenePreferences);
    };
    P.sceneKey=function(id,branch){return VERSION+':'+id+':'+branch;};
    P.requestD10Scene=function(id,branch,beats,title,returnPhase='raid'){
      if(this.d10Scene)return false;
      if(this.choicePage||this.pendingUpgrade){
        if(!this.d10SceneQueue.some(s=>s.id===id&&s.branch===branch))this.d10SceneQueue.push({id,branch,beats:clone(beats),title,returnPhase});
        return {queued:true,id,branch};
      }
      const key=this.sceneKey(id,branch);this.d10Scene={id,branch,version:VERSION,key,title,beatIndex:0,beats:clone(beats),returnPhase};this.phase='story';
      this.emit('scene-start',{id,branch,key,title});
      if(this.d10ScenePreferences.autoSkipSeen&&this.d10ScenePreferences.seenKeys.includes(key))return this.sceneSkip();
      return true;
    };
    P.sceneView=function(){
      if(!this.d10Scene)return null;const scene=clone(this.d10Scene);
      scene.currentBeat=scene.beats[scene.beatIndex];scene.canSkip=this.d10ScenePreferences.seenKeys.includes(scene.key);return scene;
    };
    P.currentD10Scene=P.sceneView;
    P.sceneAdvance=function(){
      if(this.phase!=='story'||!this.d10Scene)return false;
      const scene=this.d10Scene;
      if(scene.beatIndex<scene.beats.length-1){scene.beatIndex++;return {completed:false,key:scene.key};}
      return this.finishD10Scene(false);
    };
    P.sceneSkip=function(){
      if(this.phase!=='story'||!this.d10Scene||!this.d10ScenePreferences.seenKeys.includes(this.d10Scene.key))return false;
      return this.finishD10Scene(true);
    };
    P.finishD10Scene=function(skipped){
      const scene=this.d10Scene;if(!scene)return false;const state=this.d10SceneState;
      if(scene.id==='opening'){
        state.openingDone=true;
        const lian=this.entities.find(e=>e.storyActor==='lian'),guard=this.entities.find(e=>e.storyActor==='execution-guard');
        const lianPoint=this.village?.actors.lianDoor||{x:1118,y:1124},guardPoint=this.village?.actors.guardDoor||{x:1178,y:1122};
        if(lian){lian.x=lianPoint.x;lian.y=lianPoint.y;lian.status='撑住负伤守卫';}
        if(guard){guard.x=guardPoint.x;guard.y=guardPoint.y;guard.status='倚门休息';}
      }else if(scene.id==='side-door'){
        state.doorSceneDone=true;state.retreating=true;
        for(const actor of this.entities.filter(e=>e.d10Actor)){actor.retreating=true;actor.status='沿侧门撤离';}
      }else if(scene.id==='night-end')state.nightEndDone=true;
      state.sceneHistory.push({id:scene.id,branch:scene.branch,key:scene.key});
      this.d10Scene=null;this.phase=scene.returnPhase;
      if(!this.d10ScenePreferences.seenKeys.includes(scene.key))this.d10ScenePreferences.seenKeys.push(scene.key);
      this.emit('scene-complete',{id:scene.id,branch:scene.branch,key:scene.key,seen:true,skipped});
      this.emit('scene-resume',{text:scene.id==='night-end'?'选择本夜奖励':'继续战斗'});
      if(scene.id==='night-end'&&this.finishD10AfterScene)this.finishD10AfterScene();
      return {completed:true,skipped,key:scene.key};
    };
    P.requestD10Opening=function(){
      const beat=(speaker,text,actors=[],focus={x:1030,y:1020})=>({speaker,text,actors,focus});
      return this.requestD10Scene('opening','first-night',[
        beat('讨伐告示','第三日，勇者将在此斩杀魔王。\n落款：七天前。',[{id:'player',action:'bound'}],{x:900,y:930}),
        beat('场景','你还没有醒来，结局已经贴在你的胸口。黎安拖着一名负伤守卫，从行刑队的脚边穿过。',[{id:'lian',action:'drag',from:{x:1150,y:980},to:{x:1118,y:1124}},{id:'execution-guard',action:'dragged',from:{x:1230,y:890},to:{x:1178,y:1122}}],{x:1150,y:1100}),
        beat('守卫','别带我……我刚才，还押着他去行刑。',[{id:'execution-guard',action:'lower-weapon',x:1178,y:1122}],{x:1150,y:1150}),
        beat('黎安','侧门被钉死了。把手搭在我肩上。别睡，门外还有一段路。',[{id:'lian',action:'brace',x:1118,y:1124}],{x:1150,y:1169}),
        beat('黎安','先别死。我还没把所有人送出去。\n她割断你的束带，指了指门后的道路。',[{id:'lian',action:'unlock'},{id:'player',action:'stand'}],{x:960,y:960})
      ],'七日前写好的结局');
    };
    P.requestD10DoorScene=function(dir){
      const opener={flame:'门闩在火焰里断开。',fear:'震击撕开了钉死门框的铁钉。',force:'撞断的木片落在两人脚边。'}[dir];
      return this.requestD10Scene('side-door',dir,[
        {speaker:'场景',text:opener+'守卫先把剑放到地上，再扶着门框站起来。',actors:[{id:'execution-guard',action:'lower-weapon'}],focus:{x:1150,y:1140}},
        {speaker:'守卫',text:'我刚才押着你去行刑。她却把我拖到了这扇门前。',actors:[{id:'execution-guard',action:'listen'}],focus:{x:1160,y:1130}},
        {speaker:'黎安',text:'是我把你的名字签在了告急信上。\n先走。那张纸，我会亲自拿给你看。',actors:[{id:'lian',action:'brace'}],focus:{x:1130,y:1130}},
        {speaker:'场景',text:'她捡起守卫丢下的剑，塞回他空着的鞘里。两人走向门外。\n现在可以继续战斗。',actors:[{id:'lian',action:'retreat',to:{x:1150,y:1320}},{id:'execution-guard',action:'retreat',to:{x:1180,y:1300}}],focus:{x:1150,y:1230}}
      ],'谁签了你的名字');
    };
    P.requestD10NightEnd=function(){
      const state=this.d10SceneState;if(state.nightEndDone||state.nightEndQueued)return false;state.nightEndQueued=true;
      const sent=this.stats.delivered>0,helped=state.doorOpened;
      const branch=(helped?'door-open':'door-closed')+'-'+(sent?'sent':'silent');
      const beats=[
        {speaker:'场景',text:'第一声钟落进麦田。路上最后一队民兵退回村里。',actors:[],focus:{x:1024,y:570}},
        {speaker:helped?'负伤守卫':'黎安',text:helped?'他打开的是我们的门。告急信里写的，却不是今晚。':'她仍守在门前，捏着那封已经染血的原稿。',actors:[],focus:{x:1150,y:1170}},
        {speaker:'场景',text:sent?'有人带着亲见的事抵达驿站。那封七日前的告急信，第一次有了另一份说法。':'这一夜，没有新的见闻抵达驿站。七日前的告急信，仍是讨伐者手中唯一的说法。',actors:[],focus:{x:1024,y:850}},
        {speaker:'黎安',text:helped?'第二夜，你若还活着，就来旧抄写台。\n我要让你看见原稿。':'她把信藏回袖口，隔着门看向旧抄写台。\n原稿还在那里。',actors:[],focus:{x:1024,y:900}}
      ];
      return this.requestD10Scene('night-end',branch,beats,'第一声钟之后','raid');
    };
    P.sceneActorPresentation=function(visualTime=0){
      if(!this.d10Scene)return [];
      const index=this.d10Scene.beatIndex,t=clamp(visualTime/1.5,0,1),poses={};
      const actors=[{...this.player,id:'player'},...this.entities.filter(e=>e.d10Actor&&!e.gone)];
      for(const actual of actors)poses[actual.storyActor||actual.id]={id:actual.id,storyActor:actual.storyActor,x:actual.x,y:actual.y,pose:'stand',protected:true};
      for(let i=0;i<=index;i++)for(const action of this.d10Scene.beats[i].actors||[]){
        const pose=poses[action.id];if(!pose)continue;const from=action.from||{x:pose.x,y:pose.y},to=action.to||{x:action.x===undefined?from.x:action.x,y:action.y===undefined?from.y:action.y},progress=i<index?1:t;
        pose.x=from.x+(to.x-from.x)*progress;pose.y=from.y+(to.y-from.y)*progress;pose.pose=action.action;
      }
      return Object.values(poses);
    };
    P.scenePropCanHit=function(source,prop){
      const point={x:clamp(source.x,prop.x,prop.x+prop.w),y:clamp(source.y,prop.y,prop.y+prop.h)};
      const dx=point.x-source.x,dy=point.y-source.y,d=Math.hypot(dx,dy);
      if(d<2)return true;return this.clearLine(source,{x:point.x-dx/d*3,y:point.y-dy/d*3},1);
    };
    P.scenePropHint=function(prop,aim){
      const c=centre(prop),near=distance(this.player,c)<100,aimed=aim&&distance(aim,c)<Math.max(36,prop.w/2+8);
      if(!near&&!aimed)return null;
      const tips={barrel:'攻击引爆 · 邻桶连锁',support:'攻击支架 · 木闸落下',gate:'攻击木闸 · 打开通路',alarm:prop.state==='spent'?'本夜已经敲响':'E 敲钟 · 引来一队民兵','side-door':prop.state==='open'?'侧门已打开':'攻击开门 · 黎安与伤员在这里'};
      return {id:prop.id,text:tips[prop.kind],outlined:true,interact:prop.kind==='alarm'&&prop.state==='ready'};
    };
    P.scenePropsView=function(options={}){
      return this.sceneProps.filter(p=>p.state!=='waiting').map(p=>({...clone(p),centre:centre(p),...(this.scenePropHint(p,options.aim)||{outlined:false,interact:false})}));
    };
    P.damageSceneProp=function(prop,amount,kind='fire',source=this.player){
      if(!prop||!prop.scenePropId||amount<=0||!['raid','upgrade'].includes(this.phase)&&!this.d10PropAtomic)return false;
      const actual=this.sceneProps.find(p=>p.id===prop.scenePropId);if(!actual)return false;
      if(actual.kind==='alarm')return true;
      if(actual.kind==='gate'&&(actual.settleRemaining||0)>0)return true;
      if(actual.hp<=0||actual.state==='spent'||actual.state==='open'||actual.state==='broken')return true;
      const solid=this.solids.find(p=>p.scenePropId===actual.id),dir=dirOf(kind);
      actual.hp=0;actual.active=false;if(solid)solid.hp=0;
      if(actual.kind==='barrel'){actual.state='spent';this.d10SceneState.barrels++;const c=centre(actual);this.effect('explosion',c.x,c.y,100,.5);this.emit('explosion',{x:c.x,y:c.y});
        const previousAtomic=this.d10PropAtomic;this.d10PropAtomic=true;
        const attackKind=dir==='fear'?'roar':dir==='force'?'earth':'fire';
        for(const e of this.targets())if(distance(e,c)<100+(e.r||0)&&this.clearLine(c,e,2))this.damageEnemy(e,80,attackKind,c);
        for(const other of this.sceneProps)if(other.kind==='barrel'&&other.hp>0&&distance(c,centre(other))<=120&&this.scenePropCanHit(c,other))this.damageSceneProp(other,1,kind,c);
        this.d10PropAtomic=previousAtomic;
      }else if(actual.kind==='support'){actual.state='broken';this.d10SceneState.supports++;const gate=this.sceneProps.find(p=>p.id==='fallen-gate');gate.hp=1;gate.active=true;gate.state='fallen';gate.settleRemaining=.4;const gateSolid=this.solids.find(p=>p.scenePropId===gate.id);if(gateSolid)gateSolid.hp=1;
        this.effect('debris',gate.x+gate.w/2,gate.y,80,.5);this.emit('prop-effect',{kind:'gate-fell',text:'木闸落下 · 道路被挡住'});
      }else if(actual.kind==='gate'){actual.state='broken';this.effect('debris',actual.x+actual.w/2,actual.y,80,.5);this.emit('prop-effect',{kind:'gate-open',text:'木闸断开 · 通路打开'});
      }else if(actual.kind==='side-door'){actual.state='open';this.d10SceneState.doorOpened=true;this.d10SceneState.damageDirection=dir;this.requestD10DoorScene(dir);}
      if(solid)solid.state=actual.state;return true;
    };
    P.interactSceneProp=function(){
      if(this.phase!=='raid')return false;
      const alarm=this.sceneProps.find(p=>p.kind==='alarm'&&distance(this.player,centre(p))<80);if(!alarm)return false;
      if(alarm.state==='spent')return true;
      alarm.state='spent';this.d10SceneState.alarmRings++;
      for(const [dx,dy] of [[-65,-90],[0,-120],[65,-85]]){const e=this.spawn('militia',alarm.x+14+dx,alarm.y+16+dy);e.name='警钟引来的民兵';e.d10Alarm=true;}
      this.effect('roar',alarm.x+14,alarm.y+16,140,.6);this.emit('alarm',{text:'警钟响起 · 三名民兵正在赶来'});return true;
    };
    P.tickD10Props=function(dt){
      if(this.phase!=='raid')return;
      for(const prop of this.sceneProps)if(prop.settleRemaining>0)prop.settleRemaining=Math.max(0,prop.settleRemaining-dt);
      const exit=this.d10SceneState.exit;
      for(const actor of this.entities.filter(e=>e.d10Actor&&!e.gone&&e.retreating)){
        const route=this.village?.routes.guardRetreat;
        let target={x:exit.x+(actor.storyActor==='lian'?-25:25),y:exit.y};
        if(route){actor.retreatRouteIndex=actor.retreatRouteIndex||0;target=route[actor.retreatRouteIndex]||target;
          if(distance(actor,target)<26&&actor.retreatRouteIndex<route.length-1){actor.retreatRouteIndex++;target=route[actor.retreatRouteIndex];}}
        this.walkTo(actor,target,105,dt);
        if(distance(actor,exit)<55){actor.gone=true;actor.status=this.village?'已到包扎棚':'已撤出村落';this.d10SceneState.evacuatedCount++;}
      }
      this.d10SceneState.evacuated=this.d10SceneState.retreating&&this.d10SceneState.evacuatedCount>=2;
    };
    P.damageStoryActor=function(e,amount){if(this.isD10&&e&&e.d10Actor)return;return baseActorDamage&&baseActorDamage.call(this,e,amount);};
    P.tickStoryActor=function(e,dt){if(this.isD10&&e&&e.d10Actor)return;return baseActorTick&&baseActorTick.call(this,e,dt);};
    P.start=function(){
      baseStart.call(this);this.spawnD10SceneActors();this.requestD10Opening();
    };
    P.tick=function(dt,input={}){
      if(this.phase==='story')return;
      if(this.phase==='raid'&&!this.choicePage&&!this.pendingUpgrade&&this.d10SceneQueue.length){
        const scene=this.d10SceneQueue.shift();this.requestD10Scene(scene.id,scene.branch,scene.beats,scene.title,scene.returnPhase);return;
      }
      const result=baseTick.call(this,dt,input);if(this.phase==='raid')this.tickD10Props(dt);return result;
    };
    return D10Game;
  }
  return {install,VERSION};
});
