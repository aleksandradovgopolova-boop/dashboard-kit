# React-интеграция dashboard-kit

Ядро остаётся статическим. `integrations/react/index.tsx` — необязательный
адаптер для React-приложения: скопируйте его в исходники приложения. React и
React DOM предоставляет приложение; второй экземпляр React не подключается.
Сборка Vite/TypeScript выполняется в приложении, а не в ядре кита.

## Что реализовано

- `useKitComponent(create, options)` создаёт компонент в отдельном DOM-узле,
  обновляет через `update`, синхронно вызывает `destroy` и удаляет узел при
  размонтировании. React владеет внешним пустым контейнером, кит — внутренним.
- `KitRoot` задаёт локальную тему через `data-theme` и не меняет тему страницы.
  Несколько дашбордов могут иметь разные темы.
- `useDashboardSession(create, query)` подключает контракт `dkDashboard` к
  React. Сессия создаётся только в эффекте; при размонтировании удаляется
  подписка и вызывается `destroy`, отменяющий запрос. Ответы прежних запросов
  отбрасывает сам контроллер данных. Доступны snapshot и retry.
- Повторный монтаж эффектов в StrictMode создаёт новый экземпляр, а не
  возвращает уже уничтоженный. Во время render внешние ресурсы не создаются.

## Компонент в React

Загрузите ресурсы кита заранее, затем используйте адаптер. Стабилизируйте
фабрику через `useMemo` или определите вне компонента; иначе каждый render
будет намеренно пересоздавать контроллер. Для callbacks используйте ref,
обновляемый эффектом, чтобы замыкание не удерживало старое состояние.

```jsx
import { useMemo } from 'react';
import { KitRoot, useKitComponent } from './dashboard-kit/react';

function Chart({runtime, spec}) {
  const create = useMemo(() => (node, initial) => {
    node.className = "dk-chart";
    return runtime.dkChart(node, initial);
  }, [runtime]);
  const host = useKitComponent(create, spec);
  return <div ref={host} />;
}

function Dashboard({runtime, spec, theme}) {
  return <KitRoot theme={theme}>
    <section className="dk-widget">
      <header className="dk-widget__head">
        <h2 className="dk-widget__title">Динамика обращений</h2>
      </header>
      <Chart runtime={runtime} spec={spec} />
    </section>
  </KitRoot>;
}
```

React не рендерит детей в контейнер, который изменяет кит. У фабрики обязательны
`update` и `destroy`; несовместимые или старые API оборачиваются явно. Если
фабрика может бросить исключение после создания ресурсов, она должна сама
освободить частично созданные ресурсы; ошибку отображает ErrorBoundary приложения.

## Данные

```jsx
const create = useMemo(() => () => runtime.dkDashboard.createSession({
  mode: 'server', load: loadSlice, timeoutMs: 15000,
}), [runtime, loadSlice]);
const query = useMemo(() => ({filters, period, page, pageSize: 20}),
  [filters, period, page]);
const {snapshot, retry} = useDashboardSession(create, query);
```

До выполнения эффекта snapshot равен null. Далее используются состояния
idle/loading/ready/empty/error. Смена фильтров и периода должна сбрасывать
page в 1. `loadSlice` получает `{query, signal}` и передаёт signal в fetch.
Функция и query должны иметь стабильную идентичность, пока их смысл не меняется.
Не мутируйте query на месте. Смена фабрики отменяет старую сессию.

Не подключайте второй независимый state поверх существующих расчётов продукта.
В ИИ-среде `DashboardContent`, `applyFilters`, `computeKpi`, `computeSeries` и
`computeTable` уже определяют данные. Подготовленный патч сохраняет их и
обратный вызов фильтра для экспорта. `useDashboardSession` предназначен для
новых потребителей контракта, а не меняет автоматически формат ИИ-среды.

## Ресурсы и тема

В приложении используйте закреплённый локальный снимок ресурсов и порядок из
манифеста: primitives → semantic → components; dk-util до компонентов.
Для самостоятельной HTML-страницы dk-theme подключается первым. Для
встраивания тема принадлежит приложению: dk-theme не запускается, вместо
него приложение передаёт тему в KitRoot (решение ADR-152 ИИ-среды).
Графики отслеживают изменения локального data-theme через свой контроллер.
Сам адаптер не скачивает скрипты, не подменяет палитру приложения и не
переключает глобальный CSS. Материал glass подключается отдельно со своей
структурой контейнеров; наличие KitRoot само по себе не включает стекло.

## ИИ-среда: подготовленный патч

`integrations/ii-sreda/react-lifecycle.patch` продолжает существующую
интеграцию в рабочей копии `ii-sreda-dashboard-kit`, а не создаёт другой рендер.
Изменения: React-адаптер, явное уничтожение фильтра, обновление значений и
вариантов без пересоздания, локальный корень темы, типы контроллеров и тесты.
Флаг `VITE_DASHBOARD_KIT` остаётся выключенным по умолчанию. Существующие
графики уже уничтожались явно; их поведение и расчёты не меняются.

Применять только к ветке с ADR-152 и `DashboardKitView`, через отдельный PR:

```sh
git apply --check /path/to/dashboard-kit/integrations/ii-sreda/react-lifecycle.patch
git apply /path/to/dashboard-kit/integrations/ii-sreda/react-lifecycle.patch
```

Патч не включает обновление закреплённого снимка из незакоммиченного рабочего
дерева. После выпуска кита обновление выполняется существующим
`scripts/vendor-dashboard-kit.py <repository> <revision>`, с сохранением
SHA-256 и лицензий. В основной доступной копии `ii-sreda` этот рендер не найден;
слияние ветки и включение в продукте не выполнены.

## Проверки и границы

```sh
python3 tools/check-react.py --dependencies /path/to/application/node_modules
```

Команда использует существующие React, React DOM, TypeScript, Vitest, jsdom,
@testing-library/react и типы приложения. Ничего не устанавливает и не пишет
в node_modules приложения. TypeScript и тесты выполняются во временной папке.
Проверены настоящий dkSelect, настоящий контроллер dkDashboard, StrictMode,
обновление, локальные темы, поздние ответы, abort, пустой срез и retry.

Дополнительно в изолированной копии ИИ-среды прошли пять тестов DashboardKitView
и TypeScript для изменённого адаптера с его зависимостями: общий срез и экспорт,
смена темы, отказ загрузки, StrictMode и размонтирование до загрузки runtime.
Это компонентные проверки jsdom, не проверка браузерной геометрии, ECharts
canvas или production API. Браузерная приёмка 390/1280, темы и повторные
открытия в чате/материале/полном экране остаются обязательными до включения.
