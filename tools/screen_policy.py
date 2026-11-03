"""Structural composition checks. Semantic editorial review remains separate."""
from __future__ import annotations
from html.parser import HTMLParser
from dataclasses import dataclass, field
from pathlib import Path
import re


@dataclass(eq=False)
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    line: int = 1
    parent: Node | None = None
    children: list = field(default_factory=list)
    text: str = ""

    @property
    def classes(self):
        return set(self.attrs.get("class", "").split())

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

    def ancestors(self):
        node = self.parent
        while node:
            yield node
            node = node.parent


class Document(HTMLParser):
    void = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.current = self.root
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), self.getpos()[0], self.current)
        self.current.children.append(node)
        if tag not in self.void:
            self.current = node

    def handle_endtag(self, tag):
        for node in [self.current, *self.current.ancestors()]:
            if node.tag == tag:
                self.current = node.parent or self.root
                break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.void:
            self.handle_endtag(tag)

    def handle_data(self, text):
        if self.current.tag not in {"script", "style"}:
            self.current.text += text


def _screen(node):
    return next((parent for parent in [node, *node.ancestors()] if "data-dk-screen" in parent.attrs), None)


def _kpi(node):
    return "dk-tile" in node.classes or "dk-hero__n" in node.classes or node.attrs.get("data-dk-kpi") == "true"


def _styles(node):
    return {key.strip().lower(): re.sub(r"\s*!important\s*$", "", value.strip().lower())
            for declaration in node.attrs.get("style", "").split(";") if ":" in declaration
            for key, value in [declaration.split(":", 1)]}


def _not_in_layout(node):
    return any("hidden" in parent.attrs or _styles(parent).get("display") == "none" or
               parent.tag == "dialog" and "open" not in parent.attrs for parent in [node, *node.ancestors()])


def _meaningful(node):
    if _not_in_layout(node):
        return False
    if node.text.strip() or node.tag in {"img", "svg", "canvas", "input", "select", "textarea", "progress"}:
        return True
    if any(name.startswith(("dk-chart", "dk-map", "dk-cal")) for name in node.classes):
        return True  # Existing runtime host, not a reserved empty grid slot.
    return any(_meaningful(child) for child in node.children)


def review_html(name, html):
    document = Document(html)
    issues = []

    def issue(code, node, message):
        issues.append({"code": code, "path": f"{name}:{node.line}", "message": message})

    for screen in document.root.walk():
        if "data-dk-screen" in screen.attrs and screen.attrs["data-dk-screen"] not in {"overview", "operations", "detail", "catalog"}:
            issue("SCREEN_KIND", screen, "data-dk-screen: ожидается overview, operations, detail или catalog")
        if screen.attrs.get("data-dk-screen") not in {"overview", "operations", "detail"}:
            continue
        nodes = [node for node in screen.walk() if _screen(node) is screen]
        if screen.attrs["data-dk-screen"] == "overview":
            kpis = [node for node in nodes if _kpi(node) and not any(parent.tag == "dialog" for parent in [node, *node.ancestors()]) and not any(_kpi(parent) and parent in nodes for parent in node.ancestors())]
            if len(kpis) > 7:
                issue("KPI_LIMIT", screen, f"Обзор содержит {len(kpis)} самостоятельных КПЭ, максимум 7. Перенесите подробности в детали; уменьшать шрифт не нужно")
        for node in nodes:
            if _not_in_layout(node):
                continue
            if "data-dk-reserve" in node.attrs:
                issue("RESERVED_SLOT", node, "Не резервируйте место под отсутствующее действие или виджет")
            if node.parent and "dk-grid" in node.parent.classes and any(value.startswith("dk-col--") for value in node.classes) and not _meaningful(node):
                issue("EMPTY_GRID_SLOT", node, "Пустая колонка занимает место: удалите её; равноправные блоки распределите через dk-grid--balanced")
            style = _styles(node)
            reset = re.search(r"(?:^|[-_])reset(?:$|[-_])", node.attrs.get("id", "").lower()) or node.attrs.get("data-action") == "reset" or "data-dk-reset" in node.attrs
            try:
                transparent = float(style.get("opacity", "1")) == 0
            except ValueError:
                transparent = False
            if reset and (style.get("visibility") == "hidden" or transparent):
                issue("RESERVED_RESET", node, "Неактивный сброс должен отсутствовать из раскладки: используйте hidden/display:none, без невидимой кнопки")
    return issues


def review_page_css(root: Path):
    import manifest_parts
    registered = {name for name, _ in manifest_parts.CSS_ORDER} | set(manifest_parts.DOCS_ONLY)
    return [{"code": "UNREGISTERED_PAGE_CSS", "path": str(path.relative_to(root)),
             "message": "Зарегистрируйте page.css в tools/manifest_parts.py CSS_ORDER (или DOCS_ONLY для документации), затем пересоберите manifest"}
            for path in sorted((root / "css").glob("page.*.css")) if path.relative_to(root).as_posix() not in registered]
