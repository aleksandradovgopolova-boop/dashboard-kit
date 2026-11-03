# Task 19 — operations consumer

Status: implemented; static/unit checks completed. Browser acceptance **PENDING**. No browser screenshots or visual PASS are claimed.

## Prompt and recipe selected before implementation

«На основе существующего reference-dashboard.html подготовь оператору таблицу службы × день с доступным учебным поручением. Сохрани единицу строки, серверный контракт и обратную связь. Сначала выбери рецепт; не превращай агрегированные строки в отдельные инциденты. Проверь ошибку, повтор и возврат из деталей.»

Selected recipe: **operations** from `skill/dashboard-build/references/recipes.md`. Operator → choose an aggregate observation → inspect its figures → create the available teaching task → see confirmation or retry → return to the same slice, page and row. Intended viewports: 390×844 and 1280×900, Dark/Light.

Row grain is **city × service × receipt date**. Neither source rows nor their received/completed counts are individual incidents. The source supplies no incident status, owner, deadline, priority or permission model: none was invented. Teaching action is supported by the actual reference `POST /api/tasks`; it does not assign an incident or claim permanent persistence. The table heading/caption and count make grain explicit; definitions are available in details.

Sequential metric and UX/editorial reviews were performed by this worker, not represented as independent reviews. No subagents were used.

## Frozen kit and inputs

Frozen source supplied: `/tmp/kit-evals-20261103/source`, commit `c05b74d` (provided pin; no git calls).

Installed by `python3 /tmp/kit-evals-20261103/source/tools/kit-release.py --pack /tmp/kit-evals-20261103/task19/app/kit`:

- Version `0.1.0-rc.7`, candidate, 100 files, data contract 1.
- `sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20`
- External consumer pin recorded in `kit-lock.json`; package remains unchanged.

Read source AGENTS, dashboard-build SKILL, catalog first via `kit.py list`, assembly rules/current state, requirements matrix, relevant README/DECISIONS/HANDOFF/REVIEW passages, UIUX and policy. Read recipes, numeric checks, composition, data, phone, product review, extensions, checks and modal standard; used `show` for table/modal/data/layout/type/headers/widget and generated `head` for selected parts. Reference HTML, host JS, CSS, source JSON, data/API/release docs and reference server were inspected. Eval expectation files, eval runs and feature proofs were not read.

## Artifacts and behavior

- `app/index.html`: runnable static consumer, generated Kit head, native table and detail dialog.
- `app/operations.js`: server-only host; shared `dkDashboard.createSession` validates query echo, totals, coverage and full series. No browser-side aggregation of the current server page. Filters and paging use the original contract. Unknown URL filter value produces the API's empty slice.
- `app/operations.css`: layout only, existing semantic tokens; Kit controls/material retained.
- `app/kit`: immutable pinned runtime.
- `serve.py`: serves the consumer and **imports the original pinned reference-server handler** for both API endpoints. It overrides only static GET/HEAD delivery so `kit/` assets are reachable on the same origin. No substitute API, simulated task result, delay or failure toggle.
- `check_static.py`: seven small numeric cases, contract round trip, real TaskStore idempotency and static asset/class/token checks. Opens no port.

The working table comes first. Two original full-slice sums remain below it; the chart was omitted because it is not needed to choose a record or create the teaching task. No new KPI was added. `series` still comes from the server and is validated by Kit. Mobile rows use `dk-table--cards` with actual `dkTable` label binding. Sorting is absent because server contract v1 has no sort field. CSV explicitly exports this server page.

Loading/error hide old values; retry preserves the query. A teaching attempt has one UUID per source/row during the page lifetime. Pending/done prevents duplicate submission; an error offers retry with the same key and body, including after close/reopen. Source kind guards teaching action availability. Confirmed server message is displayed before rereading the current slice. Closing details restores its specific row trigger and scroll, including when the refresh replaced row nodes; a close during reread defers return until that slice becomes ready. Tasks remain only in server process memory, disclosed in the existing detail disclosure and in server confirmation. No task status is invented from received minus completed.

Normal view has titles, values, units, source timestamp in UTC, slice, grain and short partial status; no permanent instructional sentences. Definitions and persistence limits have a single details disclosure. Error/recovery sentences are state-specific (§7). Applied review IDs: UI-002 feedback, UI-003 concrete grain/units, UI-005 visible slice, UI-006 return, UI-007 duplicate prevention, UI-010 table priority, UI-020 retry without input loss. These are code-review findings; browser behavior remains pending.

## Independent expected answers fixed before checks

| Slice | Rows | Received | Completed | Completed coverage |
|---|---:|---:|---:|---:|
| All, page 1 or 2 | 9 | 85 | 60 | 8/9, partial |
| Water supply | 5 | 44 | 35 | 5/5 |
| Moscow | 3 | 45 | 32 | 3/3 |
| 11–20 October | 6 | 65 | 43 | 5/6, partial |
| Perm + water + 1–5 October | 1 | 0 | 0 | 1/1 |
| Unknown city | 0 | null | null | 0/0 |

