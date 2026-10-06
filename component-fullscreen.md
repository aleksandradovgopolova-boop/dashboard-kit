# Полный экран

Временное увеличение виджета для чтения деталей.

## Когда использовать

- Много подписей или небольшая область графика.

## Когда выбрать другое

- Полный экран должен скрыть обязательные сравнения: расширьте раскладку вместо него.

## Контент: так

- Много подписей или небольшая область графика.
- Показывайте полные названия, единицы и источник данных.

## Контент: не так

- Полный экран должен скрыть обязательные сравнения: расширьте раскладку вместо него.
- Не выдавайте отсутствие наблюдений за ноль и не используйте цвет как единственное объяснение.

## Доступность

- Escape, кнопка выхода и восстановление фокуса. Fallback удерживает Tab. DOM-узел переносится, не клонируется; обработчики и данные остаются.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Размеры

Компонент следует ширине контейнера и системным токенам. Escape, кнопка выхода и восстановление фокуса. Fallback удерживает Tab. DOM-узел переносится, не клонируется; обработчики и данные остаются.

## Код

```html
<button type="button" class="dk-btn" id="advanced-fullscreen-button">Полный экран</button><section class="dk-widget" id="advanced-fullscreen" aria-label="Доступность"><h3>Доступность</h3><p>99,8% за сутки</p><button type="button" class="dk-btn" id="advanced-fullscreen-exit">Закрыть полный экран</button></section>
<script>
document.addEventListener("DOMContentLoaded", function(){
var fullscreen=dkFullscreen(document.getElementById('advanced-fullscreen'),document.getElementById('advanced-fullscreen-button')); document.getElementById('advanced-fullscreen-exit').addEventListener('click',function(){fullscreen.exit();});
});
</script>
```

## Параметры

- `dkFullscreen(widget, button)` (API): enter()/exit(): Promise, destroy(). Нативный API или modal fallback.
