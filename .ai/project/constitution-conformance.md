# Соответствие Архитектурной конституции

> Нашлось 19 расхождений с конституцией по 3 статьям — это рекомендации к рассмотрению, не блок.

Проверено: весь код репозитория. Это **рекомендации** — что стоит рассмотреть, а не блок на мерже. У каждого пункта — статья конституции, к которой он относится.

## ARCH-006 · Нет god-модуля и монолита (2)

**Рекомендация.** Крупный модуль обычно владеет слишком многим (нарушен SRP). Рассмотрите разрез по ответственности на меньшие связные модули.

Где посмотреть:
- `tools/check.py`
- `tools/component_pages/p3_data.py`

## CODE-001 · Функции короткие и односмысловые (11)

**Рекомендация.** Длинные функции трудно читать и тестировать. Рассмотрите разбиение на меньшие односмысловые функции.

Где посмотреть:
- `tools/build-chart-theme.py:35:build`
- `tools/build-component-pages.py:61:render`
- `tools/build-echarts.py:108:main`
- `tools/check.py:337:check_unknown`
- `tools/check.py:1319:check_engine`
- `tools/check.py:1623:check_quiet`
- `tools/check.py:1818:check_manifest`
- `tools/check.py:2044:check_classes`
- `tools/check.py:2151:check_app_icons`
- `tools/check.py:2314:check_page`
- …ещё 1

## CODE-002 · Плоский поток — ранние возвраты (6)

**Рекомендация.** Глубокая вложенность прячет ветки и краевые случаи. Уплощите ранними возвратами и guard-clause, вынесите ветки в именованные хелперы.

Где посмотреть:
- `tools/check.py:337:check_unknown`
- `tools/check.py:534:check_accent_role`
- `tools/check.py:809:check_palette`
- `tools/check.py:865:check_hover`
- `tools/check.py:1818:check_manifest`
- `tools/check.py:2107:_png_info`
