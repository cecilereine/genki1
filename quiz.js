/* =============================================================
   GENKI I — typed-answer vocabulary quiz

   Loaded after app.js, which exposes window.GENKI (see the interface
   block at the bottom of app.js). Nothing here writes to app.js state.

   Direction:
     'ja' → shows the Japanese word, you type the English meaning
     'en' → shows the English meaning, you type the Japanese word

   Answer checking is deliberately forgiving: a meaning is written as prose
   rather than as a list, and a Japanese word may be typed in kana or kanji.
   See englishAnswers() and japaneseAnswers() below.
   ============================================================= */

/* Wrapped in an IIFE: classic scripts share one global scope, so declaring
   `esc`, `$`, `shuffle`, `overlay`… at top level here would collide with the
   same names in app.js and throw a SyntaxError before any of this runs. */
(() => {
'use strict';

const { esc, $, $$, vocabInScope, activeLesson } = window.GENKI;

/* ---------- English answers ---------- */

/* Lowercase, drop trailing punctuation, collapse whitespace. */
const normalize = text =>
  String(text ?? '').toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();

/* Additionally drop parenthetical notes, the "..." that marks where a word
   attaches, and a leading article or infinitive "to", so "to eat (～を)" and
   "eat", or "...year student" and "year student", reduce to the same form.
   Applied to BOTH the expected answers and what the user types, so the two
   meet in the middle. */
const canonical = text =>
  normalize(text)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\.{2,}|…/g, ' ')
    .replace(/^[\s,;:]+|[\s,;:]+$/g, '')
    .replace(/^(to|a|an|the)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const bothForms = text => [normalize(text), canonical(text)].filter(Boolean);

/* A meaning like "to listen; to hear (～を)" or "Mr./Ms...." holds several
   acceptable answers; any single one counts as correct. Bracketed notes are
   dropped before splitting, so "(destination に／へ)" can't cut a piece in two. */
function englishAnswers(meaning) {
  const answers = new Set(bothForms(meaning));            // the whole string, as written
  const plain = meaning.replace(/\([^)]*\)/g, ' ');
  for (const piece of plain.split(/[,/;]| or /)) bothForms(piece).forEach(form => answers.add(form));
  return [...answers];
}

/* ---------- Japanese answers ---------- */

/* Fold away differences that aren't mistakes: full/half width, katakana vs
   hiragana, spaces, and the ～ that marks where a word attaches. */
const foldJapanese = text =>
  String(text ?? '').normalize('NFKC')
    .replace(/[~〜]/g, '')
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '');

/* A bracketed part is optional and may offer alternatives; outside brackets,
   ／ separates whole alternatives:
     すき（な）            → すき, すきな
     （～を）ください      → ください, をください
     （あめ／ゆきが）ふる  → ふる, あめがふる, ゆきがふる
     なん／なに            → なん, なに */
function expandSpelling(spelling) {
  const match = spelling.match(/[（(]([^）)]*)[）)]/);
  if (!match) return spelling.split(/[／/]/);

  const before = spelling.slice(0, match.index);
  const after = spelling.slice(match.index + match[0].length);
  const choices = match[1].split(/[／/]/);
  // "（あめ／ゆきが）" means あめが or ゆきが: a particle on the last choice belongs to them all.
  const particle = choices.at(-1).match(/[がをにはでへと]$/)?.[0];
  const options = choices.map(choice => (particle && !choice.endsWith(particle) ? choice + particle : choice));

  return ['', ...options].flatMap(option => expandSpelling(before + option + after));
}

/* Both the kana and the kanji spelling count, as does either one as written. */
function japaneseAnswers(card) {
  const spellings = [card.kana, card.kanji].filter(Boolean);
  const forms = spellings.flatMap(spelling => [spelling, ...expandSpelling(spelling)]);
  return [...new Set(forms.map(foldJapanese).filter(Boolean))];
}

/* How to check an answer, keyed by quiz direction. */
const ANSWER_CHECKS = {
  ja: { answers: card => englishAnswers(card.mean), forms: bothForms },               // answer in English
  en: { answers: japaneseAnswers,                   forms: typed => [foldJapanese(typed)] }, // answer in Japanese
};

