# Amharic source fallback inventory

Generated from the bundled English and Amharic resources by `python scripts/report-amharic-coverage.py --write`. CI uses `--check` to require a current inventory without changing files. Counts are resource leaves, including individual plural forms. They do not certify linguistic or native acceptance.

Amharic remains `inProgress`. Populated entries include unreviewed Amharic copy and explicit original-source values; missing entries use the existing English fallback. Specialist reference material requires qualified fluent review before localization.

| Namespace | Source leaves | Populated Amharic leaves | Fallback leaves |
| --- | ---: | ---: | ---: |
| common | 104 | 104 | 0 |
| home | 188 | 188 | 0 |
| collection | 99 | 99 | 0 |
| settings | 260 | 233 | 27 |
| sheets | 239 | 238 | 1 |
| player | 54 | 54 | 0 |
| reader | 41 | 41 | 0 |
| content | 436 | 395 | 41 |
| **Total** | **1,421** | **1,352** | **69** |

## Deliberately retained source values

The [source-value policy](amharic-source-values.json) lists every explicit retained entry. The Amharic integration tests and this report enforce byte-for-byte equality with English for these values. Names follow the registry's English-side catalog policy; copied/shared templates and reference/numeric notation preserve their original output. This does not approve any translated copy or make Amharic release-ready.

| Policy | Leaves |
| --- | ---: |
| Canonical catalog/reference names | 132 |
| Canonical outgoing copy/share values | 13 |
| Reference and numeric notation | 10 |

## Remaining source fallbacks

The remaining descriptions explain recitation transmissions, tajweed/reference legends and rewayat. They are intentionally not machine-translated in this interface pass. Religious quotations, source descriptions and technical terminology need a qualified reviewer. Their interface headings/actions are localized separately.

### settings

| Missing source key | Triage | English fallback |
| --- | --- | --- |
| `settings:mushafSettings.legendSummary.shubah` | Specialist reference review | Flags words that differ from Hafs. Letter-level tajweed rules are not highlighted for this rewayah. |
| `settings:mushafSettings.legendSummary.ibnKathir` | Specialist reference review | Flags words that differ from Hafs and highlights Ibn Kathir's silah (pronoun lengthening). Letter-level tajweed rules are not highlighted. |
| `settings:mushafSettings.legendSummary.nafi` | Specialist reference review | Highlights the published-mushaf rules KFGQPC encodes: tashil, ibdal, madd al-badal, taghliz al-lam, silah, and genuine word variants. Taqlil, tarqiq ar-ra, and naql are not yet supported. |
| `settings:mushafSettings.legendSummary.abuAmr` | Specialist reference review | Flags only genuine letter-level word variants from Hafs. Abu Amr-specific tajweed rules (idgham kabeer, imalah) are not yet highlighted. |
| `settings:mushafSettings.legend.wordVariant.label` | Specialist reference review | Word variant |
| `settings:mushafSettings.legend.wordVariant.description` | Specialist reference review | Letter-level difference from Hafs |
| `settings:mushafSettings.legend.genuineWordVariant.label` | Specialist reference review | Word variant |
| `settings:mushafSettings.legend.genuineWordVariant.description` | Specialist reference review | Genuine letter-level difference from Hafs |
| `settings:mushafSettings.legend.vowelShift.label` | Specialist reference review | Vowel / mood shift |
| `settings:mushafSettings.legend.vowelShift.description` | Specialist reference review | Trailing-vowel or mood change only |
| `settings:mushafSettings.legend.silah.label` | Specialist reference review | Silah |
| `settings:mushafSettings.legend.silah.description` | Specialist reference review | Pronoun-lengthening mark (ۥ / ۦ) |
| `settings:mushafSettings.legend.maddBadal.label` | Specialist reference review | Madd al-Badal |
| `settings:mushafSettings.legend.maddBadal.description` | Specialist reference review | Prolonged vowel after hamza |
| `settings:mushafSettings.legend.tashil.label` | Specialist reference review | Tashil / Musahhala |
| `settings:mushafSettings.legend.tashil.description` | Specialist reference review | Softened hamza pronunciation |
| `settings:mushafSettings.legend.ibdal.label` | Specialist reference review | Ibdal |
| `settings:mushafSettings.legend.ibdal.description` | Specialist reference review | Hamza replaced by long vowel |
| `settings:mushafSettings.legend.taghliz.label` | Specialist reference review | Taghliz al-Lam |
| `settings:mushafSettings.legend.taghliz.description` | Specialist reference review | Heavy lam in Allah after emphatic letters |
| `settings:mushafSettings.legendV2.labels.wordVariant` | Specialist reference review | Word variant |
| `settings:mushafSettings.legendV2.labels.silah` | Specialist reference review | Silah |
| `settings:mushafSettings.legendV2.descriptions.wordVariant` | Specialist reference review | Word that reads differently from Hafs |
| `settings:mushafSettings.legendV2.descriptions.silah` | Specialist reference review | Pronoun-lengthening mark (ۥ / ۦ) |
| `settings:mushafSettings.legendV2.descriptions.silahDifference` | Specialist reference review | Pronoun-lengthening mark (ۥ / ۦ) that differs from Hafs |
| `settings:mushafSettings.legendV2.summary.words` | Specialist reference review | Tints words that read differently from Hafs. Pronunciation rules such as tashil, imalah and taqlil are not highlighted. |
| `settings:mushafSettings.legendV2.summary.wordsAndSilah` | Specialist reference review | Tints words that read differently from Hafs and colors silah marks. Pronunciation rules such as tashil, imalah and taqlil are not highlighted. |

