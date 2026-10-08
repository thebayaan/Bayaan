# Official sources of the rewayah texts

Every non-Hafs words DB is built from the official text published by the
King Fahd Glorious Qur'an Printing Complex (KFGQPC), developer edition v2.x.
The JSON files in this folder are the official JSON members of the KFGQPC
packages, **byte for byte**. Do not edit them: `vendor_sources.py` writes
them, `sources.lock.json` pins their SHA-256, and the builder, the validator
and CI refuse to run on anything else.

Retrieved 2026-10-06. Every `*.qurancomplex.gov.sa` host timed out from the
research network that day, so each package was fetched from its Internet
Archive raw capture (`https://web.archive.org/web/<capture>id_/<official URL>`).
Each zip matches the MD5 **and** SHA-1 that KFGQPC prints next to the download
("Reliability Check") on its developer page
(https://qurancomplex.gov.sa/en/techquran/dev/; captures
[20250907020432](https://web.archive.org/web/20250907020432id_/https://qurancomplex.gov.sa/en/techquran/dev/)
for the v2.x packages and
[20220729164210](https://web.archive.org/web/20220729164210id_/https://qurancomplex.gov.sa/en/techquran/dev/)
for the qc2 packages).

| file | riwayah | version | official package | capture | zip SHA-256 | published MD5 / SHA-1 | JSON member SHA-256 | verses |
|---|---|---|---|---|---|---|---|---|
| `warsh.json` | Warsh 'an Nafi' | v2.1, update 6.0 (2022-09-07) | [UthmanicWarsh_v2-1.zip](https://download.qurancomplex.gov.sa/resources_dev/UthmanicWarsh_v2-1.zip) | [20250506001328](https://web.archive.org/web/20250506001328id_/https://download.qurancomplex.gov.sa/resources_dev/UthmanicWarsh_v2-1.zip) | `d847a7e7002dfbed5d28db6684fd1d9c3d50b8bb63ad64cb38a46b9dad788b47` | `4701e8bbf053098220cf2cf4cda206a1` / `44ecea8feb23817fdc01a8ee2162a6a0cf08cae7` match | `c6017e688cc599d88f6fdb1a19cafc9c51d024b3530955f1a878f17d26b9bcbc` | 6214 |
| `qaloon.json` | Qalun 'an Nafi' | v2.1, update 5.0 (2022-09-25) | [UthmanicQaloun_v2-1.zip](https://download.qurancomplex.gov.sa/resources_dev/UthmanicQaloun_v2-1.zip) | [20250818023759](https://web.archive.org/web/20250818023759id_/https://download.qurancomplex.gov.sa/resources_dev/UthmanicQaloun_v2-1.zip) | `6988b782b4268c70a11bc807223fcf2b131a9879a48aad34eb65af523fcb144d` | `964208ff04c8aadd3ddc1be262d8cfd3` / `81733666be17742e13c9fa4c7d26d42b1adc67c8` match | `743f815e042036304f0c82befe42f9c9ae0ca8dbf8e4814c2c2052ceceae886b` | 6214 |
| `doori.json` | al-Duri 'an Abi 'Amr | v2.0 (2022-09-26) | [UthmanicDouri_v2-0.zip](https://download.qurancomplex.gov.sa/resources_dev/UthmanicDouri_v2-0.zip) | [20250506165327](https://web.archive.org/web/20250506165327id_/https://download.qurancomplex.gov.sa/resources_dev/UthmanicDouri_v2-0.zip) | `84e5569790f96b05896b8f44ebe8d82d98377a929ac0e87dd8af4dbec52cb0c1` | `a60bdd18397b3e27e4617478968a35c8` / `8049482f04b4ff1053a7859f96b2b113b9771efb` match | `3ebae16badd0b1a20e6da0952557e234abb97041d752706245d0660fa48e5f51` | 6217 |
| `soosi.json` | al-Susi 'an Abi 'Amr | v2.0 (2022-09-27) | [UthmanicSousi_v2-0.zip](https://download.qurancomplex.gov.sa/resources_dev/UthmanicSousi_v2-0.zip) | [20250418114713](https://web.archive.org/web/20250418114713id_/https://download.qurancomplex.gov.sa/resources_dev/UthmanicSousi_v2-0.zip) | `e912273b3863bbf97ec4a7b1134967e3cdf21de7fcc06df9dee42bce655ce472` | `1bf6023e29b7622a52b6171232c17096` / `e52dbc6d8b43797a8faa0fd1ec1d8e5000265674` match | `2530d23236d432d4df758381cfa2f7f6b49a0829a426b9c54048bed611c572c0` | 6217 |
| `shouba.json` | Shu'bah 'an 'Asim | v2.0, update 4.0 (2022-09-21) | [UthmanicShuba_v2-0.zip](https://download.qurancomplex.gov.sa/resources_dev/UthmanicShuba_v2-0.zip) | [20250417225333](https://web.archive.org/web/20250417225333id_/https://download.qurancomplex.gov.sa/resources_dev/UthmanicShuba_v2-0.zip) | `977e64f3f889c084dc82aec4e97092836ca61777cdc93c3ee7da6f59592efbcf` | `5cda29121bf0d7234e039002e1fbf600` / `8d66bdf0cab96dc7d1032792c19f77980ca6682a` match | `bcc5e453279cb88c6ed1a60be6c9924e764550f8c15d50a43c920c049fd08bfb` | 6236 |
| `bazzi.json` | al-Bazzi 'an Ibn Kathir | v2.0, qc2 data (2022-02-27) | [qc2_bazzi_2-0_data.zip](https://download.qurancomplex.gov.sa/resources_dev/qc2_bazzi_2-0_data.zip) | [20220729174822](https://web.archive.org/web/20220729174822id_/https://download.qurancomplex.gov.sa/resources_dev/qc2_bazzi_2-0_data.zip) | `9d8d53180c7d6ac05cbb8f30c26703c2a8ced22e0f98c85836198bf9834f4f5a` | `edc434e0801a1a493e1841655f1f8e96` / `5e55adc5dd93f075d643ed046c1d2334fca21d62` match | `a53a177ca4340eb7199eb208912e15957f3757cbc89eb1ce23be1485495fd171` | 6220 |
| `qumbul.json` | Qunbul 'an Ibn Kathir | v2.0, qc2 data (2022-02-27) | [qc2_qunbul_v2_data.zip](https://download.qurancomplex.gov.sa/resources_dev/qc2_qunbul_v2_data.zip) | [20220729175543](https://web.archive.org/web/20220729175543id_/https://download.qurancomplex.gov.sa/resources_dev/qc2_qunbul_v2_data.zip) | `4ea5e740a036396bc045dc8c645f5d5fa7ca128a653b9a919098fe391a331520` | `1759415822f4617e8687d165c74767bb` / `3c8fc8e88744db7cc573a334cfd3e24d2fb49f6f` match | `83d828cbe1223b537a8b18f0f8c7f40221ed60b24c4fc8ca22ed0620bc7edc9b` | 6220 |
| `hafs.json` | Hafs 'an 'Asim (convention reference for `validate.py`) | v2.0, update 13.0 (2023-09-19) | [UthmanicHafs_v2-0.zip](https://download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip) | [20250417225336](https://web.archive.org/web/20250417225336id_/https://download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip) | `a7b0e5591945712ec5e4d6142938ae4d1e9b49bdc89dff06222789bfebdfd72c` | `cf6841aea5b1d1fd70d032b43ff08278` / `36ea5ab0d7ea1702f17ff43f9b50924cccd77ebf` match | `d2960b3217962e7e4252abdcece67bea3d6b48271e4cd3af45bbbb2dd5c872ca` | 6236 |

The member path inside each zip is listed in `sources.lock.json`.

## Why these packages

- **Bazzi / Qunbul.** The 2022 `UthmanicQunbul_v2-0.zip` package must NOT be
  used for Qunbul: its `QunbulData_v2-0.json` (and csv/sql/xml/txt/html) is
  byte-identical to the al-Bazzi text. The `UthmanicBazzi_v2-0.zip` package
  was never archived. The qc2 data packages (`qc2_bazzi_2-0_data.zip`,
  `qc2_qunbul_v2_data.zip`) are the only Bazzi / Qunbul JSON files with a
  published checksum.
- **Cross-check with the signed Word files.** The fonts-site packages
  `UthmanicBazzi_V20.zip` (SHA-256 `b85cd72f…eaf66`, capture 20250424053606)
  and `UthmanicQunbul_V20.zip` (SHA-256 `d33a35f7…81d62`, capture
  20250424120222) hold the KFGQPC-signed Word typesetting of the same texts.
  Compared verse by verse (verse numbers removed, whitespace collapsed):
  - al-Bazzi: JSON = Word in all 6,220 verses.
  - Qunbul: JSON = Word in 6,219 verses. They differ only at 67:17 (Makki;
    Hafs 67:16): JSON `ا۬مِنتُمُۥ`, Word `ۥَا۬مِنتُمُۥ`. **The Word file is
    right**: Qunbul changes the istifham hamza into a waw after
    `ٱلنُّشُورُ` (read `وَامِنتُم`), and KFGQPC writes that waw small, exactly
    as the same JSON does mid-verse at 7:122 (Hafs 7:123) `فِرۡعَوۡنُ ۥَاٰ۬مَنتُمُۥ`.
    The JSON lost the verse-initial small waw. `errata.json` restores it
    from the signed Word file; it is the only erratum.
- **Hafs.** `hafs.json` is not a build input. `validate.py` uses it to prove
  that `normalize.CONVENTION_MAP` turns the KFGQPC encoding into the
  DigitalKhatt one (77,388 of 77,429 words identical; the other words are
  in 22 listed verses with DK-only encodings).

## Schema notes (v2.x)

- Records: `id, jozz, page, sura_no, sura_name_en, sura_name_ar, line_start,
  line_end, aya_no, aya_text` (Hafs adds `aya_text_emlaey`).
- The verse number ends `aya_text` as ONE code point U+FC00 + n − 1 (drawn as
  an ornamented number by the KFGQPC fonts), normally after a NBSP. Shu'bah
  2:286 still uses Arabic-Indic digits; Warsh 16:123 glues the number to the
  last word. `normalize.parse_verse` accepts all three and checks the number
  against `aya_no`.
- A rub' el-hizb sign is a separate token followed by NBSP (`۞ مَثَلُهُمْ`); a
  few verses start with a space (Qalun / Duri / Susi 2:5, Shu'bah 2:6);
  Warsh 4:44 has double spaces; Warsh / Qalun have 14 right-to-left marks
  (U+200F), always at a word end.

## Known upstream issues (not corrected)

- **Qunbul 4:135 (Makki; Hafs 4:136)** reads `أُنزَلَ` (fatha on the zay) in
  both official Qunbul artifacts (qc2 JSON and the signed Word file). Ibn
  Kathir reads the passive `أُنزِلَ` there, as the official al-Bazzi text
  writes it; the 2021 v07 file had `أُنِزَلَ`. The words DB keeps the official
  text; a correction needs a qualified reader's confirmation and, ideally,
  a report to KFGQPC.
- **Qalun 17:62, first word** reads `قَالْ` (U+0652, the Maghribi sukun, on
  the lam) in both official Qalun JSONs (`qc2_qalun_2-1.json` and
  `QalounData_v2-1.json`). Every other rewayah, Warsh included, has `قَالَ`,
  and no reading has a sukun there. The words DB keeps the official text, so
  the highlight map tints the word as written (`highlight_cases.json` pins
  it); a correction needs a qualified reader's confirmation, ideally backed
  by an official artifact such as the printed Qalun mushaf, and is then one
  entry in `errata.json`.
- **Warsh 43:58, word 10** reads `جَدَلاَ` without the iqlab meem in every
  official Warsh artifact (`qc2_warsh_v2-1.json`, `warshData_v2-1.json` and
  the Word file `uthmanic_warsh_v21.docx`), where both official Qalun JSONs
  and the Qalun Word file have `جَدَلاَۢ`, and the other 303 Warsh words
  where Hafs has a tanween with iqlab before a ba carry the meem. As written
  the word has no tanween (`jadalā`), while Nafi' reads `jadalan` like Hafs.
  The words DB keeps the official text and the highlight map tints it as
  written (Warsh only; `highlight_cases.json` pins it).
- **al-Duri 43:78, word 2** reads `لَقَدۡ جِّئۡنَٰكُم`, a sukun on the dal of
  `لَقَدۡ` (read clearly) before a doubled jim (the dal merged into it), in
  the JSON, the qc2 JSON and the Word file `uthmanic_douri_v20.docx`. Abu
  'Amr merges the dal of `قَد` into a jim: al-Susi's text writes
  `لَقَد جِّينَٰكُم`, and everywhere else al-Duri's own text writes a letter
  merged into the next word without a sukun (`وَلَقَد جَّآءَكُم`). The words DB keeps
  the official text; the highlight map reads it as written (a doubled first
  letter after a letter read clearly) and tints `جِّئۡنَٰكُم` (al-Duri only;
  `highlight_cases.json` pins it).

## Changes from the 2021 files used before

Verse-level comparison of the previous repo files (KFGQPC 2020-21 releases:
warshData_v10, QaloonData_v10, DooriData_v09, SoosiData09, BazziData_v07,
QumbulData_v07) with these v2.x files (verse numbers removed, whitespace
collapsed; verse keys are identical in every rewayah):

| rewayah | identical | marks only | letters | whitespace only | examples |
|---|---|---|---|---|---|
| Warsh | 6136 | 72 | 2 | 4 | 2:71 `فَادَّٰرَٰٔتُمْ` → `فَادَّٰرَٰءْتُمْ`; 41:50 `وَنَـ۪ٔا بِجَانِبِهِۦ` split; 37:17 `أَوَءَابَآؤُنَا` joined |
| Qalun | 5896 | 310 | 1 | 7 | 310 waqf-sign corrections; 15:32 `مَا لَكَ` split; 7:97, 15:7, 37:17, 56:51 joined |
| al-Duri | 6210 | 2 | 1 | 4 | 4:44 lone pause mark glued (`اُ۬لسَّبِيلَۚ`); 41:50 split |
| al-Susi | 6165 | 2 | 2 | 48 | 42 `أَوَ X` words joined (`أَوَلَمۡ`); 71:26/27 boundary fixed (`نَارٗا`) |
| al-Bazzi | 6209 | 6 | 2 | 3 | 10:16 `وَلَأَ اْدۡرَىٰكُمُۥ`; waqf signs at 2:196, 3:77, 8:19, 42:1 |
| Qunbul | 6210 | 6 | 1 | 3 | 2:71; 4:135 `أُنِزَلَ` → `أُنزَلَ` (see above) |
