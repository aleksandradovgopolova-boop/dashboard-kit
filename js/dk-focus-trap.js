/* Use native modal dialog where possible; this helper only contains focus. */
(function () {
 'use strict';
 var stack = [];
 window.dkFocusTrap = function (root, options) {
  options = options || {};
  if (typeof root === 'string') root = document.querySelector(root);
  if (!root) throw new Error('dkFocusTrap: root required');
  var previous = document.activeElement, oldTab = root.getAttribute('tabindex'), live = true;
  if (oldTab === null) root.setAttribute('tabindex','-1');
  function items() { return Array.from(root.querySelectorAll('button,a[href],input,select,textarea,[tabindex],[contenteditable="true"]')).filter(function(n){return !n.disabled && n.tabIndex >= 0 && !n.closest('[inert],[hidden]') && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';}); }
  function first() { return items()[0] || root; }
  function isTop() { return stack[stack.length - 1] === api && live; }
  function focusin(event) { if (isTop() && !root.contains(event.target)) first().focus(); }
  function key(event) {
   if (!isTop() || event.defaultPrevented) return;
   if (!root.isConnected || !root.getClientRects().length) { api.destroy(); return; }
   if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (typeof options.onEscape === 'function') options.onEscape(); else api.destroy(); return; }
   if (event.key !== 'Tab') return;
   var list = items(), current = document.activeElement;
   if (!list.length) { event.preventDefault(); root.focus(); return; }
   if (event.shiftKey && (current === list[0] || current === root || !root.contains(current))) { event.preventDefault(); list[list.length - 1].focus(); }
   else if (!event.shiftKey && (current === list[list.length - 1] || !root.contains(current))) { event.preventDefault(); list[0].focus(); }
  }
  var api = {destroy:function(){
   if (!live) return; live = false; stack = stack.filter(function(x){return x !== api;});
   document.removeEventListener('keydown',key,true); document.removeEventListener('focusin',focusin);
   if (oldTab === null) root.removeAttribute('tabindex'); else root.setAttribute('tabindex',oldTab);
   if (options.restoreFocus !== false && previous && previous.isConnected) previous.focus();
  }};
  stack.push(api); document.addEventListener('keydown',key,true); document.addEventListener('focusin',focusin);
  if (options.autoFocus !== false) (options.autoFocus === 'root' ? root : first()).focus();
  return api;
 };
}());
