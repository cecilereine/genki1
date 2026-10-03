/* =============================================================
   GENKI I — verb and adjective conjugation

   Plain rules with no DOM access, loaded before app.js. app.js uses them
   for the conjugation line on vocabulary cards (and to find a word from one
   of its forms); drill.js builds its questions from them.

   Word types come from the vocabulary headings (う-verbs, る-verbs, irregular
   verbs, い-/な-adjectives), so they match the way Genki groups them.
   ============================================================= */

window.CONJUGATION = (() => {
'use strict';

/* Vocabulary headings → word type. Lesson 3's plain "形容詞 · Adjectives"
   heading holds い-adjectives (いい, はやい). */
const TYPES = [
  { pattern: /う-verb/,              type: 'u',         of: 'verb',      name: 'う-verb' },
  { pattern: /る-verb/,              type: 'ru',        of: 'verb',      name: 'る-verb' },
  { pattern: /Irregular Verb/,       type: 'irregular', of: 'verb',      name: 'irregular verb' },
  { pattern: /い-adjective|^形容詞/, type: 'i',         of: 'adjective', name: 'い-adjective' },
  { pattern: /な-adjective/,         type: 'na',        of: 'adjective', name: 'な-adjective' },
];

const kindOf = theme => TYPES.find(({ pattern }) => pattern.test(theme));

/* Some entries under a verb heading are already conjugated (しっています,
   しりません, やせています) and are left alone. */
const isConjugable = item => !/(ています|ません)$/.test(item.kana);

/* う-verbs change their last kana: [ます-stem, ない-stem, て-form ending]. */
const GODAN = {
  う: ['い', 'わ', 'って'], く: ['き', 'か', 'いて'], ぐ: ['ぎ', 'が', 'いで'],
  す: ['し', 'さ', 'して'], つ: ['ち', 'た', 'って'], ぬ: ['に', 'な', 'んで'],
  ぶ: ['び', 'ば', 'んで'], む: ['み', 'ま', 'んで'], る: ['り', 'ら', 'って'],
};

/* 行く and its compounds (もっていく) take って, not いて. */
const isIku = word => /(いく|行く)$/.test(word);

/* う-verbs that end in -iru or -eru (帰る, 切る, 知る, 入る, 走る) look like
   る-verbs but conjugate as う-verbs: 帰って, not 帰て. */
const looksLikeRuVerb = word => /[いきしちにひみりぎじびぴえけせてねへめれげぜでべぺ]る$/.test(word);

/* The pieces every verb form is built from: the ます-stem, the short negative,
   the て-form, and the short past forms built from those two (て→た, で→だ,
   ない→なかった). Only the ending changes, so this works on a kana
   or a kanji spelling alike (来る keeps its kanji in every form). Returns null
   for anything that isn't a dictionary-form verb of its type. */
function verbParts(word, type) {
  if (type === 'irregular') {
    const base = word.slice(0, -2);
    if (word.endsWith('する')) return pastForms({ stem: base + 'し', nai: base + 'しない', te: base + 'して' });
    if (word.endsWith('くる')) return pastForms({ stem: base + 'き', nai: base + 'こない', te: base + 'きて' });
    if (word.endsWith('来る')) return pastForms({ stem: base + '来', nai: base + '来ない', te: base + '来て' });
    return null;
  }

  const base = word.slice(0, -1);
  if (type === 'ru') return word.endsWith('る') ? pastForms({ stem: base, nai: base + 'ない', te: base + 'て' }) : null;

  const endings = GODAN[word.slice(-1)];
  if (!endings) return null;
  const [stem, nai, te] = endings;
  return pastForms({
    stem: base + stem,
    // ある has no あら- form, and neither does a phrase ending in it (人気がある → 人気がない)
    nai: word.endsWith('ある') ? word.slice(0, -2) + 'ない' : base + nai + 'ない',
    te: isIku(word) ? base + 'って' : base + te,
  });
}

/* The short past forms follow from the て-form and the ない-form: 飲んで→飲んだ,
   飲まない→飲まなかった. */
const pastForms = parts => ({
  ...parts,
  ta: parts.te.replace(/て$/, 'た').replace(/で$/, 'だ'),
  nakatta: parts.nai.replace(/ない$/, 'なかった'),
});

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
      neg:       [base + 'くないです', base + 'くありません'],
      past:      [base + 'かったです'],
      pastneg:   [base + 'くなかったです', base + 'くありませんでした'],
      te:           [base + 'くて'],
      shortneg:     [base + 'くない'],
      shortpast:    [base + 'かった'],
      shortpastneg: [base + 'くなかった'],
    };
  }

  const withEndings = (...endings) => endings.map(ending => word + ending);
  return {
    neg:      withEndings('じゃないです', 'じゃありません', 'ではないです', 'ではありません'),
    past:     withEndings('でした'),
    pastneg:  withEndings('じゃなかったです', 'じゃありませんでした', 'ではなかったです', 'ではありませんでした'),
    te:       withEndings('で'),
    shortneg:     withEndings('じゃない', 'ではない'),
    shortaff:     withEndings('だ'),
    shortpast:    withEndings('だった'),
    shortpastneg: withEndings('じゃなかった', 'ではなかった'),
  };
}

