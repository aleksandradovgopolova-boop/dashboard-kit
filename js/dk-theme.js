/* =============================================================================
   dashboard-kit · ТЕМА И АКЦЕНТ
   -----------------------------------------------------------------------------
   Подключается В <head> И БЕЗ defer — это единственный файл кита, которому так
   можно, и вот почему.

   Было: в разметке зашита тёмная тема, а сохранённый выбор читался скриптом в
   теле страницы — строка 1690 из 2100 в витрине, 443 из 554 на дашборде.
   Человек со светлой темой смотрел на тёмную страницу всю загрузку, а загрузка
   ждала мегабайт движка графиков, и только потом получал вспышку. Вспышка
   чужой темы — это не косметика: она означает, что интерфейс на секунду
   показал не то состояние, в котором находится.

   Отложить этот скрипт нельзя по устройству браузера: атрибут темы обязан
   стоять до первой отрисовки, иначе первая отрисовка будет неправильной.
   Поэтому он маленький, без зависимостей и стоит первым.

   Ключи сведены к одним. Раньше витрина писала в dk-data-theme, а остальные
   три страницы — в dk-theme, и тема между ними не переносилась вовсе: человек
   выбирал светлую в каталоге компонентов, шёл на дашборд и снова видел тёмную.

   Два режима: Dark / Light, оба со стеклом. Акцент фиксирован: синий.
   Старый Glass переходит в Dark; статусные цвета данных не меняются.
   ========================================================================== */

