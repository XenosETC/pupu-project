# PUPU Landing Page

PUPU is a **PepeCoinClassic derivative** on **Ethereum Classic**. This repo contains the landing page, with a teaser for upcoming **staking**.

## Logo

Place your PUPU coin image in this folder as **`logo.png`** so the hero section displays it.  
If Cursor saved your image in this project’s `assets` folder under a long filename, copy or rename that file to `logo.png` here.

## Run locally

Open `index.html` in a browser, or use a simple static server:

```bash
npx serve .
```

Then open the URL shown (e.g. http://localhost:3000).

## Deploy on Render

This project is ready to deploy as a Render Static Site.

Recommended path:

1. Push this folder to a GitHub, GitLab, or Bitbucket repository.
2. In Render, create a new Blueprint from the repository. Render will detect `render.yaml`.

Manual Static Site settings:

- Build Command: `echo "No build step required for static site"`
- Publish Directory: `.`

## Contents

- **index.html** — Main landing page (hero, about, staking teaser, community)
- **styles.css** — Dark theme with gold accents
- **script.js** — Smooth scroll for nav links
- **assets/logo.png** — Add your PUPU coin logo here

## Customize

- Update the **Community** section with real Twitter/X, Telegram, and Discord links.
- When staking is live, replace the “Coming soon” block with a link and short description.
