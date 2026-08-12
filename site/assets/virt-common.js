/* Виртуальный опыт — общие помощники (vanilla JS, без внешних зависимостей).
 * Каждая лаба подключает свой assets/virt-labN.js, который пользуется этим
 * пространством имён VL. */
'use strict';
window.VL = (function () {
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* создать SVG-элемент с атрибутами */
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* число по-русски: запятая вместо точки */
  function fm(x, d) { return x.toFixed(d).replace('.', ','); }
  /* число для LaTeX: 4,25 → 4{,}25 */
  function lm(x, d) { return x.toFixed(d).replace('.', '{,}'); }
  /* целое с разбиением тысяч тонким пробелом: 124900 → 124 900 */
  function fgi(x) {
    return Math.round(x).toLocaleString('ru-RU').replace(/ /g, ' ');
  }

  /* равномерный шум ±a */
  function noise(a) { return (Math.random() * 2 - 1) * a; }

  /* дорисовать KaTeX в динамическом фрагменте (mathfmt.js уже подгрузил
   * рендерер при загрузке страницы; если его нет — просто снять скобки) */
  function mathify(root) {
    if (window.renderMathInElement) {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    } else {
      root.innerHTML = root.innerHTML.replace(/\\\(|\\\)/g, '');
    }
  }

  /* строка «Решения по шагам»: формула = серым подстановка = жирным результат */
  function step(formula, subst, result) {
    return `<div>${formula} = <span style="color:#6b6b74">${subst}</span> = <b>${result}</b></div>`;
  }

  function qget(name) { return new URLSearchParams(location.search).get(name); }
  function qdel(name) {
    const u = new URL(location.href);
    u.searchParams.delete(name);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  /* главный цикл анимации на rAF; fn(dt, t) в секундах */
  function loop(fn) {
    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* «шумящий» отсчёт прибора: значение обновляется не каждый кадр,
   * а с периодом period (как настоящий АЦП), сглаживание к цели с tau */
  function meter(period, tau) {
    return {
      smooth: 0, out: 0, _acc: 1e9, started: false,
      tick(dt, target, noiseFn) {
        if (!this.started) { this.smooth = target; this.started = true; }
        this.smooth += (target - this.smooth) * (1 - Math.exp(-dt / tau));
        this._acc += dt;
        if (this._acc >= period) { this._acc = 0; this.out = noiseFn(this.smooth); }
        return this.out;
      },
    };
  }

  /* оси + сетка для графика виртуальных данных; возвращает функции X(v), Y(v).
   * cfg: {x0,y0,x1,y1 — рамка в px (y0 низ), xmin,xmax,ymin,ymax,
   *       xticks:[{v,label}], yticks:[{v,label}], xlab, ylab} */
  function axes(svg, cfg) {
    const X = v => cfg.x0 + (v - cfg.xmin) / (cfg.xmax - cfg.xmin) * (cfg.x1 - cfg.x0);
    const Y = v => cfg.y0 - (v - cfg.ymin) / (cfg.ymax - cfg.ymin) * (cfg.y0 - cfg.y1);
    const grid = el('g', { stroke: '#eceae3', 'stroke-width': 1 }, svg);
    (cfg.yticks || []).forEach(t => {
      if (Math.abs(t.v - cfg.ymin) > 1e-9)
        el('line', { x1: cfg.x0, y1: Y(t.v), x2: cfg.x1, y2: Y(t.v) }, grid);
    });
    (cfg.xticks || []).forEach(t => {
      if (Math.abs(t.v - cfg.xmin) > 1e-9)
        el('line', { x1: X(t.v), y1: cfg.y1, x2: X(t.v), y2: cfg.y0, }, grid);
    });
    el('line', { x1: cfg.x0, y1: cfg.y0, x2: cfg.x1 + 6, y2: cfg.y0, stroke: '#16161a', 'stroke-width': 1.6 }, svg);
    el('line', { x1: cfg.x0, y1: cfg.y0, x2: cfg.x0, y2: cfg.y1 - 6, stroke: '#16161a', 'stroke-width': 1.6 }, svg);
    const lab = el('g', { style: 'font:11px system-ui;fill:#6b6b74' }, svg);
    (cfg.xticks || []).forEach(t => {
      const tx = el('text', { x: X(t.v), y: cfg.y0 + 14, 'text-anchor': 'middle' }, lab);
      tx.textContent = t.label;
    });
    (cfg.yticks || []).forEach(t => {
      const tx = el('text', { x: cfg.x0 - 6, y: Y(t.v) + 4, 'text-anchor': 'end' }, lab);
      tx.textContent = t.label;
    });
    if (cfg.xlab) {
      const tx = el('text', { x: cfg.x1, y: cfg.y0 + 28, 'text-anchor': 'end' }, lab);
      tx.textContent = cfg.xlab;
    }
    if (cfg.ylab) {
      const tx = el('text', { x: cfg.x0 + 6, y: cfg.y1 + 4 }, lab);
      tx.textContent = cfg.ylab;
    }
    return { X, Y };
  }

  /* ломаная + точки с всплывающими подсказками */
  function series(svg, pts, color, titles) {
    if (pts.length > 1)
      el('polyline', {
        points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '),
        fill: 'none', stroke: color, 'stroke-width': 2,
      }, svg);
    const g = el('g', { fill: color }, svg);
    pts.forEach((p, i) => {
      const c = el('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3.5 }, g);
      if (titles && titles[i]) {
        const t = el('title', {}, c);
        t.textContent = titles[i];
      }
    });
  }

  return { el, fm, lm, fgi, noise, mathify, step, qget, qdel, loop, meter, axes, series };
})();
