/* ============================================================================
   dashboard-kit · dk-charts.js
   Обёртка над ECharts. Подключать ПОСЛЕ echarts и dk-chart-theme.js.

   Зачем обёртка, если ECharts и так всё умеет: он умеет СЛИШКОМ много.
   Открытый доступ ко всем настройкам означает, что через полгода в проекте
   будет шесть по-разному выглядящих графиков, две оси на одной картинке и
   круговая диаграмма из восемнадцати секторов. Обёртка закрывает опасное и
   оставляет нужное.

   Что она делает сама, без просьбы:
     · берёт тему по data-theme и переключает её вместе со страницей;
     · подстраивается под размер контейнера;
     · показывает состояние «данных нет» вместо пустого прямоугольника;
     · включает легенду от двух серий и выключает при одной;
     · сворачивает лишние сектора круговой в «Прочее».

   Чего она НЕ позволяет и не будет:
     · двух вертикальных осей на одном графике. Это самая частая ошибка в
       дашбордах: две шкалы разного масштаба рядом создают любое нужное
       впечатление, потому что их взаимное положение выбрал автор, а не данные.
       Нужны две величины — это два графика или приведение к общей базе;
     · сглаживания линии. Плавная кривая между точками показывает значения,
       которых не было;
     · цвета серии из светофора состояния. Красный означает «плохо», а не
       «третья серия».

   Использование:

       const chart = dkChart(document.querySelector('#sales'), {
         type: 'line',
         categories: ['Пн','Вт','Ср'],
         series: [{ name: 'Аварии', data: [12, 19, 7] }]
       });
       chart.update({ series: [...] });
   ============================================================================ */

