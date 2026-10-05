/* D10 first-night sample. The archived three-night Game is kept unchanged. */
(function(root,factory){
  if(typeof module==='object'&&module.exports){const base=require('./core.js'),api=factory(base);module.exports=api;require('./d10-scenes.js').install(api.D10Game,base);}
  else{const api=factory(root.DemonDemo);root.DemonD10=api;root.DemonDemo.D10Game=api.D10Game;}
})(typeof globalThis!=='undefined'?globalThis:this,function(api){
  'use strict';
  const {Game,TERMS,DIRECTIONS,NIGHT_LENGTH,distance,clamp,segmentDistance,circleRect}=api;
  const FIRST_XP=80,XP_STEP=113,WAVES=9,WAVE_INTERVAL=16;
  const threshold=level=>level<=0?0:FIRST_XP+(level-1)*XP_STEP;
  class D10Game extends Game{
    constructor(seed){
      super(seed);this.isD10=true;this.story.disabled=true;this.events=[];this.log=[];this.phase='intro';
      this.nextGrowthAt=0;this.firstQualityOffered=false;this.firstQualityGuaranteedAt=6;this.retreatAt=NIGHT_LENGTH;
      this.d10Wave={index:0,total:WAVES,started:0,groups:0,state:'combat',messageReleased:false,nextAt:0};
      this.d10GrowthHistory=[];this.nightEndQueued=false;this.sceneProps=[];this.sceneActors=[];
      if(this.initD10Scenes)this.initD10Scenes();
    }
    populateNight(){
      this.entities=[];this.downed=[];this.fields=[];this.pets=[];this.scheduled=[];this.reportSlots=0;this.spawnTimer=1e9;
      this.initReports();this.nightGrowthStart=this.combatGrowthCount;
      const spots=[[1065,855],[1110,900],[840,1090],[875,1080],[760,950],[1235,1070],[1300,860],[1180,760]];
      for(const [x,y] of spots)if(!this.blocked(x,y,11))this.spawn('villager',x,y);
      this.d10Wave={index:1,total:WAVES,started:0,groups:0,state:'combat',messageReleased:false,nextAt:WAVE_INTERVAL};
      this.addLog('每一次进化，都由你自己选择。');
    }
    checkGrowth(){
      if(this.phase!=='raid'||this.fear<threshold(this.combatGrowthCount+1))return;
      if(!this.legalTerms([],true).length){if(!this.growthPoolEnded){this.growthPoolEnded=true;this.emit('pool-empty',{text:'本局可用词条已完成'});}return;}
      this.openChoices('upgrade');
    }
    qualityEligible(dir){
      const earliest=this._d10ChoiceKind==='reward'?6:5;
      return this.combatGrowthCount>=earliest&&this.qualities().length<2&&!this.qualities().some(k=>TERMS[k].dir===dir);
    }
    generateChoices(kind){
      this._d10ChoiceKind=kind;this._d10Guaranteed=false;
      let keys=super.generateChoices(kind);
      if(kind==='upgrade'&&this.combatGrowthCount===5&&!this.firstQualityOffered){
        if(!keys.some(k=>TERMS[k].quality)){
          const qualities=this.legalTerms(keys,true).filter(k=>TERMS[k].quality);
          if(qualities.length){const dirs=[...new Set(qualities.map(k=>TERMS[k].dir))],dir=this.weightedDirection(dirs),pool=qualities.filter(k=>TERMS[k].dir===dir);
            keys[keys.length-1]=pool[Math.floor(this.random()*pool.length)];}
        }
        this._d10Guaranteed=keys.some(k=>TERMS[k].quality);
      }
      this._d10ChoiceKind=null;return keys;
    }
    openChoices(kind){
      if(this.phase===kind&&this.choicePage)return true;
      const opened=super.openChoices(kind);
      if(opened){this.choicePage.combatLevel=kind==='upgrade'?this.combatGrowthCount+1:this.combatGrowthCount;
        this.choicePage.nightReward=kind==='reward';this.choicePage.guaranteedQuality=!!this._d10Guaranteed;
        if(this.choicePage.guaranteedQuality)this.firstQualityOffered=true;}
      return opened;
    }
    chooseUpgrade(key){
      const kind=this.phase,before=this.combatGrowthCount,chosen=super.chooseUpgrade(key);if(!chosen)return false;
      this.nextGrowthAt=0;
      if(kind==='upgrade'){
        this.d10GrowthHistory.push({level:this.combatGrowthCount,time:this.time,totalXP:this.fear,key,quality:!!TERMS[key].quality});
        this.level=this.combatGrowthCount;
        // Surplus experience is retained and paid out immediately through another real page.
        if(this.phase==='raid'&&this.combatGrowthCount>before)this.checkGrowth();
      }else if(kind==='reward'){this.level=this.combatGrowthCount;this.phase='sample-complete';this.emit('sample-complete',{text:'第一夜样版完成 · 夜末奖励已领取'});}
      return true;
    }
    growthStatus(){
      const level=this.combatGrowthCount,last=threshold(level),next=threshold(level+1),required=next-last;
      return {level,nextLevel:level+1,xp:Math.max(0,this.fear-last),nextXP:required,progress:clamp((this.fear-last)/required,0,1),
        totalXP:this.fear,nextThreshold:next,rewards:this.rewardCount,firstQualityAt:6,poolEnded:!!this.growthPoolEnded};
    }
    choicePreview(key){
      const term=TERMS[key],n=this.ranks[key]||0,fmt=v=>Number(v.toFixed(1)).toString();
      const values={
        F01:()=>[`${fmt(38*(1+.2*n))} 伤害／秒`,`${fmt(38*(1+.2*(n+1)))} 伤害／秒`,'喷火伤害提高'],
        F02:()=>this.path==='field'?[`${fmt(200*(1+.15*n))} 投放距离`,`${fmt(200*(1+.15*(n+1)))} 投放距离`,'火种能投向更远的位置']:[`${fmt(160*(1+.15*n))} 距离`,`${fmt(160*(1+.15*(n+1)))} 距离`,'喷得更远，布种距离同步增加'],
        F03:()=>this.path==='field'?[`${fmt(60*(1+.15*n))} 火场半径`,`${fmt(60*(1+.15*(n+1)))} 火场半径`,'已布火种和燃烧火堆一起扩大']:[`${fmt((1+.15*n)*100)}% 宽度`,`${fmt((1+.15*(n+1))*100)}% 宽度`,'喷火与火场覆盖变大'],
        F04:()=>[`${100+25*n} 燃料`,`${125+25*n} 燃料`,'增加容量，恢复速度不变'],
        S01:()=>[`${fmt(80*(1+.2*n))} 震击内圈`,`${fmt(80*(1+.2*(n+1)))} 震击内圈`,'内圈伤害、外圈控制一起扩展'],
        S02:()=>[`${34+12*n} 震击伤害`,`${46+12*n} 震击伤害`,'伤害提高，敌人更久失衡'],
        S03:()=>[`${fmt(3.2-.4*n)} 秒冷却`,`${fmt(2.8-.4*n)} 秒冷却`,'更频繁地震击'],
        S04:()=>[`${40+15*n} 击退`,`${55+15*n} 击退`,'把敌人推得更远'],
        M01:()=>[`${40+14*n} 撞击伤害`,`${54+14*n} 撞击伤害`,'撞击敌人与障碍更有力'],
        M02:()=>[`${1+n} 次储存`,`${2+n} 次储存`,'多一次连续冲撞机会'],
        M03:()=>[`${140+25*n} 最大生命`,`${165+25*n} 最大生命`,'同时恢复新增的 25 点生命'],
        M04:()=>[`${fmt(2.6-.35*n)} 秒恢复`,`${fmt(2.25-.35*n)} 秒恢复`,'冲撞次数恢复更快']
      };
      const qualityBefore={FQ01:'持续喷火',FQ02:'持续喷火',FQ03:'持续喷火',SQ01:'一次震击',SQ02:'一次震击',SQ03:'范围震击',MQ01:'一次冲撞',MQ02:'单向冲撞',MQ03:'平地冲撞'};
      const value=term.quality?[qualityBefore[key],term.tip,term.description]:values[key]();
      return {title:term.name,direction:term.dir,color:DIRECTIONS[term.dir].color,quality:!!term.quality,before:value[0],after:value[1],operation:value[2],delta:value[2],level:n+1,cap:term.cap};
    }
    waveStatus(){
      const w=this.d10Wave,remaining=this.entities.filter(e=>!e.gone&&e.hp>0&&e.type==='militia').length;
      return {index:w.index,total:w.total,state:w.state,remainingEnemies:remaining,secondsToNext:Math.max(0,w.nextAt-this.time),messagesMax:1};
    }
    spawnD10Group(){
      const w=this.d10Wave,anchors=[[1230,760],[760,780],[1310,1080],[760,1100]],anchor=anchors[(w.index-1)%anchors.length];
      for(let i=0;i<3;i++){
        let point={x:anchor[0]+(i-1)*30,y:anchor[1]+w.groups*26};
        if(this.blocked(point.x,point.y,13))point={x:anchor[0]+(i-1)*30,y:anchor[1]-70-w.groups*24};
        if(!this.blocked(point.x,point.y,13)){const e=this.spawn('militia',point.x,point.y);e.d10Wave=w.index;}
      }
      if(w.groups===0&&w.index%3===0){const point={x:anchor[0]-110,y:anchor[1]+115};if(!this.blocked(point.x,point.y,11)){const e=this.spawn('villager',point.x,point.y);e.d10Wave=w.index;}}
      w.groups++;this.emit('wave-group',{index:w.index,group:w.groups});
    }
    tickD10Waves(){
      if(this.phase!=='raid')return;
      const w=this.d10Wave;
      if(w.index<WAVES&&this.time>=w.nextAt){w.index++;w.started=w.nextAt;w.groups=0;w.state='combat';w.messageReleased=false;w.nextAt=w.index*WAVE_INTERVAL;this.emit('wave',{index:w.index});}
      const offsets=w.index===1?[4,7.1,12]:[0,4,8];
      while(w.groups<3&&this.time-w.started>=offsets[w.groups])this.spawnD10Group();
      const remaining=this.waveStatus().remainingEnemies;
      if(w.groups===3&&!remaining){w.state='pause';this.tickReports();}else w.state='combat';
    }
    releaseEncounter(){
      if(this.d10Wave.state!=='pause'||this.d10Wave.messageReleased)return false;
      const released=super.releaseEncounter();if(released)this.d10Wave.messageReleased=true;return released;
    }
    tickReports(){
      if(this.phase!=='raid'||!this.messages||this.d10Wave.state!=='pause')return;
      if(this.messages.actions.length)this.releaseEncounter();
    }
    damageSolid(b,amount,kind){
      if(b.scenePropId&&this.damageSceneProp){this.damageSceneProp(b,amount,kind,this.player);return;}
      return super.damageSolid(b,amount,kind);
    }
    hitSceneProps(source,radius,amount,kind,segment=null,width=0){
      if(!this.damageSceneProp)return;
      for(const b of this.solids.filter(s=>s.scenePropId&&s.hp>0)){
        const point={x:b.x+b.w/2,y:b.y+b.h/2},r=Math.max(b.w,b.h)/2;
        let hit=circleRect(source.x,source.y,radius,b);
        if(segment){hit=false;const steps=Math.max(1,Math.ceil(distance(source,segment)/4));for(let i=0;i<=steps;i++)if(circleRect(source.x+(segment.x-source.x)*i/steps,source.y+(segment.y-source.y)*i/steps,width,b)){hit=true;break;}}
        if(!hit)continue;
        if(this.scenePropCanHit&&!this.scenePropCanHit(source,b))continue;
        this.damageSceneProp(b,amount,kind,source);
      }
    }
    roarWave(source,radius,duration,knock,echo=false,amount=this.roarStats().damage,inner=this.roarStats().inner){
      super.roarWave(source,radius,duration,knock,echo,amount,inner);this.hitSceneProps(source,inner,amount,echo?'echo':'roar');
    }
    earthWave(){
      super.earthWave();const p=this.player,end={x:p.x+Math.cos(p.dashAngle)*120,y:p.y+Math.sin(p.dashAngle)*120};
      this.hitSceneProps(p,0,this.forceStats().damage,'earth',end,24);
    }
    tickPlunge(dt){
      const f=this.player.plunge,willLand=f&&f.progress+dt/f.duration>=1;super.tickPlunge(dt);
      if(willLand)this.hitSceneProps(f.end,f.radius,f.damage,'plunge');
    }
    releaseLance(){
      const p=this.player,energy=p.energy,source={x:p.x,y:p.y},s=this.flameStats();super.releaseLance();
      if(energy-p.energy>=15){const end={x:p.x+Math.cos(p.angle)*s.range*1.35,y:p.y+Math.sin(p.angle)*s.range*1.35};this.hitSceneProps(source,0,s.damage,'beam',end,11);}
    }
    interact(){const e=this.activeReport();if(e&&distance(e,this.player)<80)return super.interact();if(this.interactSceneProp&&this.interactSceneProp())return;return super.interact();}
    tick(dt,input={}){super.tick(dt,input);if(this.phase==='raid')this.tickD10Waves();}
    finishNight(){
      if(this.phase!=='raid'||this.completedNights>=1)return;
      this.nightEndQueued=true;
      if(this.requestD10NightEnd){this.requestD10NightEnd();return;}
      this.finishD10AfterScene();
    }
    finishD10AfterScene(){
      if(!this.nightEndQueued||this.completedNights>=1)return false;
      this.phase='raid';super.finishNight();
      if(this.phase==='interlude'&&!this.choicePage){this.phase='sample-complete';this.emit('sample-complete',{text:'第一夜样版完成 · 词条池已全部完成'});}
      return true;
    }
    continue(){return false;}
  }
  return {D10Game,FIRST_XP,XP_STEP,WAVES,WAVE_INTERVAL,threshold};
});
