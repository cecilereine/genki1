/* =============================================================
   GENKI I — conjugation drill

   Loaded after app.js, which exposes window.GENKI (see the interface
   block at the bottom of app.js). Nothing here writes to app.js state.

   Each question pairs a verb or adjective from the vocabulary lists with a
   form from the grammar lessons: 飲む → て-form → 飲んで. Picking a lesson
   drills the forms that lesson introduces, with every verb and adjective
   learned up to it; "All" mixes every form with every word.

   Word types come from the vocabulary headings (う-verbs, る-verbs, irregular
   verbs, い-/な-adjectives), so they match the way Genki groups them.
   ============================================================= */

/* Wrapped in an IIFE: classic scripts share one global scope, so declaring
   `esc`, `$`, `shuffle`, `overlay`… at top level here would collide with the
   same names in app.js and throw a SyntaxError before any of this runs. */
(() => {
'use strict';

const { esc, $, $$, lessons, activeLesson, foldJapanese, expandSpelling, isImeKey } = window.GENKI;

const ROUND_SIZE = 20;

/* ---------- conjugation ---------- */

/* う-verbs change their last kana: [ます-stem, ない-stem, て-form ending]. */
const GODAN = {
  う: ['い', 'わ', 'って'], く: ['き', 'か', 'いて'], ぐ: ['ぎ', 'が', 'いで'],
  す: ['し', 'さ', 'して'], つ: ['ち', 'た', 'って'], ぬ: ['に', 'な', 'んで'],
  ぶ: ['び', 'ば', 'んで'], む: ['み', 'ま', 'んで'], る: ['り', 'ら', 'って'],
};

/* 行く and its compounds (もっていく) take って, not いて. */
const isIku = word => /(いく|行く)$/.test(word);

/* The three pieces every verb form is built from: the ます-stem, the short
   negative and the て-form. Only the ending changes, so this works on a kana
   or a kanji spelling alike (来る keeps its kanji in every form). Returns null
   for anything that isn't a dictionary-form verb of its type. */
function verbParts(word, type) {
  if (type === 'irregular') {
    const base = word.slice(0, -2);
    if (word.endsWith('する')) return { stem: base + 'し', nai: base + 'しない', te: base + 'して' };
    if (word.endsWith('くる')) return { stem: base + 'き', nai: base + 'こない', te: base + 'きて' };
    if (word.endsWith('来る')) return { stem: base + '来', nai: base + '来ない', te: base + '来て' };
    return null;
  }

  const base = word.slice(0, -1);
  if (type === 'ru') return word.endsWith('る') ? { stem: base, nai: base + 'ない', te: base + 'て' } : null;

  const endings = GODAN[word.slice(-1)];
  if (!endings) return null;
  const [stem, nai, te] = endings;
  return {
    stem: base + stem,
    nai: word === 'ある' ? 'ない' : base + nai + 'ない',
    te: isIku(word) ? base + 'って' : base + te,
  };
}

/* いい conjugates as よい (よくない, よかった), and so do its compounds
   あたまがいい and かっこいい. かわいい is an ordinary い-adjective. */
const isIi = word => /(^|が|っこ)いい$/.test(word);

/* Every accepted answer for each adjective form. Genki teaches the くないです /
   じゃないです negatives; the ありません and では versions count too. */
function adjectiveParts(word, type) {
  if (type === 'i') {
    if (!word.endsWith('い')) return null;
    const base = isIi(word) ? word.slice(0, -2) + 'よ' : word.slice(0, -1);
    return {
      neg:      [base + 'くないです', base + 'くありません'],
      past:     [base + 'かったです'],
      pastneg:  [base + 'くなかったです', base + 'くありませんでした'],
      te:       [base + 'くて'],
      shortneg: [base + 'くない'],
    };
  }

  const withEndings = (...endings) => endings.map(ending => word + ending);
  return {
    neg:      withEndings('じゃないです', 'じゃありません', 'ではないです', 'ではありません'),
    past:     withEndings('でした'),
    pastneg:  withEndings('じゃなかったです', 'じゃありませんでした', 'ではなかったです', 'ではありませんでした'),
    te:       withEndings('で'),
    shortneg: withEndings('じゃない', 'ではない'),
    shortaff: withEndings('だ'),
  };
}

/* Each form: the lesson that introduces it, what it applies to, and how to build
   its accepted answers from a word's parts (the first answer is the one shown). */
const FORMS = [
  { id: 'masu',         lesson: 3, of: 'verb', label: 'ます form',         hint: 'present, polite',         build: v => [v.stem + 'ます'] },
  { id: 'masen',        lesson: 3, of: 'verb', label: 'ません form',       hint: 'negative, polite',        build: v => [v.stem + 'ません'] },
  { id: 'mashita',      lesson: 4, of: 'verb', label: 'ました form',       hint: 'past, polite',            build: v => [v.stem + 'ました'] },
  { id: 'masendeshita', lesson: 4, of: 'verb', label: 'ませんでした form', hint: 'past negative, polite',   build: v => [v.stem + 'ませんでした'] },
  { id: 'mashou',       lesson: 5, of: 'verb', label: 'ましょう form',     hint: "let's …",                 build: v => [v.stem + 'ましょう'] },
  { id: 'te',           lesson: 6, of: 'verb', label: 'て-form',           hint: '',                        build: v => [v.te] },
  { id: 'teimasu',      lesson: 7, of: 'verb', label: 'ています form',     hint: 'ongoing action or state', build: v => [v.te + 'います'] },
  { id: 'nai',          lesson: 8, of: 'verb', label: 'ない form',         hint: 'short negative',          build: v => [v.nai] },

  { id: 'neg',      lesson: 5, of: 'adjective', label: 'negative',          hint: 'polite', build: a => a.neg },
  { id: 'past',     lesson: 5, of: 'adjective', label: 'past',              hint: 'polite', build: a => a.past },
  { id: 'pastneg',  lesson: 5, of: 'adjective', label: 'past negative',     hint: 'polite', build: a => a.pastneg },
  { id: 'adjte',    lesson: 7, of: 'adjective', label: 'て-form',           hint: '',       build: a => a.te },
  { id: 'shortneg', lesson: 8, of: 'adjective', label: 'short negative',    hint: '',       build: a => a.shortneg },
  { id: 'shortaff', lesson: 8, of: 'adjective', label: 'short affirmative', hint: '',       build: a => a.shortaff },  // な-adjectives only
];

/* ---------- words ---------- */

/* Vocabulary headings → word type. Lesson 3's plain "形容詞 · Adjectives"
   heading holds い-adjectives (いい, はやい). */
const TYPES = [
  { pattern: /う-verb/,              type: 'u',         of: 'verb' },
  { pattern: /る-verb/,              type: 'ru',        of: 'verb' },
  { pattern: /Irregular Verb/,       type: 'irregular', of: 'verb' },
  { pattern: /い-adjective|^形容詞/, type: 'i',         of: 'adjective' },
  { pattern: /な-adjective/,         type: 'na',        of: 'adjective' },
];

/* Every verb and adjective up to and including a lesson. Entries that are
   already conjugated (しっています, しりません, やせています) are left out. */
function wordsUpTo(lastLesson) {
  return lessons()
    .filter(lesson => Number(lesson.lesson) <= lastLesson)
    .flatMap(lesson => lesson.vocab.flatMap(group => {
      const kind = TYPES.find(({ pattern }) => pattern.test(group.theme));
      if (!kind) return [];
      return group.items
        .filter(item => !/(ています|ません)$/.test(item.kana))
        .map(item => ({ ...item, type: kind.type, of: kind.of, num: lesson.num }));
    }));
}

/* The spellings a word may be answered in, one list per written form (kana,
   then kanji): optional parts expanded, so （めがねを）かける gives かける and
   めがねをかける, and a verb phrase with an object also counts as its bare verb
   (たばこをすう → すう). */
function spellingsOf(word) {
  return [word.kana, word.kanji].filter(Boolean).map(written => {
    const spelling = word.type === 'na' ? written.replace(/[（(]な[）)]$/, '') : written;
    const variants = expandSpelling(spelling);
    const bareVerbs = word.of === 'verb'
      ? variants.map(variant => variant.match(/^.+[をに](.+)$/)?.[1]).filter(Boolean)
      : [];
    return [...variants, ...bareVerbs];
  });
}

/* One question, or null when the form doesn't apply to the word. */
function makeQuestion(word, form) {
  if (form.of !== word.of) return null;

  const perSpelling = spellingsOf(word).map(variants => variants.flatMap(variant => {
    const parts = word.of === 'verb' ? verbParts(variant, word.type) : adjectiveParts(variant, word.type);
    return (parts && form.build(parts)) || [];
  }));
  if (!perSpelling[0]?.length) return null;

  return {
    word,
    form,
    shown: perSpelling.filter(answers => answers.length).map(answers => answers[0]).join(' ・ '),
    accepted: new Set(perSpelling.flat().map(foldJapanese)),
  };
}

/* A lesson drills the forms it introduces, with every word learned by then;
   "All" drills every form with every word. */
function questionsFor(scope) {
  const lastLesson = scope === 'all' ? Infinity : Number(scope);
  const forms = FORMS.filter(form => scope === 'all' || form.lesson === lastLesson);
  return wordsUpTo(lastLesson).flatMap(word => forms.map(form => makeQuestion(word, form)).filter(Boolean));
}

function describeScope(scope) {
  if (scope === 'all') return 'Every form from lessons 3–8, with every verb and adjective.';
  const forms = FORMS.filter(form => form.lesson === Number(scope));
  const names = forms.map(form => (form.of === 'adjective' ? `adjective ${form.label}` : form.label));
  const kinds = new Set(forms.map(form => form.of));
  const words = kinds.size > 1 ? 'verbs and adjectives' : kinds.has('verb') ? 'verbs' : 'adjectives';
  const range = scope === '3' ? 'lesson 3' : `lessons 3–${scope}`;
  return `Lesson ${scope}: ${names.join(', ')} — using ${words} from ${range}.`;
}

/* One line on why the answer looks the way it does. */
function ruleNote({ word, form }) {
  const plain = expandSpelling(word.kana)[0];             // the word without its optional parts
  if (word.type === 'u') {
    const last = plain.slice(-1);
    const [stem, nai, te] = GODAN[last];
    if (form.id === 'te' || form.id === 'teimasu') {
      return isIku(plain) ? 'う-verb, but 行く is special: いく → いって' : `う-verb: ${last} → ${te}`;
    }
    if (form.id === 'nai') return plain === 'ある' ? 'う-verb, but ある is special: ない' : `う-verb: ${last} → ${nai}ない`;
    return `う-verb: ${last} → ${stem}`;
  }
  if (word.type === 'ru') return 'る-verb: drop る';
  if (word.type === 'irregular') {
    return plain.endsWith('する') ? 'irregular verb: する → し／しない／して' : 'irregular verb: くる → き／こない／きて';
  }
  if (word.type === 'i') return isIi(plain) ? 'いい is special: it conjugates as よい' : 'い-adjective: the final い changes';
  return 'な-adjective: conjugates like a noun + です';
}

/* ---------- state ---------- */
const overlay   = $('#drillOverlay');
const dMeta     = $('#drMeta');
const dNote     = $('#drScopeNote');
const dBar      = $('#drBar');
const dPrompt   = $('#drPrompt');
const dInput    = $('#drInput');
const dCheckBtn = $('#drCheck');
const dNextBtn  = $('#drNext');
const dSkipBtn  = $('#drSkip');
const dFeedback = $('#drFeedback');

let questions = [];
let qIdx = 0;
let score = 0;
let answered = false;
let scope = 'all';
let results = [];          // one entry per answered question, for the end-of-round summary

const shuffle = items => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/* ---------- rendering ---------- */

function startRound() {
  questions = shuffle(questionsFor(scope)).slice(0, ROUND_SIZE);
  qIdx = 0;
  score = 0;
  results = [];
  overlay.classList.add('on');
  renderQuestion();
}

function setStage(stage) {          // 'asking' | 'answered' | 'done'
  dCheckBtn.classList.toggle('hidden', stage !== 'asking');
  dSkipBtn.classList.toggle('hidden', stage !== 'asking');
  dNextBtn.classList.toggle('hidden', stage !== 'answered');
  dInput.classList.toggle('hidden', stage === 'done');
  // readOnly rather than disabled: a disabled input fires no keydown, and Enter
  // needs to keep working here to move to the next question.
  dInput.readOnly = stage !== 'asking';
  dInput.classList.toggle('locked', stage !== 'asking');
}

const metaText = () => `${questions[qIdx].word.num} · ${qIdx + 1}/${questions.length} · score ${score}`;

function renderQuestion() {
  const total = questions.length;
  dBar.style.width = total ? `${(qIdx / total) * 100}%` : '0';

  if (qIdx >= total) {
    const perfect = total > 0 && score === total;
    dMeta.textContent = `Score ${score} / ${total}`;
    dPrompt.innerHTML =
      `<div class="qz-done">
         <h3>${perfect ? '🎉 Perfect!' : 'Round complete'}</h3>
         <p>You got ${score} of ${results.length} right. A new round picks a fresh set.</p>
       </div>`;
    dFeedback.className = 'qz-feedback';
    dFeedback.innerHTML = renderSummary();
    setStage('done');
    return;
  }

  const { word, form } = questions[qIdx];
  dMeta.textContent = metaText();
  dPrompt.innerHTML =
    `<div class="dr-form">${esc(form.label)}${form.hint ? `<span class="dr-hint"> · ${esc(form.hint)}</span>` : ''}</div>
     <div class="qz-word">${esc(word.kana)}</div>
     ${word.kanji ? `<div class="qz-kanji">${esc(word.kanji)}</div>` : ''}
     <div class="dr-mean">${esc(word.mean)}</div>`;

  dFeedback.className = 'qz-feedback';
  dFeedback.textContent = '';
  dInput.value = '';
  dInput.placeholder = 'type it in kana or kanji…';
  answered = false;
  setStage('asking');
  dInput.focus();
}

/* End-of-round review: every question in the order asked, marked right or wrong,
   with what was typed whenever it didn't count. */
function renderSummary() {
  if (!results.length) return '';

  const rows = results.map(({ question, typed, correct, skipped }) => {
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
          <span class="qz-row-kw">${esc(question.word.kana)} → ${esc(question.shown)}</span>
          <span class="qz-row-mean">${esc(question.form.label)}</span>
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

/* The expected answer (kana, and kanji when the word has it) plus the rule that
   produces it, so a wrong answer still teaches something. */
const revealAnswer = question =>
  `<div class="qz-expected">${esc(question.shown)}</div><div class="qz-other">${esc(ruleNote(question))}</div>`;

function checkAnswer() {
  if (answered) return;
  const typed = dInput.value.trim();
  if (!typed) return;

  const question = questions[qIdx];
  const correct = question.accepted.has(foldJapanese(typed));
  if (correct) score++;
  results.push({ question, typed, correct, skipped: false });

  answered = true;
  dFeedback.className = `qz-feedback ${correct ? 'right' : 'wrong'}`;
  dFeedback.innerHTML = correct
    ? `<div class="qz-verdict">✓ Correct</div>${revealAnswer(question)}`
    : `<div class="qz-verdict">✗ Not quite — you wrote “${esc(typed)}”</div>${revealAnswer(question)}`;

  dMeta.textContent = metaText();
  setStage('answered');
  dInput.focus();          // stay in the input so Enter moves on without reaching for the mouse
}

function skipQuestion() {
  if (answered) return;
  const question = questions[qIdx];
  results.push({ question, typed: '', correct: false, skipped: true });

  answered = true;
  dFeedback.className = 'qz-feedback wrong';
  dFeedback.innerHTML = `<div class="qz-verdict">Skipped</div>${revealAnswer(question)}`;
  setStage('answered');
  dInput.focus();
}

function nextQuestion() {
  qIdx++;
  renderQuestion();
}

function setScope(nextScope) {
  scope = nextScope;
  $$('#drScope button').forEach(button => button.classList.toggle('on', button.dataset.scope === scope));
  dNote.textContent = describeScope(scope);
  startRound();
}

/* ---------- wiring ---------- */

/* Lessons 1–2 have no conjugation yet, so opening from there drills everything. */
$('#drStart').addEventListener('click', () => {
  const lesson = activeLesson();
  setScope(Number(lesson) >= 3 ? lesson : 'all');
});
$('#drScope').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) setScope(button.dataset.scope);
});

$('#drClose').addEventListener('click', () => overlay.classList.remove('on'));
overlay.addEventListener('click', event => {
  if (event.target === overlay) overlay.classList.remove('on');
});

dCheckBtn.addEventListener('click', checkAnswer);
dNextBtn.addEventListener('click', nextQuestion);
dSkipBtn.addEventListener('click', skipQuestion);
$('#drRestart').addEventListener('click', startRound);

/* Enter checks, then Enter again moves on. Handled in one place and stopped from
   bubbling — letting the same keypress reach the document handler too would check
   and advance at once, hiding the feedback. */
dInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || isImeKey(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (answered) nextQuestion(); else checkAnswer();
});

document.addEventListener('keydown', event => {
  if (!overlay.classList.contains('on') || isImeKey(event)) return;
  if (event.key === 'Escape') { overlay.classList.remove('on'); return; }
  // Fallback for when focus has left the input; the input handles its own Enter.
  if (event.key === 'Enter' && event.target !== dInput) {
    event.preventDefault();
    if (answered) nextQuestion(); else checkAnswer();
  }
});

})();