(function () {
  'use strict';

  if (typeof echarts === 'undefined') {
    console.error('dk-charts: сначала нужно подключить echarts');
    return;
  }

  var PIE_MAX = window.DK_PIE_MAX_SLICES || 6;
  var OTHER = 'Прочее';

  /* ТЕМА И ТОКЕНЫ — ОТ БЛИЖАЙШЕГО .dk-root, А НЕ ОТ <html>. У своей
     страницы кита это одно и то же. У встроенного кита — нет: хозяин
     страницы свой, тема и токены живут на обёртке <div class="dk-root"
     data-theme>, а на <html> хозяина их нет вовсе. График читал тему с
     <html> и рисовался в чужой теме, а цвета из токенов приходили пустыми —
     исполнитель проверочной задачи скилла (29.09) из-за этого не поставил
     спарклайны в чужую витрину. cur — корень графика, который рисуется
     сейчас: помощники ниже зовутся только внутри отрисовки. */
  var cur = document.documentElement;
  function rootOf(el) { return (el && el.closest && el.closest('.dk-root')) || document.documentElement; }

  function themeName() {
    return cur.getAttribute('data-theme') === 'light' ? 'dk-light' : 'dk-dark';
  }

  function surfaceColor() {
    return getComputedStyle(cur).getPropertyValue('--surface').trim() || '#000';
  }

  function inkColor(step) {
    return getComputedStyle(cur).getPropertyValue(step).trim();
  }

  /* Шесть слотов — не мягкое пожелание, а предел различимости: он измерен
     проверкой ПАЛИТРА и держится впритык. Седьмая серия берёт цвет первой, и
     на графике появляются две разные величины одного цвета — то есть график
     начинает врать молча. Цвет всё равно выдаём (лучше нарисовать, чем упасть),
     но сообщаем об этом разработчику: решение — свернуть хвост в «Прочее» или
     разнести на два графика, а не перекрасить. */
  function seriesColor(i) {
    return inkColor('--series-' + ((i % 6) + 1));
  }

  /* Шесть слотов — не мягкое пожелание, а предел различимости: он измерен
     проверкой ПАЛИТРА и держится впритык. Седьмая серия берёт цвет первой, и
     на графике появляются две разные величины одного цвета — график начинает
     врать молча.

     Предупреждение стоит здесь, а не в seriesColor: для обычной линии цвет
     выдаёт тема ECharts, и seriesColor не зовётся вовсе. Сначала я поставил
     его там — и оно не срабатывало ровно в самом частом случае. */
  var SAID_SERIES = false;
  function warnSeries(n) {
    if (n <= 6 || SAID_SERIES) return;
    SAID_SERIES = true;
    console.warn('dk-charts: серий ' + n + ', а различимых цветов шесть — ' +
                 'с седьмой они повторяются, и две разные величины становятся ' +
                 'одного цвета. Сверните хвост в «Прочее» или разнесите на два графика.');
  }

  /* --- палитра состояний ---------------------------------------------------
     palette: 'status' — для графиков, где категории это СОСТОЯНИЕ, а не
     принадлежность: «высокий / средний / низкий / нет данных». По умолчанию
     обёртка красит серии палитрой принадлежности, и на таком графике выходит
     ложь: безопасное горит тёплым, опасное холодным, а «нет данных» получает
     цвет серии, то есть притворяется значением.

     Порядок жёсткий и совпадает с порядком категорий: от худшего к лучшему,
     последним — отсутствие данных. Читателю не нужно сверяться с легендой:
     красный он уже знает по всему остальному дашборду.                      */
  var STATUS = ['crit', 'high', 'calm', 'nodata'];

  /* Категорий в палитре состояний ровно четыре, и пятая — это не «ещё одно
     состояние», а ошибка данных. Раньше всё после четвёртой получало цвет
     «нет данных»: реальное значение притворялось отсутствием, то есть график
     показывал благополучие там, где его нет. Это ровно та ложь, ради запрета
     которой палитра состояний и заведена. */
  var SAID_STATUS = false;
  function statusColor(i) {
    if (i >= STATUS.length && !SAID_STATUS) {
      SAID_STATUS = true;
      console.warn('dk-charts: в палитре состояний четыре категории ' +
                   '(высокий, средний, низкий, нет данных). Пятая и дальше красятся ' +
                   'как «нет данных» — значение притворяется отсутствием. ' +
                   'Либо это не состояние, либо категории надо свести к четырём.');
    }
    return window.dkMeaning.color(STATUS[Math.min(i, STATUS.length - 1)], 'fill', cur);
  }

  function paint(spec, i) {
    return spec.palette === 'status' ? statusColor(i) : null;
  }

  /* --- заливка под линией --------------------------------------------------
     Вертикальный градиент от цвета серии к прозрачному. Это единственное
     украшение, которое кит себе позволяет в графике, и позволяет по делу:
     плоская заливка спорит с линией за внимание и делает область тяжелее
     самих данных, а гаснущая книзу — только показывает, какой линии эта
     площадь принадлежит.

     Градиент НЕ идёт в столбцы: там он добавил бы измерение, которого в
     данных нет — верх столбца выглядел бы «горячее» низа без причины.

     На нескольких сериях градиента тоже нет: наложенные друг на друга
     полупрозрачные площади дают третий цвет, которого нет в палитре, и
     читатель принимает его за третью серию.                                  */
  function rgba(color, alpha) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
    if (!m) return null;                    // токен не в шестнадцатеричном виде
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function areaFill(i, multi) {
    if (multi) return { opacity: 0.16 };    // несколько серий — плоско и тихо
    var top = rgba(seriesColor(i), 0.38);
    var bottom = rgba(seriesColor(i), 0.02);
    if (!top) return { opacity: 0.24 };     // цвет не разобрали — как раньше
    return {
      opacity: 1,
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: top }, { offset: 1, color: bottom }]
      }
    };
  }

  /* Прогноз выделяется тонкой сплошной линией, ромбами и подписью.
     Стык дублируется в обоих рядах, иначе линия рвётся на границе. */
  function splitForecast(data, n) {
    var cut = Math.max(1, data.length - n);           // первая прогнозная точка
    var head = data.map(function (v, i) { return i < cut ? v : null; });
    var tail = data.map(function (v, i) { return i >= cut - 1 ? v : null; });
    return { head: head, tail: tail };
  }

  /* --- канон: сектора круговой ------------------------------------------
     Больше шести долей человек не сравнивает — он их пересчитывает. Лишние
     складываем в одну и честно называем «Прочее», а не режем молча.          */
  function foldSlices(data) {
    if (data.length <= PIE_MAX) return data;
    var sorted = data.slice().sort(function (a, b) { return b.value - a.value; });
    var head = sorted.slice(0, PIE_MAX - 1);
    var tail = sorted.slice(PIE_MAX - 1);
    var sum = tail.reduce(function (s, d) { return s + d.value; }, 0);
    console.warn('dk-charts: секторов было ' + data.length + ', свёрнуто в «' + OTHER +
                 '» — ' + tail.length + ' шт. Круговая читается до ' + PIE_MAX + '.');
    return head.concat([{ name: OTHER, value: sum }]);
  }

  /* --- сборка настроек по типу ------------------------------------------- */

  /* --- выделение одной серии ---------------------------------------------
     Самая недоиспользуемая форма и часто честный ответ на «сделай график
     понятнее». Если история звучит как «вот эта выросла», то остальные серии —
     фон, а не участники. Красить их всех разными цветами значит прятать ту
     единственную, ради которой график и сделан.                              */
  function applyHighlight(list, spec) {
    if (!spec.highlight) return list;
    var muted = inkColor('--ink-3');
    var found = false;
    list.forEach(function (s) {
      if (s.name === spec.highlight) { found = true; return; }
      s.itemStyle = { color: muted, opacity: 0.45 };
      s.lineStyle = { color: muted, opacity: 0.45, width: 1 };
      if (s.areaStyle) s.areaStyle = { opacity: 0.06, color: muted };
      s.symbol = 'none';
      s.z = 1;
    });
    if (!found) {
      console.warn('dk-charts: серии «' + spec.highlight + '» нет — выделять нечего');
    }
    return list;
  }

  /* --- линия тренда -------------------------------------------------------
     Метод наименьших квадратов. Линия показывает направление связи и ничего
     не доказывает: по трём точкам она рисуется так же охотно, как по тремстам.
     Поэтому включается вручную (trend: true), а не сама собой, и по двум
     точкам не строится вовсе — через две точки прямая проходит всегда.       */
  function trendFor(points) {
    var n = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, minX = Infinity, maxX = -Infinity;
    points.forEach(function (p) {
      var x = Array.isArray(p) ? p[0] : null, y = Array.isArray(p) ? p[1] : null;
      if (typeof x !== 'number' || typeof y !== 'number') return;
      n++; sx += x; sy += y; sxy += x * y; sxx += x * x;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    });
    if (n < 3) return null;
    var d = n * sxx - sx * sx;
    if (!d) return null;
    var k = (n * sxy - sx * sy) / d;
    var b = (sy - k * sx) / n;
    return [[minX, k * minX + b], [maxX, k * maxX + b]];
  }

  function buildOption(spec, el) {
    var type = spec.type || 'line';
    var series = spec.series || [];
    warnSeries(series.length);
    var multi = series.length > 1;

    var option = {
      // Системную настройку «меньше движения» уважает и график: у ECharts своя
      // анимация, и токены кита до неё не дотягиваются. Для части людей движение
      // вызывает тошноту и головокружение — это не предпочтение, а причина.
      animationDuration: window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260,
      legend: multi ? { bottom: 0, left: 'center', itemGap: 12, padding: [4, 0, 0, 0] } : { show: false },
      grid: { left: 8, right: 12, top: 24, bottom: multi ? 32 : 8, containLabel: true },
      tooltip: {}
    };

    if (type === 'line' || type === 'area' || type === 'step' || type === 'bar' || type === 'bar-stacked') {
      option.tooltip = { trigger: 'axis', formatter: axisTip(spec) };
      option.xAxis = { type: 'category', data: spec.categories || [], boundaryGap: type === 'bar' || type === 'bar-stacked' };
      /* У линии крайние точки стоят на краях сетки, и подпись под последней
         выходила за правый край наполовину: на телефоне «29.09» читалось как
         «29 се» (проверочная задача скилла, 29.09). Крайние подписи
         прижимаются внутрь: первая — к левому краю, последняя — к правому. */
      if (!option.xAxis.boundaryGap) option.xAxis.axisLabel = { alignMinLabel: 'left', alignMaxLabel: 'right' };
      /* Шаг оси не дробится, если данные целые. Счёт аварий не бывает
         дробным, а ось честно рисовала 0.5 / 1.5 / 2.5 — то есть предлагала
         читать величины, которых не существует. Проверяем сами данные, а не
         спрашиваем у вызывающего: он и так знает, что у него целые числа, и
         лишний флаг он однажды забудет. */
      var целые = (spec.series || []).every(function (s2) {
        return (s2.data || []).every(function (v) {
          return v == null || (typeof v === 'number' && Number.isInteger(v));
        });
      });
      option.yAxis = { type: 'value', name: spec.unit || '', nameTextStyle: { color: inkColor('--ink-3') } };
      if (целые) option.yAxis.minInterval = 1;

      /* ЗНАЧЕНИЕ НА СТОЛБЦЕ, КОГДА ОНО КОРОТКОЕ.

         Столбец высотой в одну-две единицы человек всё равно читает не по
         высоте, а по числу: чтобы узнать, одна там авария или две, он ведёт
         глаз вниз к оси и обратно. Подпись прямо на столбце снимает этот путь.

         И тогда ось становится лишней: она нужна, чтобы переводить высоту в
         число, а число уже написано. Две записи одной величины на одном
         графике — это не «надёжнее», это шум. Поэтому вместе с подписями ось
         значений и её сетка убираются.

         Условия проверяются, а не задаются флагом снаружи:
           · подпись короткая — не длиннее трёх знаков, то есть до 999;
           · на категорию хватает ширины (24 пикселя), иначе подписи столкнутся
             и станут хуже оси;
           · серия одна: у нескольких серий подписи наезжают друг на друга.

         Если хоть одно не выполнено — остаётся ось, как было. */
      var подписатьСтолбцы = false;
      var плотныйРяд = (spec.categories || []).length > 8;
      if (type === 'bar' && !multi) {
        var зн = (series[0] && series[0].data) || [];
        var коротко = зн.every(function (v) {
          return v == null || String(v).length <= 3;
        });
        var наКатегорию = Math.max(0, (el.clientWidth - 48)) / Math.max(1, (spec.categories || []).length);
        if (зн.length && коротко && наКатегорию >= 24) {
          option.yAxis.show = false;
          option.yAxis.splitLine = { show: false };
          option.grid.left = 0;
          option.grid.right = 0;
          option.grid.top = 28;      // место под подпись самого высокого столбца
          подписатьСтолбцы = true;
        }
      }
      option.series = series.map(function (s, i) {
        var base = { name: s.name, data: s.data };
        if (type === 'line' || type === 'area' || type === 'step') {
          base.type = 'line';
          base.smooth = false;             // канон: не врать о промежуточных значениях
          base.showSymbol = (s.data || []).length <= 40;
          if (type === 'step') {
            // Ступень держит значение до следующего замера. Так и ведут себя
            // величины, которые меняются скачком: тариф, режим, статус.
            // Наклонная линия между ними показывала бы плавный переход,
            // которого не было.
            base.step = 'end';
          }
          if (type === 'area') {
            base.areaStyle = areaFill(i, multi);
          }
        } else {
          base.type = 'bar';
          // Скругление растущего конца столбца. У сложенных столбцов его нет
          // намеренно: скруглить надо было бы только верхний сегмент, а какой
          // из них верхний — зависит от данных и меняется от категории к
          // категории. Скруглённые с обеих сторон сегменты внутри столбца
          // читаются как отдельные плитки, а не как части одной величины.
          // Скругление обычного столбца задаёт тема графиков — там же, где
          // его ширина и цвет. Здесь стояло своё значение, и оно молча
          // перебивало тему: в теме 6, на экране 4. Две правды об одном
          // столбце в двух файлах — это как раз то, что потом ищут часами.
          if (подписатьСтолбцы) {
            base.label = {
              show: true, position: 'top',
              color: inkColor('--ink-2'),
              fontFamily: getComputedStyle(cur).getPropertyValue('--font-sans'),
              fontSize: 12,
              /* НОЛЬ ПОДПИСЫВАЕТСЯ НЕ ВСЕГДА, И ЭТО НЕ ПРОТИВОРЕЧИЕ.

                 В коротком рейтинге (пять округов) ноль обязателен: строка
                 есть, полосы нет, и без подписи «Центральный» читается как
                 строка без данных. Там ноль — ответ.

                 В сутках из двадцати четырёх часов всё наоборот. Ноль там
                 норма, а не новость: подписав его, мы получили девять нулей
                 на график с тремя настоящими значениями — и три значения
                 стало труднее найти, чем до подписей. Час подписан на оси
                 категорий, пустое место под ним однозначно, и добавлять к
                 этому цифру нечего.

                 Граница — восемь категорий: столько глаз охватывает списком.
                 Дальше график читается как форма, и в форме ноль — это
                 промежуток, а не значение. */
              formatter: function (p) {
                if (p.value == null) return '';
                if (p.value === 0 && плотныйРяд) return '';
                return num(p.value);
              }
            };
          }
          if (type === 'bar-stacked') {
            // А вот сложенному скругление снимаем явно: тема о его
            // существовании не знает, а скруглённые с обеих сторон сегменты
            // внутри столбца читаются как отдельные плитки.
            base.stack = 'total';
            // Зазор цветом поверхности: сегменты не сливаются в одну полосу.
            // borderRadius здесь же, одним объектом: двумя присваиваниями
            // подряд второе затирало первое — и скругление не снималось.
            base.itemStyle = { borderRadius: 0, borderColor: surfaceColor(), borderWidth: 2 };
          }
        }
        var tone = paint(spec, i);
        if (tone) {
          base.itemStyle = Object.assign({}, base.itemStyle, { color: tone, decal: spec.palette === 'status' && i === 3 ? window.dkMeaning.decal(cur) : null });
          if (base.type === 'line') base.lineStyle = { color: tone };
        }
        return base;
      });
      applyHighlight(option.series, spec);

      // Прогнозный отрезок — только у линейных типов.
      if (type === 'line' || type === 'area' || type === 'step') {
        var tails = [];
        series.forEach(function (s, i) {
          if (!s.forecast) return;
          var parts = splitForecast(s.data || [], s.forecast);
          option.series[i].data = parts.head;
          tails.push({
            name: s.name, type: 'line', data: parts.tail,
            smooth: false, showSymbol: true, symbol: 'emptyDiamond', symbolSize: 7,
            endLabel: { show: true, formatter: 'Прогноз' },
            step: type === 'step' ? 'end' : false,
            lineStyle: { type: 'solid', width: 1, color: seriesColor(i) },
            itemStyle: { color: seriesColor(i) },
            areaStyle: type === 'area' ? { opacity: 0.1, color: seriesColor(i) } : null,
            z: option.series[i].z
          });
        });
        if (tails.length) {
          option.grid.right = 76; // место для полной подписи «Прогноз»
          option.series = option.series.concat(tails);
          // В легенде хвост отдельной строкой не стоит: это та же величина,
          // просто ещё не закрытая.
          if (multi) option.legend.data = series.map(function (s) { return s.name; });
        }
      }
    }

    else if (type === 'bar-h') {
      option.tooltip = { trigger: 'axis' };
      option.yAxis = { type: 'category', data: spec.categories || [], inverse: true };
      option.xAxis = { type: 'value', name: spec.unit || '' };

      /* ЗНАЧЕНИЕ ПОДПИСАНО У КОНЦА ПОЛОСЫ, И ГЛАВНОЕ — У НУЛЕВОЙ ТОЖЕ.

         Нулевая полоса не рисуется: ей нечего рисовать. На экране строка
         «Центральный» выглядела как строка без данных — то есть ноль
         притворялся отсутствием. Это ровно та подмена, против которой у кита
         написано правило «ноль это ответ, отсутствие — нет», и нарушал его
         сам кит.

         Подпись у конца полосы решает это и заодно снимает необходимость
         вести глаз до нижней оси: в рейтинге из пяти строк ось нужна, чтобы
         сравнивать длины, а точное число человек всё равно читает у названия. */
      option.series = series.map(function (s) {
        return {
          name: s.name, data: s.data, type: 'bar',
          // Растущий конец полосы тоже прямой — по той же причине, что и верх
          // столбца: длина полосы и есть значение, а скругление съедает её
          // как раз там, где значение кончается. См. тему графиков.
          itemStyle: { borderRadius: 0 },
          label: {
            show: true, position: 'right',
            color: inkColor('--ink-2'),
            fontFamily: getComputedStyle(cur).getPropertyValue('--font-sans'),
            fontSize: 12,
            formatter: function (p) { return p.value == null ? '—' : num(p.value); }
          }
        };
      });
      /* Место справа под подпись самой длинной полосы: у конца оси подпись
         уходила за край холста и обрезалась — «3 00» вместо «3 000»
         (проверочная задача скилла, 29.09). */
      measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
      measureCtx.font = '12px ' + getComputedStyle(cur).getPropertyValue('--font-sans');
      var widest = 0;
      series.forEach(function (s) { (s.data || []).forEach(function (v) {
        var x = v && typeof v === 'object' ? v.value : v;
        if (x != null) widest = Math.max(widest, measureCtx.measureText(num(x)).width);
      }); });
      option.grid.right = Math.max(option.grid.right || 0, Math.ceil(widest) + 12);
    }

    else if (type === 'pie' || type === 'donut') {
      /* Один центр на кольцо и на число внутри него. Держать его переменной,
         а не двумя литералами в разных местах файла, — единственный способ не
         повторить историю, когда кольцо стояло на 44%, а число на 41%. */
      var центр = ['50%', '44%'];
      var slices = foldSlices(spec.data || []);
      option.tooltip = { trigger: 'item', formatter: '{b}: {c} ({d}%)' };
      option.legend = { bottom: 0, left: 'center', itemGap: 12, padding: [4, 0, 0, 0] };
      option.series = [{
        type: 'pie',
        radius: type === 'donut' ? ['58%', '82%'] : ['0%', '78%'],
        center: центр,
        data: slices.map(function (d, i) {
          var tone = paint(spec, i);
          return tone ? Object.assign({}, d, { itemStyle: { color: tone, decal: spec.palette === 'status' && i === 3 ? window.dkMeaning.decal(cur) : null } }) : d;
        }),
        /* Подписи на секторах выключены намеренно. В узком виджете четыре
           выноски налезают друг на друга и превращают диаграмму в кашу.
           Название сектора даёт легенда, точное значение — подсказка при
           наведении. Включить принудительно: labels: true. */
        label: spec.labels ? { show: true, formatter: '{b} · {d}%' } : { show: false },
        labelLine: { show: !!spec.labels },
        emphasis: { scale: false }
      }];
      if (type === 'donut' && spec.total != null) {
        /* ЧИСЛО В ЦЕНТРЕ — ЭЛЕМЕНТ РАЗМЕТКИ, А НЕ ТЕКСТ НА ХОЛСТЕ.

           Три попытки поставить его через graphic закончились ничем, и каждая
           выглядела сделанной:

           1. left: 'center', top: '41%' — горизонталь верна, вертикаль нет:
              кольцо стоит на 44%, а top задаёт верхний край текста, а не
              середину. Число висело выше центра на половину своей высоты.
           2. left: '50%' — «то же самое, но точнее». Не то же самое: 'center'
              центрирует элемент, а '50%' ставит его левый край на середину.
              Число уехало вправо.
           3. Имена выравнивания. textVerticalAlign — из старого API, ECharts
              его молча выбрасывает; align/verticalAlign в разобранном option
              тоже оказались null. Проверка дампом каждый раз показывала null,
              то есть правка не применялась вовсе.

           Дальше спорить с чужой нормализацией имён смысла нет. Число — это
           не часть диаграммы, а подпись поверх неё, и в разметке ему лучше:
           центрируется CSS без единого процента, наследует токены гарнитуры и
           цвета (холст их не знает — их приходилось вычитывать вручную),
           переживает перерисовку и доступно скринридеру как текст.

           Единственное, что нужно от холста, — не рисовать на этом месте. */
        var центрТекст = el.querySelector('.dk-chart__center');
        if (!центрТекст) {
          центрТекст = document.createElement('div');
          центрТекст.className = 'dk-chart__center';
          el.appendChild(центрТекст);
        }
        центрТекст.textContent = String(spec.total);
        центрТекст.style.setProperty('--at', центр[1]);
      }
    }

    else if (type === 'radar') {
      option.tooltip = { trigger: 'item' };
      option.radar = {
        indicator: spec.indicators || [],
        radius: '66%',
        splitNumber: 4
      };
      option.series = [{
        type: 'radar',
        data: series.map(function (s) {
          return { name: s.name, value: s.data, areaStyle: { opacity: 0.18 } };
        })
      }];
      delete option.grid;
    }

    else if (type === 'sankey') {
      option.tooltip = { trigger: 'item', triggerOn: 'mousemove' };
      option.legend = { show: false };
      option.series = [{
        type: 'sankey',
        data: spec.nodes || [],
        links: spec.links || [],
        emphasis: { focus: 'adjacency' },
        nodeGap: 12,
        lineStyle: { color: 'gradient', opacity: 0.35 }
      }];
      delete option.grid;
    }

    else if (type === 'scatter') {
      // Точечный отвечает на вопрос, которого не задаёт ни один другой тип:
      // связаны ли две величины между собой. Обе оси числовые, одна точка —
      // один объект: регион, дом, бригада. Категорий тут нет, поэтому и
      // подписи осей обязательны — без них читатель не знает, что с чем
      // сравнивают.
      option.tooltip = { trigger: 'item' };
      option.grid = { left: 8, right: 16, top: 24, bottom: multi ? 44 : 28, containLabel: true };
      option.xAxis = {
        type: 'value', name: spec.xName || '',
        nameLocation: 'middle', nameGap: 26,
        nameTextStyle: { color: inkColor('--ink-3') }
      };
      option.yAxis = {
        type: 'value', name: spec.yName || '',
        nameTextStyle: { color: inkColor('--ink-3') }
      };
      option.series = series.map(function (s) {
        return { name: s.name, type: 'scatter', data: s.data || [], symbolSize: s.size || 10 };
      });

      if (spec.trend) {
        series.forEach(function (s, i) {
          var line = trendFor(s.data || []);
          if (!line) return;
          option.series.push({
            name: s.name + ' · тренд',
            type: 'line', data: line,
            showSymbol: false, smooth: false, silent: true,
            lineStyle: { color: seriesColor(i), width: 2, opacity: 0.5 },
            tooltip: { show: false }, z: 1
          });
        });
        // Линия тренда в легенду не попадает: это не третья величина, а
        // пометка поверх уже названных.
        if (multi) option.legend.data = series.map(function (s) { return s.name; });
      }
    }

    else if (type === 'spark') {
      // Спарклайн — это форма, а не график. Он отвечает на вопрос «куда идёт»,
      // а на вопрос «сколько» отвечает число, которое стоит рядом. Поэтому ни
      // осей, ни сетки, ни легенды: на плитке в четверть колонки подпись оси
      // выходит мельче десяти пикселей — нечитаемой и притворяющейся точной.
      if (series.length > 1) {
        console.warn('dk-charts: спарклайн показывает одну серию — взята первая');
      }
      var one = series[0] || { data: [] };
      option.legend = { show: false };
      option.grid = { left: 0, right: 0, top: 4, bottom: 4, containLabel: false };
      option.tooltip = { trigger: 'axis', axisPointer: { type: 'none' } };
      option.xAxis = { type: 'category', data: spec.categories || [], show: false, boundaryGap: false };
      // Шкала не от нуля — единственное место, где это правильно: на высоте в
      // сорок пикселей нулевая база расплющивает любое изменение в прямую,
      // то есть прячет ровно то, ради чего спарклайн и рисуют. Значение здесь
      // читают не с линии, а с числа рядом.
      option.yAxis = { type: 'value', show: false, scale: true };
      // Точка «сейчас» на последнем значении. Без неё линия обрывалась в
      // пустоту у правого края, и было не видно, где кончаются данные и
      // какое значение соответствует числу рядом (разбор 29.09). Кольцо цвета
      // поверхности отделяет точку от заливки под линией.
      var pts = (one.data || []).slice();
      if (pts.length) {
        var lastV = pts[pts.length - 1];
        pts[pts.length - 1] = { value: lastV && typeof lastV === 'object' ? lastV.value : lastV,
          symbol: 'circle', symbolSize: 8, itemStyle: { borderColor: surfaceColor(), borderWidth: 2 } };
      }
      option.grid.right = 6; option.grid.top = 6; option.grid.bottom = 6;
      option.series = [{
        type: 'line',
        name: one.name,
        data: pts,
        smooth: false,                     // канон общий: промежуточных значений не выдумываем
        showSymbol: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        areaStyle: spec.area === false ? null : areaFill(0, false)
      }];
      applyHighlight(option.series, spec);
    }

    else {
      console.error('dk-charts: неизвестный тип «' + type + '»');
      return null;
    }

    /* ЛИНИЯ ПОРОГА ИЛИ ЦЕЛИ. target: 60 или { value: 60, label: 'норма' }.

       Столбец в 74 аварии сам по себе ничего не значит — значение появляется
       рядом с нормой в 60. Без линии читатель сравнивает с соседним столбцом,
       то есть отвечает не на тот вопрос. Внешний разбор поставил это первым
       из недостающего в графиках, и для операционных экранов это не опция:
       цвет там появляется только у значений за порогом, и порог обязан быть
       нарисован.

       Линия серая и сплошная — это ориентир, а не серия и не «плохо»:
       красной она сама превращалась бы в тревогу. Подпись у правого края,
       где заканчивается взгляд, прошедший по графику. Рисуется одной серией
       (первой): ECharts держит markLine на серии, а вторая такая же линия
       поверх первой только утолщила бы линию. */
    if (spec.target != null && option.series && option.series.length &&
        (type === 'line' || type === 'area' || type === 'step' ||
         type === 'bar' || type === 'bar-stacked' || type === 'bar-h')) {
      var цель = typeof spec.target === 'object' ? spec.target : { value: spec.target };
      var точка = type === 'bar-h' ? { xAxis: цель.value } : { yAxis: цель.value };
      option.series[0].markLine = {
        silent: true, symbol: 'none', animation: false,
        lineStyle: { type: 'solid', width: 1, color: inkColor('--ink-3') },
        label: {
          show: цель.label != null, formatter: String(цель.label || ''),
          position: type === 'bar-h' ? 'insideStartTop' : 'end',
          color: inkColor('--ink-3'), fontSize: 12,
          fontFamily: getComputedStyle(cur).getPropertyValue('--font-sans')
        },
        data: [точка]
      };
      // Подпись — за концом линии, а не над ней у правого края: там она
      // налезала на последний столбец, если тот выше нормы (на телефоне
      // «норма» закрывала столбец в 5 при норме 4, разбор 29.09). Место под
      // подпись оставляем справа от сетки, по её измеренной ширине.
      if (type !== 'bar-h' && цель.label != null && option.grid) {
        measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
        measureCtx.font = '12px ' + getComputedStyle(cur).getPropertyValue('--font-sans');
        option.grid.right = Math.max(option.grid.right || 0, Math.ceil(measureCtx.measureText(String(цель.label)).width) + 10);
      }
      // Ось не должна обрезать линию, если порог выше всех данных: иначе
      // «норма 60» при значениях до 40 просто исчезает.
      var ось = type === 'bar-h' ? option.xAxis : option.yAxis;
      if (ось && typeof цель.value === 'number') {
        ось.max = function (v) { return Math.max(v.max, цель.value); };
      }
    }

    /* Числа на осях — по-русски, через dkFmt: движок печатал «3,000» с
       запятой, не так, как все числа кита (проверочная задача скилла). */
    [].concat(option.xAxis || [], option.yAxis || []).forEach(function (ax, k, all) {
      if (!ax || 'value' !== ax.type) return;
      ax.axisLabel = Object.assign({ formatter: function (v) { return num(v); } }, ax.axisLabel || {});
      /* С разрядами «12 000» шире «12000», и на узком графике подписи
         горизонтальной оси значений налезали друг на друга — «3 0006 0009
         000» (замер 29.09). Делений — по одному на 80 px ширины, не больше
         пяти. Не hideOverlap движка: ему нужен модуль labelLayout, которого
         в урезанной сборке нет (проверка ДВИЖОК), и он молча не сработал бы. */
      if (ax === option.xAxis && el && el.clientWidth) {
        ax.splitNumber = Math.max(2, Math.min(5, Math.floor(el.clientWidth / 80)));
      }
    });

    // Две вертикальных оси на одном графике не собираем ни при каких условиях.
    if (Array.isArray(option.yAxis) && option.yAxis.length > 1) {
      console.error('dk-charts: две оси Y запрещены — раздели на два графика');
      option.yAxis = option.yAxis[0];
    }

    if (option.tooltip) {
      option.tooltip.axisPointer = Object.assign({}, option.tooltip.axisPointer, {
        lineStyle: { type: 'solid' }, crossStyle: { type: 'solid' }
      });
    }

    return option;
  }

  /* --- подписи категорий: пропуск только когда не помещаются ------------
     ECharts прячет подписи оси категорий с большим запасом, не по реальной
     ширине текста. Замерено на восьми округах: при 38–43 px на категорию и
     самой длинной подписи в 36 px он прятал СЗФО, ПФО и СФО. На столбце без
     подписи человек не знает, какой это округ, — хотя число над столбцом
     написано. Для округа, дома, котельной пропущенная подпись — это не
     «разрежённая шкала», а потерянное имя.

     Поэтому решаем сами, по измеренной ширине: если у каждой пары соседних
     подписей остаётся не меньше LABEL_GAP, показываются все. Если хоть одна
     пара не расходится — решает ECharts, как раньше: налезающие друг на друга
     подписи хуже пропущенных. Считается по паре, а не по самой длинной
     подписи: соседи СЗФО и ЮФО расходятся там, где две СЗФО подряд не
     разошлись бы, и проверка по максимуму прятала бы то, что помещается.

     Зовётся после каждой раскладки и после каждого resize(): решение,
     принятое на широком экране, после сужения стало бы наложением. */
  var LABEL_GAP = 6;   // --space-3: меньше — соседние слова читаются одним
  var measureCtx = null;

  function fitCategoryLabels(inst) {
    var model = inst.getModel();
    ['xAxis', 'yAxis'].forEach(function (main) {
      var comp = model.getComponent(main, 0);
      if (!comp || !comp.axis || comp.axis.type !== 'category') return;
      if (comp.get('show') === false || comp.get(['axisLabel', 'show']) === false) return;
      var axis = comp.axis;
      var names = axis.scale.getOrdinalMeta().categories;
      if (names.length < 2) return;
      var ext = axis.getExtent();
      var slot = Math.abs(ext[1] - ext[0]) / names.length;
      var lm = axis.getLabelModel();
      var fits = true;
      if (axis.isHorizontal()) {
        measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
        measureCtx.font = lm.getFont();
        var w = names.map(function (t) { return measureCtx.measureText(String(t)).width; });
        for (var i = 1; i < w.length && fits; i++) {
          if (slot - (w[i - 1] + w[i]) / 2 < LABEL_GAP) fits = false;
        }
      } else {
        // Вертикальная ось (bar-h): подписи стоят строками, мерить надо высоту.
        fits = slot - (lm.get('fontSize') || 12) * 1.2 >= LABEL_GAP;
      }
      var want = fits ? 0 : 'auto';
      if (comp.get(['axisLabel', 'interval']) === want) return;
      var patch = {};
      patch[main] = { axisLabel: { interval: want } };
      inst.setOption(patch);
    });
  }

  /* ЧТО УСЛЫШИТ СКРИНРИДЕР. График нарисован на холсте, и для скринридера
     холст пуст: до 29.09 он слышал только число в центре пончика, остальные
     графики молчали. Подпись собирается из тех же данных, что и рисунок, и
     называет то, ради чего график смотрят: крайние значения и последнее для
     линий и столбцов, доли для пончика, разброс для точечного, норму, если
     она есть. spec.label — заголовок своими словами; без него подпись
     начинается с вида графика.

     Это не замена таблице: точные числа по каждой категории скринридер
     получает таблицей рядом с графиком (README, «Какой график выбрать»,
     колонка «Скринридеру»). Подпись отвечает на «что здесь в целом». */
  var KIND = { line: 'Линия', area: 'Линия с заливкой', step: 'Ступенчатая линия', bar: 'Столбцы',
    'bar-stacked': 'Накопительные столбцы', 'bar-h': 'Горизонтальные столбцы', pie: 'Круговая',
    donut: 'Пончик', radar: 'Лепестковая', sankey: 'Поток', scatter: 'Точечный', spark: 'Спарклайн' };

  function describe(spec) {
    var n = window.dkFmt ? window.dkFmt.num : function (v) { return String(v); };
    var unit = spec.unit ? ' ' + spec.unit : '';
    var type = spec.type || 'line';
    var parts = [spec.label || KIND[type] || 'График'];
    var cats = spec.categories || [];
    var val = function (v) { return v && typeof v === 'object' ? v.value : v; };
    if (type === 'pie' || type === 'donut') {
      var data = spec.data || [], sum = 0;
      data.forEach(function (d) { sum += +d.value || 0; });
      parts.push(data.slice(0, 6).map(function (d) {
        return d.name + ' ' + n(d.value) + unit + (sum ? ' (' + Math.round(d.value / sum * 100) + '%)' : '');
      }).join(', '));
      if (spec.total != null) parts.push('Всего ' + spec.total);
    } else if (type === 'scatter') {
      (spec.series || []).slice(0, 3).forEach(function (s) {
        var d = s.data || [];
        if (!d.length) return;
        var xs = d.map(function (p) { return p[0]; }), ys = d.map(function (p) { return p[1]; });
        parts.push(s.name + ': ' + d.length + ' точек, ' + (spec.xName || 'x') + ' от ' + n(Math.min.apply(null, xs)) +
          ' до ' + n(Math.max.apply(null, xs)) + ', ' + (spec.yName || 'y') + ' от ' + n(Math.min.apply(null, ys)) +
          ' до ' + n(Math.max.apply(null, ys)));
      });
    } else if (type === 'sankey') {
      parts.push((spec.nodes || []).length + ' этапов, ' + (spec.links || []).length + ' потоков');
    } else {
      (spec.series || []).slice(0, 3).forEach(function (s) {
        var d = (s.data || []).map(val);
        var known = d.map(function (v, i) { return [v, i]; }).filter(function (p) { return typeof p[0] === 'number'; });
        if (!known.length) return;
        var lo = known[0], hi = known[0];
        known.forEach(function (p) { if (p[0] < lo[0]) lo = p; if (p[0] > hi[0]) hi = p; });
        var at = function (p) { return cats[p[1]] != null ? ' (' + cats[p[1]] + ')' : ''; };
        var last = known[known.length - 1];
        parts.push((s.name ? s.name + ': ' : '') + 'от ' + n(lo[0]) + unit + at(lo) + ' до ' + n(hi[0]) + unit + at(hi) +
          // «Последнее» — только у времени: у столбцов порядок категорий не время.
          (/^(line|area|step|spark)$/.test(type) ? ', последнее ' + n(last[0]) + unit : ''));
      });
      if ((spec.series || []).some(function (s) { return s.forecast; })) parts.push('Прогноз: тонкая линия с ромбами, предварительные данные');
      if ((spec.series || []).length > 3) parts.push('Ещё серий: ' + (spec.series.length - 3));
    }
    if (spec.target != null) {
      var t = typeof spec.target === 'object' ? spec.target : { value: spec.target };
      var tl = t.label || 'порог';
      parts.push(tl.charAt(0).toUpperCase() + tl.slice(1) + ' ' + n(t.value) + unit);
    }
    // Часть может сама кончаться точкой («шт.») — вторую не ставим.
    return parts.map(function (p) { return String(p).replace(/\.+$/, ''); }).join('. ') + '.';
  }

  /* ПОДСКАЗКА ПО ОСИ. У серии с прогнозом две половины под одним именем —
     фактическая и прогнозная, и на каждой точке одна из них пуста. Стандартная
     подсказка показывала обе: «Аварии 24» и под ней «Аварии —», то есть одна
     величина читалась двумя, и вторая — «нет данных» (проверочная задача
     скилла, 29.09). Здесь пустые значения не показываются, а одно имя
     показывается один раз. */
  function axisTip(spec) {
    var unit = spec.unit ? ' ' + spec.unit : '';
    // Экранирование — общее, из dk-util.js: esc() внутри dkChart отсюда не видна.
    var esc = function (x) { return window.dkEsc(x); };
    return function (params) {
      var list = Array.isArray(params) ? params : [params];
      var seen = {}, rows = [];
      list.forEach(function (p) {
        var v = p.value && typeof p.value === 'object' ? p.value.value : p.value;
        if (v == null || v === '-' || seen[p.seriesName]) return;
        seen[p.seriesName] = true;
        var num = window.dkFmt ? window.dkFmt.num(v) : String(v);
        rows.push(p.marker + esc(p.seriesName) + '&nbsp;&nbsp;<b>' + esc(num + unit) + '</b>');
      });
      if (!rows.length) return '';
      return esc(list[0].axisValueLabel) + '<br>' + rows.join('<br>');
    };
  }

  function num(v) { return window.dkFmt ? window.dkFmt.num(v) : String(v); }

  function isEmpty(spec) {
    if (spec.type === 'pie' || spec.type === 'donut') return !(spec.data || []).length;
    if (spec.type === 'sankey') return !(spec.nodes || []).length;
    return !(spec.series || []).some(function (s) { return (s.data || []).length; });
  }

  /* --- публичная функция -------------------------------------------------- */

  function dkOwn(el, destroy) {
    if (!window.dkOwn) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkOwn(el, destroy);
  }

  window.dkChart = function (el, spec) {
    if (!el) { console.error('dk-charts: не передан контейнер'); return null; }

    var inst = null;
    var current = spec || {};
    // Пустое состояние без третьей строки — тупик: человек видит, что пусто,
    // и не знает, его это вина или системы. Обёртка стоит в каждом графике
    // каждого дашборда, поэтому текст задаётся снаружи, а по умолчанию всё
    // равно отвечает на все три вопроса: что, почему, что делать.
  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Если
     помощник не подключён, компонент обязан упасть громко, а не собрать
     разметку без экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }

    var empty = document.createElement('div');
    empty.className = 'dk-empty';
    // Текст пустого состояния — из ТЕКУЩЕГО описания, при каждой отрисовке.
    // Раньше он собирался один раз при создании, и update() с новым empty
    // («В этом округе аварий не было») показывал старый текст (проверочная
    // задача скилла, 29.09).
    function fillEmpty() {
      var e = current && current.empty || {};
      empty.innerHTML = '<div class="dk-empty__t">' + esc(e.title || 'Данных нет') + '</div>' +
                        '<div>' + esc(e.text || 'За выбранный период замеров не было.') + '</div>' +
                        '<div class="dk-empty__do">' + esc(e.hint || 'Расширьте период или снимите фильтры.') + '</div>';
    }

    /* ГРАФИК РИСУЕТСЯ ТОЛЬКО В КОНТЕЙНЕР С РАЗМЕРОМ.

       Санкей падает внутри ECharts, если у контейнера нулевая ширина ИЛИ
       нулевая высота: «Cannot read properties of null (reading '0')» — и при
       создании, и при resize(). Замерено по всем типам обёртки: остальные
       переносят ноль, но это свойство движка, а не наше обещание, поэтому
       правило общее. Падение при создании вылетало из dkChart наружу и
       обрывало скрипт страницы — пропадали и все графики после этого. Нулевой
       размер бывает в свёрнутой панели и в ещё не открытой вкладке.

       Без размера график не создаётся, а ждёт: sizeWatch дорисует его, когда
       размер появится. Рисовать заранее и незачем: решение «подписать
       столбцы или оставить ось» принимается по ширине, а ширины ещё нет. */
    function hasSize() {
      return el.clientWidth > 0 && el.clientHeight > 0;
    }

    function render() {
      cur = rootOf(el);
      if (isEmpty(current)) {
        if (inst) { inst.dispose(); inst = null; }
        el.innerHTML = '';
        fillEmpty();
        el.appendChild(empty);
        // Пустое состояние — текст, его скринридер прочтёт сам.
        el.removeAttribute('role'); el.removeAttribute('aria-label');
        return;
      }
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', describe(current));
      if (empty.parentNode) el.removeChild(empty);
      if (inst) { inst.dispose(); inst = null; }
      if (!hasSize()) return;
      inst = echarts.init(el, themeName(), { renderer: 'canvas' });
      var option = buildOption(current, el);
      if (option) { inst.setOption(option, true); fitCategoryLabels(inst); }
    }

    render();

    /* Golos Text подгружается уже после разметки. Если не пересчитать после
       его загрузки, ширины подписей останутся посчитанными по запасной
       гарнитуре — легенда наезжает сама на себя. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (inst) render(); });
    }

    // Тема страницы переключилась — график переключается вместе с ней.
    var themeWatch = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].attributeName === 'data-theme') { render(); return; }
      }
    });
    themeWatch.observe(rootOf(el), { attributes: true });

    // Контейнер изменил размер — график перестраивается.
    /* Изменение ширины — это обычно просто resize. Но не всегда: решение
       «подписать столбцы или оставить ось» принимается по ширине на категорию,
       и при заметном изменении ширины оно может смениться на обратное. Пока
       здесь стоял только resize(), график, суженный до порога, продолжал
       показывать подписи внахлёст — или, наоборот, держал ось на широком
       экране до перезагрузки страницы.

       Перестраиваем не на каждый пиксель, а когда ширина ушла больше чем на
       десятую часть: полная перестройка дороже resize, и дёргать её на каждое
       движение мыши по разделителю панелей незачем. */
    var последняяШирина = el.clientWidth;
    /* Схлопнулся до нуля — ничего не зовём: resize() падает так же, как
       создание (см. render), а последняя картинка лучше ошибки. Ширину тоже
       не запоминаем, чтобы при возврате сравнивать с той, что была до
       схлопывания. Ещё не нарисован, потому что ждал размера, — рисуем. */
    var sizeWatch = new ResizeObserver(function () {
      if (!hasSize()) return;
      if (!inst) {
        if (!isEmpty(current)) { последняяШирина = el.clientWidth; render(); }
        return;
      }
      var w = el.clientWidth;
      if (последняяШирина && Math.abs(w - последняяШирина) / последняяШирина > 0.1) {
        последняяШирина = w;
        render();
        return;
      }
      последняяШирина = w;
      inst.resize();
      fitCategoryLabels(inst);
    });
    sizeWatch.observe(el);

    // Погребение отдано сторожу из dk-util.js: он же позовёт его сам, когда
    // узел уйдёт со страницы. Раньше destroy() ждал, пока его позовут руками,
    // и не дожидался — а подписка на тему висит на корне документа и узел
    // переживает.
    var destroy = dkOwn(el, function () {
      themeWatch.disconnect();
      sizeWatch.disconnect();
      if (inst) { inst.dispose(); inst = null; }
      el.innerHTML = '';
    });

    return {
      get instance() { return inst; },
      update: function (next) {
        current = Object.assign({}, current, next || {});
        render();
      },
      exportImage: function () {
        if (!inst || !el.isConnected) return Promise.reject(new Error('Chart is not rendered'));
        try { return fetch(inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: getComputedStyle(rootOf(el)).getPropertyValue('--surface').trim() })).then(function (r) { return r.blob(); }); }
        catch (e) { return Promise.reject(e); }
      },
      destroy: destroy
    };
  };
})();
