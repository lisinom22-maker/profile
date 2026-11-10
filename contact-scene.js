/* Contact reconstruction from the supplied 04-44-18 recording and the
 * reference site's observed CTA typography rules. No pointer-driven grid. */
'use strict';
window.createContactScene = function ({section, canvas, config, palette, motion}) {
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
  const mix=(a,b,p)=>a+(b-a)*p;
  const mod=(a,b)=>(a%b+b)%b;
  const smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
  function bezier(x1,y1,x2,y2){
    const sample=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    return p=>{p=clamp(p);let lo=0,hi=1;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(sample(m,x1,x2)<p)lo=m;else hi=m;}return sample((lo+hi)/2,y1,y2);};
  }
  const portalEase=bezier(1,0,0,1),outEase=bezier(.23,1,.32,1);
  const leaveEase=bezier(.86,0,.07,1),chargeEase=bezier(.755,.05,.855,.06);
  const upEase=bezier(.215,.61,.355,1),downEase=bezier(.645,.045,.355,1),returnEase=bezier(.55,.055,.675,.19);
  const ctx=canvas.getContext('2d');
  const go=section.querySelector('.go-button'),portal=section.querySelector('.contact-content');
  const email=section.querySelector('#email-link'),close=section.querySelector('.close-contact');
  const slices=[];
  for(const [row,chars] of [['top',['L','E','T','’S']],['bottom',['R','O','C','K']]]){
    const half=document.createElement('div');half.className=`contact-word-half ${row}`;half.setAttribute('aria-hidden','true');
    const line=document.createElement('div');line.className='contact-word';
    chars.forEach((char,index)=>{
      const cell=document.createElement('span');cell.className='contact-char';
      [0,.14,.1,.06].forEach((offset,layer)=>{
        const span=document.createElement('span');span.className='contact-slice';
        if(char==='’S'){const apostrophe=document.createElement('sup');apostrophe.textContent='’';span.append(apostrophe,document.createTextNode('S'));}else span.textContent=char;
        if(layer){const cut=100-[.03,.06,.09][layer-1]/.8*100;span.style.clipPath=row==='top'?`inset(0 0 ${cut}% 0)`:`inset(${cut}% 0 0 0)`;}
        cell.append(span);slices.push({span,index,offset,layer,row});
      });line.append(cell);
    });half.append(line);portal.append(half);
  }
  const starData=[[.25,.12,8],[.85,.33,9],[.11,.60,7],[.74,.83,10]];
  const stars=starData.map(([x,y,period],i)=>{const e=document.createElement('span');e.className='contact-star';e.style.left=`${x*100}%`;e.style.top=`${y*100}%`;e.style.width=i%3?'3.5%':'5%';portal.append(e);return {e,period};});
  email.textContent=config.email||'';
  email.hidden=!config.email;
  if(config.email){email.href='mailto:'+config.email;email.removeAttribute('aria-disabled');}
  else {email.removeAttribute('href');email.setAttribute('aria-disabled','true');}
  const zero={aperture:0,red:0,black:0,text:0,dome:0,charge:0,link:0};
  let now=0,epoch=0,openedAt=0,target=false,pinned=false,hover=false,focus=false;
  let from={...zero},transitionStart=0,lastPose={...zero},lastRadius=40,debug={};
  let field={active:false,point:(x,y)=>[x,y]};
  function pose(t){
    const age=Math.max(0,t-transitionStart),v={};
    const schedules={aperture:[.2,1,portalEase],red:[.2,1.1,portalEase],black:[.2,1.005,portalEase],text:[.6,1.8,outEase],dome:[.18,1.1,portalEase],charge:[0,.6,chargeEase],link:[1,.3,outEase]};
    for(const key in zero){const [delay,duration,ease]=schedules[key];const p=target?ease((age-delay)/duration):leaveEase(age/.65);v[key]=mix(from[key],target?1:0,p);}
    return v;
  }
  function setOpen(value){
    if(value===target)return;
    from=pose(now);transitionStart=now;target=value;
    if(value)openedAt=now;else epoch=now+.65;
    if(motion().reduced||motion().paused){from=Object.fromEntries(Object.keys(zero).map(k=>[k,value?1:0]));transitionStart=now-3;}
    section.classList.toggle('contact-active',value);
    go.setAttribute('aria-expanded',String(value));
    portal.setAttribute('aria-hidden',String(!value));portal.inert=!value;
    draw(now);
  }
  function sync(){setOpen(pinned||hover||focus);}
  go.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hover=true;sync();}});
  // The active hit region follows the visible circle, never the mouse.
  section.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse')return;
    const r=section.getBoundingClientRect();
    const inside=Math.hypot(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2)<=lastRadius+5;
    if(hover!==inside){hover=inside;sync();}
  },{passive:true});
  section.addEventListener('pointerleave',()=>{hover=false;sync();});
  go.addEventListener('focus',()=>{if(go.matches(':focus-visible')){focus=true;sync();}});
  section.addEventListener('focusout',()=>queueMicrotask(()=>{focus=section.contains(document.activeElement);sync();}));
  go.addEventListener('click',()=>{pinned=true;sync();});
  function dismiss(){pinned=hover=focus=false;setOpen(false);go.focus({preventScroll:true});focus=false;setOpen(false);}
  close.addEventListener('click',dismiss);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&target)dismiss();});
  function charY(t){const p=mod(t,2)/2;if(p<.25)return -.52*upEase(p/.25);if(p<.75)return mix(-.52,.52,downEase((p-.25)/.5));return .52*(1-returnEase((p-.75)/.25));}
  function drawWall(target,{x=0,y=0,width,height}){
    const w=section.clientWidth,h=section.clientHeight,margin=80,step=8;
    const minY=Math.floor((y-margin)/step)*step,maxY=Math.ceil((y+height+margin)/step)*step;
    target.save();target.translate(-x,-y);target.strokeStyle=palette().ink;target.globalAlpha=.9;target.lineWidth=1;target.beginPath();
    for(let i=-1;i<=13;i++)for(let v=minY;v<=maxY;v+=step){
      const p=field.point(w*i/12,v);if(v===minY)target.moveTo(...p);else target.lineTo(...p);
    }
    const row=h/8;
    for(let i=Math.floor((y-margin)/row);i<=Math.ceil((y+height+margin)/row);i++){
      for(let u=-margin;u<=w+margin;u+=step){const p=field.point(u,i*row);if(u===-margin)target.moveTo(...p);else target.lineTo(...p);}
    }
    target.stroke();target.restore();
  }
  function draw(t){
    now=t;const {ink,paper}=palette(),{reduced}=motion();
    const w=section.clientWidth,h=section.clientHeight,cx=w/2,cy=h/2;
    const base=Math.min(48,Math.max(30,w*.029)),R=Math.min(h*.465,w*.46);
    const v=pose(t);lastPose=v;
    const cycle=reduced?0:mod(Math.max(0,t-epoch),3.6);
    let bounce=1;
    if(cycle<1.35)bounce=1+.22*smooth(cycle/1.35);
    else if(cycle<1.54)bounce=mix(1.22,.78,Math.pow((cycle-1.35)/.19,2));
    else if(cycle<1.9)bounce=mix(.78,1,outEase((cycle-1.54)/.36));
    const rippleAge=cycle-1.48,diagonal=Math.hypot(cx,cy);
    // Wider spatial pulse, faster travel: calm curvature with a decisive push.
    // Keep amplitude independent of width; the latest reference calls for a
    // smaller deformation as well as stronger, clearer grid lines.
    const waveWidth=Math.max(96,h*.22);
    const front=rippleAge*(diagonal+waveWidth*2)/1.15;
    const amplitude=rippleAge>0&&rippleAge<1.5?10*(1-smooth((rippleAge-1.1)/.4))*(1-v.dome):0;
    const displacement=d=>{
      const q=(d-front)/waveWidth;
      return amplitude*(-q)*Math.exp(-q*q*1.8)*2.4;
    };
    const point=(x,y)=>{
      const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
      // A broad radial bulge remains around the open circular window.
      const bulge=v.dome*R*.06*Math.exp(-Math.pow(d/(R*1.9),2));
      const f=(displacement(d)+bulge)/(d||1);
      return [x+dx*f,y+dy*f];
    };
    // The adjacent upright wall samples this exact field in Contact coordinates.
    field={active:!reduced&&(amplitude>0||v.dome>0),point};
    ctx.clearRect(0,0,w,h);drawWall(ctx,{width:w,height:h});ctx.globalAlpha=1;
    const goRadius=base*mix(bounce,1.5,v.charge);
    ctx.fillStyle=ink;ctx.beginPath();ctx.arc(cx,cy,goRadius,0,Math.PI*2);ctx.fill();
    // Text and GO use the same centre; the iris progressively covers GO.
    ctx.font=`700 ${base*1.22*mix(bounce,1.8,v.charge)}px Display`;ctx.textAlign='center';ctx.textBaseline='alphabetic';
    const m=ctx.measureText('GO');ctx.fillStyle=paper;ctx.fillText('GO',cx,cy+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);
    const diameter=R*2,aperture=R*v.aperture;
    lastRadius=Math.max(goRadius,aperture);
    portal.style.setProperty('--contact-size',`${diameter}px`);
    portal.style.clipPath=`circle(${aperture}px at 50% 50%)`;
    portal.style.visibility=v.aperture>0?'visible':'hidden';
    portal.style.pointerEvents=target&&v.aperture>.5?'auto':'none';
    portal.style.setProperty('--red-rim',`${mix(R,Math.max(8,diameter*.02),v.red)}px`);
    portal.style.setProperty('--black-rim',`${mix(R,1,v.black)}px`);
    portal.style.setProperty('--word-scale',mix(.5,1,v.text));
    email.style.opacity=v.link;email.tabIndex=target&&v.link>.5&&!!config.email?0:-1;
    close.tabIndex=target?0:-1;
    // Original mechanism: a shared 2s up/down cycle, 0.1s stagger, and
    // three delayed edge slices. Each half clips at the centre seam.
    const textTime=reduced?.5:t-openedAt;
    for(const s of slices){
      const delay=(s.index+1)*.1+s.offset;
      const y=reduced?(s.row==='top'?-.52:.52):charY(textTime-delay);
      s.span.style.transform=`translateY(${y*100}%)`;
      const toggle=mod(textTime-delay-(s.row==='top'?.45:1.45),2);
      s.span.style.opacity=!s.layer||(!reduced&&toggle<=1)?'1':'0';
    }
    for(const {e,period} of stars){const a=reduced?0:(1-Math.cos(t/period*Math.PI*2))/2;e.style.transform=`translate(-50%,-50%) translateY(${-15*a}%) scale(${1-.5*a})`;}
    go.style.width=go.style.height=`${base*2.5}px`;
    go.style.pointerEvents=target&&v.aperture>.5?'none':'auto';
    debug={cycle,bounce,rippleAge,front,amplitude,waveWidth,open:target,aperture,redRim:mix(R,Math.max(8,diameter*.02),v.red),diameter,textTime};
  }
  return {draw,drawWall,field:()=>field,debug:()=>debug,capture:(t,state='idle',age=0)=>{
    pinned=hover=focus=false;target=state==='open';epoch=0;openedAt=t-age;
    from={...zero};transitionStart=t-age;
    section.classList.toggle('contact-active',target);go.setAttribute('aria-expanded',String(target));portal.inert=!target;portal.setAttribute('aria-hidden',String(!target));draw(t);
  }};
};