/* ---------- state ---------- */
const overlay   = $('#quizOverlay');
const qMeta     = $('#qzMeta');
const qBar      = $('#qzBar');
const qPrompt   = $('#qzPrompt');
const qInput    = $('#qzInput');
const qCheckBtn = $('#qzCheck');
const qNextBtn  = $('#qzNext');
const qSkipBtn  = $('#qzSkip');
const qFeedback = $('#qzFeedback');
const qDirBtn   = $('#qzDir');

let questions = [];
let qIdx = 0;
let score = 0;
let answered = false;
let scope = 'all';
let direction = 'ja';
let results = [];          // one entry per answered question, for the end-of-quiz summary

function isCorrect(typed, card) {
  const { answers, forms } = ANSWER_CHECKS[direction];
  const expected = answers(card);
  return forms(typed).some(form => expected.includes(form));
}

const shuffle = items => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/* "だいがく ・ 大学": the kana, plus the kanji spelling when there is one. Returns HTML. */
const japaneseHtml = card => esc(card.kana) + (card.kanji ? ` ・ ${esc(card.kanji)}` : '');

/* ---------- rendering ---------- */

function startQuiz() {
  questions = shuffle(vocabInScope(scope));
  qIdx = 0;
  score = 0;
  results = [];
  overlay.classList.add('on');
  renderQuestion();
}

function setStage(stage) {          // 'asking' | 'answered' | 'done'
  qCheckBtn.classList.toggle('hidden', stage !== 'asking');
  qSkipBtn.classList.toggle('hidden', stage !== 'asking');
  qNextBtn.classList.toggle('hidden', stage !== 'answered');
  qInput.classList.toggle('hidden', stage === 'done');
  // readOnly rather than disabled: a disabled input fires no keydown, and Enter
  // needs to keep working here to move to the next question.
  qInput.readOnly = stage !== 'asking';
  qInput.classList.toggle('locked', stage !== 'asking');
}

function renderQuestion() {
  const total = questions.length;
  qBar.style.width = total ? `${(qIdx / total) * 100}%` : '0';

  if (qIdx >= total) {
    const perfect = total > 0 && score === total;
    qMeta.textContent = `Score ${score} / ${total}`;
    qPrompt.innerHTML =
      `<div class="qz-done">
         <h3>${perfect ? '🎉 Perfect!' : 'Quiz complete'}</h3>
         <p>You got ${score} of ${results.length} right.</p>
       </div>`;
    qFeedback.className = 'qz-feedback';
    qFeedback.innerHTML = renderSummary();
    setStage('done');
    return;
  }

  const card = questions[qIdx];
  qMeta.textContent = `${card.num} · ${qIdx + 1}/${total} · score ${score}`;

  qPrompt.innerHTML = direction === 'ja'
    ? `<div class="qz-side">Japanese</div>
       <div class="qz-word">${esc(card.kana)}</div>
       ${card.kanji ? `<div class="qz-kanji">${esc(card.kanji)}</div>` : ''}
       <div class="qz-ask">Type the meaning in English</div>`
    : `<div class="qz-side">English</div>
       <div class="qz-word">${esc(card.mean)}</div>
       <div class="qz-ask">Type the word in Japanese — kana or kanji</div>`;

  qFeedback.className = 'qz-feedback';
  qFeedback.textContent = '';
  qInput.value = '';
  qInput.placeholder = direction === 'ja' ? 'your answer in English…' : 'your answer in Japanese…';
  answered = false;
  setStage('asking');
  qInput.focus();
}

/* End-of-quiz review: every question in the order asked, marked right or wrong,
   with what was typed whenever it didn't count. */
function renderSummary() {
  if (!results.length) return '';

  const rows = results.map(({ card, typed, correct, skipped }) => {
    const mark = correct ? '✓' : skipped ? '–' : '✗';
    const note = correct
      ? ''
      : skipped
        ? '<span class="qz-row-note">skipped</span>'
        : `<span class="qz-row-note">you wrote “${esc(typed)}”</span>`;

    return `
      <li class="qz-row ${correct ? 'ok' : 'no'}">
        <span class="qz-row-mark">${mark}</span>
        <span class="qz-row-body">
          <span class="qz-row-kw">${japaneseHtml(card)}</span>
          <span class="qz-row-mean">${esc(card.mean)}</span>
          ${note}
        </span>
      </li>`;
  }).join('');

  const missed = results.filter(entry => !entry.correct).length;
  return `
    <div class="qz-summary">
      <div class="qz-summary-head">Review · ${score} right, ${missed} to work on</div>
      <ul class="qz-list">${rows}</ul>
    </div>`;
}

