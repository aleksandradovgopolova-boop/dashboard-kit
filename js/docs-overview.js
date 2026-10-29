/* Главная: статичная иллюстрация, примеры и подготовка задания без сервера. */
(function () {
  'use strict';
  var root = document.querySelector('.sc-hero--overview');
  if (!root) return;
  function syncImages() {
    var theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    root.querySelectorAll('[data-example-image]').forEach(function (image) {
      image.src = 'assets/examples/' + image.dataset.exampleImage + '-' + theme + '.png';
    });
  }
  new MutationObserver(syncImages).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  syncImages();
  var more = root.querySelector('[data-more-examples]');
  more.addEventListener('click',function () {
    var panel = document.getElementById('overview-more-examples'); panel.hidden = !panel.hidden;
    more.setAttribute('aria-expanded',String(!panel.hidden));
  });
  var form = document.getElementById('dashboard-task-form');
  var result = document.querySelector('[data-task-result]');
  var output = document.getElementById('dashboard-task-prompt');
  var status = document.querySelector('[data-copy-task-status]');
  var names = ['goal','audience','data','context'];
  // Session-only recovery avoids persisting task details on a shared computer.
  var storageKey = 'dk-overview-task-v1';
  try {
    var saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    names.forEach(function (name) { if (saved && typeof saved[name] === 'string') form.elements[name].value = saved[name]; });
  } catch (_) { /* The form also works when browser storage is unavailable. */ }
  function save() {
    var draft = {};
    names.forEach(function (name) { draft[name] = form.elements[name].value; });
    try { sessionStorage.setItem(storageKey,JSON.stringify(draft)); } catch (_) {}
    result.hidden = true; status.textContent = '';
  }
  form.addEventListener('input',save);
  dkForm(form,{
    check:function (field) { return field.required && !field.value.trim() ? 'Опишите ' + (field.name === 'goal' ? 'нужный результат.' : 'доступные данные или укажите, что данных пока нет.') : null; },
    onSubmit:function (data) {
      var lines = ['Собери дашборд с помощью dashboard-kit.','', 'Задача: ' + data.get('goal').trim()];
      if (data.get('audience').trim()) lines.push('Аудитория: ' + data.get('audience').trim());
      lines.push('Данные: ' + data.get('data').trim());
      if (data.get('context').trim()) lines.push('Период и ограничения: ' + data.get('context').trim());
      lines.push('', 'Изучи README.md, DECISIONS.md и DESIGN-UX-ACCESSIBILITY.md. Перед сборкой прочитай skill/dashboard-build/SKILL.md и нужные references. Найди компоненты через tools/kit.py; используй существующие токены, темы и компоненты кита.',
        'Сам предложи структуру, показатели и визуализации под задачу. Уточни недостающий контекст и доступ к источнику. Не выдумывай значения, формулы и доступы. Если данных пока нет, предложи структуру данных и обозначь демонстрационные значения.',
        'Собери работающий дашборд. Проверь расчёты, согласованность фильтров, состояния, клавиатуру и отображение на телефоне и компьютере в обеих темах. Выполни применимые проверки кита. Покажи результат и назови непроверенные сценарии. Публикацию согласуй отдельно.');
      output.textContent = lines.join('\n'); result.hidden = false; status.textContent = '';
      document.querySelector('[data-task-result-title]').focus();
    }
  });
  document.querySelector('[data-download-task]').addEventListener('click',function () {
    var blob = new Blob([output.textContent],{type:'text/plain;charset=utf-8'});
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'dashboard-task.txt'; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); },1000);
    status.textContent = 'Задание скачано. Передайте его помощнику вместе с данными и файлами кита.';
  });
})();
