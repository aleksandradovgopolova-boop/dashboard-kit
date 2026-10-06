# Выбор в иерархии

Выбирает группы и дочерние объекты в небольшом справочнике.

## Когда использовать

- Выбор связан с реальной иерархией служб/территорий.

## Когда выбрать другое

- Плоский справочник: используйте select или ChipsSelect.

## Контент: так

- Выбор связан с реальной иерархией служб/территорий.
- Показывайте полные названия, единицы и источник данных.

## Контент: не так

- Плоский справочник: используйте select или ChipsSelect.
- Не выдавайте отсутствие наблюдений за ноль и не используйте цвет как единственное объяснение.

## Доступность

- Tree/Treeitem, aria-level/posinset/setsize, aria-checked mixed. Стрелки/Home/End перемещают, Right/Left раскрывают/сворачивают, Space/Enter выбирают. Поиск сохраняет поле и контекст родителей.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Размеры

Компонент следует ширине контейнера и системным токенам. Tree/Treeitem, aria-level/posinset/setsize, aria-checked mixed. Стрелки/Home/End перемещают, Right/Left раскрывают/сворачивают, Space/Enter выбирают. Поиск сохраняет поле и контекст родителей.

## Код

```html
<div id="advanced-tree"></div>
<script>
document.addEventListener("DOMContentLoaded", function(){
dkTreeSelect(document.getElementById('advanced-tree'), {label:'Службы',nodes:[{id:'all',label:'Все службы',children:[{id:'heat',label:'Тепло'},{id:'water',label:'Вода'}]}]});
});
</script>
```

## Параметры

- `dkTreeSelect(el, opts)` (API): nodes:{id,label,disabled?,children?}[], value: id[], onChange(ids). value(), expand(id), update({value}), destroy().
