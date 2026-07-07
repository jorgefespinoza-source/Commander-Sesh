# One-time setup: Google service account (write access)

The read pipeline (`build-data.mjs`) needs nothing. To let the pipeline **write**
new games into the sheet (`append-to-sheet.mjs`), do this once. ~10 minutes.

## 1. Create the service account

1. Go to <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → Library →** search "Google Sheets API" → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   - Name it e.g. `commander-sesh-writer`. Skip the optional role steps → **Done**.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. This is the secret — treat it like a password.

## 2. Give it access to the sheet

1. Open the downloaded JSON, copy the `client_email`
   (looks like `commander-sesh-writer@...iam.gserviceaccount.com`).
2. In the Google Sheet → **Share** → paste that email → give it **Editor** →
   send. (No email actually goes anywhere; it just grants the robot access.)

## 3. Store the key

**Local use:** put the file at `commander-sesh/secrets/sa.json`
(the `secrets/` folder is gitignored). Then:

```bash
GOOGLE_SA_KEY=./secrets/sa.json node scripts/append-to-sheet.mjs rows.json --dry-run
```

**GitHub Action (optional, for fully unattended writes):**
1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `GOOGLE_SA_JSON`. Value: paste the entire contents of the JSON file.
3. A workflow step can then read `${{ secrets.GOOGLE_SA_JSON }}` into the
   `GOOGLE_SA_JSON` env var and run the append script.

## Security notes

- The key file must **never** be committed. `.gitignore` already blocks
  `secrets/`, `*sa*.json`, and `service-account*.json`.
- If a key ever leaks, delete it in the Cloud Console (Keys tab) and make a new one.
- The account can only touch sheets you explicitly shared with it — nothing else.
