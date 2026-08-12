/* Лаб. 3 — виртуальный опыт: диаграмма Бернулли с ваших отсчётов.
 * Принимает ?K=<Па/мВ> из лаб. 1 (тарировка) через querystring. */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const svg = $('v3');
  if (!svg || !window.VL) return;

  /* физика установки */
  const K_IST = 4.25;            // «паспортный» коэффициент датчиков, Па/мВ
  const RHO = 1.184, NU = 15.06e-6, D = 0.096, MU = 0.4, G = 9.81;
  const S = Math.PI * D * D / 4; // 0,00724 м²
  const DPV0 = 490;              // перепад на Вентури при режиме 100 %, Па
  /* профиль давления натурного опыта (режим 100 %) и координаты штуцеров */
  const PTS = [
    { X: 1735, P: 452 }, { X: 3235, P: 408 }, { X: 4435, P: 375 },
    { X: 5135, P: 111 }, { X: 6785, P: 82 }, { X: 9035, P: 0 },
  ];
  PTS.forEach(p => { p.px = 190 + (p.X - 1600) * 415 / 7600; });
  const H_REP = PTS.map(p => p.P / (RHO * G));      // отчётные h при 100 %

  /* тарировочный коэффициент: из URL (лаб. 1) или отчётный */
  let K = 4.3, kFromUrl = false;
  const kq = parseFloat(VL.qget('K'));
  if (isFinite(kq) && kq > 2 && kq < 8) { K = kq; kFromUrl = true; }

  /* состояние */
  let sel = 0;                  // выбранный штуцер
  let locked = false;           // режим зафиксирован после первого отсчёта
  let fanA = 0, dashOff = 0;
  const m1 = VL.meter(0.15, 0.25), m2 = VL.meter(0.15, 0.25);
  let u1Out = 0, u2Out = 0;
  const rows = new Map();       // X → {X, u1, u2}

  const regime = () => $('v3r').value / 100;

  /* --- штуцеры --- */
  const tapsG = $('v3taps');
  PTS.forEach((p, i) => {
    const g = VL.el('g', { class: 'tap' }, tapsG);
    VL.el('line', { x1: p.px, y1: 188, x2: p.px, y2: 196, stroke: '#155e75', 'stroke-width': 1.6 }, g);
    VL.el('circle', { class: 'dot', cx: p.px, cy: 185, r: 3, fill: '#155e75' }, g);
    VL.el('circle', { class: 'hit', cx: p.px, cy: 186, r: 11 }, g);
    const n = VL.el('text', { x: p.px, y: 176, 'text-anchor': 'middle',
      style: 'font:10px system-ui;fill:#6b6b74' }, g);
    n.textContent = String(i + 1);
    const t = VL.el('title', {}, g);
    t.textContent = 'штуцер ' + (i + 1) + ': X = ' + p.X + ' мм';
    g.addEventListener('click', () => { sel = i; drawSel(); });
  });
  const selRing = VL.el('circle', { cx: 0, cy: 185, r: 6.5, fill: 'none',
    stroke: '#b3382e', 'stroke-width': 1.8 }, tapsG);
  function drawSel() {
    const p = PTS[sel];
    selRing.setAttribute('cx', p.px);
    $('v3link').setAttribute('d',
      `M 472 116 L 472 140 L ${p.px.toFixed(1)} 140 L ${p.px.toFixed(1)} 182`);
  }
  drawSel();

  /* --- анимация --- */
  VL.loop(function (dt) {
    const r = regime();
    const v = 11.5 * r;
    fanA = (fanA + dt * r * 600) % 360;
    $('v3fan').setAttribute('transform', `rotate(${fanA.toFixed(1)} 68 215)`);
    dashOff -= dt * v * 8;
    [...$('v3flow').children].forEach((ln, i) => {
      ln.style.strokeDashoffset = ((dashOff % 46) - i * 8) + 'px';
    });

    u1Out = m1.tick(dt, DPV0 * r * r / K_IST, x => x * (1 + VL.noise(0.02)));
    u2Out = m2.tick(dt, PTS[sel].P * r * r / K_IST, x => x * (1 + VL.noise(0.02)) + VL.noise(0.3));
    $('v3t1').textContent = VL.fm(u1Out, 1) + ' мВ';
    $('v3t2').textContent = VL.fm(u2Out, 1) + ' мВ';
    const P2 = u2Out * K;
    $('v3md').textContent = VL.fm(P2, 0) + ' Па';
    $('v3d2').textContent = `Д.Д.2 — шт. ${sel + 1} (X = ${PTS[sel].X} мм): ` +
      VL.fm(u2Out, 1) + ' мВ → ' + VL.fm(P2, 0) + ' Па';
    const ang = Math.max(-50, Math.min(50, -50 + (u2Out / 130) * 100));
    $('v3needle').setAttribute('transform', `rotate(${ang.toFixed(1)} 578 40)`);
  });

  /* --- плашка о переданном K --- */
  function renderPass() {
    const box = $('v3pass');
    $('v3kb').textContent = 'K = ' + VL.fm(K, 2) + ' Па/мВ' + (kFromUrl ? ' (ваш)' : ' (отчёт)');
    if (kFromUrl) {
      box.innerHTML = '<div class="virt-pass"><span>Данные переданы из ' +
        '<a href="lab1#virt">лаб. 1 (тарировка)</a>: <b>K = ' + VL.fm(K, 2) +
        ' Па/мВ — из вашей тарировки</b>; все показания датчиков ниже переводятся ' +
        'в паскали с этим коэффициентом.</span> ' +
        '<button type="button" class="btn" id="v3kdrop">сбросить</button></div>';
      $('v3kdrop').addEventListener('click', () => {
        VL.qdel('K'); K = 4.3; kFromUrl = false; renderPass(); render();
      });
    } else {
      box.innerHTML = '<div class="virt-hint">Перевод мВ → Па идёт с отчётным K = 4,30 Па/мВ. ' +
        'Хотите со своим — <a href="lab1#virt">снимите тарировку в лаб. 1</a> и вернитесь по кнопке «использовать этот K».</div>';
    }
  }
  renderPass();

  /* --- отсчёты и обработка --- */
  function snap() {
    const p = PTS[sel];
    rows.set(p.X, { X: p.X, u1: Math.round(u1Out * 10) / 10, u2: Math.round(u2Out * 10) / 10 });
    if (!locked) { locked = true; $('v3r').disabled = true; }
    render();
  }

  function reset() {
    rows.clear(); locked = false; $('v3r').disabled = false; render();
    $('v3hint').textContent = 'Виртуальные данные очищены — на странице действуют данные отчёта. Режим снова можно менять.';
  }

  function render() {
    const out = $('v3out');
    if (!rows.size) { out.innerHTML = ''; return; }
    const rs = [...rows.values()].sort((a, b) => a.X - b.X);
    const r = regime();

    /* скорость — из среднего показания Д.Д.1 по снятым точкам */
    const u1m = rs.reduce((s, x) => s + x.u1, 0) / rs.length;
    const dPv = u1m * K;
    const Q = MU * S * Math.sqrt(2 * dPv / RHO);
    const v = Q / S;
    const hv = v * v / (2 * G);
    const Re = v * D / NU;

    const val = x => { const P = x.u2 * K, h = P / (RHO * G); return { P, h, H: h + hv }; };
    const by = X => { const x = rows.get(X); return x ? val(x) : null; };

    let html = `<h3>Таблица сечений вашего опыта (режим ${$('v3r').value} %)</h3>` +
      '<table class="data"><tr><th>i</th><th>X, мм</th><th>u₂, мВ</th><th>P<sub>изб</sub> = u₂·K, Па</th>' +
      '<th>h = P/(ρg), м</th><th>H = h + v²/2g, м</th></tr>';
    rs.forEach((x, i) => {
      const w = val(x);
      html += `<tr><td>${i + 1}</td><td>${x.X}</td><td>${VL.fm(x.u2, 1)}</td>` +
        `<td>${VL.fm(w.P, 0)}</td><td>${VL.fm(w.h, 1)}</td><td>${VL.fm(w.H, 1)}</td></tr>`;
    });
    html += '</table>';

    /* решение по шагам — тот же формат, что и в отчётной части */
    html += '<h3>Решение по шагам (ваши данные)</h3><div class="panel steps">';
    html += VL.step('\\(\\Delta P_{\\text{В}} = u_1\\cdot K\\)',
      `\\(${VL.lm(u1m, 1)}\\cdot ${VL.lm(K, 2)}\\)`, `\\(${VL.lm(dPv, 0)}\\) Па`);
    html += VL.step('\\(Q = \\mu S\\sqrt{2\\Delta P_{\\text{В}}/\\rho}\\)',
      `\\(0{,}4\\cdot 0{,}0072\\cdot\\sqrt{2\\cdot ${VL.lm(dPv, 0)}/1{,}184}\\)`,
      `\\(${VL.lm(Q, 3)}\\) м³/с`);
    html += VL.step('\\(v_{\\text{ср}} = Q/S\\)',
      `\\(${VL.lm(Q, 3)}/0{,}0072\\)`, `\\(${VL.lm(v, 1)}\\) м/с`);
    html += VL.step('\\(v^2/2g\\)',
      `\\(${VL.lm(v, 1)}^2/(2\\cdot 9{,}81)\\)`, `\\(${VL.lm(hv, 2)}\\) м`);
    html += VL.step('\\(\\mathrm{Re} = vD/\\nu\\)',
      `\\(${VL.lm(v, 1)}\\cdot 0{,}096/(15{,}06\\cdot 10^{-6})\\)`,
      `\\(${VL.fgi(Re)}\\)` + (Re > 4000 ? ' — турбулентный режим' : ''));
    const w1 = by(1735), w3 = by(4435), w4 = by(5135), w6 = by(9035);
    if (w3 && w4) {
      const HM = w3.H - w4.H, z = HM * 2 * G / (v * v);
      html += VL.step('\\(H_{\\text{М}} = H_3 - H_4\\)',
        `\\(${VL.lm(w3.H, 1)} - ${VL.lm(w4.H, 1)}\\)`, `\\(${VL.lm(HM, 1)}\\) м`);
      html += VL.step('\\(\\zeta = H_{\\text{М}}\\cdot 2g/v^2\\)',
        `\\(${VL.lm(HM, 1)}/${VL.lm(hv, 2)}\\)`, `\\(${VL.lm(z, 1)}\\)`);
    }
    if (w1 && w3) {
      const Hl = w1.h - w3.h, L = 2.7, lam = Hl * 2 * G * D / (v * v * L);
      html += VL.step('\\(\\lambda_1 = H_{l1}\\cdot 2g\\cdot D/(v^2 L_1)\\)',
        `\\((${VL.lm(w1.h, 1)} - ${VL.lm(w3.h, 1)})\\cdot 0{,}096/(${VL.lm(hv, 2)}\\cdot 2{,}7)\\)`,
        `\\(${VL.lm(lam, 3)}\\)`);
    }
    if (w4 && w6) {
      const Hl = w4.h - w6.h, L = 3.9, lam = Hl * 2 * G * D / (v * v * L);
      html += VL.step('\\(\\lambda_2 = H_{l2}\\cdot 2g\\cdot D/(v^2 L_2)\\)',
        `\\((${VL.lm(w4.h, 1)} - ${VL.lm(w6.h, 1)})\\cdot 0{,}096/(${VL.lm(hv, 2)}\\cdot 3{,}9)\\)`,
        `\\(${VL.lm(lam, 3)}\\)`);
    }
    html += '</div>';

    const missing = [];
    if (!w3 || !w4) missing.push('для ζ — штуцеры 3 и 4');
    if (!w1 || !w3) missing.push('для λ₁ — штуцеры 1 и 3');
    if (!w4 || !w6) missing.push('для λ₂ — штуцеры 4 и 6');
    if (missing.length)
      html += '<div class="virt-hint">Чтобы досчитать коэффициенты, снимите: ' + missing.join('; ') + '.</div>';

    html += '<h3>Ваша диаграмма Бернулли</h3><div id="v3chart"></div>' +
      '<p class="small">Серым пунктиром — линии натурного отчёта (режим 100 %); ' +
      'цветом — ваши точки: <span style="color:#155e75"><b>h</b></span> — пьезометрическая, ' +
      '<span style="color:#b3382e"><b>H</b></span> — полный напор.</p>';

    out.innerHTML = html;

    /* график */
    const chart = VL.el('svg', { viewBox: '0 0 640 300', class: 'geo-board', style: 'max-width:640px' });
    $('v3chart').appendChild(chart);
    const maxH = Math.max(...rs.map(x => val(x).H), 6.74 + Math.max(...H_REP));
    const ymax = Math.max(10, Math.ceil(maxH * 1.12 / 10) * 10);
    const ax = VL.axes(chart, {
      x0: 70, y0: 250, x1: 600, y1: 30, xmin: 1500, xmax: 9200, ymin: 0, ymax,
      xticks: PTS.map(p => ({ v: p.X, label: String(p.X) })),
      yticks: Array.from({ length: ymax / 10 + 1 }, (_, i) => ({ v: i * 10, label: String(i * 10) })),
      xlab: 'X, мм', ylab: 'напор, м',
    });
    /* отчётные линии (100 %) — пунктиром */
    for (const [vals, off] of [[H_REP, 6.74], [H_REP, 0]]) {
      VL.el('polyline', {
        points: PTS.map((p, i) => ax.X(p.X).toFixed(1) + ',' + ax.Y(Math.min(ymax, vals[i] + off)).toFixed(1)).join(' '),
        fill: 'none', stroke: '#6b6b74', 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.7,
      }, chart);
    }
    VL.series(chart, rs.map(x => [ax.X(x.X), ax.Y(val(x).h)]), '#155e75',
      rs.map(x => `X=${x.X}: h=${VL.fm(val(x).h, 1)} м`));
    VL.series(chart, rs.map(x => [ax.X(x.X), ax.Y(val(x).H)]), '#b3382e',
      rs.map(x => `X=${x.X}: H=${VL.fm(val(x).H, 1)} м`));

    VL.mathify(out);
    $('v3hint').textContent = locked
      ? `Режим зафиксирован (${$('v3r').value} %) на время серии — «вернуть данные отчёта» разблокирует его. Снято сечений: ${rs.length} из 6.`
      : 'Выберите штуцер и снимайте отсчёты.';
  }

  $('v3snap').addEventListener('click', snap);
  $('v3reset').addEventListener('click', reset);
  $('v3r').addEventListener('input', () => { $('v3rv').textContent = $('v3r').value + ' %'; });
})();
