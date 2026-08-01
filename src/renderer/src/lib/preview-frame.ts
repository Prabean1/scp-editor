import baseCss from '../assets/base.css?inline'
import previewCss from '../assets/preview.css?inline'

// Runs inside the sandboxed srcdoc iframe: relocated tab/collapsible handling, plus a
// postMessage bridge (render updates, link clicks) a React ref/will-navigate can't reach.
export const FRAME_SCRIPT = `(function () {
  var TAB_BUTTONS = ':scope > .wj-tabs-button-list > .wj-tabs-button'
  var TAB_PANELS = ':scope > .wj-tabs-panel-list > .wj-tabs-panel'
  var openTabs = []
  var page = document.getElementById('page-content')

  function showTab(root, index) {
    root.querySelectorAll(TAB_BUTTONS).forEach(function (button, i) {
      button.setAttribute('aria-selected', String(i === index))
      button.setAttribute('tabindex', i === index ? '0' : '-1')
    })
    root.querySelectorAll(TAB_PANELS).forEach(function (panel, i) {
      panel.hidden = i !== index
    })
  }

  function reapplyTabs() {
    page.querySelectorAll('.wj-tabs').forEach(function (root, i) {
      var count = root.querySelectorAll(TAB_BUTTONS).length
      var index = Math.min(openTabs[i] || 0, count - 1)
      if (index > 0) showTab(root, index)
    })
  }

  page.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return

    var bottom = event.target.closest('.wj-collapsible-button-bottom')
    if (bottom) {
      var details = bottom.closest('details')
      if (details) details.open = false
      return
    }

    var link = event.target.closest('a[href]')
    if (link) {
      event.preventDefault()
      parent.postMessage({ type: 'preview-link', href: link.href }, '*')
      return
    }

    var button = event.target.closest('.wj-tabs-button')
    var root = button && button.closest('.wj-tabs')
    if (!button || !root) return
    var index = Array.from(root.querySelectorAll(TAB_BUTTONS)).indexOf(button)
    var rootIndex = Array.from(page.querySelectorAll('.wj-tabs')).indexOf(root)
    openTabs[rootIndex] = index
    showTab(root, index)
  })

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'preview-render') return
    page.innerHTML = event.data.html
    reapplyTabs()
  })

  parent.postMessage({ type: 'preview-ready' }, '*')
})()`

// Fake Wikidot page-hierarchy shell for theme CSS to attach to, chrome elements included —
// all empty and untargeted by preview.css today, so an unthemed article is unaffected.
export function buildFrameDoc(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<style>${baseCss}</style>
<style>${previewCss}</style>
<style>html, body { margin: 0; background: transparent; }</style>
</head>
<body>
<div id="container-wrap">
<div id="container">
<div id="header">
<div id="top-bar"></div>
</div>
<div id="side-bar"></div>
<div id="content-wrap">
<div id="main-content" class="scp-page-wrap">
<div id="breadcrumbs"></div>
<div id="page-title"></div>
<div class="page-rate-widget-box"></div>
<div id="page-content"></div>
</div>
</div>
<div id="footer"></div>
</div>
</div>
<!-- inline script needs the matching CSP hash in index.html, see preview-frame.test.ts -->
<script>${FRAME_SCRIPT}</script>
</body>
</html>`
}
