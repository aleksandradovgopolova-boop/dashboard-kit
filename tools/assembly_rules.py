"""Render the owner-approved assembly rules, keeping one human-readable source."""
from pathlib import Path
from html import escape
import re

SOURCE = Path(__file__).resolve().parent.parent / 'docs/assembly-rules.md'

def inline(text):
    # Only the source's inline code and explicit links are supported.
    text = escape(text)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return re.sub(r'\[([^]]+)\]\(([^)]+)\)', lambda m: '<a href="'+m[2]+'">'+m[1]+'</a>', text)

def render():
    out, paragraph, listing, table = [], [], False, False
    def flush():
        if paragraph:
            out.append('<p>'+inline(' '.join(paragraph))+'</p>'); paragraph.clear()
    def close():
        nonlocal listing, table
        flush()
        if listing: out.append('</ul>'); listing = False
        if table: out.append('</tbody></table></div>'); table = False
    for line in SOURCE.read_text().splitlines():
        line = line.strip()
        if line.startswith('# '): continue
        if not line: close(); continue
        if line.startswith('## '):
            close(); out.append('<h3>'+inline(line[3:])+'</h3>')
        elif line.startswith('- '):
            flush()
            if not listing: out.append('<ul class="sc-list">'); listing = True
            out.append('<li>'+inline(line[2:])+'</li>')
        elif line.startswith('|'):
            flush()
            cells = [x.strip() for x in line.strip('|').split('|')]
            if all(re.fullmatch(r':?-+:?', x) for x in cells): continue
            if not table:
                out.append('<div class="dk-tablewrap"><table class="dk-table sc-api"><thead><tr>'+''.join('<th scope="col">'+inline(x)+'</th>' for x in cells)+'</tr></thead><tbody>'); table = True
            else: out.append('<tr>'+''.join('<td>'+inline(x)+'</td>' for x in cells)+'</tr>')
        else: paragraph.append(line)
    close()
    # Markdown links are relative to docs/; the live section is in index.html.
    return ''.join(out).replace('href="../','href="').replace('href="current-state.md"','href="docs/current-state.md"')
