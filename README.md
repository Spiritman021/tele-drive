# TeleDrive — Unlimited Cloud Storage Powered by Telegram 🚀

TeleDrive is a premium, open-source, unlimited cloud storage client that runs entirely on top of the Telegram API. The application has been fully redesigned to match the exact visual style, layout hierarchy, and user experience of Google Drive, using the Telegram network as a secure, decentralized storage backend.

---

## 🌟 Key Features

### 1. Google Drive UI Redesign
- **Light Theme**: A clean Google-inspired aesthetic utilizing curated, cohesive colors, and modern typography.
- **Collapsible Sidebar**: Left navigation including **Home**, **My Drive** (with collapsible folder hierarchies), **Recent**, **Starred**, and **Storage**.
- **Responsive Layouts**: Supports toggling between **Grid View** (with large file previews) and **List View** (rendered as a Google-style Table showing Name, Owner, Last Modified, and File Size).

### 2. Shared Drives (Telegram Multi-Channel Switcher)
- Turn Telegram channels/groups you belong to into distinct **Google Drive-style "Shared Drives"** (e.g. Personal Drive, Marketing Shared Drive).
- Dynamically reads and writes folder structures inside a pinned JSON message directly inside the active channel context.
- **Read-Only Drives Support**: If a user switches to a drive where they lack administrator/posting rights:
  - Hides the folder context menus, right-clicks, and pin buttons.
  - Grays out/disables the `+ New` sidebar upload button.
  - Displays a red warning banner (`.gd-readonly-banner`) in place of the drag-drop upload zone.

### 3. Tag-Based Organization & Filtering
- Assign multiple tags/hashtags (e.g., `#invoice`, `#receipt`) when uploading or renaming files.
- Clickable tag badges show up under cards and list rows.
- A **Tags** section in the left sidebar allows you to instantly filter files across the entire drive by tag with a single click.

### 4. Reaction-Based Starring
- Stars assigned to files in the UI are synchronized in real-time to Telegram messages using **Heart (`❤️`) reactions**.
- Loads starred states dynamically by checking channel message reaction attributes.

### 5. Unified Upload & Download Transfers Panel
- A bottom-right floating transfers panel (similar to Google Chrome/Drive downloads) reports active progress.
- Tracks upload and download tasks synchronously using circular SVG progress rings.
- Supports minimizing the panel or canceling active transfers.

### 6. File Details Sidebar
- An expandable **File Details Sidebar** panel inside the preview modal showing detailed properties:
  - Name, MIME Type, File Size
  - Parent Folder location
  - Creation Date & Starred/Pinned status
  - Telegram metadata (Message ID & Channel ID)

### 7. Bounds-Protected Context Menus
- Right-click and three-dots context menus dynamically adjust position based on coordinates, preventing the menu from clipping off the screen boundaries.

---

## 🛠️ Technical Stack

- **Framework**: React 19 (Vite, JSX)
- **Telegram Connection**: GramJS (Official MTProto client for JavaScript)
- **Local Cache & Indexing**: Dexie.js (IndexedDB wrapper for segmenting files and folders per drive context)
- **Icons**: Lucide React
- **Styling**: Vanilla CSS (Modern CSS variables, HSL-tailored colors, and keyframe animations)

---

## 🚀 Getting Started

### 1. Prerequisites
You need a Telegram API ID and API Hash. If you don't have them:
1. Log in to [my.telegram.org](https://my.telegram.org/).
2. Go to **API development tools**.
3. Create a new application to obtain your `api_id` and `api_hash`.

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Spiritman021/tele-drive.git
cd tele-drive
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory (using `.env.example` as a template):
```env
VITE_TELEGRAM_API_ID=your_api_id
VITE_TELEGRAM_API_HASH=your_api_hash
```
*(Alternatively, you can input your credentials directly inside the login UI on first launch).*

### 4. Running Locally
Start the development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Build for Production
To bundle the application for production:
```bash
npm run build
```
The built assets will be generated in the `dist/` directory.

---

## 🔒 Security & Privacy

TeleDrive is a client-side web application. It connects **directly** to the Telegram servers via GramJS.
- Your credentials (API ID, API Hash) and Telegram login session string are stored strictly inside your browser's local storage (`localStorage`).
- No backend server is involved, ensuring complete privacy—your files never touch third-party servers.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
