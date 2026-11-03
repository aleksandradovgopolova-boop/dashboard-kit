/* Interactive, nonmodal context. Tooltip remains the short-text component. */
(function () {
  'use strict';
  var serial = 0, active = null;
  window.dkPopover = function (trigger, options) {
    if (!trigger || trigger.tagName !== 'BUTTON') throw new TypeError('dkPopover: button required');
    options = options || {};
    window.dkDestroy(trigger);
    var panel = document.createElement('section'), head = document.createElement('div'), title = document.createElement('h2');
    var body = document.createElement('div'), closeButton = document.createElement('button');
    var native = typeof panel.showPopover === 'function', opened = false, pending = false, generation = 0, stopped = false, frame = 0, observer = null, owner = null;
    var original = {}, settings = {}, prefix = 'dk-popover-' + (++serial);
    ['aria-haspopup', 'aria-expanded', 'aria-controls'].forEach(function (name) { original[name] = trigger.getAttribute(name); });
    panel.id = prefix; panel.className = 'dk-popover'; panel.hidden = true; panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', prefix + '-title');
    if (native) panel.setAttribute('popover', 'manual');
    head.className = 'dk-popover__head'; title.id = prefix + '-title'; title.className = 'dk-popover__title';
    body.className = 'dk-popover__body'; closeButton.type = 'button'; closeButton.className = 'dk-iconbtn dk-iconbtn--sm';
    closeButton.setAttribute('aria-label', 'Закрыть'); closeButton.title = 'Закрыть'; closeButton.textContent = '×';
    head.append(title, closeButton); panel.append(head, body);
    function items() {
      return Array.from(panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex],[contenteditable="true"]')).filter(function (el) {
        return !el.disabled && el.tabIndex >= 0 && !el.closest('[inert],[hidden]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      });
    }
    function first() { return items().find(function (el) { return el !== closeButton; }) || closeButton; }
    function position() {
      frame = 0; if (!opened) return;
      if (!trigger.isConnected || !panel.isConnected || !trigger.getClientRects().length) { close(false); return; }
      var style = getComputedStyle(panel), gap = parseFloat(style.getPropertyValue('--space-3')) || 6;
      var gutter = parseFloat(style.getPropertyValue('--space-4')) || 8, viewport = window.visualViewport;
      var left = viewport ? viewport.offsetLeft : 0, top = viewport ? viewport.offsetTop : 0;
      var width = viewport ? viewport.width : innerWidth, height = viewport ? viewport.height : innerHeight;
      panel.style.maxWidth = Math.max(0, width - gutter * 2) + 'px'; panel.style.maxHeight = Math.max(0, height - gutter * 2) + 'px';
      var rect = trigger.getBoundingClientRect(), box = panel.getBoundingClientRect();
      if (rect.bottom < top || rect.top > top + height || rect.right < left || rect.left > left + width) { close(false); return; }
      var below = top + height - gutter - rect.bottom - gap, above = rect.top - gap - top - gutter;
      var useTop = settings.placement === 'top' ? above >= box.height || above > below : settings.placement === 'bottom' ? !(below >= box.height || below >= above) : below < box.height && above > below;
      var y = useTop ? rect.top - gap - box.height : rect.bottom + gap;
      panel.style.left = Math.max(left + gutter, Math.min(rect.left, left + width - gutter - box.width)) + 'px';
      panel.style.top = Math.max(top + gutter, Math.min(y, top + height - gutter - box.height)) + 'px';
      panel.dataset.placement = useTop ? 'top' : 'bottom';
    }
    function schedule() { if (opened && !frame) frame = requestAnimationFrame(position); }
    function close(restore) {
      pending = false; generation++;
      document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', focus);
      if (owner) owner.removeEventListener('close', parentClosed);
      if (!opened) { if (active === api) active = null; return; } opened = false;
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', focus); window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule);
      if (window.visualViewport) { visualViewport.removeEventListener('resize', schedule); visualViewport.removeEventListener('scroll', schedule); }
      if (owner) owner.removeEventListener('close', parentClosed);
      if (observer) { observer.disconnect(); observer = null; }
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      if (native && panel.matches(':popover-open')) panel.hidePopover(); panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false'); if (active === api) active = null;
      if (restore !== false && trigger.isConnected && !trigger.disabled && trigger.getClientRects().length) trigger.focus();
    }
    function parentClosed() { close(false); }
    function outside(event) { if (!panel.contains(event.target) && !trigger.contains(event.target)) close(false); }
    function focus(event) { if (!panel.contains(event.target) && !trigger.contains(event.target)) close(false); }
    function key(event) {
      if (!opened || event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      var list = items(), current = document.activeElement;
      if (event.shiftKey && (current === list[0] || current === panel)) { event.preventDefault(); close(); }
      else if (!event.shiftKey && (current === list[list.length - 1] || current === panel && !list.length)) {
        // Resume the natural tab order after the trigger, without a focus trap.
        close(false); trigger.focus();
      }
    }
    async function open() {
      if (trigger.closest('.dk-popover')) throw new TypeError('dkPopover: nested popovers are not supported');
      if (stopped || opened || pending || trigger.disabled || !trigger.isConnected || !trigger.getClientRects().length) return;
      if (active && active !== api) active.close(false);
      owner = trigger.closest('dialog');
      var ticket = ++generation; pending = true; active = api;
      document.addEventListener('pointerdown', outside, true); document.addEventListener('focusin', focus);
      if (owner) owner.addEventListener('close', parentClosed);
      if (owner) {
        // A transforming entry animation creates a temporary fixed-position
        // containing block. Wait for its real completion, including fallback.
        getComputedStyle(owner).transform;
        var animations = owner.getAnimations().filter(function (animation) { return animation.effect && animation.effect.getTiming().iterations !== Infinity; });
        if (animations.length) await Promise.allSettled(animations.map(function (animation) { return animation.finished; }));
      }
      if (stopped || ticket !== generation || !trigger.isConnected || trigger.disabled || !trigger.getClientRects().length || owner && !owner.open) { if (ticket === generation) close(false); return false; }
      pending = false;
      (owner || trigger.closest('.dk-root') || document.body).append(panel);
      panel.hidden = false;
      if (native) panel.showPopover();
      opened = true; active = api; trigger.setAttribute('aria-expanded', 'true'); position(); if (!opened) return;
      document.addEventListener('pointerdown', outside, true); document.addEventListener('focusin', focus);
      window.addEventListener('scroll', schedule, true); window.addEventListener('resize', schedule);
      if (window.visualViewport) { visualViewport.addEventListener('resize', schedule); visualViewport.addEventListener('scroll', schedule); }
      if (owner) owner.addEventListener('close', parentClosed);
      if (typeof ResizeObserver === 'function') { observer = new ResizeObserver(schedule); observer.observe(panel); observer.observe(trigger); }
      first().focus();
    }
    function closeAction() { close(); }
    function toggle() { if (opened || pending) close(); else return open(); }
    function update(next) {
      if (stopped) return;
      next = next || {}; var label = next.label === undefined ? settings.label : next.label;
      var placement = next.placement === undefined ? settings.placement || 'auto' : next.placement;
      if (typeof label !== 'string' || !label.trim()) throw new TypeError('dkPopover: label required');
      if (!['auto', 'top', 'bottom'].includes(placement)) throw new TypeError('dkPopover: placement');
      var content = next.content === undefined ? settings.content : next.content;
      if (typeof content !== 'string' && !(content instanceof HTMLElement)) throw new TypeError('dkPopover: text or DOM content required');
      if (content instanceof HTMLElement && (content === trigger || content.contains(trigger) || content === panel || panel.contains(content) && content !== settings.content)) throw new TypeError('dkPopover: content cannot own trigger/panel');
      var hadFocus = opened && panel.contains(document.activeElement);
      settings = {label: label, placement: placement, content: content}; title.textContent = label;
      if (body.firstChild !== content) {
        window.dkDestroy(body); body.replaceChildren();
        if (typeof content === 'string') body.textContent = content; else body.append(content);
      }
      if (opened) { position(); if (hadFocus) first().focus(); }
    }
    update(options);
    trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', prefix); trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', toggle); trigger.addEventListener('keydown', key); panel.addEventListener('keydown', key); closeButton.addEventListener('click', closeAction);
    var release = window.dkOwn(trigger, function () {
      if (stopped) return; close(panel.contains(document.activeElement)); stopped = true;
      trigger.removeEventListener('click', toggle); trigger.removeEventListener('keydown', key); panel.removeEventListener('keydown', key); closeButton.removeEventListener('click', closeAction); window.dkDestroy(body); panel.remove();
      Object.keys(original).forEach(function (name) { if (original[name] === null) trigger.removeAttribute(name); else trigger.setAttribute(name, original[name]); });
    });
    var api = {open: open, close: close, toggle: toggle, update: update, destroy: release, element: panel};
    return api;
  };
})();
