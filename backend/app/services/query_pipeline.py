import json
import uuid
from pathlib import Path
from typing import Any, Callable

from app.core.config import get_settings
from app.core.database import update_query_history
from app.core.permissions import filter_schema_by_tables
from app.models.schemas import CostEstimate, DatabaseSchema, QueryRequest, QueryResponse
from app.services.aggregates import find_matching_aggregate
from app.services.cache import cache_get, cache_set
from app.services.chart_spec import build_chart_spec
from app.services.cost_estimator import estimate_postgres_cost, estimate_sqlite_cost
from app.services.explainer import explain_results, explain_sql
from app.services.postgres_connector import execute_postgres_query
from app.services.query_executor import execute_query
from app.services.schema_sampler import sample_schema_for_question
from app.services.sql_generator import generate_sql
from app.services.sql_validator import SQLValidationError, validate_sql
from app.services.trend_detector import detect_trends

SaveHistoryFn = Callable[..., str]


def _apply_rbac(schema: DatabaseSchema, allowed_tables: list[str] | None) -> DatabaseSchema:
    return filter_schema_by_tables(schema, allowed_tables)


def _normalize_focus_tables(body: QueryRequest, schema: DatabaseSchema) -> list[str] | None:
    if not body.focus_tables:
        return None
    by_lower = {t.name.lower(): t.name for t in schema.tables}
    resolved = [by_lower[n.strip().lower()] for n in body.focus_tables if n.strip().lower() in by_lower]
    return resolved or None


def _build_context(body: QueryRequest) -> str | None:
    parts: list[str] = []
    if body.focus_tables:
        parts.append(
            "User-selected tables (restrict SQL to these tables only): "
            + ", ".join(body.focus_tables)
        )
    if body.clarification:
        parts.append(f"User clarification: {body.clarification}")
    if body.previous_error:
        parts.append(f"Previous error: {body.previous_error}")
    if body.previous_sql:
        parts.append(f"Previous SQL that failed: {body.previous_sql}")
    return "\n".join(parts) if parts else None


def _try_aggregate(database_id: str, question: str, record: dict[str, Any], max_rows: int) -> tuple[list[str], list[dict[str, Any]], int, str] | None:
    agg = find_matching_aggregate(str(database_id), question)
    if not agg:
        return None
    source_type = record.get("source_type", "sqlite_file")
    connection_url = record.get("connection_url")
    if source_type in ("postgres", "redshift") and connection_url:
        cols, rows, ms = execute_postgres_query(
            connection_url,
            agg["query_sql"],
            max_rows,
            read_replica_url=record.get("read_replica_url"),
        )
        return cols, rows, ms, agg["query_sql"]
    return None


def _make_persist(save_history_fn: SaveHistoryFn, retry_id: str | None) -> SaveHistoryFn:
    def persist(
        database_id: str,
        question: str,
        generated_sql: str | None,
        success: bool,
        execution_ms: int | None = None,
        row_count: int | None = None,
        error: str | None = None,
        result_json: str | None = None,
        explanation: str | None = None,
    ) -> str:
        if retry_id:
            return update_query_history(
                retry_id,
                generated_sql=generated_sql,
                success=success,
                execution_ms=execution_ms,
                row_count=row_count,
                error=error,
                result_json=result_json,
                explanation=explanation,
            )
        return save_history_fn(
            database_id,
            question,
            generated_sql,
            success,
            execution_ms=execution_ms,
            row_count=row_count,
            error=error,
            result_json=result_json,
            explanation=explanation,
        )

    return persist


