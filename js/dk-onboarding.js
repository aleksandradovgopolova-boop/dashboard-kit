/* Anchored, explicitly started onboarding. No dependencies or automatic launch. */
(function () {
  'use strict';
  var active = null;
  var serial = 0;
  window.dkOnboarding = function (options) {
    options = options || {};
    var steps = options.steps || [];
    if (!steps.length) throw new Error('dkOnboarding: steps required');
    var dialog = document.createElement('dialog');
    dialog.className = 'dk-onboarding';
    var stepLabel = document.createElement('p'); stepLabel.className = 'dk-onboarding__step';
    var title = document.createElement('h2'); title.className = 'dk-onboarding__title'; title.id = 'dk-onboarding-title-' + (++serial);
    var text = document.createElement('p'); text.className = 'dk-onboarding__text'; text.id = title.id + '-text';
    dialog.setAttribute('aria-labelledby', title.id); dialog.setAttribute('aria-describedby', text.id);
    var actions = document.createElement('div'); actions.className = 'dk-onboarding__actions';
    function button(label, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'dk-btn dk-btn--sm'; b.textContent = label; b.addEventListener('click', fn); actions.appendChild(b); return b; }
    var skip = button('Пропустить', function () { close('skip'); });
    var back = button('Назад', function () { show(index - 1); });
    var next = button('Далее', function () { if (index + 1 < steps.length) show(index + 1); else close('complete'); });
    next.classList.add('dk-btn--primary');
    dialog.append(stepLabel, title, text, actions);
    var index = 0, target = null, previous = null, running = false, disposed = false, ownHighlight = false, trap = null;
    function resolve(step) { return typeof step.target === 'string' ? document.querySelector(step.target) : step.target; }
    function clearTarget() { if (target && ownHighlight) target.classList.remove('dk-onboarding__target'); target = null; }
    function position() {
      if (!running || !target) return;
      if (!target.isConnected || !target.getClientRects().length) { close('missing-target'); return; }
      var r = target.getBoundingClientRect(), box = dialog.getBoundingClientRect();
      var pad = 16, gap = 12, height = window.innerHeight, width = window.innerWidth;
      var top = r.bottom + gap;
      if (top + box.height > height - pad) top = r.top - box.height - gap;
      top = Math.max(pad, Math.min(top, height - box.height - pad));
      var left = Math.max(pad, Math.min(r.left, width - box.width - pad));
      dialog.style.left = left + 'px'; dialog.style.top = top + 'px';
    }
    function show(n) {
      clearTarget(); index = n;
      target = resolve(steps[index]);
      if (!target || !target.getClientRects().length) { close('missing-target'); return; }
      target.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
      ownHighlight = !target.classList.contains('dk-onboarding__target'); target.classList.add('dk-onboarding__target');
      title.textContent = steps[index].title || 'Знакомство с интерфейсом';
      text.textContent = steps[index].text || '';
      stepLabel.textContent = 'Шаг ' + (index + 1) + ' из ' + steps.length;
      back.disabled = index === 0; next.textContent = index + 1 === steps.length ? 'Готово' : 'Далее';
      position(); next.focus();
    }
    function onViewport() { position(); }
    function close(reason) {
      if (!running) return;
      running = false; clearTarget(); if (trap) { trap.destroy(); trap = null; } dialog.close(); dialog.remove();
      window.removeEventListener('resize', onViewport); window.removeEventListener('scroll', onViewport, true);
      if (window.visualViewport) { window.visualViewport.removeEventListener('resize', onViewport); window.visualViewport.removeEventListener('scroll', onViewport); }
      if (active === api) active = null;
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus();
      if (options.storageKey && (reason === 'complete' || reason === 'skip')) { try { localStorage.setItem(options.storageKey, 'done'); } catch (_) { /* Storage can be unavailable. */ } }
      if (typeof options.onClose === 'function') options.onClose(reason);
    }
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); close('escape'); });
    dialog.addEventListener('click', function (event) { if (event.target !== dialog) return; var r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close('outside'); });
    var api = {
      start: function (force) {
        if (disposed) throw new Error('dkOnboarding: destroyed');
        if (running) return false;
        if (!force && options.storageKey) { try { if (localStorage.getItem(options.storageKey) === 'done') return false; } catch (_) { /* Still allow explicit start. */ } }
        if (!resolve(steps[0])) return false;
        if (active) active.close();
        if (document.querySelector('dialog[open]')) return false;
        previous = document.activeElement; document.body.appendChild(dialog); dialog.showModal(); running = true; active = api;
        window.addEventListener('resize', onViewport); window.addEventListener('scroll', onViewport, true);
        if (window.visualViewport) { window.visualViewport.addEventListener('resize', onViewport); window.visualViewport.addEventListener('scroll', onViewport); }
        show(0);
        if (running) trap = window.dkFocusTrap(dialog, {restoreFocus:false, autoFocus:false, onEscape:function(){close('escape');}});
        return running;
      },
      close: function () { close('close'); },
      destroy: function () { close('destroy'); disposed = true; dialog.remove(); }
    };
    return api;
  };
}());
