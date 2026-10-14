/* ============================================================================
   dashboard-kit · dk-map.js
   Регионы: карта и плитки на одних данных.

   ---------------------------------------------------------------------------
   ПОЧЕМУ ДВА ВИДА, А НЕ ОДИН

   На карте площадь региона перебивает его значение. Якутия занимает пятую
   часть страны, Москва — точку; если раскрасить обе одним цветом, взгляд
   увидит «плохо на огромной территории» и «почти ничего» — хотя в Москве людей
   больше, чем во всей Якутии в двадцать раз. Карта отвечает на вопрос «где»,
   и отвечает хорошо. На вопрос «у кого хуже» она отвечает неправильно.

   Плитки дают каждому региону равный вес: одна клетка — один субъект,
   раскладка повторяет географию настолько, чтобы Дальний Восток оставался
   справа, а Северо-Запад слева. Это не упрощённая карта, а другой инструмент.

   Поэтому переключатель не украшение и не «настройка»: он часть виджета, и
   убирать его нельзя. Заодно он решает вторую задачу — карта нарисована на
   canvas и с клавиатуры недоступна, а плитки это обычные кнопки. Человек без
   мыши получает те же данные, а не их пересказ.

   ---------------------------------------------------------------------------
   ПРАВИЛА

   1. ЦВЕТ — ЛЕСТНИЦА ОДНОГО ТОНА, А НЕ РАДУГА. Светлое — мало, тёмное — много
      (--seq-1…5). Радуга заставляет вспоминать легенду на каждом регионе.

   2. ПОРОГИ НАЗВАНЫ ЧИСЛАМИ. «Мало / средне / много» — это не легенда, а
      обещание, что читатель сам угадает, сколько это.

   3. «НЕТ ДАННЫХ» — ОТДЕЛЬНАЯ КАТЕГОРИЯ, А НЕ НОЛЬ. Регион без данных красится
      серым (--nodata) и назван в легенде: ноль это ответ, отсутствие — нет.
   ============================================================================ */

