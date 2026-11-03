# Task16 — мониторинг ипотеки

## Prompt

Руководителю нужен обзор объектов, требующих внимания. Используй учебный tools/fixtures/numeric/mortgage-source.json и правило риска ипотеки: недовыполнение >=20п.п. — сильно отстаёт; >0 — отстаёт; иначе по плану. Выбери рецепт, собери 1280x900 и390x844; фильтр округа, детали и возврат. Не добавляй блоки без полезного вопроса. Нужен настоящий runnable static consumer, обе темы и минимум постоянных пояснений согласно kit rules; числа/единицы/период/статусы видимы.

Execution constraints: frozen source /tmp/kit-evals-20261103/source, supplied commit c05b74d; source read-only. All outputs in task16. No git/network/server/browser/heavy suites or subagents. Independent numeric/product and browser acceptance delegated by coordinator to its own subsequent review; this report does not assert that acceptance.

## Brief and recipe

Audience: руководитель. Decision: какие регионы разобрать в первую очередь. Questions: сколько требуют внимания; есть ли регионы без оценки; каков общий факт относительно плана; какой регион и насколько отстаёт; какие месяцы входят в результат. Devices: 1280×900 and 390×844, Dark/Light. Recipe: monitoring. Existing familyMortgageData model applies exactly the supplied mortgage rule and complete calendar-month grain.

Composition: two equal KPI (attention count and total completion with credit numerator/denominator); compact no-assessment count; priority table sorted by descending lag; short region modal with two metrics and monthly exact values. No map because geographic location does not change the requested prioritization. No trend chart, budget/rate/approval, severe-count KPI or invented causal narrative because these add no necessary answer. No region coverage claim beyond the two regions in the supplied educational source.

## Data and literal checks

Source fixture SHA-256: 17b2b10a6ef92767afcbc50a37a4cdd757a4ce07dfdd338e5ae86e7ed82d1774. Copied byte-for-byte to app/data/mortgage-source.json; data/source.js serializes that same object for static loading without fetch/server.

Manual answers used for model checks: all issued100, plan200, completion50%, attention2/2, missing0. Алтай:60/150=40%, lag60pp, strongly behind. Санкт-Петербург:40/50=80%, lag20pp, strongly behind at the inclusive boundary. Санкт-Петербург April10/20=50%, May30/30=100%/on plan. Алтай May0/50=0%, lag100pp (zero is an observed value). A null issued observation makes that region unassessed and aggregate issued unknown; no averaging of percentages or missing-to-zero coercion.

## Runtime pin and files

Pack command: python3 tools/kit-release.py --pack /tmp/kit-evals-20261103/task16/app/kit.
Version 0.1.0-rc.7, candidate, 100 runtime files. Digest sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20. Frozen candidate was pinned as supplied; not relabeled stable or published. consumer-lock.json stores the external pin and supplied source commit. Full file list: files.txt; runtime inventory and individual hashes: app/kit/kit-release.json. Authored files: app/index.html, app/app.js, app/data/source.js, app/data/mortgage-source.json, consumer-lock.json, check-model.mjs, verification.json, report.md. first-complete preserves authored HTML/JS before coordinator review.

## Actual quick checks

- node --check app/app.js — PASS.
- node check-model.mjs — PASS: literal constants, all/district, exact20pp boundary, month detail, zero, null and empty model slices.
- python3 source/tools/check.py --page app/index.html --fast — PASS structural/text checks; explicitly reports mobile width/touch/safe-area unverified.
- python3 source/tools/check-screen-policy.py --page app/index.html --json — issues=[], editorialReview=required.
- python3 source/tools/kit-release.py --verify app/kit --expect sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20 — PASS.

## Self corrections before coordinator review

Data: no formula corrections required; reused validated monthly mortgage model instead of inventing a generic daily dkMetrics declaration. Zero/null and inclusive threshold checked explicitly.

UX/editorial: removed planned redundant severe-count tile; no-assessment stays as compact status with the attention count. Used two detail metrics rather than extra available financial fields. Set detail grid explicitly to two actual columns so the standard four-column default leaves no unused KPI slots. Corrected singular region grammar in the filtered KPI. Removed automatic focus tooltip from close X so dialog opening does not immediately display an unnecessary explanation or consume the first Escape.

