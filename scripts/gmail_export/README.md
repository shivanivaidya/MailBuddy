# Gmail Export

Local Gmail export pipeline for MailBuddy.

This is Step 1 only:

- Exports raw Gmail messages from the last 2 months.
- Does not anonymize data.
- Does not transform data into the MailBuddy app schema.
- Writes raw data to `data/private/gmail_raw_last_2_months.json`.

Do not commit `data/private/`, `credentials.json`, or `token.json`.

## Setup

1. Create a Google Cloud project.
2. Enable the Gmail API.
3. Configure an OAuth consent screen for local testing.
4. Create OAuth client credentials for a desktop app.
5. Download the OAuth client file as `credentials.json`.
6. Place `credentials.json` in this directory:

   ```bash
   scripts/gmail_export/credentials.json
   ```

7. Create and activate a Python virtual environment:

   ```bash
   cd scripts/gmail_export
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

## Run

From `scripts/gmail_export`:

```bash
python export_gmail.py
```

The first run opens a local OAuth flow in your browser. After authentication,
`token.json` is stored locally in this directory for future runs.

The script prints:

- the Gmail search query
- number of message ids found
- export progress
- output path

## Output

The export is written to:

```text
data/private/gmail_raw_last_2_months.json
```

The output is pretty-printed JSON and contains raw Gmail content. Treat it as
private data.
