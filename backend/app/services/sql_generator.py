import json
import re

from app.core.config import get_settings
from app.models.schemas import DatabaseSchema
from app.services.schema_extractor import schema_to_prompt

FEW_SHOT_EXAMPLES = """
Example 1:
Question: Which region had the highest revenue in Q1?
SQL: SELECT region, SUM(revenue) AS total_revenue FROM sales WHERE quarter = 'Q1' GROUP BY region ORDER BY total_revenue DESC LIMIT 1

Example 2:
Question: How many customers are in each region?
SQL: SELECT region, COUNT(*) AS customer_count FROM customers GROUP BY region ORDER BY customer_count DESC

Example 3:
Question: What is the total revenue by quarter?
SQL: SELECT quarter, SUM(revenue) AS total_revenue FROM sales GROUP BY quarter ORDER BY quarter
"""


def _build_prompt(question: str, schema: DatabaseSchema, context: str | None = None) -> str:
    schema_text = schema_to_prompt(schema)
    context_block = f"\nAdditional context from user:\n{context}\n" if context else ""
    dialect_rules = (
        "For PostgreSQL, use standard PostgreSQL syntax (ILIKE, ::type casts)."
        if schema.dialect == "postgres"
        else "For SQLite, use standard SQLite syntax."
    )
    focus_rule = ""
    if context and "User-selected tables" in context:
        focus_rule = (
            "\n- The user already selected specific focus tables in context; "
            "restrict SQL to those tables only and do NOT ask them to narrow tables or warn about scanning large data"
        )

    return f"""You are an expert SQL analyst. Generate a safe read-only SQL query for the user's question.
{context_block}

Database dialect: {schema.dialect}

Schema:
{schema_text}

Rules:
- Output ONLY valid JSON with keys: sql, confidence (0-1), assumptions (array of strings)
- Use ONLY SELECT statements (WITH/CTE allowed); UNION/UNION ALL between SELECTs is allowed
- Use exact table and column names from the schema
- If the question is ambiguous about metrics or time range, set sql to null and add "clarification" key with a question for the user
- Never use DELETE, DROP, UPDATE, INSERT, or DDL
- Add LIMIT 100 unless user asks for all rows or aggregation makes rows small
- For complex multi-step questions, use WITH clauses (CTEs)
- {dialect_rules}
- If previous SQL failed, fix the error using the context provided{focus_rule}

{FEW_SHOT_EXAMPLES}

User question: {question}

Respond with JSON only, no markdown fences."""


def _parse_llm_json(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _call_groq(prompt: str, model: str, api_key: str) -> str:
    from langchain_core.messages import HumanMessage
    from langchain_groq import ChatGroq

    llm = ChatGroq(
        model=model or "llama-3.3-70b-versatile",
        groq_api_key=api_key,
        temperature=0.1,
        timeout=30,
        max_retries=1,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    return response.content


def _call_openai(prompt: str, model: str, api_key: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model or "gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return response.choices[0].message.content or ""


def generate_sql(
    question: str,
    schema: DatabaseSchema,
    provider: str = "groq",
    model: str = "",
    context: str | None = None,
) -> dict:
    settings = get_settings()
    prompt = _build_prompt(question, schema, context)

    if provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        raw = _call_openai(prompt, model, settings.openai_api_key)
    else:
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        raw = _call_groq(prompt, model, settings.groq_api_key)

    try:
        data = _parse_llm_json(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"LLM returned invalid JSON: {raw[:200]}") from exc

    if data.get("clarification"):
        return {
            "sql": None,
            "confidence": data.get("confidence", 0.0),
            "assumptions": data.get("assumptions", []),
            "clarification": data["clarification"],
        }

    return {
        "sql": data.get("sql"),
        "confidence": float(data.get("confidence", 0.5)),
        "assumptions": data.get("assumptions", []),
        "clarification": None,
    }
