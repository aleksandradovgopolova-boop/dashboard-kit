(function () {
  'use strict';
  var data = window.DK_PRODUCT_CONSOLE, filter = 'all', rows = [], wasLive = false;
  var byId = function (id) { return document.getElementById(id); };
  var esc = window.dkEsc;
  function date(value) {
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? 'дата неизвестна' : new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Moscow'
    }).format(parsed);
  }
  function link(url, label, cls) {
    var allowed = /^(?:https:\/\/github\.com\/aleksandradovgopolova-boop\/|https:\/\/aleksandradovgopolova-boop\.github\.io\/dashboard-kit\/)/.test(url || '');
    var local = /^(?:docs\/|planning\/|component-|\.ai-ops\/|\.ai\/project\/product-console\/)/.test(url || '') && !/[\\<>]|\.\./.test(url);
    if (!allowed && !local) return '<span>' + esc(label) + '</span>';
    return '<a' + (cls ? ' class="' + esc(cls) + '"' : '') + ' href="' + esc(url) + '">' + esc(label) + '</a>';
  }
  function state(label, tone) {
    var accent = tone ? window.dkMeaning(tone === 'attention' ? 'high' : 'calm', 'text') : null;
    return '<span class="dk-badge pc-state"' + (accent ? ' style="--accent:' + esc(accent) + '"' : '') + '>' + esc(label) + '</span>';
  }
  function fact(name, value) { return '<div class="pc-fact"><p class="pc-key">' + esc(name) + '</p><p>' + value + '</p></div>'; }
  function newerVersion(available, installed) {
    var a = /^(\d+)\.(\d+)\.(\d+)$/.exec(available || ''), b = /^(\d+)\.(\d+)\.(\d+)$/.exec(installed || '');
    if (!a || !b) return false;
    for (var i = 1; i <= 3; i++) { if (+a[i] !== +b[i]) return +a[i] > +b[i]; }
    return false;
  }
  function card(name, value, detail) {
    return '<section class="dk-widget dk-col--third"><h2>' + esc(name) + '</h2><p class="pc-value">' + esc(value) + '</p><p class="pc-detail">' + detail + '</p></section>';
  }
  function work() {
    var visible = rows.filter(function (row) { return filter === 'all' || row.group === filter || filter === 'github' && row.origin === 'github'; });
    byId('work-count').textContent = visible.length + ' из ' + rows.length;
    byId('work-empty').hidden = visible.length !== 0;
    byId('console-work').innerHTML = visible.map(function (row) {
      return '<div class="pc-work-row"><div>' + link(row.url, row.title) + (row.detail ? '<small>' + esc(row.detail) + '</small>' : '') + '</div>' + state(row.status) + '</div>';
    }).join('');
  }
  function render(next) {
    data = next;
    var remote = data.github || {}, local = data.local || {}, ai = data.aiops || {}, available = ai.available || {};
    var published = remote.pages && remote.main && remote.pages.conclusion === 'success' && remote.pages.sha === remote.main.sha;
    var approved = available.approval === 'granted-2026-11-26';
    var newer = newerVersion(available.version, ai.installed);
    var waiting = newer && available.channel && ai.policyChannel !== available.channel && !approved;
    byId('snapshot-time').textContent = (data.mode === 'local' ? 'Локальный статус · ' : 'Снимок · ') + date(data.generatedAt) + ' МСК';
    byId('console-summary').innerHTML = card('Опубликованный кит', published ? 'GitHub Pages' : 'Не подтверждено',
      published ? link('https://aleksandradovgopolova-boop.github.io/dashboard-kit/', 'Открыть сайт') + ' · ' + esc(remote.main.sha.slice(0, 7)) + '<br>GitHub от ' + esc(date(remote.fetchedAt)) : 'Нет подтверждённой публикации в источниках') +
      card('Локальная работа', local.changedFiles == null ? 'Неизвестно' : local.changedFiles || local.unpublishedFiles ? 'Есть изменения' : 'Чистая рабочая копия',
        local.changedFiles == null ? 'Git недоступен' : esc(local.changedFiles + ' файлов не в коммите · ' + (local.unpublishedFiles || 0) + ' вне main') + '<br>' + esc(local.branch || 'без ветки')) +
      card('AI Ops Kit', ai.installed || 'Неизвестно', esc('Политика: ' + (ai.policyChannel || 'неизвестно')) + (newer ? ' · ' + esc(available.channel + ' ' + available.version) : ''));
    byId('console-next').innerHTML = '<div class="pc-next-copy"><p class="pc-value">' + esc(waiting ? 'Выбрать канал обновления AI Ops' : newer && approved ? 'Проверить установку AI Ops ' + available.version : local.controlsChanged ? 'Довести кнопки и вкладки до PR' : 'Проверить ближайшую работу в плане') + '</p><p class="pc-detail">' +
      esc(waiting ? available.version + ' — qualification. В проекте закреплён ' + ai.policyChannel + '; установка ждёт отдельного решения.' : newer && approved ? 'Переход на qualification разрешён. Обновление готовится через PR; текущая установка указана выше.' : local.controlsChanged ? 'Локальная доработка сохранена отдельно от опубликованного кита.' : 'План и открытые задачи — ниже.') + '</p></div>' +
      link(newer ? available.url : local.controlsChanged ? 'component-button.html' : 'planning/plan.yaml', newer ? 'Посмотреть релиз ' + available.version : local.controlsChanged ? 'Посмотреть кнопки' : 'Открыть план', 'dk-btn dk-btn--primary');
    if (!newer && data.delivery && data.delivery.state === 'open') {
      byId('console-next').innerHTML = '<div class="pc-next-copy"><p class="pc-value">Проверить PR #' + esc(data.delivery.number) + '</p><p class="pc-detail">Обновление AI Ops, пульт и контролы собраны в отдельной ветке. Main и Pages пока на предыдущей версии.</p></div>' + link(data.delivery.url, 'Открыть PR', 'dk-btn dk-btn--primary');
    }
    rows = (data.plan && data.plan.work || []).filter(function (x) { return !['done', 'cancelled'].includes(x.status); }).map(function (x) {
      var names = {todo: 'Запланировано', in_progress: 'В работе', blocked: 'Заблокировано', deferred: 'Отложено'};
      return {title: x.title, url: 'planning/plan.yaml', group: 'plan', status: x.human_decision ? 'Нужно решение' : names[x.status] || 'Не определено', detail: x.human_decision || 'Канонический план'};
    });
    if (!data.plan) rows.push({title: 'Канонический план недоступен', url: 'planning/plan.yaml', group: 'plan', status: 'Нет данных'});
    byId('github-status').textContent = !remote.issues ? 'Задачи GitHub недоступны; показан только локальный план.' : 'GitHub · снимок от ' + date(remote.fetchedAt);
    (remote.issues || []).forEach(function (x) {
      rows.push({title: '#' + x.number + ' · ' + x.title, url: x.url, group: x.deferred ? 'deferred' : 'open',
        origin: 'github', status: x.kind === 'epic' ? 'Эпик открыт' : x.deferred ? 'Отложено' : 'Открыто', detail: x.kind === 'epic' ? 'Сводная задача' : ''});
    });
    work();
    var ci = remote.ci;
    var checks = ci ? fact('CI опубликованного коммита', state(ci.conclusion === 'success' ? 'Прошёл' : ci.conclusion || ci.status, ci.conclusion === 'success' ? 'ok' : '') + '<br>' + link(ci.url, date(ci.updatedAt))) : fact('CI опубликованного коммита', 'Нет подтверждения');
    var titles = {quick: 'Локальная статика', browser: 'Локальная проверка Chrome', full: 'Полный локальный прогон', runtime: 'Целостность runtime', aiops: 'Установка AI Ops'};
    (data.checks || []).forEach(function (x) {
      var label = x.current ? x.status === 'pass' ? 'Прошёл' : 'Не прошёл' : x.status === 'pass' ? 'Прошёл ранее' : 'Не прошёл ранее';
      checks += fact(titles[x.suite] || x.suite, state(label, x.current ? x.status === 'pass' ? 'ok' : 'attention' : '') + '<br>' + link(x.log, date(x.completedAt)));
    });
    if (!(data.checks || []).length) checks += fact('Текущая рабочая копия', 'Новый прогон не записан');
    byId('console-checks').innerHTML = checks;
    byId('console-metrics').innerHTML = (data.metrics || []).map(function (m) { return fact(m.name, '<span data-metric="' + esc(m.id) + '">Не измерено</span>'); }).join('') +
      '<details><summary>Определения и методика</summary><p>Количество — целостные дашборды, без повторного учёта версий и блоков. Типовая сборка, период, baseline и метод сбора пока не определены.</p><p>' + link(data.metricSource, 'Паспорт продукта · определения от 6 октября 2026') + '</p></details>';
    byId('console-sources').innerHTML = '<div class="pc-source-grid"><details><summary>Источники и актуальность</summary><ul>' +
      '<li>Локальные файлы · ' + esc(date(data.generatedAt)) + '</li>' +
      '<li>GitHub · ' + esc(date(remote.fetchedAt)) + (remote.sources && remote.sources.issues && remote.sources.issues.complete ? ' · весь список открытых задач' : ' · полнота не подтверждена') + '</li>' +
      '<li>' + link('planning/plan.yaml', 'Единственный план работ') + '</li>' +
      '<li>' + link('docs/2026-11-06/buttons-tabs/README.md', 'Локальная доработка кнопок и вкладок · 6 ноября') + '</li>' +
      '<li>' + link(available.channelSource, 'Канал поставки AI Ops: ' + (available.channel || 'неизвестно')) + '</li></ul><p>Публикация документации не доказывает использование кита в реальном продукте. Текущее применение не измерено.</p></details>' +
      '<details><summary>Что изменилось</summary><ul><li>PR79 опубликован 6 ноября: компактные контролы и клавиатурный фокус.</li>' +
      '<li>Кнопки и вкладки переделаны локально. У S боковые поля увеличены до 16 px; эта доработка не опубликована.</li>' +
      '<li>Обновление AI Ops ' + esc(ai.installed || '—') + ' → ' + esc(available.version || '—') + (waiting ? ' ожидает решения о канале.' : ' сверяется по установленной версии.') + '</li></ul></details></div>';
    var refresh = byId('console-refresh');
    refresh.disabled = data.mode !== 'local' && !wasLive;
    refresh.title = data.mode === 'local' ? 'Перечитать локальные источники; дата GitHub указана отдельно' : 'Сохранённый снимок; обновление доступно в локальном пульте';
  }
  document.querySelectorAll('[data-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
      work();
    });
  });
  async function refresh(quiet) {
    var button = byId('console-refresh');
    button.disabled = true;
    try {
      var response = await fetch('api/product-console', {cache: 'no-store'});
      if (!response.ok) throw Error('unavailable');
      var result = await response.json();
      if (result.schemaVersion !== 1 || !result.generatedAt) throw Error('invalid');
      wasLive = true;
      render(result);
      if (!quiet) byId('console-feedback').textContent = 'Локальный статус перечитан. GitHub — отдельный снимок от ' + date((result.github || {}).fetchedAt) + '.';
    } catch (error) {
      if (!quiet) byId('console-feedback').textContent = 'Локальный сервер недоступен. Сохранённый снимок остаётся на экране.';
      if (data) render(Object.assign({}, data, {mode: 'snapshot'}));
    }
  }
  byId('console-refresh').addEventListener('click', function () { refresh(false); });
  if (data) render(data);
  else byId('console-feedback').textContent = 'Снимок отсутствует. Локальный сервер попробует прочитать источники.';
  refresh(true);
}());
