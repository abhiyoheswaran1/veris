# Secrets Policy

Agents must never expose secrets.

Rules:

- Do not read `.env` file contents.
- If env files are detected, report paths only.
- Do not print tokens, keys, cookies, or credentials.
- Do not add secrets to generated reports.
- Use placeholder names in docs.
