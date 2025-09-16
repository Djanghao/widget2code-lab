# Widget2HTML via Provider Hub

Convert phone widget screenshots to HTML using Provider Hub with Qwen or Doubao vision models.

**Quick Start**
- **Install:** `pip install provider_hub`
- **Env keys:** `cp .env.example .env` then set `DASHSCOPE_API_KEY` (Qwen) and `ARK_API_KEY` (Doubao).
- **Images:** Place PNG/JPG/WebP under a folder (subfolders supported).

**Run**
- **Qwen (vision):**
  - `python scripts/batch_widget2html.py --input-dir data/ios/small --model qwen-vl-plus --limit 3`
- **Doubao (vision):**
  - `python scripts/batch_widget2html.py --input-dir data/android/small --model doubao-seed-1-6-vision-250815 --limit 3`
- **Select prompts:**
  - Use only detailed: `--prompt-choice detailed`
  - Use only minimal: `--prompt-choice minimal`
  - Use both (default): `--prompt-choice both`
- **Enable thinking (provider-specific):**
  - Doubao: `--thinking` (maps to `{"type": "enabled"}`)
  - Qwen3 series: `--thinking` (maps to `True`)

**Prompts**
- **detailed**: Enforces centered widget in viewport and transparent background; avoids JS; uses placeholders for images/icons.
- **minimal**: Asks for only the HTML code with no extra explanation.
- Both prompts use the same post-processing that extracts content inside ```html code fences if present.

**Output**
- **Path:** `output/<YYYYMMDD-HHMMSS>/<model>/...`
  - If `--thinking` is used, model folder becomes `<model>-thinking`.
- **Per image folder:** `.../<subdirs>/<image-stem>/`
  - Original image copy (same filename).
  - `detailed/<image-stem>.html` and `detailed/<image-stem>.raw.txt`.
  - `minimal/<image-stem>.html` and `minimal/<image-stem>.raw.txt`.
- **Run log:** `run_info.json` written at start and updated during run
  - Includes: model, prompts used (`detailed`, `minimal`), input_dir, images, params
  - Per-image: folder path, per-prompt html/raw paths, and whether ```html fenced extraction was used

**Post-processing**
- If the model response contains a ```html fenced block, only the content inside is saved to the `.html` file.
- Otherwise, the raw response text is saved as HTML.

**Options**
- `--input-dir`: Folder containing images (recursively scanned).
- `--model`: `qwen-vl-plus` or `doubao-seed-1-6-vision-250815`.
- `--limit`: Limit number of processed images.
- `--temperature`: Sampling temperature (default 0.2).
- `--max-tokens`: Max completion tokens (default 2048).
- `--output-dir`: Root output folder (default `output`).
- `--prompt-choice`: `detailed|minimal|both` (default `both`).
- `--thinking`: Enable provider-specific thinking if supported (Doubao, Qwen3).

**Examples**
- Both prompts, Qwen, with thinking off:
  - `python scripts/batch_widget2html.py --input-dir data/ios/small --model qwen-vl-plus`
- Only minimal prompt, Doubao, with thinking on (note output folder suffix `-thinking`):
  - `python scripts/batch_widget2html.py --input-dir data/android/small --model doubao-seed-1-6-vision-250815 --prompt-choice minimal --thinking`

**Notes**
- Supported image extensions: `.png`, `.jpg`, `.jpeg`, `.webp`.
- Ensure your API keys are valid; the script will call the selected provider for each image.
 - To change the instruction, edit `DEFAULT_PROMPT` in `scripts/batch_widget2html.py`.
