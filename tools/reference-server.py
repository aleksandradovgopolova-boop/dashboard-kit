#!/usr/bin/env python3
"""Local-only demo API for the reference dashboard. No production authentication or storage."""
from __future__ import annotations

import argparse
from collections import defaultdict
from copy import deepcopy
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
from pathlib import Path
import re
from threading import Lock
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
MAX_BODY = 64 * 1024
MAX_PAGE_SIZE = 100
MAX_SERIES = 366
MAX_SAFE_INTEGER = 9007199254740991
FORBIDDEN = {"__proto__", "prototype", "constructor"}
IDENTIFIER = re.compile(r"[a-zA-Z][a-zA-Z0-9_-]*\Z")
TASK_KEY = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")
PUBLIC_ROOT = {
    "index.html", "showcase.html", "reference-dashboard.html", "dashboard.html",
    "regions.html", "accidents.html", "calendar.html", "family-mortgage.html",
    "ai-value.html", "embed.html", "README.md", "DECISIONS.md", "HANDOFF.md",
    "REVIEW.md", "UIUX.md", "DESIGN-UX-ACCESSIBILITY.md",
}


class APIError(ValueError):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def require(condition, message, status=400, code="INVALID_QUERY"):
    if not condition:
        raise APIError(status, code, message)


def object_fields(value, allowed, required=(), message="Некорректные поля объекта."):
    require(type(value) is dict and not (set(value) - set(allowed)) and set(required).issubset(value), message)
    require(not (set(value) & FORBIDDEN), message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def parse_day(value):
    require(isinstance(value, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)), "Ожидается дата YYYY-MM-DD.")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise APIError(400, "INVALID_QUERY", "Недопустимая дата.") from error
    return parsed


def normalize_period(value):
    object_fields(value, {"from", "to"}, {"from", "to"})
    require(parse_day(value["from"]) <= parse_day(value["to"]), "Начало периода позже окончания.")
    return {"from": value["from"], "to": value["to"]}


def normalize_query(value, dimensions, coverage):
    object_fields(value, {"filters", "period", "page", "pageSize"})
    filters = value.get("filters", {})
    require(type(filters) is dict, "Фильтры должны быть объектом.")
    ids = {dimension["id"] for dimension in dimensions}
    require(not set(filters) - ids, "Неизвестный фильтр.")
    normalized = {}
    for name, values in filters.items():
        require(type(values) is list and all(nonempty(v) for v in values), "Значения фильтра должны быть строками.")
        normalized[name] = list(dict.fromkeys(values))
    period = None if value.get("period") is None else normalize_period(value["period"])
    if period:
        require(coverage["from"] <= period["from"] <= period["to"] <= coverage["to"], "Период вне покрытия источника.")
    page, size = value.get("page", 1), value.get("pageSize", 20)
    require(type(page) is int and 1 <= page <= MAX_SAFE_INTEGER, "Номер страницы должен быть положительным целым.")
    require(type(size) is int and 1 <= size <= MAX_PAGE_SIZE, "Размер страницы должен быть от 1 до 100.")
    require((page - 1) * size <= MAX_SAFE_INTEGER, "Смещение страницы вне безопасного диапазона.")
    return {"filters": normalized, "period": period, "page": page, "pageSize": size}