/* `kind` is anything with the .type and .of of an entry in TYPES. */
const partsOf = (word, kind) => (kind.of === 'verb' ? verbParts(word, kind.type) : adjectiveParts(word, kind.type));

/* Each form Genki I teaches: the lesson that introduces it, what it applies to,
   and how to build its accepted answers from a word's parts (the first answer
   is the one shown). */
const FORMS = [
  { id: 'masu',         lesson: 3, of: 'verb', label: 'ます form',         hint: 'present, polite',         build: v => [v.stem + 'ます'] },
  { id: 'masen',        lesson: 3, of: 'verb', label: 'ません form',       hint: 'negative, polite',        build: v => [v.stem + 'ません'] },
  { id: 'mashita',      lesson: 4, of: 'verb', label: 'ました form',       hint: 'past, polite',            build: v => [v.stem + 'ました'] },
  { id: 'masendeshita', lesson: 4, of: 'verb', label: 'ませんでした form', hint: 'past negative, polite',   build: v => [v.stem + 'ませんでした'] },
  { id: 'mashou',       lesson: 5, of: 'verb', label: 'ましょう form',     hint: "let's …",                 build: v => [v.stem + 'ましょう'] },
  { id: 'te',           lesson: 6, of: 'verb', label: 'て-form',           hint: '',                        build: v => [v.te] },
  { id: 'teimasu',      lesson: 7, of: 'verb', label: 'ています form',     hint: 'ongoing action or state', build: v => [v.te + 'います'] },
  { id: 'nai',          lesson: 8, of: 'verb', label: 'ない form',         hint: 'short negative',          build: v => [v.nai] },
  { id: 'ta',           lesson: 9, of: 'verb', label: 'た form',           hint: 'short past',              build: v => [v.ta] },
  { id: 'nakatta',      lesson: 9, of: 'verb', label: 'なかった form',      hint: 'short past negative',     build: v => [v.nakatta] },

  { id: 'neg',      lesson: 5, of: 'adjective', label: 'negative',          hint: 'polite', build: a => a.neg },
  { id: 'past',     lesson: 5, of: 'adjective', label: 'past',              hint: 'polite', build: a => a.past },
  { id: 'pastneg',  lesson: 5, of: 'adjective', label: 'past negative',     hint: 'polite', build: a => a.pastneg },
  { id: 'adjte',    lesson: 7, of: 'adjective', label: 'て-form',           hint: '',       build: a => a.te },
  { id: 'shortneg', lesson: 8, of: 'adjective', label: 'short negative',    hint: '',       build: a => a.shortneg },
  { id: 'shortaff', lesson: 8, of: 'adjective', label: 'short affirmative', hint: '',       build: a => a.shortaff },  // な-adjectives only
  { id: 'shortpast',    lesson: 9, of: 'adjective', label: 'short past',          hint: '', build: a => a.shortpast },
  { id: 'shortpastneg', lesson: 9, of: 'adjective', label: 'short past negative', hint: '', build: a => a.shortpastneg },
];

/* The rules behind a form, as a small table the drill can show while you answer.
   Built from the same rules used to conjugate, so it can't drift out of sync;
   examples are in kana so they read at a glance. */