(function () {
  'use strict';

  var STEPS = 5;

  /* ТЕМА И ТОКЕНЫ — ОТ БЛИЖАЙШЕГО .dk-root, А НЕ ОТ <html>. У своей
     страницы кита это одно и то же. У встроенного кита — нет: хозяин
     страницы свой, тема и токены живут на обёртке <div class="dk-root"
     data-theme>, а на <html> хозяина их нет вовсе. Карта, как и график, читала тему с
     <html> и рисовалась в чужой теме, а цвета из токенов приходили пустыми —
     исполнитель проверочной задачи скилла (29.09) из-за этого не поставил
     спарклайны в чужую витрину. cur — корень графика, который рисуется
     сейчас: помощники ниже зовутся только внутри отрисовки. */
  var cur = document.documentElement;
  function rootOf(el) { return (el && el.closest && el.closest('.dk-root')) || document.documentElement; }

  function css(name) {
    return getComputedStyle(cur).getPropertyValue(name).trim();
  }

  function themeName() {
    return cur.getAttribute('data-theme') === 'light' ? 'dk-light' : 'dk-dark';
  }

  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Здесь
     только обращение к нему: пять копий одной функции нельзя починить один раз,
     и именно так четыре файла остались вообще без экранирования. Если помощник
     не подключён, компонент обязан упасть громко, а не собрать разметку без
     экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }
  function num(v) {
    if (!window.dkNum) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkNum(v);
  }
  function own(el, destroy) {
    if (!window.dkOwn) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkOwn(el, destroy);
  }

  function nfmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /* --- TopoJSON → GeoJSON --------------------------------------------------
     Свой разбор, а не библиотека: нужна ровно одна функция, а topojson-client
     тянет в офлайн-репозиторий ещё один чужой файл, который потом никто не
     обновляет. Формат простой: дуги записаны приращениями и квантованы, знак
     минус у номера дуги означает «эту же дугу задом наперёд».                 */
  function fromTopo(topo, objectName) {
    var t = topo.transform;
    var cache = [];

    function arc(i) {
      if (cache[i]) return cache[i];
      var a = topo.arcs[i], x = 0, y = 0, out = [];
      for (var k = 0; k < a.length; k++) {
        if (t) {
          x += a[k][0]; y += a[k][1];
          out.push([x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]]);
        } else {
          out.push([a[k][0], a[k][1]]);
        }
      }
      return (cache[i] = out);
    }

    function ring(ids) {
      var pts = [];
      for (var n = 0; n < ids.length; n++) {
        var i = ids[n];
        var a = i < 0 ? arc(~i).slice().reverse() : arc(i);
        pts = pts.concat(n ? a.slice(1) : a);
      }
      return pts;
    }

    var obj = topo.objects[objectName || Object.keys(topo.objects)[0]];
    return {
      type: 'FeatureCollection',
      features: obj.geometries.map(function (g) {
        var coords = g.type === 'Polygon'
          ? g.arcs.map(ring)
          : g.arcs.map(function (p) { return p.map(ring); });
        return { type: 'Feature', id: g.id, properties: g.properties,
                 geometry: { type: g.type, coordinates: coords } };
      })
    };
  }

  /* --- проекция ------------------------------------------------------------
     Равновеликая коническая (Альберс). Взята не ради красоты: на карте, где
     цветом кодируют величину, площадь читается как вес, и проекция, которая
     раздувает север, врёт о весе Ямала и Чукотки. Стандартные параллели 52 и
     64 — обычные для России.                                                 */
  var D = Math.PI / 180;
  var P1 = 52 * D, P2 = 64 * D, PHI0 = 56 * D, LAM0 = 100 * D;
  var N = (Math.sin(P1) + Math.sin(P2)) / 2;
  var C = Math.cos(P1) * Math.cos(P1) + 2 * N * Math.sin(P1);
  var RHO0 = Math.sqrt(C - 2 * N * Math.sin(PHI0)) / N;

  function project(p) {
    var rho = Math.sqrt(C - 2 * N * Math.sin(p[1] * D)) / N;
    var theta = N * (p[0] * D - LAM0);
    return [rho * Math.sin(theta) * 100, (RHO0 - rho * Math.cos(theta)) * 100];
  }

  function unproject(p) {
    var x = p[0] / 100, y = RHO0 - p[1] / 100;
    var rho = Math.sqrt(x * x + y * y);
    var theta = Math.atan2(x, y);
    return [(theta / N + LAM0) / D, Math.asin((C - rho * rho * N * N) / (2 * N)) / D];
  }

  window.dkMap = function (host, opts) {
    window.dkDestroy(host);
    var stopped = false;
    opts = opts || {};

    var name = opts.name || 'dk-regions';
    var tiles = opts.tiles;
    var values = opts.values || {};
    var unit = opts.unit || '';
    var onSelect = opts.onSelect || function () {};
    // По умолчанию — плиточная карта (картограмма: каждый регион равной
    // величины, мелкие не теряются, видно «где хуже» по всей стране разом).
    // Географическая — по явному view:'map' или переключателю. Решение по
    // продакшн-референсу monitor.testdash.site (DECISIONS 10.10).
    var view = opts.view === 'map' ? 'map' : 'tiles';
    var ZOOMS = [1, 1.5, 2, 3];
    /* СРЕЗ. scope — регионы, которые попали в фильтр (например, один
       округ); остальные приглушаются, а не красятся «нет данных»: серый на
       карте значит «данных нет», и регион другого округа с данными им не
       является (проверочная задача скилла, 29.09 — исполнитель оставил карту
       по всей стране, потому что другого честного способа не было). Шкала
       остаётся общей по стране: цвет региона значит одно и то же с фильтром и
       без. Нет scope — в срезе все. */
    var scope = opts.scope ? new Set(opts.scope) : null;
    function inScope(id) { return !scope || scope.has(id); }
    var zoom = 1;
    var geo = opts.geo || (opts.topo ? fromTopo(opts.topo, opts.object) : null);

    var names = {};
    if (geo) geo.features.forEach(function (f) { names[f.id] = f.properties.name; });
    if (tiles) tiles.tiles.forEach(function (t) { if (!names[t.id]) names[t.id] = t.name; });

    var inst = null;
    var canvasEl = null;        // холст карты; может ждать размера, см. drawMap
    var cursor = null;          // плитка, на которой стоит фокус

    /* Пороги. По умолчанию равные ступени от минимума до максимума — их видно
       в легенде числами, и читатель не гадает, что значит «средне».

       СЧИТАЮТСЯ ЗАНОВО ПРИ КАЖДОЙ СМЕНЕ ДАННЫХ. Раньше они брались один раз
       при создании, и setValues() перерисовывал карту старой шкалой: человек
       менял период, легенда показывала диапазон прошлых данных, а регионы
       красились по чужим порогам. Карта продолжала выглядеть осмысленной —
       это и есть худший вид ошибки в данных. Ровно против неё написано
       правило 2 в шапке этого файла, и нарушал его сам файл. */
    var min, max, cuts;

    function rescale() {
      var nums = Object.keys(values).map(function (k) { return values[k]; })
                       .filter(function (v) { return typeof v === 'number'; });
      min = opts.min != null ? opts.min : (nums.length ? Math.min.apply(null, nums) : 0);
      max = opts.max != null ? opts.max : (nums.length ? Math.max.apply(null, nums) : 1);
      cuts = opts.steps || (function () {
        var out = [];
        for (var i = 1; i < STEPS; i++) out.push(Math.round(min + (max - min) * i / STEPS));
        return out;
      })();
    }

    rescale();

    function bucket(v) {
      if (typeof v !== 'number') return -1;
      for (var i = 0; i < cuts.length; i++) if (v < cuts[i]) return i;
      return cuts.length;
    }

    function bucketColor(b) {
      return opts.palette === 'risk' && cuts.length === 2
        ? css('--risk-area-' + ['low', 'medium', 'high'][b])
        : css('--seq-' + (b + 1));
    }

    function color(v) {
      var b = bucket(v);
      return b < 0 ? window.dkMeaning.color('nodata', 'fill', host) : bucketColor(b);
    }

    /* ЛЕГЕНДА ВНИЗУ, ПЕРЕКЛЮЧАТЕЛЬ ВВЕРХУ. Раньше они стояли вместе в шапке,
       и это было ошибкой порядка чтения: легенда — это ключ к тому, что уже
       нарисовано, а не настройка того, что будет нарисовано. Наверху её
       читают до карты, то есть до того, как она может что-то объяснить, и
       перечитывают заново, когда доходят до самой карты.

       Внизу она оказывается там же, где заканчивается взгляд, прошедший по
       карте, — и отвечает ровно в тот момент, когда возник вопрос «а что
       значит этот оттенок». Так же стоит легенда у круговой диаграммы в этом
       ките: снизу, под тем, что объясняет.

       Переключатель вида остаётся сверху: он не объясняет, а управляет, и
       место управления — до содержимого. */
    host.className = 'dk-map';
    host.innerHTML =
      '<div class="dk-map__head">' +
        // Сегмент — это группа переключателей, а не вкладки: он меняет ВИД
        // одних и тех же данных, не адрес и не страницу. Скринридер, услышав
        // «вкладка», ждёт новой загрузки, а получает перерисовку виджета.
        '<div class="dk-seg dk-seg--sm dk-seg--icons" role="group" aria-label="Вид данных">' +
          '<button type="button" data-view="tiles" aria-pressed="true" title="Плитки" aria-label="Плитки">' +
            '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-layout-grid"/></svg></button>' +
          '<button type="button" data-view="map" aria-pressed="false" title="Карта" aria-label="Карта">' +
            '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-map"/></svg></button>' +
          // Список — доступная альтернатива плиткам: строки-кнопки от 44px, по
          // которым можно попасть пальцем и пройти табом (плитки картограммы
          // мельче 44px; DECISIONS 10.10).
          '<button type="button" data-view="list" aria-pressed="false" title="Список" aria-label="Список">' +
            '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-menu-2"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="dk-map__body"></div>' +
      '<div class="dk-map__legend"></div>';

    var legendEl = host.querySelector('.dk-map__legend');
    var bodyEl = host.querySelector('.dk-map__body');

    /* Переключатель вида можно перенести в шапку виджета — туда, где у всех
       остальных виджетов живут действия. Своя шапка у карты появилась раньше,
       чем у виджета появилось постоянное место под кнопки, и осталась по
       инерции: получалось два ряда управления друг под другом.

       Раньше перенос делала только страница, передав controls. Никто о нём
       не помнил: на пробной странице из описи кита переключатель висел
       отдельной строкой под заголовком «Регионы», прижатый вправо, и читался
       потерянным (разбор 29.09). Теперь карта сама встаёт в шапку своего
       виджета, если она есть: правая часть шапки — место действий у всех
       виджетов кита. controls — куда ставить явно; controls: false — оставить
       свою шапку. */
    var segEl = host.querySelector('.dk-seg');
    var headEl = host.querySelector('.dk-map__head');
    var куда = null;
    if (opts.controls) {
      куда = typeof opts.controls === 'string' ? document.querySelector(opts.controls) : opts.controls;
    } else if (opts.controls !== false) {
      var widget = host.closest('.dk-widget');
      var whead = widget && widget.querySelector(':scope > .dk-widget__head');
      if (whead && !whead.contains(host)) {
        куда = whead.querySelector('.dk-widget__actions');
        // Нет места под действия — встаём в шапку справа, как действия у всех.
        if (!куда) { куда = whead; segEl.classList.add('dk-push'); }
      }
    }
    if (куда) { куда.appendChild(segEl); headEl.remove(); }

    function renderLegend() {
      var parts = [];
      for (var i = 0; i <= cuts.length; i++) {
        var from = i === 0 ? min : cuts[i - 1];
        var to = i === cuts.length ? max : cuts[i];
        parts.push('<span class="dk-map__key"><i style="background:' + bucketColor(i) + '"></i>' +
          nfmt(Math.round(from)) + '–' + nfmt(Math.round(to)) + '</span>');
      }
      // Правило 3: отсутствие данных названо, а не спрятано среди нулей.
      parts.push('<span class="dk-map__key"><i class="dk-nodata"></i>нет данных</span>');
      // Приглушение названо в легенде, как и «нет данных»: иначе бледный
      // регион читается как «низкое значение».
      if (scope) parts.push('<span class="dk-map__key dk-map__key--out"><i style="background:var(--seq-5)"></i>вне среза</span>');
      legendEl.innerHTML = parts.join('') + (unit ? '<span class="dk-map__unit">' + esc(unit) + '</span>' : '');
    }

    function label(id) {
      var v = values[id];
      return names[id] + ' · ' + (typeof v === 'number' ? nfmt(v) + (unit ? ' ' + unit : '') : 'нет данных') +
        (inScope(id) ? '' : ' · вне среза');
    }

    function renderMap() {
      // Раньше здесь было написано «покажем плитки», после чего функция
      // просто выходила и ничего не показывала. Текст, который обещает
      // действие и его не делает, дороже пустого прямоугольника: человек
      // ждёт, потом перезагружает страницу, потом звонит в поддержку.
      // Теперь мы действительно переключаемся на плитки, если они есть.
      if (!geo) {
        if (tiles) { view = 'tiles'; render(); return; }
        bodyEl.innerHTML = '<div class="dk-empty"><div class="dk-empty__t">Карта не загрузилась</div>' +
          '<div>Контуры регионов не пришли.</div>' +
          '<div class="dk-empty__do">Откройте страницу по http, а не двойным кликом.</div></div>';
        return;
      }

      bodyEl.innerHTML = '<div class="dk-map__canvas"></div>';
      if (canvasEl) sizeWatch.unobserve(canvasEl);
      canvasEl = bodyEl.firstChild;
      // Холст слушаем сам по себе, а не только через host: его размер задаёт
      // CSS, и он может схлопнуться, когда host своего размера не менял.
      sizeWatch.observe(canvasEl);
      if (inst) { inst.dispose(); inst = null; }
      drawMap();
    }

    /* КАРТА РИСУЕТСЯ ТОЛЬКО В КОНТЕЙНЕР С РАЗМЕРОМ.

       ECharts с нашей проекцией падает, если у холста нулевая ширина ИЛИ
       нулевая высота: «Cannot read properties of null (reading '0')» изнутри
       построения системы координат. Замерено: падает и при создании, и при
       resize() уже нарисованной карты, с полным движком так же, как с
       урезанным. Падение при создании вылетало из dkMap наружу и обрывало
       скрипт страницы: вместе с картой пропадало всё, что страница собирала
       после неё. А нулевой размер — не экзотика: свёрнутая панель, вкладка,
       которую ещё не открыли, контейнер, который получит ширину позже.

       Поэтому без размера карта не создаётся, а ждёт: sizeWatch дорисует её,
       когда размер появится. */
    function hasSize(el) {
      return el.clientWidth > 0 && el.clientHeight > 0;
    }

    function drawMap() {
      cur = rootOf(host);
      if (!canvasEl || !hasSize(canvasEl)) return;
      echarts.registerMap(name, geo);
      if (inst) inst.dispose();
      inst = echarts.init(canvasEl, themeName(), { renderer: 'canvas' });
      inst.setOption({
        animationDuration: window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260,
        tooltip: {
          trigger: 'item',
          formatter: function (p) { return esc(label(p.name)); }
        },
        series: [{
          type: 'map',
          map: name,
          nameProperty: 'id',
          roam: false,
          projection: { project: project, unproject: unproject },
          // Карта вписывается в рамку с полем 2% с краёв, а не в 80% её по
          // умолчанию: рамка и так построена по пропорциям страны
          // (components.css, .dk-map__canvas). layoutSize сюда не годится —
          // он считается от меньшей стороны рамки, то есть от высоты, и
          // первая попытка сжала карту до половины ширины (замер 29.09).
          left: '2%', right: '2%', top: '2%', bottom: '2%',
          // Граница — цветом поверхности, как зазор в накопительных столбцах:
          // это не обводка, а разделение соседних заливок.
          itemStyle: { areaColor: window.dkMeaning.color('nodata', 'fill', host), borderColor: css('--surface'), borderWidth: 0.6 },
          emphasis: { itemStyle: { areaColor: css('--brand') }, label: { show: false } },
          select: { itemStyle: { areaColor: css('--brand') }, label: { show: false } },
          selectedMode: 'single',
          data: Object.keys(names).map(function (id) {
            return { name: id, value: values[id],
              itemStyle: { areaColor: color(values[id]), decal: bucket(values[id]) < 0 ? window.dkMeaning.decal(host) : null, opacity: inScope(id) ? 1 : 0.25 } };
          })
        }]
      }, true);

      inst.on('click', function (p) { if (p.name) onSelect(p.name, values[p.name]); });
    }

    function renderTiles() {
      if (inst) { inst.dispose(); inst = null; }
      if (canvasEl) { sizeWatch.unobserve(canvasEl); canvasEl = null; }
      // Пустая раскладка — не то же самое, что отсутствующая, но ведёт себя
      // так же: reduce по пустому массиву с начальным значением tiles[0]
      // возвращал undefined, и следующая же строка падала на first.id. Виджет
      // не отрисовывался совсем — вместо честного «плиток нет».
      if (!tiles || !tiles.tiles || !tiles.tiles.length) {
        bodyEl.innerHTML = '<div class="dk-empty"><div class="dk-empty__t">Плитки не загрузились</div>' +
          '<div>Раскладка регионов не пришла.</div>' +
          '<div class="dk-empty__do">Данные по регионам открываются кнопкой «Карта».</div></div>';
        return;
      }

      // role="group", а не "grid": строк в разметке нет — плитки разложены по
      // координатам из файла, и объявлять скринридеру сетку, которой в дереве
      // не существует, значит обещать навигацию по строкам и колонкам,
      // которой не будет.
      var html = '<div class="dk-map__pan">' +
                 '<div class="dk-map__tiles" role="group" aria-label="' +
                 tiles.tiles.length + ' регионов. Стрелки — переход между регионами"' +
                 ' data-zoom="' + zoom + '"' +
                 ' style="--cols:' + num(tiles.cols) + ';--rows:' + num(tiles.rows) + ';--zoom:' + zoom + '">';

      // Один tabindex на всю сетку: 89 плиток в табуляции — это 89 нажатий,
      // чтобы пройти виджет насквозь. Ходят по ним стрелками.
      var first = tiles.tiles.reduce(function (a, b) {
        return (b.row < a.row || (b.row === a.row && b.col < a.col)) ? b : a;
      }, tiles.tiles[0]);
      /* Курсор сверяется со списком ПЛИТОК, а не со списком значений: регион
         без данных — это существующая плитка, по ней ходят стрелками и её
         выбирают. Раньше проверка шла по values, и курсор, стоявший на
         регионе без данных, при каждой перерисовке откатывался к первому —
         то есть человек не мог остановиться ровно там, где данных нет, а это
         как раз то место, ради которого карту иногда и открывают. */
      var byTile = {};
      tiles.tiles.forEach(function (t) { byTile[t.id] = true; });
      var focusId = cursor && byTile[cursor] ? cursor : first.id;

      tiles.tiles.forEach(function (t) {
        var v = values[t.id];
        var shown = typeof v === 'number' ? String(v) : '—';
        // Координаты приходят из файла раскладки и уходят прямо в style.
        // Строки со скобками там достаточно, чтобы дописать своё правило,
        // поэтому всё, что не число, становится нулём.
        var row = num(t.row), col = num(t.col);
        html += '<button type="button" class="dk-map__tile' + (bucket(v) < 0 ? ' dk-nodata' : '') + (inScope(t.id) ? '' : ' dk-map__tile--out') + '"' +
          ' data-id="' + esc(t.id) + '" data-row="' + row + '" data-col="' + col + '"' +
          ' tabindex="' + (t.id === focusId ? '0' : '-1') + '"' +
          ' style="grid-row:' + (row + 1) + ';grid-column:' + (col + 1) +
          ';--fill:' + color(v) + '"' +
          ' title="' + esc(label(t.id)) + '" aria-label="' + esc(label(t.id)) + '">' +
          // Значение стоит В плитке, а не только в подсказке: плитки объявлены
          // ответом на вопрос «у кого хуже», а подсказку не получить ни
          // пальцем, ни с клавиатуры.
          '<b class="dk-map__abbr">' + esc(t.abbr) + '</b>' +
          '<span class="dk-map__val">' + esc(shown) + '</span>' +
          '</button>';
      });
      bodyEl.innerHTML = html + '</div></div>' +
        // Увеличение — кнопками, а не только щипком: щипок на странице
        // увеличивает всю страницу, а не плитки, и с мышью его нет вовсе.
        '<div class="dk-map__zoom" role="group" aria-label="Масштаб плиток">' +
          '<button type="button" data-zoom-step="1" aria-label="Приблизить"' + (zoom >= ZOOMS[ZOOMS.length - 1] ? ' disabled' : '') + '>' +
            '<svg class="dk-i" aria-hidden="true"><use href="#ti-plus"/></svg></button>' +
          '<button type="button" data-zoom-step="-1" aria-label="Отдалить"' + (zoom <= ZOOMS[0] ? ' disabled' : '') + '>' +
            '<svg class="dk-i" aria-hidden="true"><use href="#ti-minus"/></svg></button>' +
        '</div>';
    }

    /* УВЕЛИЧЕНИЕ ПЛИТОК. На телефоне 89 плиток в 354 px — это клетки по 17 px:
       цвет видно, сокращение региона — нет, и «у кого хуже» приходится
       угадывать по положению. Кнопки + и − растят сетку ступенями, сетка
       листается внутри своей рамки, а центр того, что человек разглядывал,
       остаётся на месте. С полутора сокращения возвращаются в плитки. */
    function setZoom(step) {
      var i = ZOOMS.indexOf(zoom);
      var nextZoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + step))];
      if (nextZoom === zoom) return;
      var pan = bodyEl.querySelector('.dk-map__pan');
      var cx = pan ? (pan.scrollLeft + pan.clientWidth / 2) / pan.scrollWidth : 0.5;
      var cy = pan ? (pan.scrollTop + pan.clientHeight / 2) / pan.scrollHeight : 0.5;
      zoom = nextZoom;
      renderTiles();
      pan = bodyEl.querySelector('.dk-map__pan');
      if (pan) {
        pan.scrollLeft = cx * pan.scrollWidth - pan.clientWidth / 2;
        pan.scrollTop = cy * pan.scrollHeight - pan.clientHeight / 2;
      }
      var again = bodyEl.querySelector('[data-zoom-step="' + step + '"]');
      if (again && !again.disabled) again.focus();
    }
    bodyEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-zoom-step]');
      if (b && bodyEl.contains(b)) setZoom(Number(b.dataset.zoomStep));
    });

    function render() {
      if (stopped) return;
      cur = rootOf(host);
      host.setAttribute('data-view', view);
      // Кнопки ищем в сегменте, а не в контейнере карты: сегмент может стоять
      // в шапке виджета, то есть вне host. Поиск по host их там не находил, и
      // нажатая кнопка оставалась прежней даже после переключения.
      segEl.querySelectorAll('button[data-view]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.view === view));
      });
      renderLegend();
      view === 'list' ? renderList() : view === 'tiles' ? renderTiles() : renderMap();
    }

    /* Список — текстовый ранжированный вид тех же данных: регион, цвет-статус и
       значение в строке-кнопке от 44px. Доступная альтернатива плиткам
       картограммы (по ним пальцем не попасть) и просто другой способ читать
       «у кого хуже» — сверху вниз, а не по цвету на сетке. */
    function renderList() {
      var rows = tiles && tiles.tiles ? tiles.tiles.slice()
        : Object.keys(names).map(function (id) { return { id: id }; });
      rows.sort(function (a, b) {
        var va = values[a.id], vb = values[b.id];
        var na = typeof va === 'number', nb = typeof vb === 'number';
        if (na && nb) return vb - va;        // больше — выше: «у кого хуже» сверху
        return na ? -1 : nb ? 1 : 0;         // нет данных — в конец
      });
      var html = '<div class="dk-map__list" role="list" aria-label="Регионы по значению">';
      rows.forEach(function (t, i) {
        var v = values[t.id];
        var shown = typeof v === 'number' ? nfmt(v) + (unit ? ' ' + unit : '') : 'нет данных';
        html += '<button type="button" role="listitem" class="dk-map__li' +
          (inScope(t.id) ? '' : ' dk-map__li--out') + '" data-id="' + esc(t.id) + '"' +
          ' aria-label="' + esc(label(t.id)) + '">' +
          '<span class="dk-map__li-rank">' + num(i + 1) + '</span>' +
          '<span class="dk-map__li-dot' + (bucket(v) < 0 ? ' dk-nodata' : '') + '" style="--fill:' + color(v) + '" aria-hidden="true"></span>' +
          '<span class="dk-map__li-name">' + esc(names[t.id] || t.id) + '</span>' +
          '<span class="dk-map__li-val">' + esc(shown) + '</span>' +
          '</button>';
      });
      bodyEl.innerHTML = html + '</div>';
    }

    /* Переключатель слушаем на самом сегменте, а не на контейнере карты.

       Пока сегмент лежал внутри карты, делегирование на host работало. Стоило
       вынести его в шапку виджета — и клики перестали доходить: узел уехал из
       поддерева, на которое подписан обработчик. Ошибка моя и ровно того рода,
       которую не видно в коде: разметка переехала, а подписка осталась там,
       где была. */
    segEl.addEventListener('click', function (e) {
      var v = e.target.closest('button[data-view]');
      if (v) { view = v.dataset.view; render(); }
    });

    host.addEventListener('click', function (e) {
      var tile = e.target.closest('.dk-map__tile, .dk-map__li');
      if (tile) onSelect(tile.dataset.id, values[tile.dataset.id]);
    });

    // Плитки — сетка, и ходить по ней надо стрелками, а не двадцатью табами.
    host.addEventListener('keydown', function (e) {
      var tile = e.target.closest && e.target.closest('.dk-map__tile');
      if (!tile) return;
      var d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (!d) return;
      e.preventDefault();
      var row = +tile.dataset.row, col = +tile.dataset.col;
      var all = Array.prototype.slice.call(host.querySelectorAll('.dk-map__tile'));
      // Ищем ближайшую занятую клетку в нужную сторону: в раскладке есть дыры,
      // и «шаг вправо» должен попадать на следующий регион, а не в пустоту.
      var best = null, bestD = Infinity;
      all.forEach(function (o) {
        var dr = +o.dataset.row - row, dc = +o.dataset.col - col;
        if (d[0] ? (dr * d[0] <= 0) : (dc * d[1] <= 0)) return;
        var dist = Math.abs(dr) * (d[0] ? 1 : 3) + Math.abs(dc) * (d[0] ? 3 : 1);
        if (dist < bestD) { bestD = dist; best = o; }
      });
      if (best) {
        // Переносим единственный tabindex на новую плитку: выйти из сетки
        // табом человек должен туда же, откуда вошёл.
        all.forEach(function (o) { o.setAttribute('tabindex', '-1'); });
        best.setAttribute('tabindex', '0');
        cursor = best.dataset.id;
        best.focus();
      }
    });

    var themeWatch = new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) if (recs[i].attributeName === 'data-theme') { render(); return; }
    });
    themeWatch.observe(rootOf(host), { attributes: true });

    /* Схлопнулся до нуля — resize() не зовём, он падает так же, как создание
       (см. drawMap). Карта держит последнюю картинку, а когда размер
       вернётся, пересчитается. Ещё не нарисована, потому что ждала размера, —
       рисуется сейчас. */
    var sizeWatch = new ResizeObserver(function () {
      if (view !== 'map' || !canvasEl || !hasSize(canvasEl)) return;
      if (inst) inst.resize(); else drawMap();
    });
    sizeWatch.observe(host);

    render();

    // Погребение отдано сторожу из dk-util.js: подписка на тему висит на корне
    // документа и переживает узел, а звать destroy() руками никто не обязан.
    var destroy = own(host, function () {
      stopped = true;
      if (!host.contains(segEl)) segEl.remove();
      themeWatch.disconnect(); sizeWatch.disconnect();
      if (inst) { inst.dispose(); inst = null; }
      host.innerHTML = '';
    });

    return {
      get view() { return view; },
      set view(v) { view = (v === 'tiles' || v === 'list') ? v : 'map'; render(); },
      update: function (next) {
        next = next || {};
        if (next.values) { values = next.values; rescale(); }
        if (Object.prototype.hasOwnProperty.call(next, 'scope')) scope = next.scope == null ? null : new Set(next.scope);
        if (next.view) view = (next.view === 'tiles' || next.view === 'list') ? next.view : 'map';
        render();
      },
      setScope: function (ids) {
        // Пустой результат фильтра — пустой срез. Только null/undefined
        // снимает ограничение: иначе карта противоречит пустой таблице и KPI.
        scope = ids == null ? null : new Set(ids);
        render();
      },
      setValues: function (v) {
        values = v || {};
        rescale();          // иначе новые данные красятся старой шкалой
        render();
      },
      destroy: destroy
    };
  };

  window.dkMap.fromTopo = fromTopo;
})();