def validate_source(snapshot):
    """Validate the local fixture boundary; never repair missing values into zero."""
    try:
        object_fields(snapshot, {"schemaVersion", "source", "period", "dimensions", "metrics", "rows"}, {"schemaVersion", "source", "period", "dimensions", "metrics", "rows"})
        require(type(snapshot["schemaVersion"]) is int and snapshot["schemaVersion"] == 1, "Неизвестная версия источника.")
        source = snapshot["source"]
        object_fields(source, {"id", "label", "kind", "updatedAt"}, {"id", "label", "kind", "updatedAt"})
        require(nonempty(source["id"]) and nonempty(source["label"]) and source["kind"] in ("demo", "live"), "Некорректное описание источника.")
        timestamp = source["updatedAt"]
        require(isinstance(timestamp, str) and bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})", timestamp)), "Нужно время обновления с часовым поясом.")
        if not timestamp.endswith("Z"):
            require(int(timestamp[-5:-3]) <= 23 and int(timestamp[-2:]) <= 59, "Некорректный часовой пояс.")
        require(datetime.fromisoformat(timestamp.replace("Z", "+00:00")).utcoffset() is not None, "Нужен часовой пояс.")
        coverage = normalize_period(snapshot["period"])
        groups = []
        for name in ("dimensions", "metrics"):
            definitions = snapshot[name]
            require(type(definitions) is list and (bool(definitions) or name == "dimensions"), "Некорректные определения.")
            ids = set()
            for definition in definitions:
                fields = {"id", "label"} | ({"unit", "aggregation", "description"} if name == "metrics" else set())
                object_fields(definition, fields, fields)
                identifier = definition["id"]
                require(isinstance(identifier, str) and bool(IDENTIFIER.fullmatch(identifier)) and identifier not in ids | FORBIDDEN, "Некорректный или повторный идентификатор.")
                require(nonempty(definition["label"]), "Нужно название определения.")
                if name == "metrics":
                    require(nonempty(definition["unit"]) and nonempty(definition["description"]) and definition["aggregation"] in ("sum", "mean"), "Некорректный показатель.")
                ids.add(identifier)
            groups.append(ids)
        require(type(snapshot["rows"]) is list, "Нужен массив строк.")
        seen = set()
        for row in snapshot["rows"]:
            fields = {"id", "label", "date", "dimensions", "values"}
            object_fields(row, fields, fields)
            require(nonempty(row["id"]) and row["id"] not in seen and nonempty(row["label"]), "Некорректная или повторная строка.")
            seen.add(row["id"])
            parse_day(row["date"])
            require(coverage["from"] <= row["date"] <= coverage["to"], "Строка вне покрытия источника.")
            object_fields(row["dimensions"], groups[0], groups[0])
            object_fields(row["values"], groups[1], groups[1])
            require(all(nonempty(v) for v in row["dimensions"].values()), "Нужно значение каждого измерения.")
            require(all(v is None or type(v) in (int, float) and math.isfinite(v) for v in row["values"].values()), "Показатель должен быть конечным числом или null.")
    except (APIError, ValueError, TypeError, OverflowError) as error:
        raise APIError(500, "INVALID_SOURCE", "Демонстрационный источник не соответствует контракту.") from error
    return snapshot


def aggregate(rows, metrics):
    out = {}
    for metric in metrics:
        values = [row["values"][metric["id"]] for row in rows if row["values"][metric["id"]] is not None]
        try:
            # Scale before summing: the mean of two 1e308 values is finite.
            value = (math.fsum(v / len(values) for v in values) if metric["aggregation"] == "mean" else math.fsum(values)) if values else None
            require(value is None or math.isfinite(value), "Агрегация вне числового диапазона.", 500, "INVALID_SOURCE")
        except OverflowError as error:
            raise APIError(500, "INVALID_SOURCE", "Агрегация вне числового диапазона.") from error
        out[metric["id"]] = {"value": value, "observed": len(values), "total": len(rows), "partial": len(values) < len(rows)}
    return out


def create_view(snapshot, query):
    """Aggregate the entire filtered set, then paginate only detail rows."""
    data = validate_source(snapshot)
    query = normalize_query(query, data["dimensions"], data["period"])
    period = query["period"] or data["period"]
    rows = [row for row in data["rows"] if period["from"] <= row["date"] <= period["to"] and all(not values or row["dimensions"][name] in values for name, values in query["filters"].items())]
    groups = defaultdict(list)
    for row in rows:
        groups[row["date"]].append(row)
    require(len(groups) <= MAX_SERIES, "Временной ряд превышает 366 точек; выберите меньший период.")
    series = []
    for day, observations in sorted(groups.items()):
        totals = aggregate(observations, data["metrics"])
        series.append({"date": day, "values": {key: value["value"] for key, value in totals.items()}, "coverage": {key: {"observed": value["observed"], "total": value["total"]} for key, value in totals.items()}})
    offset = (query["page"] - 1) * query["pageSize"]
    return deepcopy({
        "schemaVersion": 1, "mode": "server", "query": query,
        "source": data["source"], "period": period, "dimensions": data["dimensions"], "metrics": data["metrics"],
        "rows": rows[offset:offset + query["pageSize"]], "rowCount": len(rows),
        "totals": aggregate(rows, data["metrics"]), "series": series,
    })


