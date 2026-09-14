# GENKI I · Grammar & Vocabulary Lookup

A searchable lookup for the vocabulary, kanji and grammar of *Genki: An
Integrated Course in Elementary Japanese* (3rd edition), lessons 1–8, with
flashcard review. Static site — no build step, no dependencies.

## Layout

| File | What it holds |
| --- | --- |
| `index.html` | Markup only: header, search controls, lesson tabs, flashcard overlay |
| `styles.css` | All styling |
| `conjugation.js` | Verb and adjective conjugation rules (no DOM), used by the vocabulary cards and the drill |
| `app.js` | Loads the lesson JSON, renders the lists, handles search and lesson filtering |
| `flashcards.js` | The flashcard overlay (vocabulary and kanji decks, learned-card tracking) |
| `quiz.js` | The typed-answer vocabulary quiz (answer in English, or in Japanese with kana or kanji) |
| `drill.js` | The conjugation drill: verb and adjective forms from lessons 3–8, built from the vocabulary lists |
| `lessons/manifest.json` | The list of lesson files to load, in display order |
| `lessons/lessonN.json` | One lesson's vocabulary, kanji and grammar |

`flashcards.js`, `quiz.js` and `drill.js` talk to `app.js` only through the
`window.GENKI` object documented at the bottom of `app.js`. `conjugation.js`
loads first and exposes `window.CONJUGATION`, which `app.js` and `drill.js`
both use.

## Running it locally

The lesson data is fetched at runtime, so `file://` won't work — opening
`index.html` by double-clicking shows a "couldn't load the lesson files" message.
Serve the folder instead:

```bash
python3 -m http.server 8778
```

Then open <http://localhost:8778>.

## Editing lesson data

Each `lessons/lessonN.json` is one lesson:

```jsonc
{
  "lesson": "1",              // tab id, matched against the data-lesson buttons
  "num": "L1",                // label shown in the lesson header
  "title": "あたらしいともだち", // Japanese title
  "en": "New Friends",        // English title
  "vocab":   [{ "theme": "学校 · School", "items": [{ "kana": "…", "kanji": "…", "mean": "…" }] }],
  "kanji":   [{ "char": "一", "on": ["いち", "いっ"], "kun": ["ひと"], "meaning": "one", "examples": "一(いち) one・一時(いちじ) one o'clock" }],
  "grammar": [{ "form": "…", "tag": "…", "def": ["paragraph", "…"], "ex": ["sentence", "…"],
                "table": { "head": ["…"], "rows": [["…"]] } }]
}
```

Notes:

- `kanji` may be empty (lessons 1–2 introduce none) and `table` is optional on a
  grammar point.
- `kanji` on a vocabulary item may be `""` — the card then shows kana only.
- `on` and `kun` on a kanji entry are the on'yomi and kun'yomi exactly as the
  Genki kanji charts list them (the book's ▶ and ▷), in hiragana like the book.
  Either may be `[]` — 気 has no kun'yomi here, 川 no on'yomi.
- `examples` on a kanji entry is a single `・`-separated string; the flashcard
  back shows the first four.
- Grammar text carries furigana as `漢字[よみ]`: the reading belongs to the run
  of kanji right before the bracket, as in `私[わたし]はテレビを見[み]ます。`.
  Example sentences show it above the kanji; titles, explanations and tables,
  which are smaller, show it inline as 私(わたし). Search matches the text with
  or without its readings.
- The conjugation line on vocabulary cards and the conjugation drill both find
  verbs and adjectives by their vocabulary headings
  (`う-verbs`, `る-verbs`, `Irregular Verbs`, `い-adjectives`, `な-adjectives`),
  so keep those words in the right group.
- A table cell may be `null` to continue the cell above it, so one label spans
  several rows (Lesson 6's look-alike る-verbs use this).
- `extraDrillWords` (optional, per lesson) lists verbs the conjugation drill
  should include beyond the vocabulary, as `{ kana, kanji, mean, type }` with
  `type` one of `u`, `ru`, `irregular`, `i`, `na`. Lesson 6 uses it for 帰る,
  切る, 知る, 入る and 走る, so they're drilled with the て-form.
- To add lesson 9, drop in `lessons/lesson9.json`, add it to
  `lessons/manifest.json`, and add the matching `<button>` to `#tabs`,
  `#fcScope`, `#qzScope` and `#drScope` in `index.html`.

## Cache busting

`index.html` loads its assets as `styles.css?v=N`, `conjugation.js?v=N`,
`app.js?v=N`, `flashcards.js?v=N`, `quiz.js?v=N` and `drill.js?v=N`, and
`app.js` reuses its own `?v=` on the lesson fetches.
After changing any of them, bump **every** `?v=` in `index.html` to the same new
number, otherwise a browser can pair new HTML with a stale script or stale
lesson data.

## Source

Genki: An Integrated Course in Elementary Japanese, 3rd Edition (The Japan Times).
This repository holds study notes derived from it, not the book's text.
