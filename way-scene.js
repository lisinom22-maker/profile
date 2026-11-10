/* One printed surface folded from a perspective plane onto an upright wall.
 * Both halves sample the same text coordinates at the fold; no crossfade.
 */
window.createWayScene=({canvas,section,copy,smiley,palette,contactSection,contactField,drawContactWall,columns=12})=>{
  const ctx=canvas.getContext('2d');
  const texture=document.createElement('canvas'),tc=texture.getContext('2d');
  let cache='',textureHeight=0,yearHeight=0,state={};
  const clamp=x=>Math.max(0,Math.min(1,x));
  function prepare(w,h,ink){
    const lines=[...copy.children].map(el=>el.textContent);
    const key=[w,h,ink,...lines,document.fonts.status].join('|');
    if(cache===key)return;
    cache=key;
    const tw=w*.58,unit=Math.min(w,h*1.9);
    const heights=[.13,.15,.22,.40].map(n=>n*unit),gap=unit*.014;
    yearHeight=heights[3];textureHeight=heights.reduce((a,b)=>a+b,0)+gap*3;
    texture.width=Math.ceil(tw*2);texture.height=Math.ceil(textureHeight*2);
    tc.setTransform(2,0,0,2,0,0);tc.fillStyle=ink;tc.font='700 200px Display';
    tc.textBaseline='alphabetic';
    let y=0;
    lines.forEach((text,i)=>{
      const m=tc.measureText(text),left=m.actualBoundingBoxLeft||0;
      const ascent=m.actualBoundingBoxAscent||150,descent=m.actualBoundingBoxDescent||0;
      const width=m.actualBoundingBoxRight+left||m.width;
      const print=()=>{tc.scale(tw/width,heights[i]/(ascent+descent));tc.fillText(text,left,ascent);};
      tc.save();tc.translate(0,y);
      // SINCE must remain a complete, stable glyph row. Drawing it through
      // the same full-height path as the other rows prevents its lower edge
      // from being clipped during the MY WAY to Contact transition.
      print();
      tc.restore();y+=heights[i]+gap;
    });
  }
  function draw(reduced=false,time=0){
    const rect=section.getBoundingClientRect(),w=canvas.clientWidth,h=innerHeight;
    if(!w||rect.top>h||rect.bottom<0)return;
    const rawProgress=clamp(-rect.top/Math.max(1,rect.height-h));
    // The printed year settles at the lower edge before the sticky wall
    // releases; the remaining scroll reveals Contact without carrying 2026
    // into that page.
    const p=Math.min(rawProgress,.72);
    const {ink,paper}=palette();prepare(w,h,ink);
    const cx=w/2,cy=h*(.5-1.25*p),depth=h*.55;
    // Keep the final year at the lower edge of the connecting wall. The
    // preceding lines follow it down slightly, while the year never enters
    // Contact once the sticky surface releases.
    // Fit the complete printed year before releasing the sticky surface.
    // A width-based glyph can be taller on a wide, short viewport: reserving
    // only a fixed scroll percentage used to crop its bottom permanently.
    const endFold=h*(1.28-1.16*.72);
    const endOffset=-textureHeight-h*.15+.72*(yearHeight+h*.46);
    const endBottom=endFold+endOffset+textureHeight;
    const fittedBottom=Math.min(endBottom,h*.94);
    const fittedFold=Math.min(endFold,fittedBottom-yearHeight-yearHeight*.121);
    const u=clamp((p-.30)/.42),settle=u*u*(3-2*u);
    const fold=h*(1.28-1.16*p)+(fittedFold-endFold)*settle;
    const offset=-textureHeight-h*.15+p*(yearHeight+h*.46)
      +(fittedBottom-endBottom-(fittedFold-endFold))*settle;
    const contact=contactSection.getBoundingClientRect(),r=canvas.getBoundingClientRect();
    const field=contactField(),joined=contact.top<innerHeight&&contact.bottom>0;
    const deform=joined&&field.active&&!reduced;
    ctx.clearRect(0,0,w,h);ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.globalAlpha=.65;
    // The perspective grid and the projected text share one vanishing point.
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,Math.max(0,fold));ctx.clip();ctx.beginPath();
    for(let i=0;i<=columns;i++){
      const x=w*i/columns;
      ctx.moveTo(cx,cy);ctx.lineTo(x,fold);
      ctx.moveTo(cx,cy);ctx.lineTo(x,0);
    }
    for(let i=0;i<=10;i++){
      const y=Math.min(h,fold)*i/10;
      ctx.moveTo(cx,cy);ctx.lineTo(0,y);
      ctx.moveTo(cx,cy);ctx.lineTo(w,y);
    }
    ctx.stroke();ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(0,fold,w,h);ctx.clip();
    if(joined){
      drawContactWall(ctx,{x:r.left-contact.left,y:r.top-contact.top,width:w,height:h});
    }else{
      ctx.globalAlpha=.9;ctx.beginPath();
      for(let i=0;i<=columns;i++){const x=w*i/columns;ctx.moveTo(x,fold);ctx.lineTo(x,h);}
      const step=contactSection.clientHeight/8;
      for(let y=h;y>=fold;y-=step){ctx.moveTo(0,y);ctx.lineTo(w,y);}
      ctx.stroke();
    }
    ctx.beginPath();ctx.moveTo(0,fold);ctx.lineTo(w,fold);ctx.stroke();ctx.restore();ctx.globalAlpha=1;
    if(reduced)return;
    // Inverse projection per output scanline avoids holes during magnification.
    // At the fold both mappings are exactly u -> u, v -> 0.
    const tw=texture.width/2,dpr=canvas.height/h,stepY=1/dpr;
    const sourceY=y=>y>=fold?y-fold:depth*(1-(fold-cy)/(y-cy));
    for(let y=Math.max(0,cy+.5);y<h;y+=stepY){
      const v=sourceY(y+stepY*.5),sy=v-offset;
      if(sy<0||sy>=textureHeight)continue;
      const scale=y>=fold?1:(y+stepY*.5-cy)/(fold-cy);
      const next=sourceY(y+stepY),prev=sourceY(y);
      const sh=Math.min(textureHeight-sy,Math.max(.1,next-prev));
      ctx.drawImage(texture,0,sy*2,texture.width,sh*2,cx-tw*scale/2,y,tw*scale,stepY+.25);
    }
    smiley.style.top=`${cy-smiley.offsetHeight/2}px`;
    smiley.style.visibility=cy<-50?'hidden':'visible';
    state={progress:p,rawProgress,vanishing:{x:cx,y:cy},fold,sourceOffset:offset,yearHeight,
      uprightYearFraction:clamp((offset+textureHeight)/yearHeight),reduced};
    // Keep the typography layer stable while the shared wall below it ripples.
    // This preserves the tuned MY WAY / since / 2026 positions as the seam moves.
    state.rippleActive=deform;
  }
  return {draw,debug:()=>state,invalidate:()=>cache=''};
};
