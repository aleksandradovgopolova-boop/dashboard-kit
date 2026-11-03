# Визуализация: график, регионы (карта и плитки), календарь.

DAYS = "['09.09','10.09','11.09','12.09','13.09','14.09','15.09','16.09','17.09','18.09','19.09','20.09','21.09','22.09']"

PAGES = [
{
    "slug": "chart", "title": "График", "group": "Визуализация", "status": "стабильный",
    "purpose": 'Показывает динамику, сравнение или состав данных; использует общие темы и правила подписей.',
    "files": ["js/dk-charts.js", "js/dk-chart-theme.js", "vendor/echarts.min.js"],
    "scripts": ["vendor/echarts.min.js", "dk-chart-theme.js", "dk-charts.js"],
    "live_intro": 'Линия показывает изменение во времени, столбцы — сравнение, кольцо — состав. Подписи и единицы помогают прочитать результат точно.',
    "live": """<div class="dk-grid--even">
      <div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">По округам · норма 4</h3></div><div id="x-bar" class="dk-chart"></div></div>
      <div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Аварии: факт и прогноз</h3></div><div id="x-forecast" class="dk-chart"></div></div>
      <div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Состав риска</h3></div><div id="x-stack" class="dk-chart"></div></div>
      <div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Доли уровней риска</h3></div><div id="x-donut" class="dk-chart"></div></div>
    </div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkChart !== 'function') return;
    var days = """ + DAYS + """;
    dkChart(document.getElementById('x-bar'), { type: 'bar', target: { value: 4, label: 'норма' },
      categories: ['ЦФО','СЗФО','ЮФО','ПФО','УФО','СФО','ДФО','СКФО'], series: [{ name: 'Регионов в зоне риска', data: [4,3,6,5,2,4,3,1] }] });
    dkChart(document.getElementById('x-forecast'), { type: 'line', categories: days.concat(['23.09','24.09','25.09']),
      series: [{ name: 'Аварии', data: [12,19,7,14,22,18,11,16,9,13,21,17,10,23,25,27,24], forecast: 3 }] });
    dkChart(document.getElementById('x-stack'), { type: 'bar-stacked', palette: 'status', categories: ['нед. 34','нед. 35','нед. 36','нед. 37','нед. 38'],
      series: [{ name: 'Высокий', data: [18,20,21,23,23] }, { name: 'Средний', data: [31,29,28,27,27] }, { name: 'Низкий', data: [39,39,39,38,38] }, { name: 'Мало данных', data: [1,1,1,1,1] }] });
    dkChart(document.getElementById('x-donut'), { type: 'donut', palette: 'status', legendPosition: 'right', total: 89,
      data: [{ name: 'Высокий', value: 23 }, { name: 'Средний', value: 27 }, { name: 'Низкий', value: 38 }, { name: 'Мало данных', value: 1 }] });
    dkChart(document.getElementById('x-empty'), { type: 'line', categories: [], series: [] });
    dkChart(document.getElementById('x-an'), { type: 'bar', target: { value: 20, label: 'норма' }, categories: days, series: [{ name: 'Аварии', data: [12,19,7,14,22,18,11,16,9,13,21,17,10,23] }, { name: 'Устранено', data: [10,12,10,13,14,16,15,18,17,19,18,21,20,22] }] });
    dkChart(document.getElementById('x-many'), { type: 'line', categories: days, series: [
      { name: 'ЮФО', data: [41,44,43,48,52,55,58,61,59,63,68,71,69,72] }, { name: 'ЦФО', data: [33,32,34,33,35,34,33,35,34,33,35,34,36,35] },
      { name: 'СФО', data: [28,29,27,30,28,29,31,29,28,30,29,31,30,29] }, { name: 'ПФО', data: [24,25,23,26,24,25,24,26,25,24,26,25,24,26] }], highlight: 'ЮФО' });
  });""",
    "when_yes": ['Нужно увидеть изменение, сравнить величины или понять состав. Тип графика выбирается по вопросу к данным.', 'Достаточно места для названий и осей. В маленьком блоке лучше оставить мини-график без осей.', 'Плотный ряд можно обобщить по периоду или открыть подробнее, сохранив доступ к точным значениям.'],
    "when_no": ["Одно текущее значение — <a href=\"component-tile.html\">KPI-плитка</a>, а не столбчатый график из одного столбца.",
                "Больше семи значимых категорий — <a href=\"component-table.html\">Таблица</a>, а не ещё больше цветов.",
                "«Где» на территории — <a href=\"component-map.html\">Регионы</a>."],
    "anatomy_html": """<div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title"><b class="sc-callout">1</b>Аварии по дням</h3><div class="dk-widget__actions"><button class="dk-iconbtn dk-iconbtn--sm" title="Обновить" aria-label="Обновить"><svg class="dk-i"><use href="#ti-refresh"/></svg></button></div></div>
      <div class="dk-chart" id="x-an" style="position:relative"><b class="sc-callout" style="position:absolute;left:var(--space-5);top:var(--space-5);z-index:1">2</b><b class="sc-callout" style="position:absolute;right:var(--space-8);top:34%;z-index:1">3</b><b class="sc-callout" style="position:absolute;left:44%;top:16%;z-index:1">4</b><b class="sc-callout" style="position:absolute;left:46%;bottom:var(--space-3);z-index:1">5</b></div></div>""",
    "anatomy": [("Заголовок виджета", "что и за какой период; единица — в подписи оси или в заголовке, не в каждой подписи."),
                ("Ось значений", "от нуля у столбцов всегда; шаг целый, если данные целые. У спарклайна оси нет."),
                ("Линия порога", "<code>target</code>: серая сплошная линия с подписью; ось её не обрезает."),
                ("Прогноз", "<code>forecast: n</code>: последние n точек тонкой линией с ромбами и подписью «Прогноз»; в легенде отдельной строкой не стоит."),
                ("Легенда", "по умолчанию снизу; у donut с legendPosition: right при ширине от 320 px — справа со значениями.")],
    "sizes": 'Высоту задаёт контейнер: dk-chart--sm, обычный, dk-chart--lg, dk-chart--xl или dk-chart--spark. Ширина приходит из сетки. Для осей и подписей нужен полноценный виджет, для небольшого KPI — мини-график.',
    "variants": [("type", "line · area · step · bar · bar-stacked · bar-h · pie · donut · radar · sankey · scatter · spark", "По вопросу читателя — таблица на витрине."),
                 ("palette: 'graphite'", "Первые две серии — chart-primary (бирюзовый) и chart-secondary (сиреневый), адаптированы к Dark/Light. У cartesian-графиков легенда сверху, тихая пунктирная сетка и непрозрачный скруглённый tooltip.", "Для пары сопоставимых величин в Graphite; highlight по-прежнему приглушает контекст."),
                 ("palette: 'status'", "Цвета состояния: crit, high, calm, nodata по порядку категорий.", "Категории — состояние, а не принадлежность."),
                 ("palette: 'risk', steps: [60, 78]", "Для bar-h: risk-area-low ниже первого порога, risk-area-medium от первого, risk-area-high от второго.", "Только согласованные пороги риска; не назначать цвет по месту в рейтинге."),
                 ("sparkStyle: 'bar'", "Министолбцы существующего ряда вместо линии spark.", "tone: crit, calm или event задаёт смысловую заливку; данные и период обязательны."),
                 ("forecastStyle: 'dashed'", "Пунктир и пустые круги, граница и подложка прогнозного периода; у одного ряда легенда Факт / Прогноз.", "Вместе с forecast: n; основной ряд сохраняет сплошную линию."),
                 ("series[].reference: true", "У линии контекста — пунктир и пустые маркеры без заливки, включая type: area; числа и цвет серии сохраняются. По умолчанию false.", "План, цель или иной явно названный ряд сравнения; не применять к фактическому ряду."),
                 ("highlight: 'имя'", "Одна серия цветом, остальные серым.", "История «вот эта выросла»."),
                 ("target", "Линия порога или цели.", "Операционные экраны — всегда."),
                 ("forecast: n", "Тонкая линия с ромбами.", "Прогноз или незакрытые данные."),
                 ("trend: true", "Линия тренда у точечного.", "Направление связи; ничего не доказывает."),
                 ("total", "Число в центре пончика.", "Элемент разметки, не холста."),
                 ("legendPosition: 'right'", "Легенда пончика со значениями справа при ширине контейнера от 320 px.", "В более узком контейнере — обычная нижняя легенда."),
                 ("empty: {title, text, hint}", "Тексты пустого состояния.", "Всегда, если стандартные не подходят.")],
    "states": """<div class="dk-grid--even">
      <div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Данных нет</h3></div><div id="x-empty" class="dk-chart"></div></div>
      <div class="dk-widget" aria-busy="true"><div class="dk-widget__head"><h3 class="dk-widget__title">Загрузка</h3></div><div class="dk-chart"><span class="dk-vh">Загружаем график</span><div class="dk-skel" style="height:14px;width:60%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:85%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:45%"></div></div></div>
      <div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Выделен Южный округ</h3></div><div id="x-many" class="dk-chart"></div></div>
    </div>
    <div class="sc-note"><b>Пустое состояние с третьей строкой.</b> «Данных нет» без «что делать» — тупик; обёртка по умолчанию отвечает на три вопроса, тексты меняются через <code>empty</code>.</div>""",
    "content_ok": ["Заголовок виджета с периодом: «Аварии по дням · 14 дней».",
                   "Единица один раз: в заголовке или в подписи оси (<code>unit</code>).",
                   "До шести серий; седьмая повторит цвет первой, и обёртка предупредит в консоли.",
                   "Ноль на столбце подписан, если категорий до восьми; в плотном ряду ноль — промежуток."],
    "content_bad": ['Разные единицы без объяснимого сравнения.', 'Сглаживание приписывает данным ненаблюдавшиеся значения.', 'Красная серия обозначает обычную категорию вместо риска.', 'Слишком много секторов: сгруппируйте малые категории и сохраните их состав в деталях.'],
    "a11y": ['<b>Описание.</b> dkChart формирует доступное имя из названия, категорий и значений. Задайте понятный label; для точного чтения большого ряда добавьте таблицу или текстовую сводку.', '<b>Движение.</b> Системная настройка уменьшения движения отключает анимацию.', '<b>Цвет.</b> Названия серий, подписи и значения дополняют палитру. Автоматическая проверка цветов не заменяет проверку реального экрана.', '<b>Подсказка.</b> Наведение помогает изучать данные, но не должно быть единственным способом прочитать важное значение.'],
    "tokens": ["dk-chart", "dk-empty"],
    "code_intro": "Подключать после echarts и dk-chart-theme.js. Контейнер с высотой; обёртка сама следит за темой и размером.",
    "code": """<div class="dk-chart" id="hours"></div>

<script>
var c = dkChart(document.getElementById('hours'), {
  type: 'bar',
  categories: ['00', '01', '02'],
  series: [{ name: 'Аварий', data: [1, 0, 2] }],
  target: { value: 4, label: 'норма' },
  unit: 'шт.',
  empty: { title: 'За сутки аварий не было', text: 'Ни одной записи.', hint: 'Расширьте период.' }
});
c.update({ series: [ … ] });   // перерисовать с новыми данными
c.instance;                    // экземпляр ECharts — в обход обёртки
c.destroy();                   // сторож похоронит и сам, когда узел уйдёт
</script>""",
    "api": [("type", "строка", "Тип графика; неизвестный — ошибка в консоли."),
            ("categories / series / data", "массивы", "Данные; у pie/donut — data, у sankey — nodes и links."),
            ("target", "число | {value, label}", "Линия порога на графиках с осями."),
            ("palette: 'status'", "строка", "Четыре цвета состояния по порядку категорий."),
            ("sparkStyle / tone", "'bar' / 'crit' | 'calm' | 'event'", "Для spark: министолбцы с семантической заливкой. Не заменяют числовую историю."),
            ("palette: status-area", "Крупные красные, жёлтые, зелёные сегменты статусов", "Порядок серий: требуют решения, в работе, решено. Для накопленной динамики без зазоров."),
            ("forecastStyle", "'dashed'", "Для линии с forecast: пунктирная прогнозная часть и пустые круги."),
            ("palette: 'risk' / steps", "строка / два числа", "Для bar-h: пороги задают risk-area-low/medium/high по величине, например [60, 78]. Текст и небольшие значки используют контрастные ink-токены."),
            ("legendPosition", "'right'", "Для donut: легенда со значениями справа при ширине от 320 px, ниже — обычная нижняя легенда."),
            ("highlight, forecast, trend, total, unit, labels", "см. варианты", "Модификаторы типов."),
            ("label", "строка", "Заголовок для скринридера. Подпись из данных — крайние значения, доли, норма — дописывается сама."),
            ("update(spec) / instance / destroy()", "API", "Перерисовать; доступ к ECharts; убрать.")],
    "related": [("component-tile.html", "KPI-плитка", "спарклайн в четверти колонки"),
                ("component-legend.html", "Фильтры-легенда", "легенда, которая ещё и фильтрует"),
                ("showcase.html#grafiki", "Витрина: графики", "все одиннадцать типов и таблица выбора"),
                ("vendor/echarts.modules.json", "Список модулей ECharts", "что собрано в урезанный движок")],
},
{
    "slug": "map", "title": "Регионы: карта и плитки", "group": "Визуализация", "status": "стабильный",
    "purpose": 'Показывает распределение показателей по территории и предлагает плитки для сравнения регионов.',
    "files": ["js/dk-map.js", "data/regions.topojson", "data/regions-tiles.json"], "scripts": ["vendor/echarts.min.js", "dk-chart-theme.js", "dk-map.js"],
    "live_intro": 'Карта отвечает «где», плитки дают регионам равную площадь, список помогает прочитать значения. Все три вида используют один набор данных.',
    "live": """<div class="dk-widget"><div id="x-map"></div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkMap !== 'function') return;
    Promise.all([fetch('data/regions.topojson').then(function (r) { return r.json(); }), fetch('data/regions-tiles.json').then(function (r) { return r.json(); })])
    .then(function (res) {
      var values = {}, seed = 11;
      res[1].tiles.forEach(function (t, i) { seed = (seed * 1103515245 + 12345) % 2147483648; if (i % 17 !== 3) values[t.id] = 28 + seed % 68; });
      dkMap(document.getElementById('x-map'), { topo: res[0], object: 'ru89', tiles: res[1], values: values, unit: 'баллов риска' });
    }).catch(function () {
      document.getElementById('x-map').innerHTML = '<div class="dk-error"><div class="dk-error__title">Контуры не загрузились</div><div>Откройте страницу по http, а не двойным щелчком.</div></div>';
    });
  });""",
    "when_yes": ['Важно увидеть, где находятся объекты и как распределён показатель.', 'Нужно сравнить регионы без влияния их площади — для этого подходят плитки.', 'Список даёт доступ к полным названиям и значениям с клавиатуры и на телефоне.'],
    "when_no": ["Топ-5 регионов — <a href=\"component-rank.html\">Рейтинг</a>.",
                "Несколько показателей на регион — <a href=\"component-table.html\">Таблица</a>.",
                "Динамика одного региона — <a href=\"component-chart.html\">График</a>."],
    "anatomy_html": """<div class="dk-map" data-view="tiles"><div class="dk-map__head"><b class="sc-callout">1</b><div class="dk-seg dk-seg--sm dk-seg--icons" role="group" aria-label="Вид данных"><button type="button" aria-pressed="false" title="Карта" aria-label="Карта"><svg class="dk-i dk-i--sm"><use href="#ti-map"/></svg></button><button type="button" aria-pressed="true" title="Плитки" aria-label="Плитки"><svg class="dk-i dk-i--sm"><use href="#ti-layout-grid"/></svg></button></div></div>
      <div class="dk-map__body"><div class="dk-map__tiles" role="group" aria-label="3 региона" style="--cols:4;--rows:1;max-width:320px">
        <button type="button" class="dk-map__tile" style="grid-row:1;grid-column:1;--fill:var(--seq-5)" title="Крым · 82"><b class="sc-callout">2</b><b class="dk-map__abbr">КРЫ</b><span class="dk-map__val">82</span></button>
        <button type="button" class="dk-map__tile" style="grid-row:1;grid-column:2;--fill:var(--seq-3)" title="Омская область · 58"><b class="dk-map__abbr">ОМС</b><span class="dk-map__val"><b class="sc-callout">3</b>58</span></button>
        <button type="button" class="dk-map__tile" style="grid-row:1;grid-column:3;--fill:var(--nodata)" title="Чукотский АО · нет данных"><b class="dk-map__abbr">ЧУК</b><span class="dk-map__val"><b class="sc-callout">4</b>—</span></button></div></div>
      <div class="dk-map__legend"><b class="sc-callout">5</b><span class="dk-map__key"><i style="background:var(--seq-1)"></i>28–41</span><span class="dk-map__key"><i style="background:var(--seq-3)"></i>55–68</span><span class="dk-map__key"><i style="background:var(--seq-5)"></i>82–95</span><span class="dk-map__key"><i style="background:var(--nodata)"></i>нет данных</span><span class="dk-map__unit">баллов риска</span></div></div>""",
    "anatomy": [("Переключатель", "сегмент «карта / плитки»; в виджете с шапкой сам встаёт в неё справа, иначе — своя строка над картой."),
                ("Плитка", "кнопка с сокращением и значением; заливка — ступень шкалы через <code>--fill</code>."),
                ("Значение в плитке", "стоит в самой плитке, не только в подсказке: подсказку не получить ни пальцем, ни с клавиатуры."),
                ("Нет данных", "серый <code>--nodata</code> и прочерк — отдельная категория, а не ноль."),
                ("Легенда", "внизу, под тем, что объясняет: пороги названы числами, единица справа.")],
    "sizes": 'Карта и плитки занимают ширину виджета. Высота зависит от доступного окна и содержания; при смене вида сохраняется рамка. На телефоне предусмотрены прокрутка плиток и список с полными названиями.',
    "variants": [("view: 'map' | 'tiles'", "Начальный вид.", "По умолчанию карта."),
                 ("topo + object / geo", "Контуры: TopoJSON (свой разбор) или GeoJSON.", "Всегда для карты."),
                 ("tiles", "Раскладка плиток из файла.", "Всегда для плиток."),
                 ("values", "{ id: число }; отсутствующий id — «нет данных».", "Всегда."),
                 ("steps / min / max", "Свои пороги или границы шкалы.", "Когда равные ступени не годятся."),
                 ("palette: 'risk'", "Три состояния через risk-area-low/medium/high вместо последовательной шкалы.", "Только при двух явных порогах steps, соответствующих смыслу низкого, среднего и высокого риска."),
                 ("controls", "Куда поставить переключатель.", "Не нужен, если карта в виджете с шапкой: встанет туда сама. false — оставить свою строку.")],
    "states": """<div class="dk-widget"><div class="dk-map" data-view="map"><div class="dk-map__body"><div class="dk-empty"><div class="dk-empty__t">Карта не загрузилась</div><div>Контуры регионов не пришли.</div><div class="dk-empty__do">Откройте страницу по http, а не двойным кликом.</div></div></div></div></div>
    <div class="sc-note"><b>Без контуров карта сама переключается на плитки</b>, если они есть; без плиток — честное «плитки не загрузились». Контейнер без размера карту не роняет: она ждёт размера и дорисовывается (проверка НОЛЬ).</div>""",
    "content_ok": ["Пороги в легенде числами: «55–68», не «средне».",
                   "Единица измерения один раз, справа от легенды.",
                   "Сокращения регионов из файла раскладки — постоянные."],
    "content_bad": ['Радуга без смысла и объяснённых порогов.', 'Ноль вместо отсутствующих данных.', 'Карта без доступного списка или другого способа прочитать значения.'],
    "a11y": ['<b>Клавиатура.</b> Плитки доступны стрелками, регион выбирается Enter или пробелом. Список даёт отдельный путь к полным названиям и значениям.', '<b>Карта.</b> Географический вид рисуется на canvas; он сопровождается доступной альтернативой, а не заменяет её.', '<b>Шкала.</b> Пороги, единица и значения категорий видны в легенде. Цвет дополняет смысл.', '<b>Нет данных.</b> Отсутствие наблюдений обозначается нейтральным состоянием и текстом, отдельно от нуля и нормального значения.'],
    "tokens": ["dk-map"],
    "code_intro": "Данные подаются объектами: на file:// fetch запрещён браузером, и виджет, который сам лезет за файлом, на двойной щелчок не открылся бы.",
    "code": """<div class="dk-widget">
  <div class="dk-widget__head"><h3 class="dk-widget__title">Регионы</h3></div>
  <div id="regions"></div>
</div>

<script>
var m = dkMap(document.getElementById('regions'), {
  topo: topojson, object: 'ru89',      // контуры
  tiles: tilesJson,                    // раскладка плиток
  values: { 'RU-CR': 82, 'RU-NVS': 73 },
  unit: 'баллов риска',
  // controls не нужен: в виджете с шапкой переключатель встанет туда сам
  onSelect: function (id, value) { }
});
m.view = 'tiles';
m.setValues(next);                     // шкала пересчитается
</script>""",
    "api": [("topo, object / geo", "объект", "Контуры регионов."),
            ("tiles", "объект", "Раскладка плиток."),
            ("values", "{id: число}", "Значения; отсутствие — «нет данных»."),
            ("unit, steps, min, max", "строка, массив, числа", "Легенда и шкала."),
            ("appearance", "default | glass", "glass — нейтральные плитки с цветом статуса без точек; координаты и пороги те же."),
            ("Размер при смене вида", "автоматически", "Рамка сохраняет размер исходного вида; длинный список прокручивается внутри. При изменении ширины окна исходная рамка пересчитывается."),
            ("legendPosition", "top | bottom", "Положение легенды в порядке чтения; по умолчанию bottom. top — сразу под шапкой виджета, как у графиков."),
            ("legendCounts", "boolean", "Числа категорий по текущему scope; локальный выбор легенды не меняет знаменатель."),
            ("legendFilter", "boolean", "Кликабельные категории легенды: выбор приглушает другие регионы только на карте, с учётом scope. Повторный клик или «Все» снимает выбор; он сохраняется между видами и обновлениями."),
            ("legendUnit", "строка", "Подпись единицы под картой; пустая строка скрывает её, сохраняя unit в подсказках и списке."),
            ("palette", "'risk'", "С двумя порогами steps — risk-area-low/medium/high по возрастанию риска. Это заливки областей, не цвет текста или небольших значков; пороги и значения обязательны. Подписи плиток используют контрастные risk-label-low/medium/high. Иначе остаётся последовательная шкала."),
            ("controls", "селектор | элемент | false", "Куда поставить сегмент. По умолчанию — в шапку своего виджета."),
            ("onSelect(id, value)", "функция", "Клик по региону или плитке."),
            ("scope / setScope(ids)", "массив id | null", "Регионы в срезе фильтра; остальные приглушены, «вне среза» — в легенде и подписи. Шкала — общая по стране."),
            ("view / setValues(v) / destroy()", "API", "Вид, данные, уборка.")],
    "related": [("component-rank.html", "Рейтинг", "верх списка регионов"),
                ("component-segment.html", "Сегмент", "переключатель вида"),
                ("regions.html", "Страница «Регионы»", "карта в живом дашборде")],
},
{
    "slug": "calendar", "title": "Календарь работ", "group": "Визуализация", "status": "стабильный",
    "purpose": 'Располагает работы и события по датам; позволяет рассмотреть месяц, неделю или список.',
    "files": ["js/dk-calendar.js"], "scripts": ["dk-calendar.js"],
    "live_intro": 'Месяц даёт обзор работ, неделя уточняет время, список помогает найти событие. Переключение сохраняет выбранную дату.',
    "live": """<div class="dk-widget"><div id="x-cal"></div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkCalendar !== 'function') return;
    dkCalendar(document.getElementById('x-cal'), { month: '2026-09-01', events: [
      { date: '2026-09-05', name: 'Замена задвижки', kind: 'high' }, { date: '2026-09-09', name: 'Плановое отключение ГВС', kind: 'plan' },
      { date: '2026-09-14', name: 'Прорыв, Советский р-н', kind: 'crit' }, { date: '2026-09-14', name: 'Проверка данных', kind: 'high' },
      { date: '2026-09-14', name: 'Подвоз воды', kind: 'event' }, { date: '2026-09-14', name: 'Информирование жителей', kind: 'event' },
      { date: '2026-09-17', name: 'Подача восстановлена', kind: 'calm' }, { date: '2026-09-23', name: 'Прорыв теплотрассы', kind: 'crit' },
      { date: '2026-09-28', name: 'Проверка готовности к зиме', kind: 'event' }] });
  });""",
    "when_yes": ["События привязаны к датам, и важно видеть их вместе: работы, отключения, проверки.",
                 "Нужен и обзор месяца, и подробности недели по часам.",
                 "События бывают нескольких видов с разным смыслом."],
    "when_no": ["Выбор интервала дат для среза — <a href=\"component-period.html\">Период</a>.",
                "Лента последних событий без дат — <a href=\"component-list.html\">Список</a>.",
                "Работала служба или нет по времени — <a href=\"component-uptime.html\">Доступность служб</a>."],
    "anatomy_html": """<div class="dk-cal" data-view="month"><div class="dk-cal__head"><b class="sc-callout">1</b><div class="dk-seg dk-seg--sm" role="group" aria-label="Вид"><button type="button" aria-pressed="true">Месяц</button><button type="button" aria-pressed="false">Неделя</button></div><span class="dk-cal__month"><b class="sc-callout">2</b>Сентябрь 2026</span></div>
      <div class="dk-cal__grid" style="grid-template-columns:repeat(3, minmax(0,1fr))"><button type="button" class="dk-cal__day"><span class="dk-cal__n"><b class="sc-callout">3</b>13</span></button>
        <button type="button" class="dk-cal__day" data-today="true"><span class="dk-cal__n"><b class="sc-callout">4</b>14</span><span class="dk-cal__e" style="--accent:var(--crit)"><b class="sc-callout">5</b>Прорыв</span><span class="dk-cal__e" style="--accent:var(--high)">Проверка</span><span class="dk-cal__e" style="--accent:var(--event)">Подвоз воды</span><span class="dk-cal__more"><b class="sc-callout">6</b>ещё 1</span></button>
        <button type="button" class="dk-cal__day"><span class="dk-cal__n">15</span></button></div></div>""",
    "anatomy": [("Переключатель вида", "сегмент «месяц / неделя»."),
                ("Название месяца", "с годом; стрелки листают."),
                ("Число дня", "кнопка-ячейка; дни соседних месяцев приглушены, но показаны — без них неделя рвётся."),
                ("Сегодня", "отмечено акцентом — единственное место акцента в календаре: ориентир во времени, не управление."),
                ("Событие", "полоска цвета вида через <code>--accent</code>; в недельном виде — блок по часам."),
                ("«Ещё N»", "больше трёх событий в дне; обрезать список молча значит скрыть часть работы.")],
    "sizes": "Размер один: виджет L на всю ширину. Сетка месяца всегда шесть строк, чтобы страница не прыгала при "
             "перелистывании; высота часа в неделе — <code>hourHeight</code>, по умолчанию 48.",
    "variants": [("view: 'month' | 'week'", "Начальный вид.", "Месяц для обзора, неделя для смены."),
                 ("month / week", "Какой месяц или неделю показать.", "По умолчанию текущие."),
                 ("events[]", "{date, name, kind, from?, to?}; kind: crit · high · plan · calm · event.", "Всегда."),
                 ("max", "Сколько событий в дне до «ещё N».", "По умолчанию 3."),
                 ("hourHeight", "Высота часа в неделе.", "Плотные смены.")],
    "states": """<div class="dk-widget"><div id="x-cal-empty"></div></div>
    <div class="sc-note"><b>Пустой месяц — тоже месяц.</b> Сетка на месте, событий нет, и это видно; «данных нет» календарь не пишет: отсутствие работ — ответ.</div>""",
    "content_ok": ["Название события — что делают: «Замена задвижки», «Подвоз воды».",
                   "Вид события по смыслу: авария crit, ограничение high, плановое plan, завершено calm, прочее event.",
                   "Дни соседних месяцев показаны приглушённо."],
    "content_bad": ["Цвета розданы по кругу — человек ищет закономерность там, где её нет.",
                    "Сетка в пять строк в короткий месяц — страница прыгает.",
                    "Событие без времени в недельном виде."],
    "a11y": ["<b>Клавиатура.</b> Дни — кнопки; стрелки, Home, End, PageUp, PageDown, Enter — как в таблице.",
             "<b>Не только цветом.</b> У события есть название; вид дублируется значком в подсказке.",
             "<b>Сегодня</b> помечено атрибутом и цветом.",
             "<b>Не проверялось</b> со скринридером в недельном виде по часам."],
    "tokens": ["dk-cal"],
    "code_intro": "Контейнер пустой; события — массив объектов.",
    "code": """<div id="cal"></div>

<script>
var cal = dkCalendar(document.getElementById('cal'), {
  view: 'month', month: '2026-09-01',
  events: [
    { date: '2026-09-14', name: 'Прорыв, Советский р-н', kind: 'crit' },
    { date: '2026-09-14', from: '08:00', to: '13:00', name: 'Плановое отключение ГВС', kind: 'plan' }
  ],
  onSelect: function (day) { },
  onEvent: function (e) { }
});
cal.view = 'week'; cal.goTo('2026-09-14'); cal.setEvents(list);
</script>""",
    "api": [("events[]", "массив", "date, name, kind; from/to для недели."),
            ("view, month, week, value, today", "строки / даты", "Что показать и что выбрано."),
            ("Размер при смене вида", "автоматически", "Месяц/неделя сохраняют рамку исходного вида. Содержимое прокручивается внутри; ширина окна остаётся адаптивной."),
            ("max, hourHeight", "числа", "Событий в дне до «ещё N»; высота часа."),
            ("onSelect(day) / onEvent(e)", "функции", "Клик по дню и по событию."),
            ("view / value / goTo(d) / setEvents(list)", "API", "Управление снаружи.")],
    "related": [("component-period.html", "Период", "выбор дат — не календарь работ"),
                ("component-list.html", "Список", "лента событий без сетки"),
                ("calendar.html", "Страница «Календарь»", "календарь в живом приложении")],
},
]

PAGES[-1]["live_script"] += """
  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkCalendar !== 'function') return;
    dkCalendar(document.getElementById('x-cal-empty'), { month: '2026-11-01', events: [] });
  });"""