class TaskStore:
    """In-memory demo only. Idempotency lasts until this process exits."""
    def __init__(self, snapshot):
        self.snapshot = deepcopy(validate_source(snapshot))
        require(self.snapshot["source"]["kind"] == "demo", "Поручения доступны только для демонстрационного источника.", 400, "DEMO_ONLY")
        self.rows = {row["id"]: row for row in self.snapshot["rows"]}
        self.records = {}
        self.lock = Lock()

    def create_task(self, body, key):
        require(isinstance(key, str) and bool(TASK_KEY.fullmatch(key)), "Нужен Idempotency-Key длиной до 128 символов.", 400, "INVALID_ACTION")
        object_fields(body, {"rowId", "sourceId"}, {"rowId", "sourceId"})
        require(nonempty(body["rowId"]) and nonempty(body["sourceId"]), "Нужны идентификаторы строки и источника.", 400, "INVALID_ACTION")
        with self.lock:
            previous = self.records.get(key)
            if previous:
                require(previous["body"] == body, "Ключ уже использован для другого поручения.", 409, "IDEMPOTENCY_CONFLICT")
                return deepcopy(previous["result"])
            require(body["sourceId"] == self.snapshot["source"]["id"], "Неизвестный демонстрационный источник.", 400, "INVALID_ACTION")
            row = self.rows.get(body["rowId"])
            require(row is not None, "Строка не найдена.", 404, "ROW_NOT_FOUND")
            require(len(self.records) < 1000, "Достигнут лимит демонстрационных поручений. Перезапустите сервер.", 429, "DEMO_LIMIT")
            task_id = "demo-task-" + str(len(self.records) + 1)
            result = {"id": task_id, "label": row["label"], "message": "Демонстрационное поручение " + task_id + " создано. Оно существует только в памяти этого сервера."}
            self.records[key] = {"body": deepcopy(body), "result": result}
            return deepcopy(result)


def create_task(body, key, store):
    return store.create_task(body, key)


def decode_body(raw):
    require(len(raw) <= MAX_BODY, "Запрос слишком большой.", 413, "INVALID_BODY")
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result and key not in FORBIDDEN, "Недопустимые поля JSON.", 400, "INVALID_BODY")
            result[key] = value
        return result
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=unique, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite")))
    except (ValueError, UnicodeDecodeError, RecursionError) as error:
        raise APIError(400, "INVALID_BODY", "Нужен корректный JSON.") from error


def public_file(root, request_path):
    path = unquote(urlsplit(request_path).path)
    require(path.startswith("/") and "\\" not in path and "\x00" not in path, "Файл недоступен.", 404, "NOT_FOUND")
    parts = path.lstrip("/").split("/") if path != "/" else ["reference-dashboard.html"]
    require(all(part and not part.startswith(".") for part in parts), "Файл недоступен.", 404, "NOT_FOUND")
    require(len(parts) == 1 or parts[0] in {"css", "js", "vendor", "icons", "data", "docs"}, "Файл недоступен.", 404, "NOT_FOUND")
    require(len(parts) != 1 or parts[0] in PUBLIC_ROOT or bool(re.fullmatch(r"component-[a-z0-9-]+\.html", parts[0])), "Файл недоступен.", 404, "NOT_FOUND")
    candidate = root
    for part in parts:
        candidate = candidate / part
        require(not candidate.is_symlink(), "Файл недоступен.", 404, "NOT_FOUND")
    require(candidate.suffix.lower() in {".html", ".css", ".js", ".json", ".topojson", ".svg", ".png", ".woff2", ".md", ".txt", ".webmanifest"} and candidate.is_file(), "Файл недоступен.", 404, "NOT_FOUND")
    return candidate


