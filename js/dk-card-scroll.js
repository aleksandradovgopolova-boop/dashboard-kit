/* Explicit arrows + native horizontal list; no autoplay or drag hijacking. */
(function(){
 'use strict';
 window.dkCardScroll = function(root){
  if(typeof root==='string')root=document.querySelector(root);
  if(!root)throw new Error('dkCardScroll: root required');
  var list=root.querySelector('.dk-card-scroll__list'), prev=root.querySelector('[data-scroll-prev]'), next=root.querySelector('[data-scroll-next]');
  if(!list || !prev || !next)throw new Error('dkCardScroll: list and arrows required');
  var abort=new AbortController();
  function rtl(){return getComputedStyle(list).direction==='rtl';}
  function update(){var pos=Math.abs(list.scrollLeft),max=list.scrollWidth-list.clientWidth;prev.disabled=pos<=1;next.disabled=pos>=max-1;}
  function go(delta){list.scrollBy({left:delta*list.clientWidth*0.8*(rtl()?-1:1),behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
  prev.addEventListener('click',function(){go(-1);},{signal:abort.signal});next.addEventListener('click',function(){go(1);},{signal:abort.signal});list.addEventListener('scroll',update,{passive:true,signal:abort.signal});
  var resize=new ResizeObserver(update);resize.observe(list);
  var mutations=new MutationObserver(update);mutations.observe(list,{childList:true,subtree:true,characterData:true});
  update();return {refresh:update,destroy:function(){abort.abort();resize.disconnect();mutations.disconnect();}};
 };
}());
