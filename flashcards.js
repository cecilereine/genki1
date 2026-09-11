/* =============================================================
   GENKI I — flashcard review (vocabulary and kanji)

   Loaded after app.js as a classic script. It touches app.js only through the
   window.GENKI surface documented at the bottom of that file, and waits for
   `lessons:loaded` before it has any data to build a deck from.

   Vocabulary and kanji progress are tracked in two separate localStorage keys,
   so working through the kanji deck never marks vocabulary as learned.
   ============================================================= */

/* Wrapped in an IIFE: classic scripts share one global scope, so declaring
   `esc`, `$`, `shuffle`, `overlay`… at top level here would collide with the
   same names in app.js and throw a SyntaxError before any of this runs. */
(() => {
'use strict';

const { esc, $, $$, renderReadings, readingKey, vocabInScope, lessons, activeLesson } = window.GENKI;

const overlay      = $('#overlay');
const fcBody       = $('#fcBody');
const fcMeta       = $('#fcMeta');
const fcControls   = $('#fcControls');
const fcMark       = $('#fcMark');
const fcBar        = $('#fcBar');
const fcPrevBtn    = $('#fcPrev');
const fcNextBtn    = $('#fcNext');
const fcFlipBtn    = $('#fcFlip');
const fcDirBtn     = $('#fcDir');
const fcLearnBtn   = $('#fcLearn');
const fcUnlearnBtn = $('#fcUnlearn');
const fcIncludeChk = $('#fcInclude');

let deck     = [];
let idx      = 0;
let showBack = false;
let scope    = 'all';
let dir      = 'ja';       // 'ja' = Japanese/kanji shown first, 'en' = English first
let fcType   = 'vocab';    // 'vocab' | 'kanji'

/* ---------- learned-card storage ---------- */
const LS_KEYS = { vocab: 'genki_lookup_learned', kanji: 'genki_lookup_kanji_learned' };

/* Private-mode Safari throws on both reads and writes, so neither is fatal. */
function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); }
  catch { /* storage unavailable — progress just won't survive a reload */ }
}

const learned = { vocab: loadSet(LS_KEYS.vocab), kanji: loadSet(LS_KEYS.kanji) };

const currentLearned = () => learned[fcType];
const saveLearned    = () => saveSet(LS_KEYS[fcType], currentLearned());

/* Must match the data-id rendered onto .vcard / .kcard in app.js. */
const cardId = card => fcType === 'kanji'
  ? `${card.lesson}|${card.char}`
  : `${card.lesson}|${card.kana}|${card.kanji}`;

const isLearned = card => currentLearned().has(cardId(card));

function refreshBadges() {
  $$('.vcard').forEach(el => el.classList.toggle('is-learned', learned.vocab.has(el.dataset.id)));
  $$('.kcard').forEach(el => el.classList.toggle('is-learned', learned.kanji.has(el.dataset.id)));
}

/* ---------- deck building ---------- */
const inScope = lesson => scope === 'all' || lesson.lesson === scope;

/* Every card of the current type in the current lesson scope, learned or not. */
function cardsInScope() {
  if (fcType === 'vocab') return vocabInScope(scope);
  return lessons().filter(inScope)
    .flatMap(lesson => (lesson.kanji || []).map(entry => ({ ...entry, lesson: lesson.lesson })));
}

const buildDeck = () => cardsInScope().filter(card => fcIncludeChk.checked || !isLearned(card));

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/* ---------- card faces ---------- */
const sideLabel = text => `<div class="side-label">${text}</div>`;

/* Kanji example strings are "・"-separated; show the first few on the back. */
function sampleWordsHtml(examples) {
  const items = (examples || '').split('・').map(word => word.trim()).filter(Boolean).slice(0, 4);
  if (!items.length) return '';
  return `<div class="fc-ex-list">
            <div class="ex-label">Sample words</div>
            ${items.map(word => `<div class="ex-item">${esc(word)}</div>`).join('')}
          </div>`;
}

function kanjiFaces(card) {
  const readings = `<div class="fc-readings">${renderReadings(card)}${readingKey}</div>`;
  const character = `${sideLabel('Kanji')}<div class="big">${esc(card.char)}</div>`;
  const meaning = `<div class="mean2">${esc(card.meaning)}</div>`;

  return dir === 'ja'
    ? { front: character,
        back:  `${sideLabel('Readings &amp; Meaning')}${meaning}${readings}${sampleWordsHtml(card.examples)}` }
    : { front: `${sideLabel('Meaning')}${meaning}`,
        back:  `${character}${readings}${sampleWordsHtml(card.examples)}` };
}

function vocabFaces(card) {
  const kanjiHint = card.kanji ? `<div class="hint2">${esc(card.kanji)}</div>` : '';
  const japanese = `${sideLabel('Japanese')}<div class="big">${esc(card.kana)}</div>${kanjiHint}`;
  const meaning = `<div class="mean2">${esc(card.mean)}</div>`;
  const reading = `<div class="hint2">${esc(card.kana)}${card.kanji ? ` ・ ${esc(card.kanji)}` : ''}</div>`;

  return dir === 'ja'
    ? { front: japanese, back: `${sideLabel('Meaning')}${meaning}${reading}` }
    : { front: `${sideLabel('English')}${meaning}`, back: japanese };
}

/* ---------- rendering ---------- */
const modeTag = () => (fcType === 'kanji' ? '🈶 Kanji' : '🎴 Vocab');
const setControlsVisible = visible => {
  const value = visible ? 'visible' : 'hidden';
  fcControls.style.visibility = value;
  fcMark.style.visibility = value;
};