Technical: first pack attempt required creating its parent directory; then pack succeeded. Initial --page --fast flagged dk-table--cards initialization because dkTable calls were in the external host JS; moved real initializations into a DOMContentLoaded inline handler visible to the static check. Actual runtime behavior still uses kit APIs. No managed files, frozen source or shared repository changed.

## Text/product audit and limitations

Sequential self review only, not independent review. Main ordinary state contains labels, values, units, period, source update timestamp, statuses and actions; zero permanent explanatory sentences. Brief educational marker is allowed by assembly-rules §7. Formula/risk/source explanation has one named dkTooltip entry, “Методика и источник”. Empty/error messages are hidden outside their respective states. Numbers stay text; unknown values remain dashes plus assessment status. No fake action/backend or saving promise.

Applicable UI-001/008/009/010: useful questions and order reflected in two KPI and priority table; UI-005/015/027/030/033: exact values, full region names, table headers/cards and shared district slice; UI-020/022/023/024/041: short state text and named actions. Observed evidence here is static code/model only; actual interaction, geometry, focus return, tooltip hover/focus/click/Escape, Dark/Light readability, responsive overflow, touch targets and 200% text await coordinator browser checks. Browser PASS is NOT claimed. Full suite, physical devices and live screen reader were not run.

For verification actions and exact selectors/API see verification.json. To run, open app/index.html directly or serve task16/app with any static server; no build required.

## Post-review UX/layout correction 1

Independent coordinator UX review found P1 in 390px Dark region details: the second KPI overlapped the monthly table although its values were correct. The first version therefore was not visually accepted; numerical PASS did not establish correct layout.

Original HTML, app.js, and every consumer CSS file are preserved under post-review-ux-layout-correction-1/original/, with per-file SHA-256 in original-sha256.json. The earlier first-complete snapshot remains unchanged.

Cause: #detail-metrics had dk-modal__metrics and an explicit two-column template but lacked dk-grid. The SDK child tiles use grid-row:span 3 and grid-template-rows:subgrid; these require the grid parent established by the existing family-mortgage modal example (js/family-mortgage.js). Re-read DASHBOARD-DETAIL-MODAL-001 MOD-001/002/006 and that implementation.

Correction: added dk-grid to #detail-metrics; retained the actual two-column definition and both existing KPI. No data, metrics, labels, calculations, app.js, color/design overrides or pinned SDK files changed.

Quick checks after correction: JS syntax, literal model checks, check.py --page --fast, screen-policy (issues=[]), and runtime external-pin verification PASS. Exact commands/output are in quick-checks.json. No Chrome/browser/server/git/network run by this agent. Computed-rectangle non-overlap, labels and screenshots await coordinator browser verification; no post-correction visual PASS is claimed here.

## Post-review UX/layout correction 2

Coordinator final UX review confirmed KPI/table overlap was fixed, then found P2 in the same 390px detail: monthly column headings visually ran together. The six-column fixed table allocation did not provide enough room for full nowrap headings. Numeric correctness and the first layout correction did not establish table readability.

Preserved the pre-correction HTML, app.js and every CSS file under post-review-ux-layout-correction-2/original/, with original-sha256.json. Previous snapshots/correction evidence remain unchanged.

Correction is confined to the monthly table and its existing dk-tablewrap: explicit 1120px minimum inner table width via --table-min, with table-layout:auto so intrinsic heading widths can expand rather than sharing six fixed undersized columns. Kept all full headings and existing font sizes. The table remains within its horizontal scrolling wrapper. Added #months-scroll, tabindex=0, role=region and aria-labelledby=months-title to make that region named and keyboard reachable, matching the existing mortgage modal scroll wrapper contract. No values, metric selection, app.js or frozen SDK changed.

After correction, JS syntax, literal model checks, check.py --page --fast, screen-policy (issues=[]), and runtime external-pin verification PASS; exact outputs are in post-review-ux-layout-correction-2/quick-checks.json. Static checks cannot establish actual header rectangles or touch/keyboard scrolling; coordinator will perform browser header-nonoverlap assertions and new screenshots. This agent ran no Chrome/server/git/network and claims no browser PASS.