`observation-6` (first row page 2): received 6, completed null → visible `Нет данных`; `observation-3`: both values 0. Page 2 has four rows and the exact same totals/series as page 1. Numeric expected constants in the check are hand-calculated, independent of production aggregate/formatter.

Pending UI binding expectations: `85`, `60`, `8 из 9 наблюдений`; Moscow `45`/`32`; late `65`/`43`; observation-6 `Нет данных`; observation-3 `0`. Actual localized text may include nonbreaking spaces in longer values.

## Executed checks and self corrections

- Package verification against the external digest completed successfully.
- `node --check app/operations.js` and `python3 -m py_compile serve.py` completed successfully.
- `python3 -B check_static.py`: seven genuine server responses accepted by pinned JS validator; exact constants, page invariance, null/zero, TaskStore repeated-key same-result and different-body conflict, local references, classes and tokens checked.
- `python3 .../tools/check.py --fast --page .../app/index.html`: static page rules clean; checker explicitly reports mobile/browser skipped.

Self corrections:

1. Technical: default exec shell was unavailable; explicit `/bin/zsh`, `login:false` works.
2. Technical/tooling: `check.py --help` is **not a help flag**. It unexpectedly ran default checks and attempted browser subprocesses; both failed with `EPERM listen 127.0.0.1` before rendering. This was a worker mistake, not a successful browser run. No server/browser acceptance resulted. Subsequent checks use explicit `--fast` only.
3. Technical: caught unsupported `dk-metric-md` during static audit; replaced with existing `dk-metric-lg` before delivery.
4. Technical: page checker does not see external `dkTable` initialization; moved the real initialization into the DOMContentLoaded HTML bootstrap and passed the instance to the host. Mobile labels are still bound by Kit, not fabricated CSS text.
5. UX/technical: success now updates feedback before awaiting reread; explicit keyed focus/scroll restoration handles replaced rows and a close during reread.
6. UX: removed an unnecessary local summary display override; disclosure keeps Kit styling.
7. Technical: disable Python import bytecode writes in the server wrapper so normal startup cannot add `__pycache__` files to the immutable pinned package.
8. Data/composition: retained source grain and exact metric definitions; no incident conversion, invented status or backlog-based priority. Table takes precedence over chart; source null remains null. These were preimplementation choices, with no later correction to dataset values.

First completed consumer was syntax-checked, then corrected by static/self review as above. No user feedback or owner acceptance is claimed.

## Startup and independent browser acceptance

From `/tmp/kit-evals-20261103/task19`:

```sh
python3 serve.py --port 8799
# or --port 0 to print an OS-assigned localhost port
```

Open `http://127.0.0.1:8799/index.html?theme=dark`; use `theme=light` for the other theme. Server mode is always active; `source=server` is accepted but unnecessary. Same-origin routes: `/api/dashboard` POST, `/api/tasks` POST; `/index.html`, `/operations.js`, `/operations.css`, `/kit/...` GET. The API handler's original Host/Origin checks remain active. No separate API URL configuration or CORS change is needed. The Kit's reference server alone cannot serve the consumer's `kit/` paths; use this thin wrapper.

URL state: `region=Москва`, `service=Водоснабжение`, `period=late`, `page=2`. These are actual server query filters, with page reset when a filter changes. No timeout/failure simulation parameters exist.

Stable selectors:

- `#reference-dashboard[data-status=ready|loading|error|empty]`; exposed `root.referenceDashboard.session.getSnapshot()` for contract inspection.
- `#ref-region`, `#ref-service`, `#ref-period` Kit selects; `#ref-reset`, `#ref-refresh`, `#ref-retry`.
- `#ref-rows tr[data-id]`; row detail trigger `[data-row][data-trigger=details]`; teaching trigger `[data-row][data-trigger=action]` (both open the same real detail dialog).
- `#ref-prev`, `#ref-next`, `#ref-page-number`; `#ref-export`.
- `[data-metric=received] .dk-metric-lg`, `[data-metric=completed] .dk-metric-lg`.
- `#ref-detail`, `#ref-detail-body`, `#ref-detail-title`, `#ref-action`, `#ref-action-status`, `[data-modal-close]`.
- Theme `[data-theme-set=dark|light]`; disclosure `#ref-detail-body details > summary`.

Pending Chrome sequence at 390×844 and 1280×900, Dark/Light: inspect whole-page overflow and first-screen table, mobile labels/all fields, control targets, source/period, totals across page changes, null and zero, actual select menus, keyboard/Tab/Escape, detail return to exact trigger/scroll; create task → inspect server response and one subsequent read; reopen same row → same completed feedback/no second POST. For failure/retry, independently fail a dashboard POST and a task POST in the browser network layer, then recover: retain filters/page and same task Idempotency-Key/body, disabled while pending, visible error and recovery. Do not install fake API state in the app. UI values should be compared with the independent constants above.

Limitations: no Chrome rendering, screenshots, actual UI-binding assertions, browser error/retry execution, keyboard/focus/scroll observation, contrast measurement, full Kit suite, screenreader, physical device or production authorization/persistence verification. The implementation is reviewable and runnable; browser acceptance remains **PENDING**.

## Postreview UX/layout correction 1

