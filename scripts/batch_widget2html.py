import argparse
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from dotenv import load_dotenv, find_dotenv  # type: ignore

    load_dotenv(find_dotenv())
except Exception:
    pass

from provider_hub import LLM, ChatMessage, prepare_image_content


# DEFAULT_PROMPT = """
# You are an expert front-end developer.
# Given a phone widget image, generate code for a single self-contained HTML file.
# No explanations or extra text. Output only HTML code. Begin exactly with <html lang="en"> and end exactly with </html>.
# Avoid JavaScript; only replicate the widget's layout and style.
# The entire widget must be generated inside a container exactly <div class="widget"> ... </div> inside of html body.
# The widget must appear centered (both horizontally and vertically) in the page viewport. Use a transparent background.
# For images, just use image from public sources like Unsplash or placehold.co, or other sources where you already know the exact image URL; don't make up URLs.
# For icons, use public icon sets such as Lucide.
# """

DEFAULT_PROMPT = """
You are an expert front-end developer.
Given a phone widget screenshot, generate ONE single self-contained HTML file that reproduces the widget UI.

Rules:
- Output ONLY HTML code. No explanations, no comments, no extra text.
- Begin exactly with: <html lang="en"> and end exactly with: </html>.
- Place all widget content inside exactly one container: <div class="widget"> ... </div> in the <body>.
- The widget must be centered both horizontally and vertically in the viewport.
- The page background must be transparent.
- For images, just use image from public sources like Unsplash or placehold.co, or other sources where you already know the exact image URL; don't make up URLs.
- For icons, use public icon sets such as Lucide.
- Avoid JavaScript; only replicate the widget's layout and style.
"""

MINIMAL_PROMPT = """
Given a phone widget screenshot, generate ONE single self-contained HTML file that reproduces the widget UI.

Rules:
- Output ONLY HTML code. No explanations, no comments, no extra text.
- Begin exactly with: <html lang="en"> and end exactly with: </html>.
- Place all widget content inside exactly one container: <div class="widget"> ... </div> in the <body>.
"""


def find_images(input_dir: Path) -> List[Path]:
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    # Include all images, even if filename starts with a dot
    return [p for p in input_dir.rglob("*") if p.suffix.lower() in exts]


def _extract_html_fence(text: str):
    """Return (extracted_html, used_fence: bool, lang: str|None).

    If a ```html fenced block exists, return its content. Otherwise, return original text.
    """
    pattern = re.compile(r"```\s*(html)\s*\n(.*?)\n?```", re.IGNORECASE | re.DOTALL)
    m = pattern.search(text)
    if m:
        return m.group(2), True, m.group(1).lower()
    return text, False, None


def _thinking_param(model: str, enabled: bool) -> Optional[Any]:
    if not enabled:
        return None
    m = model.lower()
    if "doubao" in m:
        return {"type": "enabled"}
    if m.startswith("qwen3-") or "qwen3" in m:
        return True
    return None


def process_image(model: str, image_path: Path, img_dir: Path, temperature: float, max_tokens: int, prompts: Dict[str, str], thinking: Optional[Any]):
    """Process a single image and write files under its own folder.

    img_dir layout:
      - original image copy (same filename as input)
      - <prompt_name>/<stem>.html
      - <prompt_name>/<stem>.raw.txt
    """
    img_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem
    original_copy_path = img_dir / image_path.name

    llm_kwargs = dict(model=model, temperature=temperature, max_tokens=max_tokens, timeout=120)
    if thinking is not None:
        llm_kwargs["thinking"] = thinking
    llm = LLM(**llm_kwargs)

    # Ensure a local copy of the original image is saved under the image folder
    try:
        if not original_copy_path.exists():
            shutil.copy2(str(image_path), str(original_copy_path))
    except Exception:
        # Non-fatal; proceed even if copy fails
        pass

    img_content = prepare_image_content(str(image_path))
    results: Dict[str, Dict[str, object]] = {}
    for prompt_name, prompt_text in prompts.items():
        prompt_dir = img_dir / prompt_name
        prompt_dir.mkdir(parents=True, exist_ok=True)
        html_path = prompt_dir / f"{stem}.html"
        raw_path = prompt_dir / f"{stem}.raw.txt"

        messages = [
            ChatMessage(role="system", content="You convert widget images into clean HTML."),
            ChatMessage(
                role="user",
                content=[
                    {"type": "text", "text": prompt_text},
                    img_content,
                ],
            ),
        ]

        resp = llm.chat(messages)
        raw_text = resp.content if isinstance(resp.content, str) else str(resp.content)
        raw_path.write_text(raw_text, encoding="utf-8")

        processed_html, used_fence, fence_lang = _extract_html_fence(raw_text)
        html_path.write_text(processed_html, encoding="utf-8")

        results[prompt_name] = {
            "html_path": html_path,
            "raw_path": raw_path,
            "used_fence": used_fence,
            "fence_lang": fence_lang,
        }

    return {
        "original_path": original_copy_path if original_copy_path.exists() else None,
        "prompts": results,
    }


