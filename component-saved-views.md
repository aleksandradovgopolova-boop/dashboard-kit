# Сохранённые виды

Сохраняет рабочий срез в этом браузере и позволяет к нему вернуться.

## Когда использовать

- Нужно возвращаться к одним фильтрам, периодам и настройкам обзора.

## Когда выбрать другое

- Общие виды команды требуют серверного хранения и прав доступа; локальное сохранение этого не даёт.

## Контент: так

- Название по задаче: «Просроченные работы за неделю».

## Контент: не так

- Обещание общего доступа команды к виду, сохранённому только в браузере.

## Доступность

- Названия и действия видимы, status сообщает ошибки хранения. После действий фокус остаётся в контексте. Переименование использует поле Название вида.
- Dark/light берутся из ближайшего dk-root; reduced motion не требует анимации. Проверки DOM/клавиатуры не заменяют живой скринридер или физический телефон.

## Пример

Выберите службу и период, сохраните вид, затем измените выбор и примените сохранённый. Параметры восстановятся. Вид хранится только в этом браузере.

## Структура

- **Контекст** — Сохраняет рабочий срез в этом браузере и позволяет к нему вернуться.
- **Данные и действие** — Живой пример показывает контракт подключения; демонстрационные данные не являются производственным срезом.

## Состояния

Вид можно сохранить, применить, переименовать и удалить. Ошибка сохранения сообщается рядом. Ограничения и подключение Формат version=1, v0 views мигрирует; неизвестная версия не применяется. Storage отказ сохраняет работу в памяти. Состояние отделено от компонентов: host подписывается на dk:statechange и обновляет фильтры/период/таблицу/карту.

## Варианты

- `dkState(el, initial)` — Разметка и параметры компонента. При задаче, описанной выше.

## Размеры

Список и действия используют ширину контейнера. Длинное название вида не должно скрывать действия.

## Код

```html
<div id="advanced-state"><div class="dk-form"><div class="dk-ff"><label class="dk-label" for="view-service">Служба</label><div class="dk-field"><select id="view-service"><option value="heat">Теплоснабжение</option><option value="water">Водоснабжение</option></select></div></div><div class="dk-ff"><label class="dk-label" for="view-period">Период</label><div class="dk-field"><select id="view-period"><option value="14d">14 дней</option><option value="30d">30 дней</option></select></div></div></div></div><div id="advanced-views"></div>
<script>
document.addEventListener("DOMContentLoaded", function(){
var stateHost=document.getElementById('advanced-state');
var service=document.getElementById('view-service'), period=document.getElementById('view-period');
var state=dkState(stateHost,{filters:{service:'heat'},period:'14d'});
function changeView(){state.update({filters:{service:service.value},period:period.value});}
service.addEventListener('change',changeView);period.addEventListener('change',changeView);
stateHost.addEventListener('dk:statechange',function(event){service.value=event.detail.filters.service;period.value=event.detail.period;});
dkSavedViews(document.getElementById('advanced-views'),{key:'dk-demo-views',state:state});
});
</script>
```

## Параметры

- `dkState(el, initial)` (API): get(), update(patch), destroy(); dk:statechange содержит snapshot. filters, period, sort, page, size, mode, density.
- `dkSavedViews(el, opts)` (API): key/state обязательны, storage?, applyDefault?. create(name), rename(id,name), apply(id), remove(id), setDefault(id|null), list(), destroy().

## С чем сочетать

- [Таблица](component-table.html) — точные числа
- [Подключение](README.md) — dk-theme первым, dk-util до компонента
