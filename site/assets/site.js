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
    { href: '', key: 'index', title: 'Обзор' },
    { href: 'theory', key: 'theory', title: 'Теория' },
    { href: 'lab1', key: 'lab1', title: 'Лаб. 1 · Микроманометр' },
    { href: 'lab3', key: 'lab3', title: 'Лаб. 3 · Трубопровод' },
    { href: 'lab4', key: 'lab4', title: 'Лаб. 4 · Шар' },
    { href: 'lab5', key: 'lab5', title: 'Лаб. 5 · Тело вращения' },
    { href: 'sources', key: 'sources', title: 'Источники' },
  ];
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logoSvg}<span>Механика жидкости и газа</span></a>
    <nav class="top">${nav.map(({ href, key, title }) =>
      `<a href="${root}${href}" class="${page === key ? 'on' : ''}">${title}</a>`).join('')}</nav>
  </div>`;
  document.body.prepend(header);
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу «Механика жидкости и газа» · экспериментальный практикум с разобранными расчётами</div>
  </div>`;
  document.body.appendChild(footer);
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
  </defs>`;
  document.body.appendChild(defs);
})();
