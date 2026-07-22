// Phase 0 spike: empirically confirm the ftml wasm (nodejs target) API shape.
// Run with: node spike/render-test.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ftml = require("../ftml/pkg/ftml.js");

const SAMPLE = `[[include :scp-wiki:component:license-box]]

+ Item #: SCP-XXXX

+ Object Class: Euclid

+ Special Containment Procedures

Write your containment procedures here. This is a **placeholder** —
the no-AI-content rule for this project means you write every word
of the actual article yourself.

+ Description

This paragraph is example body text so you can see how a normal
paragraph renders. //Italics//, **bold**, __underline__, and
--strikethrough-- all work.

[[collapsible show="+ Show Addendum" hide="- Hide Addendum"]]
Addendum content goes here. Collapsibles are common for
interview logs and incident reports.
[[/collapsible]]

||~ Column A||~ Column B||
||Row 1||Data||
||Row 2||Data||

An unresolved include the fake-substitution layer won't touch:
[[include :scp-wiki:component:image-block name=foo.jpg width=200px]]

[[module Rate]]
`;

function section(title) {
  console.log("\n" + "=".repeat(8) + " " + title + " " + "=".repeat(8));
}

section("version()");
console.log(ftml.version());

section("WikitextSettings.from_mode");
const settings = ftml.WikitextSettings.from_mode("page", "wikidot");
console.log("settings object created:", settings);

section("PageInfo construction");
let pageInfo;
const pageInfoCandidate = {
  page: "scp-xxxx",
  category: null,
  site: "scp-wiki",
  title: "SCP-XXXX",
  alt_title: null,
  score: 69,
  tags: ["euclid", "scp"],
  language: "en",
};
try {
  pageInfo = new ftml.PageInfo(pageInfoCandidate);
  console.log("PageInfo constructed OK with:", pageInfoCandidate);
} catch (err) {
  console.error("PageInfo construction FAILED with:", pageInfoCandidate);
  console.error(err);
  process.exit(1);
}

section("preprocess()");
const preprocessed = ftml.preprocess(SAMPLE);
console.log(preprocessed.slice(0, 120) + "...");

section("tokenize()");
const t0 = performance.now();
const tokenization = ftml.tokenize(preprocessed);
const tokenizeMs = performance.now() - t0;
console.log(`tokenize() took ${tokenizeMs.toFixed(2)}ms`);
console.log("sample tokens:", JSON.stringify(tokenization.tokens()).slice(0, 300));

section("parse()");
// NOTE (empirical finding): wasm-bindgen classes passed by value are MOVED —
// the underlying wasm pointer is freed after the call, so reusing pageInfo/
// settings/tokenization in a later call requires .copy() beforehand, or you
// get "Attempt to use a moved value".
const t1 = performance.now();
let parseOutcome;
try {
  parseOutcome = ftml.parse(tokenization.copy(), pageInfo.copy(), settings.copy());
} catch (err) {
  console.error("parse() THREW (unresolved include may not degrade gracefully):");
  console.error(err);
  process.exit(1);
}
const parseMs = performance.now() - t1;
console.log(`parse() took ${parseMs.toFixed(2)}ms`);
console.log("parse errors:", JSON.stringify(parseOutcome.errors(), null, 2));

section("render_html()");
const t2 = performance.now();
const htmlOutput = ftml.render_html(parseOutcome.syntax_tree(), pageInfo.copy(), settings.copy());
const renderMs = performance.now() - t2;
console.log(`render_html() took ${renderMs.toFixed(2)}ms`);
console.log("--- body (first 2000 chars) ---");
console.log(htmlOutput.body().slice(0, 2000));
console.log("--- html_meta() ---");
console.log(JSON.stringify(htmlOutput.html_meta(), null, 2));
console.log("--- backlinks() ---");
console.log(JSON.stringify(htmlOutput.backlinks(), null, 2));

section("render_text()");
const textOut = ftml.render_text(parseOutcome.syntax_tree(), pageInfo.copy(), settings.copy());
console.log(textOut.slice(0, 500));

section("Unresolved include check");
const includeMarkerFound = htmlOutput.body().includes("image-block");
console.log(
  includeMarkerFound
    ? "Unresolved [[include]] appears to degrade to visible/editable text (marker found in output)."
    : "Unresolved [[include]] marker NOT found verbatim in output — inspect body above to see how it was handled.",
);

section("Timing summary");
console.log({ tokenizeMs, parseMs, renderMs });