def handler_factory(snapshot, root=ROOT):
    store = TaskStore(snapshot)
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def send_bytes(self, status, data, content_type):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)

        def json(self, status, value):
            self.send_bytes(status, json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8"), "application/json; charset=utf-8")

        def error(self, error):
            self.json(error.status, {"error": {"code": error.code, "message": error.message}})

        def check_origin(self):
            hosts = self.headers.get_all("Host", [])
            require(len(hosts) == 1 and hosts[0] in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}, "Недопустимый Host.", 403, "ORIGIN_REJECTED")
            origins = self.headers.get_all("Origin", [])
            require(not origins or len(origins) == 1 and origins[0] == "http://" + hosts[0], "Недопустимый Origin.", 403, "ORIGIN_REJECTED")

        def do_GET(self):
            try:
                self.check_origin()
                require(not urlsplit(self.path).path.startswith("/api/"), "API принимает POST.", 405, "METHOD_NOT_ALLOWED")
                path = public_file(root, self.path)
                mime = {".js": "text/javascript", ".json": "application/json", ".topojson": "application/json", ".md": "text/plain"}.get(path.suffix.lower()) or mimetypes.guess_type(path)[0] or "application/octet-stream"
                if mime.startswith("text/") or mime == "application/json":
                    mime += "; charset=utf-8"
                self.send_bytes(200, path.read_bytes(), mime)
            except APIError as error:
                self.error(error)

        do_HEAD = do_GET

        def do_POST(self):
            try:
                require(self.path in ("/api/dashboard", "/api/tasks"), "API не найден.", 404, "NOT_FOUND")
                # A cross-origin web page must not be able to mutate the localhost demo.
                self.check_origin()
                require(not self.headers.get("Transfer-Encoding"), "Transfer-Encoding не поддерживается.", 400, "INVALID_BODY")
                require(self.headers.get("Content-Encoding", "identity") == "identity", "Content-Encoding не поддерживается.", 415, "INVALID_BODY")
                require(self.headers.get_content_type() == "application/json", "Нужен Content-Type application/json.", 415, "INVALID_BODY")
                lengths = self.headers.get_all("Content-Length", [])
                require(len(lengths) == 1 and bool(re.fullmatch(r"[0-9]{1,10}", lengths[0])), "Нужен Content-Length.", 411, "INVALID_BODY")
                length = int(lengths[0])
                require(length <= MAX_BODY, "Запрос слишком большой.", 413, "INVALID_BODY")
                raw = self.rfile.read(length)
                require(len(raw) == length, "Неполное тело запроса.", 400, "INVALID_BODY")
                body = decode_body(raw)
                if self.path == "/api/dashboard":
                    self.json(200, create_view(snapshot, body))
                else:
                    keys = self.headers.get_all("Idempotency-Key", [])
                    require(len(keys) == 1, "Нужен один Idempotency-Key.", 400, "INVALID_ACTION")
                    self.json(200, create_task(body, keys[0], store))
            except APIError as error:
                self.error(error)
            except (TimeoutError, ConnectionError):
                self.close_connection = True

        def log_message(self, format, *args):
            # Request bodies and query strings are not logged.
            print(f"reference-demo: {self.command} {urlsplit(self.path).path}", flush=True)
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8772)
    args = parser.parse_args()
    require(0 <= args.port <= 65535, "Некорректный порт.")
    snapshot = decode_body((ROOT / "data/reference-dashboard.json").read_bytes())
    validate_source(snapshot)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_factory(snapshot))
    print(f"ДЕМО: http://127.0.0.1:{server.server_port}/reference-dashboard.html?source=server", flush=True)
    print("Только локальные тестовые данные. Поручения хранятся в памяти; авторизации и production API нет.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