(function () {
  'use strict';

  var KEY_THEME = 'dk-theme';
  var KEY_STYLE = 'dk-style';
  function validStyle(v) { return v === 'dark' || v === 'light'; }
  function tone(v) { return v === 'light' ? 'light' : 'dark'; }
  function applyStyle(v) {
    if (v === 'glass') v = 'dark'; // совместимость со старыми ссылками и хостами
    if (!validStyle(v)) return;
    if (root.getAttribute('data-style') !== v) root.setAttribute('data-style', v);
    if (root.getAttribute('data-theme') !== tone(v)) root.setAttribute('data-theme', tone(v));
  }
  function applyAccent() {
    if (root.getAttribute('data-accent') !== 'blue') root.setAttribute('data-accent', 'blue');
  }
  var root = document.documentElement;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* приватный режим */ }
  }

  /* Хост → сохранённая тема → Dark. data-theme остаётся тоном графиков. */
  /* ТЕМА ОТ ПРИЛОЖЕНИЯ. Страница, открытая внутри мобильного приложения
     (WebView), не выбирает тему сама: её выбрал человек в настройках
     приложения, и дашборд обязан совпасть с экраном вокруг. ?theme=dark или
     ?theme=light в адресе главнее и сохранённого выбора, и системы — иначе
     выбор, однажды сделанный в браузере на этом же телефоне, перекрасил бы
     дашборд внутри приложения. В хранилище такая тема не пишется: она не
     выбор человека на этой странице, а условие, в котором страницу открыли.
     Сменить на лету — dkTheme.theme = 'light' из приложения. */
  var fromHost = null;
  try {
    var params = new URLSearchParams(location.search);
    fromHost = params.get('style') || params.get('theme');
  } catch (e) { /* старый движок */ }
  if (fromHost === 'glass') fromHost = 'dark';
  if (!validStyle(fromHost)) fromHost = null;
  var savedStyle = read(KEY_STYLE);
  var legacyTheme = read(KEY_THEME);
  var initialStyle = validStyle(savedStyle) ? savedStyle :
    (savedStyle === 'glass' ? 'dark' : (validStyle(legacyTheme) ? legacyTheme : 'dark'));
  applyStyle(fromHost || initialStyle);
  applyAccent();
  write('dk-accent-choice', 'blue');
  if (!fromHost) { write(KEY_STYLE, initialStyle); write(KEY_THEME, initialStyle); }

  /* Запоминаем не в обработчике переключателя, а по факту смены атрибута:
     тему меняет и кнопка в шапке, и код страницы, и рука в отладчике. Один
     наблюдатель покрывает все случаи разом. */
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      // Прямое изменение data-theme старым хостом также меняет стиль.
      if (records.some(function (record) { return record.attributeName === 'data-style'; })) {
        applyStyle(validStyle(root.getAttribute('data-style')) ? root.getAttribute('data-style') : 'dark');
      } else if (root.getAttribute('data-theme') !== tone(root.getAttribute('data-style'))) {
        applyStyle(root.getAttribute('data-theme'));
      }
      if (!fromHost) {
        write(KEY_STYLE, root.getAttribute('data-style'));
        write(KEY_THEME, root.getAttribute('data-theme'));
      }
      applyAccent();
      themeColor();
      syncThemeControls();
    }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-style', 'data-accent'] });
  }

  /* ЦВЕТ СТРОКИ СОСТОЯНИЯ И АДРЕСНОЙ СТРОКИ. Safari и Chrome на телефоне
     красят их по <meta name="theme-color">, а без него — своим цветом: над
     тёмным дашбордом висела светлая полоса браузера, и страница выглядела
     вставленной в чужое окно. Одного мета с media="(prefers-color-scheme)"
     мало: тема у кита — выбор человека, а не только системы, и после щелчка
     по переключателю полоса осталась бы от прежней темы.

     Цвет берётся из --bg, а не пишется здесь вторым списком: список в
     скрипте разошёлся бы с токенами при первой же правке фона. Щуп, а не фон
     body: у фона есть плавный переход, и чтение сразу после смены темы
     поймало бы середину (урок из HANDOFF).

     Только на своей странице (.dk-page на body): встроенный кит в чужой
     <head> не пишет — полоса браузера принадлежит хозяину. */
  function themeColor() {
    var body = document.body;
    if (!body || !body.classList.contains('dk-page')) return;
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;background:var(--bg);transition:none';
    body.appendChild(probe);
    var bg = getComputedStyle(probe).backgroundColor;
    body.removeChild(probe);
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return;   // стили ещё не пришли
    /* Фон светлой темы собран через color-mix, и браузер отдаёт его как
       color(srgb 0.90 0.92 0.96). Такую запись в theme-color понимает не
       каждый браузер, а непонятый цвет молча заменяется своим. Поэтому цвет
       проходит через пиксель холста и уходит обычным rgb(). */
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 1;
      var x = c.getContext('2d');
      x.fillStyle = bg;
      x.fillRect(0, 0, 1, 1);
      var d = x.getImageData(0, 0, 1, 1).data;
      bg = 'rgb(' + d[0] + ', ' + d[1] + ', ' + d[2] + ')';
    } catch (e) { /* без холста остаётся как есть */ }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
  }
  function syncThemeControls() {
    document.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.themeSet === root.getAttribute('data-style')));
    });
  }
  document.addEventListener('DOMContentLoaded', function () { themeColor(); syncThemeControls(); });
  window.addEventListener('load', themeColor);

  /* Переключатель. Делегирование на документе, а не подписка на кнопку:
     в <head> кнопки ещё нет, а искать её потом — это ещё один скрипт в теле
     страницы, ровно тот, от которого мы здесь избавляемся.

     Кнопкой считается #t-theme (так размечены страницы кита) или любой элемент
     с data-act="theme" — для чужой разметки, где наших идентификаторов нет. */
  document.addEventListener('click', function (e) {
    var choice = e.target.closest && e.target.closest('[data-theme-set]');
    if (choice) {
      applyStyle(choice.dataset.themeSet);
      syncThemeControls();
      return;
    }
    var b = e.target.closest && e.target.closest('#t-theme, [data-act="theme"]');
    if (!b) return;
    var styles = ['dark', 'light'];
    applyStyle(styles[(styles.indexOf(root.getAttribute('data-style')) + 1) % styles.length]);
  });

  window.dkTheme = {
    get theme() { return root.getAttribute('data-theme'); },
    set theme(v) { applyStyle(v); },
    get style() { return root.getAttribute('data-style'); },
    set style(v) { applyStyle(v); },
    get accent() { return root.getAttribute('data-accent'); },
    set accent(v) { applyAccent(v); }
  };
})();
