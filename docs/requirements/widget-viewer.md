# Widget Viewer (Overview)

A clean viewer for browsing and comparing generated widget results, using a shadcn‑style UI.

Do not add comments.

Tech stack: Pure frontend (React + TypeScript + Tailwind + shadcn UI). Deployable as a static SPA.

Constraints: No backend, no server APIs, no network calls. Must work on GitHub Pages.

## Features

- Drag-and-drop to upload a log folder (e.g., `output/20250916-013918`).
- Auto-detect experiments organized by `provider/size/id`.
- Sidebar lists experiments; main area shows the selected experiment.
- Three preview panels: source image, Detailed HTML, Minimal HTML.
- Re-upload (drag-and-drop again) to switch to another log folder.

Notes

- Process files entirely in the browser; do not persist or transmit data.
- Prefer drag-and-drop for folders. Optionally support `input[type="file"][webkitdirectory]` when available.

## Data Layout (Expected)

- `<run>/<provider>/<size>/<id>/`
- Each `<id>` may include:
  - `<id>.png` (optional)
  - `minimal/<id>.html`, `minimal/<id>.raw.txt` (optional)
  - `detailed/<id>.html`, `detailed/<id>.raw.txt` (optional)

## Usage

- Open the app, drag-and-drop a complete log folder (timestamp folder) onto the page (or click Upload and choose a folder when supported).
- Browse the list on the left and view the three-panel preview on the right.

## Deployment

- Build a static SPA and host on GitHub Pages.
- No server required.

## Design

- Minimal, uncluttered interface that shows only essential information.
- Consistent look and feel with shadcn-style components.
