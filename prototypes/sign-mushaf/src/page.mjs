// @ts-check
/* global document, localStorage, ASSET_DATA */
/**
 * index.html: alphabet grid, marks legend and Al-Fatihah, rendered from the
 * converter's sign tokens with LPMQ's illustrations (ASSET_DATA is injected by
 * tools/build.mjs from the asset map).
 */

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * @param {number} n
 * @returns {string}
 */
function arabicNumber(n) {
  return String(n)
    .split('')
    .map(d => ARABIC_DIGITS[Number(d)])
    .join('');
}

/**
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  return s.replace(
    /[&<>"]/g,
    c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c] || c),
  );
}

/**
 * Image tag for a mark glyph, sized to the guideline's mark-to-hand proportion.
 * @param {string} id
 * @param {number} handPx displayed hand height in px
 * @returns {string}
 */
function markImg(id, handPx) {
  // @ts-ignore injected by the build
  const a = ASSET_DATA.marks[id];
  if (!a) return '';
  const k = handPx / EXAMPLE_HAND_PX;
  return `<img src="${a.src}" width="${Math.round(
    a.w * k,
  )}" height="${Math.round(a.h * k)}" alt="${id}">`;
}

/**
 * One sign: marks above, the hand, marks below.
 * @param {import('./converter.mjs').SignToken} s
 * @param {number} handPx
 * @returns {string}
 */
function signHtml(s, handPx) {
  // @ts-ignore injected by the build
  const hand = ASSET_DATA.letters[s.letter];
  const {above, below, badges} = markLayout(s);
  const label = `${LETTERS_INFO[s.letter]?.name || s.letter}${
    s.vowel ? ', ' + s.vowel : ''
  }${s.shadda ? ', shadda' : ''}${s.madd ? ', madd' : ''}`;
  return `<figure class="sg" title="${esc(formatSign(s))}">
    <div class="band above">${above.map(m => markImg(m, handPx)).join('')}</div>
    <img class="hand" src="${hand.src}" alt="${esc(label)}">
    <div class="band below">${below
      .map(m => markImg(m, handPx))
      .join('')}${badges
    .map(b => `<span class="badge">${b}</span>`)
    .join('')}</div>
  </figure>`;
}

function renderAlphabet() {
  const el = /** @type {HTMLElement} */ (document.getElementById('alphabet'));
  el.innerHTML = ALPHABET_ORDER.map(id => {
    const L = LETTERS_INFO[id];
    // @ts-ignore injected by the build
    const a = ASSET_DATA.letters[id];
    return `<article class="card">
      <div class="card-head"><span class="nm">${esc(
        L.name,
      )}</span><span class="no">${
      L.lpmqNo ? 'No. ' + L.lpmqNo : 'Tilawah'
    }</span><span class="ar" lang="ar" dir="rtl">${L.char}</span></div>
      <div class="pic"><img src="${a.src}" alt="Hand sign for ${esc(
      L.name,
    )}"></div>
      <p>${esc(L.description)}</p>
    </article>`;
  }).join('');
}

const LEGEND = [
  ['fathah', 'َ'],
  ['kasrah', 'ِ'],
  ['dammah', 'ُ'],
  ['fathatain', 'ً'],
  ['kasratain', 'ٍ'],
  ['dammatain', 'ٌ'],
  ['sukun', 'ۡ'],
  ['shadda', 'ّ'],
  ['fathahTegak', 'ٰ'],
  ['kasrahTegak', 'ٖ'],
  ['dammahTerbalik', 'ٗ'],
  ['madd', 'ٓ'],
  ['sifr', '۟'],
];

function renderLegend() {
  const el = /** @type {HTMLElement} */ (document.getElementById('legend'));
  const items = LEGEND.map(([id, ar]) => {
    const m = MARKS[id];
    return `<div class="legend-item"><div class="glyph">${markImg(
      id,
      120,
    )}</div><div><h3>${esc(
      m.name,
    )} <span class="ar" lang="ar">ـ${ar}</span></h3><p>${esc(
      m.meaning,
    )}</p></div></div>`;
  });
  items.push(
    `<div class="legend-item"><div class="glyph">${markImg(
      'hamzaFathah',
      150,
    )}${markImg(
      'hamzaDammah',
      150,
    )}</div><div><h3>Harakat on hamza (Kitabah)</h3><p>The index fingertip draws the hamza in the air, then draws the haraka as a stroke: a slanted line for fathah (above) or kasrah (below), an upright line for the long forms, a curve for dammah. Hamza with sukun has no stroke.</p></div></div>`,
    `<div class="legend-item"><div class="glyph"><span class="txt">hold 2</span></div><div><h3>Held 2 beats (Tilawah)</h3><p>Nun sakinah or tanwin before an ikhfa or iqlab letter is held for 2 beats. The guideline gives no glyph; the page prints a small label.</p></div></div>`,
    `<div class="legend-item"><div class="glyph"><span class="txt">qalqalah</span></div><div><h3>Qalqalah (Tilawah)</h3><p>A qalqalah letter with sukun is bounced quickly forward. No glyph in the guideline; shown as a small label.</p></div></div>`,
    `<div class="legend-item"><div class="glyph"><span class="ayah-end" style="border-color:#0d675f;color:#0d675f">١</span></div><div><h3>Ayah end and waqf signs</h3><p>The ayah number is not fingerspelled: the guideline shows the ayah marker and the waqf signs (لا, قلى) beside and above the hands as they appear in the mushaf.</p></div></div>`,
  );
  el.innerHTML = items.join('');
}

