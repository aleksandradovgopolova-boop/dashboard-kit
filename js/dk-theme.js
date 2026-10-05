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

   АКЦЕНТ — НАСТРОЙКА ПРОДУКТА, А НЕ ЧЕЛОВЕКА. Он ставится один раз в
   разметке: <html data-accent="blue">. Раньше выбор акцента запоминался в
   хранилище, как тема, — и сохранённый в витрине фиолетовый перекрывал синий
   любого дашборда на этой машине. Тема — дело человека (свет в комнате),
   акцент — дело продукта (узнаваемость), и хранить их одинаково было ошибкой.
   Решение: DECISIONS.md, пункт 5.
   ========================================================================== */

(function () {
  'use strict';

  var KEY_THEME = 'dk-theme';
  var KEY_ACCENT = 'dk-accent';   // только чтобы стереть: см. шапку, «акцент — настройка продукта»
  var root = document.documentElement;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* приватный режим */ }
  }

  /* Что выбрано человеком → что просит система → тёмная. Именно в таком
     порядке: системную настройку уважаем, но выбор в интерфейсе главнее. */
  /* ТЕМА ОТ ПРИЛОЖЕНИЯ. Страница, открытая внутри мобильного приложения
     (WebView), не выбирает тему сама: её выбрал человек в настройках
     приложения, и дашборд обязан совпасть с экраном вокруг. ?theme=dark или
     ?theme=light в адресе главнее и сохранённого выбора, и системы — иначе
     выбор, однажды сделанный в браузере на этом же телефоне, перекрасил бы
     дашборд внутри приложения. В хранилище такая тема не пишется: она не
     выбор человека на этой странице, а условие, в котором страницу открыли.
     Сменить на лету — dkTheme.theme = 'light' из приложения. */
  var fromHost = null;
  try { fromHost = new URLSearchParams(location.search).get('theme'); } catch (e) { /* старый движок */ }
  if (fromHost !== 'dark' && fromHost !== 'light') fromHost = null;

  var theme = fromHost || read(KEY_THEME);
  if (!theme && window.matchMedia) {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');

  // Старый сохранённый акцент больше не читается — и не должен лежать:
  // иначе однажды его прочитает чей-то отладочный код и удивится.
  try { localStorage.removeItem(KEY_ACCENT); } catch (e) { /* приватный режим */ }

  /* Запоминаем не в обработчике переключателя, а по факту смены атрибута:
     тему меняет и кнопка в шапке, и код страницы, и рука в отладчике. Один
     наблюдатель покрывает все случаи разом. */
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (!fromHost) write(KEY_THEME, root.getAttribute('data-theme') || 'dark');
      themeColor();
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
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
  document.addEventListener('DOMContentLoaded', themeColor);
  window.addEventListener('load', themeColor);

  /* Переключатель. Делегирование на документе, а не подписка на кнопку:
     в <head> кнопки ещё нет, а искать её потом — это ещё один скрипт в теле
     страницы, ровно тот, от которого мы здесь избавляемся.

     Кнопкой считается #t-theme (так размечены страницы кита) или любой элемент
     с data-act="theme" — для чужой разметки, где наших идентификаторов нет. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#t-theme, [data-act="theme"]');
    if (!b) return;
    root.setAttribute('data-theme',
      root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  });

  window.dkTheme = {
    get theme() { return root.getAttribute('data-theme'); },
    set theme(v) { root.setAttribute('data-theme', v === 'light' ? 'light' : 'dark'); },
    get accent() { return root.getAttribute('data-accent'); },
    set accent(v) { root.setAttribute('data-accent', v); }
  };
})();
