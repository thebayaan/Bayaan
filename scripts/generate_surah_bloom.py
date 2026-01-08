#!/usr/bin/env python3
"""
Generate compact Bloom filters for surah name variations.

This script reads `data/quran_surah_variations_ultra.json`, normalizes all
explicit variations per surah, and produces `data/surah_bloom_filters.json`
containing per-surah Bloom filters plus the wildcard configuration for runtime
matching (so the app does not need to ship the giant source file).

Normalization and hashing are intentionally simple and mirrored in the
TypeScript runtime code to guarantee deterministic membership checks.
"""

from __future__ import annotations

import argparse
import base64
import datetime
import json
import math
import re
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = REPO_ROOT / "data" / "quran_surah_variations_ultra.json"
OUTPUT_PATH = REPO_ROOT / "data" / "surah_bloom_filters.json"
EXACT_MATCH_PATH = REPO_ROOT / "data" / "surah_variations_index.json"

# Hash seeds must stay in sync with the TypeScript implementation.
SEED1 = 0xA5A5A5A5
SEED2 = 0x27D4EB2F


def normalize(text: str) -> str:
    """
    Normalize names so Python generation and TS runtime stay consistent:
    - lowercase
    - drop file extensions
    - replace non (latin/arabic/digit) with hyphen
    - collapse multiple hyphens and trim edges
    """
    text = text.strip().lower()
    text = re.sub(r"\.[^.]+$", "", text)  # remove extension
    text = re.sub(r"[^0-9a-z\u0600-\u06FF]+", "-", text)
    text = re.sub(r"-{2,}", "-", text)
    return text.strip("-")


def fnv1a_32(value: str, seed: int) -> int:
    """32-bit FNV-1a with a seed."""
    h = 0x811C9DC5 ^ seed
    for ch in value:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def hash_indices(value: str, m: int, k: int) -> Iterable[int]:
    """Double hashing to generate k indices within m bits."""
    h1 = fnv1a_32(value, SEED1)
    h2 = fnv1a_32(value, SEED2)
    for i in range(k):
        yield (h1 + i * h2) % m


def optimal_params(n: int, fp_rate: float) -> Tuple[int, int]:
    """Return (m, k) for given item count and desired false positive rate."""
    if n == 0:
        # Minimal filter; avoids div-by-zero
        return 8, 1
    m = math.ceil(-(n * math.log(fp_rate)) / (math.log(2) ** 2))
    k = max(1, math.ceil((m / n) * math.log(2)))
    return m, k


def build_filter(variants: Set[str], fp_rate: float) -> Dict[str, object]:
    m, k = optimal_params(len(variants), fp_rate)
    byte_len = (m + 7) // 8
    bits = bytearray(byte_len)

    for value in variants:
        for idx in hash_indices(value, m, k):
            byte_index = idx // 8
            bit_offset = idx % 8
            bits[byte_index] |= 1 << bit_offset

    return {
        "m": m,
        "k": k,
        "bitset": base64.b64encode(bits).decode("ascii"),
        "count": len(variants),
    }


def load_variations() -> Tuple[Dict[str, object], Dict[str, object]]:
    raw = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    wildcard_config = {
        "latin": raw.pop("_wildcard_expansion", {}),
        "arabic": raw.pop("_arabic_wildcards", {}),
    }
    return raw, wildcard_config


def gather_variants(entry: Dict[str, object]) -> Set[str]:
    variants: Set[str] = set()
    for key in ("canonical", "arabic_canonical"):
        val = entry.get(key)
        if isinstance(val, str):
            variants.add(normalize(val))
    for value in entry.get("variations", []):
        if isinstance(value, str):
            variants.add(normalize(value))
    variants.discard("")  # remove empties after normalization
    return variants


def generate(fp_rate: float) -> Dict[str, object]:
    data, wildcard_config = load_variations()
    filters: List[Dict[str, object]] = []
    exact_map: Dict[str, int] = {}

    for key, entry in data.items():
        if not key.startswith("surah_"):
            continue
        try:
            surah_id = int(entry.get("number") or key.split("_")[1])
        except (ValueError, IndexError):
            continue

        variants = gather_variants(entry)
        for v in variants:
            # If multiple surahs claim the same string (unlikely but possible), last wins or logic needed.
            # Assuming uniqueness for now.
            exact_map[v] = surah_id

        bloom = build_filter(variants, fp_rate)
        bloom.update(
            {
                "id": surah_id,
                "canonical": entry.get("canonical"),
                "arabic_canonical": entry.get("arabic_canonical"),
            }
        )
        filters.append(bloom)

    filters.sort(key=lambda f: f["id"])

    return {
        "version": 1,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "source": str(SOURCE_PATH.relative_to(REPO_ROOT)),
        "hashing": {
            "method": "fnv1a-32-double",
            "seed1": SEED1,
            "seed2": SEED2,
        },
        "normalization": {
            "description": "lowercase; strip extensions; non (latin/arabic/digit) -> '-'",
            "regex": r"[^0-9a-z\\u0600-\\u06FF]+",
        },
        "false_positive_rate": fp_rate,
        "filters": filters,
        "wildcards": wildcard_config,
    }, exact_map


def main():
    global SOURCE_PATH, OUTPUT_PATH, EXACT_MATCH_PATH

    parser = argparse.ArgumentParser(description="Generate surah bloom filters")
    parser.add_argument(
        "--fp-rate",
        type=float,
        default=0.005,
        help="target false positive rate (default: 0.005)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_PATH,
        help=f"output path for bloom filters (default: {OUTPUT_PATH})",
    )
    parser.add_argument(
        "--output-index",
        type=Path,
        default=EXACT_MATCH_PATH,
        help=f"output path for exact match index (default: {EXACT_MATCH_PATH})",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=SOURCE_PATH,
        help=f"source json (default: {SOURCE_PATH})",
    )
    args = parser.parse_args()

    SOURCE_PATH = args.source
    OUTPUT_PATH = args.output
    EXACT_MATCH_PATH = args.output_index

    if not SOURCE_PATH.exists():
        raise SystemExit(f"Source file not found: {SOURCE_PATH}")

    result, exact_map = generate(args.fp_rate)
    
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(result['filters'])} filters")

    EXACT_MATCH_PATH.write_text(json.dumps(exact_map, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {EXACT_MATCH_PATH} with {len(exact_map)} exact variations")


if __name__ == "__main__":
    main()

