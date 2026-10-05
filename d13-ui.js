/* Presentation helpers shared by scenes, teaching and readable combat overlays. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DemonD13UI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PLACES=['包扎棚','河岸磨坊','磨坊','南门','钟匠工坊','旧抄写台','抄写台','村外集合点','侧门','钟楼','北方驿站','驿站','圣钟','钟坛','边界阵位'];
  const EVENTS=['求援信','指控信','供能草图','两封信','告急信','认罪书','临时供能箱','第三夜黎明前','第三夜黎明','九天前','七天前','今晨','黑潮','魔王','钟芯','原稿','见证锁','旧祭仪','护阵','短按空格','击退民兵'];
  function highlight(text){
    const source=String(text??''),words=[...PLACES,...EVENTS].sort((a,b)=>b.length-a.length),re=new RegExp(words.join('|'),'g');let last=0,out='',count=0;
    for(const match of source.matchAll(re)){if(count>=3)break;out+=escape(source.slice(last,match.index));out+=`<mark class="story-key ${PLACES.includes(match[0])?'place-key':'event-key'}">${escape(match[0])}</mark>`;last=match.index+match[0].length;count++;}
    return out+escape(source.slice(last));
  }
  const PROLOGUE_IMAGES={rift:'assets/d13-prologue/rift.png',bearer:'assets/d13-prologue/bearer.png',decree:'assets/d13-prologue/decree.png'};
  function portraitMarkup(kind,cls='scene-portrait'){const src=root.DemonArt?.portraitURL?.(kind,{halfBody:cls==='guide-lian'})||'';return src?`<img class="${cls} portrait-${escape(kind)}" src="${src}" alt="${kind==='lian'?'黎安':''}">`:`<div class="${cls} portrait-${escape(kind)}" aria-hidden="true"></div>`;}
  function guidePanel({id,title,body,button='知道了，继续',action='tutorial-next',later=false,color='#d5b274'}){
    return `<div class="guide-shade guide-top"></div><div class="guide-shade guide-left"></div><div class="guide-shade guide-right"></div><div class="guide-shade guide-bottom"></div><div class="guide-focus" aria-hidden="true"><span class="focus-caption"></span></div><section class="panel tutorial-panel guide-panel" data-tutorial="${escape(id)}" style="--direction:${color}">${portraitMarkup('lian','guide-lian')}<div class="guide-copy"><span class="eyebrow">黎安 · 战斗已暂停</span><h2>${escape(title)}</h2><div class="tutorial-body">${body}</div><div class="button-row"><button class="primary-button" data-action="${action}">${button}</button>${later?'<button class="secondary-button" data-action="guide-later">稍后尝试</button>':''}</div><small class="guide-memory">确认后继续。重玩时不再自动弹出已读指引。</small></div></section>`;
  }
  function healthEntries(actors,game){return actors.filter(e=>{const source=e._source||e;return source!==game.player&&source!==game.hero&&!e.gone&&!e.protected&&e.hp>0&&e.hp<e.maxHp;});}
  return {highlight,escape,PROLOGUE_IMAGES,portraitMarkup,guidePanel,healthEntries};
});
