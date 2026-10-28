# Раскладка виджетов

Меняет порядок, ширину и видимость существующих виджетов.

## Когда использовать

- Пользователь организует рабочий обзор под собственную задачу.

## Когда выбрать другое

- Нужно редактировать содержание или создавать новые блоки: это не page builder.

## Контент: так

- Действия называют виджет: «Скрыть карту», «Переместить рейтинг выше».

## Контент: не так

- Скрытый виджет невозможно вернуть через редактор.

## Доступность

- Выше/Ниже, нативный select ширины, Показать/Скрыть и Сбросить работают клавиатурой и пальцем. Перемещается живой DOM, не копия. После действия восстанавливается фокус.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Пример

Переместите виджет, измените ширину и восстановите исходную раскладку.

## Структура

- **Контекст** — Меняет порядок, ширину и видимость зарегистрированных виджетов.
- **Данные и действие** — Живой пример показывает контракт подключения; демонстрационные данные не являются производственным срезом.

## Состояния

Ширины third/half/two-thirds/full, скрытые виджеты доступны через редактор. На телефоне одна колонка; сохраняется десктопная ширина. Storage version=1; неизвестные id игнорируются, новые виджеты дополняют сохранённую раскладку. Destroy убирает редактор, не сбрасывает раскладку.

## Варианты

- `dkLayoutEditor(el, opts)` — Основной контракт API/markup. При задаче, описанной выше.

## Размеры

Доступны ширины third, half, two-thirds и full. На телефоне виджеты становятся в одну колонку.

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

## С чем сочетать

- [Таблица](component-table.html) — точные числа
- [Подключение](README.md) — dk-theme первым, dk-util до компонента
