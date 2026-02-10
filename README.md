# klog Dashboard 📊

![klog Dashboard Preview](public/dashboard-preview.png)

A beautiful visual dashboard for [klog](https://github.com/jotaen/klog) time tracking files. Import your `.klg` files, explore your bookings with interactive charts, and filter by time, tags, or free-text search.

## ✨ Features

- **📂 File Import** – Drag & drop files, supports `.klg`, `.klog`, and `.txt`.
- **🔄 Realtime Folder Watch** – Point to a local folder via `KLOG_DATA_DIR` and see changes automatically.
- **📅 Date Range Filter** – Focus on specific time periods.
- **🏷️ Tag Filter** – Multi-select tags to drill into projects.
- **🔍 Free-Text Search** – Search across all summaries, dates, and file names.
- **📊 Interactive Charts** – Daily/weekly/monthly bar chart, tag distribution doughnut, trend line.
- **🗓️ Activity Heatmap** – GitHub-style contribution heatmap.
- **📋 Entries Table** – Sortable, paginated table of all entries with clickable tags.
- **📈 Tag Breakdown** – Visual bar chart of time per tag.
- **📥 Export** – Export filtered data as CSV or JSON.
- **⚡ Keyboard Shortcuts** – `⌘O` to import, `Esc` to clear filters.
- **💾 Persistent State** – Data saved in localStorage between sessions.
- **✨ Demo Data** – Built-in sample data to explore the dashboard immediately.

## 🚀 Quick Start

### Local Development

```bash
npm install

# Default — watches ./public/data for klog files
npm run dev

# Point to a custom folder
KLOG_DATA_DIR=/path/to/your/klog/files npm run dev
```

Open **http://localhost:3000**

### Docker Compose (Recommended)

```bash
# Place your .klg files in ./data/, then:
docker compose up -d
```

Dashboard available at **http://localhost:3000**

The `docker-compose.yaml` mounts `./data` into the container and sets `KLOG_DATA_DIR=/data` automatically.

### Docker (Manual)

```bash
docker build -t klog-dashboard .
docker run -p 3000:3000 -v /path/to/klog/files:/data -e KLOG_DATA_DIR=/data klog-dashboard
```

### Using the GHCR Image

```bash
docker pull ghcr.io/muecahit94/klog-dashboard:latest
docker run -p 3000:3000 -v /path/to/klog/files:/data -e KLOG_DATA_DIR=/data ghcr.io/muecahit94/klog-dashboard:latest
```

## 🔄 Realtime Folder Watch

The dashboard watches a configurable directory for `.klg`, `.klog`, and `.txt` files. When a file is added or modified, the dashboard updates automatically within seconds.

| Method | Configuration |
|--------|--------------|
| **Local dev** | `KLOG_DATA_DIR=/path/to/folder npm run dev` |
| **Docker** | Mount a volume to `/data` (see docker-compose.yaml) |
| **Default** | `./public/data` (if `KLOG_DATA_DIR` is not set) |

> **macOS Note**: If pointing to a Dropbox or iCloud folder, your terminal app may need **Full Disk Access** (System Settings → Privacy & Security → Full Disk Access).

## 📝 klog File Format

The dashboard parses the [klog file format](https://github.com/jotaen/klog/blob/main/Specification.md). Here's a quick reference:

```
2024-01-15
Project work
    8:00 - 12:00 Morning coding #project-alpha #coding
    -30m Lunch break
    13:00 - 17:00 Afternoon work #project-alpha
    1h30m Code review #review

2024-01-16 (8h!)
    9:00am - 5:00pm Full day #project-beta
```

**Supported entry types:**
- **Time ranges**: `8:00 - 17:00`, `9:00am - 5:00pm`
- **Durations**: `2h30m`, `45m`, `-1h`
- **Open ranges**: `9:00 - ?`
- **Tags**: `#project`, `#tag=value`

## 🐳 Docker & CI/CD

- **Docker image** is built and pushed to GHCR on tagged releases.
- **[Release Please](https://github.com/googleapis/release-please)** automates versioning and changelogs via Conventional Commits.
- **[Renovate](https://docs.renovatebot.com/)** keeps dependencies up to date.

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------:|
| Framework | Next.js (standalone) |
| Charts | Chart.js + react-chartjs-2 |
| Styling | Vanilla CSS (dark theme) |
| Container | Node.js (Alpine) |
| CI/CD | GitHub Actions |

## 📁 Project Structure

```
klog-dashboard/
├── src/
│   ├── app/
│   │   ├── api/files/         # API routes for folder watch
│   │   ├── globals.css        # Theme & styles
│   │   ├── layout.js          # Root layout
│   │   └── page.js            # Main dashboard
│   ├── components/
│   │   ├── Charts.js          # Bar, doughnut, line charts
│   │   ├── EntriesTable.js    # Sortable entries table
│   │   ├── FileImport.js      # File import & folder watch
│   │   ├── FilterBar.js       # Date, tag, search filters
│   │   ├── Heatmap.js         # Activity heatmap
│   │   └── SummaryCards.js    # Summary statistics
│   └── lib/
│       └── klogParser.js      # klog file parser
├── Dockerfile
├── docker-compose.yaml
├── renovate.json
└── .github/workflows/
    ├── docker-build.yml       # Build & push on tags
    └── release-please.yml     # Automated releases
```

## 📄 License

MIT