Independent parent review reported actual Light/390 rectangles: filter controls y=154–198 while Refresh began at y=188; the filter group also escaped the main 24px page guide. Parent reported source numbers/API/actions/focus checks passing in four views, but page-overflow alone did not detect this overlap. This section records the **first correction after external review**, separately from pre-delivery self corrections. No acceptance of the revised geometry is claimed yet.

Before editing, preserved byte-for-byte `app/index.html` and `app/operations.css` at `postreview-ux-layout-1/original/`, with SHA-256 in `original/sha256.json`:

- HTML: `59544d005477381f62ef4190c870de14d66a52125839db85aaeac67105445a3c`
- CSS: `2a8499314f9a64374170ba2cb492d2cf3a0975b844e15c89d13580efc81ea886`

Source cascade review found the cause in pinned `kit/css/components.css:800`: at ≤767px, `.dk-toolbar__group:has(> .dk-select)` supplies `margin: calc(var(--space-3) * -1) calc(var(--page-pad) * -1) calc(var(--space-8) * -1)`. The actual Kit select initializer puts `.dk-select` on direct group children, activating that rule. Existing local CSS replaced its padding with `var(--space-2)` on four sides, but did not replace the negative margins. Those remaining margins pulled the scroll area left and reduced the vertical space allocated before the next wrapped row. Primitives resolve space-3 to 6px, space-8 to 24px, space-2 to 4px; global Kit box sizing is border-box.

Correction scope: **only `app/operations.css` mobile toolbar group**, adding `margin:0; width:100%; max-width:100%`. Existing `flex:1 1 100%`, single horizontally scrollable filter row and symmetric `padding:var(--space-2)` remain. The local selector has equal specificity to Kit's mobile `:has` rule and loads afterward, so these values replace the full-bleed margins. The group now stays within the parent guide and contributes its whole padded height to flex layout; the next row uses the existing space-4 (8px) gap instead of overlapping. No controls/slots were hidden, no component, API, HTML, JS, palette or material was changed. New CSS SHA-256 and unchanged HTML SHA-256 are recorded in `postreview-ux-layout-1/changes.json`.

Quick checks after correction: `python3 -B check_static.py` completed (seven numeric views, genuine JS contract round trip, TaskStore idempotency/conflict, static references/classes/tokens); `check.py --fast --page app/index.html` static rules clean, browser explicitly skipped; pinned package verification against external digest succeeded. No Chrome, server, git or network action was run for this correction. Actual revised toolbar rectangles, scroll/menu behavior and screenshots in both themes remain for the parent's independent browser recheck. The source cascade reasoning above is not a measured browser computed-style result.

## Postreview UX/layout correction 2 — detail metric labels

Independent parent review found a second P1 issue in the actual Light/390 detail/action dialog: the two figures `12` and `9` were rendered without visible names/units. This is recorded separately from toolbar correction 1. Numeric/API correctness and DOM text presence had not established visible label geometry.

Before editing, preserved byte-for-byte `app/operations.js` at `postreview-ux-layout-2/original/operations.js`, with SHA-256 in `original/sha256.json`:

- Before JS: `3f6e837490b3b25d01a94a96b8371625fbc336191167e86d5c0c6671638edd53`
- After JS: `aab03a3761a6e8cf33e0e65a9740140d022760272c2e230c8658895cbbb960ba`

Source cascade and component-contract review: the old parent had only `dk-modal__metrics`; this class supplies columns/gaps but not `display:grid`. Kit's `@supports (grid-template-rows:subgrid)` rule nevertheless gives direct detail `.dk-tile` children `display:grid; grid-row:span 3; grid-template-rows:subgrid`. The missing parent grid violated that layout contract. Plain `.dk-tile__label` also has two-line clipping, whereas the standard `.dk-tile--compact` explicitly restores a block, visible overflow and full wrapping. The pinned `family-mortgage.js` detail implementation uses the compatible parent/child structure.

Correction changes **only the detail metric construction in `app/operations.js`**:

- Parent: `dk-grid dk-modal__metrics`, enabling the real grid required by child subgrids.
- Each existing card: `dk-tile dk-tile--compact`, with label and `dk-tile__row` containing `span.dk-metric-lg`, following the existing Kit detail pattern. Label uses a `div`, matching that pattern and avoiding unstyled native h3 margins.
- Exactly the same two source metrics, values and units remain: `Поступило, работ` and `Выполнено из поступивших, работ`. No added KPI, informational block, placeholder, field, component style or new visual system. Null handling remains `Нет данных`.

No CSS/HTML/API/Kit changes were made in correction 2; toolbar correction 1 remains intact. Change hashes and scope are recorded in `postreview-ux-layout-2/changes.json`.

Quick checks after correction 2: `node --check app/operations.js`; existing no-port `python3 -B check_static.py` (genuine server contracts, numeric cases, TaskStore and static classes/tokens/references); `check.py --fast --page app/index.html` static rules clean with browser explicitly skipped; external pinned-package verification succeeded. No Chrome, server, git or network action was run. Parent's real Chrome check of visible labels/units, computed layout and non-overlapping metric rectangles is **PENDING**. Source analysis and text presence are not represented as visual acceptance.
