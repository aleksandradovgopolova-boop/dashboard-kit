# Чип

Отдельное выбранное значение: метка или применённый фильтр. Можно удалить из набора.

## Когда использовать

- Отдельное выбранное значение: метка или применённый фильтр. Можно удалить из набора.

## Когда выбрать другое

- Главное число дашборда — KPI-плитка.
- Состояние объекта — статус с текстовой подписью.

## Контент: так

- Одно выбранное значение: «Email» или «В работе».
- Подпись удаления включает значение чипа.

## Контент: не так

- Обрезанное название, которое нельзя восстановить.
- Чип выглядит как выбранный фильтр, но не влияет на данные.

## Доступность

- Удаление — настоящая кнопка с именем «Убрать фильтр Email», работает Enter и пробелом.
- После удаления фокус переходит на следующую кнопку удаления или контейнер набора.
- Для ввода или выбора набора используйте ChipsInput / ChipsSelect, где поведение уже реализовано.

## Размеры

Используйте размер существующего чипа-фильтра. Сенсорная область удаления расширяется до 44 пикселей; сохраняйте расстояние между целями.

## Код

```html
<div class="dk-panel"><div class="dk-stack"><div class="dk-inline" id="x-chip-demo"><span class="dk-fchip">Email<button type="button" class="dk-fchip__x" aria-label="Убрать фильтр Email"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></span><span class="dk-fchip">В работе<button type="button" class="dk-fchip__x" aria-label="Убрать фильтр В работе"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></span><span class="dk-fchip">Без удаления</span></div><p class="dk-hint" id="x-chip-status" role="status"></p></div></div>
<script>
document.getElementById('x-chip-demo').addEventListener('click', function(event) {
  var button = event.target.closest('.dk-fchip__x');
  if (!button) return;
  var group = button.closest('.dk-inline');
  var label = button.getAttribute('aria-label');
  button.parentElement.remove();
  var next = group.querySelector('button');
  if (next) next.focus(); else { group.setAttribute('tabindex', '-1'); group.focus(); }
  document.getElementById('x-chip-status').textContent = label + ': фильтр снят';
});
</script>
```

## Параметры

- `dk-fchip` (класс): Значение с необязательным удалением.
- `dk-chipbar` (класс): Строка применённых фильтров.
- `dk-chip` (класс): Число с подписью.
- `disabled` (HTML-атрибут кнопки): Удаление недоступно; без ложного клика.
