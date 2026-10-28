# Полный экран

Временно увеличивает виджет, чтобы рассмотреть детали.

## Когда использовать

- Много подписей или небольшая область графика.

## Когда выбрать другое

- Полный экран должен скрыть обязательные сравнения: расширьте раскладку вместо него.

## Контент: так

- «Развернуть график» и «Выйти из полного экрана».

## Контент: не так

- Одинаковое «Открыть» для увеличения и перехода на другую страницу.

## Доступность

- Escape, кнопка выхода и восстановление фокуса. Fallback удерживает Tab. DOM-узел переносится, не клонируется; обработчики и данные остаются.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Пример

Разверните пример и выйдите через кнопку или Escape. После выхода сохраняется контекст.

## Структура

- **Контекст** — Временное увеличение виджета для чтения деталей.
- **Данные и действие** — Живой пример показывает контракт подключения; демонстрационные данные не являются производственным срезом.

## Состояния

Обычный/нативный/fallback. iOS и WebView могут запрещать fullscreen: fallback использует dialog. Нужно отдельное действие выхода внутри виджета. Разрешение браузера нельзя обещать.

## Варианты

- `dkFullscreen(widget, button)` — Основной контракт API/markup. При задаче, описанной выше.

## Размеры

Открытый виджет занимает доступное окно. После закрытия возвращается в исходную раскладку.

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

## С чем сочетать

- [Таблица](component-table.html) — точные числа
- [Подключение](README.md) — dk-theme первым, dk-util до компонента
