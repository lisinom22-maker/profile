/* Wave interaction adapted from JIEJOE-WEB-Tutorial/016-wavy-lines (MIT).
 * Original wave concept by Antoine Wodniack. See THIRD_PARTY_NOTICES.md.
 * Canvas renderer, seeded ambient field, fixed step integration, scroll scenes,
 * reduced-motion support and replay controls are implemented for this project.
 */
(() => {
  'use strict';
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const clamp = (n, min=0, max=1) => Math.min(max, Math.max(min,n));
  const lerp = (a,b,t) => a+(b-a)*t;
  const ease = n => { n=clamp(n); return n*n*(3-2*n); };
  const config = window.PORTFOLIO;
  const github=$('#github-link');
  if(github && /^https:\/\/(www\.)?github\.com\/[a-z\d-]+\/?$/i.test(config.github||'')){
    github.href=config.github;github.target='_blank';github.rel='noopener noreferrer';
    github.removeAttribute('aria-disabled');github.setAttribute('aria-label','访问我的 GitHub 主页');github.title='GitHub';
  }
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search);
  let reduced = motionQuery.matches, paused = reduced || query.get('pause')==='1';
  let manual = query.get('pause')==='1', time = Number(query.get('t'))||0;
  let lastTime = performance.now(), accumulator=0, lastScroll=scrollY, scrollVelocity=0;
  let ink = '#160000', paper='#f40c3f', raf=0;
  const pointer = {x:-1000,y:-1000,lx:-1000,ly:-1000,sx:-1000,sy:-1000,vs:0,angle:0,active:false};
  let wavePoints=[], waveCols=0,waveRows=0, waveWidth=0,waveHeight=0;
  let bounds={}, mobile=innerWidth<=576;
  const canvases = [$('#waves'),$('#work-type'),$('#rays'),$('#way-bridge'),$('#contact-grid')];
  const contexts = new Map(canvases.map(c=>[c,c.getContext('2d',{willReadFrequently:c.id==='waves'})]));
  const contactScene=window.createContactScene({section:$('.contact'),canvas:$('#contact-grid'),config,palette:()=>({ink,paper}),motion:()=>({reduced,paused})});
  let currentProject=null;
  let workState={};
  // The Work wall and the following ray field meet on the same column anchors.
  const wallColumns=12;
  const wayScene=window.createWayScene({canvas:$('#rays'),section:$('.my-way'),copy:$('.perspective-copy'),smiley:$('.smiley'),palette:()=>({ink,paper}),contactSection:$('.contact'),contactField:()=>contactScene.field(),drawContactWall:(ctx,rect)=>contactScene.drawWall(ctx,rect),columns:wallColumns});
  const room = {panel:$('.about-center'), padding:0, width:0, height:0, offset:0};
  const fallingPanels=window.createFallingPanels({host:$('.way-sticky'),images:Array.from({length:9},()=> 'assets/panel-pattern.svg')});
  function drawFallingPanels(t){
    const r=$('.my-way').getBoundingClientRect(),state=wayScene.debug();
    const active=r.top<innerHeight*.45&&r.bottom>innerHeight*.6&&state.vanishing?.y>0;
    fallingPanels.draw(t,state.vanishing||{x:innerWidth/2,y:innerHeight/2},active,reduced);
  }
  const wheel = {active:false, target:scrollY, rendered:scrollY};

  document.title = `${config.name} — ${config.title.join(' ')}`;
  $('#location-text').textContent=config.location;
  $('#availability-text').textContent=config.availability;
  $('#footer-name').textContent=`${config.name} © ${new Date().getFullYear()}`;
  $('#since-year').textContent=config.since;
  config.about.forEach(text=>{const p=document.createElement('p');p.textContent=text;$('#bio').append(p);});
  $('.hero-title').setAttribute('aria-label',config.title.join(' '));
  $$('.word').forEach((word,i)=>{[...config.title[i]].forEach((char,j)=>{
    const outer=document.createElement('span');outer.className='letter';outer.setAttribute('aria-hidden','true');
    const inner=document.createElement('span');inner.className='letter-inner';inner.textContent=char;inner.dataset.char=char;if(char==='T')outer.classList.add('is-t');
    outer.append(inner);word.append(outer);
    outer.addEventListener('pointerenter',()=>{if(!paused&&!reduced)inner.animate([{transform:`translateY(${j%2?-100:100}%)`},{transform:'translateY(0)'}],{duration:750,easing:'cubic-bezier(.86,0,.07,1)'});});
  });});
  const binary = '0010111010011010  ///////////////////////////////  110100101001  /////////////////////////////////////  001011101101';
  $$('.ticker').forEach(el=>{for(let i=0;i<3;i++){const s=document.createElement('span');s.textContent=binary;el.append(s);}});
  const tickerSpans=$$('.ticker span');let binaryTick=-1;
  const smileCanvas=document.createElement('canvas');smileCanvas.className='skill-smile-bursts';smileCanvas.setAttribute('aria-hidden','true');document.body.append(smileCanvas);
  const smileCtx=smileCanvas.getContext('2d');let smileBursts=[],smileSerial=0;
  const skillImpacts=new Map();
  const stationaryPointer={x:-1,y:-1,skill:null};
  function impactScale(impact,t){
    const age=Math.max(0,t-impact.start);
    if(age<.1)return lerp(impact.from,.9,1-Math.pow(1-age/.1,3));
    return lerp(.9,1,ease((age-.18)/1.0));
  }
  function burstSmiles(cell){
    if(reduced||paused)return;
    const previous=skillImpacts.get(cell);
    skillImpacts.set(cell,{start:time,from:previous?impactScale(previous,time):1});
    let seed=++smileSerial*104729;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const count=8+Math.floor(random()*5);
    const particles=Array.from({length:count},(_,i)=>{
      const angle=(i+random()*.8)/count*Math.PI*2;
      return {angle,speed:160+random()*340,radius:(8+random()*15)*1.5,rotation:random()*Math.PI*2,spin:(random()-.5)*7};
    });
    smileBursts.push({cell,x:.5,y:.5,start:time,particles});
  }
  function drawSmiles(t){
    for(const [cell,impact] of skillImpacts){
      const done=reduced||t-impact.start>=1.18;
      cell.querySelector('.skill-content').style.transform=done?'':`scale(${impactScale(impact,t)})`;
      if(done)skillImpacts.delete(cell);
    }
    const dpr=Math.min(devicePixelRatio||1,2);
    if(smileCanvas.width!==Math.round(innerWidth*dpr)||smileCanvas.height!==Math.round(innerHeight*dpr)){
      smileCanvas.width=Math.round(innerWidth*dpr);smileCanvas.height=Math.round(innerHeight*dpr);
    }
    const c=smileCtx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,innerWidth,innerHeight);
    if(reduced){smileBursts=[];return;}
    // Particles belong to the introduction room, not the viewport or Work.
    // Recompute its screen-space bounds while scrolling so the seam stays sealed.
    const roomBounds=$('#about').getBoundingClientRect();
    const fallingBursts=[];
    c.save();c.beginPath();c.rect(roomBounds.left,roomBounds.top,roomBounds.width,roomBounds.height);c.clip();
    for(const b of smileBursts){
      const age=t-b.start;if(age<0)continue;
      const r=b.cell.getBoundingClientRect();
      let stillFalling=false;
      for(const p of b.particles){
        const travel=p.speed*(1-Math.exp(-age*2.6))/2.6;
        const x=r.left+b.x*r.width+Math.cos(p.angle)*travel;
        const y=r.top+b.y*r.height+Math.sin(p.angle)*travel-220*age+600*age*age;
        if(age>.6&&y-p.radius-2>roomBounds.bottom)continue;
        stillFalling=true;
        const size=p.radius*Math.min(1,age/.065);
        if(size<.1||y-size>innerHeight||y+size<0)continue;
        // Accelerated falling after the radial impulse: a = 1200 CSS px/s².
        c.save();c.translate(x,y);c.rotate(p.rotation+p.spin*age);
        c.globalAlpha=1;c.fillStyle=paper;c.strokeStyle=ink;c.lineWidth=Math.max(.85,size*.045);
        c.beginPath();c.arc(0,0,size,0,Math.PI*2);c.fill();c.stroke();
        // One circular outline only; the eyes and mouth sit directly on it.
        c.fillStyle=ink;
        for(const x of [-.27,.27]){
          c.beginPath();c.ellipse(size*x,-size*.22,size*.115,size*.18,-.15,0,Math.PI*2);c.fill();
          c.fillStyle=paper;c.beginPath();c.arc(size*(x-.055),-size*.31,size*.055,0,Math.PI*2);c.fill();c.fillStyle=ink;
        }
        c.beginPath();c.moveTo(-size*.48,size*.06);c.bezierCurveTo(-size*.48,size*.62,size*.48,size*.62,size*.48,size*.06);c.stroke();c.restore();
      }
      if(stillFalling)fallingBursts.push(b);
    }
    c.restore();
    smileBursts=fallingBursts;
  }
  const skillReveals=$$('.skill:not([aria-hidden])').map(cell=>{
    const content=document.createElement('div');content.className='skill-content';
    while(cell.firstChild)content.append(cell.firstChild);
    cell.append(content);
    const cover=document.createElement('span');cover.className='skill-cover';cover.setAttribute('aria-hidden','true');
    cover.innerHTML='<svg viewBox="0 0 64 64"><path d="M32 0 39 25 64 32 39 39 32 64 25 39 0 32 25 25Z"/></svg>';
    cell.append(cover);
    cell.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'||event.pointerType==='pen')burstSmiles(cell);});
    return {cell,cover,start:null};
  });
  function triggerSkillAtPointer(){
    if(stationaryPointer.x<0||stationaryPointer.y<0)return;
    const hit=document.elementFromPoint(stationaryPointer.x,stationaryPointer.y);
    const cell=hit?.closest?.('.skill:not([aria-hidden])')||null;
    if(cell!==stationaryPointer.skill){
      stationaryPointer.skill=cell;
      if(cell&&!paused&&!reduced)burstSmiles(cell);
    }
  }
  addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'&&event.pointerType!=='pen')return;
    stationaryPointer.x=event.clientX;stationaryPointer.y=event.clientY;
    triggerSkillAtPointer();
  },{passive:true});
  function drawSkillReveals(t,trigger=true){
    for(const item of skillReveals){
      const r=item.cell.getBoundingClientRect();
      const visible=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0))*Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0));
      if(trigger&&item.start===null&&visible>r.width*r.height*.5&&!window.portfolioIntro?.active)item.start=t;
      const p=reduced?1:item.start===null?0:clamp((t-item.start)/.85);
      const eased=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
      item.cover.style.transform=`translate3d(${eased*100}%,0,0)`;
      item.cell.dataset.revealed=String(p===1);
    }
  }
  function drawBinary(t){
    const tick=Math.floor(t*9);if(tick===binaryTick)return;binaryTick=tick;
    tickerSpans.forEach((el,row)=>el.textContent=[...binary].map((char,i)=>{
      if(char!=='0'&&char!=='1')return char;
      let n=(Math.floor((tick+(i%7))/(2+(i%5)))*374761393+(row+1)*668265263+i*1274126177)|0;
      n=Math.imul(n^(n>>>13),1274126177);return String((n^(n>>>16))&1);
    }).join(''));
  }

  const videoEntries=new Map();
  function syncVideo(video){
    const visible=videoEntries.get(video);
    const inDialog=!!video.closest('dialog');
    const allowed=visible&&!document.hidden&&!paused&&!reduced&&(!dialog.open||inDialog);
    if(allowed){if(video.paused)video.play().catch(()=>{video.controls=true;});}
    else video.pause();
  }
  const videoObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){videoEntries.set(entry.target,entry.isIntersecting&&entry.intersectionRatio>0);syncVideo(entry.target);}
  },{threshold:[0,.01]});
  function watchVideo(video){
    videoEntries.set(video,false);videoObserver.observe(video);
    video.addEventListener('loadeddata',()=>syncVideo(video));
  }
  function makeArt(project,index) {
    const art=document.createElement('div');art.className='project-art';
    if(project.video){
      const video=document.createElement('video');video.src=project.video;video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.controls=reduced;
      if(project.image)video.poster=project.image;
      video.setAttribute('aria-label',project.title);art.append(video);watchVideo(video);return art;
    }
    if(project.image){const img=document.createElement('img');img.src=project.image;img.alt=project.title;img.loading='lazy';art.append(img);return art;}
    art.classList.add('project-slot');
    const number=document.createElement('span');number.className='slot-number';number.textContent=String(index+1).padStart(2,'0');
    const label=document.createElement('span');label.className='slot-label';label.textContent='作品待补充';
    art.append(number,label);return art;
  }
  config.projects.forEach((project,i)=>{
    const button=document.createElement('button');button.className='project';button.setAttribute('aria-label',`${project.title}${project.video||project.image?" — 查看作品":" — 预留位置"}`);
    button.append(makeArt(project,i));
    const caption=document.createElement('span');caption.className='project-caption';
    const title=document.createElement('span');title.textContent=project.title;
    const index=document.createElement('span');index.textContent=`${String(i+1).padStart(2,'0')} / ${String(config.projects.length).padStart(2,'0')}`;
    caption.append(title,index);button.append(caption);$('#projects').append(button);
    if(project.video||project.image||project.description||project.url)button.addEventListener('click',()=>openProject(project,i,button));
    else {button.disabled=true;button.classList.add('is-slot');}
    button.addEventListener('focus',()=>{
      if(!reduced&&button.matches(':focus-visible')){const p=.29+((i+.7)/(config.projects.length+1.7))*.55;window.scrollTo({top:bounds.work.top+p*(bounds.work.height-innerHeight),behavior:'instant'});renderScroll();}
    });
  });
  const projectButtons=$$('.project');
  const dialog=$('#project-dialog');
  function openProject(project,i,button){
    currentProject=button;$('.dialog-art').replaceChildren(makeArt(project,i));$('h2',dialog).textContent=project.title;
    $('.dialog-description').textContent=project.description;
    const link=$('.project-link');link.hidden=!project.url;
    if(project.url && /^https?:\/\//.test(project.url)) link.href=project.url;else {link.removeAttribute('href');link.hidden=true;}
    document.body.classList.add('modal-open');dialog.showModal();videoEntries.forEach((_,v)=>syncVideo(v));
  }
  $('.close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{
    $$('video',dialog).forEach(v=>{v.pause();videoObserver.unobserve(v);videoEntries.delete(v);});
    videoEntries.forEach((_,v)=>syncVideo(v));document.body.classList.remove('modal-open');currentProject?.focus({preventScroll:true});});

  // Seeded smooth gradient noise: repeatable ambient waves, no random timeline drift.
  const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263)+131;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};
  const grad=(x,y,dx,dy)=>{const a=(hash(x,y)%1024)/1024*Math.PI*2;return Math.cos(a)*dx+Math.sin(a)*dy;};
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const u=fx*fx*fx*(fx*(fx*6-15)+10),v=fy*fy*fy*(fy*(fy*6-15)+10);return lerp(lerp(grad(ix,iy,fx,fy),grad(ix+1,iy,fx-1,fy),u),lerp(grad(ix,iy+1,fx,fy-1),grad(ix+1,iy+1,fx-1,fy-1),u),v);}
  function sizeCanvas(canvas,width,height){
    const dpr=Math.min(devicePixelRatio||1,1.7);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    const ctx=contexts.get(canvas);ctx.setTransform(dpr,0,0,dpr,0,0);return ctx;
  }
  function resize(){
    mobile=innerWidth<=576;
    const hero=$('.hero').getBoundingClientRect();waveWidth=hero.width;waveHeight=hero.height;
    sizeCanvas($('#waves'),waveWidth,waveHeight);
    const about=$('.about');$('.about-grid').setAttribute('viewBox',`0 0 ${about.clientWidth} ${about.clientHeight}`);
    room.padding=parseFloat(getComputedStyle(about).paddingTop);
    const panelRect=room.panel.getBoundingClientRect();room.width=panelRect.width;room.height=panelRect.height;
    wheel.active=false;
    sizeCanvas($('#work-type'),$('.work-sticky').clientWidth,innerHeight);
    sizeCanvas($('#rays'),$('.way-sticky').clientWidth,innerHeight);
    sizeCanvas($('#contact-grid'),$('.contact').clientWidth,$('.contact').clientHeight);
    const bridge=$('#way-bridge');bridge.style.height=`${$('.contact').clientHeight/8*3}px`;
    sizeCanvas(bridge,$('.contact').clientWidth,bridge.clientHeight);
    waveCols=Math.ceil((waveWidth+180)/10);waveRows=Math.ceil((waveHeight+64)/24);
    wavePoints=Array.from({length:waveCols},(_,i)=>Array.from({length:waveRows},(_,j)=>({x:i*10-90,y:j*24-32,cx:0,cy:0,vx:0,vy:0})));
    for(const key of ['about','work','my-way','contact']){const el=$('.'+key),r=el.getBoundingClientRect();bounds[key]={top:r.top+scrollY,height:r.height,width:r.width};}
    render(time);renderScroll();
  }
  function physicsStep(){
    pointer.sx+=(pointer.x-pointer.sx)*.1;pointer.sy+=(pointer.y-pointer.sy)*.1;
    const dx=pointer.x-pointer.lx,dy=pointer.y-pointer.ly;
    const distance=Math.hypot(dx,dy);pointer.vs+=(Math.min(100,distance)-pointer.vs)*.1;
    if(distance>.1)pointer.angle=Math.atan2(dy,dx);
    pointer.lx=pointer.x;pointer.ly=pointer.y;
    const radius=175;
    for(const line of wavePoints) for(const p of line){
      if(pointer.active){const distance=Math.hypot(p.x-pointer.sx,p.y-pointer.sy);if(distance<radius){const force=1-distance/radius;p.vx+=Math.cos(pointer.angle)*force*pointer.vs*.08;p.vy+=Math.sin(pointer.angle)*force*pointer.vs*.08;}}
      p.vx=(p.vx-p.cx*.005)*.925;p.vy=(p.vy-p.cy*.005)*.925;
      p.cx=clamp(p.cx+p.vx*2,-100,100);p.cy=clamp(p.cy+p.vy*2,-100,100);
    }
  }
  $('#waves').addEventListener('pointermove',event=>{
    if(reduced||paused)return;const r=$('#waves').getBoundingClientRect();
    const x=event.clientX-r.left,y=event.clientY-r.top;
    if(!pointer.active){pointer.lx=pointer.sx=x;pointer.ly=pointer.sy=y;}
    pointer.x=x;pointer.y=y;pointer.active=true;
  },{passive:true});
  $('#waves').addEventListener('pointerleave',()=>pointer.active=false);
  $('#waves').addEventListener('pointercancel',()=>pointer.active=false);
  $('#waves').addEventListener('pointerdown',event=>{
    if(reduced||paused)return;const r=$('#waves').getBoundingClientRect();
    const x=event.clientX-r.left,y=event.clientY-r.top;
    for(const line of wavePoints)for(const p of line){const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy);if(d<150&&d>1){p.vx+=dx/d*(1-d/150)*5;p.vy+=dy/d*(1-d/150)*5;}}
  },{passive:true});
  function drawWaves(t){
    const ctx=contexts.get($('#waves'));ctx.clearRect(0,0,waveWidth,waveHeight);ctx.strokeStyle=ink;ctx.lineWidth=1;
    ctx.beginPath();
    for(const line of wavePoints){const introOffset=window.portfolioIntro?.active?window.portfolioIntro.waveOffset(clamp(line[0].x/waveWidth),waveHeight):0;for(let j=0;j<line.length;j++){
      const p=line[j],n=noise(p.x*.0022+t*.09,p.y*.003+t*.035);
      const angle=n*Math.PI*2.3;
      const x=p.x+Math.cos(angle)*31+p.cx;
      const rawY=p.y+Math.sin(angle)*14+p.cy+introOffset;
      // Keep every stripe welded to both frame edges. Pointer drag can move
      // the first/last physics points inward; clamping just those endpoints
      // prevents background slivers from appearing at the top or bottom.
      const y=j===0?0:j===line.length-1?waveHeight:rawY;
      if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }}ctx.stroke();
  }
  function drawAbout(){
    const {width:w,height:h,top}=bounds.about;
    const progress=clamp((scrollY+innerHeight-top)/(h+innerHeight));
    // One shared back plane drives the DOM and every edge of the wireframe.
    // Its slower travel reveals the ceiling on entry and the floor on exit.
    room.offset=reduced?0:(progress-.5)*(mobile?400:800);
    room.panel.style.transform=`translate3d(0,${room.offset}px,0)`;
    const left=(w-room.width)/2,right=w-left,backTop=room.padding+room.offset,backBottom=backTop+room.height;
    const segments=[];
    const line=(x1,y1,x2,y2)=>segments.push(`M${x1.toFixed(2)},${y1.toFixed(2)}L${x2.toFixed(2)},${y2.toFixed(2)}`);
    const divisions=12;
    for(let i=0;i<=divisions;i++){
      const t=i/divisions,x=w*t,backX=left+room.width*t;
      line(x,0,backX,backTop);line(x,h,backX,backBottom);
      line(0,h*t,left,backTop+room.height*t);
      line(w,h*t,right,backTop+room.height*t);
    }
    for(const depth of [.4375,.75,.9375]){
      const x=left*depth,y=backTop*depth,bottom=lerp(h,backBottom,depth);
      segments.push(`M${x},${y}H${w-x}V${bottom}H${x}Z`);
    }
    $('.about-grid path').setAttribute('d',segments.join(''));
  }
  function workProgress(){return clamp((scrollY-bounds.work.top)/(bounds.work.height-innerHeight));}

  function drawWork(t,p){
    if(!bounds.work)return;
    const ctx=contexts.get($('#work-type')),w=$('.work-sticky').clientWidth,h=innerHeight;
    const entry=clamp(p/.27),exit=clamp((1-p)/.14),travel=Math.min(entry,exit);
    const camera=ease(travel),spread=ease((travel-.08)/.86);
    const zoom=1/(1-.967*camera),cx=w/2,cy=h/2;
    const fan=spread*ease((zoom-1)/10);
    const holeW=Math.min(w*(mobile?.34:.15),h*.29),holeH=h*.8;
    ctx.clearRect(0,0,w,h);ctx.fillStyle=ink;ctx.fillRect(0,0,w,h);
    // Fixed, fine red dot matrix on the far wall (no flicker or extra layer).
    ctx.fillStyle=paper;ctx.globalAlpha=.68;ctx.beginPath();
    for(let y=8;y<h;y+=22)for(let x=8;x<w;x+=22){ctx.moveTo(x+.85,y);ctx.arc(x,y,.85,0,Math.PI*2);}
    ctx.fill();ctx.globalAlpha=1;
    const rows=[{char:'W',count:7,y:.192},{char:'O',count:10,y:.411},{char:'R',count:10,y:.636},{char:'K',count:9,y:.855}];
    const flow=clamp((p-.29)/.55)*5;
    const visible=[];
    rows.forEach((row,j)=>{
      const pitch=1.7/row.count,phase=-flow*[.78,1.04,1.18,.92][j];
      const layers=[];
      for(let i=0;i<15;i++){
        const index=((i-7+phase+7.5)%15+15)%15-7.5;
        const theta=(index+(row.count%2?0:.5))*pitch;
        const x=cx+Math.tan(clamp(theta*fan,-1.45,1.45))/Math.tan(.85)*w/2;
        const edge=Math.abs(x-cx)/(w/2),depth=1+.18*Math.min(edge*edge,2);
        const startY=h*(.255+j*.163);
        const finalY=h*row.y+(row.y-.5)*h*.19*Math.min(edge*edge,2);
        const y=lerp(startY,finalY,spread);
        const glyphH=lerp(Math.min(h*.15,holeW*.75),Math.min(h*.188,w*.116)*depth,spread);
        layers.push({x,y,glyphH,edge,i});
      }
      // All 15 copies survive; surplus letters move beyond the viewport.
      // Only translation and axis-aligned scale: glyphs are always upright.
      layers.sort((a,b)=>b.edge-a.edge);
      let count=0;
      for(const letter of layers){
        ctx.font='700 100px Display';const metric=ctx.measureText(row.char);
        const unitH=metric.actualBoundingBoxAscent+metric.actualBoundingBoxDescent;
        const fontSize=letter.glyphH/(unitH/100||.8);
        ctx.font=`700 ${fontSize}px Display`;ctx.textAlign='center';ctx.textBaseline='alphabetic';
        const m=ctx.measureText(row.char),baseline=letter.y+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2;
        if(letter.x+m.width/2<0||letter.x-m.width/2>w)continue;
        if(letter.x>=0&&letter.x<=w)count++;
        ctx.fillStyle=ink;ctx.fillText(row.char,letter.x+3*spread,baseline+5*spread);
        ctx.fillStyle='#72071d';ctx.fillText(row.char,letter.x+2*spread,baseline+4*spread);
        ctx.fillStyle=paper;ctx.fillText(row.char,letter.x,baseline);
      }
      visible.push(count);
    });
    // A fixed-shape wall aperture is magnified uniformly around the camera.
    // The foreground grid, rim and hole share exactly the same scale.
    const hw=holeW*zoom,hh=holeH*zoom,r=hw/2;
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);
    ctx.roundRect(cx-hw/2,cy-hh/2,hw,hh,r);ctx.clip('evenodd');
    ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=ink;ctx.globalAlpha=.65;ctx.lineWidth=zoom;ctx.beginPath();
    for(let i=0;i<=wallColumns;i++){const x=cx+(i*w/wallColumns-cx)*zoom;ctx.moveTo(x,0);ctx.lineTo(x,h);}
    for(let i=0;i<=10;i++){const y=cy+(i*h/10-cy)*zoom;ctx.moveTo(0,y);ctx.lineTo(w,y);}
    ctx.stroke();ctx.restore();
    ctx.strokeStyle=ink;ctx.lineWidth=zoom;
    for(const border of [1,5,10]){
      const bw=(holeW+border*2)*zoom,bh=(holeH+border*2)*zoom;
      ctx.beginPath();ctx.roundRect(cx-bw/2,cy-bh/2,bw,bh,bw/2);ctx.stroke();
    }
    workState={travel,spread,zoom,visibleCounts:visible,rotation:0,copiesPerRow:15};
  }
  function drawRays(t=time){
    wayScene.draw(reduced,t);
    const bridge=$('#way-bridge'),r=bridge.getBoundingClientRect(),contact=$('.contact').getBoundingClientRect();
    if(r.top<innerHeight&&r.bottom>0){
      const ctx=contexts.get(bridge);ctx.clearRect(0,0,r.width,r.height);
      ctx.fillStyle=paper;ctx.fillRect(0,0,r.width,r.height);
      contactScene.drawWall(ctx,{x:r.left-contact.left,y:r.top-contact.top,width:r.width,height:r.height});
    }
  }
  function drawContact(t){contactScene.draw(t);}
  function renderScroll(){
    if(!bounds.work)return;
    const p=workProgress();
    projectButtons.forEach((button,i)=>{
      if(reduced){button.style.visibility='visible';button.style.opacity='1';button.style.pointerEvents='auto';return;}
      const gallery=clamp((p-.29)/.55),cardW=button.offsetWidth;
      const pitch=bounds.work.width*.7;
      const x=bounds.work.width+pitch*.2+i*pitch-gallery*(bounds.work.width+pitch*(projectButtons.length+.2));
      const y=innerHeight*[.52,.15,.42,.26,.58,.12,.4,.22,.5,.32][i%10];
      button.style.left='0px';button.style.top='0px';button.style.transform=`translate3d(${x}px,${y}px,0)`;
      const visible=p>.29&&p<.86&&x+cardW>0&&x<bounds.work.width;
      button.style.visibility=visible?'visible':'hidden';button.style.opacity='1';
      button.style.pointerEvents=visible?'auto':'none';
      const video=$('video',button);if(video&&!visible){videoEntries.set(video,false);video.pause();}

    });
    drawContact(time);drawRays(time);
    const max=document.documentElement.scrollHeight-innerHeight;
    $('#scroll-progress').style.transform=`translateY(${max>0?scrollY/max*(innerHeight-8):0}px)`;
    drawAbout();drawSkillReveals(time);drawWork(time,p);
    // Scrolling moves cards beneath a stationary pointer without dispatching
    // pointerenter; re-hit-test after layout has settled to preserve the same
    // smile trigger as a real pointer crossing.
    triggerSkillAtPointer();
  }
  function render(t){drawBinary(t);drawWaves(t);drawWork(t,workProgress());drawAbout();drawContact(t);drawRays(t);drawSmiles(t);drawFallingPanels(t);}
  addEventListener('portfolio-progress-seek',()=>{wheel.active=false;wheel.target=wheel.rendered=scrollY;});
  addEventListener('portfolio-progress-render',()=>{wheel.target=wheel.rendered=scrollY;renderScroll();});
  function frame(now){
    const dt=Math.min((now-lastTime)/1000,.06);lastTime=now;
    if(wheel.active){
      if(reduced||paused||document.body.classList.contains('modal-open'))wheel.active=false;
      else {
        wheel.rendered=lerp(wheel.rendered,wheel.target,1-Math.exp(-dt/.12));
        if(Math.abs(wheel.target-wheel.rendered)<.35){wheel.rendered=wheel.target;wheel.active=false;}
        window.scrollTo({top:wheel.rendered,behavior:'instant'});
        renderScroll();
      }
    }
    if(!paused&&!document.hidden){
      time+=dt;
      drawBinary(time);
      drawSkillReveals(time);
      drawSmiles(time);
      drawFallingPanels(time);
      if(bounds.contact && scrollY+innerHeight>bounds.contact.top && scrollY<bounds.contact.top+bounds.contact.height){drawContact(time);drawRays(time);}
      const heroInView=scrollY<waveHeight+120;
      if(heroInView){accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps<4){physicsStep();accumulator-=1/60;steps++;}drawWaves(time);}
      
      const ds=scrollY-lastScroll;scrollVelocity=lerp(scrollVelocity,ds,.16);lastScroll=scrollY;
      if(scrollY<waveHeight+600)$$('.letter').forEach((el,i)=>{el.style.transform=`rotateX(${Math.sin(i*.65+time*2)*clamp(scrollVelocity,-25,25)*1.3}deg)`;});
    }
    raf=requestAnimationFrame(frame);
  }
  let scrollQueued=false;
  addEventListener('scroll',()=>{
    if(wheel.active&&Math.abs(scrollY-wheel.rendered)>2)wheel.active=false;
    if(!scrollQueued){scrollQueued=true;requestAnimationFrame(()=>{renderScroll();scrollQueued=false;});}
  },{passive:true});
  addEventListener('wheel',event=>{
    if(window.portfolioIntro?.active){event.preventDefault();return;}
    if(reduced||paused||event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||document.body.classList.contains('modal-open'))return;
    for(let el=event.target instanceof Element?event.target:null;el&&el!==document.body;el=el.parentElement){
      if(/auto|scroll/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+1)return;
    }
    event.preventDefault();
    if(!wheel.active){wheel.rendered=scrollY;wheel.target=scrollY;}
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    wheel.target=clamp(wheel.target+delta,0,document.documentElement.scrollHeight-innerHeight);
    wheel.active=true;
  },{passive:false});
  // Native touch, keyboard, links and scrollbar input take over immediately.
  for(const type of ['touchstart','pointerdown','keydown'])addEventListener(type,()=>wheel.active=false,{passive:true});
  addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{lastTime=performance.now();accumulator=0;videoEntries.forEach((_,v)=>syncVideo(v));});
  function updateMotionButton(){document.body.classList.toggle('is-paused',paused);const b=$('#motion-toggle');b.setAttribute('aria-pressed',String(paused));b.setAttribute('aria-label',paused?'播放动态效果':'暂停动态效果');b.title=paused?'播放动态效果':'暂停动态效果';videoEntries.forEach((_,v)=>syncVideo(v));}
  $('#motion-toggle').addEventListener('click',()=>{paused=!paused;manual=false;lastTime=performance.now();updateMotionButton();});
  motionQuery.addEventListener('change',event=>{reduced=event.matches;paused=reduced;videoEntries.forEach((_,v)=>v.controls=reduced);updateMotionButton();resize();});
  try{if(localStorage.getItem('portfolio-contrast')==='light')document.body.classList.add('contrast');}catch{}
  function updateTheme(){paper=document.body.classList.contains('contrast')?'#fff2ed':'#f40c3f';$('#theme-toggle').setAttribute('aria-pressed',String(document.body.classList.contains('contrast')));$('meta[name="theme-color"]').content=paper;if(bounds.work)render(time);}
  let themeTransition=null;
  // View-transition snapshots can temporarily suppress CSS :hover. Keep
  // interaction state separate from the page's theme and snapshot lifecycle.
  $$('.header button,.header a[href]').forEach(control=>{
    const enter=()=>{
      control.classList.add('control-engaged');
    };
    const leave=()=>{
      if(control.matches(':focus-visible'))return;
      control.classList.remove('control-engaged');
    };
    control.addEventListener('pointerenter',enter);
    control.addEventListener('pointerleave',()=>{if(!themeTransition)leave();});
    // Real pointer movement still releases a held state during the wipe;
    // synthetic pointerleave from the snapshot layer must not release it.
    addEventListener('pointermove',event=>{
      if(!control.classList.contains('control-engaged'))return;
      const r=control.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)leave();
    },{passive:true});
    control.addEventListener('focus',()=>{if(control.matches(':focus-visible'))enter();});
    control.addEventListener('blur',()=>{if(!control.matches(':hover'))leave();});
  });
  let themeTarget=document.body.classList.contains('contrast');
  function applyTheme(light){
    document.body.classList.toggle('contrast',light);
    try{localStorage.setItem('portfolio-contrast',light?'light':'red');}catch{}
    updateTheme();
  }
  $('#theme-toggle').addEventListener('click',()=>{
    themeTarget=!themeTarget;
    const light=themeTarget;
    themeTransition?.skipTransition();
    if(reduced||!document.startViewTransition){applyTheme(light);return;}
    const transition=document.startViewTransition(()=>applyTheme(light));
    themeTransition=transition;
    transition.ready.then(()=>{
      // Widen the ink separator to match the requested stronger separation. Both snapshots
      // retain their text and canvases; the gap exposes the ink underneath.
      const gap=Math.max(16,Math.round((innerWidth-32)*.018));
      const oldFrames=light
        ? ['inset(0 '+gap+'px 0 0)','inset(0 calc(100% + '+gap+'px) 0 0)']
        : ['inset(0 0 0 '+gap+'px)','inset(0 0 0 calc(100% + '+gap+'px))'];
      const newFrames=light
        ? ['inset(0 0 0 100%)','inset(0 0 0 0)']
        : ['inset(0 100% 0 0)','inset(0 0 0 0)'];
      for(const [name,frames] of [['old',oldFrames],['new',newFrames]]){
        document.documentElement.animate({clipPath:frames},{duration:600,easing:'cubic-bezier(.65,0,.35,1)',fill:'both',pseudoElement:'::view-transition-'+name+'(root)'});
      }
    }).catch(()=>{});
    transition.finished.finally(()=>{if(themeTransition===transition)themeTransition=null;}).catch(()=>{});
  });
  const menu=$('.mobile-menu');menu.addEventListener('click',()=>{const open=$('.header').classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'关闭导航':'打开导航');menu.textContent=open?'CLOSE':'MENU';});
  function closeMenu(){$('.header').classList.remove('menu-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','打开导航');menu.textContent='MENU';}
  $$('nav a').forEach(link=>link.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{if(event.key==='Escape') {if($('.header').classList.contains('menu-open')){closeMenu();menu.focus();}}});
  // Deterministic capture hook. Resets the interactive spring history; the same
  // viewport + t + scroll position always produce the same frame.
  window.__renderAt=(t)=>{wheel.active=false;paused=true;manual=true;time=Math.max(0,Number(t)||0);pointer.active=false;pointer.vs=0;for(const line of wavePoints)for(const p of line){p.cx=p.cy=p.vx=p.vy=0;}$$('.letter').forEach(el=>el.style.transform='none');updateMotionButton();render(time);renderScroll();};
  window.__portfolioDebug=()=>({time,paused,reduced,wavePoints:waveCols*waveRows,workProgress:workProgress(),framesActive:!!raf,workScene:workState,contactScene:contactScene.debug(),aboutOffset:room.offset,smoothScrollActive:wheel.active,maxDisplacement:Math.max(...wavePoints.flat().map(p=>Math.hypot(p.cx,p.cy)))});
  window.__renderContactAt=(t,state='idle',age=0)=>{window.__renderAt(t);contactScene.capture(time,state,age);drawRays(time);};
  window.__renderSkillsAt=(age)=>{skillReveals.forEach(item=>item.start=0);window.__renderAt(Math.max(0,Number(age)||0));drawSkillReveals(time,false);};
  window.__smileDebug=()=>({bursts:smileBursts.length,counts:smileBursts.map(b=>b.particles.length),reduced,paused,stationaryPointer:{x:stationaryPointer.x,y:stationaryPointer.y,skill:stationaryPointer.skill?.className||null}});
  window.__wayDebug=()=>wayScene.debug();
  updateMotionButton();updateTheme();resize();
  document.fonts.ready.then(()=>{resize();if(manual)window.__renderAt(time);});
  requestAnimationFrame(frame);
})();

