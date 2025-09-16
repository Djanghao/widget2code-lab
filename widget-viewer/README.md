# Widget Viewer

Widget Viewer is a static React application for browsing generated widget experiments locally. Drop a run folder that follows the required structure to inspect source images alongside detailed and minimal HTML outputs.

## Features

- Drag-and-drop folder upload with optional manual selection
- Automatic grouping by run, provider, size, and experiment id
- Three synchronized panels: source screenshot, detailed HTML, minimal HTML
- Render and raw views for HTML assets with sandboxed previews
- Responsive layout with shadcn-style components and Tailwind theming

## Getting Started

```bash
npm install
npm run dev
```

The application runs entirely in the browser. No backend services or network calls are needed.

## Usage

1. Build or run the app locally.
2. Drag a complete log folder (for example `output/20250116-013918`) onto the interface or choose it via the upload button.
3. Pick an experiment from the sidebar to view the image and HTML panels.
4. Drop another folder or use Reset to load a different run.

## Expected Folder Layout

```
<run>/<provider>/<size>/<id>/
  <id>.png (optional)
  detailed/<id>.html (optional)
  detailed/<id>.raw.txt (optional)
  minimal/<id>.html (optional)
  minimal/<id>.raw.txt (optional)
```

All parsing happens client-side so the viewer is compatible with GitHub Pages or any static host.
