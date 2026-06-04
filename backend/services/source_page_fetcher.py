# PHASE 4 STEP 21
import re
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


MAX_SOURCE_EXCERPT_CHARS = 5500
SOURCE_FETCH_TIMEOUT_SECONDS = 9
SOURCE_FETCH_USER_AGENT = (
    "FactLensBot/1.0 (+https://factlens.app; source support precheck; contact: support@factlens.app)"
)


def normalize_fetch_url(url: str | None) -> str:
    normalized_url = str(url or "").strip()

    if not normalized_url:
        return ""

    if not normalized_url.startswith(("http://", "https://")):
        normalized_url = f"https://{normalized_url}"

    parsed_url = urlparse(normalized_url)

    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc or re.search(r"\s", parsed_url.netloc):
        return ""

    return normalized_url


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_meta_description(soup: BeautifulSoup) -> str:
    for selector in [
        {"name": "description"},
        {"property": "og:description"},
        {"name": "twitter:description"},
    ]:
        tag = soup.find("meta", attrs=selector)
        content = tag.get("content") if tag else None

        if content:
            return collapse_whitespace(str(content))

    return ""


def extract_readable_text(soup: BeautifulSoup) -> str:
    for tag_name in ["script", "style", "nav", "footer", "header", "aside", "noscript", "svg"]:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    candidate = soup.find("article") or soup.find("main") or soup.body or soup
    text = candidate.get_text(" ", strip=True)
    text = collapse_whitespace(text)

    return text[:MAX_SOURCE_EXCERPT_CHARS]


def fetch_source_page(url: str | None) -> dict:
    fetch_url = normalize_fetch_url(url)

    if not fetch_url:
        return {
            "status": "failed",
            "title": "",
            "meta_description": "",
            "excerpt": "",
            "error": "Invalid or missing source URL.",
        }

    try:
        response = requests.get(
            fetch_url,
            timeout=SOURCE_FETCH_TIMEOUT_SECONDS,
            headers={
                "User-Agent": SOURCE_FETCH_USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            allow_redirects=True,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        return {
            "status": "failed",
            "title": "",
            "meta_description": "",
            "excerpt": "",
            "error": str(error)[:300],
        }

    content_type = response.headers.get("content-type", "").lower()

    if "html" not in content_type and "text/plain" not in content_type:
        return {
            "status": "failed",
            "title": "",
            "meta_description": "",
            "excerpt": "",
            "error": f"Unsupported content type: {content_type or 'unknown'}",
        }

    soup = BeautifulSoup(response.text, "html.parser")
    title = collapse_whitespace(soup.title.get_text(" ", strip=True)) if soup.title else ""
    meta_description = extract_meta_description(soup)
    excerpt = extract_readable_text(soup)

    if not excerpt:
        return {
            "status": "failed",
            "title": title,
            "meta_description": meta_description,
            "excerpt": "",
            "error": "No readable text found.",
        }

    return {
        "status": "read",
        "title": title,
        "meta_description": meta_description,
        "excerpt": excerpt,
        "error": "",
    }
