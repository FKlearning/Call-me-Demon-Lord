/* Three-night story and earned endings. Scenes are presentation; deeds happen in the world. */
(function(root,factory){
  const village=typeof module==='object'&&module.exports?require('./village-map.js'):root.DemonVillage;
  const plugin=factory(village);
  if(typeof module==='object'&&module.exports)module.exports=plugin;
  else {root.DemonCampaignStory=plugin;if(root.DemonDemo?.CampaignGame)plugin.install(root.DemonDemo.CampaignGame,root.DemonDemo);}
})(typeof globalThis!=='undefined'?globalThis:this,function(village){
  'use strict';
  const VERSION='D14-1';
  // The three paragraphs form one continuous prologue. Authorship and the
  // witness clause stay out of it so that the third-night confession matters.
  const PROLOGUE=[
    {illustration:'rift',timeLabel:'百年前',speaker:'黑潮与圣钟',text:'百年前，战火撕开地下的魔力脉。泄出的魔力沿河吞没田地，人们称它为黑潮。初代勇者与幸存者铸起圣钟，将魔力汇入钟芯，撑起村界的护阵。钟声一响，人们便知道，家还在。',discover:['bell']},
    {illustration:'bearer',timeLabel:'九天前',speaker:'修钟人的异化',text:'九天前，钟芯碎裂。你是村中的修钟人，为救出困在钟下的钟匠，将魔力纳进身体，随后昏迷。角从额头长出，火焰藏进了呼吸。王庭的旧律给能够承载这种魔力的人留下一个名字，魔王。'},
    {illustration:'decree',timeLabel:'七天前寄信，今晨下令',speaker:'处决魔王',text:'七天前，一封信指认你袭村。今晨，王庭命勇者在三日后的黎明前完成处决。所谓处决，是将你永久封入圣钟，替代破碎的钟芯。肉身和自由从此失去，意识却仍困在钟内。你将在今夜醒来，留给你的时间只有三夜。'}
  ];
  const KEYWORDS={location:['抄写台','包扎棚','河岸磨坊','南门','侧门','钟楼','村界','驿站','处刑架'],event:['黑潮','圣钟','钟芯','魔王','第三夜黎明前','短按空格','冲撞','门闩','求援信','指控信','讨伐令','见证锁','认罪书','供能草图','临时供能箱','击退民兵']};
  const ENDINGS={
    sealed:{title:'钟声之下',hint:'战胜勇者后，在圣钟前接受封印。魔王与见证者成为庇护的代价。'},
    crown:{title:'灰烬王冠',hint:'战胜勇者后，掌管圣钟与驿站。村落得到庇护，也从此依赖你的决定。'},
    exile:{title:'失乡长路',hint:'打碎圣钟，到南门集合。故乡失去庇护，你带能够跟上的人离开。'},
    unwritten:{title:'未写完的誓言',hint:'撞开侧门救守卫，将两封信与他的证言送达驿站，解开黎安的见证锁。战胜勇者后，共同守住三轮黑潮。'}
  };
  function install(CampaignGame,api){
    if(!CampaignGame)return;
    api=api||(typeof require==='function'?require('./core.js'):globalThis.DemonDemo);
    const P=CampaignGame.prototype;if(Object.prototype.hasOwnProperty.call(P,'campaignStoryInstalled'))return CampaignGame;P.campaignStoryInstalled=true;
    const {distance,clamp}=api,loc=id=>village.locations[id],point=(id,dx=0,dy=0)=>({x:loc(id).x+dx,y:loc(id).y+dy}),bell=loc('bell'),post=loc('post');
    const beat=(speaker,text,where,extra={})=>({speaker,text,actors:[],focus:point(where),...extra});
    const baseTick=P.tick,baseFinishScene=P.finishD10Scene,baseStartBoss=P.startBoss,baseInteract=P.interact,basePlayerDamage=P.playerDamage;
    const clone=value=>JSON.parse(JSON.stringify(value));
    const endAuthority=new WeakMap(),defenseAuthority=new WeakSet();
    function earnEnding(game,id){endAuthority.set(game,id);try{return game.completeCampaignEnding(id);}finally{endAuthority.delete(game);}}
    P.initCampaignStory=function(){
      this.campaignStory={version:VERSION,stage:'night1',flags:{doorHelped:false,letterRead:false,confessed:false,pactRead:false,lianFreed:false,originalSent:false,guardTestimony:false,heroReadOriginal:false},
        hold:0,holding:null,holdHp:0,inputArmed:false,ending:null,battleWon:false,bellBroken:false,defense:null,courier:null,history:[],nightSummaries:[],party:[],paperNotice:false};
      this.d10Scene=null;this.d10SceneQueue=[];this.d10SceneState.nightEndDone=false;this.d10SceneState.nightEndQueued=false;
    };
    P.sceneKey=function(id,branch){return VERSION+':'+id+':'+branch;};
    P.sceneActorPresentation=function(visualTime=0){
      if(!this.d10Scene)return [];
      const index=this.d10Scene.beatIndex,t=clamp(visualTime/1.5,0,1),poses={};
      const actors=[{...this.player,id:'player'},...this.entities.filter(e=>e.campaignActor&&!e.gone),...(this.hero?[{...this.hero,storyActor:'hero'}]:[])];
      for(const actor of actors)poses[actor.storyActor||actor.id]={id:actor.id,storyActor:actor.storyActor,x:actor.x,y:actor.y,pose:'stand',protected:!!actor.protected};
      for(let i=0;i<=index;i++)for(const action of this.d10Scene.beats[i].actors||[]){
        const pose=poses[action.id];if(!pose)continue;
        const from=action.from||{x:pose.x,y:pose.y},to=action.to||{x:action.x===undefined?from.x:action.x,y:action.y===undefined?from.y:action.y},progress=i<index?1:t;
        pose.x=from.x+(to.x-from.x)*progress;pose.y=from.y+(to.y-from.y)*progress;pose.pose=action.action;
      }
      return Object.values(poses);
    };
    P.requestD10Scene=function(id,branch,beats,title,returnPhase='raid'){
      if(this.campaignStory?.disabled)return false;
      if(this.d10Scene)return false;
      if(this.choicePage||this.pendingUpgrade){if(!this.d10SceneQueue.some(s=>s.id===id&&s.branch===branch))this.d10SceneQueue.push({id,branch,beats:clone(beats),title,returnPhase});return {queued:true,id,branch};}
      const key=this.sceneKey(id,branch);this.d10Scene={id,branch,version:VERSION,key,title,beatIndex:0,beats:clone(beats),returnPhase};this.phase='story';this.emit('scene-start',{id,branch,key,title});
      if(this.d10ScenePreferences.autoSkipSeen&&this.d10ScenePreferences.seenKeys.includes(key)){
        if(this._campaignTickInProgress){this._campaignAutoSkipPending=true;return true;}
        return this.sceneSkip();
      }return true;
    };
    P.spawnCampaignActor=function(key,name,x,y,role){
      if(this.campaignStory?.disabled)return null;
      let e=this.entities.find(a=>a.storyActor===key&&!a.gone);if(e)return e;
      e=this.spawn('villager',x,y);Object.assign(e,{type:'storyActor',storyActor:key,name,role,hp:90,maxHp:90,protected:true,d10Actor:true,campaignActor:true,status:role});return e;
    };
    P.spawnD10SceneActors=function(){
      if(this.campaignStory?.disabled)return;
      const actor=(key,name,id,dx,dy,role)=>{const p=point(id,dx,dy);return this.spawnCampaignActor(key,name,p.x,p.y,role);};
      if(this.night===1){actor('lian','黎安','execution',70,0,'替村民写信的人');actor('execution-guard','押送过你的守卫','side-door',40,-80,'负伤守卫');}
      else if(this.night===2){actor('lian','黎安','scribe',45,-15,'保管两封信');if(this.campaignStory.flags.doorHelped&&!this.campaignStory.courier)actor('execution-guard','押送过你的守卫','scribe',100,-15,'愿意为你作证');}
      else {
        actor('lian','黎安','lian-lock',0,0,this.campaignStory.flags.lianFreed?'带着认罪书':'被见证锁束住');
        actor('refugee-one','钟匠','bell',-100,100,'你从钟下救出的人');
        actor('refugee-two','牵着幼童的村民','bell',-70,140,'等待撤离的村民');
      }
    };
    P.restoreCampaignCourier=function(){
      const courier=this.campaignStory?.courier;if(!courier||courier.delivered)return;
      const actor=this.spawnCampaignActor('original-courier',courier.name,courier.x,courier.y,'把两封信送到驿站');
      if(actor){actor.paperCourier=true;actor.status='两封信正在送出';courier.actorId=actor.id;}
    };
    P.populateCampaignNight=function(){
      const story=this.campaignStory;if(!story||story.disabled)return;
      story.stage='night'+this.night;story.hold=0;story.holding=null;
      this.d10SceneState.nightEndDone=false;this.d10SceneState.nightEndQueued=false;this.d10SceneQueue=[];
      const alarm=this.sceneProps.find(p=>p.kind==='alarm');if(alarm)alarm.state='ready';
      this.spawnD10SceneActors();this.restoreCampaignCourier();
      if(this.night===2){
        const beats=[beat('黎安','十天前，村里写信请王庭派人修钟。七天前寄出的这一封，却说你袭击了村庄。','scribe',{discover:['scribe','letters'],locate:'scribe',evidenceDates:true}),
          beat('你','我九天前就昏过去了。','scribe')];
        if(story.flags.doorHelped)beats.push(beat('守卫','对。信上写的那一夜，你一直躺在床上。','scribe'));
        beats.push(beat('你','得先看清写信的日期。是谁把黑潮造成的死伤写成了我的罪？','scribe'),
          beat('黎安','求援信，我装好了。让勇者先看这一份。','scribe'),
          beat('你','指控我的那封呢？','scribe'),
          beat('黎安','讨伐令已经引过了。','scribe'),
          beat('你','两封都带。该看哪一页，让勇者自己决定。','scribe'),
          beat('黎安','好。你核对完，我们就送。','scribe',{actors:[{id:'lian',action:'listen'}],hint:'靠近抄写台，按住 E 核对并公开两封信。'}));
        this.requestD10Scene('second-night','door-'+(story.flags.doorHelped?'open':'closed'),beats,'第二夜 · 抄写台上的两封信');
      }
      if(this.night===3)this.requestD10Scene('third-night','paper-'+(story.flags.originalSent?'arrived':'road'),[
        beat('你','你的名字，为什么也在锁上？','lian-lock',{actors:[{id:'lian',action:'bound'}]}),
        beat('黎安','指认你袭村的信，是我改的。我把黑潮造成的死伤写成你杀的人，再盖下村印。','lian-lock'),
        beat('你','昨夜你想留下的，就是这封信。','lian-lock'),
        beat('黎安','是。','lian-lock'),
        beat('你','你知道我还没醒。','lian-lock'),
        beat('黎安','知道。求援迟迟没有回音，我怕村子撑不住，便拿你的命换来了军队。','lian-lock'),
        beat('你','也换来了我的处刑架。','lian-lock'),
        beat('黎安','我给你割开绳子，也抵不掉这件事。改过的字、盖印的日期，我都写进了认罪书，也签了名。你收着。','lian-lock',{discover:['confession'],actors:[{id:'lian',action:'listen'}]}),
        beat('你','他们为什么把你锁起来？','lian-lock'),
        beat('黎安','今天他们才给我完整的祭仪。第一个指认魔王的人，要和魔王一起留在钟里。这把见证锁，就是为我备的。','lian-lock',{discover:['witness-lock'],locate:'lian-lock'}),
        beat('你','所以你现在要我救你。','lian-lock'),
        beat('黎安','认罪书已经给你了，我不拿它换这把锁。你若放我出去，我会活着向村民认下。你若不放，我也不会把改信的罪推给你。','lian-lock',{hint:'按住 E 解锁，也可以离开。认罪书已经取得。'})
      ],'第三夜 · 村印上的名字');
    };
    P.requestD10Opening=function(){
      return this.requestD10Scene('prologue','bell-and-tide',PROLOGUE.map(b=>({...b,actors:[],focus:point('bell')})),'前情 · 钟与黑潮');
    };
    P.requestCampaignOpening=function(){
      return this.requestD10Scene('opening','first-night',[
        beat('旁白','你睁开眼，发现自己被绑在处刑架上。绳索勒着手腕，熟悉的钟楼就在眼前，却听不见一声钟响。','execution',{cinematic:'awakening',timeLabel:'苏醒后的第一夜',discover:['execution'],actors:[{id:'player',action:'bound'}]}),
        beat('黎安','手腕别动。刀口就在绳结旁边。','execution',{cinematic:'awakening',actors:[{id:'lian',action:'unlock',to:point('execution',-35,0)}]}),
        beat('你','你是谁？','execution',{actors:[{id:'player',action:'stand'}]}),
        beat('黎安','黎安。村里写信的人。','execution'),
        beat('你','为什么救我？','execution'),
        beat('黎安','你救钟匠时，我在场。你不该连一句辩解都没有，就被送进钟里。','execution'),
        beat('守卫','我押他上过处刑架。你还让他帮我？','side-door',{actors:[{id:'lian',action:'drag',from:point('execution',-35,0),to:point('side-door',-40,-70)},{id:'execution-guard',action:'lower-weapon',to:point('side-door',40,-70)}]}),
        beat('黎安','侧门通向包扎棚。门闩卡了，我推不开。','side-door',{discover:['side-door','infirmary'],locate:'side-door'}),
        beat('黎安','你能撞开吗？民兵快到门口了。','side-door',{actors:[{id:'lian',action:'brace'}]}),
        beat('黎安','瞄准门闩，短按空格冲撞。你也可以先击退民兵，再来开门。','side-door',{guide:{kind:'world',target:'side-door',...point('side-door'),radius:125,action:'dash',allowLater:true}}),
        beat('黎安','击退民兵，守住侧门。伤员还得从这里出去。','side-door')
      ],'苏醒后的第一夜 · 打开退路');
    };
    P.requestD10DoorScene=function(dir){
      if(this.campaignStory?.disabled)return false;
      const door=this.sceneProps.find(p=>p.kind==='side-door');if(!door||door.state!=='open')return false;
      if(this.night!==1){this.emit('story-progress',{text:'侧门已经打开，道路畅通。'});return true;}
      this.campaignStory.flags.doorHelped=true;this.observeStoryFact?.('mercy',point('side-door'));
      return this.requestD10Scene('side-door',dir,[
        beat('守卫','信上说你七天前袭村。那一夜，我就在你床边换药，你根本没醒。','side-door',{actors:[{id:'execution-guard',action:'lower-weapon'}]}),
        beat('你','你报过吗？','side-door'),
        beat('守卫','报过。他们只认盖了村印的信。我能作证，信里那桩袭村案，你是清白的。','side-door'),
        beat('守卫','你为我开门的事，我也会告诉勇者。','side-door'),
        beat('黎安','沿门外的巷子往右，去包扎棚。把你看守他的日期记下来。','side-door',{addressee:'守卫',locate:'infirmary',discover:['infirmary']})
      ],'一扇为他打开的门');
    };
    P.campaignTargets=function(){
      const c=this.campaignStory;if(!c||c.disabled||c.ending)return [];const f=c.flags;
      const marker=(id,title,hint,where,seconds,optional=true)=>({id,title,hint,...where,r:80,seconds,optional,required:!optional,hold:c.holding===id?c.hold/seconds:0,completed:false});
      if(c.stage==='defense')return c.defense.posts.filter(p=>!c.defense.secured.includes(p.id)).map(p=>marker(p.id,'接稳临时供能箱','按住 E 接稳线路，击退三轮黑潮。',p,2,false));
      if(this.phase==='resolution'){
        if(c.bellBroken)return [marker('leave','在南门集合','按住 E 等同行者跟上。村子已失去圣钟的庇护。',point('south-gate'),2.5,false)];
        const out=[marker('seal','接受封印','你与首位指认者永留钟内，勇者终身守钟。按住 E 接受。',point('bell'),3,false),
          marker('crown','掌管圣钟','你在钟外供能，掌管圣钟与驿站。村落将依赖你的决定。',point('bell',180,110),3,false),
          marker('break','打碎圣钟','村子将失去庇护。破钟后，到南门等同行者集合。',point('bell',-180,110),3,false)];
        if(!f.lianFreed)out.push(marker('free','解开黎安的见证锁','认罪书已经在你手中。按住 E 解锁，让她活着面对村民。',point('lian-lock'),2));
        if(this.canUnwriteCampaign())out.push(marker('unwrite','共同守住黑潮','勇者守西侧，你守东侧。接稳临时供能箱，挡住三轮黑潮。',point('bell',0,-125),3,false));
        return out;
      }
      if(this.phase!=='raid')return [];
      if(this.night===2&&!f.letterRead)return [marker('original','核对两封信','按住 E 核对写信的日期，再把证据送往北门驿站。',point('scribe'),2)];
      if(this.night===3&&!f.lianFreed)return [marker('free','解开黎安的见证锁','认罪书已经取得。按住 E 解锁，也可以离开。',point('lian-lock'),2)];
      return [];
    };
    P.storyTargets=P.campaignTargets;
    P.storyObjective=function(){
      const targets=this.campaignTargets();if(targets.length)return this.phase==='resolution'?[...targets].sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0]:targets[0];
      if(this.night===1&&this.phase==='raid'&&!this.campaignStory?.disabled&&!this.campaignStory?.flags.doorHelped){
        const door=this.sceneProps.find(p=>p.kind==='side-door'&&p.state!=='open');
        if(door)return {id:'side-door',title:'撞开侧门 · 可稍后',hint:'靠近侧门，朝向门闩短按空格；击退民兵后再来同样有效。',x:door.x+door.w/2,y:door.y+door.h/2,r:125,optional:true,required:false,action:'dash'};
      }
      return null;
    };
    P.campaignAction=function(id){
      const c=this.campaignStory,target=this.campaignTargets().find(t=>t.id===id);
      if(!target||distance(this.player,target)>target.r||c.holding!==id||c.hold<target.seconds)return false;
      c.holding=null;c.hold=0;
      if(id==='original'){
        if(c.flags.letterRead)return false;c.flags.letterRead=true;
        this.requestD10Scene('original','door-'+(c.flags.doorHelped?'open':'closed'),[
          beat('你','把这两封信送给勇者。写信的日期和村印，都留着。','scribe',{discover:['letters'],evidenceDates:true}),
          beat(c.flags.doorHelped?'守卫':'送信人',c.flags.doorHelped?'我送。除了这两张纸，他还得听听亲眼看过你的人怎么说。':'我送到北门的驿站，请他们转交勇者。','scribe'),
          beat('黎安','王庭的人在驿站收信，勇者也会在那里取命令。','scribe',{discover:['post'],locate:'post'}),
          beat('你','他看过，就会停手？','scribe'),
          beat('黎安','他得重查袭村的指控。可钟芯碎了，护阵还得有人供能。','scribe')
        ],'把证据送出去');return true;
      }
      if(id==='free'){
        if(c.flags.lianFreed)return false;c.flags.pactRead=true;c.flags.lianFreed=true;
        this.requestD10Scene('witness-lock','paper-'+(c.flags.originalSent?'arrived':'road'),[
          beat('黎安','钟匠新画的供能草图，我带来了。','lian-lock',{actors:[{id:'lian',action:'stand'}],discover:['supply-plan']}),
          beat('你','这能替下钟芯？','lian-lock'),
          beat('钟匠','我想给东西两条护阵线路各接一个供能箱，让魔力分开送进去，不再只靠钟里的一个人。','bell',{locate:'supply-east'}),
          beat('你','谁来供能？','bell'),
          beat('钟匠','你和勇者先守这一轮。守住了，再教村里的人轮班。普通人的魔力少，需要常换人。','bell'),
          beat('黎安','有了图，还得真的挡住黑潮。','lian-lock')
        ],'锁开以后',this.phase==='resolution'?'resolution':'raid');return true;
      }

      if(id==='seal')return earnEnding(this,'sealed');
      if(id==='crown')return earnEnding(this,'crown');
      if(id==='break'){
        if(c.bellBroken)return false;c.bellBroken=true;
        const people=this.entities.filter(e=>!e.gone&&e.hp>0&&(['refugee-one','refugee-two'].includes(e.storyActor)||e.storyActor==='lian'&&c.flags.lianFreed));
        c.party=[];for(const actor of people){actor.exodus=true;actor.retreating=false;actor.status='跟随撤离';c.party.push(actor.id);}
        this.effect('legend',bell.x,bell.y,220,.8);this.emit('story-progress',{text:'圣钟已碎。去南门集合，等同行者跟上。'});return true;
      }
      if(id==='leave'){
        const party=this.entities.filter(e=>c.party.includes(e.id)&&!e.gone);
        if(party.some(e=>distance(e,target)>120)){this.emit('story-progress',{text:'有人还没有跟上 · 在出口等他们集合'});return false;}
        return earnEnding(this,'exile');
      }
      if(id==='unwrite'){defenseAuthority.add(this);try{return this.beginCampaignDefense();}finally{defenseAuthority.delete(this);}}
      if(c.stage==='defense'&&c.defense.posts.some(p=>p.id===id)&&!c.defense.secured.includes(id)){
        c.defense.secured.push(id);this.effect('level',target.x,target.y,80,.5);this.emit('story-progress',{text:'临时供能箱已经接稳。'});return true;
      }
      return false;
    };
    P.startCampaignPaper=function(){
      const c=this.campaignStory;if(c.courier||c.flags.originalSent)return;
      const source=c.flags.doorHelped?'押送过你的守卫':'送信人';
      let actor=c.flags.doorHelped?this.entities.find(e=>e.storyActor==='execution-guard'&&!e.gone):null;
      if(actor)Object.assign(actor,{storyActor:'original-courier',role:'把两封信送到驿站',status:'两封信正在送出',retreating:false});
      else {const p=point('scribe',80,0);actor=this.spawnCampaignActor('original-courier',source,p.x,p.y,'把两封信送到驿站');}if(!actor)return;
      actor.paperCourier=true;c.courier={actorId:actor.id,name:source,x:actor.x,y:actor.y,target:point('post'),route:clone(village.routes.evidenceRoute),routeIndex:0,delivered:false,guardWitness:c.flags.doorHelped};
      this.emit('story-progress',{text:'两封信正在送往驿站，勇者尚未收到。'});
    };
    P.tickCampaignPaper=function(dt){
      const c=this.campaignStory,courier=c?.courier;if(!courier||courier.delivered)return;
      let actor=this.entities.find(e=>e.id===courier.actorId&&!e.gone);if(!actor){this.restoreCampaignCourier();actor=this.entities.find(e=>e.id===courier.actorId&&!e.gone);}
      if(!actor)return;
      const target=courier.route?.[courier.routeIndex]||courier.target;
      this.walkTo(actor,target,150,dt);courier.x=actor.x;courier.y=actor.y;
      if(distance(actor,target)<25&&courier.route&&courier.routeIndex<courier.route.length-1)courier.routeIndex++;
      if((!courier.route||courier.routeIndex>=courier.route.length-1)&&distance(actor,courier.target)<35){
        courier.delivered=true;actor.gone=true;c.flags.originalSent=true;if(courier.guardWitness)c.flags.guardTestimony=true;
        this.emit('story-progress',{text:'两封信已到驿站，将交给勇者核对。'+(courier.guardWitness?'守卫也交了看守证言。':'')});
        this.addLog(courier.guardWitness?'守卫将求援信、指控信和看守证言交到了驿站。':'求援信和指控信抵达驿站，等待勇者核对。');
      }
      if(c.flags.originalSent&&this.hero)this.readCampaignOriginal();
    };
    P.readCampaignOriginal=function(){
      const c=this.campaignStory;if(!c||!this.hero||!c.flags.originalSent||c.flags.heroReadOriginal)return false;
      c.flags.heroReadOriginal=true;this.hero.originalKnowledge={source:c.courier?.name||'驿站转交的两封信',forgery:c.flags.confessed,door:c.flags.guardTestimony};
      this.emit('story-progress',{text:'勇者已读两封信，发现了日期矛盾。'});return true;
    };
    P.finishD10Scene=function(skipped){
      const scene=this.d10Scene;if(!scene||skipped&&!this.d10ScenePreferences.seenKeys.includes(scene.key)||!skipped&&scene.beatIndex<scene.beats.length-1)return false;const id=scene.id,c=this.campaignStory;
      if(c&&!c.disabled)c.history.push({id,branch:scene.branch,night:this.night,discoveries:[...new Set(scene.beats.flatMap(b=>b.discover||[]))]});
      const result=baseFinishScene.call(this,skipped);
      if(!c||c.disabled)return result;
      c.inputArmed=false;c.hold=0;c.holding=null;
      if(id==='prologue')this.requestCampaignOpening();
      if(id==='third-night'){
        c.flags.confessed=true;
        this.observeStoryFact?.('confession',point('lian-lock'));
        if(this.hero?.originalKnowledge)this.hero.originalKnowledge.forgery=true;
      }
      if(id==='side-door')for(const actor of this.entities.filter(e=>e.campaignActor&&!['lian','execution-guard'].includes(e.storyActor)))actor.retreating=false;
      if(id==='original')this.startCampaignPaper();
      if(id==='witness-lock'){const lian=this.entities.find(e=>e.storyActor==='lian');if(lian)lian.status='见证锁已解开';}
      if(id==='boss-conflict')this.createBossCheckpoint?.();
      if(id==='ending'&&c.ending){this.phase='victory';c.stage='epilogue';this.emit('ending',{id:c.ending.id,title:c.ending.title,text:c.ending.lines.join('\n')});this.emit('victory');}
      return result;
    };
    P.requestD10NightEnd=function(){
      const c=this.campaignStory;if(!c||c.disabled)return false;
      if(this.d10SceneState.nightEndDone||this.d10SceneState.nightEndQueued)return false;this.d10SceneState.nightEndQueued=true;
      const sent=this.stats.delivered>this._campaignNightDelivered,branch='n'+this.night+'-'+(c.flags.doorHelped?'door-open':'door-closed')+'-'+(sent?'sent':'silent')+'-'+(c.flags.originalSent?'paper':'no-paper');
      let beats,summary;
      if(this.night===1){
        const where=c.flags.doorHelped?'infirmary':'side-door',p=point(where,-40,0);this.spawnCampaignActor('lian','黎安',p.x,p.y,'照看伤员');
        beats=[
          beat('黎安',c.flags.doorHelped?'巡队收队了。去南边河岸的磨坊躲过白天，那里已经停工。我留在包扎棚照看伤员。':'我会叫包扎棚的人来抬伤员。你去南边河岸的磨坊躲过白天，那里已经停工。',where,{discover:['mill'],locate:'mill'}),
          beat('你','明晚去哪里找你？',where),
          beat('黎安','到我替村民写信的抄写台来。求援信和指控你的信，我都留着抄本。',where,{discover:['scribe'],locate:'scribe'}),
          beat('你','寄给王庭的信，都从你手里出去？',where),
          beat('黎安','是。村印也由我保管。',where,{discover:['seal']}),
          beat('你','村里求的是救援，等来的却是我的讨伐令。',where),
          beat('黎安','两封信都经了我的手。明晚，我们把它们放在一起看。',where)
        ];
        summary=['你沿南街走到河岸磨坊，在那里躲过白天。第二次日落时，你返回抄写台。'];
      }else if(this.night===2){
        const p=point('scribe',0,95);this.spawnCampaignActor('bell-keeper','守钟人',p.x,p.y,'携带寄信登记');
        beats=[
          beat('守钟人','黎安，明晚到钟楼。带上你保管的村印。','scribe',{discover:['bell'],locate:'bell'}),
          beat('你','守钟人为什么叫你过去？','scribe',{actors:[{id:'bell-keeper',action:'retreat',to:point('scribe',0,160)}]}),
          beat('黎安','寄信登记上，有我的名字。','scribe'),
          beat('你','你只是替别人写字？','scribe'),
          beat('黎安','我也有自己的主意，不能把每个字都推给别人。','scribe')
        ];
        summary=[c.flags.originalSent?'两封信已到驿站，等待勇者核对。':c.flags.letterRead?'送信人还没到驿站。两封信仍在途中。':'你没有公开两封信。它们仍留在抄写台。','你回到磨坊避过白昼，第三夜再去钟楼。'];
      }else{
        beats=[beat('钟匠','勇者手上那条誓带，另一端系着圣钟。祭仪一旦完成，他也得留下，一生都不能离开。','bell',{actors:[{id:'refugee-one',action:'brace'}]}),
          beat('钟匠','阵灯快灭了。他已经到广场了。','bell')];
        summary=['勇者走进广场。村界的阵灯逐盏熄灭，处决期限就要到了。'];
      }
      c.nightSummaries.push({night:this.night,branch,lines:summary,location:this.night<3?'mill':'bell'});
      return this.requestD10Scene('night-end',branch,beats,['第一夜 · 印信','第二夜 · 寄信人的名字','第三夜 · 黎明将至'][this.night-1],'raid');
    };
    P.currentScene=function(){
      const c=this.campaignStory;if(!c)return {title:'他们说我是魔王',lines:[],objective:'撑过三夜，夺回选择'};
      if(c.ending)return {title:c.ending.title,lines:[...c.ending.lines],objective:'这份结局已经留下'};
      const last=c.nightSummaries[c.nightSummaries.length-1];
      return {title:this.phase==='interlude'?['第一夜之后','第二夜之后','第三夜 · 黎明将至'][this.night-1]:c.stage==='defense'?'共同守住黑潮':'第'+['一','二','三'][this.night-1]+'夜',
        lines:this.phase==='interlude'&&last?[...last.lines]:[],location:this.phase==='interlude'?last?.location:null,
        objective:c.stage==='defense'?'接稳供能箱，击退黑潮':this.phase==='boss'?'击败勇者，夺回选择':this.phase==='resolution'?'靠近目标查看代价，按住 E 决定': '击退民兵，守住退路'};
    };
    P.requestCampaignBossScene=function(){
      const c=this.campaignStory;if(!c||c.disabled)return false;c.stage='boss';this.readCampaignOriginal();
      const knows=c.flags.originalSent,mercy=c.flags.guardTestimony;
      const beats=[
        beat('勇者',mercy?'两封信和守卫的证言，我看了。信里所说的袭村案，你是清白的。':knows?'两封信对不上。袭村的指控必须重查。':'讨伐令说你袭村。若有证据，现在给我看。','bell',{actors:[{id:'hero',action:'listen'}]}),
        beat('黎安','假的指控是我写的。认罪书在他手里。','lian-lock',{actors:[{id:'lian',action:c.flags.lianFreed?'stand':'bound'}]}),
        beat('勇者','我会把罪责记清。可村界快破了，必须有人给护阵供能。','bell'),
        beat('你','没有那封假信，你们也会把我封进去？','bell'),
        beat('勇者','旧律选的是能承载魔力的人。罪名可以撤，你身上的魔力，仍是他们要的。','bell'),
        beat('你','我没有袭村，却还是得把一生赔进去。','bell'),
        beat('勇者','你不该为假信受罚。但在另一条护阵亮起来之前，我不能让村民失去庇护。','bell')
      ];
      if(c.flags.lianFreed)beats.push(beat('钟匠','东西两边的供能箱接好了。分别守住它们，也许能撑过这一轮。','bell',{locate:'supply-east'}),
        beat('勇者','也许不够。身后的村民，活不到第二次尝试。','bell'));
      beats.push(beat('你','那就让开。我自己决定怎样用这份力量。','bell'),beat('勇者','先过我这一关。','bell',{actors:[{id:'hero',action:'brace'}]}));
      return this.requestD10Scene('boss-conflict',(knows?'original':'letter')+'-'+(c.flags.lianFreed?'free':'bound'),beats,'黎明前 · 拒绝献命','boss');
    };
    P.startBoss=function(){
      const opened=baseStartBoss.call(this);if(!opened||!this.campaignStory||this.campaignStory.disabled)return opened;
      this.campaignStory.stage='boss';this.spawnD10SceneActors();this.restoreCampaignCourier();this.requestCampaignBossScene();return true;
    };
    P.canUnwriteCampaign=function(){const c=this.campaignStory,f=c?.flags;return !!c&&!c.disabled&&c.battleWon&&f.doorHelped&&f.confessed&&f.originalSent&&f.guardTestimony&&f.heroReadOriginal&&f.pactRead&&f.lianFreed;};
    P.onCampaignHeroDefeated=function(){
      const c=this.campaignStory;if(!c||c.disabled)return false;c.battleWon=true;c.stage='resolution';this.phase='resolution';this.time=0;this.fields=[];this.pets=[];this.scheduled=[];
      for(const e of this.entities)if(e.type==='militia')e.gone=true;
      this.player.dashTime=0;this.player.plunge=null;this.player.fireActive=false;this.player.fireHeld=false;
      const beats=[
        beat('钟匠','现在没有人能押你进钟。可你得知道，每条路通向哪里。','bell',{actors:[{id:'hero',action:'kneel'}]}),
        beat('你','我能留在钟外供能吗？','bell'),
        beat('钟匠','能。可你一离开，护阵就会失去力量。整个村子都得靠你一直愿意。','bell'),
        beat('你','如果打碎圣钟呢？','bell'),
        beat('钟匠','村子就守不住了。你若想带人走，到南门等他们跟上。','bell',{discover:['south-gate'],locate:'south-gate'})
      ];
      if(this.canUnwriteCampaign())beats.push(beat('勇者','我守西侧，你守东侧。真挡住这一轮，我就停掉献祭。','bell'));
      this.requestD10Scene('resolution',this.canUnwriteCampaign()?'truth':'choices',beats,'圣钟前 · 由你选择','resolution');return true;
    };
    P.beginCampaignDefense=function(){
      const c=this.campaignStory;if(!defenseAuthority.has(this)||!this.canUnwriteCampaign()||this.phase!=='resolution')return false;
      c.stage='defense';c.defense={time:0,waves:0,secured:[],heroRepair:0,posts:[{id:'defend-west',...point('supply-west')},{id:'defend-east',...point('supply-east')}]};
      this.phase='boss';this.time=0;this.fields=[];this.pets=[];if(this.hero){this.hero.ally=true;this.hero.ward=null;this.hero.anchor=null;}
      const lian=this.entities.find(e=>e.storyActor==='lian'&&!e.gone);if(lian){Object.assign(lian,point('execution'));lian.status='带村民退到阵灯后';}
      this.player.hp=Math.max(this.player.hp,this.player.maxHp*.65);this.player.energy=this.player.maxEnergy;this.player.roarCooldown=0;this.player.dashCharges=this.player.dashMax;
      c.inputArmed=false;this.emit('story-progress',{text:'接稳东西两侧供能箱，击退三轮黑潮。'});
      this.requestD10Scene('shared-defense','two-boxes',[
        beat('勇者','西边交给我。','supply-west'),
        beat('钟匠','你先接稳东边的供能箱，别让黑潮撞断线路。','supply-east',{locate:'supply-east'}),
        beat('黎安','我带村民退到阵灯后。等黑潮退了，我会去广场，把那封信的事说清。','execution')
      ],'第一次共同守护','boss');return true;
    };
    P.tickCampaignStory=function(dt,input={}){
      const c=this.campaignStory;if(!c||c.disabled||c.ending)return;
      this.tickCampaignPaper(dt);
      if(c.stage==='defense'){
        const d=c.defense;d.time+=dt;
        if(this.hero){const p=d.posts[0];if(distance(this.hero,p)>45)this.walkTo(this.hero,p,95,dt);else if(!d.secured.includes(p.id)){d.heroRepair+=dt;if(d.heroRepair>=3){d.secured.push(p.id);this.emit('story-progress',{text:'勇者接稳了西侧供能箱。'});}}}
        if(d.waves<3&&d.time>=d.waves*8){const p=d.posts[d.waves%2];for(let i=0;i<2;i++){const e=this.spawn('militia',p.x+150+i*45,p.y+165);e.name='黑潮';e.campaignTide=true;e.hp=e.maxHp=64;e.speed=92;}d.waves++;}
        if(d.time>=24&&d.secured.length===2&&d.waves===3&&!this.entities.some(e=>e.campaignTide&&!e.gone&&e.hp>0)){earnEnding(this,'unwritten');return;}
      }
      if(!input.interact){c.inputArmed=true;c.hold=0;c.holding=null;return;}
      if(!c.inputArmed)return;
      const target=this.campaignTargets().find(t=>distance(this.player,t)<t.r),reporter=this.activeReport?.();
      if(target&&input.interact&&!(reporter&&distance(reporter,this.player)<80)){
        if(c.holding!==target.id||this.player.hp<c.holdHp){c.holding=target.id;c.hold=0;}
        c.holdHp=this.player.hp;c.hold+=dt;if(c.hold>=target.seconds)this.campaignAction(target.id);
      }else{c.hold=0;c.holding=null;}
    };
    P.tickCampaignResolution=function(dt,input={}){
      if(this.phase!=='resolution')return;dt=clamp(dt,0,.05);this.time+=dt;this.totalTime+=dt;
      const x=input.mx||0,y=input.my||0,len=Math.hypot(x,y);if(len)this.move(this.player,x/len*185*dt,y/len*185*dt);
      for(const actor of this.entities.filter(e=>e.exodus&&!e.gone))this.walkTo(actor,{x:this.player.x+(actor.id%3-1)*22,y:this.player.y+35},145,dt);
      this.effects.forEach(e=>e.life-=dt);this.effects=this.effects.filter(e=>e.life>0);this.tickCampaignStory(dt,input);
    };
    P.interact=function(){
      const reporter=this.activeReport?.();if(reporter&&distance(reporter,this.player)<80)return baseInteract.call(this);
      if(this.campaignTargets().some(t=>distance(this.player,t)<t.r))return;
      return baseInteract.call(this);
    };
    P.playerDamage=function(amount){if(this.campaignStory?.stage==='defense'&&this.hero&&distance(this.hero,this.player)<85)amount*=.6;return basePlayerDamage.call(this,amount);};
    P.onCampaignPlayerDefeated=function(){return false;};
    P.campaignTestimony=function(){const c=this.campaignStory;return [
      {name:'押送守卫',text:c.flags.doorHelped?'信里指控他的那一夜，他一直躺在床上。我看见过，也报过。后来，他替我撞开了侧门。':'我在侧门旁等过，门闩一直没有断。'},
      {name:'黎安',text:c.flags.confessed?'假信是我改的。我签了认罪书，这份罪不能再推给别人。':'求援信和指控信都在抄写台，写信的日期对不上。'},
      {name:'村落见闻',text:this.stats.delivered?this.stats.delivered+' 封战斗见闻送达驿站。勇者根据村民见到的能力准备了对策。':'没有新的战斗见闻送达。勇者沿用原先的准备。'}
    ];};
    P.completeCampaignEnding=function(id){
      const c=this.campaignStory;if(endAuthority.get(this)!==id||!c||c.disabled||c.ending||!c.battleWon||!ENDINGS[id])return false;
      if(id==='unwritten'){
        if(c.stage!=='defense'||!this.canUnwriteCampaign()||c.defense.time<24||c.defense.secured.length<2||this.entities.some(e=>e.campaignTide&&!e.gone&&e.hp>0))return false;
        for(const key of this.qualities())this.ranks[key]=0;this.path=null;this.legend=false;this.fields=[];this.pets=[];
      }else if(this.phase!=='resolution'||id==='exile'&&!c.bellBroken)return false;
      const scripts={
        sealed:[
          beat('你','我进去。把认罪书留在钟外。','bell'),
          beat('黎安',c.flags.lianFreed?'我的锁是你开的。这次回去，是我自己选的。':'把我改过的那封信交出去。钟响了，也别替我抹掉。','bell'),
          beat('勇者','我会守着这口钟，也会告诉后来的人，钟里是谁。','bell'),
          beat('旁白','黎安把认罪书交给门外的钟匠。铜门合拢，魔力重新流向村界。黑潮退了，沉寂多日的圣钟再次响起。','bell'),
          beat('旁白','王庭的碑上，只刻了勇者的名字。','bell'),
          c.flags.doorHelped?beat('守卫','钟里那位修钟人，曾替我打开过一扇门。你们要记住他。','bell'):beat('旁白','孩子们在钟下学会走路。钟声里两个不能回家的名字，始终没有刻上石碑。','bell')
        ],
        crown:[
          beat('你','我留在钟外。护阵由我供养。','bell'),
          beat('勇者','从今往后，村民只能盼你一直愿意。','bell'),
          beat('黎安',c.flags.lianFreed?'那寄出去的信，还能由写信的人决定吗？':'我的罪已经写在纸上。以后，别人能不能寄信说你的过错？','bell'),
          beat('你','寄出去之前，先交给我看。','bell'),
          beat('黎安','我做过的事，你也要做？','bell'),
          beat('旁白','圣钟与驿站的钥匙落进你同一只手里。黑潮停在村外。收获时，村民把第一袋粮食送到钟门前。','bell'),
          beat('幼童','明年他不高兴了，钟还会响吗？','bell'),
          beat('旁白','母亲没有回答。她把孩子手里的麦穗，也放进了上缴的粮袋。','bell')
        ],
        exile:[
          beat('你',c.party.length?'人到齐了。我们走。':'没有人跟上。我该走了。','south-gate'),
          ...(c.flags.lianFreed?[beat('黎安','我走最后。到了能收留人的地方，我先报自己的名字，再交认罪书。','south-gate')]:[]),
          beat('旁白','故乡最后一盏灯在身后熄灭。黑潮漫过田地，漫过你曾走过的每一条街。','south-gate'),
          ...(!c.flags.lianFreed?[beat('旁白','最后一次回望，钟柱旁的身影已被黑潮遮住。黎安的认罪书还在你手中，写信的人却没有走出来。','south-gate')]:[]),
          beat('城门告示','魔王毁村，流民不得入内。','south-gate'),
          beat('旁白',c.party.length?'你把同行的人护在身后，沿着城墙寻找另一条路。':'你独自走过城墙的阴影，再没有人喊你的名字。','south-gate')
        ],
        unwritten:[
          beat('勇者','守住了。祭仪到此为止。','bell',{actors:[{id:'hero',action:'lower-weapon'}]}),
          beat('钟匠','这两个箱子只撑住了眼前。想长久守村，还得铸些能轮班供养的小钟。','bell'),
          beat('黎安','黑潮夺走的人，被我写成了他杀的人。那封信是我改的，我来认。','execution'),
          beat('村民','你拿他的命换援军，现在认个错就算了？','execution'),
          beat('黎安','不算。我留下来，你们要问什么、怎么追究，我都不会躲。','execution'),
          beat('守卫','信里写的那一夜，他躺在床上。我看见过，也替他报过。','execution'),
          beat('旁白','那个冬天，他们把圣钟改铸成七座小钟，建起七处可分别供能的新护阵。钟声由不同的手接续，再不需要一个永远不能离开的人。','bell'),
          beat('王庭使者','谁是这里的魔王？谁在给护阵供能？','post'),
          beat('黎安','今天守钟的人，都在这本轮班册上。','post'),
          beat('旁白','修钟人、勇者、抄写员、村民，名字写了厚厚七页。村口的换班牌上，今日是你，明日是她。','post')
        ]
      };
      const endingBeats=scripts[id],lines=endingBeats.map(b=>b.speaker==='旁白'?b.text:b.speaker+'：'+b.text);
      c.ending={id,title:ENDINGS[id].title,lines,witnesses:this.campaignTestimony(),facts:clone(c.flags)};
      this.requestD10Scene('ending',id,endingBeats,ENDINGS[id].title,'victory');return true;
    };
    P.getEnding=function(){return this.campaignStory?.ending?clone(this.campaignStory.ending):null;};
    P.endingHints=function(){return Object.entries(ENDINGS).map(([id,e])=>({id,title:e.title,hint:!this.campaignStory?.flags.confessed&&id==='sealed'?'战胜勇者后，到圣钟前查看封印的代价。':!this.campaignStory?.flags.confessed&&id==='unwritten'?'救下侧门旁的守卫，把两封信送到驿站。第三夜，听黎安把话说完。':e.hint,unlockedHere:id==='unwritten'?this.canUnwriteCampaign():!!this.campaignStory?.battleWon}));};
    P.tick=function(dt,input={}){
      if(this.phase==='story')return;
      if(['raid','boss','resolution'].includes(this.phase)&&!this.choicePage&&!this.pendingUpgrade&&this.d10SceneQueue.length){const s=this.d10SceneQueue.shift();this.requestD10Scene(s.id,s.branch,s.beats,s.title,s.returnPhase);return;}
      this._campaignTickInProgress=true;
      try{
        const phase=this.phase,result=baseTick.call(this,dt,input);
        if(phase!=='resolution'&&['raid','boss'].includes(this.phase)){
          if(this.phase==='raid')this.tickD10Props(clamp(dt,0,.05));
          this.tickCampaignStory(clamp(dt,0,.05),input);
        }
        return result;
      }finally{
        this._campaignTickInProgress=false;
        if(this._campaignAutoSkipPending){this._campaignAutoSkipPending=false;if(this.phase==='story')this.sceneSkip();}
      }
    };
    return CampaignGame;
  }
  return {install,VERSION,PROLOGUE,KEYWORDS};
});
