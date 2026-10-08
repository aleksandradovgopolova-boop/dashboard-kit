"""Read-only MCP adapter for dashboard-kit. Optional SDK: tools/mcp-requirements.txt."""
from __future__ import annotations

import argparse
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

import kit

ROOT = Path(__file__).resolve().parent.parent
mcp = FastMCP("dashboard-kit", host="127.0.0.1", port=8767,
              instructions="Read the build guide first. Use components from the catalog; "
              "get_includes determines asset order. This server does not compute business metrics, "
              "write dashboards, host assets or certify visual quality.")
READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)


def answer(command: str, args: list[str]) -> str:
    try:
        return kit.COMMANDS[command](kit.load(), args)
    except SystemExit as exc:
        raise ValueError(str(exc)) from exc


@mcp.tool(annotations=READ_ONLY)
def list_components() -> str:
    """List available components. Read this before selecting blocks."""
    return answer("list", [])


@mcp.tool(annotations=READ_ONLY)
def get_component(components: list[str]) -> str:
    """Get exact classes, API, examples and constraints for component IDs from the catalog."""
    return answer("show", components)


@mcp.tool(annotations=READ_ONLY)
def search_components(query: str) -> str:
    """Search the kit catalog by purpose, class or component name."""
    if not query.strip():
        raise ValueError("query must not be empty")
    return answer("find", [query])


@mcp.tool(annotations=READ_ONLY)
def get_chart_guidance() -> str:
    """Get chart selection rules, accessibility guidance and known gaps."""
    return answer("charts", [])


@mcp.tool(annotations=READ_ONLY)
def get_includes(components: list[str], embed: bool = False) -> str:
    """Generate ordered CSS/JS tags. embed=True for a .dk-root inside another app.

    Paths are relative to the kit assets; the host must serve or bundle those assets.
    """
    # Validate IDs before translating to CLI options; no caller-supplied flags.
    try:
        kit.pick(kit.load(), components)
    except SystemExit as exc:
        raise ValueError(str(exc)) from exc
    return answer("head", components + (["--embed"] if embed else []))


@mcp.resource("dashboard-kit://build-guide")
def build_guide() -> str:
    """Canonical build workflow, with references available as resources."""
    return (ROOT / "skill/dashboard-build/SKILL.md").read_text("utf-8")


@mcp.resource("dashboard-kit://references/{name}")
def reference(name: str) -> str:
    """Read a named build reference, e.g. charts or product-review."""
    allowed = {p.stem: p for p in (ROOT / "skill/dashboard-build/references").glob("*.md")}
    if name not in allowed:
        raise ValueError("Unknown reference. Available: " + ", ".join(sorted(allowed)))
    return allowed[name].read_text("utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--transport", choices=["stdio", "streamable-http"], default="stdio")
    args = parser.parse_args()
    # HTTP deliberately binds to loopback: external hosting/auth belongs to deployment.
    mcp.run(transport=args.transport)
