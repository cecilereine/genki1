/* =============================================================
   GENKI I — grammar, vocabulary & kanji lookup

   Data shape (lessons/lessonN.json, listed in lessons/manifest.json):
     lesson.lesson  → tab id, e.g. "1"     (matched against the tab buttons)
     lesson.num     → display label, e.g. "L1"
     lesson.title   → Japanese lesson title
     lesson.en      → English lesson title
     lesson.vocab   → [{ theme, items: [{ kana, kanji, mean }] }]
     lesson.kanji   → [{ char, on: [reading…], kun: [reading…], meaning, examples }]
     lesson.grammar → [{ form, tag, def: [paragraph…], ex: [sentence…], table? }]

   `table` is { head: [...], rows: [[...], ...] }.
   `on` / `kun` are the on'yomi and kun'yomi exactly as the Genki kanji charts list
   them (in hiragana, like the book); either may be empty.
   ============================================================= */

let LESSONS = [];

const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* Escapes text for both HTML bodies and quoted attributes. Coerces first so a
   missing or numeric JSON field can't throw. */
const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => HTML_ENTITIES[ch]);

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- rendering ---------- */
const content = $('#content');

/* The searchable haystack for a card, lowercased and stored in data-search. */
const searchText = (...parts) => parts.join(' ').toLowerCase();

function renderVocabCard(item, lesson) {
  return `
    <div class="vcard"
         data-id="${esc(`${lesson.lesson}|${item.kana}|${item.kanji}`)}"
         data-search="${esc(searchText(item.kana, item.kanji, item.mean))}">
      <span class="learned-badge" title="Learned">✓</span>
      <div class="kw">${esc(item.kana)}</div>
      ${item.kanji ? `<div class="kj">${esc(item.kanji)}</div>` : ''}
      <div class="mean">${esc(item.mean)}</div>
    </div>`;
}

function renderVocabGroup(group, lesson) {
  return `
    <div class="theme">${esc(group.theme)}</div>
    <div class="grid">${group.items.map(item => renderVocabCard(item, lesson)).join('')}</div>`;
}

/* Readings the way the Genki kanji charts print them: ▶ marks on'yomi, ▷ marks
   kun'yomi. Only the lines a kanji actually has are shown. */
const READING_MARKS = { on: ['▶', "on'yomi"], kun: ['▷', "kun'yomi"] };

function renderReadings(entry) {
  return ['on', 'kun']
    .filter(kind => entry[kind]?.length)
    .map(kind => {
      const [mark, name] = READING_MARKS[kind];
      return `<div class="reading ${kind}"><span class="mark" title="${name}">${mark}</span>${entry[kind].map(esc).join('　')}</div>`;
    })
    .join('');
}

const READING_KEY =
  `<div class="reading-key"><span class="mark">▶</span> on'yomi　<span class="mark">▷</span> kun'yomi</div>`;

function renderKanjiCard(entry, lesson) {
  return `
    <div class="kcard"
         data-id="${esc(`${lesson.lesson}|${entry.char}`)}"
         data-search="${esc(searchText(entry.char, entry.on.join(' '), entry.kun.join(' '), entry.meaning, entry.examples))}">
      <span class="learned-badge" title="Learned">✓</span>
      <div class="kj-char">${esc(entry.char)}</div>
      <div class="kj-read">${renderReadings(entry)}</div>
      <div class="kj-mean">${esc(entry.meaning)}</div>
      <div class="kj-ex">${esc(entry.examples)}</div>
    </div>`;
}

function renderKanjiBlock(lesson) {
  if (!lesson.kanji?.length) return '';
  return `
    <div class="block-title"><span class="dot k"></span>漢字 · Kanji</div>
    ${READING_KEY}
    <div class="grid">${lesson.kanji.map(entry => renderKanjiCard(entry, lesson)).join('')}</div>`;
}

