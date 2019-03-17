import { blockType, StorageKey } from './const';

const hiddenProperty = (() => { // document[hiddenProperty] canJudgeWhetherThePageIsOutOfFocus
  let names = [
    'hidden',
    'webkitHidden',
    'mozHidden',
    'msHidden',
  ];
  names = names.filter((e) => (e in document));
  return names.length > 0 ? names[0] : false;
})();

const visibilityChangeEvent = (() => {
  if (!hiddenProperty) {
    return false;
  }
  return hiddenProperty.replace(/hidden/i, 'visibilitychange'); // "if_the_attribute_has_a_prefix"
})(); // the_corresponding_event_also_has_a_prefix

const isFocus = () => {
  if (!hiddenProperty) { // if_this_feature_does_not_exist, think_always_focused
    return true;
  }
  return !document[hiddenProperty];
};

const unit = {
  getNextType() { // Randomly get the next block type
    const len = blockType.length;
    return blockType[Math.floor(Math.random() * len)];
  },
  want(next, matrix) { // Can the square move to the specified position?
    const xy = next.xy;
    const shape = next.shape;
    const horizontal = shape.get(0).size;
    return shape.every((m, k1) => (
      m.every((n, k2) => {
        if (xy[1] < 0) { // left
          return false;
        }
        if (xy[1] + horizontal > 10) { // right
          return false;
        }
        if (xy[0] + k1 < 0) { // top
          return true;
        }
        if (xy[0] + k1 >= 20) { // bottom
          return false;
        }
        if (n) {
          if (matrix.get(xy[0] + k1).get(xy[1] + k2)) {
            return false;
          }
          return true;
        }
        return true;
      })
    ));
  },
  isClear(matrix) { // Whether the elimination state is reached
    const clearLines = [];
    matrix.forEach((m, k) => {
      if (m.every(n => !!n)) {
        clearLines.push(k);
      }
    });
    if (clearLines.length === 0) {
      return false;
    }
    return clearLines;
  },
  isOver(matrix) { // Whether the game is over, The first line drops the square as the basis
    return matrix.get(0).some(n => !!n);
  },
  subscribeRecord(store) { // Record status to localStorage
    store.subscribe(() => {
      let data = store.getState().toJS();
      if (data.lock) { // When the status is locked, Not recorded
        return;
      }
      data = JSON.stringify(data);
      data = encodeURIComponent(data);
      if (window.btoa) {
        data = btoa(data);
      }
      localStorage.setItem(StorageKey, data);
    });
  },
  isMobile() { // Determine whether it is a mobile terminal
    const ua = navigator.userAgent;
    const android = /Android (\d+\.\d+)/.test(ua);
    const iphone = ua.indexOf('iPhone') > -1;
    const ipod = ua.indexOf('iPod') > -1;
    const ipad = ua.indexOf('iPad') > -1;
    const nokiaN = ua.indexOf('NokiaN') > -1;
    return android || iphone || ipod || ipad || nokiaN;
  },
  visibilityChangeEvent,
  isFocus,
};

module.exports = unit;
