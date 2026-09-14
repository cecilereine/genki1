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
      neg:       [base + 'くないです', base + 'くありません'],
      past:      [base + 'かったです'],
      pastneg:   [base + 'くなかったです', base + 'くありませんでした'],
      te:        [base + 'くて'],
      shortneg:  [base + 'くない'],
      shortpast: [base + 'かった'],
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

  { id: 'neg',      lesson: 5, of: 'adjective', label: 'negative',          hint: 'polite', build: a => a.neg },
  { id: 'past',     lesson: 5, of: 'adjective', label: 'past',              hint: 'polite', build: a => a.past },
  { id: 'pastneg',  lesson: 5, of: 'adjective', label: 'past negative',     hint: 'polite', build: a => a.pastneg },
  { id: 'adjte',    lesson: 7, of: 'adjective', label: 'て-form',           hint: '',       build: a => a.te },
  { id: 'shortneg', lesson: 8, of: 'adjective', label: 'short negative',    hint: '',       build: a => a.shortneg },
  { id: 'shortaff', lesson: 8, of: 'adjective', label: 'short affirmative', hint: '',       build: a => a.shortaff },  // な-adjectives only
];

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

return { TYPES, FORMS, GODAN, kindOf, isConjugable, isIku, isIi, looksLikeRuVerb, verbParts, adjectiveParts, partsOf, allForms, cardForms };
})();
