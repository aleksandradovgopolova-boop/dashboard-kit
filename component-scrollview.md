# Прокручиваемая область

Ограничивает высоту длинной области и оставляет её содержимое доступным через прокрутку.

## Когда использовать

- Список в боковой панели или модальном окне с ограниченной высотой.
- Широкое содержимое требует горизонтального просмотра.

## Когда выбрать другое

- Обычная статья — прокручивайте страницу целиком.
- Сжимать основные показатели в прокручиваемые карточки ради первого экрана.

## Контент: так

- Понятное имя области: «Список отчётов».
- Полоса видна по правилам системы; содержимое не обрезается по ширине.

## Контент: не так

- Скрытая полоса без признаков продолжения содержимого.
- Перехват wheel/touch или ловушка клавиатурного фокуса.

## Доступность

- tabindex="0" позволяет прокручивать область стрелками и PageDown; Tab выводит фокус наружу.
- Система может скрывать полосу до прокрутки. CSS не отменяет предпочтения пользователя.
- Плавная прокрутка отключается при prefers-reduced-motion.
- В forced-colors сохраняется системная полоса; не назначайте роль scrollbar обычному контейнеру.

## Пример

Прокрутите область до конца. Короткое содержимое не должно создавать лишнюю полосу прокрутки.

## Структура

- **Контейнер** — Ограниченная высота, фокусируемая именованная область.
- **Полоса** — Нативная: системное поведение и управление клавиатурой сохраняются.

## Состояния

Один отчёт — прокрутка не нужна.

## Варианты

- `dk-scrollview` — Вертикальная и горизонтальная прокрутка при переполнении. По умолчанию.
- `dk-scrollview--horizontal` — Только горизонтальная. Широкий ряд.
- `dk-scrollview--contain` — Не передаёт прокрутку родителю на границе. Панель или модальное окно.
- `dk-scrollview--smooth` — Плавная программная прокрутка. Не влияет на обычную прокрутку колесом.
- `dk-scrollview--hidden-bar` — Скрывает полосу. Только при наличии другого явного способа навигации.

## Размеры

Максимальная высота по умолчанию 320 px. Параметр --scrollview-height меняет ограничение. Без переполнения прокрутки нет.

## Код

```html
<div class="dk-scrollview" tabindex="0" role="region" aria-label="Список отчётов" style="--scrollview-height:200px"><div class="dk-row"><span class="dk-row__label">Отчёт 1</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 2</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 3</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 4</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 5</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 6</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 7</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 8</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 9</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 10</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 11</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт 12</span><span class="dk-row__value">Готов</span></div></div>
```

## Параметры

- `--scrollview-height` (переменная в style): Ограничение высоты, по умолчанию 320px.
- `scroll` (DOM-событие): Стандартный addEventListener; никаких особых API.
- `scrollTo` (DOM-метод): Нативная программная прокрутка.

## С чем сочетать

- [Таблица](component-table.html) — Для таблиц есть dk-tablewrap
- [Референс VKUI](https://vkui.io/components/custom-scroll-view/) — Нативная оформленная прокрутка
