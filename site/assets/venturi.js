/* Расходомеры переменного перепада: две анимации и живой расчёт.
 *
 * Панель 1 (fm-flow)  — течение через сужение с эпюрой давления вдоль оси:
 *   переключение «труба Вентури / сопло / диафрагма» перестраивает и канал,
 *   и эпюру, так что видно главное: провал давления в наименьшем сечении
 *   одинаков (эпюра нормирована на измеряемый перепад), а восстановление —
 *   разное, и остаток и есть безвозвратная потеря.
 * Панель 2 (fm-cav)   — та же труба Вентури в абсолютных давлениях с линией
 *   давления насыщенного пара: при снижении давления на входе в горле
 *   вскипает жидкость, пузырьки сносятся в диффузор и там схлопываются.
 * Панель 3 (fm-calc)  — живой расчёт по ГОСТ 8.586 / ISO 5167.
 *
 * Физика, общая для всех трёх панелей, собрана в функции device() и model().
 * Формулы продублированы в тексте страницы.
 */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$('fmType')) return;                       // не наша страница

  var NS = 'http://www.w3.org/2000/svg';
  var G = 9.81;
  var PATM = 101.325;                             // кПа

  /* среды: плотность кг/м³, кинематическая вязкость м²/с, температура °C */
  var FLUIDS = {
    w20: { name: 'вода, 20 °C', rho: 998.2, nu: 1.004e-6, t: 20 },
    w60: { name: 'вода, 60 °C', rho: 983.2, nu: 0.475e-6, t: 60 },
    sea: { name: 'морская вода, 20 °C', rho: 1025.0, nu: 1.05e-6, t: 20 },
    oil: { name: 'масло МС-20, 20 °C', rho: 895.0, nu: 30.0e-6, t: 20 },
  };

  /* давление насыщенного пара воды, кПа (формула Магнуса) */
  function psat(t) { return 0.61094 * Math.exp(17.625 * t / (t + 243.04)); }

  /* ---- форматирование в кластерном стиле ---- */
  function fmt(x, d) {
    if (!isFinite(x)) return '—';
    var v = Number(x).toFixed(d === undefined ? 0 : d).split('.');
    v[0] = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return v.join(',');
  }
  function sup(e) {
    return String(e).replace(/-/g, '⁻').replace(/[0-9]/g, function (c) {
      return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c];
    });
  }
  /* научная запись по-русски: 1,81·10⁵, 3,142·10⁻⁴ */
  function sci(x, d) {
    if (!isFinite(x) || x <= 0) return '—';
    var e = Math.floor(Math.log(x) / Math.LN10 + 1e-9);
    var m = x / Math.pow(10, e);
    if (m >= 9.9995) { m /= 10; e += 1; }
    return fmt(m, d === undefined ? 2 : d) + '·10' + sup(e);
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

  /* ================= физика прибора =================
     Коэффициент расхода C по стандартным зависимостям:
       труба Вентури с механически обработанной конфузорной частью — C = 0,995;
       сопло ИСА 1932 — формула стандарта;
       диафрагма с угловым отбором — уравнение Штольца.
     eps — коэффициент сжатия струи (для Вентури и сопла струя не сжимается,
     для диафрагмы 0,62); phi — доля потери Борда — Карно, которая реально
     теряется при расширении (для диффузора Вентури расширение постепенное,
     и потеря втрое-впятеро меньше внезапной).                              */
  function device(kind, beta, Re) {
    if (kind === 'venturi') {
      return { C: 0.995, eps: 1, phi: 0.20,
               ReMin: 2e5, ReMax: 1e6, bMin: 0.40, bMax: 0.75,
               title: 'труба Вентури' };
    }
    if (kind === 'nozzle') {
      var C = 0.9900 - 0.2262 * Math.pow(beta, 4.1)
        - (0.00175 * beta * beta - 0.0033 * Math.pow(beta, 4.15))
          * Math.pow(1e6 / Re, 1.15);
      return { C: C, eps: 1, phi: 1,
               ReMin: 7e4, ReMax: 1e7, bMin: 0.30, bMax: 0.80,
               title: 'сопло ИСА 1932' };
    }
    var Co = 0.5959 + 0.0312 * Math.pow(beta, 2.1) - 0.184 * Math.pow(beta, 8)
      + 91.71 * Math.pow(beta, 2.5) * Math.pow(Re, -0.75);
    return { C: Co, eps: 0.62, phi: 1,
             ReMin: 5000, ReMax: 1e8, bMin: 0.10, bMax: 0.75,
             title: 'диафрагма' };
  }

  /* Полный расчёт: диаметры в метрах, dp в Па, возвращает всё в СИ.
     Коэффициент расхода зависит от Re, а Re — от расхода, поэтому
     несколько итераций простой подстановки (сходится за 3–4 шага). */
  function model(kind, D, beta, dp, fl) {
    var d = beta * D;
    var A1 = Math.PI * D * D / 4, A2 = Math.PI * d * d / 4;
    var E = 1 / Math.sqrt(1 - Math.pow(beta, 4));
    var base = Math.sqrt(2 * dp / fl.rho);
    var C = kind === 'orifice' ? 0.61 : 0.99, dev = null, Q = 0, Re = 1e5;
    for (var i = 0; i < 24; i++) {
      Q = C * E * A2 * base;
      Re = Math.max(Q / A1 * D / fl.nu, 100);
      dev = device(kind, beta, Re);
      C = dev.C;
    }
    Q = C * E * A2 * base;
    var v1 = Q / A1, v2 = Q / A2, vc = Q / (dev.eps * A2);
    Re = v1 * D / fl.nu;
    /* безвозвратная потеря: расширение от сжатого сечения по Борда — Карно,
       смягчённое в диффузоре множителем phi */
    var loss = dev.phi * fl.rho * (vc - v1) * (vc - v1) / 2;
    /* та же величина в долях перепада — замкнутая форма (1−a)/(1+a),
       a = отношение сжатого сечения к сечению трубы */
    var a = dev.eps * beta * beta;
    var lossRel = dev.phi * (1 - a) / (1 + a);
    return { d: d, A1: A1, A2: A2, E: E, C: C, dev: dev, Q: Q, v1: v1, v2: v2,
             vc: vc, Re: Re, loss: loss, lossRel: lossRel, a: a, base: base };
  }

  /* ================= геометрия канала для рисунка =================
     Возвращает функции: hw(x) — полувысота СТЕНКИ, hf(x) — полувысота
     ПОТОКА (для сопла и диафрагмы после наименьшего сечения поток идёт
     струёй и стенки не касается). x — в координатах viewBox, 70…610. */
  var X0 = 70, X1 = 610, AXY = 112, RW = 52;

  function geom(kind, beta) {
    var r = RW * beta;
    var lerp = function (x, xa, xb, ya, yb) {
      var s = (x - xa) / (xb - xa);
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      return ya + (yb - ya) * s;
    };
    if (kind === 'venturi') {
      var xa = 200, xb = 330, xc = 368, xd = 596;   // конфузор 21°, диффузор 15°
      var h = function (x) {
        if (x <= xa) return RW;
        if (x <= xb) return lerp(x, xa, xb, RW, r);
        if (x <= xc) return r;
        if (x <= xd) return lerp(x, xc, xd, r, RW);
        return RW;
      };
      return { hw: h, hf: h, xMin: (xb + xc) / 2, xEnd: xd, r: r,
               xIn: xa, xThroatA: xb, xThroatB: xc };
    }
    if (kind === 'nozzle') {
      var na = 300, nb = 356, nc = 372, nd = 560;
      var hw = function (x) { return x <= na ? RW : (x <= nb ? lerp(x, na, nb, RW, r) : RW); };
      var hf = function (x) {
        if (x <= na) return RW;
        if (x <= nb) return lerp(x, na, nb, RW, r);
        if (x <= nc) return r;
        if (x <= nd) return lerp(x, nc, nd, r, RW);
        return RW;
      };
      /* контур самого сопла (только сходящаяся часть) */
      return { hw: hw, hf: hf, xMin: (nb + nc) / 2, xEnd: nd, r: r,
               xIn: na, xThroatA: nb, xThroatB: nc };
    }
    var pa = 344, pb = 352, pc = 374, pd = 552;     // пластина, сжатое сечение
    var rc = r * Math.sqrt(0.62);
    var hwO = function (x) { return RW; };
    var hfO = function (x) {
      if (x <= pa - 46) return RW;
      if (x <= pa) return lerp(x, pa - 46, pa, RW, r);
      if (x <= pc) return lerp(x, pa, pc, r, rc);
      if (x <= pd) return lerp(x, pc, pd, rc, RW);
      return RW;
    };
    return { hw: hwO, hf: hfO, xMin: pc, xEnd: pd, r: r, rc: rc,
             xIn: pa - 46, xPlate: pa, xPlateB: pb, xThroatA: pa, xThroatB: pc };
  }

  /* Нормированная эпюра: p(x) − p₁ в долях измеряемого перепада Δp.
     До наименьшего сечения — идеальная зависимость Бернулли по площади
     потока; после — восстановление с накоплением безвозвратной потери. */
  function epure(kind, beta, gm, mo) {
    var aMin = mo.a;                                 // A_сж/A₁
    var qk = 1 / (1 / (aMin * aMin) - 1);            // Δp = q₁(1/a² − 1)
    var perm = mo.lossRel;
    return function (x) {
      if (x <= gm.xIn) return 0;
      if (x <= gm.xMin) {
        /* сжатие струи у диафрагмы уже заложено в контуре hf(x) */
        var aa = Math.pow(gm.hf(x) / RW, 2);
        return -qk * (1 / (aa * aa) - 1);
      }
      /* восстановление: идеальная часть по расширению струи + рост потери */
      var ar = Math.pow(gm.hf(x) / RW, 2);
      var ideal = -qk * (1 / (ar * ar) - 1);
      var s = (x - gm.xMin) / (gm.xEnd - gm.xMin);
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      s = 1 - Math.exp(-3 * s);                      // потеря копится быстрее к началу
      s = s / (1 - Math.exp(-3));
      var p = ideal - perm * s;
      var floor = -perm;
      return p > floor ? floor : p;                  // не выше уровня остатка
    };
  }

  function el(tag, at) {
    var n = document.createElementNS(NS, tag);
    for (var k in at) n.setAttribute(k, at[k]);
    return n;
  }

  /* ======================================================================
     ПАНЕЛЬ 1. Течение через сужение и эпюра давления
     ====================================================================== */
  var flow = (function () {
    var svg = $('fmFlow');
    if (!svg) return null;
    var gStatic = $('fmStatic'), gParts = $('fmParts');
    var PN = 130, parts = [];
    for (var i = 0; i < PN; i++) {
      parts.push({ x: X0 + Math.random() * (X1 - X0),
                   f: (Math.random() * 2 - 1) * 0.86 });
    }
    var state = { kind: 'venturi', beta: 0.5, gm: null, mo: null, ep: null };

    var EY0 = 228, EYK = 92;                        // уровень p₁ и масштаб 1·Δp

    function rebuild() {
      state.kind = $('fmType').value;
      state.beta = parseFloat($('fmBeta').value);
      $('fmBetaOut').textContent = fmt(state.beta, 2);
      state.gm = geom(state.kind, state.beta);
      var fl = FLUIDS.w20;
      state.mo = model(state.kind, 0.1, state.beta, 25000, fl);
      state.ep = epure(state.kind, state.beta, state.gm, state.mo);
      draw();
    }

    function wallPath(h, sign) {
      var s = '', first = true;
      for (var x = X0; x <= X1; x += 4) {
        s += (first ? 'M ' : 'L ') + x + ' ' + (AXY + sign * h(x)).toFixed(1);
        first = false;
      }
      return s;
    }

    function draw() {
      var gm = state.gm, mo = state.mo, kind = state.kind;
      var s = '';
      s += '<text x="320" y="18" text-anchor="middle" style="font:600 12px system-ui;fill:#16161a">'
        + 'Течение через сужение и давление вдоль оси: ' + mo.dev.title + '</text>';
      /* стенки канала */
      s += '<path d="' + wallPath(gm.hw, -1) + '" fill="none" stroke="#16161a" stroke-width="2"/>';
      s += '<path d="' + wallPath(gm.hw, 1) + '" fill="none" stroke="#16161a" stroke-width="2"/>';
      /* заливка потока */
      var up = wallPath(gm.hf, -1);
      var dn = [];
      for (var x = X1; x >= X0; x -= 4) dn.push(x + ' ' + (AXY + gm.hf(x)).toFixed(1));
      s += '<path d="' + up + ' L ' + dn.join(' L ') + ' Z" fill="#155e75" fill-opacity=".08"/>';
      /* ось */
      s += '<line x1="' + X0 + '" y1="' + AXY + '" x2="' + X1 + '" y2="' + AXY
        + '" stroke="#6b6b74" stroke-width=".8" stroke-dasharray="7 5"/>';
      /* деталь прибора */
      if (kind === 'orifice') {
        s += '<rect x="' + gm.xPlate + '" y="' + (AXY - RW) + '" width="8" height="'
          + (RW - gm.r) + '" fill="#16161a" fill-opacity=".75"/>';
        s += '<rect x="' + gm.xPlate + '" y="' + (AXY + gm.r) + '" width="8" height="'
          + (RW - gm.r) + '" fill="#16161a" fill-opacity=".75"/>';
        s += '<text x="' + (gm.xPlate + 4) + '" y="' + (AXY + RW + 18)
          + '" text-anchor="middle" style="font:11px system-ui;fill:#16161a">диск с отверстием</text>';
        /* вихревые зоны за пластиной */
        s += vortex(gm.xPlate + 34, AXY - (RW + gm.r) / 2 - 4, 1);
        s += vortex(gm.xPlate + 34, AXY + (RW + gm.r) / 2 + 4, -1);
        s += '<text x="' + (gm.xPlate + 96) + '" y="' + (AXY - RW + 14)
          + '" style="font:11px system-ui;fill:#b3382e">зоны отрыва</text>';
      } else if (kind === 'nozzle') {
        s += '<path d="M ' + gm.xIn + ' ' + (AXY - RW) + ' Q ' + (gm.xThroatA - 8) + ' '
          + (AXY - RW) + ' ' + gm.xThroatA + ' ' + (AXY - gm.r) + ' L ' + gm.xThroatB + ' '
          + (AXY - gm.r) + '" fill="none" stroke="#16161a" stroke-width="2.4"/>';
        s += '<path d="M ' + gm.xIn + ' ' + (AXY + RW) + ' Q ' + (gm.xThroatA - 8) + ' '
          + (AXY + RW) + ' ' + gm.xThroatA + ' ' + (AXY + gm.r) + ' L ' + gm.xThroatB + ' '
          + (AXY + gm.r) + '" fill="none" stroke="#16161a" stroke-width="2.4"/>';
        s += '<text x="' + (gm.xIn + 10) + '" y="' + (AXY - RW - 8)
          + '" style="font:11px system-ui;fill:#16161a">профиль сопла</text>';
        s += vortex(gm.xThroatB + 44, AXY - (RW + gm.r) / 2 - 6, 1);
        s += vortex(gm.xThroatB + 44, AXY + (RW + gm.r) / 2 + 6, -1);
        s += '<text x="' + (gm.xThroatB + 104) + '" y="' + (AXY - RW + 14)
          + '" style="font:11px system-ui;fill:#b3382e">зоны отрыва</text>';
      } else {
        s += '<text x="' + ((gm.xThroatA + gm.xThroatB) / 2) + '" y="' + (AXY + gm.r + 16)
          + '" text-anchor="middle" style="font:11px system-ui;fill:#16161a">горло</text>';
        s += '<text x="470" y="' + (AXY - RW - 8)
          + '" text-anchor="middle" style="font:11px system-ui;fill:#1a7f37">диффузор: давление возвращается</text>';
      }
      /* сечения отбора давления */
      var xT = (gm.xThroatA + gm.xThroatB) / 2;
      s += tap(gm.xIn - 34, gm.hw(gm.xIn - 34), 'p₁');
      s += tap(xT, gm.hw(xT), 'p₂');
      /* створ наименьшего сечения — связывает канал и эпюру */
      s += '<line x1="' + gm.xMin.toFixed(1) + '" y1="' + (AXY + RW + 6) + '" x2="'
        + gm.xMin.toFixed(1) + '" y2="' + (EY0 + EYK + 4)
        + '" stroke="#c9c6bd" stroke-width="1" stroke-dasharray="4 4"/>';

      /* --- эпюра --- */
      s += '<line x1="' + X0 + '" y1="' + EY0 + '" x2="' + X1 + '" y2="' + EY0
        + '" stroke="#16161a" stroke-width="1.2"/>';
      s += '<text x="' + (X0 - 6) + '" y="' + (EY0 + 4)
        + '" text-anchor="end" style="font:11px system-ui;fill:#6b6b74">p₁</text>';
      s += '<line x1="' + X0 + '" y1="' + (EY0 + EYK) + '" x2="' + X1 + '" y2="' + (EY0 + EYK)
        + '" stroke="#c9c6bd" stroke-width="1" stroke-dasharray="5 4"/>';
      s += '<text x="' + (X0 - 6) + '" y="' + (EY0 + EYK + 4)
        + '" text-anchor="end" style="font:11px system-ui;fill:#6b6b74">p₁−Δp</text>';
      var pts = [];
      for (var xx = X0; xx <= X1; xx += 3) {
        pts.push(xx + ',' + (EY0 - state.ep(xx) * EYK).toFixed(1));
      }
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#b3382e" stroke-width="2.4"/>';
      /* остаточный уровень и стрелка потери */
      var yRes = EY0 + mo.lossRel * EYK;
      s += '<line x1="' + (X1 - 210) + '" y1="' + yRes.toFixed(1) + '" x2="' + X1
        + '" y2="' + yRes.toFixed(1) + '" stroke="#1a7f37" stroke-width="1.2" stroke-dasharray="4 4"/>';
      s += '<line x1="' + (X1 - 26) + '" y1="' + EY0 + '" x2="' + (X1 - 26) + '" y2="'
        + (yRes - 1).toFixed(1) + '" stroke="#1a7f37" stroke-width="1.6" marker-end="url(#arrE)"/>';
      s += '<text x="' + X0 + '" y="' + (EY0 + EYK + 26)
        + '" style="font:11px system-ui;fill:#6b6b74">давление в долях Δp · C = '
        + fmt(mo.C, 3) + ' · β = ' + fmt(state.beta, 2) + '</text>';
      s += '<text x="' + X1 + '" y="' + (EY0 + EYK + 26)
        + '" text-anchor="end" style="font:600 11px system-ui;fill:#1a7f37">'
        + 'безвозвратная потеря ' + fmt(mo.lossRel * 100, 0) + ' % Δp</text>';
      gStatic.innerHTML = s;
    }

    function tap(x, h, label) {
      return '<line x1="' + x.toFixed(1) + '" y1="' + (AXY - h).toFixed(1) + '" x2="'
        + x.toFixed(1) + '" y2="' + (AXY - RW - 20)
        + '" stroke="#155e75" stroke-width="1.4"/>'
        + '<text x="' + x.toFixed(1) + '" y="' + (AXY - RW - 25) + '" text-anchor="middle" '
        + 'style="font:600 11px system-ui;fill:#155e75">' + label + '</text>';
    }
    function vortex(cx, cy, dir) {
      var r = 11;
      return '<path d="M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 1 '
        + (dir > 0 ? 1 : 0) + ' ' + (cx + r) + ' ' + cy
        + '" fill="none" stroke="#b3382e" stroke-width="1.4" marker-end="url(#arrE)"/>';
    }

    /* частицы */
    var run = true;
    function tick(dt) {
      if (!run) return;
      var gm = state.gm, mo = state.mo;
      var s = '';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var h = gm.hf(p.x);
        /* скорость обратно пропорциональна площади потока, общий уровень —
           пропорционален расходу, то есть коэффициенту расхода прибора */
        var v = 26 * Math.pow(RW / h, 2) * (mo.C * mo.E / 1.028);
        p.x += v * dt;
        if (p.x > X1) { p.x = X0; p.f = (Math.random() * 2 - 1) * 0.86; }
        var y = AXY + p.f * gm.hf(p.x);
        s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + y.toFixed(1)
          + '" r="2.1" fill="#155e75" fill-opacity=".75"/>';
      }
      gParts.innerHTML = s;
    }

    $('fmType').addEventListener('change', rebuild);
    $('fmBeta').addEventListener('input', rebuild);
    $('fmPause').addEventListener('click', function () {
      run = !run;
      this.textContent = run ? '⏸ пауза' : '▶ пуск';
    });
    rebuild();
    return { tick: tick };
  })();

  /* ======================================================================
     ПАНЕЛЬ 2. Кавитация в горле
     ====================================================================== */
  var cav = (function () {
    var svg = $('fmCav');
    if (!svg) return null;
    var gS = $('fmCavStatic'), gB = $('fmCavBub');
    var gm = geom('venturi', 0.5);
    var CY0 = 196, CH = 148, PMAX = 400;            // кПа на всю шкалу
    var bubbles = [];
    var st = { p1: 200, dp: 60, t: 20, cav: false, xa: 0, xb: 0 };

    function yOf(p) { return CY0 + CH - p / PMAX * CH; }

    function refresh() {
      st.p1 = parseFloat($('cvP1').value);
      st.dp = parseFloat($('cvDp').value);
      st.t = parseFloat($('cvT').value);
      $('cvP1Out').textContent = fmt(st.p1);
      $('cvDpOut').textContent = fmt(st.dp);
      $('cvTOut').textContent = fmt(st.t);
      var ps = psat(st.t);
      var mo = model('venturi', 0.1, 0.5, st.dp * 1000, FLUIDS.w20);
      var ep = epure('venturi', 0.5, gm, mo);
      var pmin = st.p1 - st.dp;
      st.cav = pmin <= ps;

      var s = '';
      s += '<text x="320" y="18" text-anchor="middle" style="font:600 12px system-ui;fill:#16161a">'
        + 'Кавитация в горле: абсолютное давление вдоль оси</text>';
      /* канал */
      var up = '', dn = [];
      for (var x = X0; x <= X1; x += 4) {
        up += (x === X0 ? 'M ' : 'L ') + x + ' ' + (AXY - gm.hw(x)).toFixed(1);
      }
      for (var x2 = X1; x2 >= X0; x2 -= 4) dn.push(x2 + ' ' + (AXY + gm.hw(x2)).toFixed(1));
      s += '<path d="' + up + ' L ' + dn.join(' L ') + ' Z" fill="#155e75" fill-opacity=".08" '
        + 'stroke="#16161a" stroke-width="2"/>';
      s += '<line x1="' + X0 + '" y1="' + AXY + '" x2="' + X1 + '" y2="' + AXY
        + '" stroke="#6b6b74" stroke-width=".8" stroke-dasharray="7 5"/>';

      /* эпюра абсолютного давления */
      s += '<line x1="' + X0 + '" y1="' + (CY0 + CH) + '" x2="' + X1 + '" y2="' + (CY0 + CH)
        + '" stroke="#16161a" stroke-width="1.2"/>';
      s += '<text x="' + (X0 - 6) + '" y="' + (CY0 + CH + 4)
        + '" text-anchor="end" style="font:11px system-ui;fill:#6b6b74">0</text>';
      [100, 200, 300, 400].forEach(function (p) {
        s += '<line x1="' + X0 + '" y1="' + yOf(p).toFixed(1) + '" x2="' + X1 + '" y2="'
          + yOf(p).toFixed(1) + '" stroke="#eceae3" stroke-width="1"/>';
        s += '<text x="' + (X0 - 6) + '" y="' + (yOf(p) + 4).toFixed(1)
          + '" text-anchor="end" style="font:11px system-ui;fill:#6b6b74">' + p + '</text>';
      });
      s += '<text x="' + (X0 - 4) + '" y="' + (CY0 - 14)
        + '" style="font:11px system-ui;fill:#6b6b74">p, кПа абс.</text>';
      /* линия насыщения */
      s += '<line x1="' + X0 + '" y1="' + yOf(ps).toFixed(1) + '" x2="' + X1 + '" y2="'
        + yOf(ps).toFixed(1) + '" stroke="#b3382e" stroke-width="1.6" stroke-dasharray="6 4"/>';
      s += '<text x="' + X1 + '" y="' + (yOf(ps) - 6).toFixed(1) + '" text-anchor="end" '
        + 'style="font:600 11px system-ui;fill:#b3382e">p_нас = ' + fmt(ps, 1) + ' кПа при '
        + fmt(st.t) + ' °C</text>';

      /* кривая давления, срезанная снизу линией насыщения */
      var pts = [], xa = null, xb = null;
      for (var xx = X0; xx <= X1; xx += 3) {
        var p = st.p1 + ep(xx) * st.dp;
        if (p <= ps) { if (xa === null) xa = xx; xb = xx; p = ps; }
        pts.push(xx + ',' + yOf(p).toFixed(1));
      }
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#155e75" stroke-width="2.4"/>';
      st.xa = xa === null ? 0 : xa;
      st.xb = xb === null ? 0 : xb;
      if (st.cav && xa !== null) {
        s += '<rect x="' + xa + '" y="' + (AXY - RW) + '" width="' + (xb - xa) + '" height="'
          + (2 * RW) + '" fill="#b3382e" fill-opacity=".07"/>';
        s += '<text x="' + ((xa + xb) / 2) + '" y="' + (AXY - RW - 26) + '" text-anchor="middle" '
          + 'style="font:600 11px system-ui;fill:#b3382e">жидкость вскипает</text>';
        s += '<text x="' + X1 + '" y="' + (AXY + RW + 18)
          + '" text-anchor="end" style="font:11px system-ui;fill:#b3382e">пузырьки схлопываются — эрозия стенки</text>';
      } else {
        s += '<text x="' + ((gm.xThroatA + gm.xThroatB) / 2) + '" y="' + (AXY - RW - 26)
          + '" text-anchor="middle" style="font:600 11px system-ui;fill:#1a7f37">запас '
          + fmt(pmin - ps, 1) + ' кПа</text>';
      }
      gS.innerHTML = s;

      var out = '';
      out += row('\\(p_2 = p_1 - \\Delta p\\)', fmt(st.p1) + ' − ' + fmt(st.dp),
        fmt(pmin, 1) + ' кПа абс.');
      out += row('\\(p_{\\text{нас}}(t)\\)', 'вода при ' + fmt(st.t) + ' °C', fmt(ps, 2) + ' кПа');
      out += row('\\(\\sigma = (p_2 - p_{\\text{нас}})/\\Delta p\\)',
        '(' + fmt(pmin, 1) + ' − ' + fmt(ps, 2) + ')/' + fmt(st.dp), fmt((pmin - ps) / st.dp, 2));
      if (st.cav) {
        out += row('\\(\\Delta p_{\\max} = p_1 - p_{\\text{нас}}\\)',
          fmt(st.p1) + ' − ' + fmt(ps, 2), fmt(st.p1 - ps, 1) + ' кПа');
        out += '<div class="note warn"><b>Кавитация.</b> Давление в горле опустилось до '
          + 'давления насыщенного пара: жидкость вскипает, дальше по потоку пузырьки '
          + 'схлопываются и разрушают стенку. Расчётное \\(p_2\\) получилось '
          + (pmin < 0 ? 'отрицательным — такого давления не бывает: ' : 'ниже \\(p_{\\text{нас}}\\): ')
          + 'на самом деле перепад «запирается» на величине '
          + fmt(st.p1 - ps, 1) + ' кПа, и дальнейший рост расхода его почти не '
          + 'увеличивает — расходомер начинает занижать показания.</div>';
      } else if ((pmin - ps) / st.dp < 1.1) {
        out += '<div class="note tip">Запас до вскипания меньше самого перепада '
          + '(\\(\\sigma &lt; 1{,}1\\)): при колебаниях расхода прибор будет то и дело '
          + 'заходить в кавитацию. Нужно поднять давление в трубопроводе или увеличить '
          + 'β (уменьшить перепад).</div>';
      } else {
        out += '<div class="note ok">Кавитации нет: до вскипания '
          + fmt(pmin - ps, 1) + ' кПа, это ' + fmt((pmin - ps) / (9.81 * 0.9982), 1)
          + ' м столба воды.</div>';
      }
      $('cvOut').innerHTML = out;
      mathify($('cvOut'));
    }

    var acc = 0;
    function tick(dt) {
      if (!st.cav) { if (bubbles.length) { bubbles.length = 0; gB.innerHTML = ''; } return; }
      acc += dt;
      while (acc > 0.02 && bubbles.length < 90) {
        acc -= 0.02;
        bubbles.push({ x: st.xa + Math.random() * Math.max(6, (st.xb - st.xa) * 0.3),
                       f: (Math.random() * 2 - 1) * 0.8, r: 1.2 + Math.random() * 2.2 });
      }
      var s = '';
      for (var i = bubbles.length - 1; i >= 0; i--) {
        var b = bubbles[i];
        b.x += 150 * dt;
        if (b.x > st.xb + 60) { bubbles.splice(i, 1); continue; }
        var fade = b.x > st.xb ? Math.max(0, 1 - (b.x - st.xb) / 60) : 1;
        var rr = b.r * (b.x > st.xb ? fade : 1);
        s += '<circle cx="' + b.x.toFixed(1) + '" cy="'
          + (AXY + b.f * gm.hw(b.x)).toFixed(1) + '" r="' + rr.toFixed(2)
          + '" fill="#fff" stroke="#b3382e" stroke-width="1" stroke-opacity="'
          + fade.toFixed(2) + '"/>';
      }
      gB.innerHTML = s;
    }

    ['cvP1', 'cvDp', 'cvT'].forEach(function (id) {
      $(id).addEventListener('input', refresh);
    });
    $('cvReset').addEventListener('click', function () {
      $('cvP1').value = 200; $('cvDp').value = 60; $('cvT').value = 20; refresh();
    });
    refresh();
    return { tick: tick };
  })();

  /* ======================================================================
     ПАНЕЛЬ 3. Живой расчёт расхода
     ====================================================================== */
  (function () {
    if (!$('fmD')) return;
    var DEF = { fmD: 100, fmB: 0.5, fmDp: 25, fmP1: 300 };

    function compute() {
      var kind = $('fmKind').value;
      var D = parseFloat($('fmD').value) / 1000;
      var beta = parseFloat($('fmB').value);
      var dpk = parseFloat($('fmDp').value);
      var p1k = parseFloat($('fmP1').value);
      var fl = FLUIDS[$('fmFluid').value];
      $('fmDOut').textContent = fmt(D * 1000);
      $('fmBOut').textContent = fmt(beta, 2);
      $('fmDpOut').textContent = fmt(dpk);
      $('fmP1Out').textContent = fmt(p1k);

      var m = model(kind, D, beta, dpk * 1000, fl);
      var d = m.d * 1000;
      var out = '';
      out += row('\\(d = \\beta D\\)', fmt(beta, 2) + '·' + fmt(D * 1000), fmt(d, 1) + ' мм');
      out += row('\\(A_2 = \\pi d^2/4\\)', '3,1416·' + fmt(d, 1) + '²/4·10⁻⁶',
        fmt(m.A2 * 1e4, 2) + ' см² = ' + sci(m.A2, 3) + ' м²');
      out += row('\\(E = 1/\\sqrt{1-\\beta^4}\\)',
        '1/√(1 − ' + fmt(beta, 2) + '⁴)', fmt(m.E, 4));
      out += row('\\(\\sqrt{2\\Delta p/\\rho}\\)',
        '√(2·' + fmt(dpk * 1000) + '/' + fmt(fl.rho, 1) + ')', fmt(m.base, 3) + ' м/с');
      out += row('\\(C\\)', m.dev.title + ', Re = ' + sci(m.Re), fmt(m.C, 4));
      out += row('\\(Q = C\\,E\\,A_2\\sqrt{2\\Delta p/\\rho}\\)',
        fmt(m.C, 4) + '·' + fmt(m.E, 4) + '·' + sci(m.A2, 3)
        + '·' + fmt(m.base, 3),
        fmt(m.Q * 1000, 2) + ' л/с = ' + fmt(m.Q * 3600, 1) + ' м³/ч');
      out += row('\\(\\bar v_1 = Q/A_1\\)',
        fmt(m.Q * 1000, 2) + '·10⁻³/' + sci(m.A1, 3),
        fmt(m.v1, 3) + ' м/с');
      out += row('\\(\\bar v_2 = Q/A_2\\)',
        fmt(m.Q * 1000, 2) + '·10⁻³/' + sci(m.A2, 3),
        fmt(m.v2, 3) + ' м/с');
      out += row('\\(\\mathrm{Re}_D = \\bar v_1 D/\\nu\\)',
        fmt(m.v1, 3) + '·' + fmt(D, 3) + '/' + sci(fl.nu, 3),
        sci(m.Re));
      if (m.dev.eps < 1) {
        out += row('\\(v_{\\text{сж}} = Q/(\\varepsilon A_2)\\)',
          fmt(m.Q * 1000, 2) + '·10⁻³/(0,62·' + sci(m.A2, 3) + ')',
          fmt(m.vc, 3) + ' м/с');
      }
      out += row('\\(\\Delta\\varpi = \\varphi\\,\\rho(v_{\\text{сж}}-\\bar v_1)^2/2\\)',
        fmt(m.dev.phi, 2) + '·' + fmt(fl.rho, 1) + '·(' + fmt(m.vc, 3) + ' − '
        + fmt(m.v1, 3) + ')²/2',
        fmt(m.loss / 1000, 2) + ' кПа = ' + fmt(m.lossRel * 100, 0) + ' % Δp');
      out += row('\\(h_{\\text{п}} = \\Delta\\varpi/(\\rho g)\\)',
        fmt(m.loss, 0) + '/(' + fmt(fl.rho, 1) + '·9,81)',
        fmt(m.loss / (fl.rho * G), 3) + ' м столба среды');

      /* кавитация */
      var ps = fl === FLUIDS.oil ? 0.01 : psat(fl.t);
      var p2 = p1k - dpk;
      out += row('\\(p_2 = p_1 - \\Delta p\\)', fmt(p1k) + ' − ' + fmt(dpk),
        fmt(p2, 1) + ' кПа абс.');
      var badge = '';
      if (p2 <= ps) {
        badge += '<span class="badge bad">кавитация: p₂ ниже p_нас = ' + fmt(ps, 2) + ' кПа</span>';
      } else if ((p2 - ps) / dpk < 1.1) {
        badge += '<span class="badge bad">малый запас до кавитации: σ = '
          + fmt((p2 - ps) / dpk, 2) + '</span>';
      } else {
        badge += '<span class="badge ok">кавитации нет: σ = ' + fmt((p2 - ps) / dpk, 2) + '</span>';
      }
      /* границы применимости стандарта */
      if (m.Re < m.dev.ReMin || m.Re > m.dev.ReMax) {
        badge += '<span class="badge bad">Re вне диапазона стандарта ('
          + sci(m.dev.ReMin) + '…' + sci(m.dev.ReMax) + ')</span>';
      } else {
        badge += '<span class="badge ok">Re в диапазоне стандарта</span>';
      }
      if (beta < m.dev.bMin || beta > m.dev.bMax) {
        badge += '<span class="badge bad">β вне диапазона ' + fmt(m.dev.bMin, 2)
          + '…' + fmt(m.dev.bMax, 2) + '</span>';
      }
      out += '<div>' + badge + '</div>';

      /* погрешность */
      var b4 = Math.pow(beta, 4);
      var kd = 2 + 2 * b4 / (1 - b4), kD = -2 * b4 / (1 - b4);
      var dQ = Math.sqrt(Math.pow(0.005, 2) + Math.pow(kd * 0.001, 2)
        + Math.pow(kD * 0.001, 2) + Math.pow(0.5 * 0.01, 2));
      out += row('\\(k_d = 2 + 2\\beta^4/(1-\\beta^4)\\)',
        '2 + 2·' + fmt(Math.pow(beta, 4), 4) + '/' + fmt(1 - b4, 4), fmt(kd, 2));
      out += row('\\(\\delta_Q\\)',
        'квадратичное сложение: √(0,5² + (' + fmt(kd, 2) + '·0,1)² + ('
        + fmt(Math.abs(kD), 2) + '·0,1)² + (0,5·1)²)',
        fmt(dQ * 100, 2) + ' %');
      out += '<div class="note tip">Перепад входит под корнем, поэтому его '
        + 'погрешность идёт в расход с коэффициентом 0,5, а вот диаметр горла — с '
        + 'коэффициентом ' + fmt(kd, 2) + ': измерять надо прежде всего его.</div>';
      $('fmOut').innerHTML = out;
      mathify($('fmOut'));
    }

    ['fmKind', 'fmD', 'fmB', 'fmDp', 'fmP1', 'fmFluid'].forEach(function (id) {
      $(id).addEventListener('input', compute);
      $(id).addEventListener('change', compute);
    });
    $('fmReset').addEventListener('click', function () {
      Object.keys(DEF).forEach(function (k) { $(k).value = DEF[k]; });
      $('fmKind').value = 'venturi';
      $('fmFluid').value = 'w20';
      compute();
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', compute);
    } else { compute(); }
  })();

  /* общий кадровый цикл */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (flow) flow.tick(dt);
    if (cav) cav.tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
