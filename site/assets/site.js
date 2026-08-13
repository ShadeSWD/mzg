/* Каркас страниц «Механика жидкости и газа». */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  const page = (me && me.dataset.page) || '';
  const logoSvg = `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#155e75"/>
    <text x="15" y="22" text-anchor="middle" font-size="17">💧</text>
  </svg>`;
  const nav = [
    { h: '', k: 'index', t: 'Обзор' },
    { t: 'Теория', h: 'theory', drop: [
      { h: 'theory', k: 'theory', t: 'Оглавление курса' },
      { h: 't-props', k: 'theory', t: '1. Жидкость как сплошная среда' },
      { h: 't-statics', k: 'theory', t: '2. Гидростатика' },
      { h: 't-kinematics', k: 'theory', t: '3. Кинематика' },
      { h: 't-bernoulli', k: 'theory', t: '4. Уравнение Бернулли' },
      { h: 't-losses', k: 'theory', t: '5. Режимы течения и потери' },
      { h: 't-similarity', k: 'theory', t: '6. Подобие и моделирование' },
      { h: 't-boundary', k: 'theory', t: '7. Пограничный слой' },
    ] },
    { t: 'Опыты', h: 'lab1', drop: [
      { h: 'lab1', k: 'lab1', t: 'Тарировка микроманометра' },
      { h: 'lab3', k: 'lab3', t: 'Диаграмма Бернулли' },
      { h: 'lab4', k: 'lab4', t: 'Сопротивление шара' },
      { h: 'lab5', k: 'lab5', t: 'Обтекание тела вращения' },
    ] },
    { h: 'sources', k: 'sources', t: 'Источники' },
  ];
  const navLink = (it) =>
    `<a href="${root}${it.h}" class="${page === it.k ? 'on' : ''}">${it.t}</a>`;
  const navHtml = nav.map((g) => {
    if (!g.drop) return navLink(g);
    const on = g.drop.some((it) => page === it.k) ? 'on' : '';
    return `<span class="nav-drop"><a href="${root}${g.h}" class="${on}">${g.t} ▾</a>`
      + `<span class="drop">${g.drop.map(navLink).join('')}</span></span>`;
  }).join('');
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logoSvg}<span>Механика жидкости и газа</span></a>
    <nav class="top">${navHtml}</nav>
  </div>`;
  document.body.prepend(header);
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу «Механика жидкости и газа» · экспериментальный практикум с разобранными расчётами</div>
  </div>`;
  onReady(() => document.body.appendChild(footer));
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
  </defs>`;
  onReady(() => document.body.appendChild(defs));
})();
