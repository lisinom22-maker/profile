/* A single, seekable entrance timeline. Logo geometry follows the supplied mark. */
(() => {
  'use strict';
  const root=document.documentElement, page=document.querySelector('.page');
  const overlay=document.querySelector('.site-intro'), logo=overlay.querySelector('svg');
  const columns=[...logo.querySelectorAll('[data-column]')];
  const rails=[...logo.querySelectorAll('[data-rail]')];
  const query=new URLSearchParams(location.search);
  const entryHash=location.hash;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=n=>Math.max(0,Math.min(1,n));
  const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  const out=n=>1-Math.pow(1-clamp(n),3);
  const inward=n=>Math.pow(clamp(n),3);
  let time=0,manual=query.has('intro'),done=false,ready=false,last=performance.now();
  const duration=3.2;
  function finish(){
    const wasActive=!done;
    done=true;root.classList.remove('intro-active');page.inert=false;overlay.hidden=true;
    document.querySelector('.header').style.clipPath='';
    document.querySelector('.hero-title').style.clipPath='';
    document.querySelectorAll('.hero-title .letter-inner').forEach(el=>el.style.translate='');
    document.querySelectorAll('.ticker').forEach(el=>el.style.removeProperty('--intro-ticker'));
    clearTimeout(window.__introFailsafe);
    if(wasActive&&!manual&&entryHash&&entryHash!=='#top'){
      document.getElementById(entryHash.slice(1))?.scrollIntoView({behavior:'instant'});
    }
  }
  function render(t){
    time=Math.max(0,Number(t)||0);
    if(time>=duration){finish();return;}
    done=false;overlay.hidden=false;root.classList.add('intro-active','intro-ready');page.inert=true;
    if(scrollY!==0)window.scrollTo({top:0,behavior:'instant'});
    // Background construction overlaps the mark's middle strokes.
    const border=smooth((time-.65)/.7);
    overlay.style.setProperty('--intro-frame',`${border*parseFloat(getComputedStyle(root).getPropertyValue('--frame'))}px`);
    overlay.querySelector('.intro-veil').style.transform=`scaleY(${1-smooth((time-.65)/.25)})`;
    // Clip a full-height column, rather than scaling separated segments. The
    // reveal front traverses the fifth column's empty middle at the same speed.
    const starts=[.22,.38,.54,.70,1.20];
    columns.forEach((el,i)=>{
      const growth=out((time-starts[i])/.5)*509;
      const retreat=inward((time-1.85-i*.1)/.6)*509;
      const mask=logo.querySelector(`#intro-column-${i} rect`);
      mask.setAttribute('y',509-growth);
      mask.setAttribute('height',Math.max(0,growth-retreat));
    });
    rails.forEach(el=>{
      const grow=smooth((time-1.20)/.32),out=smooth((time-2.04)/.32);
      el.style.clipPath=`inset(0 ${100*(1-grow*(1-out))}% 0 0)`;
    });
    logo.style.visibility=time<2.9?'visible':'hidden';
    const headerBox=document.querySelector('.header').getBoundingClientRect();
    const titleBox=document.querySelector('.hero-title').getBoundingClientRect();
    const heroBottom=document.querySelector('.hero').getBoundingClientRect().bottom;
    overlay.querySelector('.intro-rule').style.top=`${headerBox.bottom*out((time-1.8)/.65)}px`;
    overlay.querySelector('.intro-rule').style.visibility=time<1.8?'hidden':'visible';
    const wipe=smooth((time-1.4)/1.1);
    const rising=out((time-.65)/.65);
    overlay.querySelector('.intro-lower').style.top=`${time<1.4?innerHeight+(heroBottom-innerHeight)*rising:heroBottom+(innerHeight-heroBottom)*wipe}px`;
    overlay.querySelector('.intro-lower').style.setProperty('--wipe-height',`${time<1.4?12:12+Math.sin(wipe*Math.PI)*titleBox.height*.45}px`);
    const header=smooth((time-2.05)/.65);
    document.querySelector('.header').style.clipPath=`inset(${(1-header)*100}% 0 0 0)`;
    const title=smooth((time-1.6)/.85);
    document.querySelector('.hero-title').style.clipPath=`inset(${(1-title)*100}% 0 0 0)`;
    document.querySelectorAll('.hero-title .letter-inner').forEach((el,i)=>{
      const amount=1-smooth((time-1.65-(i%9)*.025)/.55);
      el.style.translate=`0 ${amount*(i%2?105:-105)}%`;
    });
    document.querySelectorAll('.ticker').forEach(el=>el.style.setProperty('--intro-ticker',1-smooth((time-2.1)/.4)));
  }
  window.portfolioIntro={
    get active(){return !done;},
    // Columns enter from below in a shallow bowl, like the reference recording.
    waveOffset(x,height){const bowl=Math.sin(x*Math.PI)**2;const p=clamp((time-.65-.45*bowl)/(1.8-.35*bowl));return (height+32)*(1-p)**2;},
    capture(t){clearTimeout(window.__introFailsafe);manual=true;render(t);},
    debug(){return {time,done,ready,manual};},finish
  };
  window.__renderIntroAt=t=>{window.portfolioIntro.capture(t);window.__renderAt?.(t);};
  Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,2200))]).then(()=>ready=true);
  if(reduced.matches||(query.get('pause')==='1'&&!manual)){finish();return;}
  render(manual?Number(query.get('intro')):0);
  if(manual)clearTimeout(window.__introFailsafe);
  reduced.addEventListener('change',event=>{if(event.matches){manual=false;finish();}});
  // Escape skips the entrance; missing/slow assets never trap the page.
  addEventListener('keydown',event=>{if(event.key==='Escape'&&!done){manual=false;finish();}});
  function tick(now){
    const dt=Math.min((now-last)/1000,.06);last=now;
    if(!manual&&!done&&!document.hidden)render(ready||time<2.05?time+dt:time);
    if(!done&&!manual)requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
