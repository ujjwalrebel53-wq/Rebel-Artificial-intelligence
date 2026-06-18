/* Rebel Diagnostics — Cursor-style lint + quick fixes (client-side) */
(function RebelDiagnostics(global) {
  'use strict';

  function pid(file, line, rule) {
    return file + ':' + line + ':' + rule;
  }

  function push(list, item) {
    item.id = item.id || pid(item.file, item.line, item.rule || 'x');
    list.push(item);
  }

  function stripJsNoise(line) {
    let out = '';
    let i = 0;
    let inS = null;
    while (i < line.length) {
      const c = line[i];
      const next = line[i + 1];
      if (inS) {
        if (c === '\\') { i += 2; continue; }
        if (c === inS) inS = null;
        i++;
        continue;
      }
      if (c === '/' && next === '/') break;
      if (c === '"' || c === "'" || c === '`') { inS = c; i++; continue; }
      out += c;
      i++;
    }
    return out;
  }

  function lintJs(file, code, problems) {
    const lines = code.split('\n');

    lines.forEach((line, i) => {
      const ln = i + 1;
      const t = line.trim();
      if (!t || t.startsWith('//')) return;

      if (/\brequire\s*\(\s*['"]/.test(line) && !/\/\/.*require/.test(line)) {
        push(problems, {
          file, line: ln, col: 1, msg: 'Node require() will not run in browser preview — use browser JS or remove',
          sev: 'warn', rule: 'node-require', source: 'Rebel', fixable: true,
        });
      }

      if (/console\.log\s*\(/.test(line) && !t.startsWith('//')) {
        push(problems, {
          file, line: ln, col: 1, msg: 'Unexpected console statement', sev: 'info', rule: 'console-log', source: 'Rebel', fixable: true,
        });
      }

      const stripped = stripJsNoise(line);
      const opens = (stripped.match(/[\(\[\{]/g) || []).length;
      const closes = (stripped.match(/[\)\]\}]/g) || []).length;
      if (opens !== closes && (opens > 0 || closes > 0)) {
        push(problems, {
          file, line: ln, col: 1,
          msg: 'Unbalanced brackets on this line',
          sev: 'warn', rule: 'brackets-line', source: 'Rebel', fixable: false,
        });
      }
    });

    let depth = 0;
    lines.forEach((line, i) => {
      const s = stripJsNoise(line);
      for (const c of s) {
        if (c === '{') depth++;
        if (c === '}') depth--;
      }
      if (depth < 0) {
        push(problems, {
          file, line: i + 1, col: 1, msg: 'Unexpected closing brace "}"', sev: 'error', rule: 'brace-extra', source: 'Rebel', fixable: true,
        });
        depth = 0;
      }
    });
    if (depth > 0) {
      push(problems, {
        file, line: lines.length, col: 1,
        msg: `Missing ${depth} closing brace(s) "}"`,
        sev: 'error', rule: 'brace-missing', source: 'Rebel', fixable: true,
      });
    }

    try {
      // eslint-disable-next-line no-new-func
      new Function(code);
    } catch (e) {
      const msg = (e && e.message) ? e.message : 'JavaScript syntax error';
      let line = 1;
      const m = msg.match(/line\s+(\d+)|:(\d+):(\d+)/i);
      if (m) line = parseInt(m[1] || m[2], 10) || 1;
      push(problems, {
        file, line, col: 1, msg: 'Syntax error: ' + msg.replace(/^SyntaxError:\s*/i, ''),
        sev: 'error', rule: 'js-syntax', source: 'JS', fixable: true,
      });
    }
  }

  function lintCss(file, code, problems) {
    let depth = 0;
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      const s = line.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const c of s) {
        if (c === '{') depth++;
        if (c === '}') depth--;
      }
      if (depth < 0) {
        push(problems, {
          file, line: i + 1, col: 1, msg: 'Unexpected "}" in CSS', sev: 'error', rule: 'css-brace', source: 'CSS', fixable: true,
        });
        depth = 0;
      }
    });
    if (depth > 0) {
      push(problems, {
        file, line: lines.length, col: 1, msg: `Missing ${depth} closing "}" in CSS`, sev: 'error', rule: 'css-brace-missing', source: 'CSS', fixable: true,
      });
    }
  }

  function lintHtml(file, code, files, problems) {
    const lines = code.split('\n');
    const stack = [];
    const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

    lines.forEach((line, i) => {
      const ln = i + 1;
      const tags = line.match(/<\/?([a-zA-Z][\w-]*)\b[^>]*>/g) || [];
      tags.forEach(raw => {
        const closing = raw.startsWith('</');
        const name = (raw.match(/<\/?([a-zA-Z][\w-]*)/) || [])[1];
        if (!name) return;
        const lower = name.toLowerCase();
        if (voidTags.has(lower) || raw.endsWith('/>')) return;
        if (closing) {
          const top = stack[stack.length - 1];
          if (!top || top.name !== lower) {
            push(problems, {
              file, line: ln, col: 1, msg: `Unexpected closing tag </${lower}>`, sev: 'error', rule: 'html-tag', source: 'HTML', fixable: true,
            });
          } else stack.pop();
        } else {
          stack.push({ name: lower, line: ln });
        }
      });

      const hrefM = line.match(/href=["']([^"']+)["']/i);
      if (hrefM) {
        const ref = hrefM[1].replace(/^\.\//, '');
        if (ref.endsWith('.css') && !ref.startsWith('http') && files && !files[ref]) {
          push(problems, {
            file, line: ln, col: 1, msg: `Missing stylesheet file: ${ref}`, sev: 'error', rule: 'missing-file', source: 'HTML', fixable: false,
          });
        }
      }

      const srcM = line.match(/src=["']([^"']+)["']/i);
      if (srcM) {
        const ref = srcM[1].replace(/^\.\//, '');
        if (ref.endsWith('.js') && !ref.startsWith('http') && files && !files[ref]) {
          push(problems, {
            file, line: ln, col: 1, msg: `Missing script file: ${ref}`, sev: 'error', rule: 'missing-file', source: 'HTML', fixable: false,
          });
        }
      }
    });

    stack.forEach(t => {
      push(problems, {
        file, line: t.line, col: 1, msg: `Unclosed <${t.name}> tag`, sev: 'error', rule: 'html-unclosed', source: 'HTML', fixable: true,
      });
    });
  }

  function analyze(files, previewErrors) {
    const problems = [];
    Object.entries(files || {}).forEach(([name, code]) => {
      if (name.endsWith('.js') || name.endsWith('.ts')) lintJs(name, code || '', problems);
      else if (name.endsWith('.css')) lintCss(name, code || '', problems);
      else if (name.endsWith('.html') || name.endsWith('.htm')) lintHtml(name, code || '', files, problems);
    });

    (previewErrors || []).forEach((pe, i) => {
      push(problems, {
        file: pe.file || 'preview',
        line: pe.line || 1,
        col: 1,
        msg: pe.msg || 'Preview runtime error',
        sev: 'error',
        rule: 'preview-runtime',
        source: 'Preview',
        fixable: true,
        id: 'preview-' + i,
      });
    });

    const rank = { error: 0, warn: 1, info: 2 };
    problems.sort((a, b) => (rank[a.sev] - rank[b.sev]) || a.file.localeCompare(b.file) || a.line - b.line);
    return problems;
  }

  function applyQuickFix(problem, code) {
    if (!problem || !code) return null;
    const lines = code.split('\n');
    const idx = problem.line - 1;
    if (idx < 0 || idx >= lines.length) return null;

    if (problem.rule === 'console-log') {
      lines.splice(idx, 1);
      return lines.join('\n');
    }

    if (problem.rule === 'brace-missing') {
      const n = parseInt((problem.msg.match(/Missing (\d+)/) || [])[1], 10) || 1;
      return code + '\n' + '}'.repeat(n);
    }

    if (problem.rule === 'css-brace-missing') {
      const n = parseInt((problem.msg.match(/Missing (\d+)/) || [])[1], 10) || 1;
      return code + '\n' + '}'.repeat(n);
    }

    if (problem.rule === 'node-require') {
      lines[idx] = '// ' + lines[idx];
      return lines.join('\n');
    }

    return null;
  }

  global.RebelDiagnostics = { analyze, applyQuickFix };
})(window);
