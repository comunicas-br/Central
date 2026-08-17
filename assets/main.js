/* ============================================================
   CENTRAL DE PRODUÇÃO — script compartilhado (somente leitura)
   ------------------------------------------------------------
   Este arquivo é o único JS do site e é o mesmo em todas as
   páginas. Ele NÃO grava nada em localStorage, NÃO expõe nenhum
   segredo, e NÃO oferece nenhuma forma de editar o conteúdo pela
   própria página — quem quiser atualizar o conteúdo usa o painel
   visual separado (admin.html) e publica os arquivos exportados.

   Como funciona: cada página tem um bloco
     <script type="application/json" id="siteData">{...}</script>
   com o conteúdo daquela página. Este arquivo lê esse bloco (que
   nunca é executado como código — é só texto/JSON) e monta a
   página usando apenas textContent/createElement (nunca innerHTML
   com dado dinâmico), o que evita que um texto malicioso vire
   HTML/JS de verdade. Isso é o que permite ao admin.html gerar
   uma nova versão do site só trocando esse bloco de dados, sem
   precisar reescrever o HTML de cada página na mão.
   ============================================================ */
(function () {
  'use strict';

  /* ================= helpers de DOM seguro ================= */
  function el(tag, opts) {
    var node = document.createElement(tag);
    opts = opts || {};
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = opts.text;
    Object.keys(opts).forEach(function (k) {
      if (k === 'class' || k === 'text') return;
      node.setAttribute(k, opts[k]);
    });
    return node;
  }
  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      if (Array.isArray(c)) { c.forEach(function (x) { if (x) parent.appendChild(x); }); continue; }
      parent.appendChild(c);
    }
    return parent;
  }
  function icon(id, cls) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', cls ? 'ic ' + cls : 'ic');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-' + id);
    svg.appendChild(use);
    return svg;
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
  // pequena sintaxe segura para título/textos com quebra de linha e destaque:
  // "\n" vira <br>, e "|palavra|" vira <em>palavra</em> — nunca interpreta HTML.
  function richText(container, str) {
    container.textContent = '';
    var lines = String(str == null ? '' : str).split('\n');
    lines.forEach(function (line, i) {
      if (i > 0) container.appendChild(document.createElement('br'));
      var parts = line.split(/\|([^|]+)\|/);
      parts.forEach(function (part, idx) {
        if (!part) return;
        if (idx % 2 === 1) {
          var em = document.createElement('em');
          em.textContent = part;
          container.appendChild(em);
        } else {
          container.appendChild(document.createTextNode(part));
        }
      });
    });
  }
  function readData() {
    var tag = document.getElementById('siteData');
    if (!tag) return {};
    try { return JSON.parse(tag.textContent) || {}; } catch (e) { return {}; }
  }
  function fmt(str) { return str == null ? '' : String(str); }
  function clear(node) { if (node) node.textContent = ''; }

  /* ================= acesso por senha simples =================
     Barreira leve, não é segurança de verdade: como o site é HTML/CSS/JS
     estático, a senha configurada fica visível para quem abrir o
     código-fonte da página. Serve só para não deixar o link aberto para
     qualquer visitante casual — "é melhor que nada". Se nenhuma senha for
     definida (meta.sitePassword vazio), o site fica aberto normalmente,
     como antes. */
  function initPasswordGate(meta) {
    var body = document.body;
    var pass = meta && meta.sitePassword ? String(meta.sitePassword) : '';
    if (!pass) { body.classList.add('cp-unlocked'); return; }
    var storeKey = 'cpAccess_' + (meta.projectName || 'site');
    var stored = null;
    try { stored = localStorage.getItem(storeKey); } catch (e) { stored = null; }
    if (stored === pass) { body.classList.add('cp-unlocked'); return; }
    body.classList.remove('cp-unlocked');
    var form = document.getElementById('cpGateForm');
    var input = document.getElementById('cpGateInput');
    var err = document.getElementById('cpGateErr');
    if (!form || !input) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value || '';
      if (v === pass) {
        try { localStorage.setItem(storeKey, v); } catch (e2) { /* sem storage, sem problema: só pede de novo na próxima visita */ }
        body.classList.add('cp-unlocked');
        if (err) err.hidden = true;
      } else {
        if (err) err.hidden = false;
        input.value = '';
        input.focus();
      }
    });
    setTimeout(function () { input.focus(); }, 60);
  }

  /* ================= meta: nome do projeto, logo, última atualização ================= */
  function renderMeta(data) {
    var meta = data.meta || {};
    document.querySelectorAll('.brand span').forEach(function (s) { s.textContent = meta.projectName || '[Nome do Projeto]'; });
    document.querySelectorAll('[data-mount="footerProject"]').forEach(function (s) { s.textContent = meta.projectName || '[Nome do Projeto]'; });

    var lu = meta.lastUpdate || {};
    var luLine = (lu.weekday || '') + (lu.weekday && lu.date ? ', ' : '') + (lu.date || '');
    document.querySelectorAll('[data-mount="lastUpdateDate"]').forEach(function (s) { s.textContent = luLine || '—'; });
    document.querySelectorAll('[data-mount="lastUpdateTime"]').forEach(function (s) { s.textContent = lu.time || '—'; });
    document.querySelectorAll('[data-mount="footerPublished"]').forEach(function (s) {
      s.textContent = 'Conteúdo publicado em: ' + (luLine ? luLine + (lu.time ? ', ' + lu.time : '') : '—');
    });

    if (meta.logo) {
      document.querySelectorAll('img[data-mount="logo"]').forEach(function (img) { img.src = meta.logo; });
    }
  }

  /* ================= página: Visão geral (index.html) ================= */
  function renderIndex(data) {
    var hero = data.hero || {};
    var stageEl = document.getElementById('heroStageBadge');
    if (stageEl) stageEl.textContent = hero.stageBadge || 'Em captação';
    var kickerEl = document.getElementById('heroKicker');
    if (kickerEl) kickerEl.textContent = hero.kicker || '';
    var titleEl = document.getElementById('heroTitle');
    if (titleEl) richText(titleEl, hero.title || '');
    var subEl = document.getElementById('heroSynopsis');
    if (subEl) subEl.textContent = hero.synopsis || '';

    var statsEl = document.getElementById('heroStats');
    if (statsEl) {
      clear(statsEl);
      (hero.stats || []).forEach(function (s) {
        append(statsEl, append(el('div', { class: 'stat' }), el('b', { text: s.value }), el('span', { text: s.label })));
      });
    }

    var regrasEl = document.getElementById('regrasList');
    if (regrasEl) {
      clear(regrasEl);
      (data.regras || []).forEach(function (r) {
        var h4 = append(el('h4'), icon('check'), document.createTextNode(r.title || ''));
        append(regrasEl, append(el('div', { class: 'lg' }), h4, el('p', { text: r.desc || '' })));
      });
    }

    var persEl = document.getElementById('personagensList');
    if (persEl) {
      clear(persEl);
      (data.personagens || []).forEach(function (p) {
        var foto = append(el('div', { class: 'pfoto' }), el('img', { alt: 'Foto do personagem' }), el('div', { class: 'fbi', text: 'NN' }));
        var card = append(el('div', { class: 'pc ' + (p.tagClass || 'sec') }),
          foto,
          el('div', { class: 'pn', text: p.name || '' }),
          el('div', { class: 'ps', text: p.tagText || '' }),
          el('p', { text: p.desc || '' }));
        persEl.appendChild(card);
      });
    }

    var aStatsEl = document.getElementById('andamentoStats');
    var aPhasesEl = document.getElementById('andamentoPhases');
    var andamento = data.andamento || {};
    if (aStatsEl) {
      clear(aStatsEl);
      (andamento.stats || []).forEach(function (s) {
        append(aStatsEl, append(el('div', { class: 'stat' }), el('b', { text: s.value }), el('span', { text: s.label })));
      });
    }
    if (aPhasesEl) {
      clear(aPhasesEl);
      (andamento.phases || []).forEach(function (p) {
        var pct = Math.max(0, Math.min(100, parseInt(p.pct, 10) || 0));
        var pn2 = append(el('span', { class: 'pn2' }), icon(p.icon || 'check'), document.createTextNode(p.name || ''));
        var fill = el('div', { class: 'pfill' }); fill.style.width = pct + '%';
        var bar = append(el('div', { class: 'pbar' }), fill);
        var pctEl = el('span', { class: 'pct', text: pct + '%' });
        append(aPhasesEl, append(el('div', { class: 'phase' }), pn2, bar, pctEl));
      });
    }
  }

  /* ================= página: Projeto / Planejamento ================= */
  function renderProjeto(data) {
    var obj = data.objetivos || {};
    var s1 = document.getElementById('objSinopse1'); if (s1) s1.textContent = obj.sinopse1 || '';
    var s2 = document.getElementById('objSinopse2'); if (s2) s2.textContent = obj.sinopse2 || '';
    var te = document.getElementById('objTese'); if (te) te.textContent = obj.tese || '';
    var to = document.getElementById('objTom'); if (to) to.textContent = obj.tom || '';
    var tagsEl = document.getElementById('objTags');
    if (tagsEl) {
      clear(tagsEl);
      (obj.tags || []).forEach(function (t) { tagsEl.appendChild(el('span', { class: 'tag2', text: t })); });
    }

    var equipeEl = document.getElementById('equipeList');
    if (equipeEl) {
      clear(equipeEl);
      (data.equipe || []).forEach(function (m) {
        var foto = append(el('div', { class: 'pfoto' }), el('img', { alt: 'Foto do participante' }), el('div', { class: 'fbi', text: 'NN' }));
        var tasksEl = el('div', { class: 'mtasks' });
        (m.tasks || []).forEach(function (t) { tasksEl.appendChild(el('span', { class: 'mtask', text: t })); });
        var info = append(el('div', { class: 'minfo' }), el('div', { class: 'mname', text: m.name || '' }), el('div', { class: 'mrole', text: m.role || '' }), tasksEl);
        equipeEl.appendChild(append(el('div', { class: 'member' }), foto, info));
      });
    }

    var croEl = document.getElementById('cronogramaList');
    if (croEl) {
      clear(croEl);
      (data.cronograma || []).forEach(function (ev) {
        var when = append(el('div', { class: 'when' }), el('b', { text: ev.date || '' }), el('span', { text: ev.label || '' }));
        var dot = append(el('div', { class: 'dot' }), el('i'));
        var h3children = [document.createTextNode(ev.title || '')];
        if (ev.status === 'feito') h3children.unshift(icon('check'));
        var body = append(el('div', { class: 'body' }), append(el('h3'), h3children), el('p', { text: ev.desc || '' }));
        var cls = 'ev' + (ev.status ? ' ' + ev.status : '');
        croEl.appendChild(append(el('div', { class: cls }), when, dot, body));
      });
    }

    // checklist
    var ckWrap = document.getElementById('checklistGroups');
    var ckBar = document.getElementById('ckBarFill');
    var ckNum = document.getElementById('ckBarNum');
    if (ckWrap) {
      clear(ckWrap);
      var total = 0, done = 0;
      (data.checklist || []).forEach(function (grp) {
        var h3 = append(el('h3'), icon(grp.icon || 'check'), document.createTextNode(grp.group || ''));
        var box = append(el('div', { class: 'ck' }), h3);
        (grp.items || []).forEach(function (it) {
          total++; if (it.done) done++;
          var ci = el('span', { class: 'ci' });
          if (it.done) ci.appendChild(icon('check'));
          var row = append(el('div', { class: 'ckrow' + (it.done ? ' done' : '') }), ci, el('span', { text: it.text || '' }));
          box.appendChild(row);
        });
        ckWrap.appendChild(box);
      });
      if (ckBar) ckBar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
      if (ckNum) ckNum.textContent = done + ' / ' + total + ' concluídas';
    }

    var pesquisa = data.pesquisa || {};
    var notasPesquisa = document.getElementById('pesquisaNotas');
    if (notasPesquisa) notasPesquisa.textContent = pesquisa.notas || '';
    var fontesEl = document.getElementById('fontesList');
    if (fontesEl) {
      clear(fontesEl);
      (pesquisa.fontes || []).forEach(function (f, i) {
        var sid = el('div', { class: 'sid', text: String(i + 1).padStart(2, '0') });
        var a = append(el('a', { class: 'stitle', href: f.url || 'https://', target: '_blank', rel: 'noopener' }), icon('link'), document.createTextNode(f.titulo || ''));
        var chips = [el('span', { class: 'chip', text: f.tipo || '' })];
        if (f.statusText) {
          var sc = append(el('span', { class: 'chip ' + (f.statusClass || '') }), icon(f.statusClass === 'ok' ? 'check' : 'alert'), document.createTextNode(f.statusText));
          chips.push(sc);
        }
        var meta = append(el('div', { class: 'smeta' }), chips);
        var right = append(el('div'), a, meta, el('p', { class: 'snote', text: f.nota || '' }));
        fontesEl.appendChild(append(el('div', { class: 'src' }), sid, right));
      });
    }

    var material = data.material || {};
    var driveBtn = document.getElementById('driveButton');
    if (driveBtn) {
      if (material.driveUrl) {
        driveBtn.href = material.driveUrl;
        driveBtn.querySelector('[data-mount="driveLabel"]').textContent = material.driveLabel || 'Acessar material bruto no Drive';
        driveBtn.hidden = false;
      } else {
        driveBtn.hidden = true;
      }
    }
    var matEl = document.getElementById('materialList');
    if (matEl) {
      clear(matEl);
      (material.itens || []).forEach(function (m) {
        var mmeta = append(el('div', { class: 'mmeta' }),
          el('span', { class: 'chip', text: m.tipo || '' }),
          m.duracao ? el('span', { class: 'chip', text: m.duracao }) : null,
          m.statusText ? el('span', { class: 'chip ' + (m.statusClass || ''), text: m.statusText }) : null);
        var mfile = append(el('div', { class: 'mfile' }), icon('file'), document.createTextNode(m.arquivo || ''));
        matEl.appendChild(append(el('div', { class: 'mit' }), el('div', { class: 'mid', text: m.id || '' }), el('h4', { text: m.titulo || '' }), mmeta, mfile));
      });
    }

    var notasEl = document.getElementById('notasList');
    if (notasEl) {
      clear(notasEl);
      var TAGICON = { duvida: 'alert', decisao: 'target', contato: 'mail' };
      var TAGLABEL = { duvida: 'Dúvida', decisao: 'Decisão pendente', contato: 'Contato a confirmar' };
      (data.notas || []).forEach(function (n) {
        var tag = append(el('div', { class: 'tag' }), icon(TAGICON[n.tipo] || 'alert'), document.createTextNode(TAGLABEL[n.tipo] || n.tipo || ''));
        notasEl.appendChild(append(el('div', { class: 'nt ' + (n.tipo || '') }), tag, el('h3', { text: n.titulo || '' }), el('p', { text: n.texto || '' })));
      });
    }

    initCalendar(data.calendario || []);
  }

  /* ================= calendário (só leitura) ================= */
  var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  var DOWS = ['dom','seg','ter','qua','qui','sex','sáb'];
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dkey(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
  function initCalendar(events) {
    var grid = document.getElementById('calGrid');
    if (!grid) return;
    var view = new Date(); view.setDate(1);
    var selected = null;

    function render() {
      var y = view.getFullYear(), m = view.getMonth();
      var label = document.getElementById('calLabel');
      if (label) label.textContent = MESES[m] + ' de ' + y;
      clear(grid);
      DOWS.forEach(function (w) { grid.appendChild(el('div', { class: 'calwd', text: w })); });
      var startOffset = new Date(y, m, 1).getDay();
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var t = new Date(), todayKey = dkey(t.getFullYear(), t.getMonth(), t.getDate());
      for (var i = 0; i < startOffset; i++) grid.appendChild(el('div', { class: 'calday blank' }));
      for (var d = 1; d <= daysInMonth; d++) {
        var key = dkey(y, m, d);
        var cell = el('div', { class: 'calday' + (key === todayKey ? ' today' : '') + (key === selected ? ' sel' : ''), 'data-date': key });
        cell.appendChild(el('span', { class: 'dn', text: String(d) }));
        var evs = events.filter(function (e) { return e.date === key; });
        if (evs.length) {
          var dots = el('div', { class: 'dots' });
          evs.slice(0, 4).forEach(function (e) {
            var i2 = document.createElement('i'); i2.style.background = 'var(--' + (e.color || 'acc') + ')';
            dots.appendChild(i2);
          });
          cell.appendChild(dots);
        }
        cell.addEventListener('click', function () {
          selected = this.dataset.date;
          renderDetail();
          grid.querySelectorAll('.calday').forEach(function (c) { c.classList.remove('sel'); });
          this.classList.add('sel');
        });
        grid.appendChild(cell);
      }
    }

    function renderDetail() {
      var det = document.getElementById('calDetail');
      if (!det) return;
      var list = det.querySelector('.callist');
      if (!list) return;
      clear(list);
      var evs = selected ? events.filter(function (e) { return e.date === selected; }) : [];
      if (!selected) {
        list.appendChild(el('div', { class: 'calempty', text: 'Clique em um dia marcado para ver os eventos do calendário.' }));
      } else if (!evs.length) {
        var parts = selected.split('-');
        list.appendChild(el('div', { class: 'calempty', text: 'Nenhum evento em ' + parts[2] + '/' + parts[1] + '/' + parts[0] + '.' }));
      } else {
        evs.forEach(function (e) {
          var dot = el('span', { class: 'dot2' }); dot.style.background = 'var(--' + (e.color || 'acc') + ')';
          var body = append(el('div', { class: 'cbd' }), el('h4', { text: e.title || '' }));
          if (e.desc) body.appendChild(el('p', { text: e.desc }));
          list.appendChild(append(el('div', { class: 'calev' }), dot, body));
        });
      }
    }

    var prev = document.getElementById('calPrev'), next = document.getElementById('calNext'), today = document.getElementById('calToday');
    if (prev) prev.addEventListener('click', function () { view.setMonth(view.getMonth() - 1); render(); });
    if (next) next.addEventListener('click', function () { view.setMonth(view.getMonth() + 1); render(); });
    if (today) today.addEventListener('click', function () {
      var t = new Date(); view = new Date(t.getFullYear(), t.getMonth(), 1);
      selected = dkey(t.getFullYear(), t.getMonth(), t.getDate());
      render(); renderDetail();
    });
    render(); renderDetail();
  }

  /* ================= página: Transcrições ================= */
  function renderTranscricoes(data) {
    var wrap = document.getElementById('transList');
    if (!wrap) return;
    clear(wrap);
    var items = data.transcricoes || [];
    items.forEach(function (t, i) {
      var badge = el('span', { class: 'transbadge', text: t.id || ('T-' + (i + 1)) });
      var info = append(el('div', { class: 'transinfo' }),
        append(el('span'), icon('file'), document.createTextNode(t.arquivo || '')),
        append(el('span'), icon('calendar'), document.createTextNode(t.data || '')),
        append(el('span'), icon('clock'), document.createTextNode(t.duracao || '')));
      var meta = append(el('div', { class: 'transmeta' }), el('h3', { text: t.titulo || '' }), info);
      var head = append(el('div', { class: 'transhead' }), badge, meta, icon('chevron', 'transtoggle'));
      var desc = el('div', { class: 'transdesc', text: t.contexto || '' });
      var text = el('div', { class: 'transtext', text: t.texto || '' });
      var body = append(el('div', { class: 'transbody' }), text);
      var searchBlob = [t.id, t.titulo, t.arquivo, t.contexto, t.texto].filter(Boolean).join(' ');
      var art = append(el('article', { class: 'trans' + (i === 0 ? ' open' : ''), 'data-tag': t.tag || '', 'data-search': searchBlob }), head, desc, body);
      wrap.appendChild(art);
    });
    var countEl = document.getElementById('transCount');
    if (countEl) countEl.textContent = items.length + (items.length === 1 ? ' transcrição encontrada' : ' transcrições encontradas');
    initTranscricoes();
  }

  function initTranscricoes() {
    var wrap = document.getElementById('transList');
    if (!wrap) return;
    var input = document.getElementById('transSearch');
    var chips = [].slice.call(document.querySelectorAll('.fchip'));
    var items = [].slice.call(wrap.querySelectorAll('.trans'));
    var countEl = document.getElementById('transCount');
    var activeTag = 'todas';

    function normalize(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    function apply() {
      var q = normalize(input ? input.value : '');
      var visible = 0;
      items.forEach(function (it) {
        var tag = it.getAttribute('data-tag') || '';
        var haystack = normalize(it.getAttribute('data-search') || it.textContent);
        var matchesTag = (activeTag === 'todas') || (tag === activeTag);
        var matchesText = !q || haystack.indexOf(q) !== -1;
        var show = matchesTag && matchesText;
        it.classList.toggle('hide', !show);
        if (show) visible++;
      });
      if (countEl) countEl.textContent = visible + (visible === 1 ? ' transcrição encontrada' : ' transcrições encontradas');
    }

    if (input) input.addEventListener('input', apply);
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        activeTag = chip.getAttribute('data-tag') || 'todas';
        apply();
      });
    });
    wrap.querySelectorAll('.transhead').forEach(function (head) {
      head.addEventListener('click', function () { head.closest('.trans').classList.toggle('open'); });
      head.setAttribute('tabindex', '0');
      head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); head.click(); } });
    });
    apply();
  }

  /* ================= página: Arquivo / Histórico ================= */
  function renderArquivo(data) {
    var cEl = document.getElementById('contatosList');
    if (cEl) {
      clear(cEl);
      (data.contatos || []).forEach(function (c) {
        var body = append(el('div'), el('b', { text: c.nome || '' }), el('span', { text: c.funcao || '' }), el('a', { href: 'mailto:' + (c.email || ''), text: c.email || '' }));
        cEl.appendChild(append(el('div', { class: 'cc' }), icon('users'), body));
      });
    }
    var vEl = document.getElementById('versoesBody');
    if (vEl) {
      clear(vEl);
      (data.versoes || []).forEach(function (v) {
        var linkTd = append(el('td'), append(el('a', { href: v.arquivoLink || '#' }), icon('file'), document.createTextNode(v.arquivoLabel || '')));
        vEl.appendChild(append(el('tr'), el('td', { text: v.data || '' }), el('td', { text: v.versao || '' }), el('td', { text: v.resumo || '' }), linkTd));
      });
    }
    var chEl = document.getElementById('changelogList');
    if (chEl) {
      clear(chEl);
      (data.changelog || []).forEach(function (c) {
        var when = el('div', { class: 'chwhen' });
        richText(when, c.data || '');
        var body = append(el('div', { class: 'chbody' }), el('div', { class: 'chv', text: c.versao || '' }), el('h3', { text: c.titulo || '' }), el('p', { text: c.desc || '' }));
        if (c.items && c.items.length) {
          var ul = el('ul');
          c.items.forEach(function (it) { ul.appendChild(el('li', { text: it })); });
          body.appendChild(ul);
        }
        chEl.appendChild(append(el('div', { class: 'chi' }), when, append(el('div', { class: 'chdot' }), el('i')), body));
      });
    }
  }

  /* ================= página: Apresentação / Publicação ================= */
  function renderApresentacao(data) {
    var f = data.apresentacaoFinal || {};
    var setText = function (id, val) { var e = document.getElementById(id); if (e) e.textContent = val || ''; };
    setText('apFinalStatus', f.statusText);
    setText('apFinalData', f.dataPrevisao);
    setText('apFinalDesc', f.descricao);
    var linkEl = document.getElementById('apFinalLink');
    if (linkEl) {
      if (f.linkVideo) { linkEl.href = f.linkVideo; linkEl.hidden = false; }
      else linkEl.hidden = true;
    }

    var pubEl = document.getElementById('publicacaoList');
    if (pubEl) {
      clear(pubEl);
      (data.publicacao || []).forEach(function (p) {
        var body = append(el('div'), el('b', { text: p.plataforma || '' }),
          p.statusText ? el('span', { class: 'chip', text: p.statusText }) : null,
          p.link ? append(el('a', { href: p.link, target: '_blank', rel: 'noopener' }), icon('link'), document.createTextNode(p.link)) : null);
        pubEl.appendChild(append(el('div', { class: 'cc' }), icon('arrow'), body));
      });
    }

    var a = data.abnt || {};
    setText('abntTitulo', a.titulo);
    setText('abntAutor', a.autor);
    setText('abntOrientador', a.orientador);
    setText('abntResumo', a.resumo);
    setText('abntStatus', a.statusText);
    var abntLink = document.getElementById('abntLink');
    if (abntLink) {
      if (a.linkArquivo) { abntLink.href = a.linkArquivo; abntLink.hidden = false; }
      else abntLink.hidden = true;
    }
  }

  /* ================= página: Métricas de marketing ================= */
  function renderMetricas(data) {
    var m = data.metricas || {};
    var kpiEl = document.getElementById('kpiList');
    if (kpiEl) {
      clear(kpiEl);
      (m.kpis || []).forEach(function (k) {
        kpiEl.appendChild(append(el('div', { class: 'stat' }), el('b', { text: k.value }), el('span', { text: (k.label || '') + (k.platform ? ' · ' + k.platform : '') })));
      });
    }
    var campEl = document.getElementById('campanhasBody');
    if (campEl) {
      clear(campEl);
      (m.campanhas || []).forEach(function (c) {
        campEl.appendChild(append(el('tr'), el('td', { text: c.nome || '' }), el('td', { text: c.periodo || '' }), el('td', { text: c.objetivo || '' }), el('td', { text: c.resultado || '' })));
      });
    }
    var notasEl = document.getElementById('metricasNotas');
    if (notasEl) notasEl.textContent = m.notas || '';
  }

  /* ================= página: Ideias (brainstorm + escolha do tema) ================= */
  var DIFICULDADE_LABEL = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
  function renderIdeias(data) {
    var ideias = data.ideias || {};

    var bancoEl = document.getElementById('bancoList');
    if (bancoEl) {
      clear(bancoEl);
      (ideias.banco || []).forEach(function (it, i) {
        var chipsRow = el('div', { class: 'mmeta' });
        (it.tags || []).forEach(function (t) { chipsRow.appendChild(el('span', { class: 'tag2', text: t })); });
        var card = append(el('div', { class: 'mit' }),
          el('div', { class: 'mid', text: '#' + String(i + 1).padStart(2, '0') }),
          el('h4', { text: it.titulo || '' }),
          chipsRow,
          it.desc ? el('p', { text: it.desc }) : null,
          it.autor ? el('div', { class: 'idea-author', text: 'sugestão de ' + it.autor }) : null);
        bancoEl.appendChild(card);
      });
    }

    var temas = (ideias.temas || []).slice().sort(function (a, b) { return (parseInt(b.votos, 10) || 0) - (parseInt(a.votos, 10) || 0); });
    var maxVotos = temas.reduce(function (m, t) { return Math.max(m, parseInt(t.votos, 10) || 0); }, 0) || 1;
    var chosen = temas.filter(function (t) { return t.escolhido; })[0];

    var bannerEl = document.getElementById('temaChosenBanner');
    if (bannerEl) {
      clear(bannerEl);
      if (chosen) {
        bannerEl.hidden = false;
        append(bannerEl, icon('check'), append(el('span'), document.createTextNode('Tema escolhido: '), el('b', { text: chosen.titulo || '' })));
      } else {
        bannerEl.hidden = true;
      }
    }

    var rankEl = document.getElementById('temasList');
    if (rankEl) {
      clear(rankEl);
      temas.forEach(function (t) {
        var votos = parseInt(t.votos, 10) || 0;
        var pct = Math.max(4, Math.round(votos / maxVotos * 100));
        var chips = el('div', { class: 'rankchips' });
        (t.tags || []).forEach(function (tag) { chips.appendChild(el('span', { class: 'tag2', text: tag })); });
        if (t.dificuldade) chips.appendChild(el('span', { class: 'chip dif-' + t.dificuldade, text: DIFICULDADE_LABEL[t.dificuldade] || t.dificuldade }));
        var nameEl = append(el('div', { class: 'rankname' }), icon(t.escolhido ? 'check' : 'target'), document.createTextNode(t.titulo || ''));
        var head = append(el('div', { class: 'rankhead' }), nameEl, chips);
        var fill = el('div', { class: 'rankfill' }); fill.style.width = pct + '%';
        var bar = append(el('div', { class: 'rankbar' }), fill);
        var barrow = append(el('div', { class: 'rankbarrow' }), bar, el('div', { class: 'rankn', text: votos + (votos === 1 ? ' voto' : ' votos') }));
        var row = append(el('div', { class: 'rankrow' + (t.escolhido ? ' chosen' : '') }), head, t.desc ? el('p', { class: 'rankdesc', text: t.desc }) : null, barrow);
        rankEl.appendChild(row);
      });
    }

    var notasEl = document.getElementById('ideiasNotas');
    if (notasEl) notasEl.textContent = ideias.notasPlanejamento || '';
  }

  /* ================= página: Orçamento ================= */
  function orcToNum(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  // paleta categórica dedicada ao gráfico (validada com o skill de dataviz
  // contra o fundo do cartão, --card): ordem fixa, nunca ciclada. Além da
  // 7ª categoria as fatias somam em "Outras categorias" com uma cor neutra
  // reservada — ver comentário em assets/style.css.
  var PIE_COLORS = ['var(--cat1)', 'var(--cat2)', 'var(--cat3)', 'var(--cat4)', 'var(--cat5)', 'var(--cat6)', 'var(--cat7)'];
  var PIE_OTHER_COLOR = 'var(--catout)';
  function polarPoint(cx, cy, r, angleDeg) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function donutSegmentPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
    var so = polarPoint(cx, cy, rOuter, endAngle);
    var eo = polarPoint(cx, cy, rOuter, startAngle);
    var si = polarPoint(cx, cy, rInner, startAngle);
    var ei = polarPoint(cx, cy, rInner, endAngle);
    var large = (endAngle - startAngle) > 180 ? 1 : 0;
    return ['M', so.x, so.y,
      'A', rOuter, rOuter, 0, large, 0, eo.x, eo.y,
      'L', si.x, si.y,
      'A', rInner, rInner, 0, large, 1, ei.x, ei.y, 'Z'].join(' ');
  }
  function renderOrcPie(catOrder, catMap, fmtMoeda) {
    var wrap = document.getElementById('orcPieWrap');
    if (!wrap) return;
    clear(wrap);
    var slices = [];
    catOrder.forEach(function (cat, i) {
      var v = catMap[cat].previsto;
      if (v <= 0) return;
      if (i < 7) slices.push({ label: cat, value: v, color: PIE_COLORS[i] });
      else {
        var other = slices[slices.length - 1];
        if (!other || other.label.indexOf('Outras categorias') !== 0) {
          other = { label: 'Outras categorias', value: 0, color: PIE_OTHER_COLOR };
          slices.push(other);
        }
        other.value += v;
      }
    });
    var total = slices.reduce(function (s, x) { return s + x.value; }, 0);
    if (!slices.length || total <= 0) {
      wrap.appendChild(append(el('div', { class: 'pie-empty' }), icon('alert'),
        el('span', { text: 'Nenhum valor previsto lançado ainda — adicione valores aos itens no painel para ver o gráfico por categoria.' })));
      return;
    }

    var cx = 100, cy = 100, rOuter = 90, rInner = 54;
    var gapDeg = slices.length > 1 ? 2.2 : 0;
    var svg = svgEl('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': 'Gráfico de pizza: orçamento previsto por categoria' });
    var legend = el('div', { class: 'pielegend' });
    var start = 0;
    slices.forEach(function (s, i) {
      var span = s.value / total * 360;
      var end = start + span;
      var ds = start + gapDeg / 2, de = end - gapDeg / 2;
      if (de <= ds) de = ds + 0.01;
      var path = svgEl('path', { class: 'pieseg', d: donutSegmentPath(cx, cy, rOuter, rInner, ds, de), 'data-idx': i });
      path.style.fill = s.color;
      var pct = Math.round(s.value / total * 1000) / 10;
      var titleTxt = s.label + ' — ' + fmtMoeda(s.value) + ' (' + pct + '%)';
      path.appendChild(svgEl('title')).textContent = titleTxt;
      svg.appendChild(path);

      var row = el('div', { class: 'pielegend-row', 'data-idx': i, tabindex: '0' });
      var sw = el('span', { class: 'pieswatch' }); sw.style.background = s.color;
      append(row, sw, el('span', { class: 'pielegend-cat', text: s.label }),
        el('span', { class: 'pielegend-val', text: fmtMoeda(s.value) }),
        el('span', { class: 'pielegend-pct', text: pct + '%' }));
      function setHi(on) {
        row.classList.toggle('hi', on);
        path.classList.toggle('hi', on);
      }
      path.addEventListener('mouseenter', function () { setHi(true); });
      path.addEventListener('mouseleave', function () { setHi(false); });
      row.addEventListener('mouseenter', function () { setHi(true); });
      row.addEventListener('mouseleave', function () { setHi(false); });
      legend.appendChild(row);
      start = end;
    });

    var chartBox = el('div', { class: 'piechart' });
    chartBox.appendChild(svg);
    var center = append(el('div', { class: 'piecenter' }),
      el('b', { text: fmtMoeda(total) }), el('span', { text: 'previsto por categoria' }));
    chartBox.appendChild(center);
    append(wrap, chartBox, legend);
  }
  function renderOrcamento(data) {
    var orc = data.orcamento || {};
    var itens = orc.itens || [];
    var moeda = orc.moeda || 'R$';
    function fmtMoeda(n) { return moeda + ' ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    var totalPrevisto = 0, totalGasto = 0;
    itens.forEach(function (it) { totalPrevisto += orcToNum(it.previsto); totalGasto += orcToNum(it.gasto); });
    var saldo = totalPrevisto - totalGasto;

    var kpiEl = document.getElementById('orcKpis');
    if (kpiEl) {
      clear(kpiEl);
      var kpis = [
        { value: fmtMoeda(totalPrevisto), label: 'orçado / previsto' },
        { value: fmtMoeda(totalGasto), label: 'gasto até agora' },
        { value: fmtMoeda(saldo), label: saldo >= 0 ? 'saldo disponível' : 'estourou o previsto' },
        { value: String(itens.length), label: itens.length === 1 ? 'item lançado' : 'itens lançados' }
      ];
      kpis.forEach(function (k) { kpiEl.appendChild(append(el('div', { class: 'stat' }), el('b', { text: k.value }), el('span', { text: k.label }))); });
    }

    var bodyEl = document.getElementById('orcItensBody');
    if (bodyEl) {
      clear(bodyEl);
      itens.forEach(function (it) {
        var statusTd = append(el('td'), it.statusText ? el('span', { class: 'chip' + (it.statusClass ? ' ' + it.statusClass : ''), text: it.statusText }) : null);
        bodyEl.appendChild(append(el('tr'),
          el('td', { text: it.categoria || '' }),
          el('td', { text: it.descricao || '' }),
          el('td', { text: fmtMoeda(orcToNum(it.previsto)) }),
          el('td', { text: fmtMoeda(orcToNum(it.gasto)) }),
          statusTd,
          el('td', { text: it.fornecedor || '' })));
      });
      if (!itens.length) bodyEl.appendChild(append(el('tr'), el('td', { text: 'Nenhum item lançado ainda.', colspan: '6' })));
    }

    var catOrder = [], catMap = {};
    itens.forEach(function (it) {
      var cat = it.categoria || 'Sem categoria';
      if (!catMap[cat]) { catMap[cat] = { previsto: 0, gasto: 0 }; catOrder.push(cat); }
      catMap[cat].previsto += orcToNum(it.previsto);
      catMap[cat].gasto += orcToNum(it.gasto);
    });
    var catEl = document.getElementById('orcCategoriasBody');
    if (catEl) {
      clear(catEl);
      catOrder.forEach(function (cat) {
        var c = catMap[cat];
        catEl.appendChild(append(el('tr'), el('td', { text: cat }), el('td', { text: fmtMoeda(c.previsto) }), el('td', { text: fmtMoeda(c.gasto) }), el('td', { text: fmtMoeda(c.previsto - c.gasto) })));
      });
      if (!catOrder.length) catEl.appendChild(append(el('tr'), el('td', { text: 'Nenhum item lançado ainda.', colspan: '4' })));
    }
    renderOrcPie(catOrder, catMap, fmtMoeda);

    var notasEl = document.getElementById('orcNotas');
    if (notasEl) notasEl.textContent = orc.notas || '';
  }

  /* ================= navegação: hambúrguer + "Mais" + link ativo ================= */
  function initNav() {
    var toggle = document.querySelector('.navtoggle');
    var links = document.querySelector('.navlinks');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      links.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { links.classList.remove('open'); });
      });
    }
    var page = document.body.getAttribute('data-page');
    if (page) {
      document.querySelectorAll('.navlinks a[data-page]').forEach(function (a) {
        if (a.getAttribute('data-page') === page) a.classList.add('on');
      });
    }
    // menu suspenso "Mais" (desktop) — os 4 links secundários
    var more = document.querySelector('.navmore');
    var moreBtn = document.querySelector('.navmorebtn');
    if (more && moreBtn) {
      moreBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var open = more.classList.toggle('open');
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (ev) {
        if (!more.contains(ev.target)) {
          more.classList.remove('open');
          moreBtn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') {
          more.classList.remove('open');
          moreBtn.setAttribute('aria-expanded', 'false');
        }
      });
      more.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          more.classList.remove('open');
          moreBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  /* ================= despacho por página ================= */
  document.addEventListener('DOMContentLoaded', function () {
    var data = readData();
    initPasswordGate(data.meta || {});
    renderMeta(data);
    var page = document.body.getAttribute('data-page');
    if (page === 'inicio') renderIndex(data);
    else if (page === 'projeto') renderProjeto(data);
    else if (page === 'transcricoes') renderTranscricoes(data);
    else if (page === 'arquivo') renderArquivo(data);
    else if (page === 'apresentacao') renderApresentacao(data);
    else if (page === 'metricas') renderMetricas(data);
    else if (page === 'ideias') renderIdeias(data);
    else if (page === 'orcamento') renderOrcamento(data);
    initNav();
  });
})();
