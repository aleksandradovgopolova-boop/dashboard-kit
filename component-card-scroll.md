# Лента карточек

Горизонтальный список карточек с нативной прокруткой и кнопками навигации.

## Когда использовать

- Последовательность отчётов, материалов или историй.
- На телефоне виден край следующей карточки.

## Когда выбрать другое

- Основные KPI должны быть видны одновременно — CardGrid.
- Не включайте автоматическое перелистывание.

## Контент: так

- Полные названия объектов и конкретные действия.

## Контент: не так

- Непонятные подписи «Далее» для перехода к объектам без контекста.

## Доступность

- Список ul/li, кнопки со смысловыми aria-label.
- Tab достигает карточек; стрелки показывают недоступность направления через disabled.
- Нативная прокрутка и prefers-reduced-motion сохранены; автоматического перелистывания нет.
- RTL: направление перемещения учитывает direction списка.

## Размеры

Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до одинаковой высоты; текст не обрезается.

## Код

```html
<div class="dk-card-scroll" id="demo-cards"><div class="dk-card-scroll__actions"><button class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" data-scroll-prev aria-label="Предыдущие отчёты"><svg class="dk-i dk-i--adaptive" aria-hidden="true"><use href="#ti-chevron-left"/></svg></button><button class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" data-scroll-next aria-label="Следующие отчёты"><svg class="dk-i dk-i--adaptive" aria-hidden="true"><use href="#ti-chevron-right"/></svg></button></div><ul class="dk-card-scroll__list" tabindex="0" aria-label="Отчёты"><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 1</h3><p>Продажи по каналам.</p><a class="dk-btn dk-btn--sm" href="component-table.html">Открыть пример таблицы</a></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 2</h3><p>Продажи по каналам и категориям товаров.</p><a class="dk-btn dk-btn--sm" href="component-table.html">Открыть пример таблицы</a></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 3</h3><p>Продажи по каналам.</p><a class="dk-btn dk-btn--sm" href="component-table.html">Открыть пример таблицы</a></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 4</h3><p>Продажи по каналам и категориям товаров.</p><a class="dk-btn dk-btn--sm" href="component-table.html">Открыть пример таблицы</a></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 5</h3><p>Продажи по каналам.</p><a class="dk-btn dk-btn--sm" href="component-table.html">Открыть пример таблицы</a></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 6</h3><p>Продажи по каналам и категориям товаров.</p><a class="dk-btn dk-btn--sm" href="component-table.html">Открыть пример таблицы</a></div></li></ul></div>
<script>
window.addEventListener('DOMContentLoaded',function(){dkCardScroll('#demo-cards');});
</script>
```

## Параметры

- `dkCardScroll(root)` (функция): Подключает стрелки и обновляет доступность на границах.
- `refresh() / destroy()` (методы): Обновить границы / удалить обработчики и наблюдателей.
- `--card-width` (переменная в style): Ширина карточки, по умолчанию 260 px; ограничена 80% списка.