def run_query(
    body: QueryRequest,
    record: dict[str, Any],
    save_history_fn: SaveHistoryFn,
    allowed_tables: list[str] | None = None,
    company_max_rows: int | None = None,
) -> QueryResponse:
    settings = get_settings()
    max_rows = min(company_max_rows or settings.max_query_rows, settings.max_query_rows)
    retry_id = str(body.retry_query_id) if body.retry_query_id else None
    persist = _make_persist(save_history_fn, retry_id)

    schema = _apply_rbac(record["schema"], allowed_tables)
    if not schema.tables:
        query_id = persist(str(body.database_id), body.question, None, False, error="No tables accessible for your role")
        return QueryResponse(id=uuid.UUID(query_id), question=body.question, success=False, error="No tables accessible for your role")

    focus_tables = _normalize_focus_tables(body, schema)
    if body.focus_tables and not focus_tables:
        query_id = persist(str(body.database_id), body.question, None, False, error="Selected tables are not available")
        return QueryResponse(
            id=uuid.UUID(query_id),
            question=body.question,
            success=False,
            error="None of the selected tables are available for this database or your role",
        )

    cache_payload = {
        "db": str(body.database_id),
        "question": body.question,
        "clarification": body.clarification,
        "focus_tables": focus_tables,
        "role": allowed_tables,
    }
    cached = cache_get("query", cache_payload)
    if cached:
        cached["id"] = retry_id or str(uuid.uuid4())
        return QueryResponse(**cached)

    agg_result = _try_aggregate(body.database_id, body.question, record, max_rows)
    if agg_result:
        columns, rows, elapsed_ms, agg_sql = agg_result
        explanation = explain_results(body.question, agg_sql, columns, rows, settings.llm_provider, settings.llm_model)
        result_data = {
            "id": str(uuid.uuid4()),
            "question": body.question,
            "generated_sql": agg_sql,
            "sql_breakdown": "Pre-built aggregate (materialized view)",
            "confidence": 0.95,
            "assumptions": ["Matched pre-built aggregate for faster response"],
            "clarification_needed": False,
            "clarification_message": None,
            "success": True,
            "error": None,
            "execution_ms": elapsed_ms,
            "row_count": len(rows),
            "columns": columns,
            "rows": rows,
            "explanation": explanation,
            "trends": detect_trends(columns, rows),
            "chart": build_chart_spec(columns, rows).model_dump() if rows else None,
            "cost_estimate": None,
        }
        query_id = persist(
            str(body.database_id), body.question, agg_sql, True,
            execution_ms=elapsed_ms, row_count=len(rows),
            result_json=json.dumps(result_data, default=str), explanation=explanation,
        )
        result_data["id"] = query_id
        return QueryResponse(**result_data)

    llm_schema = sample_schema_for_question(
        schema, body.question, allowed_tables, focus_tables=focus_tables,
    )
    context = _build_context(body)
    full_question = body.question
    if context:
        full_question = f"{body.question}\n\nContext:\n{context}"

    try:
        generation = generate_sql(full_question, llm_schema, settings.llm_provider, settings.llm_model, context)
    except RuntimeError as exc:
        query_id = persist(str(body.database_id), body.question, None, False, error=str(exc))
        return QueryResponse(id=uuid.UUID(query_id), question=body.question, success=False, error=str(exc))

    if generation.get("clarification"):
        query_id = persist(str(body.database_id), body.question, None, False, error=generation["clarification"])
        return QueryResponse(
            id=uuid.UUID(query_id),
            question=body.question,
            confidence=generation.get("confidence"),
            assumptions=generation.get("assumptions", []),
            clarification_needed=True,
            clarification_message=generation["clarification"],
            success=False,
        )

    sql = generation.get("sql")
    if not sql:
        query_id = persist(str(body.database_id), body.question, None, False, error="LLM did not generate SQL")
        return QueryResponse(id=uuid.UUID(query_id), question=body.question, success=False, error="LLM did not generate SQL")

    try:
        validated_sql = validate_sql(sql, dialect=schema.dialect)
    except SQLValidationError as exc:
        query_id = persist(str(body.database_id), body.question, sql, False, error=str(exc))
        return QueryResponse(
            id=uuid.UUID(query_id),
            question=body.question,
            generated_sql=sql,
            confidence=generation.get("confidence"),
            assumptions=generation.get("assumptions", []),
            success=False,
            error=f"SQL validation failed: {exc}",
        )

    cost: CostEstimate | None = None
    source_type = record.get("source_type", "sqlite_file")
    connection_url = record.get("connection_url")

    if source_type in ("postgres", "redshift") and connection_url:
        cost = estimate_postgres_cost(connection_url, validated_sql)
    elif isinstance(record.get("file_path"), Path):
        cost = estimate_sqlite_cost(record["file_path"], validated_sql)

    if cost and cost.high_cost and not body.skip_cost_check:
        query_id = persist(
            str(body.database_id), body.question, validated_sql, False,
            error=cost.warning or "Query cost too high",
        )
        return QueryResponse(
            id=uuid.UUID(query_id),
            question=body.question,
            generated_sql=validated_sql,
            cost_estimate=cost,
            success=False,
            error=cost.warning or "Query may scan too many rows. Refine your question or set skip_cost_check=true.",
        )

    try:
        if source_type in ("postgres", "redshift") and connection_url:
            columns, rows, elapsed_ms = execute_postgres_query(
                connection_url, validated_sql, max_rows, read_replica_url=record.get("read_replica_url"),
            )
        else:
            columns, rows, elapsed_ms = execute_query(record["file_path"], validated_sql)
    except Exception as exc:
        query_id = persist(str(body.database_id), body.question, validated_sql, False, error=str(exc))
        return QueryResponse(
            id=uuid.UUID(query_id),
            question=body.question,
            generated_sql=validated_sql,
            confidence=generation.get("confidence"),
            assumptions=generation.get("assumptions", []),
            success=False,
            error=f"Query execution failed: {exc}",
        )

    explanation = explain_results(body.question, validated_sql, columns, rows, settings.llm_provider, settings.llm_model)
    sql_breakdown = explain_sql(validated_sql, settings.llm_provider, settings.llm_model)
    trends = detect_trends(columns, rows)
    chart = build_chart_spec(columns, rows)

    result_data = {
        "id": str(uuid.uuid4()),
        "question": body.question,
        "generated_sql": validated_sql,
        "sql_breakdown": sql_breakdown,
        "confidence": generation.get("confidence"),
        "assumptions": generation.get("assumptions", []),
        "clarification_needed": False,
        "clarification_message": None,
        "success": True,
        "error": None,
        "execution_ms": elapsed_ms,
        "row_count": len(rows),
        "columns": columns,
        "rows": rows,
        "explanation": explanation,
        "trends": trends,
        "chart": chart.model_dump() if chart else None,
        "cost_estimate": cost.model_dump() if cost else None,
    }
    cache_set("query", cache_payload, result_data)

    query_id = persist(
        str(body.database_id),
        body.question,
        validated_sql,
        True,
        execution_ms=elapsed_ms,
        row_count=len(rows),
        result_json=json.dumps(result_data, default=str),
        explanation=explanation,
    )
    result_data["id"] = query_id
    return QueryResponse(**result_data)
