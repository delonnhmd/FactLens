"""Per-claim translation via OpenAI, used by POST /api/claims/{claim_id}/translate.

Translation only — the prompt forbids commentary, opinions, and fact-checking.
Results are cached in public.claim_translations (migration 054) so each
claim+language pair costs at most one OpenAI call.
"""

import os

from pydantic import BaseModel

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - SDK missing locally
    OpenAI = None


SUPPORTED_TRANSLATION_LANGUAGES = {"en", "vi", "zh", "es"}

_LANGUAGE_NAMES = {
    "en": "English",
    "vi": "Vietnamese",
    "zh": "Chinese (Simplified)",
    "es": "Spanish",
}


class ClaimTranslationResult(BaseModel):
    title: str
    description: str


def get_translation_model() -> str:
    return os.environ.get("OPENAI_TRANSLATION_MODEL", "gpt-4.1-mini")


def translate_claim_text(title: str, description: str, target_language: str) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if not api_key or OpenAI is None:
        return {"ok": False, "error": "Translation is unavailable right now."}

    language_name = _LANGUAGE_NAMES.get(target_language)

    if not language_name:
        return {"ok": False, "error": "Unsupported translation language."}

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.parse(
            model=get_translation_model(),
            temperature=0,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You translate user-submitted claim text. Preserve meaning exactly. "
                        "Do not add commentary, opinions, or fact-check the content — translate only. "
                        'Return JSON {"title":"...","description":"..."}.'
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Translate the following claim title and description into {language_name}.\n\n"
                        f"Title: {title}\n\nDescription: {description}"
                    ),
                },
            ],
            text_format=ClaimTranslationResult,
        )
        parsed = getattr(response, "output_parsed", None)

        if parsed is None:
            return {"ok": False, "error": "Translation failed. Please try again."}

        translated_title = str(parsed.title or "").strip()
        translated_description = str(parsed.description or "").strip()

        if not translated_title:
            return {"ok": False, "error": "Translation failed. Please try again."}

        return {"ok": True, "title": translated_title, "description": translated_description}
    except Exception as error:
        print("[claims/translate] openai error:", str(error), flush=True)
        return {"ok": False, "error": "Translation failed. Please try again."}
