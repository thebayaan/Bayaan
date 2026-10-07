#!/usr/bin/env python3
"""
Vendor the official KFGQPC v2.x riwayah texts into scripts/rewayah/sources/
and maintain sources.lock.json (the hashes the builder and the validator
verify before they read a source).

Usage (from the repo root):
  python3 scripts/rewayah/vendor_sources.py --check
      verify sources/*.json and sources/errata.json against sources.lock.json
      and the lock against the PACKAGES table below (CI)
  python3 scripts/rewayah/vendor_sources.py --zip-dir DIR
      DIR holds the official zips (any sub-folder layout): verify each zip
      (SHA-256 + the MD5 and SHA-1 KFGQPC publishes on its developer page),
      extract the JSON member byte for byte, verify its SHA-256, write
      sources/<id>.json and regenerate sources.lock.json
  python3 scripts/rewayah/vendor_sources.py --fetch DIR
      download the zips from their Internet Archive raw captures into DIR,
      then behave like --zip-dir DIR (the qurancomplex.gov.sa hosts were not
      reachable when the sources were vendored, see sources/SOURCES.md)

Never edit sources/<id>.json by hand: corrections backed by an official
KFGQPC artifact go to sources/errata.json (applied by normalize.load_source).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES_DIR = HERE / "sources"
LOCK_FILE = SOURCES_DIR / "sources.lock.json"
ERRATA_FILE = SOURCES_DIR / "errata.json"
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


def official_url(pkg: dict) -> str:
    return DL + str(pkg["package"])


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
        errors.append("sources.lock.json is out of date with the PACKAGES table / errata.json (run --zip-dir)")
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
    for e in errors:
        print(f"FAIL {e}", file=sys.stderr)
    if not errors:
        print(f"OK: {len(lock['sources'])} sources and errata.json match sources.lock.json")
    return 1 if errors else 0


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
    a = ap.parse_args(argv)
    if a.check:
        return check()
    if a.zip_dir:
        return vendor(a.zip_dir)
    return fetch(a.fetch)


if __name__ == "__main__":
    sys.exit(main())
