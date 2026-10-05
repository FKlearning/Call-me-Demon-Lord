/* The pact is advanced by witnessed deeds and world interactions, not an ending selector. */
(function (root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.DemonStory=api;if(root.DemonDemo)api.install(root.DemonDemo);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function install(api){
    const P=api.Game.prototype;if(P.pactStoryInstalled)return api;P.pactStoryInstalled=true;
    const {distance,clamp,angleDiff,segmentDistance}=api, bell=api.BELL_POSITION||{x:1024,y:570};
    const basePopulate=P.populateNight,baseFinish=P.finishNight,baseBoss=P.startBoss,baseDamage=P.damageEnemy,baseIgnite=P.igniteSeeds,baseInteract=P.interact,
      baseRoarWave=P.roarWave,baseEarth=P.earthWave,basePlunge=P.tickPlunge,baseLance=P.releaseLance,baseScheduled=P.tickScheduled,basePlayerDamage=P.playerDamage;
    const clone=v=>JSON.parse(JSON.stringify(v));
    const ENDINGS={
      sealed:{title:'钟声之下',hint:'在最后的圣钟前接受封印。庇护会留下，真相未必。'},
      crown:{title:'灰烬王冠',hint:'击败勇者后，占领圣钟与传信台。胜者可以决定谁有资格开口。'},
      exile:{title:'失乡长路',hint:'打碎圣钟，带仍然活着的人走到村外。没有故乡的路，也是一条路。'},
      unwritten:{title:'未写完的誓言',hint:'让亲历攻击与帮助的证言送达，公开告急信的责任，救下签署者，再与勇者解开誓约。'}
    };
    P.initStory=function(){
      this.story={stage:'escape',flags:{escaped:false,aid:false,forgeryKnown:false,confessed:false,bindingKnown:false,lianFreed:false,heroMercy:false,heroConfession:false,bellBroken:false},
        lian:{alive:true,hp:90,maxHp:90,status:'引路',x:850,y:955},wounded:{alive:true,hp:32,helped:false},history:[],seen:[],ending:null,hold:0,holding:null,
        survivors:[],evacuated:0,heroDefeated:false,damageToLian:0,actorCooldown:0};
      this.storyBeat('opening','七日前写好的结局',[
        '你在村口的处刑架上醒来。胸口钉着告示：“第三日，勇者将在此斩杀魔王。”落款，却是七天前。',
        '少女将断刀塞进你手里：“先别死。我还没把所有人送出去。”',
        '她叫黎安。她知道你的死期，也知道锁扣藏在哪里。']);
      this.rescue={active:false,status:'waiting',x:bell.x,y:bell.y,danger:0,progress:0,rescuer:null,heat:0};
    };
    P.storyBeat=function(id,title,lines){
      if(!this.story)this.initStory();if(this.story.seen.includes(id))return false;
      this.story.seen.push(id);const beat={id,title,lines:[...lines],night:this.night};this.story.history.push(beat);
      if(this.story.history.length>18)this.story.history.shift();this.addLog(lines[0]);this.emit('story',{id,title,text:lines.join('\n'),lines});return true;
    };
    P.currentScene=function(){
      if(!this.story)this.initStory();const s=this.story;
      if(s.ending)return {title:s.ending.title,lines:[...s.ending.lines],objective:'这份结局已写入结局册。',night:this.night};
      if(this.phase==='interlude'||this.phase==='reward'){
        const lines=this.night===1?[
          s.lian.alive?(s.flags.aid?'黎安擦去伤员脸上的灰：“他以后说起今晚，不会只记得你展示的力量。”':'黎安把伤员拖向侧门，抬头看了你一眼。她没有求你。'):'黎安没能走过第一夜。她袖口的草稿，还有一句未写完的话。',
          this.stats.delivered?'有人已经把亲眼看见的事带到了边境。勇者收到的，不会只有最初那封信。':'没有新的见闻抵达。讨伐者仍相信最初那封告急信。',
          s.lian.alive?'黎安：“再撑一夜。第二声钟响之前，我会告诉你那封信是谁写的。”':'旧抄写台上，还有她没来得及销毁的原稿。'
        ]:this.night===2?[
          s.flags.forgeryKnown?'信上的字迹，与你看见的草稿一模一样。':s.lian.alive?'旧抄写台上还留着第一封告急信。黎安反复回头看那里。':'旧抄写台上还留着第一封告急信。写信的人已经没有机会再回头。',
          !s.lian.alive?'原稿还在，写信的人却没能向村民亲口承担责任。':s.flags.confessed?'她向幸存者承认：“我写了一场讨伐。代价却是一个我从未问过名字的人。”':s.flags.forgeryKnown?'她还没有向村民说出原稿的来历。你已知道，沉默也是一种决定。':'你还不知道第一封信是谁写的。旧抄写台仍留着原稿。',
          '第三声钟将引来黑潮。圣钟是这座村庄剩下的庇护。'
        ]:[
          s.flags.bindingKnown?'誓约原文写着：“首位见证者，与魔王同入钟内。”黎安的名字在旁边。':'钟下的誓约原文还没有被你带出来。勇者已经踏上讨伐的道路。',
          !s.lian.alive?'她的声音已经消失。留下的原稿，还能揭示她做过的事。':s.flags.lianFreed?'你解开了她的锁。她没有说谢谢，只把原稿攥得更紧。':'黎安被押向圣钟。她也终于发现，信的签署者要付出什么。',
          '勇者到了。你们争夺的，既是生存，也是这座村庄会被怎样记住。'
        ];
        return {title:['第一声钟之后','第二声钟之后','第三声钟之前'][this.night-1],lines,objective:this.night<3?'继续下一夜':'前往圣钟，与勇者交战',night:this.night};
      }
      const beat=s.history[s.history.length-1];return {title:beat.title,lines:[...beat.lines],objective:(this.storyObjective()||{}).title||'活过第三声钟',night:this.night};
    };
    P.addStoryActor=function(key,x,y){
      const s=this.story;if(key==='lian'&&!s.lian.alive||key==='wounded'&&!s.wounded.alive)return null;
      const existing=this.entities.find(e=>e.storyActor===key&&!e.gone);if(existing)return existing;
      const e=this.spawn('villager',x,y);e.type='storyActor';e.storyActor=key;e.name=key==='lian'?'黎安':'受伤的守门人';e.role=key==='lian'?'誓约抄写员':'被留下的伤员';e.feared=false;e.speed=key==='lian'?110:0;
      e.hp=key==='lian'?s.lian.hp:s.wounded.hp;e.maxHp=key==='lian'?90:32;e.status=key==='lian'?s.lian.status:'等待援手';return e;
    };
    P.storyActors=function(){return this.entities.filter(e=>e.storyActor&&!e.gone&&e.hp>0);};
    P.populateNight=function(){
      basePopulate.call(this);if(!this.story)this.initStory();if(this.story.disabled)return;this.clearEncounter&&this.clearEncounter();
      this.story.stage=this.night===1&&!this.story.flags.escaped?'escape':'night'+this.night;
      this.story.hold=0;this.story.holding=null;
      if(this.night===1){this.addStoryActor('lian',850,955);this.addStoryActor('wounded',1230,890);}
      else if(this.night===2){this.addStoryActor('lian',1065,905);}
      else {this.story.lian.status='被押往圣钟';this.addStoryActor('lian',bell.x+90,bell.y+90);}
      if(this.messages){this.messages.latest=null;this.messages.latestByDirection={};}
    };
    P.storyTargets=function(){
      if(!this.story||this.story.disabled||this.story.ending)return [];const s=this.story,f=s.flags;
      const target=(id,title,hint,x,y,seconds,required=false)=>({id,title,hint,x,y,r:80,seconds,required,hold:s.holding===id?s.hold/seconds:0,completed:false});
      if(s.stage==='defense')return s.defense.posts.filter(p=>!s.defense.secured.includes(p.id)).map(p=>target(p.id,'扶稳边界阵位','按住 E 修复阵位，并抵御黑潮。两个阵位守住后才能解除誓约。',p.x,p.y,2,true));
      if(this.phase==='resolution'){
        if(f.bellBroken)return [target('leave','带幸存者离开','靠近村外路标，按住 E 集合。故乡将失去圣钟的庇护。',180,1230,3,true)];
        const out=[target('seal','接受封印','按住 E 入钟。你与见证者将成为庇护的代价。',bell.x,bell.y,3),
          target('crown','占领传信台','按住 E 夺取圣钟与传信台。你的命令将成为新秩序。',bell.x+180,bell.y+105,3),
          target('break','打碎圣钟','按住 E 拆毁誓约钟芯，再带幸存者走向村外。',bell.x-180,bell.y+105,3)];
        if(this.canUnwrite())out.push(target('unwrite','与勇者解除誓约','见证者的原稿与真实证言已齐。按住 E 共同解除，放弃身份赋予的力量。',bell.x,bell.y-120,4));
        return out;
      }
      if(this.phase!=='raid')return [];
      if(!f.escaped)return [target('escape','挣脱处刑架','靠近锁扣，按住 E。先活着走出去。',900,965,.8,true)];
      if(this.night===1){
        if(s.wounded.alive&&!f.aid)return [target('aid','帮伤员打开侧门','靠近伤员按住 E。他亲眼见过你的攻击，也会记得你是否停下。',1230,890,1.7)];
        if(s.evacuated<2)return [target('evacuate','护送侧门的人撤离','靠近侧门按住 E，为仍活着的人打开撤离道路。',1140,1160,1.8)];
      }
      if(this.night===2){
        if(!f.forgeryKnown)return [target('letter','找到第一封告急信','去旧抄写台，按住 E 读出原稿。',1024,900,1.4)];
        if(s.lian.alive&&!f.confessed){const e=this.storyActors().find(a=>a.storyActor==='lian')||s.lian;return [target('confess','请黎安公开原稿','靠近黎安按住 E。承认责任，必须让真正的目击者听见。',e.x,e.y,2)];}
      }
      if(this.night===3){
        if(!f.bindingKnown)return [target('pact','读出圣钟的誓约','靠近钟下原文按住 E。找到封印必须付出的代价。',bell.x-75,bell.y+195,1.5)];
        if(s.lian.alive&&!f.lianFreed){const e=this.storyActors().find(a=>a.storyActor==='lian')||s.lian;return [target('free','解开黎安的见证锁','靠近黎安按住 E。她曾替你决定死亡，你仍可以决定是否把她带回来。',e.x,e.y,2)];}
      }
      return [];
    };
    P.storyObjective=function(){
      const targets=this.storyTargets();if(!targets.length)return null;
      if(this.phase==='resolution')return [...targets].sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0];
      return targets[0];
    };
    P.storyAction=function(id){
      const target=this.storyTargets().find(t=>t.id===id);if(!target||distance(this.player,target)>target.r)return false;
      const s=this.story,f=s.flags;
      if(id==='escape'){f.escaped=true;s.stage='night1';s.lian.status='转移伤员';this.storyBeat('escape','一个尚未发生的罪名',[s.lian.alive?'锁扣落地。黎安把断刀收回：“他们还没有看见你做过什么，就已经决定了你的名字。”':'锁扣落地。断刀上仍沾着黎安的血。告示却已决定了你的名字。','村庄外，黑潮正在逼近。第三声钟之前，活下去。']);}
      if(id==='aid'){
        f.aid=true;s.wounded.helped=true;s.wounded.hp=32;const actor=this.storyActors().find(e=>e.storyActor==='wounded');if(actor){actor.hp=32;actor.status='已打开撤离路';}
        this.observeStoryFact&&this.observeStoryFact('mercy',target);this.storyBeat('aid','他会记住两件事',['伤员退缩了一下，才将压住门闩的手松开。',s.lian.alive?'黎安：“他知道你能杀他。现在，他还知道你停了下来。”':'他认出了你手里的断刀。黎安已经不能替你解释，他仍亲眼看见了你停下来。']);
      }
      if(id==='evacuate'){
        const living=this.entities.filter(e=>!e.gone&&e.hp>0&&e.type==='villager'&&!e.report&&!e.storyActor&&distance(e,target)<600).slice(0,2);
        if(!living.length&&!s.wounded.helped){this.emit('story',{text:'侧门没有仍能行走的人。先寻找幸存者。'});return false;}
        for(const e of living){e.gone=true;s.survivors.push({id:e.id,name:e.name||'侧门村民',alive:true});}
        if(s.wounded.helped&&!s.survivors.some(e=>e.id==='wounded'))s.survivors.push({id:'wounded',name:'守门人',alive:true});
        s.evacuated=s.survivors.length;this.observeStoryFact&&this.observeStoryFact('mercy',target);this.storyBeat('evac','侧门之外',[`你打开了侧门。${s.evacuated} 名活着的人越过封锁。`,s.lian.alive?'黎安站在最后一个人身后，等他走出去，才转向你。':'最后一个人跨过门槛。没人再在黎安曾站过的位置，替你数下一次脚步。']);
      }
      if(id==='letter'){f.forgeryKnown=true;this.storyBeat('letter','写信的人',['告急信里，每一道“魔王造成的伤口”，都写在你醒来之前。',s.lian.alive?'黎安：“是我写的。没有勇者愿意为一个普通村落赶来。我以为，把你放出来，就能给他们一个理由。”':'原稿的落款，是黎安。背面写着：“没有勇者愿意为一个普通村落赶来。我必须给他们一个魔王。”',s.lian.alive?'“我以为可以先救人，再偿还你的命。”':'她没能留下自己的答辩。']);}
      if(id==='confess'){f.confessed=true;this.observeStoryFact&&this.observeStoryFact('confession',target);this.storyBeat('confess','把自己的名字写上去',['黎安当着幸存者展开原稿：“第一封告急信是我伪造的。你们看见的袭击是真的，信里更早的那些，是我写的。”','有人骂她，有人仍问她今晚住在哪里。她没有辩解。']);}
      if(id==='pact'){f.bindingKnown=true;this.storyBeat('pact','见证者的代价',['誓约原文：“首位见证者，与魔王同入钟内。”旁边是黎安的签名。',s.lian.alive?'她把纸翻到背面，又翻回来。没有另一条条款。':'纸上仍有她反复翻折留下的印痕。没有另一条条款。','远处的讨伐队正在准备最后一声钟。']);}
      if(id==='free'){f.lianFreed=true;s.lian.status='守着原稿';this.rescue.status='saved';this.rescue.rescuer='player';this.observeStoryFact&&this.observeStoryFact('mercy',target);this.storyBeat('free','断开的见证锁',['锁扣断开。黎安没有立刻靠近你。','“那封信里，你没有选择。”她把原稿递过来，“这一次，你有。”']);}
      if(id==='seal')return this.completeEnding('sealed');
      if(id==='crown')return this.completeEnding('crown');
      if(id==='break'){f.bellBroken=true;s.survivors=s.survivors.filter(a=>a.alive);
        if(s.lian.alive&&f.lianFreed&&!s.survivors.some(a=>a.id==='lian'))s.survivors.push({id:'lian',name:'黎安',alive:true});
        for(let i=0;i<s.survivors.length;i++){if(s.survivors[i].id==='lian')continue;const e=this.spawn('villager',this.player.x+30+i*15,this.player.y+70);e.type='storyActor';e.storyActor='refugee';e.name=s.survivors[i].name;e.role='撤离幸存者';e.refugeeId=s.survivors[i].id;e.hp=e.maxHp=36;}
        this.storyBeat('broken-bell','第三声钟没有响',['钟芯裂开，黑潮的声音越过院墙。','勇者撑着断剑站起来：“带他们走。你摧毁的，是他们最后的屋顶。”']);this.effect('legend',bell.x,bell.y,230,1);}
      if(id==='leave'){
        if(!s.survivors.length){this.emit('story',{text:'没有幸存者抵达。圣钟已碎，你只能独自离开。'});return this.completeEnding('exile');}
        const refugees=this.storyActors().filter(e=>e.storyActor==='refugee'||e.storyActor==='lian'&&f.lianFreed);
        if(refugees.some(e=>distance(e,target)>120)){this.emit('story',{text:'有人还没有跟上。先在出口等他们集合。'});return false;}
        return this.completeEnding('exile');
      }
      if(id==='unwrite'&&this.canUnwrite())return this.beginSharedDefense();
      if(s.stage==='defense'&&s.defense.posts.some(p=>p.id===id)){s.defense.secured.push(id);this.effect('level',target.x,target.y,85,.5);}
      this.emit('story-progress',{id,text:target.title+' · 完成'});return true;
    };
    P.canUnwrite=function(){const s=this.story;return !!s&&s.heroDefeated&&s.lian.alive&&s.flags.confessed&&s.flags.lianFreed&&s.flags.heroMercy&&s.flags.heroConfession&&s.flags.bindingKnown;};
    P.onStoryMessage=function(packet){
      if(!this.story)return;const f=this.story.flags;
      if(packet.facts.includes('mercy')&&packet.actions.length>0)f.heroMercy=true;
      if(packet.facts.includes('confession'))f.heroConfession=true;
    };
    P.tickStoryActor=function(e,dt){
      const s=this.story;if(!s||s.disabled||e.gone)return;
      if(e.storyActor==='refugee'){
        this.walkTo(e,{x:this.player.x+e.id%4*14,y:this.player.y+45},135,dt);return;
      }
      if(e.storyActor==='lian'){
        const goal=s.stage==='defense'?{x:1024,y:1080}:this.night===1?(s.flags.escaped?{x:1190,y:940}:{x:850,y:955}):this.night===2?{x:1065,y:905}:
          s.flags.lianFreed?{x:this.player.x-65,y:this.player.y+45}:{x:bell.x+90,y:bell.y+90};
        if(distance(e,goal)>35)this.walkTo(e,goal,s.flags.lianFreed?110:75,dt);
        s.lian.x=e.x;s.lian.y=e.y;s.lian.hp=e.hp;e.status=s.lian.status;
      }
      // Narrative participants stay visible and vulnerable. They are not automatic enemy targets.
      const p=this.player,stats=this.flameStats();let harm=0;
      if(p.fireActive&&this.path!=='field'&&distance(e,p)<stats.range+e.r&&Math.abs(angleDiff(Math.atan2(e.y-p.y,e.x-p.x),p.angle))<stats.width&&this.clearLine(p,e,2))harm+=stats.damage*dt;
      for(const field of this.fields)if(field.state==='burning'&&distance(field,e)<field.r+e.r&&this.clearLine(field,e,2))harm+=stats.damage*.75*dt;
      if(p.dashTime>0&&distance(p,e)<p.r+e.r+12&&!(p.dashHits||[]).includes(e.id)){p.dashHits.push(e.id);harm+=this.forceStats?this.forceStats().damage:40;}
      if(harm>0)this.damageStoryActor(e,harm);
    };
    P.damageStoryActor=function(e,amount){
      if(!e||e.gone||e.hp<=0)return;e.hp=Math.max(0,e.hp-amount);e.flash=.15;
      const s=this.story;
      if(e.storyActor==='lian'){s.lian.hp=e.hp;s.damageToLian+=amount;}
      if(e.storyActor==='wounded')s.wounded.hp=e.hp;
      if(e.hp===0){e.gone=true;if(e.storyActor==='lian'){s.lian.alive=false;s.lian.status='死亡';this.storyBeat('lian-dead','没有写完的原稿',['黎安倒下时，手仍压着那封信。','这一次，没有人能替她说出最后一句话。']);}
        else if(e.storyActor==='wounded'){s.wounded.alive=false;this.storyBeat('wounded-dead','关上的侧门',['守门人的手从门闩上滑落。侧门后的人退回了黑暗。']);}
        else if(e.storyActor==='refugee'){const survivor=s.survivors.find(a=>a.id===e.refugeeId);if(survivor)survivor.alive=false;}}
    };
    P.damageEnemy=function(e,amount,...rest){if(e&&e.storyActor){this.damageStoryActor(e,amount);return amount;}const damage=baseDamage.call(this,e,amount,...rest);
      if(e&&e.hp<=0&&e.character&&this.story){const survivor=this.story.survivors.find(a=>a.id===e.character);if(survivor)survivor.alive=false;}return damage;};
    P.roarWave=function(source,radius,duration,knock,echo=false,damage=this.roarStats().damage,inner=this.roarStats().inner){
      const result=baseRoarWave.call(this,source,radius,duration,knock,echo,damage,inner);
      if(this.story&&!this.story.disabled)for(const e of this.storyActors())if(distance(e,source)<inner+e.r&&distance(e,source)<=radius&&this.clearLine(source,e,2))this.damageStoryActor(e,damage);return result;
    };
    P.earthWave=function(){
      const p=this.player,angle=p.dashAngle,effectStart=this.effects.length;const result=baseEarth.call(this);
      const fx=this.effects.slice(effectStart).find(e=>e.kind==='earth');
      if(fx&&this.story&&!this.story.disabled){const end={x:p.x+Math.cos(angle)*fx.radius,y:p.y+Math.sin(angle)*fx.radius};for(const e of this.storyActors())if(segmentDistance(e,p,end)<=24+e.r&&this.clearLine(p,e,2))this.damageStoryActor(e,this.forceStats().damage);}return result;
    };
    P.tickPlunge=function(dt){const plunge=this.player.plunge&&{...this.player.plunge};const result=basePlunge.call(this,dt);
      if(plunge&&!this.player.plunge&&this.story&&!this.story.disabled)for(const e of this.storyActors())if(distance(e,plunge.end)<plunge.radius+e.r&&this.clearLine(plunge.end,e,2))this.damageStoryActor(e,plunge.damage);return result;};
    P.releaseLance=function(){const start=this.effects.length,result=baseLance.call(this),fx=this.effects.slice(start).find(e=>e.kind==='beam');
      if(fx&&this.story&&!this.story.disabled){const end={x:fx.x+Math.cos(fx.angle)*fx.radius,y:fx.y+Math.sin(fx.angle)*fx.radius};for(const e of this.storyActors())if(segmentDistance(e,fx,end)<=11+e.r&&this.clearLine(fx,e,2))this.damageStoryActor(e,this.flameStats().damage);}return result;};
    P.tickScheduled=function(dt){const start=this.effects.length,result=baseScheduled.call(this,dt);
      if(this.story&&!this.story.disabled)for(const fx of this.effects.slice(start).filter(e=>e.kind==='explosion'))for(const e of this.storyActors())if(distance(e,fx)<fx.radius+e.r&&this.clearLine(fx,e,2))this.damageStoryActor(e,.6*this.flameStats().damage);return result;};
    P.playerDamage=function(amount){
      if(this.story&&!this.story.disabled&&this.night===1&&!this.story.flags.escaped&&this.time<5&&distance(this.player,{x:900,y:965})<90)return;
      if(this.story&&this.story.stage==='defense'&&this.hero&&distance(this.player,this.hero)<85)amount*=.6;return basePlayerDamage.call(this,amount);
    };
    P.igniteSeeds=function(){
      const seeds=this.path==='field'?this.fields.filter(f=>f.state==='seed').map(f=>({...f})):[];const result=baseIgnite?baseIgnite.call(this):false;
      if(seeds.length&&this.story&&!this.story.disabled)for(const actor of this.storyActors()){const hits=seeds.filter(f=>distance(f,actor)<f.r+actor.r&&this.clearLine(f,actor,2)).length;if(hits)this.damageStoryActor(actor,hits*this.flameStats().damage);}
      return result;
    };
    P.interact=function(){
      const reporter=this.activeReport&&this.activeReport();if(reporter&&distance(reporter,this.player)<80)return baseInteract.call(this);
      // Story holds are processed in tickStory; the regular E press does not skip them.
      if(this.storyTargets().some(t=>distance(this.player,t)<t.r))return;
      return baseInteract.call(this);
    };
    P.tickStory=function(dt,input={}){
      if(!this.story||this.story.disabled||this.story.ending)return;const s=this.story;
      if(s.stage==='defense'){
        const defense=s.defense;defense.time+=dt;
        if(!s.lian.alive){this.phase='defeat';this.emit('defeat',{text:'见证者没能守到解除誓约。黑潮越过了阵位。'});return;}
        if(this.hero){const post=defense.posts[0];if(distance(this.hero,post)>45)this.walkTo(this.hero,post,95,dt);
          else if(!defense.secured.includes(post.id)){defense.heroRepair+=dt;if(defense.heroRepair>=3){defense.secured.push(post.id);this.effect('level',post.x,post.y,85,.5);this.emit('story-progress',{text:'勇者扶稳了西侧阵位'});}}}
        if(defense.waves<3&&defense.time>=defense.waves*8){const p=defense.posts[defense.waves%2];for(let i=0;i<2;i++){const e=this.spawn('militia',p.x+150+i*50,p.y+170);e.name='黑潮';e.hp=e.maxHp=64;e.speed=92;}defense.waves++;}
        if(defense.time>=24&&defense.secured.length===2&&!this.entities.some(e=>!e.gone&&e.hp>0&&e.name==='黑潮'))return this.completeEnding('unwritten');
      }
      if(this.phase==='raid'){
        if(this.night===1&&this.time>25)this.storyBeat('night1-cost','先救谁',[s.lian.alive?'黎安拖着伤员向侧门走。你可以继续追击，也可以停下来替她打开门。':'侧门边还有受伤的人。黎安的脚步声却不会再来。']);
        if(this.night===2&&this.time>20&&!s.flags.forgeryKnown)this.storyBeat('night2-letter','原稿还在',[s.lian.alive?'黎安袖口落下一张草稿。那上面，写着七日前的日期。旧抄写台就在道路尽头。':'旧抄写台上还留着她的草稿。那上面，写着七日前的日期。']);
        if(this.night===3&&this.time>15)this.storyBeat('night3-bound','最后的见证者',s.lian.alive?['黎安被押向圣钟，手里还抓着原稿。','勇者没有拔剑。他看着你：“只剩这一夜。我也没有第二座钟。”']:['圣钟下放着黎安的原稿。勇者仍需要一个魔王，让誓约完成。']);
      }
      const target=this.storyTargets().find(t=>distance(this.player,t)<t.r);
      const reporter=this.activeReport&&this.activeReport();
      if(target&&input.interact&&!(reporter&&distance(reporter,this.player)<80)){
        if(s.holding!==target.id){s.holding=target.id;s.hold=0;}
        s.hold+=dt;if(s.hold>=target.seconds){s.holding=null;s.hold=0;this.storyAction(target.id);}
      }else{s.hold=0;s.holding=null;}
    };
    P.tickResolution=function(dt,input={}){
      if(this.phase!=='resolution')return;
      this.time+=dt;this.totalTime+=dt;const p=this.player;
      const dx=input.mx||0,dy=input.my||0,d=Math.hypot(dx,dy);if(d)this.move(p,dx/d*185*dt,dy/d*185*dt);
      this.effects.forEach(e=>e.life-=dt);this.effects=this.effects.filter(e=>e.life>0);
      for(const e of this.storyActors())if(e.storyActor==='refugee'||e.storyActor==='lian'&&this.story.flags.lianFreed)this.walkTo(e,{x:p.x-50+e.id%3*15,y:p.y+40},e.storyActor==='refugee'?135:110,dt);
      this.tickStory(dt,input);
    };
    P.finishNight=function(){
      if(this.phase!=='raid')return;
      if(this.story&&!this.story.disabled){for(const actor of this.storyActors())if(actor.storyActor==='lian'){this.story.lian.hp=actor.hp;this.story.lian.x=actor.x;this.story.lian.y=actor.y;}
        for(const e of this.entities.filter(e=>!e.storyActor&&!e.gone&&e.hp>0&&e.type==='villager'))if(e.character&&!this.story.survivors.some(s=>s.id===e.character))this.story.survivors.push({id:e.character,name:e.name,alive:true});
      }
      baseFinish.call(this);
    };
    P.startBoss=function(){
      baseBoss.call(this);if(!this.story||this.story.disabled)return;
      this.story.stage='boss';this.addStoryActor('lian',bell.x+110,bell.y+130);
      this.storyBeat('hero','第三声钟之前',[
        this.story.flags.heroMercy?'勇者：“有人说你打开过侧门。我相信那个人。可城外的黑潮，不会因为你做过一件好事就退回去。”':'勇者：“我收到的是一封告急信，还有幸存者的见闻。我不能拿他们的命赌你会停手。”',
        this.story.lian.alive?'黎安：“那封信是我写的。要有人付代价，就写我的名字。”\n勇者：“上面已经有你的名字。还差他的。”':'勇者看着黎安留下的原稿：“写信的人已经死了。誓约仍要一个魔王。”'
      ]);
      // The story actors and all knowledge belong to the same retry checkpoint as the battle.
      const events=this.events;this.events=[];this.checkpoint=clone({...this,checkpoint:null});this.events=events;
    };
    P.onHeroDefeated=function(){
      if(!this.story||this.story.disabled)return false;const s=this.story;s.heroDefeated=true;s.stage='resolution';this.phase='resolution';this.time=0;this.fields=[];this.scheduled=[];
      this.player.fireActive=false;this.player.fireHeld=false;this.player.dashTime=0;
      for(const e of this.entities)if(!e.storyActor&&e.type!=='villager')e.gone=true;
      this.storyBeat('resolution','你赢了战斗，钟还没有停',[
        '勇者撑住断剑。黑潮的第一道影子已经越过城外的麦田。',
        this.canUnwrite()?'真实证言已经抵达，黎安也承担了自己的责任。勇者愿意与你一起解开誓约。':'你可以接受封印、夺取圣钟，或毁掉它，带活着的人离开。没有一种选择能让昨夜重来。'
      ]);this.emit('resolution',{text:'走向圣钟、传信台或钟芯，按住 E 作出最后行动。'});return true;
    };
    P.onPlayerDefeated=function(){return false;};
    P.beginSharedDefense=function(){
      if(!this.canUnwrite())return false;const s=this.story;s.stage='defense';this.phase='boss';this.time=0;
      s.defense={time:0,waves:0,secured:[],heroRepair:0,posts:[{id:'defend-west',x:840,y:780},{id:'defend-east',x:1160,y:805}]};
      if(this.hero){this.hero.ally=true;this.hero.ward=null;this.hero.anchor=null;}
      s.lian.status='护着原稿';const lian=this.storyActors().find(e=>e.storyActor==='lian');if(lian){lian.x=1024;lian.y=1080;}
      this.fields=[];this.pets=[];
      this.player.hp=Math.max(this.player.hp,this.player.maxHp*.65);this.player.energy=this.player.maxEnergy;
      this.player.roarCooldown=0;this.player.dashCharges=this.player.dashMax;
      this.storyBeat('shared-defense','没有永远正确的守护者',['勇者将断剑撑在西侧阵位：“先一起挡住它，再解除誓约。”','你仍有整局积累的力量。黑潮仍在逼近。修复两处边界阵位，守住这一次，才有机会写下一页。']);return true;
    };
    P.completeEnding=function(id){
      if(!['resolution','boss'].includes(this.phase)||!ENDINGS[id]||id==='unwritten'&&(!this.canUnwrite()||this.story.stage!=='defense'||this.story.defense.time<24||this.story.defense.secured.length<2))return false;
      const s=this.story,alive=s.lian.alive,freed=s.flags.lianFreed;
      if(id==='unwritten'){for(const key of this.qualities())this.ranks[key]=0;this.path=null;this.legend=false;this.fields=[];this.pets=[];}
      const lines={
        sealed:['第三声钟终于响起。黑潮退到村外，你的身体成为钟内的一道影子。',alive?'黎安将自己的名字刻在你旁边。她第一次没有替你写下选择。':'黎安的原稿被带入钟内。告示上的名字，却仍只有魔王。','人们庆祝勇者的胜利。很久以后，仍有人在钟下听见两个不同的故事。'],
        crown:['你将勇者的断剑钉在传信台上，命令每一封信先经过你的手。圣钟向你俯首。',alive?(freed?'黎安留下整理档案。她保留了第一封假信，也保留了你不肯公开的那一页。':'黎安在钟下看着新的告示。写告示的人换了，代价仍由别人承担。'):'黎安的原稿被封进王冠底座。再也没有人能当面质问它。','黑潮停在边界之外。村民得到庇护，也学会在开口之前看你的脸色。'],
        exile:[s.survivors.length?'圣钟碎了，庇护随之消失。你沿村外的路，带着能够行走的人离开。':'圣钟碎了，庇护随之消失。你独自走向村外，没有一个幸存者跟上。',alive?(freed?'黎安走在最后，逐个记下幸存者的名字。她没有把自己从责任里划掉。':'你没有解开黎安的锁。最后一次回头时，圣钟下的身影已经被黑潮吞没。'):'没有人再帮你写信。你把她的原稿带在身上，沿路寻找愿意听的人。',s.survivors.length?`${s.survivors.length} 名有名字的幸存者走向陌生的土地。远方的告示，却说魔王毁灭了村庄。`:'你没有带出一个已经认识的人。外界只看见村庄的废墟，和一个离开的魔王。'],
        unwritten:['黎安读出第一封信，也读出每一份不同的证言。勇者将断剑放下，你熄灭最后一团火。','誓约失去固定的魔王与永远正确的勇者。力量从你们身上退去，黑潮仍在城外。','你们把圣钟拆成沿村界的七座小钟，每一座都需要活着的人守护。没有人再保证永远的胜利。','很多年后，孩子问黎安谁救了村庄。她打开那本写满争论的册子：“我们还在写。”']
      };
      s.ending={id,title:ENDINGS[id].title,lines:lines[id],witnesses:this.testimony(),facts:clone(s.flags)};s.stage='epilogue';this.phase='victory';
      this.emit('ending',{id,title:s.ending.title,text:s.ending.lines.join('\n')});this.emit('victory');return true;
    };
    P.getEnding=function(){return this.story&&this.story.ending?clone(this.story.ending):null;};
    P.endingHints=function(){return Object.entries(ENDINGS).map(([id,v])=>({id,title:v.title,hint:v.hint,unlockedHere:id==='unwritten'?this.canUnwrite():!!this.story&&this.story.heroDefeated}));};
    P.testimony=function(){
      if(!this.story)return [];
      return [{name:'铁匠洛安',text:this.characters.smith.down?'“他打倒过我。最后是什么结局，都不能抹去这件事。”':this.stats.broken?'“围栏倒下以后，路也变了。走过那里的人，都有自己的说法。”':'“铁匠铺还在。后来发生的事，我只敢说自己看见的部分。”'},
        {name:'守粮人阿禾',text:this.characters.grain.down?'“我记得攻击，也记得谁还活着。别只挑你想听的那一句。”':this.story.flags.aid?'“他打开过伤员的门。我看见的帮助，也不能替别人否认受到的伤。”':'“有人继续战斗，有人停下来。我会把看见的事照实说。”'},
        {name:'誓约抄写员黎安',text:!this.story.lian.alive?'她没能写出最后一句。留下的原稿，记录着第一封信的责任。':this.story.flags.confessed?'“第一封信是我写的。最后这一页，我不能再替任何人决定。”':'“我还有一句话没敢说出口。原稿没有因此变成真的。”'}];
    };
    // The old fire/beam side quest does not belong to this story.
    P.activateRescue=function(){};P.tickRescue=function(){};P.saveVillager=function(){};
    return api;
  }
  return {install};
});
