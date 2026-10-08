# MCP и интеграция с ii-sreda

Первый этап — read-only сервер каталога. Он использует `tools/kit.py`,
сверяет актуальность манифеста и не изменяет страницы или данные.
Предупреждение об устаревшем манифесте уходит в stderr; автоматической
пересборки нет. Сервер не размещает файлы CSS/JS.

## Запуск

Отдельное окружение, Python 3.10+:

```sh
python3 -m venv /tmp/dashboard-kit-mcp
/tmp/dashboard-kit-mcp/bin/pip install -r tools/mcp-requirements.txt
/tmp/dashboard-kit-mcp/bin/python tools/mcp_server.py
```

Для MCP-хоста: command — абсолютный путь к Python окружения, args —
абсолютный путь к `tools/mcp_server.py`. Рабочая папка не важна.

Для локальной проверки HTTP:

```sh
/tmp/dashboard-kit-mcp/bin/python tools/mcp_server.py --transport streamable-http
```

Адрес: `http://127.0.0.1:8767/mcp`. Публичная публикация и авторизация не
реализованы; это локальный прототип. Официальный Python SDK v1.x — отдельная
необязательная зависимость инструмента, не статического продукта.

## Контракт

- `list_components()` — каталог.
- `get_component(components)` — API, классы, примеры, ограничения.
- `search_components(query)` — поиск.
- `get_chart_guidance()` — выбор графика и пробелы кита.
- `get_includes(components, embed=false)` — подключение; пути относительно кита.
- Ресурс `dashboard-kit://build-guide` — процесс сборки.
- Ресурсы `dashboard-kit://references/{name}` — справки: charts, data, layout,
  phone, chrome, checks, accessibility, product-review, extensions, uiux.

## Следующий этап в ii-sreda

Исследована `origin/main` на `4435236d` (08.10.2026). ADR-118 сохраняет
вычисление показателей по записям в коде; модель пишет выводы по рассчитанным
фактам. Не заменять это генерацией произвольного HTML или чисел моделью.

Нужен адаптер существующего DashboardContent к компонентам кита с фиксированной
версией локальных ресурсов. Сначала один экран: KPI, график, таблица, фильтр.
Проверить реальные вычисления, фильтрацию, темы, повторное открытие и экспорт.
Сохранить текущий рендер как совместимый путь для старых материалов.

ADR-075 ii-sreda предусматривает MCP-схемы для внутренних функций и внешний
Streamable HTTP через backend. Для встроенного каталога сетевой MCP не обязателен;
этот сервер нужен также отдельным потребителям. Рендер реализован отдельной веткой ii-sreda за флагом VITE_DASHBOARD_KIT;
сетевое подключение MCP к агенту продукта пока не реализовано.

## Проверка

```sh
/tmp/dashboard-kit-mcp/bin/python tools/check-mcp.py
python3 tools/check.py --fast
```

Первый прогон проверяет настоящий stdio handshake, инструменты, ресурсы,
ошибки и порядок подключений. Он не заменяет браузерную проверку дашборда.

Проверено 08.10.2026: stdio smoke, HTTP handshake/discovery/get_includes,
полная tools/check.py (62 страницы, три размера). Протокольный stdio smoke
включён в dashboard-check CI. SDK: https://py.sdk.modelcontextprotocol.io/v1/.
