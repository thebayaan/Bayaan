# Audio on R2 that is not in the catalogue yet

Added 2026-10-29 from QuranicAudio. These sets are on R2 (bucket `bayaan-audio`, served at https://cdn.thebayaan.com) but have no reciter or rewayah rows, so the app does not show them. They were held back because they need style types the backend does not have yet (Taraweeh, with translation), and because the ayah aligner cannot time live Taraweeh recordings.

To finish them: add the styles to `RewayatStyleSchema` in bayaan-backend, decide how the app should label them, create the rows, and decide how to handle timings.

| QuranicAudio id | Name | R2 folder | Surahs |
|---|---|---|---|
| 24 | Abdullah Ali Jabir [Taraweeh] | `quran/recitations/ali-jaber/hafs/taraweeh/qa-24/` | 114 |
| 25 | Madinah Taraweeh 1419 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1419/` | 113 |
| 29 | Makkah Taraweeh 1426 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1426/` | 114 |
| 30 | Madinah Taraweeh 1426 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1426/` | 114 |
| 33 | Madinah Taraweeh 1427 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1427/` | 114 |
| 34 | Makkah Taraweeh 1427 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1427/` | 114 |
| 36 | Sudais and Shuraym with Aslam Athar [Pickthall Translation] | `quran/recitations/sudais-and-shuraym/hafs/translation/qa-36/` | 114 |
| 39 | Muhammad Ayyub with Mikaal Waters [Muhsin Khan Translation] | `quran/recitations/mohammed-ayyub/hafs/translation/qa-39/` | 114 |
| 42 | Shakir Qasami with Aslam Athar [Pickthall Translation] | `quran/recitations/shakir-qasmi/hafs/translation/qa-42/` | 114 |
| 45 | Makkah Taraweeh 1425 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1425/` | 113 |
| 46 | Madinah Taraweeh 1423 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1423/` | 114 |
| 47 | AbdulBaset AbdulSamad with Naeem Sultan [Pickthall Translation] | `quran/recitations/abdulbasit-abdulsamad/hafs/translation/qa-47/` | 114 |
| 48 | Sudais and Shuraym with Naeem Sultan [Pickthall Translation] | `quran/recitations/sudais-and-shuraym/hafs/translation/qa-48/` | 114 |
| 49 | Mishari ibn Rashid al-`Afasy with Saabir [Muhsin Khan Translation] | `quran/recitations/mishary-alafasi/hafs/translation/qa-49/` | 84 |
| 57 | AbdulBaset AbdulSamad with Ibrahim Walk [Saheeh Intl Translation] | `quran/recitations/abdulbasit-abdulsamad/hafs/translation/qa-57/` | 114 |
| 58 | Mishari ibn Rashid al-`Afasy with Ibrahim Walk [Saheeh Intl Translation] | `quran/recitations/mishary-alafasi/hafs/translation/qa-58/` | 114 |
| 59 | Makkah Taraweeh 1428 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1428/` | 114 |
| 63 | Makkah Taraweeh 1424 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1424/` | 114 |
| 66 | Abdullah Basfar with Ibrahim Walk [Saheeh Intl Translation] | `quran/recitations/abdullah-basfer/hafs/translation/qa-66/` | 114 |
| 67 | Sudais and Shuraym [Urdu Translation] | `quran/recitations/sudais-and-shuraym/hafs/translation/qa-67/` | 95 |
| 73 | Madinah Taraweeh 1428 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1428/` | 113 |
| 77 | Makkah Taraweeh 1429 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1429/` | 114 |
| 82 | Makkah Taraweeh 1430 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1430/` | 114 |
| 83 | Makkah Taraweeh 1431 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1431/` | 114 |
| 84 | Madinah Taraweeh 1431 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1431/` | 114 |
| 85 | Hatem Farid | `quran/recitations/hatem-fareed-alwaer/hafs/taraweeh/qa-85/` | 60 |
| 87 | Hatem Farid - Taraweeh 1431 | `quran/recitations/hatem-fareed-alwaer/hafs/taraweeh/qa-87/` | 114 |
| 94 | Makkah Taraweeh 1432 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1432/` | 114 |
| 95 | Mishari al-`Afasy - Taraweeh 1430 | `quran/recitations/mishary-alafasi/hafs/taraweeh/qa-95/` | 114 |
| 96 | Hatem Farid - Taraweeh 1433 | `quran/recitations/hatem-fareed-alwaer/hafs/taraweeh/qa-96/` | 76 |
| 98 | Makkah Taraweeh 1433 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1433/` | 114 |
| 99 | Madinah Taraweeh 1429 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1429/` | 114 |
| 100 | Madinah Taraweeh 1430 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1430/` | 114 |
| 101 | Madinah Taraweeh 1432 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1432/` | 114 |
| 102 | Madinah Taraweeh 1433 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1433/` | 114 |
| 115 | Abu Bakr al-Shatri [Taraweeh] | `quran/recitations/shaik-abu-bakr-al-shatri/hafs/taraweeh/qa-115/` | 114 |
| 118 | Masjid Quba Taraweeh 1434 | `quran/recitations/masjid-quba-taraweeh/hafs/taraweeh/1434/` | 114 |
| 120 | Makkah Taraweeh 1434 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1434/` | 114 |
| 121 | Muhammad al-Mehysni - Taraweeh 1435 | `quran/recitations/mohammed-al-muhasny/hafs/taraweeh/qa-121/` | 114 |
| 123 | Madinah Taraweeh 1435 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1435/` | 114 |
| 131 | Makkah Taraweeh 1435 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1435/` | 114 |
| 132 | Makkah Taraweeh 1436 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1436/` | 114 |
| 133 | Makkah Taraweeh 1437 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1437/` | 114 |
| 139 | Hatem Farid - Taraweeh 1430 | `quran/recitations/hatem-fareed-alwaer/hafs/taraweeh/qa-139/` | 114 |
| 140 | Hatem Farid - Taraweeh 1434 | `quran/recitations/hatem-fareed-alwaer/hafs/taraweeh/qa-140/` | 24 |
| 143 | Madinah Taraweeh 1434 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1434/` | 114 |
| 144 | Madinah Taraweeh 1436 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1436/` | 114 |
| 145 | Madinah Taraweeh 1437 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1437/` | 114 |
| 146 | Madinah Taraweeh 1439 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1439/` | 114 |
| 147 | Madinah Taraweeh 1440 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1440/` | 114 |
| 148 | Madinah Taraweeh 1441 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1441/` | 114 |
| 149 | Madinah Taraweeh 1442 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1442/` | 114 |
| 150 | Makkah Taraweeh 1438 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1438/` | 114 |
| 151 | Makkah Taraweeh 1439 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1439/` | 114 |
| 152 | Makkah Taraweeh 1440 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1440/` | 114 |
| 153 | Makkah Taraweeh 1441 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1441/` | 114 |
| 154 | Makkah Taraweeh 1442 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1442/` | 114 |
| 165 | Ibrahim Walk | `quran/recitations/ibrahim-walk/hafs/translation/qa-165/` | 114 |
| 171 | Madinah Taraweeh 1443 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1443/` | 114 |
| 172 | Madinah Taraweeh 1444 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1444/` | 114 |
| 173 | Madinah Taraweeh 1445 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1445/` | 114 |
| 174 | Madinah Taraweeh 1446 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1446/` | 114 |
| 175 | Makkah Taraweeh 1443 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1443/` | 114 |
| 176 | Makkah Taraweeh 1444 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1444/` | 114 |
| 177 | Makkah Taraweeh 1445 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1445/` | 114 |
| 178 | Makkah Taraweeh 1446 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1446/` | 114 |
| 179 | Makkah Taraweeh 1447 | `quran/recitations/makkah-taraweeh/hafs/taraweeh/1447/` | 114 |
| 180 | Madinah Taraweeh 1447 | `quran/recitations/madinah-taraweeh/hafs/taraweeh/1447/` | 114 |

Files are named `NNN.mp3` (surah number, zero-padded). Some surahs failed at the source (QuranicAudio has no file for them); list the folder before creating rows.
