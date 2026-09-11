# GENKI I · Grammar & Vocabulary Lookup

A searchable lookup for the vocabulary, kanji and grammar of *Genki: An
Integrated Course in Elementary Japanese* (3rd edition), lessons 1–8, with
flashcard review. Static site — no build step, no dependencies.

## Layout

| File | What it holds |
| --- | --- |
| `index.html` | Markup only: header, search controls, lesson tabs, flashcard overlay |
| `styles.css` | All styling |
| `app.js` | Loads the lesson JSON, renders the lists, handles search and lesson filtering |
| `flashcards.js` | The flashcard overlay (vocabulary and kanji decks, learned-card tracking) |
| `lessons/manifest.json` | The list of lesson files to load, in display order |
| `lessons/lessonN.json` | One lesson's vocabulary, kanji and grammar |

`flashcards.js` talks to `app.js` only through the `window.GENKI` object
documented at the bottom of `app.js`.

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
- To add lesson 9, drop in `lessons/lesson9.json`, add it to
  `lessons/manifest.json`, and add the matching `<button>` to both `#tabs` and
  `#fcScope` in `index.html`.

## Cache busting

`index.html` loads its assets as `styles.css?v=N`, `app.js?v=N`,
`flashcards.js?v=N`, and `app.js` reuses its own `?v=` on the lesson fetches.
After changing any of them, bump **every** `?v=` in `index.html` to the same new
number, otherwise a browser can pair new HTML with a stale script or stale
lesson data.

## Source

Genki: An Integrated Course in Elementary Japanese, 3rd Edition (The Japan Times).
This repository holds study notes derived from it, not the book's text.
