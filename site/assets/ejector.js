/* Струйные аппараты: анимация работы водоструйного эжектора с эпюрой давления
 * вдоль оси и живой расчёт с характеристикой.
 *
 * Одномерная модель (уравнение количества движения для камеры смешения
 * постоянного сечения плюс восстановление в диффузоре) полностью выведена в
 * тексте главы; здесь та же арифметика в коде:
 *
 *   \Delta p_с/\Delta p_р = 2\varphi^2 a\,[\,1 - a(1+u)^2(1-\eta_д/2)\,],
 *   a = A_с/A_к = 1/m,  \varphi = 0,95,  \eta_д = 0,85.
 */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$('ejSvg') && !$('ejD')) return;

  var RHO = 1000, G = 9.81, PATM = 101.325;         // кПа
  var PHI = 0.95, ETAD = 0.85;
  var KD = 1 - ETAD / 2;                            // 0,575

  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var v = Number(x).toFixed(d === undefined ? 0 : d).split('.');
    v[0] = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return v.join(',');
  }
  function sci(x, d) {                               // 3,142·10⁻⁴
    if (!isFinite(x) || x <= 0) return '—';
    var e = Math.floor(Math.log(x) / Math.LN10 + 1e-9);
    var m = x / Math.pow(10, e);
    if (m >= 9.9995) { m /= 10; e += 1; }
    return fmt(m, d === undefined ? 2 : d) + '·10'
      + String(e).replace(/-/g, '⁻').replace(/[0-9]/g, function (c) {
        return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c];
      });
  }
  function row(f, sub, res) {
    return '<div class="calc-row"><span class="f">' + f + '</span> = '
      + '<span style="color:#6b6b74">' + sub + '</span> = <b>' + res + '</b></div>';
  }
  function mathify(el) {
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true },
                     { left: '\\(', right: '\\)', display: false }],
        throwOnError: false,
      });
    }
  }

  /* отношение напоров, которое аппарат даёт при коэффициенте эжекции u */
  function ratio(a, u) { return 2 * PHI * PHI * a * (1 - a * (1 + u) * (1 + u) * KD); }

  /* Полный расчёт режима. Диаметры в мм, давления в кПа, высоты в м. */
  function solve(dc, m, prG, hvs, hnag) {
    var a = 1 / m;
    var Ac = Math.PI * dc * dc / 4e6;                // м²
    var Ak = m * Ac;
    var pVs = PATM - RHO * G * hvs / 1000;           // кПа абс. в приёмной камере
    var pNag = PATM + RHO * G * hnag / 1000;
    var pR = PATM + prG;
    var dps = pNag - pVs, dpr = pR - pVs;
    var t = dps / dpr;
    var val = (1 - t / (2 * PHI * PHI * a)) / (a * KD);
    var u = val > 0 ? Math.sqrt(val) - 1 : -1;
    var ok = u > 0;
    if (!ok) u = 0;
    var v1 = PHI * Math.sqrt(2 * dpr * 1000 / RHO);
    var Qp = v1 * Ac;
    var Qn = u * Qp, Qs = Qp + Qn;
    var v3 = Qs / Ak;
    var eta = u * t;
    /* давление в конце камеры смешения (уравнение импульса) */
    var p3 = pVs + RHO * v1 * v1 * (a - a * a * (1 + u) * (1 + u)) / 1000;
    /* наибольший КПД, достижимый на этой геометрии */
    var best = { u: 0, e: -1 };
    for (var uu = 0.02; uu < 4; uu += 0.01) {
      var e = uu * ratio(a, uu);
      if (e > best.e) { best.e = e; best.u = uu; }
    }
    return { a: a, Ac: Ac, Ak: Ak, pVs: pVs, pNag: pNag, pR: pR, dps: dps, dpr: dpr,
             t: t, u: u, ok: ok, v1: v1, Qp: Qp, Qn: Qn, Qs: Qs, v3: v3, eta: eta,
             p3: p3, best: best, uMax: Math.sqrt(1 / (a * KD)) - 1 };
  }

  /* ======================================================================
     ПАНЕЛЬ 1. Анимация эжектора с эпюрой давления
     ====================================================================== */
  (function () {
    var svg = $('ejSvg');
    if (!svg) return;
    var gS = $('ejStatic'), gP = $('ejParts');

    var AX = 118, XN = 70, XE = 610;
    var RN0 = 24, RC = 8, RK = 16, ROUT = 30;        // радиусы, px (m = 4)
    var XNOZ = 186, XCH = 268, XMIX = 442, XOUT = 600;
    var XSUC = 214;                                  // ось патрубка подсоса
    var EY = 336, ESC = 0.46;                        // эпюра: y нуля и px на кПа
    var st = { u: 1.1, Qp: 0, Qn: 0, pVs: 60, pNag: 130, ok: true, vj: 1, m: null };

    function yP(p) { return EY - p * ESC; }

    /* радиус проточной части по x */
    function rad(x) {
      if (x < XCH) return RK;                        // струя ещё свободна
      if (x < XMIX) return RK;
      if (x < XOUT) return RK + (ROUT - RK) * (x - XMIX) / (XOUT - XMIX);
      return ROUT;
    }

    function pressure(x) {                           // кПа абс. вдоль оси
      var s = st.m;
      if (x < XCH) return s.pVs;
      if (x < XMIX) {
        var tt = (x - XCH) / (XMIX - XCH);
        var k = (1 - Math.exp(-3 * tt)) / (1 - Math.exp(-3));
        return s.pVs + (s.p3 - s.pVs) * k;
      }
      var A0 = RK * RK, A = rad(x) * rad(x);
      var Ae = ROUT * ROUT;
      var f = (1 - Math.pow(A0 / A, 2)) / (1 - Math.pow(A0 / Ae, 2));
      return s.p3 + (s.pNag - s.p3) * f;
    }

    function draw() {
      var s = st.m;
      var o = '';
      o += '<text x="320" y="18" text-anchor="middle" style="font:600 12px system-ui;fill:#16161a">'
        + 'Водоструйный эжектор: рабочая струя, подсос, смешение, диффузор</text>';

      /* корпус приёмной камеры */
      o += '<path d="M ' + (XNOZ - 40) + ' ' + (AX - 46) + ' H ' + XCH + ' L ' + XCH + ' '
        + (AX - RK) + ' M ' + (XNOZ - 40) + ' ' + (AX + 46) + ' H ' + XCH + ' L ' + XCH + ' '
        + (AX + RK) + '" fill="none" stroke="#16161a" stroke-width="2"/>';
      /* камера смешения */
      o += '<path d="M ' + XCH + ' ' + (AX - RK) + ' H ' + XMIX + ' M ' + XCH + ' '
        + (AX + RK) + ' H ' + XMIX + '" fill="none" stroke="#16161a" stroke-width="2"/>';
      /* диффузор */
      o += '<path d="M ' + XMIX + ' ' + (AX - RK) + ' L ' + XOUT + ' ' + (AX - ROUT)
        + ' M ' + XMIX + ' ' + (AX + RK) + ' L ' + XOUT + ' ' + (AX + ROUT)
        + '" fill="none" stroke="#16161a" stroke-width="2"/>';
      /* рабочее сопло */
      o += '<path d="M ' + XN + ' ' + (AX - RN0) + ' L ' + (XNOZ - 30) + ' ' + (AX - RN0)
        + ' L ' + XNOZ + ' ' + (AX - RC) + ' M ' + XN + ' ' + (AX + RN0) + ' L '
        + (XNOZ - 30) + ' ' + (AX + RN0) + ' L ' + XNOZ + ' ' + (AX + RC)
        + '" fill="none" stroke="#16161a" stroke-width="2.4"/>';
      /* патрубок подсоса */
      o += '<path d="M ' + (XSUC - 15) + ' 30 V ' + (AX - 46) + ' M ' + (XSUC + 15)
        + ' 30 V ' + (AX - 46) + '" fill="none" stroke="#16161a" stroke-width="2"/>';

      o += '<text x="' + (XN + 4) + '" y="' + (AX - RN0 - 8)
        + '" style="font:11px system-ui;fill:#155e75">рабочая вода</text>';
      o += '<text x="' + (XSUC + 24) + '" y="42" '
        + 'style="font:600 11px system-ui;fill:#1a7f37">подсасываемая среда</text>';
      o += '<text x="' + ((XCH + XMIX) / 2) + '" y="182" '
        + 'text-anchor="middle" style="font:11px system-ui;fill:#16161a">камера смешения</text>';
      o += '<text x="' + ((XMIX + XOUT) / 2 + 10) + '" y="182" '
        + 'text-anchor="middle" style="font:11px system-ui;fill:#16161a">диффузор</text>';
      o += '<text x="' + XOUT + '" y="' + (AX - ROUT - 10)
        + '" text-anchor="end" style="font:11px system-ui;fill:#b3382e">смесь на нагнетание</text>';
      o += '<text x="' + (XNOZ - 40) + '" y="182" '
        + 'style="font:11px system-ui;fill:#6b6b74">приёмная камера</text>';

      /* показания режима */
      o += '<text x="' + XN + '" y="200" style="font:11px system-ui;fill:#155e75">'
        + 'p_р = ' + fmt(s.pR - PATM) + ' кПа изб., Q_р = ' + fmt(s.Qp * 3600, 1) + ' м³/ч</text>';
      o += '<text x="' + XN + '" y="216" style="font:11px system-ui;fill:#1a7f37">'
        + (s.ok ? 'u = ' + fmt(s.u, 2) + ', Q_н = ' + fmt(s.Qn * 3600, 1) + ' м³/ч, Q_см = '
                + fmt(s.Qs * 3600, 1) + ' м³/ч'
                : 'подсоса нет: противодавление выше предельного') + '</text>';

      /* ---- эпюра ---- */
      o += '<line x1="' + XN + '" y1="' + yP(0) + '" x2="' + XE + '" y2="' + yP(0)
        + '" stroke="#16161a" stroke-width="1.2"/>';
      [50, 100, 150, 200].forEach(function (p) {
        o += '<line x1="' + XN + '" y1="' + yP(p).toFixed(1) + '" x2="' + XE + '" y2="'
          + yP(p).toFixed(1) + '" stroke="#eceae3" stroke-width="1"/>';
        o += '<text x="' + (XN - 6) + '" y="' + (yP(p) + 4).toFixed(1) + '" text-anchor="end" '
          + 'style="font:11px system-ui;fill:#6b6b74">' + p + '</text>';
      });
      o += '<text x="' + (XN - 6) + '" y="' + (yP(0) + 4).toFixed(1) + '" text-anchor="end" '
        + 'style="font:11px system-ui;fill:#6b6b74">0</text>';
      o += '<text x="' + XE + '" y="' + (yP(200) - 8).toFixed(1)
        + '" text-anchor="end" style="font:11px system-ui;fill:#6b6b74">p, кПа абс.</text>';
      /* атмосфера */
      o += '<line x1="' + XN + '" y1="' + yP(PATM).toFixed(1) + '" x2="' + XE + '" y2="'
        + yP(PATM).toFixed(1) + '" stroke="#6b6b74" stroke-width="1.2" stroke-dasharray="6 4"/>';
      o += '<text x="' + (XN + 4) + '" y="' + (yP(PATM) - 6).toFixed(1) + '" '
        + 'style="font:11px system-ui;fill:#6b6b74">атмосфера 101 кПа</text>';
      /* давление в сопле — выше шкалы */
      o += '<line x1="' + XN + '" y1="' + yP(196).toFixed(1) + '" x2="' + (XNOZ - 4) + '" y2="'
        + yP(196).toFixed(1) + '" stroke="#155e75" stroke-width="2.4" stroke-dasharray="3 3"/>';
      o += '<text x="' + (XN + 4) + '" y="' + (yP(196) - 7).toFixed(1)
        + '" style="font:11px system-ui;fill:#155e75">в сопле ' + fmt(s.pR)
        + ' кПа — выше шкалы</text>';
      /* сама кривая */
      var pts = [];
      for (var x = XNOZ; x <= XOUT; x += 3) pts.push(x + ',' + yP(pressure(x)).toFixed(1));
      o += '<polyline points="' + (XNOZ - 4) + ',' + yP(196).toFixed(1) + ' ' + pts.join(' ')
        + '" fill="none" stroke="#155e75" stroke-width="2.4"/>';
      /* стрелка разрежения */
      var xv = (XNOZ + XCH) / 2;
      o += '<line x1="' + xv + '" y1="' + yP(PATM).toFixed(1) + '" x2="' + xv + '" y2="'
        + yP(s.pVs).toFixed(1) + '" stroke="#b3382e" stroke-width="1.6" marker-end="url(#arrE)"/>';
      o += '<text x="' + (xv + 8) + '" y="' + (yP(PATM) - 8).toFixed(1)
        + '" style="font:600 11px system-ui;fill:#b3382e">разрежение ' + fmt(PATM - s.pVs, 1)
        + ' кПа</text>';
      /* стрелка нагнетания */
      o += '<line x1="' + (XOUT - 8) + '" y1="' + yP(PATM).toFixed(1) + '" x2="' + (XOUT - 8)
        + '" y2="' + yP(s.pNag).toFixed(1) + '" stroke="#1a7f37" stroke-width="1.6" marker-end="url(#arrE)"/>';
      o += '<text x="' + (XOUT - 16) + '" y="' + (yP(s.pNag) - 14).toFixed(1)
        + '" text-anchor="end" style="font:600 11px system-ui;fill:#1a7f37">нагнетание '
        + fmt(s.pNag - PATM, 1) + ' кПа</text>';
      gS.innerHTML = o;
    }

    /* частицы: синие — рабочая вода (быстрое ядро струи), зелёные —
       подсасываемая среда (медленный поток в кольце вокруг струи) */
    var work = [], suck = [];
    for (var i = 0; i < 260; i++) {
      work.push({ x: XNOZ + Math.random() * (XOUT - XNOZ), f: (Math.random() * 2 - 1) * 0.85 });
    }
    for (var j = 0; j < 90; j++) {
      suck.push({ ph: 0, y: 32 + Math.random() * 38,
                  x: XSUC + (Math.random() * 2 - 1) * 10,
                  f: (Math.random() * 2 - 1) * 0.9,
                  g: 0.5 + Math.random() * 0.45 });
    }

    function speed(x) {                              // px/с по оси
      var vJet = 210;                                // скорость струи на срезе
      /* v_см/v_струи = a(1+u): при m = 4 и u = 1 смесь идёт вдвое медленнее */
      var vMix = vJet * st.aRel;
      if (x < XCH) return vJet;
      if (x < XMIX) {
        var tt = (x - XCH) / (XMIX - XCH);
        return vJet + (vMix - vJet) * tt;
      }
      return vMix * Math.pow(RK / rad(x), 2);
    }

    function tick(dt) {
      var s = st.m, o = '';
      for (var i = 0; i < work.length; i++) {
        var p = work[i];
        p.x += speed(p.x) * dt;
        if (p.x > XOUT) { p.x = XNOZ; p.f = (Math.random() * 2 - 1) * 0.85; }
        var hh = p.x < XCH ? RC + (RK - RC) * Math.min(1, (p.x - XNOZ) / (XCH - XNOZ)) : rad(p.x);
        o += '<circle cx="' + p.x.toFixed(1) + '" cy="' + (AX + p.f * hh).toFixed(1)
          + '" r="2.1" fill="#155e75" fill-opacity=".8"/>';
      }
      var n = Math.round(suck.length * Math.min(1, s.u / 1.6));
      for (var k = 0; k < suck.length; k++) {
        var q = suck[k];
        if (k >= n || !s.ok) continue;               // подсоса меньше — частиц меньше
        if (q.ph === 0) {                            // спуск по патрубку подсоса
          q.y += 34 * dt;
          if (q.y > AX - 48) { q.ph = 1; q.x = XNOZ - 26 + Math.random() * 20; }
          o += '<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1)
            + '" r="2.1" fill="#1a7f37" fill-opacity=".8"/>';
        } else if (q.x < XCH) {                      /* медленно в приёмной камере,
                                                        в кольце вокруг струи */
          q.x += 62 * dt;
          var yy = AX + (q.f < 0 ? -1 : 1) * (RK + 4 + q.g * 26);
          o += '<circle cx="' + q.x.toFixed(1) + '" cy="' + yy.toFixed(1)
            + '" r="2.1" fill="#1a7f37" fill-opacity=".8"/>';
        } else {                                     // подхвачена смесью
          q.x += speed(q.x) * dt * 0.9;
          if (q.x > XOUT) { q.ph = 0; q.y = 32; q.x = XSUC + (Math.random() * 2 - 1) * 10; }
          o += '<circle cx="' + q.x.toFixed(1) + '" cy="' + (AX + q.f * rad(q.x)).toFixed(1)
            + '" r="2.1" fill="#1a7f37" fill-opacity=".8"/>';
        }
      }
      gP.innerHTML = o;
    }

    function refresh() {
      var pr = parseFloat($('ejPr').value);
      var hv = parseFloat($('ejHv').value);
      $('ejPrOut').textContent = fmt(pr, 2);
      $('ejHvOut').textContent = fmt(hv, 1);
      st.m = solve(20, 4, pr * 1000, hv, 3);
      st.aRel = 0.25 * (1 + st.m.u);                 // v_см/v_струи = a(1+u)
      draw();
    }
    ['ejPr', 'ejHv'].forEach(function (id) { $(id).addEventListener('input', refresh); });
    refresh();

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  /* ======================================================================
     ПАНЕЛЬ 2. Живой расчёт эжектора
     ====================================================================== */
  (function () {
    if (!$('ejD')) return;
    var DEF = { ejD: 20, ejM: 4, ejP: 0.4, ejHs: 4, ejHn: 3 };

    function px(u) { return 74 + u / 2.2 * 520; }
    function py(t) { return 216 - t / 0.70 * 166; }

    function curve(a) {
      var pts = [];
      for (var u = 0; u <= 2.2; u += 0.02) {
        var t = ratio(a, u);
        if (t < 0) break;
        pts.push(px(u).toFixed(1) + ',' + py(t).toFixed(1));
      }
      return pts.join(' ');
    }

    function compute() {
      var dc = parseFloat($('ejD').value);
      var m = parseFloat($('ejM').value);
      var pr = parseFloat($('ejP').value);
      var hs = parseFloat($('ejHs').value);
      var hn = parseFloat($('ejHn').value);
      $('ejDOut').textContent = fmt(dc);
      $('ejMOut').textContent = fmt(m, 1);
      $('ejPOut').textContent = fmt(pr, 2);
      $('ejHsOut').textContent = fmt(hs, 1);
      $('ejHnOut').textContent = fmt(hn, 1);

      var s = solve(dc, m, pr * 1000, hs, hn);
      var out = '';
      out += row('\\(p_{\\text{вс}} = p_{\\text{а}} - \\rho g h_{\\text{вс}}\\)',
        '101,3 − 1000·9,81·' + fmt(hs, 1) + '/1000', fmt(s.pVs, 2) + ' кПа абс.');
      out += row('\\(p_{\\text{наг}} = p_{\\text{а}} + \\rho g h_{\\text{наг}}\\)',
        '101,3 + 1000·9,81·' + fmt(hn, 1) + '/1000', fmt(s.pNag, 2) + ' кПа абс.');
      out += row('\\(\\Delta p_{\\text{с}} = p_{\\text{наг}} - p_{\\text{вс}}\\)',
        fmt(s.pNag, 2) + ' − ' + fmt(s.pVs, 2), fmt(s.dps, 2) + ' кПа');
      out += row('\\(\\Delta p_{\\text{р}} = p_{\\text{р}} - p_{\\text{вс}}\\)',
        fmt(s.pR, 1) + ' − ' + fmt(s.pVs, 2), fmt(s.dpr, 1) + ' кПа');
      out += row('\\(\\Delta p_{\\text{с}}/\\Delta p_{\\text{р}}\\)',
        fmt(s.dps, 2) + '/' + fmt(s.dpr, 1), fmt(s.t, 4));

      if (!s.ok) {
        out += '<div class="note warn"><b>Подсоса нет.</b> Требуемое отношение напоров '
          + fmt(s.t, 3) + ' больше предельного ' + fmt(ratio(s.a, 0), 3)
          + ', которое этот аппарат даёт даже при нулевом подсосе. Рабочая вода пойдёт '
          + 'на нагнетание, а через всасывающий патрубок начнётся обратный переток. '
          + 'Нужно поднять давление рабочей воды, уменьшить противодавление или взять '
          + 'меньшее \\(m\\).</div>';
        $('ejOut').innerHTML = out;
        mathify($('ejOut'));
        drawChar(s);
        return;
      }
      out += row('\\(u = \\sqrt{\\dfrac{1 - \\dfrac{\\Delta p_{\\text{с}}/\\Delta p_{\\text{р}}}{2\\varphi^2 a}}{a(1-\\eta_{\\text{д}}/2)}} - 1\\)',
        '√((1 − ' + fmt(s.t, 4) + '/' + fmt(2 * PHI * PHI * s.a, 4) + ')/('
        + fmt(s.a, 4) + '·0,575)) − 1', fmt(s.u, 3));
      out += row('\\(v_1 = \\varphi\\sqrt{2\\Delta p_{\\text{р}}/\\rho}\\)',
        '0,95·√(2·' + fmt(s.dpr * 1000) + '/1000)', fmt(s.v1, 2) + ' м/с');
      out += row('\\(A_{\\text{с}} = \\pi d_{\\text{с}}^2/4\\)',
        '3,1416·' + fmt(dc) + '²/4·10⁻⁶', fmt(s.Ac * 1e4, 3) + ' см²');
      out += row('\\(Q_{\\text{р}} = v_1 A_{\\text{с}}\\)',
        fmt(s.v1, 2) + '·' + sci(s.Ac, 3),
        fmt(s.Qp * 1000, 2) + ' л/с = ' + fmt(s.Qp * 3600, 1) + ' м³/ч');
      out += row('\\(Q_{\\text{н}} = u\\,Q_{\\text{р}}\\)',
        fmt(s.u, 3) + '·' + fmt(s.Qp * 1000, 2), fmt(s.Qn * 1000, 2) + ' л/с = '
        + fmt(s.Qn * 3600, 1) + ' м³/ч');
      out += row('\\(Q_{\\text{см}} = Q_{\\text{р}}(1+u)\\)',
        fmt(s.Qp * 1000, 2) + '·' + fmt(1 + s.u, 3), fmt(s.Qs * 1000, 2) + ' л/с = '
        + fmt(s.Qs * 3600, 1) + ' м³/ч');
      out += row('\\(v_3 = Q_{\\text{см}}/A_{\\text{к}}\\)',
        fmt(s.Qs * 1000, 2) + '·10⁻³/' + sci(s.Ak, 3),
        fmt(s.v3, 2) + ' м/с');
      out += row('\\(\\eta = u\\,\\Delta p_{\\text{с}}/\\Delta p_{\\text{р}}\\)',
        fmt(s.u, 3) + '·' + fmt(s.t, 4), fmt(s.eta, 3) + ' = ' + fmt(s.eta * 100, 1) + ' %');
      out += row('вакуум', '101,3 − ' + fmt(s.pVs, 2), fmt(PATM - s.pVs, 1) + ' кПа = '
        + fmt((PATM - s.pVs) / (RHO * G) * 1000, 2) + ' м вод. ст.');

      var pS = 2.34;
      if (s.pVs < pS + 5) {
        out += '<div class="note warn">Давление в приёмной камере '
          + fmt(s.pVs, 1) + ' кПа подошло к давлению насыщенного пара (2,3 кПа при 20 °C): '
          + 'вода в камере вскипит, подсос сорвётся. Предельная геометрическая высота '
          + 'всасывания холодной воды — около 9…10 м, и практически берут не больше '
          + '6…7 м.</div>';
      }
      out += '<div class="note tip">Наибольший КПД на этой геометрии — <b>'
        + fmt(s.best.e * 100, 1) + ' %</b> при \\(u = ' + fmt(s.best.u, 2)
        + '\\); при нулевом подсосе аппарат создаёт наибольшее сжатие '
        + fmt(ratio(s.a, 0), 3) + ' от рабочего перепада, а при \\(u = '
        + fmt(s.uMax, 2) + '\\) сжатие обращается в ноль — это «холостой» режим, когда '
        + 'смесь просто выливается наружу. Рабочая точка сейчас '
        + fmt(s.u / s.uMax * 100, 0) + ' % от предельного подсоса.</div>';
      $('ejOut').innerHTML = out;
      mathify($('ejOut'));
      drawChar(s);
    }

    function drawChar(s) {
      var o = '';
      o += '<text x="320" y="18" text-anchor="middle" style="font:600 12px system-ui;fill:#16161a">'
        + 'Характеристика эжектора: сжатие в зависимости от коэффициента эжекции</text>';
      o += '<line x1="74" y1="216" x2="614" y2="216" stroke="#16161a" stroke-width="1.4"/>';
      o += '<line x1="74" y1="216" x2="74" y2="44" stroke="#16161a" stroke-width="1.4"/>';
      [0, 0.5, 1, 1.5, 2].forEach(function (u) {
        o += '<line x1="' + px(u).toFixed(1) + '" y1="216" x2="' + px(u).toFixed(1)
          + '" y2="221" stroke="#16161a" stroke-width="1.1"/>';
        o += '<text x="' + px(u).toFixed(1) + '" y="234" text-anchor="middle" '
          + 'style="font:11px system-ui;fill:#6b6b74">' + fmt(u, 1) + '</text>';
      });
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].forEach(function (t) {
        o += '<line x1="69" y1="' + py(t).toFixed(1) + '" x2="74" y2="' + py(t).toFixed(1)
          + '" stroke="#16161a" stroke-width="1.1"/>';
        o += '<text x="65" y="' + (py(t) + 4).toFixed(1) + '" text-anchor="end" '
          + 'style="font:11px system-ui;fill:#6b6b74">' + fmt(t, 1) + '</text>';
      });
      o += '<text x="614" y="252" text-anchor="end" style="font:11px system-ui;fill:#16161a">'
        + 'коэффициент эжекции u = Q_н/Q_р</text>';
      o += '<text x="80" y="40" style="font:11px system-ui;fill:#16161a">Δp_с/Δp_р</text>';
      [2, 8].forEach(function (mm) {
        o += '<polyline points="' + curve(1 / mm) + '" fill="none" stroke="#c9c6bd" '
          + 'stroke-width="1.6"/>';
      });
      o += '<text x="' + (px(0.5) + 8).toFixed(1) + '" y="' + (py(ratio(0.5, 0.5)) - 6).toFixed(1)
        + '" style="font:11px system-ui;fill:#8a8a92">m = 2</text>';
      o += '<text x="' + (px(1.8) + 6).toFixed(1) + '" y="' + (py(ratio(0.125, 1.8)) - 6).toFixed(1)
        + '" style="font:11px system-ui;fill:#8a8a92">m = 8</text>';
      o += '<polyline points="' + curve(s.a) + '" fill="none" stroke="#155e75" stroke-width="2.4"/>';
      /* рабочая точка */
      var ux = px(Math.min(s.u, 2.2)), uy = py(Math.min(s.t, 0.70));
      o += '<line x1="74" y1="' + uy.toFixed(1) + '" x2="' + ux.toFixed(1) + '" y2="'
        + uy.toFixed(1) + '" stroke="#b3382e" stroke-width="1.2" stroke-dasharray="4 4"/>';
      o += '<line x1="' + ux.toFixed(1) + '" y1="216" x2="' + ux.toFixed(1) + '" y2="'
        + uy.toFixed(1) + '" stroke="#b3382e" stroke-width="1.2" stroke-dasharray="4 4"/>';
      o += '<circle cx="' + ux.toFixed(1) + '" cy="' + uy.toFixed(1) + '" r="5" fill="#b3382e"/>';
      var right = s.u < 1.4;
      o += '<text x="' + (ux + (right ? 10 : -10)).toFixed(1) + '" y="' + (uy - 8).toFixed(1)
        + '" text-anchor="' + (right ? 'start' : 'end') + '" '
        + 'style="font:600 11px system-ui;fill:#b3382e">рабочая точка: u = ' + fmt(s.u, 2)
        + '</text>';
      o += '<text x="614" y="40" text-anchor="end" '
        + 'style="font:11px system-ui;fill:#155e75">сплошная синяя — текущее m = '
        + fmt(1 / s.a, 1) + '</text>';
      $('ejChar').innerHTML = o;
    }

    ['ejD', 'ejM', 'ejP', 'ejHs', 'ejHn'].forEach(function (id) {
      $(id).addEventListener('input', compute);
    });
    $('ejReset').addEventListener('click', function () {
      Object.keys(DEF).forEach(function (k) { $(k).value = DEF[k]; });
      compute();
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', compute);
    } else { compute(); }
  })();
})();
