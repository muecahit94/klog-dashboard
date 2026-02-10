# klog Dashboard 📊

A beautiful visual dashboard for [klog](https://github.com/jotaen/klog) time tracking files. Import your `.klg` files, explore your bookings with interactive charts, and filter by time, tags, or free-text search.

## ✨ Features

- **📂 File Import** – Drag & drop files or entire folders, supports `.klg` and `.txt`
- **📅 Date Range Filter** – Focus on specific time periods
- **🏷️ Tag Filter** – Multi-select tags to drill into projects
- **🔍 Free-Text Search** – Search across all summaries, dates, and file names
- **📊 Interactive Charts** – Daily/weekly/monthly bar chart, tag distribution doughnut, trend line
- **🗓️ Activity Heatmap** – GitHub-style contribution heatmap
- **📋 Entries Table** – Sortable, paginated table of all entries with clickable tags
- **📈 Tag Breakdown** – Visual bar chart of time per tag
- **📥 Export** – Export filtered data as CSV or JSON
- **⚡ Keyboard Shortcuts** – `⌘O` to import, `Esc` to clear filters
- **💾 Persistent State** – Data saved in localStorage between sessions
- **✨ Demo Data** – Built-in sample data to explore the dashboard immediately

## 🚀 Quick Start

### Docker Compose (Recommended)

```bash
docker compose up -d
```

Dashboard available at **http://localhost:3000**

### Docker

```bash
docker build -t klog-dashboard .
docker run -p 3000:80 klog-dashboard
```

### Local Development

```bash
npm install
npm run dev
```

Open **http://localhost:3000**

### Production Build

```bash
npm run build
# Static files generated in ./out/
```

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

## 🐳 Docker Image

The Docker image is automatically built and pushed to GitHub Container Registry on every push to `main`.

```bash
# Pull the latest image
docker pull ghcr.io/<your-username>/klog-dashboard:latest

# Run it
docker run -p 3000:80 ghcr.io/<your-username>/klog-dashboard:latest
```

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (static export) |
| Charts | Chart.js + react-chartjs-2 |
| Styling | Vanilla CSS (dark theme) |
| Container | Nginx (Alpine) |
| CI/CD | GitHub Actions |

## 📁 Project Structure

```
klog-dashboard/
├── src/
│   ├── app/
│   │   ├── globals.css      # Theme & styles
│   │   ├── layout.js        # Root layout
│   │   └── page.js          # Main dashboard
│   ├── components/
│   │   ├── Charts.js        # Bar, doughnut, line charts
│   │   ├── EntriesTable.js  # Sortable entries table
│   │   ├── FileImport.js    # File/folder import
│   │   ├── FilterBar.js     # Date, tag, search filters
│   │   ├── Heatmap.js       # Activity heatmap
│   │   └── SummaryCards.js   # Summary statistics
│   └── lib/
│       └── klogParser.js    # klog file parser
├── Dockerfile
├── docker-compose.yaml
├── nginx.conf
└── .github/workflows/
    └── docker-build.yml
```

## 📄 License

MIT
