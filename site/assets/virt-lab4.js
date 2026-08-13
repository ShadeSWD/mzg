/* Лаб. 4 — виртуальная продувка шара: R(V) с весов → Cx(Re). */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const svg = $('v4');
  if (!svg || !window.VL) return;

  const RHO = 1.196, NU = 1.492e-5, D = 0.09;
  const S = Math.PI * D * D / 4;                 // 6,36·10⁻³ м²
  /* гладкая кривая Cx(Re) по исправленным данным практикума */
  const cxTrue = Re => 0.395 + 4.6 / Math.pow(Re, 0.32);
  const rTrue = V => {
    const Re = D * V / NU;
    return cxTrue(Re) * 0.5 * RHO * V * V * S;
  };
  /* точки натурного опыта для подложки графика */
  const REPORT = [
    [21700, 1.52], [36800, 0.83], [46400, 0.47], [60300, 0.55], [73000, 0.53],
    [80200, 0.63], [95300, 0.56], [110400, 0.51], [124900, 0.53],
  ];

  const rm = VL.meter(0.15, 0.3);
  let rOut = 0, dashOff = 0, wakePhase = 0;
  const rows = new Map(); // V(окр. до 0,1) → {V, R}

  const vNow = () => parseFloat($('v4v').value);

  VL.loop(function (dt, t) {
    const V = vNow();
    const k = V / 21;
    dashOff -= dt * V * 7;
    [...$('v4flow').children].forEach((ln, i) => {
      ln.style.strokeDashoffset = ((dashOff % 52) - i * 9) + 'px';
    });

    /* след: волнистые линии за шаром, интенсивнее с ростом V */
    wakePhase += dt * (2 + 10 * k);
    const wake = $('v4wake');
    while (wake.firstChild) wake.removeChild(wake.firstChild);
    const len = 40 + 130 * k;
    wake.setAttribute('opacity', (0.25 + 0.6 * k).toFixed(2));
    [-14, 0, 14].forEach((dy, j) => {
      let d = '';
      for (let s = 0; s <= 8; s++) {
        const x = 368 + (len * s) / 8;
        const amp = (1.5 + 7 * k) * (s / 8);
        const y = 128 + dy + amp * Math.sin(wakePhase * 2 + s * 0.9 + j * 2.1);
        d += (s ? ' L ' : 'M ') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      VL.el('path', { d, 'stroke-dasharray': '4 3' }, wake);
    });

    /* весы: шум ±3 % + дрожь мелких сил */
    rOut = rm.tick(dt, rTrue(V), x => x * (1 + VL.noise(0.03)) + VL.noise(0.002));
    const rStr = 'R = ' + VL.fm(Math.max(0, rOut), 3) + ' Н';
    $('v4rt').textContent = rStr;
    $('v4rr').textContent = rStr;
    const ang = Math.max(-45, Math.min(45, -45 + rOut / 0.9 * 90));
    $('v4needle').setAttribute('transform', `rotate(${ang.toFixed(1)} 303 224)`);
    $('v4vt').textContent = 'V = ' + VL.fm(V, 1) + ' м/с';
    $('v4qt').textContent = 'q = ' + VL.fm(0.5 * RHO * V * V, 0) + ' Па';
  });

  function snap() {
    const V = Math.round(vNow() * 10) / 10;
    rows.set(V, { V, R: Math.max(0, Math.round(rOut * 1000) / 1000) });
    render();
  }
  function reset() {
    rows.clear(); render();
    $('v4hint').textContent = 'Виртуальные данные очищены — на странице действуют учебный пример.';
  }

  function render() {
    const out = $('v4out');
    if (!rows.size) { out.innerHTML = ''; return; }
    const rs = [...rows.values()].sort((a, b) => a.V - b.V);
    const calc = p => {
      const Re = D * p.V / NU, q = 0.5 * RHO * p.V * p.V;
      return { Re, q, Cx: p.R / (q * S) };
    };

    let html = '<h3>Журнал вашего опыта</h3><table class="data">' +
      '<tr><th>i</th><th>V, м/с</th><th>R, Н</th><th>Re</th><th>q = 0,5ρV², Па</th><th>C<sub>x</sub></th></tr>';
    rs.forEach((p, i) => {
      const w = calc(p);
      html += `<tr><td>${i + 1}</td><td>${VL.fm(p.V, 1)}</td><td>${VL.fm(p.R, 3)}</td>` +
        `<td>${VL.fgi(w.Re)}</td><td>${VL.fm(w.q, 1)}</td><td><b>${VL.fm(w.Cx, 2)}</b></td></tr>`;
    });
    html += '</table>';

    const last = rs[rs.length - 1], wl = calc(last);
    html += '<h3>Решение по шагам (последняя точка, V = ' + VL.fm(last.V, 1) + ' м/с)</h3>' +
      '<div class="panel steps">';
    html += VL.step('\\(\\mathrm{Re} = DV/\\nu\\)',
      `\\(0{,}09\\cdot ${VL.lm(last.V, 1)}/(1{,}492\\cdot 10^{-5})\\)`,
      `\\(${VL.fgi(wl.Re)}\\)`);
    html += VL.step('\\(q = 0{,}5\\rho V^2\\)',
      `\\(0{,}5\\cdot 1{,}196\\cdot ${VL.lm(last.V, 1)}^2\\)`,
      `\\(${VL.lm(wl.q, 1)}\\) Па`);
    html += VL.step('\\(C_x = R/(q\\cdot S)\\)',
      `\\(${VL.lm(last.R, 3)}/(${VL.lm(wl.q, 1)}\\cdot 6{,}36\\cdot 10^{-3})\\)`,
      `\\(${VL.lm(wl.Cx, 2)}\\)`);
    html += '</div>';

    html += '<h3>Ваши точки на кривой C<sub>x</sub>(Re)</h3><div id="v4chart"></div>' +
      '<p class="small">Серые кружки — точки натурного опыта, ' +
      '<span style="color:#1a7f37"><b>зелёные</b></span> — ваши. В докритической ' +
      'области точки должны держаться около C<sub>x</sub> ≈ 0,5.</p>';
    out.innerHTML = html;

    const chart = VL.el('svg', { viewBox: '0 0 640 280', class: 'geo-board', style: 'max-width:640px' });
    $('v4chart').appendChild(chart);
    const ax = VL.axes(chart, {
      x0: 70, y0: 230, x1: 600, y1: 30, xmin: 0, xmax: 130000, ymin: 0, ymax: 1.6,
      xticks: [25000, 50000, 75000, 100000, 125000].map(v => ({ v, label: VL.fgi(v) })),
      yticks: [0, 0.5, 1.0, 1.5].map(v => ({ v, label: VL.fm(v, 1) })),
      xlab: 'Re', ylab: 'Cx',
    });
    VL.el('line', { x1: 70, y1: ax.Y(0.5), x2: 600, y2: ax.Y(0.5),
      stroke: '#1a7f37', 'stroke-width': 1, 'stroke-dasharray': '6 4', opacity: 0.7 }, chart);
    const rep = VL.el('g', { fill: 'none', stroke: '#6b6b74', 'stroke-width': 1.4, opacity: 0.8 }, chart);
    REPORT.forEach(([Re, Cx]) => {
      const c = VL.el('circle', { cx: ax.X(Re).toFixed(1), cy: ax.Y(Cx).toFixed(1), r: 3.2 }, rep);
      const t = VL.el('title', {}, c);
      t.textContent = `натурный опыт: Re=${VL.fgi(Re)}, Cx=${VL.fm(Cx, 2)}`;
    });
    const own = rs.map(p => calc(p));
    VL.series(chart, own.map(w => [ax.X(w.Re), ax.Y(Math.min(1.6, w.Cx))]), '#1a7f37',
      own.map(w => `ваша точка: Re=${VL.fgi(w.Re)}, Cx=${VL.fm(w.Cx, 2)}`));

    VL.mathify(out);
    $('v4hint').textContent = 'Снято точек: ' + rs.length +
      (rs.length < 5 ? ' — для приличной кривой возьмите 5–7 скоростей.' : '. Хорошая серия!');
  }

  {
    const GRID = [4, 6, 8, 10, 12, 14, 16, 18, 20];
    VL.auto({
      autoBtn: 'v4auto', stopBtn: 'v4stop',
      lockIds: ['v4snap', 'v4reset', 'v4v'],
      total: () => GRID.length,
      progress: (i, n) => {
        const p = $('v4prog'); p.style.display = ''; p.textContent = `режим ${i} из ${n}`;
      },
      step: async (i, ctl) => {
        if (i === 0) rows.clear();
        $('v4v').value = GRID[i];
        $('v4v').dispatchEvent(new Event('input'));
        await ctl.sleep(700);            // выход трубы на режим + успокоение весов
        if (!ctl.aborted()) snap();
      },
      onFinish: (aborted, done, n) => {
        $('v4prog').style.display = 'none';
        $('v4hint').textContent = aborted
          ? `Прогон остановлен: снято ${done} из ${n} режимов.`
          : 'Серия из девяти скоростей снята — ниже ваша кривая Cx(Re).';
      },
    });
  }

  $('v4snap').addEventListener('click', snap);
  $('v4reset').addEventListener('click', reset);
  $('v4v').addEventListener('input', () => { $('v4vv').textContent = VL.fm(vNow(), 1) + ' м/с'; });
})();
