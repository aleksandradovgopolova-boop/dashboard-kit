/* Context stays optional. Details reuse the existing modal/focus contract. */
(function () {
  'use strict';
  var serial=0;
  window.dkTooltip=function(trigger,opts){
    if(!trigger)return null;opts=opts||{};
    window.dkDestroy(trigger);
    var stopped=false,shown=false,pinned=false,timer=null,tip=document.createElement('span'),id='dk-tooltip-'+(++serial);
    var original=trigger.getAttribute('aria-describedby');
    tip.id=id;tip.className='dk-tooltip';tip.setAttribute('role','tooltip');tip.textContent=opts.text||'';tip.hidden=true;
    var root=trigger.closest('dialog')||trigger.closest('.dk-root')||document.body;root.append(tip);
    trigger.setAttribute('aria-describedby',(original?original+' ':'')+id);
    function position(){var r=trigger.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(r.left,innerWidth-tip.offsetWidth-8))+'px';tip.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-tip.offsetHeight-8))+'px';}
    function show(){clearTimeout(timer);if(stopped)return;tip.hidden=false;shown=true;position();}
    function hide(){clearTimeout(timer);tip.hidden=true;shown=false;pinned=false;}
    function leave(){if(!pinned)timer=setTimeout(hide,180);}
    function toggle(){if(pinned)hide();else{pinned=true;show();}}
    function key(e){if(e.key==='Escape'&&shown){e.preventDefault();hide();}}
    function outside(e){if(!trigger.contains(e.target)&&!tip.contains(e.target))hide();}
    trigger.addEventListener('mouseenter',show);trigger.addEventListener('mouseleave',leave);
    tip.addEventListener('mouseenter',show);tip.addEventListener('mouseleave',leave);
    trigger.addEventListener('focus',show);trigger.addEventListener('blur',hide);trigger.addEventListener('click',toggle);
    document.addEventListener('keydown',key);document.addEventListener('click',outside);window.addEventListener('resize',hide);window.addEventListener('scroll',hide,true);
    var release=window.dkOwn(trigger,function(){stopped=true;clearTimeout(timer);tip.remove();
      if(original===null)trigger.removeAttribute('aria-describedby');else trigger.setAttribute('aria-describedby',original);
      trigger.removeEventListener('mouseenter',show);trigger.removeEventListener('mouseleave',leave);trigger.removeEventListener('focus',show);trigger.removeEventListener('blur',hide);trigger.removeEventListener('click',toggle);
      tip.removeEventListener('mouseenter',show);tip.removeEventListener('mouseleave',leave);
      document.removeEventListener('keydown',key);document.removeEventListener('click',outside);window.removeEventListener('resize',hide);window.removeEventListener('scroll',hide,true);
    });
    return {show:show,hide:hide,update:function(next){if(!stopped){tip.textContent=(next||{}).text||'';if(shown)position();}},destroy:release};
  };
})();
