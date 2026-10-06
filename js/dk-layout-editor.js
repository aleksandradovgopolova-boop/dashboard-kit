/* Widget arrangement, not a page builder. Only registered nodes can move.
   Explicit controls are the keyboard and touch alternative to dragging. */
(function(){
 'use strict';
 window.dkLayoutEditor=function(el,opts){
  if(!el)return null;opts=opts||{};var container=opts.container;if(!container)throw TypeError('layout editor needs container');
  var widgets=Array.from(container.children).filter(function(n){return n.dataset.widgetId;});
  var ids=widgets.map(function(n){return n.dataset.widgetId;});if(new Set(ids).size!==ids.length)throw Error('widget ids must be unique');
  var spans=['half','third','two-thirds','full'];
  function current(){return Array.from(container.children).filter(function(n){return widgets.includes(n);}).map(function(n){var span=spans.find(function(s){return n.classList.contains('dk-col--'+s);})||'full';return {id:n.dataset.widgetId,span:span,hidden:n.hidden};});}
  var baseline=current(),stopped=false,status='',storage=opts.storage;
  try{if(!storage)storage=localStorage;}catch(e){storage=null;}
  function apply(layout){if(stopped||!Array.isArray(layout))return;var used=new Set();layout.concat(baseline).forEach(function(item){var n=widgets.find(function(w){return w.dataset.widgetId===item.id;});if(!n||used.has(item.id))return;used.add(item.id);spans.forEach(function(s){n.classList.remove('dk-col--'+s);});n.classList.add('dk-col--'+(spans.includes(item.span)?item.span:'full'));n.hidden=!!item.hidden;container.append(n);});}
  if(opts.key)try{var raw=storage&&storage.getItem(opts.key);if(raw){var doc=JSON.parse(raw);if(doc.version!==1)throw Error('Unsupported layout version');apply(doc.widgets);}}catch(e){status='Раскладка не загружена: '+e.message;storage=null;}
  function persist(){if(!opts.key)return;try{if(!storage)throw Error('storage unavailable');storage.setItem(opts.key,JSON.stringify({version:1,widgets:current()}));status='Раскладка сохранена';}catch(e){status='Изменения только в памяти: '+e.message;}}
  function render(){el.innerHTML='<div class="dk-layout-editor"><p>Порядок и ширина виджетов. На телефоне виджеты остаются в одну колонку.</p><ul>'+current().map(function(item,i){var w=widgets.find(function(n){return n.dataset.widgetId===item.id;});return '<li data-id="'+window.dkEsc(item.id)+'"><b>'+window.dkEsc(w.dataset.widgetLabel||item.id)+'</b><button class="dk-btn" type="button" data-action="up"'+(!i?' disabled':'')+'>Выше</button><button class="dk-btn" type="button" data-action="down"'+(i===widgets.length-1?' disabled':'')+'>Ниже</button><label>Ширина <select data-span aria-label="'+window.dkEsc('Ширина: '+(w.dataset.widgetLabel||item.id))+'">'+spans.map(function(s){return '<option value="'+s+'"'+(s===item.span?' selected':'')+'>'+({'half':'Половина','third':'Треть','two-thirds':'Две трети','full':'Полная'})[s]+'</option>';}).join('')+'</select></label><button class="dk-btn" type="button" data-action="visibility" aria-pressed="'+String(!item.hidden)+'">'+(item.hidden?'Показать':'Скрыть')+'</button></li>';}).join('')+'</ul><button class="dk-btn" type="button" data-action="reset">Сбросить раскладку</button><p role="status">'+window.dkEsc(status)+'</p></div>';}
  function change(e){var row=e.target.closest('[data-id]');if(!row||!e.target.matches('[data-span]'))return;var layout=current();layout.find(function(x){return x.id===row.dataset.id;}).span=e.target.value;apply(layout);persist();if(opts.onChange)opts.onChange(current());}
  function click(e){var b=e.target.closest('[data-action]');if(!b||!el.contains(b)||stopped)return;var action=b.dataset.action,row=b.closest('[data-id]'),id=row&&row.dataset.id,layout=current(),at=layout.findIndex(function(x){return x.id===id;});
   if(action==='reset')apply(baseline);else if(at>=0){if(action==='visibility')layout[at].hidden=!layout[at].hidden;else{var to=at+(action==='up'?-1:1);if(to<0||to>=layout.length)return;layout.splice(to,0,layout.splice(at,1)[0]);}apply(layout);}persist();render();if(opts.onChange)opts.onChange(current());var target=Array.from(el.querySelectorAll('[data-id]')).find(function(n){return n.dataset.id===id;});var next=target&&target.querySelector('[data-action="'+action+'"]');if(next&&!next.disabled)next.focus();else el.querySelector('[data-action=reset]').focus();
  }
  el.addEventListener('click',click);el.addEventListener('change',change);render();var release=window.dkOwn(el,function(){stopped=true;el.removeEventListener('click',click);el.removeEventListener('change',change);el.replaceChildren();});
  return {get:current,update:function(layout){if(!stopped){apply(layout);persist();render();}},reset:function(){if(!stopped){apply(baseline);persist();render();}},destroy:release};
 };
})();
