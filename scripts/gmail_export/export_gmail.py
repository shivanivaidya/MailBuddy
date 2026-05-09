#!/usr/bin/env python3
"""Export recent Gmail messages to local raw JSON for later anonymization.

This script intentionally exports raw email data. Do not commit the output,
credentials.json, or token.json.
"""

from __future__ import annotations

import argparse
import base64
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build


SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_OUTPUT_PATH = REPO_ROOT / "data" / "private" / "gmail_raw_last_2_months.json"
DEFAULT_CREDENTIALS_PATH = SCRIPT_DIR / "credentials.json"
DEFAULT_TOKEN_PATH = SCRIPT_DIR / "token.json"


def main() -> None:
    args = parse_args()
    output_path = Path(args.output).expanduser().resolve()
    credentials_path = Path(args.credentials).expanduser().resolve()
    token_path = Path(args.token).expanduser().resolve()

    service = build(
        "gmail",
        "v1",
        credentials=get_credentials(credentials_path, token_path),
    )
    query = build_last_two_months_query()

    print(f'Gmail query: "{query}"')
    message_ids = list_message_ids(service, query)
    print(f"Found {len(message_ids)} message ids")

    messages = []
    for index, message_id in enumerate(message_ids, start=1):
        messages.append(fetch_message(service, message_id))
        if index == 1 or index % 25 == 0 or index == len(message_ids):
            print(f"Exported {index}/{len(message_ids)}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(messages, output_file, ensure_ascii=False, indent=2)
        output_file.write("\n")

    print(f"Exported {len(messages)} messages")
    print(f"Output path: {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export Gmail messages from the last 2 months to raw JSON.",
    )
    parser.add_argument(
        "--credentials",
        default=str(DEFAULT_CREDENTIALS_PATH),
        help="Path to OAuth credentials.json.",
    )
    parser.add_argument(
        "--token",
        default=str(DEFAULT_TOKEN_PATH),
        help="Path to OAuth token.json created after local auth.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Path for the raw Gmail JSON export.",
    )
    return parser.parse_args()


def get_credentials(credentials_path: Path, token_path: Path) -> Credentials:
    credentials = None

    if token_path.exists():
        credentials = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if credentials and credentials.valid:
        return credentials

    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
    else:
        if not credentials_path.exists():
            raise FileNotFoundError(
                f"Missing {credentials_path}. Download OAuth client credentials "
                "from Google Cloud and save them as credentials.json.",
            )

        flow = InstalledAppFlow.from_client_secrets_file(
            str(credentials_path),
            SCOPES,
        )
        credentials = flow.run_local_server(port=0)

    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(credentials.to_json(), encoding="utf-8")
    return credentials


def build_last_two_months_query() -> str:
    after_date = datetime.now(timezone.utc) - timedelta(days=62)
    return f"after:{after_date.strftime('%Y/%m/%d')}"


def list_message_ids(service: Any, query: str) -> list[str]:
    message_ids: list[str] = []
    page_token = None

    while True:
        request: dict[str, Any] = {
            "userId": "me",
            "q": query,
            "maxResults": 500,
        }
        if page_token:
            request["pageToken"] = page_token

        response = service.users().messages().list(**request).execute()
        message_ids.extend(message["id"] for message in response.get("messages", []))

        page_token = response.get("nextPageToken")
        if not page_token:
            return message_ids


def fetch_message(service: Any, message_id: str) -> dict[str, Any]:
    message = (
        service.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )
    payload = message.get("payload", {})
    headers = get_headers(payload)
    body_content = extract_body_content(payload)

    return {
        "gmailMessageId": message.get("id"),
        "gmailThreadId": message.get("threadId"),
        "internalDate": message.get("internalDate"),
        "dateHeader": headers.get("date"),
        "from": headers.get("from"),
        "to": headers.get("to"),
        "cc": headers.get("cc"),
        "bcc": headers.get("bcc"),
        "subject": headers.get("subject"),
        "snippet": message.get("snippet"),
        "plainTextBody": body_content["plainTextBody"],
        "htmlBody": (
            body_content["htmlBody"]
            if not body_content["plainTextBody"]
            else None
        ),
        "labels": message.get("labelIds", []),
        "attachmentFilenames": body_content["attachmentFilenames"],
    }


def get_headers(payload: dict[str, Any]) -> dict[str, str]:
    headers: dict[str, str] = {}

    for header in payload.get("headers", []):
        name = header.get("name")
        value = header.get("value")

        if name and value:
            headers[name.lower()] = value

    return headers


def extract_body_content(payload: dict[str, Any]) -> dict[str, Any]:
    plain_text_parts: list[str] = []
    html_parts: list[str] = []
    attachment_filenames: list[str] = []

    walk_parts(payload, plain_text_parts, html_parts, attachment_filenames)

    plain_text_body = "\n\n".join(part for part in plain_text_parts if part).strip()
    html_body = "\n\n".join(part for part in html_parts if part).strip()

    return {
        "plainTextBody": plain_text_body or None,
        "htmlBody": html_body or None,
        "attachmentFilenames": attachment_filenames,
    }


def walk_parts(
    part: dict[str, Any],
    plain_text_parts: list[str],
    html_parts: list[str],
    attachment_filenames: list[str],
) -> None:
    filename = part.get("filename")
    if filename:
        attachment_filenames.append(filename)

    mime_type = part.get("mimeType")
    decoded_body = decode_body_data(part.get("body", {}).get("data"))

    if decoded_body and mime_type == "text/plain":
        plain_text_parts.append(decoded_body)
    elif decoded_body and mime_type == "text/html":
        html_parts.append(decoded_body)

    for child_part in part.get("parts", []):
        walk_parts(child_part, plain_text_parts, html_parts, attachment_filenames)


def decode_body_data(data: str | None) -> str | None:
    if not data:
        return None

    try:
        raw_bytes = base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))
        return raw_bytes.decode("utf-8", errors="replace")
    except (ValueError, TypeError):
        return None


if __name__ == "__main__":
    main()
