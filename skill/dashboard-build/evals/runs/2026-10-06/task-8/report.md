# Task 8 — independent dashboard-build evaluation

Prompt: «Добавь только heatmap риска по службам и дням: значения 0, 35, 80 и null. Нужны легенда, числа, различимость без цвета и телефон.»

Result: one documented heatmap widget was built, with exact numbers, explicit thresholds, no-data text and pattern, I–IV level marks, and an accessible horizontal scrolling region. API/runtime and automatic page checks pass. Visual inspection found a mobile row-header overlap defect; the result is therefore not claimed to be fully usable on a phone.

## Scope and discovery

- Kit used read-only: `/Users/sasad/dashboard-kit-backlog`.
- All created files are under `/Users/sasad/dashboard-kit-evals/2026-10-06/task-8`. No kit edit, commit, push or publication.
- Read `skill/dashboard-build/SKILL.md`; relevant references: charts, data, phone, checks, accessibility, extensions. Read connection rules and relevant SDK/lifecycle sections of README, project UX/accessibility principles, and decision/review/handoff context. A broad combined document read was output-truncated; targeted README/UX reads supplied relevant requirements.
- Discovery order: `tools/kit.py list`, then `show heatmap layout base type`, then `head heatmap layout type`. Examined documented example/API in `component-heatmap.html`. No JS component implementation or evaluation expected answers were read.
- `head` output is used unchanged for CSS/JS dependency order. `css`, `js`, `icons`, `vendor` symlink the read-only kit; vendor provides the local fonts. No framework or dependency installation.
- Assumptions explicitly shown in page: sample source, risk on a 0–100 scale, thresholds 25/50/75, two example services, four consecutive days. Added no KPI, chart type, navigation or filters beyond the requested widget.
- Numeric legend uses `dkFmt.num`; dataset is passed to `dkHeatmap` as plain strings/numbers, without HTML construction.

## Verification and actions

`python3 /Users/sasad/dashboard-kit-backlog/tools/check.py --page index.html` exits 0. `check.log` records static classes/icons, dependencies/order, escaping, table/token checks and actual Chrome mobile checks at Android 360, landscape and iPad. An initial check failed because the font assets were missing from the evaluation folder; adding the vendor symlink corrected the page fixture. No browser check was skipped.

`tools/snap.mjs` produced and all four files were visually inspected:

- `mobile-dark.png`, `mobile-light.png`: 390×844.
- `desktop-dark.png`, `desktop-light.png`: 1280×900.

Screenshots use the supplied tool's deviceScaleFactor 2; image pixel dimensions are doubled. Fixed viewport screenshots, not full-page captures.

`runtime.mjs` launches actual headless Google Chrome via the kit's test harness, serves only this evaluation folder and uses CDP. Its evidence is in `runtime-results.json` and `runtime.log`. The script consumes documented API; it does not inspect component JS source.

Observed DOM/runtime:

- Exactly one real table, caption names risk and unit; five `scope=col` and two `scope=row` headers. All eight cells contain the intended 0/35/80/null values. Zero has visible numeral and I; 35 has II; 80 has IV; two null cells say «Нет данных».
- No-data has a visible patterned square via CSS `::before`, plus text. Ordinary numeric cells are not assigned `dk-nodata`. Live light/dark switch updates numeric text and no-data background; pattern remains. Colors are semantic tokens rather than accent.
- Page clientWidth/scrollWidth are both 390. The table's own wrapper measures 324px wide with 720px content, so overflow is local to the table.
- Host supplies `tabindex=0`, region role/name on the generated `.dk-tablewrap`. A real CDP Tab reaches it with visible outline; eight ArrowRight key actions change scrollLeft to 320; Shift+Tab leaves it for body. No dialog or action button exists, so Enter/Escape flows are not relevant. The enhancement is host markup wiring; because `update` regenerates descendants, a host using dynamic updates must reapply this focusable region after each update. This static page performs no user-triggered update.
- `update` swaps to a test row without duplicating the table. All-null update shows four no-data cells and no numeric marks. `destroy` twice empties the host without exception. Two consecutive initializers leave one table/eight cells. No runtime exceptions were captured.
- Chrome AX tree contains named table, row headers and column headers. This is observed accessibility structure, not spoken screenreader output.

## Visual findings and limits

Desktop: full service names, all days/values and legend are visible in both themes. Risk has exact numbers and Roman marks, so the distinctions do not require color.

**Mobile defect:** at 390px in both themes, the row labels «Служба теплоснабжения» and «Служба водоснабжения» extend beyond their first-column cells and overlap the first numeric / no-data cells. The table stays within its own scroll region, so page-overflow checks pass. This is a meaningful readability failure despite a green `--page` result. Names were intentionally preserved in full; the kit was not edited or overridden to conceal the defect. The remaining days are reached by internal horizontal scrolling; users must scroll to compare the whole grid.

SDK documentation also generates a three-band summary («средний: 25–75») although the cell marks use four levels I–IV. The explicit host legend explains the missing middle split at 50 and excludes upper boundaries. A clearer built-in four-level legend would reduce ambiguity and duplicate explanatory text.

Second pass: retained one widget only; explanatory source/units, level boundaries, no-data meaning and scrolling help serve the requested heatmap. No unrelated block was added.

Not tested: physical iPhone/Android, WebView, Safari/Firefox, real system font scaling, spoken VoiceOver/NVDA, user research. Browser checks and expert image inspection do not establish full WCAG compliance or physical-phone support. Reduced-motion/device emulation in screenshots is not a real device test. Full library suite was outside this page evaluation; only the actual page's complete `--page` check was run.