/* Both sides of the card, the side that was asked for first, so a wrong answer
   still teaches something. */
function revealAnswer(card) {
  const [expected, other] = direction === 'ja'
    ? [esc(card.mean), japaneseHtml(card)]
    : [japaneseHtml(card), esc(card.mean)];
  return `<div class="qz-expected">${expected}</div><div class="qz-other">${other}</div>`;
}

function checkAnswer() {
  if (answered) return;
  const typed = qInput.value.trim();
  if (!typed) return;

  const card = questions[qIdx];
  const correct = isCorrect(typed, card);
  if (correct) score++;
  results.push({ card, typed, correct, skipped: false });

  answered = true;
  qFeedback.className = `qz-feedback ${correct ? 'right' : 'wrong'}`;
  qFeedback.innerHTML = correct
    ? `<div class="qz-verdict">✓ Correct</div>${revealAnswer(card)}`
    : `<div class="qz-verdict">✗ Not quite — you wrote “${esc(typed)}”</div>${revealAnswer(card)}`;

  qMeta.textContent = `${card.num} · ${qIdx + 1}/${questions.length} · score ${score}`;
  setStage('answered');
  qInput.focus();          // stay in the input so Enter moves on without reaching for the mouse
}

function skipQuestion() {
  if (answered) return;
  const card = questions[qIdx];
  results.push({ card, typed: '', correct: false, skipped: true });

  answered = true;
  qFeedback.className = 'qz-feedback wrong';
  qFeedback.innerHTML = `<div class="qz-verdict">Skipped</div>${revealAnswer(card)}`;
  setStage('answered');
  qInput.focus();
}

function nextQuestion() {
  qIdx++;
  renderQuestion();
}

function setScope(nextScope) {
  scope = nextScope;
  $$('#qzScope button').forEach(button => button.classList.toggle('on', button.dataset.scope === scope));
  startQuiz();
}

/* ---------- wiring ---------- */
$('#qzStart').addEventListener('click', () => setScope(activeLesson()));
$('#qzScope').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) setScope(button.dataset.scope);
});

$('#qzClose').addEventListener('click', () => overlay.classList.remove('on'));
overlay.addEventListener('click', event => {
  if (event.target === overlay) overlay.classList.remove('on');
});

qCheckBtn.addEventListener('click', checkAnswer);
qNextBtn.addEventListener('click', nextQuestion);
qSkipBtn.addEventListener('click', skipQuestion);
$('#qzRestart').addEventListener('click', startQuiz);

qDirBtn.addEventListener('click', () => {
  direction = direction === 'ja' ? 'en' : 'ja';
  qDirBtn.textContent = direction === 'ja' ? '日 → EN' : 'EN → 日';
  startQuiz();
});

/* Keys pressed while a Japanese IME is converting belong to the IME: the Enter
   that confirms a conversion must not also check the answer, and Escape there
   cancels the conversion rather than closing the quiz. Safari reports those
   keys with keyCode 229 instead of isComposing. */
const isImeKey = event => event.isComposing || event.keyCode === 229;

/* Enter checks, then Enter again moves on. Handled in one place and stopped from
   bubbling — letting the same keypress reach the document handler too would check
   and advance at once, hiding the feedback. */
qInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || isImeKey(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (answered) nextQuestion(); else checkAnswer();
});

document.addEventListener('keydown', event => {
  if (!overlay.classList.contains('on') || isImeKey(event)) return;
  if (event.key === 'Escape') { overlay.classList.remove('on'); return; }
  // Fallback for when focus has left the input; the input handles its own Enter.
  if (event.key === 'Enter' && event.target !== qInput) {
    event.preventDefault();
    if (answered) nextQuestion(); else checkAnswer();
  }
});

})();