function renderDone(heading, message, learnedCount, total) {
  fcBody.innerHTML = `<div class="fc-done"><h3>${heading}</h3><p>${message}</p></div>`;
  fcMeta.textContent = `${modeTag()} · learned ${learnedCount} / ${total}`;
  setControlsVisible(false);
}

function renderCard() {
  const all = cardsInScope();
  const learnedCount = all.filter(isLearned).length;
  fcBar.style.width = all.length ? `${(learnedCount / all.length) * 100}%` : '0';

  if (!deck.length) {
    const allLearned = all.length > 0 && learnedCount === all.length;
    return renderDone(
      allLearned ? '🎉 All learned!' : 'No cards',
      allLearned
        ? "You've marked every card as learned. Reset to review them again."
        : 'No cards in this selection. Try "Include learned" or Reset.',
      learnedCount, all.length);
  }

  if (idx >= deck.length) {
    return renderDone(
      '🎉 Round done!',
      `You went through ${deck.length} card${deck.length > 1 ? 's' : ''}. ` +
      `Learned ${learnedCount} of ${all.length} total.`,
      learnedCount, all.length);
  }

  setControlsVisible(true);
  const card = deck[idx];
  const done = isLearned(card);
  fcMeta.textContent = `${modeTag()} · L${card.lesson} · ${idx + 1}/${deck.length} ` +
                       `· learned ${learnedCount}/${all.length}`;

  const { front, back } = fcType === 'kanji' ? kanjiFaces(card) : vocabFaces(card);
  const status = done
    ? '<div class="fc-status yes">✓ learned</div>'
    : '<div class="fc-status no">still learning</div>';

  fcBody.innerHTML = `<div class="fc-card" id="fcCard">
      ${showBack ? back : front}
      ${status}
      ${showBack ? '' : '<div class="tapflip">tap card to flip</div>'}
    </div>`;
  $('#fcCard').addEventListener('click', flipCard);

  fcPrevBtn.disabled = idx === 0;
  fcFlipBtn.textContent = showBack ? 'Hide' : 'Flip';
  fcLearnBtn.textContent = done ? '✓ Learned' : '✓ Got it — learned';
  fcUnlearnBtn.style.display = done ? 'block' : 'none';
}

/* ---------- deck navigation ---------- */
function startReview() {
  deck = buildDeck();
  goToCard(0);
}

function goToCard(next) {
  if (next < 0) return;
  idx = next;
  showBack = false;
  renderCard();
}

function flipCard() {
  showBack = !showBack;
  renderCard();
}

function setLearned(shouldLearn) {
  const card = deck[idx];
  if (!card) return;

  if (shouldLearn) currentLearned().add(cardId(card));
  else currentLearned().delete(cardId(card));
  saveLearned();
  refreshBadges();

  // A newly learned card leaves the deck unless the user asked to keep those in.
  if (shouldLearn && !fcIncludeChk.checked) {
    deck.splice(idx, 1);
    showBack = false;
  }
  renderCard();
}

function openReview(type) {
  fcType = type;
  scope = activeLesson();
  $$('#fcScope button').forEach(button => button.classList.toggle('on', button.dataset.scope === scope));
  dir = 'ja';
  fcDirBtn.textContent = '日 → EN';
  overlay.classList.add('on');
  startReview();
}

/* ---------- wiring ---------- */
document.addEventListener('lessons:loaded', refreshBadges);

$('#fcStart').addEventListener('click', () => openReview('vocab'));
$('#fcStartKanji').addEventListener('click', () => openReview('kanji'));

$('#fcClose').addEventListener('click', () => overlay.classList.remove('on'));
overlay.addEventListener('click', event => {
  if (event.target === overlay) overlay.classList.remove('on');
});

fcFlipBtn.addEventListener('click', flipCard);
fcNextBtn.addEventListener('click', () => goToCard(idx + 1));
fcPrevBtn.addEventListener('click', () => goToCard(idx - 1));
fcLearnBtn.addEventListener('click', () => setLearned(true));
fcUnlearnBtn.addEventListener('click', () => setLearned(false));
fcIncludeChk.addEventListener('change', startReview);   // deck contents depend on this

$('#fcShuffle').addEventListener('click', () => {
  shuffle(deck);
  goToCard(0);
});

$('#fcReset').addEventListener('click', () => {
  const label = fcType === 'kanji' ? 'kanji' : 'vocabulary';
  if (!confirm(`Reset ${label} progress? All cards will go back into the deck.`)) return;
  currentLearned().clear();
  saveLearned();
  refreshBadges();
  startReview();
});

fcDirBtn.addEventListener('click', () => {
  dir = dir === 'ja' ? 'en' : 'ja';
  fcDirBtn.textContent = dir === 'ja' ? '日 → EN' : 'EN → 日';
  showBack = false;
  renderCard();
});

$('#fcScope').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  $$('#fcScope button').forEach(other => other.classList.remove('on'));
  button.classList.add('on');
  scope = button.dataset.scope;
  startReview();
});

// Arrows navigate, space flips, escape closes — only while the overlay is open.
document.addEventListener('keydown', event => {
  if (!overlay.classList.contains('on')) return;
  if (event.key === 'Escape') overlay.classList.remove('on');
  else if (event.key === 'ArrowRight') goToCard(idx + 1);
  else if (event.key === 'ArrowLeft') goToCard(idx - 1);
  else if (event.key === ' ') { event.preventDefault(); flipCard(); }
});

})();
