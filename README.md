<div align="center">

<img src="public/favicon.svg" width="80" height="80" alt="TeleDrive Logo" />

# TeleDrive

### Unlimited cloud storage — powered entirely by Telegram

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Telegram](https://img.shields.io/badge/Backend-Telegram%20MTProto-26A5E4?logo=telegram)](https://core.telegram.org/mtproto)
[![React](https://img.shields.io/badge/UI-React%2019-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?logo=vite)](https://vite.dev)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)

</div>

---

TeleDrive turns the Telegram network into a full-featured, **unlimited cloud drive**. It connects directly to Telegram's MTProto API via GramJS — no proprietary backend, no third-party servers. Your files go straight to Telegram and nowhere else. The interface mirrors the familiar feel of Google Drive, making it instantly usable for anyone.

---

## Features

### Unlimited Storage
Telegram imposes no storage quota on your account. TeleDrive exposes that directly — upload files up to 4 GB each, with zero storage limits.

### Progressive Media Streaming
Videos and audio files begin playing **instantly** in the preview modal. Instead of downloading the entire file into memory first, TeleDrive uses a Service Worker to intercept HTTP range requests and fetch only the bytes the player needs from Telegram — exactly how native streaming apps work.

### Progressive Web App (PWA)
TeleDrive is fully installable on **every major operating system** — macOS, Windows, Linux, Android, and iOS — without an App Store or dedicated installer. Install it from your browser address bar for a standalone, app-like experience with offline support.

### Multi-Drive (Shared Drives)
Any Telegram channel or group you belong to can act as a separate drive. Switch between them instantly from the sidebar channel picker. Each drive maintains its own folder structure, stored in a pinned metadata message inside the channel. Channels where you lack posting rights automatically become **read-only drives** — upload controls are disabled and a clear banner is displayed.

### Folder Hierarchy
Create named folders inside any drive and organize your files freely. Folder structure is stored as JSON in a pinned Telegram message, keeping everything inside Telegram with no external database.

### Tag-Based Organization
Assign hashtag labels (e.g. `#invoice`, `#design`, `#2024`) to files at upload time or when renaming. A collapsible **Tags** section in the sidebar lets you filter the entire drive to files matching a tag with a single click.

### Reaction-Synced Starring
Starring a file writes a ❤️ reaction to that Telegram message. The starred state is fetched live from Telegram reactions — it persists across devices and sessions without any separate database.

### File Preview Modal
A rich preview modal supports in-browser viewing of:
- **Images** — with pan and zoom controls
- **Videos** — streamed progressively, no wait time
- **Audio** — streamed progressively with waveform card UI
- **PDFs** — embedded viewer
- **Word documents (DOCX)** — rendered inline via `docx-preview`
- **Plain text, code, markdown, CSV, JSON** — syntax-aware preview with truncation guard for large files

### Transfers Panel
A persistent bottom-right panel tracks all active uploads and downloads with animated SVG progress rings, file names, and live percentage display — similar to Chrome's download shelf.

### Pinned Files
Pin important files to the top of any folder. Pin state syncs to Telegram's native message pin functionality, so pinned files appear at the top across clients.

### Right-Click Context Menus
Viewport-aware context menus (right-click or three-dot menu) detect screen edges and flip their position automatically so they never clip off screen.

---

## Technology

| Layer | Technology |
|---|---|
| UI Framework | React 19 (Vite, JSX) |
| Telegram API | GramJS — MTProto client for JavaScript |
| Local Indexing | Dexie.js (IndexedDB) |
| Media Streaming | Service Worker + HTTP Range Requests |
| Icons | Lucide React |
| Styling | Vanilla CSS — CSS variables, HSL palettes, keyframe animations |
| PWA | Web App Manifest + Service Worker caching |

---

## Getting Started

### Prerequisites

You need a Telegram **API ID** and **API Hash**.

1. Visit [my.telegram.org](https://my.telegram.org) and sign in.
2. Go to **API development tools**.
3. Create a new application — Telegram will generate your `api_id` and `api_hash`.

> These credentials authenticate your GramJS client directly with Telegram's servers. They are never sent anywhere else.

### Install & Run

```bash
git clone https://github.com/Spiritman021/tele-drive.git
cd tele-drive
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Environment

You can optionally pre-fill your credentials via a `.env` file (copy from `.env.example`):

```env
VITE_TELEGRAM_API_ID=your_api_id
VITE_TELEGRAM_API_HASH=your_api_hash
```

Alternatively, enter them directly in the login screen on first launch — they are only stored in your browser's `localStorage`.

### Production Build

```bash
npm run build
```

Output is written to `dist/`. Deploy anywhere that serves static files (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.).

---

## Privacy & Security

TeleDrive is a **fully client-side application**. It runs entirely in your browser.

- All Telegram communication happens over the official MTProto protocol, directly from your browser to Telegram's servers.
- Your API credentials and session string are stored only in your browser's `localStorage` — never transmitted to any third party.
- There is no backend server, no analytics, no tracking.
- The Service Worker used for media streaming only intercepts requests on the `/stream/` path — it does not touch any other network traffic.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.