function renderTable(table) {
  const head = table.head.map(heading => `<th>${esc(heading)}</th>`).join('');
  const rows = table.rows
    .map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<table class="conj"><tr>${head}</tr>${rows}</table>`;
}

function renderGrammarCard(point) {
  const examples = point.ex.length
    ? `<div class="lbl ex-lbl">例文 · Examples</div>
       <ul class="ex-list">${point.ex.map(example => `<li>${esc(example)}</li>`).join('')}</ul>`
    : '';

  return `
    <div class="gcard"
         data-search="${esc(searchText(point.form, point.tag, point.def.join(' '), point.ex.join(' ')))}">
      <span class="form">${esc(point.form)}</span>
      <div class="tagline">${esc(point.tag)}</div>

      <div class="lbl">説明 · Explanation</div>
      <div class="def-txt">${point.def.map(esc).join('<br><br>')}</div>

      ${examples}
      ${point.table ? renderTable(point.table) : ''}
    </div>`;
}

function renderLesson(lesson) {
  return `
    <section class="lesson" data-lesson="${esc(lesson.lesson)}">
      <div class="lesson-head">
        <span class="num">${esc(lesson.num)}</span>
        <h2>${esc(lesson.title)}</h2>
        <span class="en">${esc(lesson.en)}</span>
      </div>

      <div class="block-title"><span class="dot v"></span>単語 · Vocabulary</div>
      ${lesson.vocab.map(group => renderVocabGroup(group, lesson)).join('')}

      ${renderKanjiBlock(lesson)}

      <div class="block-title"><span class="dot g"></span>文法 · Grammar</div>
      ${lesson.grammar.map(renderGrammarCard).join('')}
    </section>`;
}

function render() {
  content.innerHTML =
    LESSONS.map(renderLesson).join('') +
    '<div class="noresult hidden" id="noresult">No matches found. Try another word.</div>';
}

/* This script is loaded as app.js?v=N. Reusing that same query on the lesson
   fetches means one version bump in index.html also busts the cached JSON —
   otherwise newly added words can stay hidden behind a cached lesson file. */
const ASSET_VERSION = new URL(document.currentScript.src).search;

async function loadLessons() {
  try {
    const manifest = await fetch(`lessons/manifest.json${ASSET_VERSION}`).then(response => response.json());
    LESSONS = await Promise.all(
      manifest.map(file => fetch(`lessons/${file}${ASSET_VERSION}`).then(response => response.json()))
    );
    render();
    document.dispatchEvent(new CustomEvent('lessons:loaded'));
  } catch (error) {
    console.error('Lesson data failed to load:', error);
    content.innerHTML =
      `<p class="load-error">Couldn't load the lesson files. Open this page from a web
       server (like GitHub Pages) instead of double-clicking the file.</p>`;
  }
}

/* ---------- search & lesson filtering ---------- */
const search = $('#search');
const tabs   = $('#tabs');
let activeLesson = 'all';

function applyFilters() {
  const query = search.value.trim().toLowerCase();
  let anyVisible = false;

  $$('section.lesson').forEach(section => {
    if (activeLesson !== 'all' && section.dataset.lesson !== activeLesson) {
      section.classList.add('hidden');
      return;
    }

    let sectionHasMatch = false;
    $$('[data-search]', section).forEach(card => {
      const hit = !query || card.dataset.search.includes(query);
      card.classList.toggle('hidden', !hit);
      if (hit) sectionHasMatch = true;
    });

    /* Hide a theme heading once every card under it is filtered out. Kanji grids
       have a .block-title above them instead, which stays put. */
    $$('.grid', section).forEach(grid => {
      const visible = [...grid.children].some(card => !card.classList.contains('hidden'));
      grid.classList.toggle('hidden', !visible);
      const label = grid.previousElementSibling;
      if (label?.classList.contains('theme')) label.classList.toggle('hidden', !visible);
    });

    section.classList.toggle('hidden', !sectionHasMatch);
    if (sectionHasMatch) anyVisible = true;
  });

  $('#noresult')?.classList.toggle('hidden', anyVisible);
  highlight(query);
}

/* Wraps matches in <mark>, after first unwrapping the previous pass's marks. */
function highlight(query) {
  $$('mark').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
  if (!query) return;

  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  $$('.vcard:not(.hidden), .kcard:not(.hidden), .gcard:not(.hidden)')
    .forEach(card => markMatches(card, pattern));
}

function markMatches(node, pattern) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      const plain  = esc(child.textContent);
      const marked = plain.replace(pattern, '<mark>$1</mark>');
      if (marked === plain) continue;
      const holder = document.createElement('span');
      holder.innerHTML = marked;
      child.replaceWith(...holder.childNodes);
    } else if (child.nodeType === Node.ELEMENT_NODE && !['MARK', 'TABLE'].includes(child.tagName)) {
      markMatches(child, pattern);
    }
  }
}

tabs.addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (!tab) return;
  $$('.tab', tabs).forEach(other => other.classList.remove('active'));
  tab.classList.add('active');
  activeLesson = tab.dataset.lesson;
  applyFilters();
});

search.addEventListener('input', applyFilters);

// In-place flip: click a vocabulary or kanji card to hide/reveal its answer.
content.addEventListener('click', event => {
  event.target.closest('.vcard, .kcard')?.classList.toggle('flip');
});

/* ---------- interface for flashcards.js ----------
   flashcards.js is a separate classic script loaded after this one. Everything it
   may use is listed here explicitly, so the coupling between the two files is a
   single documented surface rather than a set of incidental globals.
   `lessons:loaded` fires on document once the lesson JSON has rendered. */
window.GENKI = {
  esc,
  $, $$,
  renderReadings,             // (kanji entry) => the ▶ on'yomi / ▷ kun'yomi lines
  readingKey: READING_KEY,    // the ▶ / ▷ legend
  lessons: () => LESSONS,
  activeLesson: () => activeLesson,
};

loadLessons();
