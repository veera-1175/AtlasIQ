import json

from app.core.config import get_settings


def explain_results(
    question: str,
    sql: str,
    columns: list[str],
    rows: list[dict],
    provider: str = "groq",
    model: str = "",
) -> str:
    settings = get_settings()
    preview = rows[:10]
    prompt = f"""Summarize these database query results in 2-3 plain English sentences for a business user.

Question: {question}
SQL: {sql}
Columns: {columns}
Results (up to 10 rows): {json.dumps(preview, default=str)}

Be specific with numbers. Do not mention SQL or technical terms."""

    if provider == "openai" and settings.openai_api_key:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=model or "gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return (response.choices[0].message.content or "").strip()

    if settings.groq_api_key:
        from langchain_core.messages import HumanMessage
        from langchain_groq import ChatGroq

        llm = ChatGroq(
            model=model or "llama-3.3-70b-versatile",
            groq_api_key=settings.groq_api_key,
            temperature=0.3,
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()

    if not rows:
        return "No results found for your question."
    return f"Found {len(rows)} row(s). Top result: {preview[0]}"


def explain_sql(sql: str, provider: str = "groq", model: str = "") -> str:
    settings = get_settings()
    prompt = f"""Explain this SQL query in plain English for a non-technical business user (2-3 sentences).
Do not repeat the SQL verbatim.

SQL: {sql}"""

    if provider == "openai" and settings.openai_api_key:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=model or "gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        return (response.choices[0].message.content or "").strip()

    if settings.groq_api_key:
        from langchain_core.messages import HumanMessage
        from langchain_groq import ChatGroq

        llm = ChatGroq(
            model=model or "llama-3.3-70b-versatile",
            groq_api_key=settings.groq_api_key,
            temperature=0.2,
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()

    return "This query retrieves data matching your question from the database."
