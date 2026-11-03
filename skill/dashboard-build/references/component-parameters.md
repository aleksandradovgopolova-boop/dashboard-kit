# Параметры статического screen-spec

СОБРАНО tools/build-manifest.py из tools/component_contracts.py. Руками не править.

Версия 1. Это минимальный декларативный адаптер screen-spec, а не полный JS API компонентов.
Проверка: kit.py schema <id>; kit.py validate <id> '<JSON>'. Привязки к данным дополнительно проверяет сборщик экрана.

## tile

Зависимости: dashboard-data, named-metrics
Действия: нет

| Параметр | Тип | Обязательный | По умолчанию / варианты |
|---|---|---|---|
| metric | string | да |  |

## chart

Зависимости: dashboard-data
Действия: toggle-series

| Параметр | Тип | Обязательный | По умолчанию / варианты |
|---|---|---|---|
| title | string | да |  |
| type | string | да | bar, line |
| orientation | string | нет | default="vertical"; vertical, horizontal |
| metrics | array | да |  |
| groupBy | string | нет | default="date"; date |

line требует orientation=vertical; bar/horizontal собирается существующим bar-h.

## table

Зависимости: dashboard-data, named-metrics, modal
Действия: sort, open-details

| Параметр | Тип | Обязательный | По умолчанию / варианты |
|---|---|---|---|
| title | string | да |  |
| dimension | string | да |  |
| metrics | array | да |  |
| details | boolean | нет | default=false;  |
| sort | string | нет | default="asc"; asc, desc |

## select

Зависимости: dashboard-data
Действия: change-filter

| Параметр | Тип | Обязательный | По умолчанию / варианты |
|---|---|---|---|
| dimension | string | да |  |
| label | string | да |  |
| mode | string | нет | default="single"; single |
