/* Multi-select taxonomy, bounded DOM. No virtualization: keep the accessible
   tree and visual order identical. Reject oversized data rather than hide it. */
(function(){
 'use strict';var serial=0;
 window.dkTreeSelect=function(el,opts){
  if(!el)return null;opts=opts||{};var nodes=[],byId=Object.create(null),selected=new Set(),expanded=new Set(),stopped=false,query='',cursor=null,id='dk-tree-'+(++serial);
  function walk(items,parent,level){(items||[]).forEach(function(item){if(!item||item.id==null)throw TypeError('tree node needs id');var key=String(item.id);if(byId[key])throw Error('duplicate tree id');if(nodes.length>=1000)throw RangeError('tree supports up to 1000 nodes; narrow the taxonomy');var n={id:key,label:String(item.label||key),parent:parent,level:level,children:[],disabled:!!item.disabled};byId[key]=n;nodes.push(n);if(parent)parent.children.push(n);walk(item.children,n,level+1);});}
  walk(opts.nodes,null,1);
  window.dkDestroy(el);
  function leaves(n){return n.children.length?n.children.reduce(function(all,c){return all.concat(leaves(c));},[]):[n];}
  function eligible(n){return !n.disabled&&(!n.parent||eligible(n.parent));}
  function normalize(values){selected.clear();(values||[]).forEach(function(key){var n=byId[String(key)];if(n)leaves(n).filter(eligible).forEach(function(x){selected.add(x.id);});});}
  normalize(opts.value||[]);
  function checked(n){var list=leaves(n).filter(eligible),count=list.filter(function(x){return selected.has(x.id);}).length;return count&&count===list.length?'true':count?'mixed':'false';}
  function matches(n){return n.label.toLocaleLowerCase().includes(query)||n.children.some(matches);}
  function visible(n){if(query)return matches(n);return !n.parent||visible(n.parent)&&expanded.has(n.parent.id);}
  function list(){return nodes.filter(visible);}
  el.innerHTML='<div class="dk-tree-select"><label for="'+id+'-search">'+window.dkEsc(opts.label||'Выбор категорий')+'</label><input id="'+id+'-search" type="search" placeholder="Найти категорию"><div class="dk-tree" role="tree" aria-multiselectable="true" aria-label="'+window.dkEsc(opts.label||'Категории')+'"></div><p role="status" aria-live="polite"></p></div>';
  var search=el.querySelector('input'),tree=el.querySelector('[role=tree]'),status=el.querySelector('[role=status]');
  function render(focus){var shown=list();if(!shown.some(function(n){return n.id===cursor;}))cursor=shown.length?shown[0].id:null;
   tree.replaceChildren();shown.forEach(function(n){var row=document.createElement('div');row.className='dk-tree__item';row.dataset.id=n.id;row.setAttribute('role','treeitem');row.setAttribute('aria-level',n.level);row.setAttribute('aria-checked',checked(n));row.setAttribute('aria-disabled',String(!eligible(n)));var siblings=n.parent?n.parent.children:nodes.filter(function(x){return !x.parent;});row.setAttribute('aria-setsize',siblings.length);row.setAttribute('aria-posinset',siblings.indexOf(n)+1);if(n.children.length)row.setAttribute('aria-expanded',String(!!query||expanded.has(n.id)));row.tabIndex=n.id===cursor?0:-1;row.style.paddingLeft=(n.level*16)+'px';if(n.children.length){var exp=document.createElement('span');exp.className='dk-tree__expand';exp.dataset.expand=n.id;exp.setAttribute('aria-hidden','true');exp.append(window.dkIcon.el(expanded.has(n.id)||query?'chevron-down':'chevron-right','dk-i dk-i--sm'));row.append(exp);}var st=checked(n);var box=document.createElement('span');box.className='dk-tree__check';box.dataset.state=st;box.setAttribute('aria-hidden','true');if(st==='true')box.append(window.dkIcon.el('check','dk-i'));else if(st==='mixed')box.append(window.dkIcon.el('minus','dk-i'));row.append(box);row.append(document.createTextNode(n.label));tree.append(row);});
   status.textContent=shown.length?'Выбрано: '+selected.size:'Ничего не найдено';if(focus){var row=Array.from(tree.children).find(function(r){return r.dataset.id===cursor;});if(row)row.focus();else search.focus();}
  }
  function notify(){var v=Array.from(selected);if(opts.onChange)opts.onChange(v);el.dispatchEvent(new CustomEvent('dk:change',{bubbles:true,detail:{value:v.slice()}}));}
  function toggle(n){if(!eligible(n))return;var on=checked(n)!=='true';leaves(n).filter(eligible).forEach(function(x){if(on)selected.add(x.id);else selected.delete(x.id);});render(true);notify();}
  function click(e){var row=e.target.closest('[role=treeitem]');if(!row||!tree.contains(row))return;cursor=row.dataset.id;if(e.target.closest('[data-expand]')){if(expanded.has(cursor))expanded.delete(cursor);else expanded.add(cursor);render(true);}else toggle(byId[cursor]);}
  function key(e){var row=e.target.closest('[role=treeitem]');if(!row)return;cursor=row.dataset.id;var n=byId[cursor],shown=list(),at=shown.indexOf(n),next=n;
   if(e.key==='ArrowDown')next=shown[Math.min(at+1,shown.length-1)];else if(e.key==='ArrowUp')next=shown[Math.max(at-1,0)];else if(e.key==='Home')next=shown[0];else if(e.key==='End')next=shown[shown.length-1];
   else if(e.key==='ArrowRight'&&n.children.length){if(expanded.has(n.id)||query)next=n.children.find(visible)||n;else expanded.add(n.id);}
   else if(e.key==='ArrowLeft'){if(expanded.has(n.id)&&!query)expanded.delete(n.id);else next=n.parent||n;}
   else if(e.key===' '||e.key==='Enter'){e.preventDefault();toggle(n);return;}
   else return;e.preventDefault();cursor=next.id;render(true);
  }
  function input(){query=search.value.trim().toLocaleLowerCase();render(false);}
  tree.addEventListener('click',click);tree.addEventListener('keydown',key);search.addEventListener('input',input);render();
  var release=window.dkOwn(el,function(){stopped=true;tree.removeEventListener('click',click);tree.removeEventListener('keydown',key);search.removeEventListener('input',input);el.replaceChildren();});
  return {value:function(v){if(!arguments.length)return Array.from(selected);if(!stopped){normalize(v);render();}},expand:function(key){if(!stopped&&byId[key]){expanded.add(String(key));render();}},update:function(o){if(!stopped&&o.value){normalize(o.value);render();}},destroy:release};
 };
})();
