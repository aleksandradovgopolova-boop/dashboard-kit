#!/usr/bin/env python3
"""Test full-slice aggregation, paging and demo actions without opening a socket."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, timedelta
from email.message import Message
import importlib.util
from io import BytesIO
import json
import math
from pathlib import Path
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("reference_server", Path(__file__).with_name("reference-server.py"))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


def rejects(action, status, message):
    try:
        action()
    except server.APIError as error:
        assert error.status == status, (message, error.status, error.code)
        return
    raise AssertionError(message)


fixture = json.loads((ROOT / "data/reference-dashboard.json").read_text())
data = deepcopy(fixture)
data["rows"] = []
data["metrics"].append({"id": "duration", "label": "Время", "unit": "ч", "aggregation": "mean", "description": "Среднее по известным наблюдениям; пропуски не являются нулём."})
for i in range(20000):
    data["rows"].append({
        "id": f"observation-{i}", "label": f"Наблюдение {i}", "date": "2026-10-" + str(i % 20 + 1).zfill(2),
        "dimensions": {"region": "Москва" if i % 2 == 0 else "Казань", "service": "Водоснабжение" if i % 3 else "Теплоснабжение"},
        "values": {"received": i % 11, "completed": None if i % 7 == 0 else i % 5, "duration": None if i % 13 == 0 else i % 17 / 2},
    })

query = {"filters": {"region": ["Москва", "Москва"]}, "period": {"from": "2026-10-04", "to": "2026-10-16"}, "page": 1, "pageSize": 37}
first = server.create_view(data, query)
second = server.create_view(data, dict(query, page=2))
expected_rows = [row for row in data["rows"] if row["dimensions"]["region"] == "Москва" and "2026-10-04" <= row["date"] <= "2026-10-16"]
assert first["mode"] == "server" and first["query"]["filters"]["region"] == ["Москва"]
assert first["rowCount"] == len(expected_rows) > 37
assert first["rows"] == expected_rows[:37] and second["rows"] == expected_rows[37:74]
assert first["totals"] == second["totals"] and first["series"] == second["series"], "Paging must not change full-slice metrics"
assert len(first["series"]) <= 20
assert sum(point["coverage"]["received"]["total"] for point in first["series"]) == first["rowCount"]
for metric in data["metrics"]:
    name = metric["id"]
    values = [row["values"][name] for row in expected_rows if row["values"][name] is not None]
    expected = math.fsum(values) / (len(values) if metric["aggregation"] == "mean" else 1)
    assert math.isclose(first["totals"][name]["value"], expected)
    assert first["totals"][name]["observed"] == len(values)
    assert first["totals"][name]["partial"] == (len(values) < len(expected_rows))
    assert sum(point["coverage"][name]["observed"] for point in first["series"]) == len(values)
beyond = server.create_view(data, dict(query, page=100000))
assert beyond["rows"] == [] and beyond["rowCount"] == first["rowCount"] and beyond["totals"] == first["totals"]
empty = server.create_view(data, {"filters": {"region": ["Нет такого города"]}})
assert empty["rows"] == empty["series"] == [] and empty["rowCount"] == 0
assert all(value == {"value": None, "observed": 0, "total": 0, "partial": False} for value in empty["totals"].values())
assert empty["query"]["page"] == 1 and empty["query"]["pageSize"] == 20

nulls = deepcopy(fixture)
for row in nulls["rows"]:
    row["values"]["received"] = None
    row["values"]["completed"] = 0
missing = server.create_view(nulls, {})
assert missing["totals"]["received"]["value"] is None and missing["totals"]["received"]["partial"]
assert missing["totals"]["completed"]["value"] == 0 and not missing["totals"]["completed"]["partial"]
first["rows"][0]["label"] = "changed"
assert expected_rows[0]["label"] != "changed", "Response mutation must not modify the source"

for invalid in (
    {"unknown": 1}, {"filters": {"oops": []}}, {"filters": {"region": "Москва"}},
    {"filters": {"region": [None]}}, {"page": True}, {"page": 0}, {"page": 1.5},
    {"pageSize": 101}, {"pageSize": 0}, {"page": 9007199254740992},
    {"page": 9007199254740991, "pageSize": 100},
    {"period": {"from": "2026-02-30", "to": "2026-10-20"}},
    {"period": {"from": "2026-10-20", "to": "2026-10-01"}},
    {"period": {"from": "2026-09-30", "to": "2026-10-20"}},
):
    rejects(lambda q=invalid: server.create_view(fixture, q), 400, "Invalid query accepted: " + repr(invalid))
bad_source = deepcopy(fixture)
bad_source["rows"][0]["values"]["received"] = float("nan")
rejects(lambda: server.create_view(bad_source, {}), 500, "Non-finite input accepted")
bad_source = deepcopy(fixture)
bad_source["rows"][1]["id"] = bad_source["rows"][0]["id"]
rejects(lambda: server.create_view(bad_source, {}), 500, "Duplicate observation accepted")
large_mean = deepcopy(fixture)
large_mean["metrics"][0]["aggregation"] = "mean"
for row in large_mean["rows"]:
    row["values"]["received"] = 1e308
assert math.isclose(server.create_view(large_mean, {})["totals"]["received"]["value"], 1e308), "Finite mean overflowed while summing"
long = deepcopy(fixture)
long["period"] = {"from": "2024-01-01", "to": "2025-01-01"}
long["rows"] = []
for i in range(367):
    row = deepcopy(fixture["rows"][0])
    row.update(id=f"day-{i}", date=(date(2024, 1, 1) + timedelta(days=i)).isoformat())
    long["rows"].append(row)
rejects(lambda: server.create_view(long, {}), 400, "Unbounded time series accepted")

store = server.TaskStore(fixture)
body = {"rowId": fixture["rows"][0]["id"], "sourceId": fixture["source"]["id"]}
with ThreadPoolExecutor(max_workers=8) as pool:
    tasks = list(pool.map(lambda _: server.create_task(body, "one-gesture", store), range(20)))
assert all(task == tasks[0] for task in tasks) and len(store.records) == 1, "Concurrent retries created duplicate tasks"
assert tasks[0]["id"] == "demo-task-1" and "Демонстрационное поручение" in tasks[0]["message"]
tasks[0]["id"] = "modified"
assert server.create_task(body, "one-gesture", store)["id"] == "demo-task-1"
rejects(lambda: store.create_task(dict(body, rowId=fixture["rows"][1]["id"]), "one-gesture"), 409, "Same key with different payload accepted")
rejects(lambda: store.create_task(dict(body, sourceId="other-source"), "one-gesture"), 409, "Same key with a different source accepted")
rejects(lambda: store.create_task(dict(body, rowId="missing"), "other"), 404, "Unknown row accepted")
rejects(lambda: store.create_task(dict(body, sourceId="other-source"), "other"), 400, "Unknown source accepted")
for key in (None, "", "x" * 129, "a\nb", "не-ascii"):
    rejects(lambda k=key: store.create_task(body, k), 400, "Invalid idempotency key accepted")
live = deepcopy(fixture)
live["source"]["kind"] = "live"
rejects(lambda: server.TaskStore(live), 400, "Demo action server accepted a real source")

for raw in (b'{"page":1,"page":2}', b'{"page":NaN}', b'{"__proto__":{}}', b'not json', '{}'.encode('utf-16')):
    rejects(lambda value=raw: server.decode_body(value), 400, "Invalid JSON body accepted")
rejects(lambda: server.decode_body(b" " * (server.MAX_BODY + 1)), 413, "Body bound ignored")

# Exercise the real HTTP handler methods without a network listener.
Handler = server.handler_factory(fixture)
def post(path, payload=None, extra=None, raw=None):
    handler = Handler.__new__(Handler)
    handler.path, handler.command = path, "POST"
    handler.server = SimpleNamespace(server_port=8772)
    handler.headers = Message()
    encoded = json.dumps(payload).encode() if raw is None else raw
    headers = {"Host": "127.0.0.1:8772", "Content-Type": "application/json", "Content-Length": str(len(encoded))}
    headers.update(extra or {})
    for key, value in headers.items():
        if value is not None:
            handler.headers[key] = value
    handler.rfile, handler.wfile = BytesIO(encoded), BytesIO()
    result = {"headers": {}}
    handler.send_response = lambda status: result.update(status=status)
    handler.send_header = lambda key, value: result["headers"].update({key: value})
    handler.end_headers = lambda: None
    handler.do_POST()
    result["body"] = json.loads(handler.wfile.getvalue())
    return result

response = post("/api/dashboard", {"pageSize": 2})
assert response["status"] == 200 and len(response["body"]["rows"]) == 2
assert response["headers"]["Cache-Control"] == "no-store" and "Access-Control-Allow-Origin" not in response["headers"]
assert post("/api/dashboard", {}, {"Origin": "https://outside.example"})["status"] == 403
assert post("/api/dashboard", {}, {"Host": "rebound.example:8772"})["status"] == 403
assert post("/api/dashboard", {}, {"Content-Type": "text/plain"})["status"] == 415
assert post("/api/dashboard", {}, {"Content-Length": str(server.MAX_BODY + 1)})["status"] == 413
assert post("/api/dashboard", {}, {"Content-Length": None})["status"] == 411
assert post("/api/dashboard?other=1", {})["status"] == 404
assert post("/api/tasks", body)["status"] == 400
created = post("/api/tasks", body, {"Idempotency-Key": "http-retry"})
assert created["status"] == 200
assert post("/api/tasks", body, {"Idempotency-Key": "http-retry"})["body"] == created["body"]
# GET and HEAD reject a DNS-rebinding Host before serving repository documents.
for method in ("GET", "HEAD"):
    handler = Handler.__new__(Handler)
    handler.path, handler.command = "/README.md", method
    handler.server = SimpleNamespace(server_port=8772)
    handler.headers = Message()
    handler.headers["Host"] = "rebound.example:8772"
    handler.wfile = BytesIO()
    result = {}
    handler.send_response = lambda status: result.update(status=status)
    handler.send_header = lambda key, value: None
    handler.end_headers = lambda: None
    handler.do_GET()
    assert result["status"] == 403
assert server.public_file(ROOT, "/reference-dashboard.html?source=server").name == "reference-dashboard.html"
for name in ("graphite-dark.png", "graphite-light.png"):
    assert server.public_file(ROOT, "/assets/" + name) == ROOT / "assets" / name

for path in ("/.git/config", "/tools/reference-server.py", "/%2e%2e/README.md", "/data/../../README.md", "/js%5csecret.js", "/unrelated.json", "/private-notes.txt"):
    rejects(lambda value=path: server.public_file(ROOT, value), 404, "Unsafe static path accepted")
with tempfile.TemporaryDirectory(prefix="dk-static-boundary-") as directory:
    root = Path(directory)
    (root / "js").mkdir()
    (root / "assets").mkdir()
    (root / "assets/private.png").write_bytes(b"private fixture")
    rejects(lambda: server.public_file(root, "/assets/private.png"), 404, "Unlisted theme asset was exposed")
    (root / "assets/graphite-dark.png").symlink_to(ROOT / "assets/graphite-dark.png")
    rejects(lambda: server.public_file(root, "/assets/graphite-dark.png"), 404, "Theme asset symlink was exposed")
    (root / "js/escape.js").symlink_to(ROOT / "js/dk-util.js")
    rejects(lambda: server.public_file(root, "/js/escape.js"), 404, "Static symlink escape accepted")

print("PASS: 20,000 observations, full-slice totals/series independent of pagination, null/zero/empty, query limits, concurrent idempotency, HTTP/body/origin/static boundaries (no socket opened)")
