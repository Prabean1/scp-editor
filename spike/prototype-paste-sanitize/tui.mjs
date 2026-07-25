// PROTOTYPE — throwaway. Run with: npm run prototype:paste-sanitize
//
// Question being answered: see decide.mjs's header comment. No ftml-oracle
// equivalent here — this is a visual-inspection tool over hand-picked
// samples.
import {
  sanitizePastedText,
  imageDropHandlerStub,
  pasteSanitizeHandlerStub,
  runPastePipeline
} from './decide.mjs'
import { SAMPLES } from './samples.mjs'

const state = { sampleIdx: 0, mode: 'always' }

const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'

function esc(s) {
  return s.replace(/\n/g, '⏎')
}

function renderClipboardScenario(sample) {
  console.log(`${BOLD}Document before cursor:${RESET}  ${DIM}${esc(sample.docBefore) || '(empty)'}${RESET}`)
  if (sample.hasImageFile) {
    console.log(`${BOLD}Clipboard:${RESET}  ${YELLOW}image file${RESET} ${DIM}(no text payload used)${RESET}`)
  } else {
    console.log(`${BOLD}Pasted text:${RESET}`)
    esc(sample.pasted)
      .split('⏎')
      .forEach((l) => console.log(`  ${l}`))
  }
}

function renderPipelineResult(sample) {
  const handlers = [imageDropHandlerStub, pasteSanitizeHandlerStub(state.mode)]
  const clipboard = { text: sample.pasted, hasImageFile: sample.hasImageFile }
  const ctx = { docBefore: sample.docBefore }
  const result = runPastePipeline(handlers, clipboard, ctx)

  console.log()
  console.log(`${BOLD}Pipeline result:${RESET}`)
  console.log(`  ${CYAN}${result.label}${RESET}`)
  if (!sample.hasImageFile) {
    console.log(`${BOLD}  Inserted text:${RESET}`)
    esc(result.text)
      .split('⏎')
      .forEach((l) => console.log(`    ${l}`))
  }
}

function renderChangeList(sample) {
  if (sample.hasImageFile) return
  const { changes, skipped } = sanitizePastedText(sample.docBefore, sample.pasted, state.mode)
  console.log()
  console.log(`${BOLD}Character-level changes (${changes.length}):${RESET}`)
  if (skipped) {
    console.log(`  ${YELLOW}none — skipped, paste lands inside [[code]] literal body${RESET}`)
    return
  }
  if (changes.length === 0) {
    console.log(`  ${DIM}none${RESET}`)
    return
  }
  for (const c of changes) {
    console.log(`  ${GREEN}${c.char}${RESET} -> ${GREEN}${c.replacement}${RESET}  at pasted-text index ${c.index}`)
  }
}

function render() {
  console.clear()
  const sample = SAMPLES[state.sampleIdx]
  console.log(`${BOLD}Sample ${state.sampleIdx + 1}/${SAMPLES.length}: ${sample.name}${RESET}`)
  console.log(`${DIM}${sample.note}${RESET}`)
  console.log()

  renderClipboardScenario(sample)
  renderPipelineResult(sample)
  renderChangeList(sample)

  console.log()
  console.log(
    `${BOLD}Mode:${RESET} ${state.mode === 'always' ? GREEN + 'always sanitize' : CYAN + 'respect-literal-body'}${RESET}${DIM} (toggle with [g])${RESET}`
  )
  console.log()
  console.log(
    `${BOLD}[n]${RESET}${DIM} next sample  ${RESET}${BOLD}[p]${RESET}${DIM} prev sample  ${RESET}${BOLD}[g]${RESET}${DIM} toggle mode  ${RESET}${BOLD}[q]${RESET}${DIM} quit${RESET}`
  )
}

function handleKey(key) {
  if (key === 'n') state.sampleIdx = (state.sampleIdx + 1) % SAMPLES.length
  else if (key === 'p') state.sampleIdx = (state.sampleIdx - 1 + SAMPLES.length) % SAMPLES.length
  else if (key === 'g') state.mode = state.mode === 'always' ? 'respect-literal-body' : 'always'
  else if (key === 'q' || key === '') {
    process.stdin.setRawMode(false)
    process.exit(0)
  } else {
    return
  }
  render()
}

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding('utf8')
process.stdin.on('data', handleKey)

render()
