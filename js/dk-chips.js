/* dashboard-kit · Lists of entered or selected values.
   Dependencies: dk-util.js. Values are strings; duplicates are ignored.
   value(array) changes state silently; user changes call onChange(copy).
   ChipsSelect uses the native select keyboard and screen-reader semantics. */
(function () {
  'use strict';
  var serial = 0;

  function create(el, opts, selecting) {
    if (!el) return null;
    opts = opts || {};
    var esc = window.dkEsc;
    var stopped = false;
    var disabled = !!opts.disabled;
    var values = [];
    var options = [];
    if (selecting) (opts.options || []).forEach(function (item) {
      var obj = typeof item === 'string' ? { value: item, label: item } : item;
      if (!obj || obj.value == null) return;
      var value = String(obj.value);
      if (!value || options.some(function (x) { return x.value === value; })) return;
      options.push({ value: value, label: String(obj.label == null ? value : obj.label), disabled: !!obj.disabled });
    });
    function normalize(next) {
      var out = [];
      (Array.isArray(next) ? next : []).forEach(function (v) {
        if (v == null) return;
        v = selecting ? String(v) : String(v).trim();
        if (!v || out.indexOf(v) !== -1) return;
        if (selecting && !options.some(function (o) { return o.value === v; })) return;
        out.push(v);
      });
      return out;
    }
    var release = window.dkOwn(el, function () {
      stopped = true;
      el.removeEventListener('click', click);
      el.removeEventListener('keydown', keydown);
      el.removeEventListener('change', change);
      el.replaceChildren();
    });
    var id = 'dk-chips-' + (++serial);
    el.innerHTML = '<div class="dk-chips"><label class="dk-label" for="' + id + '">' +
      esc(opts.label || (selecting ? 'Выберите значения' : 'Введите значения')) + '</label>' +
      '<div class="dk-chipbar" role="group" aria-label="Выбранные значения"></div>' +
      '<div class="dk-field">' + (selecting ? '<select' : '<input type="text"') +
      ' id="' + id + '" aria-describedby="' + id + '-hint">' + (selecting ? '</select>' : '') + '</div>' +
      '<p class="dk-caption" id="' + id + '-hint">' +
      (selecting ? 'Выберите пункт, чтобы добавить его. Кнопка рядом со значением удаляет его.' :
        'Enter добавляет значение. Backspace в пустом поле переводит фокус на удаление последнего значения.') +
      '</p><span class="dk-vh" role="status" aria-live="polite" aria-atomic="true"></span></div>';
    var input = el.querySelector(selecting ? 'select' : 'input');
    var list = el.querySelector('.dk-chipbar');
    var status = el.querySelector('[role="status"]');
    if (!selecting) input.placeholder = opts.placeholder || 'Введите значение';
    function label(v) {
      var o = options.find(function (x) { return x.value === v; });
      return o ? o.label : v;
    }
    function render() {
      list.innerHTML = values.map(function (v, i) {
        return '<span class="dk-chips__item"><span class="dk-chips__text">' + esc(label(v)) +
          '</span><button type="button" class="dk-iconbtn" data-chip-remove="' + i +
          '" aria-label="' + esc('Удалить «' + label(v) + '»') + '"' + (disabled ? ' disabled' : '') +
          '><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></span>';
      }).join('');
      input.disabled = disabled;
      if (selecting) {
        input.innerHTML = '<option value="">' + esc(opts.placeholder || 'Добавить значение') + '</option>' +
          options.map(function (o) {
            return '<option value="' + esc(o.value) + '"' +
              (o.disabled || values.indexOf(o.value) !== -1 ? ' disabled' : '') + '>' + esc(o.label) + '</option>';
          }).join('');
        input.value = '';
      }
    }
    function notify(text) {
      status.textContent = text;
      if (typeof opts.onChange === 'function') opts.onChange(values.slice());
    }
    function add(v) {
      if (stopped || disabled) return;
      v = selecting ? String(v) : String(v).trim();
      if (!v) return;
      if (values.indexOf(v) !== -1) { status.textContent = 'Значение уже добавлено'; return; }
      if (selecting && !options.some(function (o) { return o.value === v && !o.disabled; })) return;
      values.push(v);
      input.value = '';
      render();
      input.focus();
      notify('Добавлено: ' + label(v));
    }
    function click(e) {
      var button = e.target.closest && e.target.closest('[data-chip-remove]');
      if (!button || !list.contains(button) || stopped || disabled) return;
      var index = Number(button.getAttribute('data-chip-remove'));
      if (index < 0 || index >= values.length) return;
      var removed = values.splice(index, 1)[0];
      render();
      var remaining = list.querySelectorAll('button');
      if (remaining.length) remaining[Math.min(index, remaining.length - 1)].focus();
      else input.focus();
      notify('Удалено: ' + label(removed));
    }
    function keydown(e) {
      if (e.target !== input || stopped || disabled || e.isComposing) return;
      if (!selecting && e.key === 'Enter') { e.preventDefault(); add(input.value); }
      if (!selecting && e.key === 'Backspace' && !input.value && values.length) {
        e.preventDefault();
        var buttons = list.querySelectorAll('button');
        buttons[buttons.length - 1].focus();
      }
    }
    function change(e) { if (selecting && e.target === input) add(input.value); }
    el.addEventListener('click', click);
    el.addEventListener('keydown', keydown);
    el.addEventListener('change', change);
    values = normalize(opts.value);
    render();
    return {
      value: function (next) {
        if (!arguments.length) return values.slice();
        if (!stopped) { values = normalize(next); render(); }
        return values.slice();
      },
      disabled: function (next) {
        if (!arguments.length) return disabled;
        if (!stopped) { disabled = !!next; render(); }
        return disabled;
      },
      destroy: release
    };
  }
  window.dkChipsInput = function (el, opts) { return create(el, opts, false); };
  window.dkChipsSelect = function (el, opts) { return create(el, opts, true); };
})();
