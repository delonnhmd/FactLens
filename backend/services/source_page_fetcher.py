# PHASE 4 STEP 21
# PHASE 4 STEP 21B
# PHASE 4 STEP 27
import ipaddress
import re
import socket
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


MAX_SOURCE_EXCERPT_CHARS = 5500
MAX_SOURCE_HTML_BYTES = 750_000
SOURCE_FETCH_TIMEOUT_SECONDS = 9
SOURCE_FETCH_USER_AGENT = (
    "FactFightBot/1.0 (+https://factfight.com; source support precheck; contact: support@factfight.com)"
)
BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain"}
SAFE_SOURCE_FETCH_ERROR = "We could not automatically read this source. Community review can still continue."


def build_failed_source_page(
    title: str = "",
    meta_description: str = "",
    excerpt: str = "",
) -> dict:
    return {
        "status": "failed",
        "title": title,
        "meta_description": meta_description,
        "excerpt": excerpt,
        "error": SAFE_SOURCE_FETCH_ERROR,
    }


# PHASE 4 STEP 27
def is_blocked_ip_address(address: str) -> bool:
    try:
        ip_address = ipaddress.ip_address(address)
    except ValueError:
        return False

    return (
        ip_address.is_private
        or ip_address.is_loopback
        or ip_address.is_link_local
        or ip_address.is_multicast
        or ip_address.is_reserved
        or ip_address.is_unspecified
    )


# PHASE 4 STEP 27
def is_blocked_hostname(hostname: str) -> bool:
    normalized_hostname = hostname.strip(".").lower()

    if not normalized_hostname or normalized_hostname in BLOCKED_HOSTNAMES:
        return True

    try:
        return is_blocked_ip_address(normalized_hostname)
    except Exception:
        pass

    try:
        resolved_addresses = {
            result[4][0]
            for result in socket.getaddrinfo(normalized_hostname, None)
            if result and len(result) >= 5
        }
    except socket.gaierror:
        return True

    if not resolved_addresses:
        return True

    return any(is_blocked_ip_address(address) for address in resolved_addresses)


def normalize_fetch_url(url: str | None) -> str:
    normalized_url = str(url or "").strip()

    if not normalized_url:
        return ""

    if not normalized_url.startswith(("http://", "https://")):
        normalized_url = f"https://{normalized_url}"

    parsed_url = urlparse(normalized_url)

    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc or re.search(r"\s", parsed_url.netloc):
        return ""

    if is_blocked_hostname(parsed_url.hostname or ""):
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


def read_limited_response_text(response: requests.Response) -> str:
    chunks: list[bytes] = []
    total_bytes = 0

    for chunk in response.iter_content(chunk_size=16_384):
        if not chunk:
            continue

        chunks.append(chunk)
        total_bytes += len(chunk)

        if total_bytes >= MAX_SOURCE_HTML_BYTES:
            break

    raw_html = b"".join(chunks)[:MAX_SOURCE_HTML_BYTES]
    encoding = response.encoding or "utf-8"

    return raw_html.decode(encoding, errors="replace")


def fetch_source_page(url: str | None) -> dict:
    fetch_url = normalize_fetch_url(url)

    if not fetch_url:
        return build_failed_source_page()

    try:
        response = requests.get(
            fetch_url,
            timeout=SOURCE_FETCH_TIMEOUT_SECONDS,
            stream=True,
            headers={
                "User-Agent": SOURCE_FETCH_USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            allow_redirects=True,
        )
        response.raise_for_status()
        if not normalize_fetch_url(response.url):
            response.close()
            return build_failed_source_page()
    except requests.RequestException as error:
        print(f"[source fetch] failed: {type(error).__name__}", flush=True)
        return build_failed_source_page()

    try:
        content_type = response.headers.get("content-type", "").lower()

        if "html" not in content_type and "text/plain" not in content_type:
            return build_failed_source_page()

        html = read_limited_response_text(response)
        soup = BeautifulSoup(html, "html.parser")
        title = collapse_whitespace(soup.title.get_text(" ", strip=True)) if soup.title else ""
        meta_description = extract_meta_description(soup)
        excerpt = extract_readable_text(soup)
    except Exception as error:
        print(f"[source fetch] parse failed: {type(error).__name__}", flush=True)
        return build_failed_source_page()
    finally:
        response.close()

    if not excerpt:
        return build_failed_source_page(title=title, meta_description=meta_description)

    return {
        "status": "read",
        "title": title,
        "meta_description": meta_description,
        "excerpt": excerpt,
        "error": "",
    }
