/* D12 campaign changes. Archived Game and D10 sample keep their original rules. */
(function(root,factory){
  const plugin=factory();
  if(typeof module==='object'&&module.exports)module.exports=plugin;
  else{root.DemonD12=plugin;plugin.install(root.DemonCampaign.CampaignGame,root.DemonDemo);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LENGTHS=[90,105,120],TRAITS={flame:'喷火',fear:'震击',force:'冲撞',dragon:'熔穿火束',field:'囤火引爆',chain:'连锁爆燃',echo:'延迟回声',phantom:'追击恐影',judgement:'声印审判',earth:'裂地波',return:'折返冲撞',plunge:'天坠砸击'};
  function install(CampaignGame,api){
    const P=CampaignGame.prototype;if(P.d12Installed)return;P.d12Installed=true;
    const {TERMS,DIRECTIONS,distance}=api,dirs=Object.keys(DIRECTIONS);
    const baseTick=P.tick,basePopulate=P.populateNight,baseGenerate=P.generateChoices,baseOpen=P.openChoices,baseEmit=P.emit,
      baseDeliver=P.deliverReport,baseInteract=P.interact,baseDamage=P.damageEnemy,baseObserve=P.observeAction,baseRelease=P.releaseEncounter;
    P.nightLength=function(){return LENGTHS[this.night-1]||120;};
    P.growthDirectionStatus=function(kind=this.phase==='reward'?'reward':'upgrade'){
      const previous=this._d10ChoiceKind;this._d10ChoiceKind=kind;
      const legal=this.legalTerms(),raw=this.directionProbabilities(),available=dirs.filter(d=>legal.some(k=>TERMS[k].dir===d)),weights=this.directionProbabilities(available);
      this._d10ChoiceKind=previous;
      const highest=Math.max(...dirs.map(d=>raw[d])),leaders=dirs.filter(d=>raw[d]===highest);
      return Object.fromEntries(dirs.map(d=>{const pool=legal.filter(k=>TERMS[k].dir===d);return[d,{reports:this.rumors[d]||0,remaining:pool.length,normal:pool.filter(k=>!TERMS[k].quality).length,quality:pool.filter(k=>TERMS[k].quality).length,
        weight:weights[d]||0,favored:leaders.length===1&&leaders[0]===d&&highest>=.5&&pool.length>0,empty:pool.length===0}];}));
    };
    P.generateChoices=function(kind){
      const state=this.growthDirectionStatus(kind),favored=dirs.find(d=>state[d].favored);
      this.d12Misses=this.d12Misses||{flame:0,fear:0,force:0};this._d12Protected=null;
      const keys=baseGenerate.call(this,kind);
      if(favored&&this.d12Misses[favored]>=2&&!keys.some(k=>TERMS[k].dir===favored)){
        const previous=this._d10ChoiceKind;this._d10ChoiceKind=kind;
        const pool=this.legalTerms(keys,true).filter(k=>TERMS[k].dir===favored),normals=pool.filter(k=>!TERMS[k].quality);
        this._d10ChoiceKind=previous;
        const choices=normals.length?normals:pool;
        if(choices.length){const key=choices[Math.floor(this.random()*choices.length)];
          let slot=TERMS[key].quality?keys.findIndex(k=>TERMS[k].quality):keys.findIndex(k=>!TERMS[k].quality);
          if(slot<0)slot=keys.length-1;if(slot>=0){keys[slot]=key;this._d12Protected=favored;}
        }
      }
      for(const d of dirs)this.d12Misses[d]=d===favored&&!keys.some(k=>TERMS[k].dir===d)?this.d12Misses[d]+1:0;
      return keys;
    };
    P.openChoices=function(kind){
      const existing=this.choicePage,opened=baseOpen.call(this,kind);
      if(opened&&this.choicePage!==existing){this.choicePage.directionState=this.growthDirectionStatus(kind);this.choicePage.protectedDirection=this._d12Protected;
        this.choicePage.reportCounts=Object.fromEntries(dirs.map(d=>[d,this.rumors[d]||0]));}
      return opened;
    };
    P.populateNight=function(){basePopulate.call(this);this.d12Spawns=[];this.d12NightReady=false;this.d12ClearedAt=null;
      Object.assign(this.d10Wave,{nextAt:10,clearedAt:null});};
    P.spawnD10Group=function(){
      const w=this.d10Wave,count=2+this.night,p=this.player,group=w.groups,index=w.index;
      this.d12Spawns=this.d12Spawns||[];
      const phase=this.random()*Math.PI*2;let points=[];
      for(let i=0;i<count;i++){
        let spot=null;
        for(let n=0;n<48;n++){const a=phase+(n%12)*Math.PI/6+(i-(count-1)/2)*.11,r=320+Math.floor(n/12)*38;
          const candidate={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};
          if(!this.blocked(candidate.x,candidate.y,15)&&this.clearLine(p,candidate,15)&&!points.some(s=>distance(s,candidate)<26)){spot=candidate;break;}}
        if(!spot)for(let n=0;n<80;n++){const a=phase+n*.43,r=300+(n%5)*28,candidate={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(!this.blocked(candidate.x,candidate.y,15)){spot=candidate;break;}}
        if(!spot)continue;points.push(spot);
        this.d12Spawns.push({...spot,left:.85,index,group,elite:this.night>1&&i===0&&group===1,type:'militia'});this.effect('arrival',spot.x,spot.y,24,.85);
      }
      if(group===0&&index%3===0&&points[0]){const s=points[0],candidate={x:s.x+34,y:s.y+34};if(!this.blocked(candidate.x,candidate.y,11))this.d12Spawns.push({...candidate,left:.85,index,group,type:'villager'});}
      w.groups++;this.emit('wave-group',{index,group:w.groups,night:this.night});
    };
    P.flushD12Spawns=function(dt){
      for(const s of this.d12Spawns||[]){s.left-=dt;if(s.left>0)continue;const e=this.spawn(s.type,s.x,s.y);e.d10Wave=s.index;e.campaignWave=s.index;
        if(s.elite){e.elite=true;e.name=this.night===2?'誓卫':'王庭誓卫';e.hp=e.maxHp=this.night===2?66:76;e.r=15;}}
      this.d12Spawns=(this.d12Spawns||[]).filter(s=>s.left>0);
    };
    P.tickD10Waves=function(){
      if(this.phase!=='raid')return;const w=this.d10Wave,offsets=w.index===1?[1.5,3.7,5.9]:[0,2.2,4.4];
      while(w.groups<3&&this.time-w.started>=offsets[w.groups])this.spawnD10Group();
      const pending=(this.d12Spawns||[]).length,remaining=this.entities.filter(e=>!e.gone&&e.hp>0&&e.type==='militia').length;
      if(w.groups===3&&!pending&&!remaining){
        w.state='pause';this.tickReports();if(w.clearedAt===null||w.clearedAt===undefined)w.clearedAt=this.time;
        // Give the player a short, visible report window; clearing advances the next encounter.
        if(w.index<9&&this.time-w.clearedAt>=2.6){w.index++;w.started=this.time;w.groups=0;w.state='combat';w.messageReleased=false;w.clearedAt=null;w.nextAt=this.time+10;this.emit('wave',{index:w.index});}
        else if(w.index===9&&!this.d12NightReady){this.d12NightReady=true;this.emit('night-ready',{text:'敌军已退。可以收尾，也可以继续探索、等待送信。'});}
      }else w.state='combat';
      // A slow clear gets reinforcements at bounded intervals, capped at nine waves.
      if(w.index<9&&this.time-w.started>=10+(this.night-1)*1.7){w.index++;w.started=this.time;w.groups=0;w.state='combat';w.messageReleased=false;w.clearedAt=null;w.nextAt=this.time+10;this.emit('wave',{index:w.index});}
    };
    P.waveStatus=function(){const w=this.d10Wave;return{index:w.index,total:9,state:w.state,remainingEnemies:this.entities.filter(e=>!e.gone&&e.hp>0&&e.type==='militia').length,
      incoming:(this.d12Spawns||[]).length,secondsToNext:w.clearedAt!=null?Math.max(0,2.6-this.time+w.clearedAt):Math.max(0,10+(this.night-1)*1.7-this.time+w.started),messagesMax:1,nightReady:!!this.d12NightReady};};
    P.endNightEarly=function(){if(this.phase!=='raid'||!this.d12NightReady||this.tutorialView())return false;return this.finishNight();};
    P.observeAction=function(witness,dir,trait){if(this.time>this.nightLength()-20)return false;return baseObserve.call(this,witness,dir,trait);};
    P.releaseEncounter=function(){if(this.time>this.nightLength()-18)return false;return baseRelease.call(this);};
    P.setTutorialPreferences=function(seen=[]){this.d12TutorialsEnabled=true;this.d12SeenTutorials=[...new Set(seen.filter(k=>typeof k==='string'))];this.d12TutorialQueue=(this.d12TutorialQueue||[]).filter(t=>!this.d12SeenTutorials.includes(t.id));};
    P.queueTutorial=function(id,data={}){if(!this.d12TutorialsEnabled||(this.d12SeenTutorials||[]).includes(id))return;
      this.d12TutorialQueue=this.d12TutorialQueue||[];if(!this.d12TutorialQueue.some(t=>t.id===id))this.d12TutorialQueue.push({id,...data});};
    P.tutorialView=function(){return ['raid','boss','resolution'].includes(this.phase)&&!this.d10Scene&&!this.choicePage&&this.d12TutorialQueue?.length?this.d12TutorialQueue[0]:null;};
    P.acknowledgeTutorial=function(){const view=this.tutorialView();if(!view)return false;this.d12TutorialQueue.shift();this.d12SeenTutorials=[...new Set([...(this.d12SeenTutorials||[]),view.id])];this.emit('tutorial-read',{id:view.id});return true;};
    P.replayTutorials=function(){this.d12SeenTutorials=[];this.d12TutorialQueue=[];this.queueTutorial('report-created',{kind:'flame',replay:true});this.queueTutorial('delivered',{kind:'flame',traits:['flame'],newTraits:['flame'],replay:true});};
    P.emit=function(type,data={}){
      baseEmit.call(this,type,data);
      if(['report-created','delivered','intercepted'].includes(type))this.queueTutorial(type,data);
      if(type==='chosen'&&TERMS[data.key]?.quality)this.queueTutorial('quality-'+data.key,{...data,kind:TERMS[data.key].dir});
      if(['roar','dash','return-dash','plunge','lance','seed-placed','ignition','judgment','judgement','player-hit'].includes(type)&&this.player){this.player.visualAction={type:type==='judgement'?'judgment':type,at:this.totalTime,duration:type==='roar'?.46:type==='player-hit'?.2:.4};}
    };
    P.deliverReport=function(e){if(!e.report)return false;const r=e.report,traits=[...(r.traits||[r.trait])],newTraits=traits.filter(t=>!(this.knownTraits[t]>0)),kind=r.kind;
      // Supply the event before the base delivery emits it, so the first-read card is exact.
      this._d12ReportDetail={traits,newTraits,kind};const oldEmit=this.emit;
      this.emit=function(type,data={}){return oldEmit.call(this,type,type==='delivered'?{...data,traits,newTraits}:data);};
      let result;try{result=baseDeliver.call(this,e);}finally{delete this.emit;delete this._d12ReportDetail;}
      if(result){const names=traits.map(t=>TRAITS[t]||t).join('、');this.addLog(DIRECTIONS[kind].name+'见闻送达：成长更偏向'+DIRECTIONS[kind].name+'；勇者得知'+(names||'这次攻击')+'。');}return result;
    };
    P.interact=function(){const e=this.activeReport(),kind=e?.report?.kind,near=e&&distance(e,this.player)<80;
      if(!near)return baseInteract.call(this);const oldEmit=this.emit;this.emit=function(type,data={}){return oldEmit.call(this,type,type==='intercepted'?{...data,kind}:data);};
      try{return baseInteract.call(this);}finally{delete this.emit;}
    };
    P.damageEnemy=function(e,...args){
      const kind=e?.report?.kind;if(!kind)return baseDamage.call(this,e,...args);
      const hadOwn=Object.hasOwn(this,'emit'),oldEmit=this.emit;
      this.emit=function(type,data={}){return oldEmit.call(this,type,type==='intercepted'?{...data,kind}:data);};
      try{return baseDamage.call(this,e,...args);}finally{if(hadOwn)this.emit=oldEmit;else delete this.emit;}
    };
    P.tick=function(dt,input={}){
      if(this.tutorialView())return;
      if(this.phase==='raid'){if(this.time>=this.nightLength()){this.finishNight();return;}this.flushD12Spawns(Math.min(.05,dt));}
      baseTick.call(this,dt,input);
      if(this.phase==='raid'&&this.time>=this.nightLength())this.finishNight();
    };
  }
  return{install,LENGTHS,TRAITS};
});