const state = {method: 'kitabah', text: 'qpc', hand: 'right'};

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('signMushaf') || '{}');
    if (s.method === 'tilawah' || s.method === 'kitabah')
      state.method = s.method;
    if (s.text === 'msi' || s.text === 'qpc') state.text = s.text;
    if (s.hand === 'left' || s.hand === 'right') state.hand = s.hand;
  } catch (e) {
    /* storage unavailable */
  }
}

function saveState() {
  try {
    localStorage.setItem('signMushaf', JSON.stringify(state));
  } catch (e) {
    /* storage unavailable */
  }
}

/**
 * @param {string} text
 * @returns {import('./converter.mjs').AyahOut}
 */
function convert(text) {
  return state.method === 'tilawah' ? toTilawah(text) : toKitabah(text);
}

function renderFatihah() {
  const el = /** @type {HTMLElement} */ (document.getElementById('fatihah'));
  const handPx = window.matchMedia('(max-width: 520px)').matches ? 44 : 64;
  el.className = state.hand === 'left' ? 'lefty' : '';
  el.style.display = 'grid';
  el.style.gap = '14px';
  el.innerHTML = FATIHAH.map(a => {
    const out = convert(state.text === 'msi' ? a.msi : a.qpc);
    const ref = convert(a.msi);
    let diffs = 0;
    const words = out.words
      .map((w, i) => {
        const mine = w.signs.map(formatSign).join(' ');
        const theirs = ref.words[i]
          ? ref.words[i].signs.map(formatSign).join(' ')
          : '';
        const differs = state.text === 'qpc' && mine !== theirs;
        if (differs) diffs++;
        const waqf = w.marks
          .map(m => `<span class="waqf" lang="ar">${esc(m.label)}</span>`)
          .join('');
        return `<div class="word${differs ? ' differs' : ''}"${
          differs ? ` title="Guideline example: ${esc(theirs)}"` : ''
        }>
          <div class="word-text" lang="ar" dir="rtl">${esc(w.text)}</div>
          <div class="signs">${w.signs
            .map(s => signHtml(s, handPx))
            .join('')}${waqf}</div>
        </div>`;
      })
      .join('');
    const end = out.number
      ? `<span class="ayah-end" aria-label="end of ayah ${
          out.number
        }">${arabicNumber(out.number)}</span>`
      : '';
    const count = out.words.reduce((n, w) => n + w.signs.length, 0);
    return `<article class="ayah" aria-label="Ayah ${a.number}">
      <div class="ayah-words">${words}${end}</div>
      <p class="translit">${esc(a.transliteration)}</p>
      <div class="ayah-meta"><span>Ayah ${
        a.number
      }</span><span>${count} signs</span>${
      diffs
        ? `<span>${diffs} word${
            diffs > 1 ? 's differ' : ' differs'
          } from the guideline example (hover for its signs)</span>`
        : ''
    }</div>
    </article>`;
  }).join('');
}

/**
 * @param {string} onId
 * @param {string} offId
 * @param {() => void} onClick
 * @param {() => void} offClick
 */
function wireToggle(onId, offId, onClick, offClick) {
  const a = /** @type {HTMLButtonElement} */ (document.getElementById(onId));
  const b = /** @type {HTMLButtonElement} */ (document.getElementById(offId));
  a.addEventListener('click', onClick);
  b.addEventListener('click', offClick);
}

function syncButtons() {
  /** @type {[string, boolean][]} */
  const pairs = [
    ['m-kitabah', state.method === 'kitabah'],
    ['m-tilawah', state.method === 'tilawah'],
    ['t-qpc', state.text === 'qpc'],
    ['t-msi', state.text === 'msi'],
    ['h-right', state.hand === 'right'],
    ['h-left', state.hand === 'left'],
  ];
  for (const [id, on] of pairs)
    document
      .getElementById(id)
      ?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

/**
 * @param {Partial<typeof state>} patch
 */
function update(patch) {
  Object.assign(state, patch);
  saveState();
  syncButtons();
  renderFatihah();
}

loadState();
renderAlphabet();
renderLegend();
syncButtons();
renderFatihah();
wireToggle(
  'm-kitabah',
  'm-tilawah',
  () => update({method: 'kitabah'}),
  () => update({method: 'tilawah'}),
);
wireToggle(
  't-qpc',
  't-msi',
  () => update({text: 'qpc'}),
  () => update({text: 'msi'}),
);
wireToggle(
  'h-right',
  'h-left',
  () => update({hand: 'right'}),
  () => update({hand: 'left'}),
);
