/* Лаб. 1 — виртуальная тарировка микроманометра. */
'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const svg = $('v1');
  if (!svg || !window.VL) return;

  /* «паспорт» виртуальной установки */
  const S_PR = 0.007;      // приведённая площадь, м²
  const K_IST = 4.25;      // истинный коэффициент датчика, Па/мВ (в отчёте вышло 4,3)
  const U0 = 709.0;        // нуль датчика, мВ
  const G = 9.81;
  const M_MAX = 70;        // набор гирь, как в отчёте, г
  const UNOISE = 0.5;      // шум датчика, мВ

  /* состояние */
  let masses = [];         // положенные гири, г
  let m = 0;               // суммарная масса, г
  let a = 0, av = 0;       // угол коромысла (°, «+» — чашка вниз) и его скорость
  const TAU = 0.28;        // постоянная времени успокоения, с (переход ~1 с)
  const um = VL.meter(0.15, 0.35);
  let uOut = U0;
  const points = new Map(); // m → {m, u}

  const uTrue = mm => U0 + (mm / 1000) * G / S_PR / K_IST;

  /* --- гири на чашке: стопка пластин --- */
  function drawWeights() {
    const g = $('v1w');
    while (g.firstChild) g.removeChild(g.firstChild);
    let y = 130;
    masses.forEach(w => {
      const h = w === 20 ? 5 : 3.5, wd = w === 20 ? 30 : 24;
      y -= h + 0.8;
      VL.el('rect', { x: 150 - wd / 2, y: y.toFixed(1), width: wd, height: h,
        fill: '#fff', stroke: '#b3382e', 'stroke-width': 1.1 }, g);
    });
  }

  function kick(dm) { av += 1.5 * dm; }

  function addMass(dm) {
    if (m + dm > M_MAX) {
      hint('Больше гирь в наборе нет: максимум ' + M_MAX + ' г (как в отчёте).', true);
      return;
    }
    masses.push(dm); m += dm; kick(dm); drawWeights(); syncButtons();
  }
  function clearMasses() {
    if (!m) return;
    kick(-m); masses = []; m = 0; drawWeights(); syncButtons();
  }
  function syncButtons() {
    $('v1add10').disabled = m + 10 > M_MAX;
    $('v1add20').disabled = m + 20 > M_MAX;
    $('v1rm').textContent = 'm = ' + m + ' г';
  }

  function hint(text, alert) {
    const h = $('v1hint');
    h.textContent = text;
    h.className = 'virt-hint' + (alert ? ' alert' : '');
  }

  /* --- анимация --- */
  VL.loop(function (dt) {
    /* коромысло: критически демпфированный переход к равновесию */
    av += (-2 / TAU * av - a / (TAU * TAU)) * dt;
    a += av * dt;
    if (Math.abs(a) > 4) a = Math.sign(a) * 4;
    const dy = 2.618 * a; /* плечо 150 px */
    $('v1beam').setAttribute('transform', `rotate(${(-a).toFixed(3)} 300 100)`);
    $('v1left').setAttribute('transform', `translate(0 ${dy.toFixed(2)})`);
    $('v1right').setAttribute('transform', `translate(0 ${(-dy).toFixed(2)})`);

    /* датчик: плавный подход + шум с частотой АЦП */
    uOut = um.tick(dt, uTrue(m), v => v + VL.noise(UNOISE));
    const uStr = 'u = ' + VL.fm(uOut, 1) + ' мВ';
    $('v1su').textContent = uStr;
    $('v1ru').textContent = uStr;
    const dp = (um.smooth - U0) * K_IST;
    $('v1sm').textContent = (m ? 'm = ' + m + ' г' : 'гирь нет') +
      ' · ΔP = ' + VL.fm(Math.max(0, dp), 0) + ' Па';
  });

  /* --- отсчёты и обработка --- */
  function snap() {
    const u = Math.round(uOut * 10) / 10;
    points.set(m, { m, u });
    render();
  }

  function render() {
    const out = $('v1out');
    if (!points.size) { out.innerHTML = ''; hint('Снимите нулевой отсчёт (без гирь), затем 3+ отсчёта с гирями.'); return; }
    const rows = [...points.values()].sort((p, q) => p.m - q.m);
    const base = rows[0];
    const loaded = rows.filter(p => p.m > base.m && p.u !== base.u);

    let html = '<h3>Журнал вашего опыта</h3><table class="data"><tr><th>i</th><th>m, г</th>' +
      '<th>ΔP, Па</th><th>u, мВ</th><th>Δu, мВ</th><th>K = ΔP/Δu, Па/мВ</th></tr>';
    rows.forEach((p, i) => {
      const dP = (p.m - base.m) / 1000 * G / S_PR;
      const du = p.u - base.u;
      const k = (p.m > base.m && du !== 0) ? VL.fm(dP / du, 2) : '—';
      html += `<tr><td>${i}</td><td>${p.m}</td><td>${VL.fm(dP, 1)}</td>` +
        `<td>${VL.fm(p.u, 1)}</td><td>${VL.fm(du, 1)}</td><td>${p.m > base.m ? k : '—'}</td></tr>`;
    });
    html += '</table>';
    if (base.m !== 0)
      html += '<div class="virt-hint alert">Нулевой отсчёт не снят — за нуль принята точка с наименьшей гирей (' +
        base.m + ' г). Лучше снять отсчёт без гирь.</div>';

    if (loaded.length >= 3) {
      const ks = loaded.map(p => ((p.m - base.m) / 1000 * G / S_PR) / (p.u - base.u));
      const kAvg = ks.reduce((s, v) => s + v, 0) / ks.length;
      html += '<h3>Решение по шагам (ваши данные)</h3><div class="panel steps">';
      const p1 = loaded[0];
      html += VL.step(
        `\\(\\Delta P_1 = m_1 g/S_{\\text{пр}}\\)`,
        `\\(${VL.lm((p1.m - base.m) / 1000, 2)}\\cdot 9{,}81/0{,}007\\)`,
        `\\(${VL.lm((p1.m - base.m) / 1000 * G / S_PR, 1)}\\) Па`);
      loaded.forEach((p, i) => {
        const dP = (p.m - base.m) / 1000 * G / S_PR;
        const du = p.u - base.u;
        html += VL.step(`\\(K_{${i + 1}} = \\Delta P_{${i + 1}}/\\Delta u_{${i + 1}}\\)`,
          `\\(${VL.lm(dP, 1)}/${VL.lm(du, 1)}\\)`,
          `\\(${VL.lm(ks[i], 2)}\\) Па/мВ`);
      });
      html += VL.step(`\\(K_{\\text{ср}} = \\sum K_i/n\\)`,
        `\\((${ks.map(k => VL.lm(k, 2)).join('+')})/${ks.length}\\)`,
        `\\(${VL.lm(kAvg, 2)}\\) Па/мВ`);
      html += '</div>';
      const kR = Math.round(kAvg * 100) / 100;
      const dev = Math.abs(kAvg - 4.3) / 4.3 * 100;
      html += `<p class="small">Ваша тарировка: <b>K = ${VL.fm(kR, 2)} Па/мВ</b> ` +
        `(в отчёте по натурному опыту вышло 4,3 Па/мВ — расхождение ${VL.fm(dev, 1)} %). ` +
        `Этот коэффициент можно сразу применить там, где датчик переводит мВ в Па:</p>` +
        `<p><a class="btn take" href="lab3?K=${kR.toFixed(2)}#virt">использовать этот K в лабе о трубопроводе →</a></p>`;
      hint('Тарировка готова: снято ' + loaded.length + ' точек с гирями. Можно добавить ещё для точности.');
    } else {
      hint('Снято точек с гирями: ' + loaded.length + ' из 3 необходимых' +
        (rows[0].m === 0 ? ' (нулевая есть).' : '.') + ' Меняйте гири и снимайте отсчёты.');
    }
    out.innerHTML = html;
    VL.mathify(out);
  }

  function reset() {
    points.clear(); clearMasses(); render();
    hint('Виртуальные данные очищены — на странице действуют данные отчёта. Снимите нулевой отсчёт, чтобы начать заново.');
  }

  $('v1add10').addEventListener('click', () => addMass(10));
  $('v1add20').addEventListener('click', () => addMass(20));
  $('v1clear').addEventListener('click', clearMasses);
  $('v1snap').addEventListener('click', snap);
  $('v1reset').addEventListener('click', reset);
  /* --- авто-прогон серии --- */
  {
    const PLAN = [0, 10, 10, 20, 10, 20];   // 0 → 10 → 20 → 40 → 50 → 70 г
    VL.auto({
      autoBtn: 'v1auto', stopBtn: 'v1stop',
      lockIds: ['v1add10', 'v1add20', 'v1clear', 'v1snap', 'v1reset'],
      total: () => PLAN.length,
      progress: (i, n) => {
        const p = $('v1prog');
        p.style.display = ''; p.textContent = `опыт ${i} из ${n}`;
      },
      step: async (i, ctl) => {
        if (i === 0) { clearMasses(); points.clear(); }
        else { masses.push(PLAN[i]); m += PLAN[i]; kick(PLAN[i]); drawWeights(); }
        await ctl.sleep(750);            // успокоение коромысла и датчика
        if (!ctl.aborted()) snap();
      },
      onFinish: (aborted, done, n) => {
        $('v1prog').style.display = 'none';
        syncButtons();
        hint(aborted
          ? `Прогон остановлен: снято ${done} из ${n} отсчётов — обработка идёт по снятым точкам.`
          : 'Серия снята автоматически: нуль и пять нагружений. Ниже — обработка вашего опыта.');
      },
    });
  }

  drawWeights(); syncButtons();
})();
