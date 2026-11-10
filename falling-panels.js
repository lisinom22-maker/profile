/* Falling panels share a perspective origin; grabbed panels use screen-space springs. */
window.createFallingPanels=({host,images})=>{
  const layer=document.createElement('div');layer.className='falling-panels';host.append(layer);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let origin=null,lastActive=false,held=null,raf=0,lastNow=0;
  const loose=[];
  // Seeded variation keeps each flight repeatable when scrubbing preview time.
  const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const stars=Array.from({length:4},()=>{
    const star=document.createElement('div');star.className='falling-star';star.hidden=true;star.setAttribute('aria-hidden','true');
    // Closely spaced faces give the existing four-point silhouette a thin solid edge.
    for(let z=-4;z<=4;z++){const face=document.createElement('span');face.style.transform=`translateZ(${z}px)`;star.append(face);}
    layer.append(star);return star;
  });
  function drawStars(elapsed,x,y){
    const interval=2.7,period=interval*stars.length;
    stars.forEach((star,i)=>{
      const cycle=Math.floor((elapsed-i*interval)/period),seed=Math.max(0,cycle)*stars.length+i;
      const delay=.35+random(seed+1)*.65,duration=2.8+random(seed+2)*.6;
      const age=elapsed-i*interval-Math.max(0,cycle)*period-delay;
      star.hidden=cycle<0||age<0||age>duration;if(star.hidden)return;
      const u=age/duration,angle=random(seed+3)*Math.PI*2;
      const radius=65+u*(180+random(seed+4)*100),z=-3200+3770*u*u;
      const dx=Math.cos(angle)*radius,dy=Math.sin(angle)*radius*.5+u*u*170;
      const size=130+random(seed+5)*70;
      star.style.width=star.style.height=`${size}px`;star.style.left=`${x}px`;star.style.top=`${y}px`;
      star.style.transform=`translate(-50%,-50%) translate3d(${dx}px,${dy}px,${z}px) rotateZ(${random(seed+6)*180+u*210}deg) rotateY(${random(seed+7)*90+u*280}deg) rotateX(${u*145}deg)`;
    });
  }
  const cards=images.filter(Boolean).map((src,i)=>{
    const card=document.createElement('div');card.className='falling-panel';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`抓取作品面板 ${i+1}，松手放下`);
    const front=document.createElement('div');front.className='panel-front';
    const img=document.createElement('img');img.src=src;img.alt='';img.draggable=false;front.append(img);
    const back=document.createElement('div');back.className='panel-back';card.append(front,back);layer.append(card);
    const item={card,src,cycle:-1,consumed:-1,sample:null};
    card.addEventListener('pointerdown',e=>{if(e.button!==0||held)return;e.preventDefault();grab(item,e.clientX,e.clientY,e.pointerId);});
    card.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat&&!held){e.preventDefault();const r=card.getBoundingClientRect();grab(item,r.x+r.width/2,r.y+r.height/2,null);}});
    card.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();release();}});
    return item;
  });
  function grab(item,px,py,pointerId){
    const r=item.card.getBoundingClientRect(),now=performance.now();
    const el=document.createElement('div');el.className='panel-in-hand';
    const img=document.createElement('img');img.src=item.src;img.alt='作品预览';img.draggable=false;el.append(img);document.body.append(el);
    const targetW=Math.min(720,innerWidth*.82,innerHeight*.75*1.6);
    held={el,item,pointerId,x:r.x+r.width/2,y:r.y+r.height/2,w:Math.max(24,r.width),vx:clamp(item.velocity?.x||0,-850,850),vy:clamp(item.velocity?.y||0,-850,850),vw:(targetW-Math.max(24,r.width))*8+clamp(item.velocity?.w||0,-600,900),angle:clamp((item.velocity?.x||0)*.015+12,-22,22),va:110,tilt:26,vt:-160,targetW,tx:px,ty:py,age:0};
    item.consumed=item.cycle;item.card.style.visibility='hidden';
    document.documentElement.classList.add('holding-panel');
    if(pointerId!==null){el.setPointerCapture(pointerId);el.addEventListener('pointermove',e=>{if(held?.el!==el)return;held.tx=e.clientX;held.ty=e.clientY;});el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',()=>{if(held?.el===el)release();});}
    paint(held);if(!raf){lastNow=now;raf=requestAnimationFrame(tick);}
  }
  function release(){
    if(!held)return;const h=held;held=null;
    document.documentElement.classList.remove('holding-panel');
    if(h.pointerId!==null&&h.el.hasPointerCapture(h.pointerId))h.el.releasePointerCapture(h.pointerId);
    h.age=0;h.vy=Math.max(90,h.vy);h.va=18;h.el.classList.add('released');loose.push(h);
  }
  function paint(h){h.el.style.width=`${h.w}px`;h.el.style.transform=`translate3d(${h.x}px,${h.y}px,0) translate(-50%,-50%) perspective(900px) rotateX(${h.tilt||0}deg) rotate(${h.angle}deg)`;}
  function dissolve(h){
    const progress=clamp((h.age-.08)/.95,0,1);let holes='';
    for(let i=0;i<50;i++){const x=(i*73.17)%100,y=(i*37.73)%100,delay=(i%9)*.035;const radius=Math.max(0,progress-delay)*27;holes+=`<circle cx="${x}" cy="${y}" r="${radius}" fill="black"/>`;}
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><filter id="edge" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".12" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter><mask id="m"><rect width="100" height="100" fill="white"/><g filter="url(#edge)">${holes}</g></mask></defs><rect width="100" height="100" fill="white" mask="url(#m)"/></svg>`;
    h.el.style.maskImage=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    h.el.style.opacity=String(1-clamp((progress-.6)/.4,0,1));
  }
  function tick(now){
    const dt=Math.min(.032,(now-lastNow)/1000);lastNow=now;
    if(held){const h=held,w=h.targetW,halfH=w/1.6/2;
      const tx=clamp(h.tx,w/2+12,innerWidth-w/2-12),ty=clamp(h.ty,halfH+12,innerHeight-halfH-12);
      // Fixed small integration steps keep the fast spring stable on slow frames.
      const steps=Math.ceil(dt/(1/120)),step=dt/steps;
      for(let i=0;i<steps;i++){
        for(const [key,target,k,c,v] of [
          ['x',tx,520,34,'vx'],['y',ty,520,34,'vy'],
          ['w',w,520,24,'vw'],['angle',clamp(-h.vx*.015,-12,12),180,11,'va'],
          ['tilt',clamp(h.vy*.018,-14,14),210,13,'vt']
        ]){h[v]+=(k*(target-h[key])-c*h[v])*step;h[key]+=h[v]*step;}
      }paint(h);
    }
    for(let i=loose.length-1;i>=0;i--){const h=loose[i];h.age+=dt;h.vy+=1450*dt;h.y+=h.vy*dt;h.x+=h.vx*dt;h.vx*=Math.exp(-5*dt);h.angle+=h.va*dt;paint(h);dissolve(h);if(h.age>1.2){h.el.remove();loose.splice(i,1);}}
    raf=held||loose.length?requestAnimationFrame(tick):0;
  }
  addEventListener('blur',release);addEventListener('keydown',e=>{if(e.key==='Escape')release();});
  function clear(){if(held){held.el.remove();held=null;}loose.splice(0).forEach(h=>h.el.remove());document.documentElement.classList.remove('holding-panel');cancelAnimationFrame(raf);raf=0;}
  function draw(t,{x,y},active,reduced){
    layer.hidden=!active||reduced;
    if(!active||reduced){origin=null;lastActive=false;clear();return;}
    if(!lastActive){origin=t;lastActive=true;cards.forEach(item=>item.consumed=-1);}
    const elapsed=Math.max(0,t-origin),interval=1.8,duration=2.65;layer.style.perspectiveOrigin=`${x}px ${y}px`;
    drawStars(elapsed,x,y);
    for(let i=0;i<cards.length;i++){
      const item=cards[i],cycle=Math.floor((elapsed-i*interval)/(cards.length*interval)),age=elapsed-i*interval-Math.max(0,cycle)*cards.length*interval,card=item.card;
      item.cycle=cycle;card.style.visibility=item.consumed===cycle?'hidden':'';
      if(age<0||age>duration){card.hidden=true;continue;}card.hidden=false;
      const u=age/duration,seed=i+Math.max(0,cycle)*cards.length,angle=seed*2.39996+.55,z=-4200+4780*u*u;
      const dx=Math.cos(angle)*(35+u*160),dy=Math.sin(angle)*(25+u*100)+u*u*150;
      card.style.left=`${x}px`;card.style.top=`${y}px`;
      card.style.transform=`translate(-50%,-50%) translate3d(${dx}px,${dy}px,${z}px) rotateZ(${seed*41+u*100}deg) rotateY(${seed*67+u*370}deg) rotateX(${25+u*145}deg)`;
      // The previous rendered position supplies velocity at the moment of capture.
      const r=card.getBoundingClientRect(),now=performance.now(),next={x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,time:now};
      if(item.sample){const dt=Math.max(.008,(now-item.sample.time)/1000);item.velocity={x:(next.x-item.sample.x)/dt,y:(next.y-item.sample.y)/dt,w:(next.w-item.sample.w)/dt};}
      item.sample=next;
    }
  }
  return {draw};
};