function ruleTable(formId) {
  const changes = index => Object.entries(GODAN).map(([kana, parts]) => `${kana}→${parts[index]}`).join('、');
  const verb = (word, type, pick) => `${word}→${pick(verbParts(word, type))}`;
  const head = ['Type', 'Rule', 'Example'];

  if (['masu', 'masen', 'mashita', 'masendeshita', 'mashou'].includes(formId)) {
    return { title: 'ます-stem — then add ます／ません／ました／ませんでした／ましょう', head, rows: [
      ['う-verb', `last kana → い-row: ${changes(0)}`, verb('のむ', 'u', v => v.stem + 'ます')],
      ['る-verb', 'drop る', verb('たべる', 'ru', v => v.stem + 'ます')],
      ['irregular', 'する→します、くる→きます', ''],
    ] };
  }

  if (['te', 'teimasu', 'ta'].includes(formId)) {
    const past = formId === 'ta';                       // the た form is the て form with て→た, で→だ
    const pick = past ? (v => v.ta) : (v => v.te);
    const ending = kana => (past ? pick : (v => v.te))(verbParts(kana === 'う' ? 'かう' : kana === 'む' ? 'のむ' : kana === 'く' ? 'かく' : kana === 'ぐ' ? 'およぐ' : 'はなす', 'u')).slice(-2);
    const titles = { te: 'て-form', teimasu: 'て-form + います', ta: 'た form — the short past' };
    return { title: titles[formId], head, rows: [
      ['う・つ・る', `→${ending('う')}`, verb('かう', 'u', pick)],
      ['む・ぶ・ぬ', `→${ending('む')}`, verb('のむ', 'u', pick)],
      ['く', `→${ending('く')}`, verb('かく', 'u', pick)],
      ['ぐ', `→${ending('ぐ')}`, verb('およぐ', 'u', pick)],
      ['す', `→${ending('す')}`, verb('はなす', 'u', pick)],
      ['る-verb', `drop る, add ${past ? 'た' : 'て'}`, verb('たべる', 'ru', pick)],
      ['irregular', past ? 'する→した、くる→きた' : 'する→して、くる→きて', ''],
      ['exceptions', `いく→${past ? 'いった' : 'いって'}; -iru/-eru う-verbs look like る-verbs`, verb('かえる', 'u', pick)],
    ] };
  }

  if (formId === 'nai' || formId === 'nakatta') {
    const past = formId === 'nakatta';                  // ない → なかった
    const pick = past ? (v => v.nakatta) : (v => v.nai);
    const tail = past ? 'なかった' : 'ない';
    return { title: past ? 'なかった form — the short past negative' : 'ない form — the short negative', head, rows: [
      ['う-verb', `last kana → あ-row + ${tail}: ${changes(1)}`, verb('のむ', 'u', pick)],
      ['る-verb', `drop る, add ${tail}`, verb('たべる', 'ru', pick)],
      ['irregular', past ? 'する→しなかった、くる→こなかった' : 'する→しない、くる→こない', ''],
      ['ある', past ? 'ある→なかった' : 'ある→ない', ''],
    ] };
  }

  const i = adjectiveParts('たかい', 'i');
  const na = adjectiveParts('しずか', 'na');
  return { title: 'Adjective forms', head: ['Form', 'い-adjective (たかい)', 'な-adjective (しずか)'], rows: [
    ['negative',          i.neg[0],       na.neg[0]],
    ['past',              i.past[0],      na.past[0]],
    ['past negative',     i.pastneg[0],   na.pastneg[0]],
    ['て-form',           i.te[0],        na.te[0]],
    ['short negative',    i.shortneg[0],  na.shortneg[0]],
    ['short affirmative', 'たかい',        na.shortaff[0]],
    ['short past',        i.shortpast[0], na.shortpast[0]],
    ['short past neg.',   i.shortpastneg[0], na.shortpastneg[0]],
    ['いい is special',   'よくない、よかった、よくて', '—'],
  ] };
}

/* Every form of a word, in one spelling. */
function allForms(word, kind) {
  const parts = partsOf(word, kind);
  if (!parts) return [];
  return FORMS.filter(form => form.of === kind.of).flatMap(form => form.build(parts) || []);
}

/* The three forms a vocabulary card shows, the ones the rest are built from.
   Verbs: ます, て, ない. Adjectives: negative, past, て. */
function cardForms(word, kind) {
  const parts = partsOf(word, kind);
  if (!parts) return null;
  if (kind.of === 'verb') {
    return [
      { form: 'ます form', text: parts.stem + 'ます' },
      { form: 'て-form',   text: parts.te },
      { form: 'ない form', text: parts.nai },
    ];
  }
  return [
    { form: 'negative', text: parts.shortneg[0] },
    { form: kind.type === 'i' ? 'past' : 'past (polite)', text: (parts.shortpast || parts.past)[0] },
    { form: 'て-form',  text: parts.te[0] },
  ];
}

return { TYPES, FORMS, GODAN, kindOf, isConjugable, isIku, isIi, looksLikeRuVerb, verbParts, adjectiveParts, partsOf, allForms, cardForms, ruleTable };
})();
