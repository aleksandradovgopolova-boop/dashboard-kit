#!/usr/bin/env python3
"""Check structural policy fixtures; editorial meaning is never inferred from punctuation."""
import argparse
import json
import tempfile
from pathlib import Path
from screen_policy import review_html, review_page_css

ROOT = Path(__file__).resolve().parent.parent


def test():
    tiles = '<section class="dk-tile">Число</section>'
    assert review_html("overview", '<main data-dk-screen="overview">'+tiles*8+'</main>')[0]["code"] == "KPI_LIMIT"
    assert not review_html("catalog", '<main>'+tiles*12+'</main>')
    assert not review_html("details", '<main data-dk-screen="detail">'+tiles*12+'</main>')
    assert not review_html("modal", '<main data-dk-screen="overview">'+tiles*7+'<dialog>'+tiles*8+'</dialog></main>')
    assert review_html("hero", '<main data-dk-screen="overview"><b class="dk-hero__n">5</b>'+tiles*7+'</main>')[0]["code"] == "KPI_LIMIT"
    assert not review_html("nested-value", '<main data-dk-screen="overview">'+('<section class="dk-tile"><b class="dk-hero__n">5</b></section>')*7+'</main>')
    assert not review_html("nested-view", '<main data-dk-screen="overview">'+tiles*7+'<section data-dk-screen="operations">'+tiles*10+'</section></main>')
    # Loading does not erase the intended composition from static acceptance.
    assert review_html("loading", '<main data-dk-screen="overview"><div hidden>'+tiles*8+'</div></main>')[0]["code"] == "KPI_LIMIT"
    assert review_html("slot", '<main data-dk-screen="operations"><div class="dk-grid"><div class="dk-col--half"></div></div></main>')[0]["code"] == "EMPTY_GRID_SLOT"
    assert not review_html("runtime", '<main data-dk-screen="overview"><div class="dk-grid"><div class="dk-col--half"><div class="dk-chart"></div></div></div></main>')
    assert review_html("reserve", '<main data-dk-screen="overview"><span data-dk-reserve></span></main>')[0]["code"] == "RESERVED_SLOT"
    for style in ["visibility:hidden", "opacity: 0"]:
        assert review_html("reset", '<main data-dk-screen="overview"><button id="reset" style="'+style+'">Сбросить</button></main>')[0]["code"] == "RESERVED_RESET"
    assert not review_html("reset-hidden", '<main data-dk-screen="overview"><button id="reset" hidden>Сбросить</button></main>')
    dialog = '<dialog open data-dk-screen="detail"><div class="dk-grid"><div class="dk-col--half"></div></div><button data-dk-reset style="opacity:0!important">Сбросить</button></dialog>'
    assert {x['code'] for x in review_html('dialog-detail', dialog)} == {'EMPTY_GRID_SLOT', 'RESERVED_RESET'}
    assert not review_html('closed-dialog', dialog.replace('dialog open', 'dialog'))
    assert not review_html('hidden-parent', '<main data-dk-screen="overview"><div hidden><button id="reset" style="opacity:0">Сбросить</button></div></main>')
    assert not review_html('no-layout', '<main data-dk-screen="overview"><div class="dk-grid"><div class="dk-col--half" style="display:none!important"></div></div></main>')
    assert not review_html('preset', '<main data-dk-screen="overview"><button id="preset" style="opacity:0">Пресет</button></main>')
    # Periods in legitimate text are neither an error nor proof of editorial quality.
    assert not review_html("editorial", '<main data-dk-screen="overview"><p>Данные устарели. Повторить загрузку</p></main>')
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory); (root/"css").mkdir(); (root/"css/page.unknown.css").write_text("")
        assert review_page_css(root)[0]["code"] == "UNREGISTERED_PAGE_CSS"
        (root/"css/page.unknown.css").unlink(); (root/"css/page.dashboard.css").write_text("")
        assert not review_page_css(root)
    print("PASS: scoped KPI/hero limits, empty slots, inactive reset, page CSS and positive/negative fixtures; semantic text review remains manual")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--page", type=Path); parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    if args.page:
        issues = review_html(str(args.page), args.page.read_text())
        print(json.dumps({"issues": issues, "editorialReview": "required"}, ensure_ascii=False, indent=2) if args.json else '\n'.join(f"{x['path']} [{x['code']}] {x['message']}" for x in issues) or "PASS: structural rules; editorial review required")
        raise SystemExit(bool(issues))
    test()
