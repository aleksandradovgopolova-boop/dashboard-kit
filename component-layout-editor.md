# Раскладка виджетов

Меняет порядок, ширину и видимость зарегистрированных виджетов.

## Когда использовать

- Пользователь организует рабочий обзор под собственную задачу.

## Когда выбрать другое

- Нужно редактировать содержание или создавать новые блоки: это не page builder.

## Контент: так

- Пользователь организует рабочий обзор под собственную задачу.
- Показывайте полные названия, единицы и источник данных.

## Контент: не так

- Нужно редактировать содержание или создавать новые блоки: это не page builder.
- Не выдавайте отсутствие наблюдений за ноль и не используйте цвет как единственное объяснение.

## Доступность

- Выше/Ниже, нативный select ширины, Показать/Скрыть и Сбросить работают клавиатурой и пальцем. Перемещается живой DOM, не копия. После действия восстанавливается фокус.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Размеры

Компонент следует ширине контейнера и системным токенам. Выше/Ниже, нативный select ширины, Показать/Скрыть и Сбросить работают клавиатурой и пальцем. Перемещается живой DOM, не копия. После действия восстанавливается фокус.

## Код

```html
<div id="advanced-editor"></div><div class="dk-grid" id="advanced-layout"><section class="dk-col--half dk-widget" data-widget-id="risk" data-widget-label="Риск"><h3>Риск</h3><p>23 региона</p></section><section class="dk-col--half dk-widget" data-widget-id="uptime" data-widget-label="Доступность"><h3>Доступность</h3><p>99,8%</p></section></div>
<script>
document.addEventListener("DOMContentLoaded", function(){
dkLayoutEditor(document.getElementById('advanced-editor'), {container:document.getElementById('advanced-layout'),key:'dk-demo-layout'});
});
</script>
```

## Параметры

- `dkLayoutEditor(el, opts)` (API): container с детьми data-widget-id, key?/storage?/onChange. get(), update(layout), reset(), destroy(). layout:{id,span,hidden}[].
