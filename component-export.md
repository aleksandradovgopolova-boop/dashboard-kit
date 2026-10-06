# Экспорт среза

Локально сохраняет текущие строки таблицы или изображение графика.

## Когда использовать

- Нужно передать текущий filtered dataset или сохранить график.

## Когда выбрать другое

- Экспорт всего серверного набора: нужен отдельный серверный контракт.

## Контент: так

- Нужно передать текущий filtered dataset или сохранить график.
- Показывайте полные названия, единицы и источник данных.

## Контент: не так

- Экспорт всего серверного набора: нужен отдельный серверный контракт.
- Не выдавайте отсутствие наблюдений за ноль и не используйте цвет как единственное объяснение.

## Доступность

- Нативная кнопка с ясным названием формата. Экспорт не требует сервера; файл создаётся браузером. Об успешном скачивании ОС API не сообщает.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Размеры

Компонент следует ширине контейнера и системным токенам. Нативная кнопка с ясным названием формата. Экспорт не требует сервера; файл создаётся браузером. Об успешном скачивании ОС API не сообщает.

## Код

```html
<div class="dk-export"><button type="button" class="dk-btn" id="advanced-export">CSV текущего среза</button><p role="status" id="advanced-export-status"></p></div>
<script>
document.addEventListener("DOMContentLoaded", function(){
document.getElementById('advanced-export').addEventListener('click',function(){dkExport.csv([{region:'Ивановская область',risk:92}], [{key:'region',label:'Регион'},{key:'risk',label:'Риск'}], 'regions-filtered');document.getElementById('advanced-export-status').textContent='CSV подготовлен браузером';});
});
</script>
```

## Параметры

- `dkExport.csv(rows, columns, name?)` (Blob): UTF-8 BOM, CRLF, quotes; formula-like strings prefixed with apostrophe. Передавайте текущий срез, не исходные строки.
- `dkExport.chart(chart, name?)` (Promise<Blob>): PNG через dkChart.exportImage(). SVG только из переданного самодостаточного DOM SVG: dkExport.svg(svg,name?).
