# Dashboard Kit на GitHub Pages

Статические страницы публикуются без сборки продукта и установки зависимостей.
Каталог, примеры, CSS/JS, шрифты, данные и документы сохраняют относительные пути.
В публикацию не входят Git, настройки AI Ops и служебные каталоги с точкой.

## Первый запуск

1. Влить PR с `.github/workflows/pages.yml` после ревью.
2. Открыть Settings → Pages репозитория и в Source выбрать **GitHub Actions**.
3. Открыть Actions → **Publish Dashboard Kit** → **Run workflow**, выбрать `main`.
4. Дождаться успешного шага Deploy to GitHub Pages. Адрес появится в результате
   deployment и в Settings → Pages.

Ожидаемый адрес: https://aleksandradovgopolova-boop.github.io/dashboard-kit/

- `index.html` — правила и компоненты.
- `showcase.html` — витрина.
- `dashboard.html` — пример дашборда.

## Обновления

Правки проходят через PR. После слияния запускать **Publish Dashboard Kit**
вручную на `main`. Публикация не запускается автоматически при слиянии или push.
Для повторной публикации не нужно запускать локальный сервер.

Workflow копирует только готовую статику в `_site` и передаёт её GitHub Pages.
Это упаковка файлов для хостинга, а не сборка продукта. Jekyll не используется;
Markdown остаётся доступен по исходным ссылкам `.md`.
