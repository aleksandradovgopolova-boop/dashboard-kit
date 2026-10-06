/* Pointer lifecycle without suppressing native scrolling or keyboard clicks. */
(function(){
 'use strict';
 window.dkTouch = function(root, options){
  options = options || {}; if(typeof root === 'string') root = document.querySelector(root);
  if(!root) throw new Error('dkTouch: root required');
  var controller = new AbortController(), state = null;
  var threshold = Number.isFinite(options.threshold) ? Math.max(0,options.threshold) : 8;
  function payload(e){var dx=e.clientX-state.x,dy=e.clientY-state.y;return {event:e,pointerType:e.pointerType,startX:state.x,startY:state.y,shiftX:dx,shiftY:dy,duration:performance.now()-state.time,isSlide:Math.hypot(dx,dy)>=threshold,isX:Math.abs(dx)>Math.abs(dy),isY:Math.abs(dy)>=Math.abs(dx)};}
  function start(e){if(state || e.isPrimary===false || e.button!==0 || e.defaultPrevented)return;state={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};try{root.setPointerCapture(e.pointerId);}catch(_){} if(options.onStart)options.onStart(payload(e));}
  function move(e){if(state && e.pointerId===state.id && options.onMove)options.onMove(payload(e));}
  function finish(e,cancel){if(!state || e.pointerId!==state.id)return;var data=payload(e),id=state.id;state=null;try{if(root.hasPointerCapture(id))root.releasePointerCapture(id);}catch(_){} var fn=cancel?options.onCancel:options.onEnd;if(fn)fn(data);}
  root.addEventListener('pointerdown',start,{signal:controller.signal});root.addEventListener('pointermove',move,{signal:controller.signal});
  root.addEventListener('pointerup',function(e){finish(e,false);},{signal:controller.signal});root.addEventListener('pointercancel',function(e){finish(e,true);},{signal:controller.signal});root.addEventListener('lostpointercapture',function(e){finish(e,true);},{signal:controller.signal});
  return {destroy:function(){controller.abort();if(state){var id=state.id;state=null;try{if(root.hasPointerCapture(id))root.releasePointerCapture(id);}catch(_){}}}};
 };
}());
