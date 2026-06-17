/* Rebel AI — safe syntax highlighting (no leaked class names in editor) */
(function RebelSyntax(global) {
  'use strict';

  const MARK = '\uE000';

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function wrap(cls, text) {
    return '<span class="' + cls + '">' + text + '</span>';
  }

  function protectSpans(html, store) {
    return html.replace(/<span class="hl-[^"]*">[\s\S]*?<\/span>/g, m => {
      const i = store.length;
      store.push(m);
      return MARK + i + MARK;
    });
  }

  function restoreSpans(html, store) {
    return html.replace(/\uE000(\d+)\uE000/g, (_, i) => store[+i] || '');
  }

  function applyRule(html, regex, cls) {
    const store = [];
    let out = protectSpans(html, store);
    out = out.replace(regex, m => wrap(cls, m));
    return restoreSpans(out, store);
  }

  function highlightCode(code, filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    let html = escapeHtml(code || '');

    if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx') {
      html = applyRule(html, /(\/\/[^\n]*)/g, 'hl-cmt');
      html = applyRule(html, /\b(const|let|var|function|return|async|await|if|else|for|while|of|in|new|class|import|export|from|default|try|catch|throw|require)\b/g, 'hl-kw');
      html = applyRule(html, /\b(\d+\.?\d*)\b/g, 'hl-num');
      html = applyRule(html, /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, 'hl-str');
      html = applyRule(html, /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g, 'hl-fn');
    } else if (ext === 'html' || ext === 'htm') {
      html = applyRule(html, /(&lt;!--[\s\S]*?--&gt;)/g, 'hl-cmt');
      html = applyRule(html, /(&lt;\/?[\w-]+(?:\s+[\w-:-]+(?:=(?:"[^"]*"|'[^']*'))?)*\s*\/?&gt;)/g, 'hl-tag');
      html = applyRule(html, /("(?:[^"]*)")/g, 'hl-str');
    } else if (ext === 'css' || ext === 'scss') {
      html = applyRule(html, /(\/\*[\s\S]*?\*\/)/g, 'hl-cmt');
      html = applyRule(html, /([.#][\w-]+|[\w-]+)\s*(?=\{)/g, 'hl-sel');
      html = applyRule(html, /([\w-]+)\s*:/g, 'hl-prop');
      html = applyRule(html, /(#[0-9a-fA-F]{3,8}|\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?)/g, 'hl-num');
      html = applyRule(html, /('(?:[^']*)'|"(?:[^"]*)")/g, 'hl-str');
    } else if (ext === 'md' || ext === 'markdown') {
      html = applyRule(html, /(#{1,6}\s.+)/g, 'hl-cmt');
      html = applyRule(html, /(`[^`\n]+`)/g, 'hl-str');
      html = applyRule(html, /(\*\*[^*\n]+\*\*)/g, 'hl-kw');
    }

    return html;
  }

  global.RebelSyntax = { highlightCode, escapeHtml };
})(window);
