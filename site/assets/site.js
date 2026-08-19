/* Данные каркаса страниц. Машинерия — assets/shell.js. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  buildSiteShell({
    root,
    page: (me && me.dataset.page) || '',
    brand: 'Механика жидкости и газа',
    logo: `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#155e75"/>
    <text x="15" y="22" text-anchor="middle" font-size="17">💧</text>
  </svg>`,
    nav: [
      { h: '', k: 'index', t: 'Обзор' },
      { t: 'Теория', h: 'theory', drop: [
        { h: 'theory', k: 'theory', t: 'Оглавление курса' },
        { h: 't-props', k: 'theory', t: '1. Жидкость как сплошная среда' },
        { h: 't-forces', k: 'theory', t: '2. Силы и напряжения' },
        { h: 't-statics', k: 'theory', t: '3. Гидростатика' },
        { h: 't-kinematics', k: 'theory', t: '4. Кинематика' },
        { h: 't-bernoulli', k: 'theory', t: '5. Уравнение Бернулли' },
        { h: 't-losses', k: 'theory', t: '6. Режимы течения и потери' },
        { h: 't-similarity', k: 'theory', t: '7. Подобие и моделирование' },
        { h: 't-boundary', k: 'theory', t: '8. Пограничный слой' },
        { h: 't-flowmeters', k: 'theory', t: '9. Расходомеры переменного перепада' },
        { h: 't-ejector', k: 'theory', t: '10. Струйные аппараты (эжекторы)' },
      ] },
      { t: 'Опыты', h: 'lab1', drop: [
        { h: 'lab1', k: 'lab1', t: 'Тарировка микроманометра' },
        { h: 'lab3', k: 'lab3', t: 'Диаграмма Бернулли' },
        { h: 'lab4', k: 'lab4', t: 'Сопротивление шара' },
        { h: 'lab5', k: 'lab5', t: 'Обтекание тела вращения' },
      ] },
      { h: 'sources', k: 'sources', t: 'Источники' },
    ],
    footer: `<div>Учебный сайт по курсу «Механика жидкости и газа» · экспериментальный практикум с разобранными расчётами</div>`,
    markers: `<marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>`,
  });
})();
