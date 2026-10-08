"""Protocol smoke test. Run with the optional MCP environment's Python."""
import asyncio
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    server = Path(__file__).with_name("mcp_server.py")
    async with stdio_client(StdioServerParameters(command=sys.executable, args=[str(server)])) as streams:
        async with ClientSession(*streams) as session:
            await session.initialize()
            catalog = await session.list_tools()
            assert {t.name for t in catalog.tools} == {
                "list_components", "get_component", "search_components", "get_chart_guidance", "get_includes"}
            for name, args in [
                ("list_components", {}), ("get_component", {"components": ["table"]}),
                ("search_components", {"query": "таблица"}), ("get_chart_guidance", {}),
            ]:
                result = await session.call_tool(name, args)
                assert not result.isError and result.content, name
            result = await session.call_tool("get_includes", {"components": ["table"]})
            tags = result.content[0].text
            assert tags.index("dk-theme.js") < tags.index("tokens.primitives.css")
            assert tags.index("dk-util.js") < tags.index("dk-table.js")
            result = await session.call_tool("get_includes", {"components": ["table"], "embed": True})
            assert "<script src=\"js/dk-theme.js\"" not in result.content[0].text
            for name, args in [
                ("get_component", {"components": ["missing-component"]}),
                ("get_includes", {"components": ["--prefix"]}),
                ("search_components", {"query": ""}),
            ]:
                assert (await session.call_tool(name, args)).isError, name
            assert (await session.read_resource("dashboard-kit://build-guide")).contents
            assert (await session.read_resource("dashboard-kit://references/charts")).contents
            try:
                await session.read_resource("dashboard-kit://references/unknown")
            except Exception:
                pass
            else:
                raise AssertionError("Unknown resource must fail")
    print("MCP: handshake, 5 tools, asset order, embed, resources and errors passed")


if __name__ == "__main__":
    asyncio.run(main())
