# Жесты

Начало, движение, завершение и отмена pointer-жеста для мыши, пера и тача.

## Когда использовать

- Движение указателя в собственном слайдере или области жестов.

## Когда выбрать другое

- Обычная кнопка — нативный click, с клавиатурой.
- Не заменяйте нативную прокрутку ленты перехватом жестов.

## Контент: так

- Полные названия объектов и конкретные действия.

## Контент: не так

- Непонятные подписи «Далее» для перехода к объектам без контекста.

## Доступность

- Жест не должен быть единственным способом выполнить действие: предусмотрите кнопки или клавиатуру.
- pointercancel обрабатывается отдельно от успешного завершения.
- Браузер сохраняет pan/zoom; helper не вызывает preventDefault.

## Размеры

Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до одинаковой высоты; текст не обрезается.

## Код

```html
<div class="dk-touch dk-touch--pan-y dk-panel" id="demo-touch" style="min-height:160px"><p>Проведите по этой области мышью или пальцем.</p><p class="dk-hint" id="demo-touch-status" role="status">Жестов пока нет</p></div>
<script>
window.addEventListener('DOMContentLoaded',function(){
 dkTouch('#demo-touch',{onEnd:function(data){document.getElementById('demo-touch-status').textContent=data.isSlide?'Сдвиг: '+Math.round(data.shiftX)+' × '+Math.round(data.shiftY)+' px':'Нажатие без перемещения';},onCancel:function(){document.getElementById('demo-touch-status').textContent='Жест отменён браузером';}});
});
</script>
```

## Параметры

- `dkTouch(root, options)` (функция): onStart, onMove, onEnd, onCancel; threshold по умолчанию 8 px.
- `payload` (объект): event, pointerType, startX/Y, shiftX/Y, duration, isSlide, isX/Y.
- `destroy()` (метод): Удаляет обработчики и освобождает pointer capture.
