import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.core.config import settings
from app.modules.calls.schema import CallLabel

logger = logging.getLogger(__name__)

_LABEL_VALUES = [label.value for label in CallLabel]

_SYSTEM_PROMPT = (
    "You analyze customer phone call transcripts. "
    "Given a transcript, write a concise 2-3 sentence summary and classify the call "
    "into exactly one of these labels: " + ", ".join(_LABEL_VALUES) + ". "
    "Respond ONLY with a JSON object of the form "
    '{"summary": "...", "label": "..."} where label is one of the allowed values.'
)


def _parse_label(raw_label: Optional[str]) -> Optional[CallLabel]:
    if not raw_label:
        return None
    try:
        return CallLabel(raw_label)
    except ValueError:
        for label in CallLabel:
            if label.value.lower() == raw_label.strip().lower():
                return label
        return None


async def enrich_transcript(raw_transcript: str) -> tuple[Optional[str], Optional[CallLabel]]:
    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not set; skipping AI enrichment")
        return None, None

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Transcript:\n{raw_transcript}"},
            ],
        )
        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        summary = parsed.get("summary")
        label = _parse_label(parsed.get("label"))
        return summary, label
    except Exception:
        logger.exception("OpenAI enrichment failed; leaving summary and label null")
        return None, None
