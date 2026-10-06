# Удержание фокуса

Tab и Shift+Tab циклически обходят интерактивные элементы открытого слоя.

## Когда использовать

- Собственный всплывающий слой, где фокус должен оставаться до закрытия.

## Когда выбрать другое

- Не удерживайте фокус в обычной карточке или меню страницы.
- Нативный dialog.showModal уже исключает фон; helper дополняет цикл, но не заменяет inert.

## Контент: так

- Полные названия объектов и конкретные действия.

## Контент: не так

- Непонятные подписи «Далее» для перехода к объектам без контекста.

## Доступность

- Закрытие доступно кнопкой и Escape; фокус возвращается к запуску.
- Заголовок окна связан через aria-labelledby. Фон исключается нативным showModal.
- Не выдавайте один цикл Tab за полноценную модальность или недоступность фона.

## Размеры

Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до одинаковой высоты; текст не обрезается.

## Код

```html
<button class="dk-btn dk-btn--sm" id="demo-trap-start">Проверить фокус</button><dialog class="dk-modal dk-popout" id="demo-trap" aria-labelledby="demo-trap-title"><div class="dk-modal__head"><h2 class="dk-modal__title" id="demo-trap-title">Проверка фокуса</h2></div><div class="dk-modal__body"><p>Tab и Shift+Tab остаются внутри. Escape закрывает окно.</p><button class="dk-btn dk-btn--sm">Первое действие</button><button class="dk-btn dk-btn--sm">Второе действие</button></div><form method="dialog" class="dk-modal__foot"><button class="dk-btn dk-btn--sm">Закрыть</button></form></dialog>
<script>
window.addEventListener('DOMContentLoaded',function(){
 var button=document.getElementById('demo-trap-start'),dialog=document.getElementById('demo-trap'),trap;
 button.addEventListener('click',function(){dialog.showModal();trap=dkFocusTrap(dialog,{onEscape:function(){dialog.close();}});});
 dialog.addEventListener('close',function(){if(trap){trap.destroy();trap=null;}button.focus();});
});
</script>
```

## Параметры

- `dkFocusTrap(root, options)` (функция): Устанавливает цикл фокуса.
- `destroy()` (метод): Снимает обработчики и возвращает предыдущий фокус.
- `onEscape` (функция): Обязательный путь закрытия для собственного слоя.
