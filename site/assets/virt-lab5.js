/* Лаб. 5 — виртуальная съёмка эпюры Cp(x) по телу вращения. */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const svg = $('v5');
  if (!svg || !window.VL) return;

  const RHO = 1.2, Q = 354;                 // скоростной напор, Па (как в отчёте)
  const VINF = Math.sqrt(2 * Q / RHO);      // 24,3 м/с
  /* дренажные точки: x мм, координаты на схеме, «истинный» Cp модели
   * (исправная носовая точка: Cp≈+1 в критической точке) и отчётный Cp */
  const PTS = [
    { x: 0,    sx: 90,  sy: 115, cp: 0.99,  rep: 0.014 },
    { x: 2,    sx: 94,  sy: 95,  cp: 0.66,  rep: 0.271 },
    { x: 5,    sx: 100, sy: 79,  cp: 0.44,  rep: 0.593 },
    { x: 12.5, sx: 115, sy: 63,  cp: 0.08,  rep: 0 },
    { x: 22,   sx: 134, sy: 51,  cp: -0.22, rep: -0.220 },
    { x: 44,   sx: 178, sy: 35,  cp: -0.43, rep: -0.432 },
    { x: 66.5, sx: 223, sy: 29,  cp: -0.50, rep: -0.506 },
    { x: 88,   sx: 266, sy: 29,  cp: -0.34, rep: -0.025 },
    { x: 109,  sx: 308, sy: 35,  cp: -0.20, rep: -0.048 },
    { x: 131,  sx: 352, sy: 45,  cp: -0.11, rep: -0.062 },
    { x: 153,  sx: 396, sy: 58,  cp: -0.06, rep: -0.011 },
    { x: 175,  sx: 440, sy: 73,  cp: -0.03, rep: -0.011 },
    { x: 197,  sx: 484, sy: 93,  cp: -0.01, rep: -0.011 },
    { x: 220,  sx: 530, sy: 115, cp: 0.04,  rep: -0.011 },
  ];

  let sel = 0, dashOff = 0;
  const pm = VL.meter(0.15, 0.3);
  let pOut = 0;
  const rows = new Map(); // index → {i, P}

  /* кликабельные точки */
  const taps = $('v5taps');
  PTS.forEach((p, i) => {
    const g = VL.el('g', { class: 'tap' }, taps);
    VL.el('circle', { class: 'dot', cx: p.sx, cy: p.sy, r: 2.8, fill: '#b3382e' }, g);
    VL.el('circle', { class: 'hit', cx: p.sx, cy: p.sy, r: 10 }, g);
    const t = VL.el('title', {}, g);
    t.textContent = 'т.' + (i + 1) + ': x = ' + String(p.x).replace('.', ',') + ' мм';
    g.addEventListener('click', () => { sel = i; drawSel(); });
  });
  const selRing = VL.el('circle', { cx: 0, cy: 0, r: 6.5, fill: 'none',
    stroke: '#1a7f37', 'stroke-width': 1.8 }, taps);
  function drawSel() {
    const p = PTS[sel];
    selRing.setAttribute('cx', p.sx);
    selRing.setAttribute('cy', p.sy);
    const midY = Math.min(20, p.sy - 8);
    $('v5link').setAttribute('d',
      `M ${p.sx} ${p.sy} L ${p.sx} ${midY} L 496 ${midY} L 496 29 L 500 29`);
  }
  drawSel();

  VL.loop(function (dt) {
    dashOff -= dt * 60;
    [...$('v5flow').children].forEach((ln, i) => {
      ln.style.strokeDashoffset = ((dashOff % 36) - i * 6) + 'px';
    });
    const p = PTS[sel];
    pOut = pm.tick(dt, p.cp * Q, x => x * (1 + VL.noise(0.02)) + VL.noise(2));
    const s = (pOut >= 0 ? '+' : '−') + VL.fm(Math.abs(pOut), 0) + ' Па';
    $('v5pt').textContent = s;
    $('v5pr').textContent = `точка ${sel + 1} (x = ${String(p.x).replace('.', ',')} мм): P − P∞ = ${s}`;
  });

  function snap() {
    rows.set(sel, { i: sel, P: Math.round(pOut) });
    render();
  }
  function reset() {
    rows.clear(); render();
    $('v5hint').textContent = 'Виртуальные данные очищены — на странице действуют данные отчёта.';
  }

  function render() {
    const out = $('v5out');
    if (!rows.size) { out.innerHTML = ''; return; }
    const rs = [...rows.values()].sort((a, b) => a.i - b.i);

    let html = '<h3>Журнал вашего опыта</h3><table class="data">' +
      '<tr><th>точка</th><th>x, мм</th><th>P − P∞, Па</th><th>C<sub>p</sub> = (P − P∞)/q</th></tr>';
    rs.forEach(r => {
      const p = PTS[r.i];
      html += `<tr><td>${r.i + 1}</td><td>${String(p.x).replace('.', ',')}</td>` +
        `<td>${r.P}</td><td><b>${VL.fm(r.P / Q, 3)}</b></td></tr>`;
    });
    html += '</table>';

    const last = rs[rs.length - 1], lp = PTS[last.i];
    html += '<h3>Решение по шагам (ваши данные)</h3><div class="panel steps">';
    html += VL.step('\\(v_\\infty = \\sqrt{2\\Delta P_{\\text{ср}}/\\rho}\\)',
      '\\(\\sqrt{2\\cdot 354/1{,}2}\\)', `\\(${VL.lm(VINF, 1)}\\) м/с`);
    html += VL.step('\\(q = 0{,}5\\rho v_\\infty^2\\)',
      `\\(0{,}5\\cdot 1{,}2\\cdot ${VL.lm(VINF, 1)}^2\\)`, '\\(354\\) Па');
    html += VL.step(`\\(C_p\\) (точка ${last.i + 1}, x = ${VL.lm(lp.x, lp.x % 1 ? 1 : 0)} мм) \\(= (P - P_\\infty)/q\\)`,
      `\\(${last.P < 0 ? '(' + VL.lm(last.P, 0) + ')' : VL.lm(last.P, 0)}/354\\)`,
      `\\(${VL.lm(last.P / Q, 2)}\\)`);
    html += '</div>';

    if (rows.has(0)) {
      const cp0 = rows.get(0).P / Q;
      html += `<div class="note tip"><b>Носовая точка у вас исправна:</b> C<sub>p</sub>(0) = ${VL.fm(cp0, 2)} — ` +
        'близко к +1, как и положено в критической точке. В натурном отчёте она показала лишь 0,014: ' +
        'дренажное отверстие модели, судя по всему, было засорено.</div>';
    }

    html += '<h3>Ваша эпюра C<sub>p</sub>(x)</h3><div id="v5chart"></div>' +
      '<p class="small">Серым пунктиром — эпюра натурного отчёта, ' +
      '<span style="color:#1a7f37"><b>зелёным</b></span> — ваши точки.</p>';
    out.innerHTML = html;

    const chart = VL.el('svg', { viewBox: '0 0 640 300', class: 'geo-board', style: 'max-width:640px' });
    $('v5chart').appendChild(chart);
    const ax = VL.axes(chart, {
      x0: 70, y0: 262, x1: 598, y1: 26, xmin: 0, xmax: 220, ymin: -0.6, ymax: 1.1,
      xticks: [50, 100, 150, 200].map(v => ({ v, label: String(v) })),
      yticks: [-0.5, 0, 0.5, 1.0].map(v => ({ v, label: (v > 0 ? '+' : '') + VL.fm(v, 1).replace('-', '−') })),
      xlab: 'x, мм', ylab: 'Cp',
    });
    VL.el('line', { x1: 70, y1: ax.Y(0), x2: 598, y2: ax.Y(0), stroke: '#16161a', 'stroke-width': 1.2 }, chart);
    VL.el('polyline', {
      points: PTS.map(p => ax.X(p.x).toFixed(1) + ',' + ax.Y(p.rep).toFixed(1)).join(' '),
      fill: 'none', stroke: '#6b6b74', 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.75,
    }, chart);
    VL.series(chart,
      rs.map(r => [ax.X(PTS[r.i].x), ax.Y(r.P / Q)]), '#1a7f37',
      rs.map(r => `т.${r.i + 1}: x=${String(PTS[r.i].x).replace('.', ',')}, Cp=${VL.fm(r.P / Q, 2)}`));

    VL.mathify(out);
    $('v5hint').textContent = 'Снято точек: ' + rs.length + ' из 14.' +
      (rs.length < 14 ? ' Продолжайте обход контура.' : ' Эпюра полная!');
  }

  {
    VL.auto({
      autoBtn: 'v5auto', stopBtn: 'v5stop',
      lockIds: ['v5snap', 'v5reset'],
      total: () => PTS.length,
      progress: (i, n) => {
        const p = $('v5prog'); p.style.display = ''; p.textContent = `точка ${i} из ${n}`;
      },
      step: async (i, ctl) => {
        if (i === 0) rows.clear();
        sel = i; drawSel();
        await ctl.sleep(520);            // переключение трубки и успокоение манометра
        if (!ctl.aborted()) snap();
      },
      onFinish: (aborted, done, n) => {
        $('v5prog').style.display = 'none';
        $('v5hint').textContent = aborted
          ? `Прогон остановлен: снято ${done} из ${n} точек.`
          : 'Все четырнадцать дренажных точек обойдены — ниже ваша эпюра Cp(x).';
      },
    });
  }

  $('v5snap').addEventListener('click', snap);
  $('v5reset').addEventListener('click', reset);
})();
