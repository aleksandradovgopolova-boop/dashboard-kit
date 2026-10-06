# Контекст, сравнение и персонализация

Сначала `kit.py list`, затем `show` и `head` нужных частей. Новые части:
breadcrumbs, tooltip, details-sidebar, heatmap, bullet-chart, period-comparison,
timeline-annotations, fullscreen, export, density-controls, tree-select,
saved-views, layout-editor. Подробные API, markup и ограничения — в описи и
component pages; не собирай их по памяти.

- Иерархия пути — breadcrumbs; детали объекта — вариант существующего modal
  `dk-sidebar`. Tooltip содержит только короткий текст, обязательные инструкции
  видимы постоянно. Dialog без showModal не считается поддержанным.
- Heatmap — риск по объектам/интервалам с таблицей и уровнями I–IV; thresholds
  должны быть объяснены. Категориальная принадлежность — прежняя палитра серий.
- Bullet — факт/цель/диапазоны, не временной тренд. Annotations — отдельная
  шкала со списком событий, по строке на подпись; не calendar.
- Comparison — `better:'increase'/'decrease'/'neutral'`; не угадывай смысл
  знака. Previous=0 не даёт процент. Несопоставимые периоды сначала нормализуй.
- `dkState` хранит snapshot, но не агрегирует данные. Host подписывается на
  `dk:statechange` и восстанавливает прежние контролы через update/set, таблицу,
  карту и графики из одного источника. Snapshot может записываться в URL через
  третий параметр `{url:'view'}`; не включай чувствительные значения в адрес.
- Saved views — локально, format v1; v0 мигрирует. Storage отказ сообщается,
  работа остаётся в памяти. Layout editor переставляет зарегистрированные
  widgets, не создаёт содержание. Mobile — одна колонка и кнопки вместо drag.
- Export получает именно текущие filtered rows. PNG — canvas-график, SVG —
  самодостаточный DOM SVG без внешних ресурсов; CSV защищает формульные строки.
- Fullscreen обязательно имеет выход внутри; native отказ приводит к dialog.
  Density не уменьшает текст и цели на coarse pointer. Tree select — до 1000
  узлов без виртуализации; большие справочники сначала сужай.

Проверка всей библиотеки: `python3 tools/test.py`; страницы продукта:
`python3 tools/check.py --page …`. Evals дополнены шестью сценариями;
`check-evals.py` проверяет SDK fixtures/покрытие, не качество независимого агента.

У DOM charts (`dkHeatmap`, `dkBullet`, `dkPeriodComparison`,
`dkTimelineAnnotations`) `update(opts)` заменяет весь набор параметров.
Для annotations каждый раз передавай start/end, даже если events пуст.
Escape в подсказке внутри dialog сначала закрывает подсказку.
