# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A semiconductor spot price dashboard (반도체 시세 대시보드). It has two components:

1. **`index.html`** — A static single-page web app that fetches price data from a publicly published Google Sheets CSV and renders it as price cards + Chart.js line charts. No build step; open directly in a browser or deploy as a static file.

2. **`apps-script.js`** — Google Apps Script code that runs inside a Google Sheets spreadsheet. It auto-collects prices daily from DRAMeXchange, stores them in the `시세` sheet, and serves a mobile-friendly approval/manual-entry form as a Google Apps Script Web App.

## Architecture

```
DRAMeXchange (HTML scrape)
        ↓
Google Apps Script (apps-script.js)
  - Daily trigger at 9am KST (weekdays only)
  - Writes "임시" (pending) rows to Google Sheets
  - Serves mobile input form for approval/manual entry
        ↓
Google Sheets ("시세" sheet, published as CSV)
        ↓
index.html
  - Fetches SHEET_CSV_URL on load
  - Falls back to generated demo data if fetch fails
  - Renders DRAM + NAND price cards and Chart.js history chart
```

**Data columns in the sheet:** `date, ddr5_16gb, ddr4_8gb, ddr3_4gb, nand_tlc_512, nand_mlc_64, status`

**Row status lifecycle:** `임시` (auto-collected, yellow background) → `확정` (approved/manual, no background)

## Key configuration

In `index.html`, the only value that needs updating per deployment:
```javascript
const SHEET_CSV_URL = '...'; // Google Sheets CSV publish URL
```

The `PRODUCTS` array in both `index.html` and `apps-script.js` must be kept in sync if items are added or changed.

## Deployment

- **`index.html`**: Deploy as a static file to GitHub Pages, Netlify, or any static host. The file is self-contained.
- **`apps-script.js`**: Paste into Google Apps Script editor (Extensions > Apps Script in the target spreadsheet), then run `초기설정()` once to create the sheet header and set up the daily trigger.
- **`appsscript.json`**: The Apps Script manifest. Copy alongside `apps-script.js` into the Apps Script project.

## Running locally

Open `index.html` directly in a browser. If `SHEET_CSV_URL` is set, it fetches live data; otherwise it generates 60 days of random demo data for testing.

There is no package manager, build tool, or test suite.
