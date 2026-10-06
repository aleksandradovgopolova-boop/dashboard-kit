# Сохранённые виды

Возвращает локальный рабочий срез со всеми согласованными параметрами.

## Когда использовать

- Пользователь регулярно возвращается к одним фильтрам и периодам.

## Когда выбрать другое

- Нужны общие виды команды: локальное хранилище не является синхронизацией.

## Контент: так

- Пользователь регулярно возвращается к одним фильтрам и периодам.
- Показывайте полные названия, единицы и источник данных.

## Контент: не так

- Нужны общие виды команды: локальное хранилище не является синхронизацией.
- Не выдавайте отсутствие наблюдений за ноль и не используйте цвет как единственное объяснение.

## Доступность

- Названия и действия видимы, status сообщает ошибки хранения. После действий фокус остаётся в контексте. Переименование использует поле Название вида.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Размеры

Компонент следует ширине контейнера и системным токенам. Названия и действия видимы, status сообщает ошибки хранения. После действий фокус остаётся в контексте. Переименование использует поле Название вида.

## Код

```html
<div id="advanced-state"></div><div id="advanced-views"></div>
<script>
document.addEventListener("DOMContentLoaded", function(){
var state=dkState(document.getElementById('advanced-state'), {filters:{service:'heat'},period:'14d'});dkSavedViews(document.getElementById('advanced-views'), {key:'dk-demo-views',state:state});
});
</script>
```

## Параметры

- `dkState(el, initial)` (API): get(), update(patch), destroy(); dk:statechange содержит snapshot. filters, period, sort, page, size, mode, density.
- `dkSavedViews(el, opts)` (API): key/state обязательны, storage?, applyDefault?. create(name), rename(id,name), apply(id), remove(id), setDefault(id|null), list(), destroy().