### sheets

| Missing source key | Triage | English fallback |
| --- | --- | --- |
| `sheets:rewayatInfo.explanation` | Specialist reference review | A Rewayah (رواية, plural: Rewayat رِوَايَات) is a specific method of reciting the Quran that represents a particular transmission route within a larger Qira'at (قِرَاءَة, plural: Qira'at قِرَاءَات) tradition.<br><br>While Qira'at are the major schools of Quranic recitation attributed to famous reciters, Rewayat are the specific ways these recitations were transmitted through chains of narrators back to the Prophet Muhammad ﷺ.<br><br>"The Quran was revealed in seven ahruf (styles). So recite what is easier for you from it."<br>- Sahih al-Bukhari 2419, Sahih Muslim 818<br><br>The most widely used Rewayah today is Hafs 'an Assem (حَفْص عَن عَاصِم), which is considered the standard version used in most printed Qurans and is instantly recognizable to most Muslims worldwide.<br><br>Each Rewayah may have slight variations in pronunciation, elongation, or articulation points. These differences are purely phonetic and never alter the meaning of the Quranic text, as they all represent authentic ways of reciting the Quran that have been meticulously preserved. |

### content

| Missing source key | Triage | English fallback |
| --- | --- | --- |
| `content:rewayah.description.hafs` | Specialist reference review | The standard reading, used by most of the Muslim world |
| `content:rewayah.description.shubah` | Specialist reference review | The second Kufan transmission from Asim |
| `content:rewayah.description.al-bazzi` | Specialist reference review | Meccan transmission from Ibn Kathir, read throughout Mecca and Yemen |
| `content:rewayah.description.qunbul` | Specialist reference review | The second Meccan transmission from Ibn Kathir |
| `content:rewayah.description.warsh` | Specialist reference review | Medinan transmission from Nafi' — dominant across North Africa |
| `content:rewayah.description.qalun` | Specialist reference review | The second Medinan transmission from Nafi' — read in Libya and parts of Tunisia |
| `content:rewayah.description.al-duri-abi-amr` | Specialist reference review | Basran transmission from Abu Amr — common in Sudan and parts of West Africa |
| `content:rewayah.description.al-susi` | Specialist reference review | The second Basran transmission from Abu Amr |
| `content:rewayah.description.hisham` | Specialist reference review | Damascene transmission from Ibn Amir |
| `content:rewayah.description.ibn-dhakwan` | Specialist reference review | The second Damascene transmission from Ibn Amir |
| `content:rewayah.description.khalaf-an-hamzah` | Specialist reference review | Kufan transmission from Hamzah |
| `content:rewayah.description.khallad` | Specialist reference review | The second Kufan transmission from Hamzah |
| `content:rewayah.description.al-duri-al-kisai` | Specialist reference review | Kufan transmission from al-Kisa'i (distinct from Al-Duri 'an Abu Amr) |
| `content:rewayah.description.abu-al-harith` | Specialist reference review | The second Kufan transmission from al-Kisa'i |
| `content:rewayah.description.ibn-jammaz` | Specialist reference review | Medinan transmission from Abu Ja'far (10th Qira'ah) |
| `content:rewayah.description.ibn-wardan` | Specialist reference review | The second Medinan transmission from Abu Ja'far (10th Qira'ah) |
| `content:rewayah.description.rawh` | Specialist reference review | Basran transmission from Ya'qub (10th Qira'ah) |
| `content:rewayah.description.ruwais` | Specialist reference review | The second Basran transmission from Ya'qub (10th Qira'ah) |
| `content:rewayah.description.idris` | Specialist reference review | Transmission from Khalaf al-Bazzar (10th Qira'ah) |
| `content:rewayah.description.ishaq` | Specialist reference review | The second transmission from Khalaf al-Bazzar (10th Qira'ah) |
| `content:rewayat.entries.warsh-an-nafi.description` | Specialist reference review | Narration of Warsh from Imam Nafi' |
| `content:rewayat.entries.qalon-an-nafi.description` | Specialist reference review | Narration of Qalun from Imam Nafi' |
| `content:rewayat.entries.albizi-an-ibn-katheer.description` | Specialist reference review | Narration of Al-Bazzi from Ibn Kathir |
| `content:rewayat.entries.qunbol-an-ibn-katheer.description` | Specialist reference review | Narration of Qunbul from Ibn Kathir |
| `content:rewayat.entries.aldori-an-abi-amr.description` | Specialist reference review | Narration of Al-Duri from Abu Amr |
| `content:rewayat.entries.assosi-an-abi-amr.description` | Specialist reference review | Narration of Al-Susi from Abu Amr |
| `content:rewayat.entries.ibn-thakwan-an-ibn-amer.description` | Specialist reference review | Narration of Ibn Dhakwan from Ibn Amir |
| `content:rewayat.entries.hesham-an-ibn-amer.description` | Specialist reference review | Narration of Hisham from Ibn Amir |
| `content:rewayat.entries.hafs-an-assem.description` | Specialist reference review | Narration of Hafs from Imam Asim |
| `content:rewayat.entries.shubah-an-assem.description` | Specialist reference review | Narration of Shu'bah from Imam Asim |
| `content:rewayat.entries.khalaf-an-hamzah.description` | Specialist reference review | Narration of Khalaf from Hamzah |
| `content:rewayat.entries.khallad-an-hamzah.description` | Specialist reference review | Narration of Khallad from Hamzah |
| `content:rewayat.entries.aldorai-an-alkisaai.description` | Specialist reference review | Narration of Al-Duri from al-Kisa'i |
| `content:rewayat.entries.abu-al-harith-an-alkisai.description` | Specialist reference review | Narration of Abu al-Harith from al-Kisa'i |
| `content:rewayat.entries.ibn-jammaz-an-abi-jafar.description` | Specialist reference review | Narration of Ibn Jammaz from Abu Ja'far |
| `content:rewayat.entries.ibn-wardan-an-abi-jafar.description` | Specialist reference review | Narration of Ibn Wardan from Abu Ja'far |
| `content:rewayat.entries.rowis-rawh-an-yakoob.description` | Specialist reference review | Narration of Ruwais and Rawh from Ya'qub al-Hadrami |
| `content:rewayat.entries.rawh-an-yaqub.description` | Specialist reference review | Narration of Rawh from Ya'qub al-Hadrami |
| `content:rewayat.entries.ruwais-an-yaqub.description` | Specialist reference review | Narration of Ruwais from Ya'qub al-Hadrami |
| `content:rewayat.entries.idris-an-khalaf.description` | Specialist reference review | Narration of Idris from Khalaf al-Bazzar |
| `content:rewayat.entries.ishaq-an-khalaf.description` | Specialist reference review | Narration of Ishaq from Khalaf al-Bazzar |