def main():
    parser = argparse.ArgumentParser(description="Batch convert phone widget images to HTML via provider_hub.")
    parser.add_argument("--input-dir", type=str, required=True, help="Folder containing widget images")
    parser.add_argument(
        "--model",
        type=str,
        default="qwen-vl-plus",
        help="Vision model to use (e.g., qwen-vl-plus, doubao-seed-1-6-vision-250815)",
    )
    parser.add_argument("--output-dir", type=str, default="output", help="Where to write HTML files (root)")
    parser.add_argument("--temperature", type=float, default=0.2, help="Sampling temperature")
    parser.add_argument("--max-tokens", type=int, default=2048, help="Max tokens for completion")
    parser.add_argument("--limit", type=int, default=0, help="Optional limit for number of files")
    parser.add_argument("--prompt-choice", choices=["detailed", "minimal", "both"], default="both", help="Which prompt(s) to use")
    parser.add_argument("--thinking", action="store_true", help="Enable provider-specific thinking (Doubao/Qwen3 only)")
    parser.add_argument("--concurrency", type=int, default=4, help="Number of parallel requests")

    args = parser.parse_args()

    input_dir = Path(args.input_dir).resolve()
    run_ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    model_dir_name = args.model + ("-thinking" if args.thinking else "")
    run_root = Path(args.output_dir).resolve() / run_ts / model_dir_name
    run_root.mkdir(parents=True, exist_ok=True)

    images = find_images(input_dir)
    if args.limit and args.limit > 0:
        images = images[: args.limit]

    if not images:
        print(f"No images found under {input_dir}")
        return

    print(f"Found {len(images)} images. Writing to {run_root}")

    # Prepare initial run info and write immediately
    rel_images = [str(p.relative_to(input_dir)) for p in images]
    run_info_path = run_root / "run_info.json"
    prompts_map = {"detailed": DEFAULT_PROMPT, "minimal": MINIMAL_PROMPT}
    if args.prompt_choice != "both":
        prompts_map = {args.prompt_choice: prompts_map[args.prompt_choice]}
    thinking_value = _thinking_param(args.model, args.thinking)
    run_info: Dict[str, object] = {
        "timestamp": run_ts,
        "model": args.model,
        "input_dir": str(input_dir),
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
        "limit": args.limit,
        "prompts": prompts_map,
        "thinking_requested": bool(args.thinking),
        "thinking_applied": thinking_value is not None,
        "thinking_value": thinking_value,
        "images": rel_images,
        "outputs": {},
    }
    run_info_path.write_text(json.dumps(run_info, ensure_ascii=False, indent=2), encoding="utf-8")

    # Concurrent processing
    outputs: Dict[str, object] = {}
    concurrency = max(1, int(args.concurrency))
    print(f"Starting concurrent processing with concurrency={concurrency}")

    def prepare(i: int, img_path: Path):
        rel = img_path.relative_to(input_dir)
        out_dir = run_root / rel.parent / rel.stem
        out_dir.mkdir(parents=True, exist_ok=True)
        return i, img_path, rel, out_dir

    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        future_map = {}
        for i, img in enumerate(images, 1):
            i, img_path, rel, img_dir = prepare(i, img)
            fut = ex.submit(
                process_image,
                model=args.model,
                image_path=img_path,
                img_dir=img_dir,
                temperature=args.temperature,
                max_tokens=args.max_tokens,
                prompts=prompts_map,
                thinking=thinking_value,
            )
            future_map[fut] = (i, img_path, rel, img_dir)
            print(f"[queued {i}/{len(images)}] {img_path}")

        for fut in as_completed(future_map):
            i, img, rel, img_dir = future_map[fut]
            try:
                result = fut.result()
                per_prompt = {}
                for pname, pdata in result["prompts"].items():
                    per_prompt[pname] = {
                        "html": str(pdata["html_path"].relative_to(run_root)),
                        "raw": str(pdata["raw_path"].relative_to(run_root)),
                        "used_html_fence": pdata["used_fence"],
                        "fence_lang": pdata["fence_lang"],
                    }
                outputs[str(rel)] = {
                    "dir": str(img_dir.relative_to(run_root)),
                    "original": str(result["original_path"].relative_to(run_root)) if result.get("original_path") else None,
                    "prompts": per_prompt,
                }
                print(f"[done {i}/{len(images)}] {img}")
            except Exception as e:
                print(f"[fail {i}/{len(images)}] {img} -> {e}")
                outputs[str(rel)] = {
                    "dir": str(img_dir.relative_to(run_root)),
                    "error": str(e),
                }
            # Persist progress after each completion
            run_info["outputs"] = outputs
            run_info_path.write_text(json.dumps(run_info, ensure_ascii=False, indent=2), encoding="utf-8")

    # Final write ensures all outputs captured
    run_info["outputs"] = outputs
    run_info_path.write_text(json.dumps(run_info, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
