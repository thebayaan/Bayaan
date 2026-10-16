#!/usr/bin/env python3
"""
Vendor the official KFGQPC v2.x riwayah texts into scripts/rewayah/sources/
and maintain sources.lock.json (the hashes the builder and the validator
verify before they read a source).

Usage (from the repo root):
  python3 scripts/rewayah/vendor_sources.py --check
      verify sources/*.json, sources/errata.json and sources/basmala.json
      against sources.lock.json and the lock against the PACKAGES / DOCX
      tables below (CI)
  python3 scripts/rewayah/vendor_sources.py --zip-dir DIR
      DIR holds the official zips (any sub-folder layout): verify each zip
      (SHA-256 + the MD5 and SHA-1 KFGQPC publishes on its developer page),
      extract the JSON member byte for byte, verify its SHA-256, write
      sources/<id>.json and regenerate sources.lock.json
  python3 scripts/rewayah/vendor_sources.py --fetch DIR
      download the zips from their Internet Archive raw captures into DIR,
      then behave like --zip-dir DIR (the qurancomplex.gov.sa hosts were not
      reachable when the sources were vendored, see sources/SOURCES.md)
  python3 -I scripts/rewayah/vendor_sources.py --basmala DIR
      DIR holds the zips with the signed KFGQPC Word files (the DOCX table:
      the developer packages above, plus the fonts-site al-Bazzi / Qunbul
      packages): verify each zip and Word file (SHA-256), read the basmala
      paragraph of every surah from word/document.xml (as data: zipfile +
      ElementTree, nothing in the file is executed), write
      sources/basmala.json and regenerate sources.lock.json

Never edit sources/<id>.json or sources/basmala.json by hand: corrections
backed by an official KFGQPC artifact go to sources/errata.json (applied by
normalize.load_source).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import unicodedata
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # normalize.py (basmala checks); works under python -I
SOURCES_DIR = HERE / "sources"
LOCK_FILE = SOURCES_DIR / "sources.lock.json"
ERRATA_FILE = SOURCES_DIR / "errata.json"
BASMALA_FILE = SOURCES_DIR / "basmala.json"
RETRIEVED = "2026-10-06"
DEV_PAGE = "https://qurancomplex.gov.sa/en/techquran/dev/"
DEV_PAGE_2025 = "https://web.archive.org/web/20250907020432id_/https://qurancomplex.gov.sa/en/techquran/dev/"
DEV_PAGE_2022 = "https://web.archive.org/web/20220729164210id_/https://qurancomplex.gov.sa/en/techquran/dev/"
DL = "https://download.qurancomplex.gov.sa/resources_dev/"

# One entry per vendored file. md5 / sha1 are the "Reliability Check" values
# printed next to each download on KFGQPC's developer page (checksum_page).
PACKAGES: dict[str, dict[str, object]] = {
    "warsh": {
        "riwayah": "Warsh 'an Nafi'",
        "version": "Warsh v2.1, update 6.0 (2022-09-07)",
        "package": "UthmanicWarsh_v2-1.zip",
        "capture": "20250506001328",
        "zip_sha256": "d847a7e7002dfbed5d28db6684fd1d9c3d50b8bb63ad64cb38a46b9dad788b47",
        "zip_md5": "4701e8bbf053098220cf2cf4cda206a1",
        "zip_sha1": "44ecea8feb23817fdc01a8ee2162a6a0cf08cae7",
        "checksum_page": DEV_PAGE_2025,
        "member": "UthmanicWarsh_v2-1 data/warshData_v2-1.json",
        "sha256": "c6017e688cc599d88f6fdb1a19cafc9c51d024b3530955f1a878f17d26b9bcbc",
        "verses": 6214,
    },
    "qaloon": {
        "riwayah": "Qalun 'an Nafi'",
        "version": "Qalun v2.1, update 5.0 (2022-09-25)",
        "package": "UthmanicQaloun_v2-1.zip",
        "capture": "20250818023759",
        "zip_sha256": "6988b782b4268c70a11bc807223fcf2b131a9879a48aad34eb65af523fcb144d",
        "zip_md5": "964208ff04c8aadd3ddc1be262d8cfd3",
        "zip_sha1": "81733666be17742e13c9fa4c7d26d42b1adc67c8",
        "checksum_page": DEV_PAGE_2025,
        "member": "UthmanicQaloun_v2-1 data/QalounData_v2-1.json",
        "sha256": "743f815e042036304f0c82befe42f9c9ae0ca8dbf8e4814c2c2052ceceae886b",
        "verses": 6214,
    },
    "doori": {
        "riwayah": "al-Duri 'an Abi 'Amr",
        "version": "al-Duri v2.0 (2022-09-26)",
        "package": "UthmanicDouri_v2-0.zip",
        "capture": "20250506165327",
        "zip_sha256": "84e5569790f96b05896b8f44ebe8d82d98377a929ac0e87dd8af4dbec52cb0c1",
        "zip_md5": "a60bdd18397b3e27e4617478968a35c8",
        "zip_sha1": "8049482f04b4ff1053a7859f96b2b113b9771efb",
        "checksum_page": DEV_PAGE_2025,
        "member": "UthmanicDouri_v2-0 data/DouriData_v2-0.json",
        "sha256": "3ebae16badd0b1a20e6da0952557e234abb97041d752706245d0660fa48e5f51",
        "verses": 6217,
    },
    "soosi": {
        "riwayah": "al-Susi 'an Abi 'Amr",
        "version": "al-Susi v2.0 (2022-09-27)",
        "package": "UthmanicSousi_v2-0.zip",
        "capture": "20250418114713",
        "zip_sha256": "e912273b3863bbf97ec4a7b1134967e3cdf21de7fcc06df9dee42bce655ce472",
        "zip_md5": "1bf6023e29b7622a52b6171232c17096",
        "zip_sha1": "e52dbc6d8b43797a8faa0fd1ec1d8e5000265674",
        "checksum_page": DEV_PAGE_2025,
        "member": "UthmanicSousi_v2-0 data/SousiData_v2-0.json",
        "sha256": "2530d23236d432d4df758381cfa2f7f6b49a0829a426b9c54048bed611c572c0",
        "verses": 6217,
    },
    "shouba": {
        "riwayah": "Shu'bah 'an 'Asim",
        "version": "Shu'bah v2.0, update 4.0 (2022-09-21)",
        "package": "UthmanicShuba_v2-0.zip",
        "capture": "20250417225333",
        "zip_sha256": "977e64f3f889c084dc82aec4e97092836ca61777cdc93c3ee7da6f59592efbcf",
        "zip_md5": "5cda29121bf0d7234e039002e1fbf600",
        "zip_sha1": "8d66bdf0cab96dc7d1032792c19f77980ca6682a",
        "checksum_page": DEV_PAGE_2025,
        "member": "UthmanicShuba_v2-0 data/shubaData_v2-0.json",
        "sha256": "bcc5e453279cb88c6ed1a60be6c9924e764550f8c15d50a43c920c049fd08bfb",
        "verses": 6236,
    },
    "bazzi": {
        "riwayah": "al-Bazzi 'an Ibn Kathir",
        "version": "al-Bazzi v2.0, qc2 data (2022-02-27)",
        "package": "qc2_bazzi_2-0_data.zip",
        "capture": "20220729174822",
        "zip_sha256": "9d8d53180c7d6ac05cbb8f30c26703c2a8ced22e0f98c85836198bf9834f4f5a",
        "zip_md5": "edc434e0801a1a493e1841655f1f8e96",
        "zip_sha1": "5e55adc5dd93f075d643ed046c1d2334fca21d62",
        "checksum_page": DEV_PAGE_2022,
        "member": "qc2_bazzi_2-0 data/qc2_bazzi_2-0.json",
        "sha256": "a53a177ca4340eb7199eb208912e15957f3757cbc89eb1ce23be1485495fd171",
        "verses": 6220,
    },
    "qumbul": {
        "riwayah": "Qunbul 'an Ibn Kathir",
        "version": "Qunbul v2.0, qc2 data (2022-02-27)",
        "package": "qc2_qunbul_v2_data.zip",
        "capture": "20220729175543",
        "zip_sha256": "4ea5e740a036396bc045dc8c645f5d5fa7ca128a653b9a919098fe391a331520",
        "zip_md5": "1759415822f4617e8687d165c74767bb",
        "zip_sha1": "3c8fc8e88744db7cc573a334cfd3e24d2fb49f6f",
        "checksum_page": DEV_PAGE_2022,
        "member": "qc2_qunbul_v2-0 data/qc2_qunbul_v2-0.json",
        "sha256": "83d828cbe1223b537a8b18f0f8c7f40221ed60b24c4fc8ca22ed0620bc7edc9b",
        "verses": 6220,
    },
    # Reference text for the KFGQPC -> DigitalKhatt convention round trip
    # (validate.py), not a rewayah build input.
    "hafs": {
        "riwayah": "Hafs 'an 'Asim (convention reference)",
        "version": "Hafs v2.0, update 13.0 (2023-09-19)",
        "package": "UthmanicHafs_v2-0.zip",
        "capture": "20250417225336",
        "zip_sha256": "a7b0e5591945712ec5e4d6142938ae4d1e9b49bdc89dff06222789bfebdfd72c",
        "zip_md5": "cf6841aea5b1d1fd70d032b43ff08278",
        "zip_sha1": "36ea5ab0d7ea1702f17ff43f9b50924cccd77ebf",
        "checksum_page": DEV_PAGE_2025,
        "member": "UthmanicHafs_v2-0 data/hafsData_v2-0.json",
        "sha256": "d2960b3217962e7e4252abdcece67bea3d6b48271e4cd3af45bbbb2dd5c872ca",
        "verses": 6236,
    },
}


# The signed KFGQPC Word (.docx) typesetting of each riwayah: the only official
# artifact that writes the basmala line of every surah (the JSON texts have no
# basmala, or only al-Fatiha's as verse 1). Five ship in the developer packages
# above; al-Bazzi's and Qunbul's come from the KFGQPC fonts site, which
# publishes no checksum (the developer package UthmanicQunbul_v2-0.zip is not
# used, see sources/SOURCES.md).
FONTS_SITE = "https://fonts.qurancomplex.gov.sa/wp-content/uploads/2022/11/"
FONT_PACKAGES: dict[str, dict[str, str]] = {
    "UthmanicBazzi_V20.zip": {
        "download_page": "https://fonts.qurancomplex.gov.sa/en/bazzi-reading/",
        "capture": "20250424053606",
        "zip_sha256": "b85cd72fda6f52c08cd5ecadeebfe9f08a5e0d986eecb318e7295f3318feaf66",
    },
    "UthmanicQunbul_V20.zip": {
        "download_page": "https://fonts.qurancomplex.gov.sa/en/qunbul-reading/",
        "capture": "20250424120222",
        "zip_sha256": "d33a35f7c9c6e416579d810e88c8ab9bfa7d72ff0a78e48e23fac48ae7b81d62",
    },
}
DOCX: dict[str, dict[str, str]] = {
    "warsh": {
        "package": "UthmanicWarsh_v2-1.zip",
        "member": "UthmanicWarsh_v2-1 font/uthmanic_warsh_v21.docx",
        "sha256": "7302c27a666857c9a3e77a304026c12ca12955003765eaa2e418df5d8bc688ec",
    },
    "qaloon": {
        "package": "UthmanicQaloun_v2-1.zip",
        "member": "UthmanicQaloun_v2-1 font/uthmanic_qaloun_v21.docx",
        "sha256": "418a0f6e6a7887005f7cfd43de3159832563c24213cab71fe56af8d0a4b3d153",
    },
    "doori": {
        "package": "UthmanicDouri_v2-0.zip",
        "member": "UthmanicDouri_v2-0 font/uthmanic_douri_v20.docx",
        "sha256": "8385661b53a0ff65e790161f146b5d736b7c9d7eb093a16427a30a7b3110916b",
    },
    "soosi": {
        "package": "UthmanicSousi_v2-0.zip",
        "member": "UthmanicSousi_v2-0 font/uthmanic_sousi_v20.docx",
        "sha256": "149e30d33a98e50c042b4744e1262521461e06a6ecf87a1be86cc5a3d638d126",
    },
    "shouba": {
        "package": "UthmanicShuba_v2-0.zip",
        "member": "UthmanicShuba_v2-0 font/uthmanic_shuba_v20.docx",
        "sha256": "76e6b8a381fc9fc3f4a4cdf8c1c902986d045b9d910e68dc37d60ad8993e0e23",
    },
    "bazzi": {
        "package": "UthmanicBazzi_V20.zip",
        "member": "UthmanicBazzi V20.docx",
        "sha256": "63b62374b2c3ff2fc77798e27f0ba98e23163dac7d3cc954757b60b712044080",
    },
    "qumbul": {
        "package": "UthmanicQunbul_V20.zip",
        "member": "UthmanicQunbul V20.docx",
        "sha256": "9c737e7f52cd03998d633f142136d9a09b537c7a9ad8b8ed83336f3ed2d82a23",
    },
}


def official_url(pkg: dict) -> str:
    return DL + str(pkg["package"])


def docx_package(rid: str) -> dict[str, object]:
    """The zip holding the Word file of `rid`: name, URLs and checksums."""
    name = DOCX[rid]["package"]
    for pkg in PACKAGES.values():
        if pkg["package"] == name:
            return {
                "package": name,
                "official_url": official_url(pkg),
                "archive_url": archive_url(pkg),
                "zip_sha256": pkg["zip_sha256"],
                "zip_md5_published": pkg["zip_md5"],
                "zip_sha1_published": pkg["zip_sha1"],
            }
    font = FONT_PACKAGES[name]
    url = FONTS_SITE + name
    return {
        "package": name,
        "official_url": url,
        "archive_url": f"https://web.archive.org/web/{font['capture']}id_/{url}",
        "zip_sha256": font["zip_sha256"],
        "download_page": font["download_page"],
    }


def archive_url(pkg: dict) -> str:
    return f"https://web.archive.org/web/{pkg['capture']}id_/{official_url(pkg)}"


def digest(data: bytes, algo: str) -> str:
    return hashlib.new(algo, data).hexdigest()


def lock_document() -> dict:
    doc: dict = {
        "__format": 1,
        "retrieved": RETRIEVED,
        "developer_page": DEV_PAGE,
        "sources": {},
    }
    for rid, pkg in PACKAGES.items():
        doc["sources"][rid] = {
            "file": f"{rid}.json",
            "sha256": pkg["sha256"],
            "verses": pkg["verses"],
            "riwayah": pkg["riwayah"],
            "version": pkg["version"],
            "package": pkg["package"],
            "official_url": official_url(pkg),
            "archive_url": archive_url(pkg),
            "zip_sha256": pkg["zip_sha256"],
            "zip_md5_published": pkg["zip_md5"],
            "zip_sha1_published": pkg["zip_sha1"],
            "checksum_page": pkg["checksum_page"],
            "member": pkg["member"],
        }
    doc["errata"] = {
        "file": ERRATA_FILE.name,
        "sha256": digest(ERRATA_FILE.read_bytes(), "sha256") if ERRATA_FILE.exists() else None,
    }
    doc["basmala"] = {
        "file": BASMALA_FILE.name,
        "sha256": digest(BASMALA_FILE.read_bytes(), "sha256") if BASMALA_FILE.exists() else None,
        "docx": {
            rid: {
                "file": d["member"].rsplit("/", 1)[-1],
                "sha256": d["sha256"],
                "member": d["member"],
                **docx_package(rid),
            }
            for rid, d in DOCX.items()
        },
    }
    return doc


def write_lock() -> None:
    LOCK_FILE.write_text(json.dumps(lock_document(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def check() -> int:
    errors = []
    try:
        lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"{LOCK_FILE} missing", file=sys.stderr)
        return 1
    if lock != lock_document():
        errors.append(
            "sources.lock.json is out of date with the PACKAGES / DOCX tables, errata.json or basmala.json "
            "(run --zip-dir or --basmala)"
        )
    for rid, entry in lock.get("sources", {}).items():
        path = SOURCES_DIR / entry["file"]
        if not path.exists():
            errors.append(f"{path.name} missing")
            continue
        data = path.read_bytes()
        got = digest(data, "sha256")
        if got != entry["sha256"]:
            errors.append(f"{path.name}: sha256 {got} != locked {entry['sha256']}")
            continue
        n = len(json.loads(data.decode("utf-8-sig")))
        if n != entry["verses"]:
            errors.append(f"{path.name}: {n} verses != {entry['verses']}")
    errata = lock.get("errata", {})
    if errata.get("sha256") and digest(ERRATA_FILE.read_bytes(), "sha256") != errata["sha256"]:
        errors.append("errata.json sha256 differs from the lock")
    errors.extend(check_basmala(lock))
    for e in errors:
        print(f"FAIL {e}", file=sys.stderr)
    if not errors:
        print(f"OK: {len(lock['sources'])} sources, errata.json and basmala.json match sources.lock.json")
    return 1 if errors else 0


def check_basmala(lock: dict) -> list[str]:
    """basmala.json: locked SHA-256, the Word files of the DOCX table, and the
    structure normalize.load_basmala() requires (every surah but 9, al-Fatiha's
    basmala the default and numbered exactly when the JSON source counts it)."""
    import normalize as N  # noqa: E402 (scripts/rewayah, see the top of main())

    entry = lock.get("basmala", {})
    if not BASMALA_FILE.exists():
        return [f"{BASMALA_FILE.name} missing"]
    if digest(BASMALA_FILE.read_bytes(), "sha256") != entry.get("sha256"):
        return ["basmala.json sha256 differs from the lock"]
    errors = []
    doc = json.loads(BASMALA_FILE.read_text(encoding="utf-8"))
    if sorted(doc.get("rewayat", {})) != sorted(DOCX):
        errors.append(f"basmala.json rewayat {sorted(doc.get('rewayat', {}))} != {sorted(DOCX)}")
    for rid, d in DOCX.items():
        try:
            b = N.load_basmala(rid, BASMALA_FILE)
        except N.SourceError as e:
            errors.append(str(e))
            continue
        name = d["member"].rsplit("/", 1)[-1]
        if (b.docx, b.docx_sha256) != (name, d["sha256"]):
            errors.append(f"basmala.json {rid}: Word file {b.docx} {b.docx_sha256} != {name} {d['sha256']}")
        verses = N.load_source(SOURCES_DIR / f"{rid}.json", rid)
        json_counts = "".join(c for c in verses[0].tokens[0] if N.is_letter(c)) == N.BASMALA_LETTERS[0]
        if b.fatiha_numbered != json_counts:
            errors.append(
                f"basmala.json {rid}: al-Fatiha's basmala is {'' if b.fatiha_numbered else 'not '}numbered in the "
                f"Word file but {'is' if json_counts else 'is not'} verse 1 of {rid}.json"
            )
        elif json_counts and verses[0].tokens != tuple(b.official.split(" ")):
            errors.append(f"basmala.json {rid}: al-Fatiha's basmala differs from verse 1 of {rid}.json")
    return errors


# ---------------------------------------------------------------------------
# Basmala lines from the signed Word files (--basmala)
# ---------------------------------------------------------------------------

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
MAX_DOCUMENT_XML = 64 << 20


def _paragraph_text(p: ElementTree.Element) -> tuple[str, bool]:
    """(text of the w:t runs, True when the paragraph holds only plain runs:
    w:pPr, and w:r with only w:rPr and w:t, so no symbol, tab, field or
    tracked change can hide a character)."""
    plain = True
    for child in p:
        if child.tag == W_NS + "pPr":
            continue
        if child.tag != W_NS + "r" or any(el.tag not in (W_NS + "rPr", W_NS + "t") for el in child):
            plain = False
    return "".join(t.text or "" for t in p.iter(W_NS + "t")), plain


def docx_paragraphs(path: Path, member: str) -> tuple[bytes, list[tuple[str, bool]]]:
    """The Word file `member` of the zip `path` (bytes) and the text of every
    w:p of its word/document.xml, in document order. Read as data only."""
    with zipfile.ZipFile(path) as zf:
        data = zf.read(member)
    with zipfile.ZipFile(io.BytesIO(data)) as docx:
        info = docx.getinfo("word/document.xml")
        if info.file_size > MAX_DOCUMENT_XML:
            raise ValueError(f"{member}: word/document.xml is {info.file_size} bytes")
        root = ElementTree.fromstring(docx.read(info))
    paragraphs = list(root.iter(W_NS + "p"))
    for p in paragraphs:
        if any(q is not p for q in p.iter(W_NS + "p")):
            raise ValueError(f"{member}: nested paragraphs are not supported")
    return data, [_paragraph_text(p) for p in paragraphs]


def _letters(token: str) -> str:
    return "".join(c for c in token if unicodedata.category(c) == "Lo")


def _tokens(text: str) -> list[str]:
    return text.replace("\u200F", "").replace("\u00A0", " ").split()


def _visible_json(obj: object, level: int = 0) -> str:
    """Deterministic JSON: objects indented, a list of scalars on one line,
    invisible characters (NBSP, RLM, ...) escaped so a reader sees them."""
    pad = "  " * level
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        items = [f"{pad}  {json.dumps(k, ensure_ascii=False)}: {_visible_json(v, level + 1)}" for k, v in obj.items()]
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(obj, list) and any(isinstance(x, (dict, list)) for x in obj):
        return "[\n" + ",\n".join(f"{pad}  {_visible_json(v, level + 1)}" for v in obj) + "\n" + pad + "]"
    text = json.dumps(obj, ensure_ascii=False)
    return "".join(
        f"\\u{ord(c):04x}" if c != " " and unicodedata.category(c) in ("Zs", "Cf", "Cc") else c for c in text
    )


def vendor_basmala(zip_dir: Path) -> int:
    """Read the basmala paragraph of every surah from the signed Word files
    and write sources/basmala.json (see the module docstring)."""
    import normalize as N  # noqa: E402

    zips = {p.name: p for p in zip_dir.rglob("*.zip")}
    lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
    out: dict = {
        "__format": 1,
        "about": (
            "The basmala line of every surah (all but 9), verbatim from the signed KFGQPC Word file of each "
            "riwayah: surah -> [index of the w:p element in word/document.xml, its text]. 'official' is "
            "al-Fatiha's basmala without surrounding whitespace or verse number, the default line. Written by "
            "vendor_sources.py --basmala; never edit by hand (see SOURCES.md)."
        ),
        "rewayat": {},
    }
    failures = 0
    for rid, d in DOCX.items():
        pkg = docx_package(rid)
        z = zips.get(str(pkg["package"]))
        if z is None:
            print(f"[{rid}] {pkg['package']} not found under {zip_dir}", file=sys.stderr)
            failures += 1
            continue
        raw_zip = z.read_bytes()
        checks = {"sha256": (digest(raw_zip, "sha256"), pkg["zip_sha256"])}
        if "zip_md5_published" in pkg:
            checks["md5 (published)"] = (digest(raw_zip, "md5"), pkg["zip_md5_published"])
            checks["sha1 (published)"] = (digest(raw_zip, "sha1"), pkg["zip_sha1_published"])
        bad = [f"{k} {got} != {want}" for k, (got, want) in checks.items() if got != want]
        if bad:
            print(f"[{rid}] {pkg['package']}: " + "; ".join(bad), file=sys.stderr)
            failures += 1
            continue
        data, paragraphs = docx_paragraphs(z, d["member"])
        if digest(data, "sha256") != d["sha256"]:
            print(f"[{rid}] {d['member']}: sha256 mismatch", file=sys.stderr)
            failures += 1
            continue
        found = [
            i for i, (text, _) in enumerate(paragraphs)
            if _tokens(text) and _letters(_tokens(text)[0]) == "\u0628\u0633\u0645"
        ]
        if len(found) != len(N.SURAHS_WITH_BASMALA):
            print(f"[{rid}] {len(found)} basmala paragraphs, expected {len(N.SURAHS_WITH_BASMALA)}", file=sys.stderr)
            failures += 1
            continue
        # The k-th basmala paragraph opens the k-th surah (at-Tawbah has none);
        # proved by the paragraph after it, which starts with that surah's first
        # word in the official JSON source (verified against the lock first).
        source = SOURCES_DIR / f"{rid}.json"
        if digest(source.read_bytes(), "sha256") != lock["sources"][rid]["sha256"]:
            print(f"[{rid}] {source.name} does not match {LOCK_FILE.name}", file=sys.stderr)
            failures += 1
            continue
        first: dict[int, dict[int, list[str]]] = {}
        for row in json.loads(source.read_bytes().decode("utf-8-sig")):
            first.setdefault(row.get("sura_no", row.get("sora")), {})[row["aya_no"]] = _tokens(row["aya_text"])
        surahs: dict[str, list] = {}
        problems = []
        for s, i in zip(N.SURAHS_WITH_BASMALA, found):
            text, plain = paragraphs[i]
            if not plain:
                problems.append(f"surah {s}: paragraph {i} holds more than plain text runs")
            verse = 2 if s == 1 and _letters(first[1][1][0]) == "\u0628\u0633\u0645" else 1
            after = _tokens(paragraphs[i + 1][0]) if i + 1 < len(paragraphs) else []
            if after[:1] != first[s][verse][:1]:
                problems.append(f"surah {s}: paragraph {i + 1} starts {after[:1]} != {s}:{verse} {first[s][verse][:1]}")
            surahs[str(s)] = [i, text]
        if problems:
            for p in problems:
                print(f"[{rid}] {p}", file=sys.stderr)
            failures += 1
            continue
        words = {s: N.basmala_words(t)[0] for s, (_, t) in surahs.items()}
        out["rewayat"][rid] = {
            "docx": d["member"].rsplit("/", 1)[-1],
            "sha256": d["sha256"],
            "official": words["1"],
            "surahs": surahs,
        }
        variants = Counter(w for s, w in words.items() if w != words["1"])
        print(
            f"[{rid}] {pkg['package']} / {d['member']} verified; {len(found)} basmala lines, "
            f"{len(words) - sum(variants.values())} default, other: "
            + (", ".join(f"{[s for s, w in words.items() if w == v]}" for v in variants) or "none")
        )
    if failures:
        return 1
    BASMALA_FILE.write_text(_visible_json(out) + "\n", encoding="utf-8")
    write_lock()
    print(f"wrote {BASMALA_FILE.relative_to(HERE.parents[1])} and {LOCK_FILE.relative_to(HERE.parents[1])}")
    return check()


def vendor(zip_dir: Path) -> int:
    zips = {p.name: p for p in zip_dir.rglob("*.zip")}
    SOURCES_DIR.mkdir(exist_ok=True)
    failures = 0
    for rid, pkg in PACKAGES.items():
        name = str(pkg["package"])
        if name not in zips:
            print(f"[{rid}] {name} not found under {zip_dir}", file=sys.stderr)
            failures += 1
            continue
        data = zips[name].read_bytes()
        checks = {
            "sha256": (digest(data, "sha256"), pkg["zip_sha256"]),
            "md5 (published)": (digest(data, "md5"), pkg["zip_md5"]),
            "sha1 (published)": (digest(data, "sha1"), pkg["zip_sha1"]),
        }
        bad = [f"{k} {got} != {want}" for k, (got, want) in checks.items() if got != want]
        if bad:
            print(f"[{rid}] {name}: " + "; ".join(bad), file=sys.stderr)
            failures += 1
            continue
        with zipfile.ZipFile(zips[name]) as zf:
            member = zf.read(str(pkg["member"]))
        if digest(member, "sha256") != pkg["sha256"]:
            print(f"[{rid}] {pkg['member']}: sha256 mismatch", file=sys.stderr)
            failures += 1
            continue
        (SOURCES_DIR / f"{rid}.json").write_bytes(member)
        print(f"[{rid}] {name} verified (sha256, md5, sha1) -> sources/{rid}.json")
    if failures:
        return 1
    write_lock()
    print(f"wrote {LOCK_FILE.relative_to(HERE.parents[1])}")
    return 0


def fetch(dest: Path) -> int:
    dest.mkdir(parents=True, exist_ok=True)
    for rid, pkg in PACKAGES.items():
        target = dest / str(pkg["package"])
        if target.exists():
            continue
        print(f"[{rid}] downloading {archive_url(pkg)}")
        with urllib.request.urlopen(archive_url(pkg), timeout=300) as r:  # noqa: S310 (fixed https URLs)
            target.write_bytes(r.read())
    return vendor(dest)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true")
    g.add_argument("--zip-dir", type=Path)
    g.add_argument("--fetch", type=Path, metavar="DIR")
    g.add_argument("--basmala", type=Path, metavar="DIR", help="zips with the signed Word files (DOCX table)")
    a = ap.parse_args(argv)
    if a.check:
        return check()
    if a.zip_dir:
        return vendor(a.zip_dir)
    if a.basmala:
        return vendor_basmala(a.basmala)
    return fetch(a.fetch)


if __name__ == "__main__":
    sys.exit(main())
