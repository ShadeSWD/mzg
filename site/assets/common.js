/* common.js — мелкие помощники, общие для страниц виртуальных опытов:
 * обёртка над getElementById, бегущий пунктир потока и подпись хода
 * авто-прогона. Подключается перед virt-common.js (пространство имён VL). */
'use strict';

/* Элемент страницы по id. */
const $ = (id) => document.getElementById(id);

/* Бегущий пунктир: сдвигает штрихи у всех линий группы.
   off — накопленный сдвиг, period — длина цикла, gap — сдвиг между линиями. */
const dashFlow = (groupId, off, period, gap) => {
  [...$(groupId).children].forEach((ln, i) => {
    ln.style.strokeDashoffset = ((off % period) - i * gap) + 'px';
  });
};

/* Подпись хода авто-прогона для VL.auto: «сечение 3 из 6». */
const progressLabel = (id, word) => (i, n) => {
  const p = $(id);
  p.style.display = '';
  p.textContent = `${word} ${i} из ${n}`;
};
