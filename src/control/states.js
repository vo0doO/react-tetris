import { List } from 'immutable';
import store from '../store';
import { want, isClear, isOver } from '../unit/';
import actions from '../actions';
import { speeds, blankLine, blankMatrix, clearPoints, eachLines } from '../unit/const';
import { music } from '../unit/music';


const getStartMatrix = (startLines) => { // 生成startLines
  const getLine = (min, max) => { // 返回标亮个数在min~max之间一行方块, (包含边界)
    const count = parseInt((((max - min) + 1) * Math.random()) + min, 10);
    const line = [];
    for (let i = 0; i < count; i++) { // 插入高亮
      line.push(1);
    }
    for (let i = 0, len = 10 - count; i < len; i++) { // 在随机位置插入灰色
      const index = parseInt(((line.length + 1) * Math.random()), 10);
      line.splice(index, 0, 0);
    }

    return List(line);
  };
  let startMatrix = List([]);

  for (let i = 0; i < startLines; i++) {
    if (i <= 2) { // 0-3
      startMatrix = startMatrix.push(getLine(5, 8));
    } else if (i <= 6) { // 4-6
      startMatrix = startMatrix.push(getLine(4, 9));
    } else { // 7-9
      startMatrix = startMatrix.push(getLine(3, 9));
    }
  }
  for (let i = 0, len = 20 - startLines; i < len; i++) { // 插入上部分的灰色
    startMatrix = startMatrix.unshift(List(blankLine));
  }
  return startMatrix;
};

const states = {
  // 自动下落setTimeout变量
  fallInterval: null,

  // Начало игры
  start: () => {
    if (music.start) {
      music.start();
    }
    const state = store.getState();
    states.dispatchPoints(0);
    store.dispatch(actions.speedRun(state.get('speedStart')));
    const startLines = state.get('startLines');
    const startMatrix = getStartMatrix(startLines);
    store.dispatch(actions.matrix(startMatrix));
    store.dispatch(actions.moveBlock({ type: state.get('next') }));
    store.dispatch(actions.nextBlock());
    states.auto();
  },

  // Автоматическое падение
  auto: (timeout) => {
    const out = (timeout < 0 ? 0 : timeout);
    let state = store.getState();
    let cur = state.get('cur');
    const fall = () => {
      state = store.getState();
      cur = state.get('cur');
      const next = cur.fall();
      if (want(next, state.get('matrix'))) {
        store.dispatch(actions.moveBlock(next));
        states.fallInterval = setTimeout(fall, speeds[state.get('speedRun') - 1]);
      } else {
        let matrix = state.get('matrix');
        const shape = cur && cur.shape;
        const xy = cur && cur.xy;
        shape.forEach((m, k1) => (
          m.forEach((n, k2) => {
            if (n && xy.get(0) + k1 >= 0) { // Вертикальные координаты могут быть отрицательными
              let line = matrix.get(xy.get(0) + k1);
              line = line.set(xy.get(1) + k2, 1);
              matrix = matrix.set(xy.get(0) + k1, line);
            }
          })
        ));
        states.nextAround(matrix);
      }
    };
    clearTimeout(states.fallInterval);
    states.fallInterval = setTimeout(fall,
      out === undefined ? speeds[state.get('speedRun') - 1] : out);
  },

  // Конец квадрата, вызвать следующий
  nextAround: (matrix, stopDownTrigger) => {
    clearTimeout(states.fallInterval);
    store.dispatch(actions.lock(true));
    store.dispatch(actions.matrix(matrix));
    if (typeof stopDownTrigger === 'function') {
      stopDownTrigger();
    }

    const addPoints = (store.getState().get('points') + 10) +
      ((store.getState().get('speedRun') - 1) * 2); // быстрее, Более высокий балл

    states.dispatchPoints(addPoints);

    if (isClear(matrix)) {
      if (music.clear) {
        music.clear();
      }
      return;
    }
    if (isOver(matrix)) {
      if (music.gameover) {
        music.gameover();
      }
      states.overStart();
      return;
    }
    setTimeout(() => {
      store.dispatch(actions.lock(false));
      store.dispatch(actions.moveBlock({ type: store.getState().get('next') }));
      store.dispatch(actions.nextBlock());
      states.auto();
    }, 100);
  },

  // Преобразование фокуса страницы
  focus: (isFocus) => {
    store.dispatch(actions.focus(isFocus));
    if (!isFocus) {
      clearTimeout(states.fallInterval);
      return;
    }
    const state = store.getState();
    if (state.get('cur') && !state.get('reset') && !state.get('pause')) {
      states.auto();
    }
  },

  // пауза
  pause: (isPause) => {
    store.dispatch(actions.pause(isPause));
    if (isPause) {
      clearTimeout(states.fallInterval);
      return;
    }
    states.auto();
  },

  // Устранить линии
  clearLines: (matrix, lines) => {
    const state = store.getState();
    let newMatrix = matrix;
    lines.forEach(n => {
      newMatrix = newMatrix.splice(n, 1);
      newMatrix = newMatrix.unshift(List(blankLine));
    });
    store.dispatch(actions.matrix(newMatrix));
    store.dispatch(actions.moveBlock({ type: state.get('next') }));
    store.dispatch(actions.nextBlock());
    states.auto();
    store.dispatch(actions.lock(false));
    const clearLines = state.get('clearLines') + lines.length;
    store.dispatch(actions.clearLines(clearLines)); // Обновить строку исключения

    const addPoints = store.getState().get('points') +
      clearPoints[lines.length - 1]; // Больше строк, которые удаляются за один раз,
    states.dispatchPoints(addPoints); // Чем больше очков вы добавляете

    const speedAdd = Math.floor(clearLines / eachLines); // Исключить количество рядов,
    let speedNow = state.get('speedStart') + speedAdd;  // Увеличьте соответствующую скорость
    speedNow = speedNow > 6 ? 6 : speedNow;
    store.dispatch(actions.speedRun(speedNow));
  },

  // Конец игры, Триггерная анимация
  overStart: () => {
    clearTimeout(states.fallInterval);
    store.dispatch(actions.lock(true));
    store.dispatch(actions.reset(true));
    store.dispatch(actions.pause(false));
  },

  // Анимация окончания игры завершена
  overEnd: () => {
    store.dispatch(actions.matrix(blankMatrix));
    store.dispatch(actions.moveBlock({ reset: true }));
    store.dispatch(actions.reset(false));
    store.dispatch(actions.lock(false));
    store.dispatch(actions.clearLines(0));
  },

  // Написать счет
  dispatchPoints: (point) => { // Написать счет, Также судите, стоит ли создавать самый высокий балл
    store.dispatch(actions.points(point));
    if (point > 0 && point > store.getState().get('max')) {
      store.dispatch(actions.max(point));
    }
  },
};

export default states;
