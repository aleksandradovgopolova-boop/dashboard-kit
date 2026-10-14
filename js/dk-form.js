/* ============================================================================
   dashboard-kit · dk-form.js
   Проверка формы.

   Правила проверки берутся у браузера: required, minlength, min, max, pattern,
   type="email" — всё это он умеет сам и делает это одинаково во всех полях.
   Своего у нас только две вещи: КОГДА показывать ошибку и КАКИМИ СЛОВАМИ.
   Первое браузер решает неудачно (показывает пузырь и прячет его через
   секунду), второе — тем более: «Please match the requested format» человеку
   не говорит ничего.

   ---------------------------------------------------------------------------
   ПРАВИЛА

   1. ОШИБКА ГОВОРИТ, ЧТО СДЕЛАТЬ, А НЕ ЧТО НЕ ТАК.
      «Введите дату не раньше 1 января» вместо «Неверная дата». Человек уже
      знает, что ошибся, — ему нужно знать, как это исправить.

   2. НЕ ПРОВЕРЯЕМ НА КАЖДОМ НАЖАТИИ.
      Первая проверка — когда человек ушёл из поля или отправил форму. Иначе
      он видит «слишком короткое значение», не дописав второй буквы, и это
      выглядит как придирка. Но поле, уже помеченное ошибкой, проверяем на
      каждом нажатии: тогда ошибка исчезает сразу, как только исправлена.

   3. ФОКУС УХОДИТ НА ПЕРВОЕ НЕВЕРНОЕ ПОЛЕ.
      Форма, которая молча не отправилась, — это форма, которую человек
      перечитывает сверху вниз, ища, что не так.

   4. ОШИБКА НЕ ТОЛЬКО ЦВЕТОМ — значок и текст под полем.
   ============================================================================ */

(function () {
  'use strict';

  var ICON = '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-alert-circle"/></svg>';

  // Слова наши, а не браузерные. Каждое говорит, что сделать.
  function message(el) {
    var v = el.validity;
    var custom = el.dataset.err;
    if (custom && !v.valid) return custom;

    if (v.valueMissing)  return el.tagName === 'SELECT' ? 'Выберите значение' : 'Заполните поле';
    if (v.typeMismatch)  return el.type === 'email' ? 'Введите адрес почты вида name@dom.ru' : 'Проверьте формат значения';
    if (v.tooShort)      return 'Не короче ' + el.minLength + ' знаков — сейчас ' + el.value.trim().length;
    if (v.tooLong)       return 'Не длиннее ' + el.maxLength + ' знаков';
    if (v.rangeUnderflow) return 'Не меньше ' + el.min;
    if (v.rangeOverflow)  return 'Не больше ' + el.max;
    if (v.stepMismatch)   return 'Шаг значения — ' + el.step;
    if (v.patternMismatch) return 'Проверьте формат значения';
    if (v.badInput)       return 'Введите число';
    return 'Проверьте значение';
  }

  function field(el) { return el.closest('.dk-ff'); }

  function clear(el) {
    var ff = field(el);
    if (!ff) return;
    ff.removeAttribute('data-invalid');
    el.removeAttribute('aria-invalid');
    var err = ff.querySelector('.dk-err');
    if (err) {
      var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== err.id; });
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
      err.remove();
    }
  }

  function show(el, text) {
    var ff = field(el);
    if (!ff) return;
    clear(el);
    ff.setAttribute('data-invalid', 'true');
    el.setAttribute('aria-invalid', 'true');

    var id = el.id ? el.id + '-err' : null;
    var err = document.createElement('div');
    err.className = 'dk-err';
    // role="alert" — чтобы скринридер прочитал ошибку сразу, а не когда
    // человек до неё доберётся.
    err.setAttribute('role', 'alert');
    if (id) {
      err.id = id;
      var described = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (described.indexOf(id) < 0) described.push(id);
      el.setAttribute('aria-describedby', described.join(' '));
    }
    // Текст ошибки приходит либо из data-err в разметке, либо из check(),
    // который пишет встраивающий. И то и другое — чужой текст.
    err.innerHTML = ICON + '<span>' + esc(text) + '</span>';
    ff.appendChild(err);
  }

  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Если
     помощник не подключён, компонент обязан упасть громко, а не собрать
     разметку без экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }

  window.dkForm = function (form, opts) {
    opts = opts || {};
    var onSubmit = opts.onSubmit || null;
    var check = opts.check || function () { return null; };   // своя проверка сверх браузерной

    // Пузыри браузера выключаем: они исчезают сами и не читаются с клавиатуры.
    form.setAttribute('novalidate', '');

    var alarm = form.querySelector('.dk-form__alarm');
    var controls = function () {
      return Array.prototype.slice.call(form.querySelectorAll('input, select, textarea'))
        .filter(function (el) { return el.type !== 'hidden' && !el.disabled; });
    };

    function validate(el) {
      var own = check(el);
      var bad = own || (!el.checkValidity() ? message(el) : null);
      bad ? show(el, bad) : clear(el);
      return !bad;
    }

    form.addEventListener('blur', function (e) {
      var el = e.target;
      if (!el.matches || !el.matches('input, select, textarea')) return;
      if (!el.value && !el.required) { clear(el); return; }   // пустое необязательное — не ошибка
      validate(el);
    }, true);

    // Правило 2: уже помеченное поле проверяем на каждом нажатии, чтобы ошибка
    // исчезла сразу, как только исправлена.
    form.addEventListener('input', function (e) {
      var el = e.target;
      if (el.matches && el.matches('[aria-invalid]')) validate(el);
    });

    form.addEventListener('submit', function (e) {
      var bad = controls().filter(function (el) { return !validate(el); });

      if (alarm) {
        alarm.hidden = !bad.length;
        if (bad.length) {
          alarm.textContent = bad.length === 1
            ? 'Одно поле заполнено неверно — оно отмечено ниже.'
            : 'Полей заполнено неверно: ' + bad.length + '. Они отмечены ниже.';
        }
      }

      if (bad.length) {
        e.preventDefault();
        bad[0].focus();                 // правило 3
        return;
      }

      if (onSubmit) { e.preventDefault(); onSubmit(new FormData(form), form); }
    });

    return {
      validate: function () { var valid = true; controls().forEach(function (el) { if (!validate(el)) valid = false; }); return valid; },
      clear: function () { controls().forEach(clear); if (alarm) alarm.hidden = true; }
    };
  };
})();
