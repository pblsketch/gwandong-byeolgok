'use strict';
// 입력: 키보드 + 터치 버튼을 같은 '행동'으로 묶는다.
(function () {
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump',
    KeyJ: 'attack', KeyX: 'attack',
    KeyK: 'cast', KeyC: 'cast',
    KeyL: 'mind', ShiftLeft: 'mind', ShiftRight: 'mind', KeyQ: 'mind',
    Enter: 'ok', KeyE: 'ok', NumpadEnter: 'ok',
    Escape: 'pause', KeyP: 'pause',
    Digit1: 'n1', Digit2: 'n2', Digit3: 'n3', Digit4: 'n4', Digit5: 'n5',
    Numpad1: 'n1', Numpad2: 'n2', Numpad3: 'n3', Numpad4: 'n4', Numpad5: 'n5',
  };
  const down = {}, pressed = {}, released = {};
  const touchDown = {};

  const I = G.input = {
    down: (a) => !!(down[a] || touchDown[a]),
    pressed: (a) => !!pressed[a],
    released: (a) => !!released[a],
    anyPressed: () => Object.keys(pressed).length > 0,
    // 프레임 끝에 호출
    endFrame() { for (const k in pressed) delete pressed[k]; for (const k in released) delete released[k]; },
    press(a) { if (!I.down(a)) pressed[a] = true; },
    isTouch: false,
    listeners: [],   // UI가 키를 가로챌 때 쓰는 리스너 (true를 돌려주면 게임에 전달 안 함)
    lastDevice: 'key',
  };

  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    I.lastDevice = 'key';
    G.audio && G.audio.unlock();
    for (let i = I.listeners.length - 1; i >= 0; i--) { if (I.listeners[i](a, e)) { e.preventDefault(); return; } }
    if (!down[a]) pressed[a] = true;
    down[a] = true;
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    down[a] = false;
    released[a] = true;
  });
  window.addEventListener('blur', () => { for (const k in down) down[k] = false; for (const k in touchDown) touchDown[k] = false; });

  // ---------------- 터치 버튼 ----------------
  const BTN = [
    { a: 'left', label: '◀', side: 'L', x: 0.07, y: 0.80, r: 0.075 },
    { a: 'right', label: '▶', side: 'L', x: 0.21, y: 0.80, r: 0.075 },
    { a: 'jump', label: '점프', side: 'R', x: 0.915, y: 0.80, r: 0.085 },
    { a: 'attack', label: '붓', side: 'R', x: 0.775, y: 0.84, r: 0.065 },
    { a: 'cast', label: '옥절', side: 'R', x: 0.80, y: 0.64, r: 0.058 },
    { a: 'mind', label: '마음', side: 'R', x: 0.925, y: 0.58, r: 0.058 },
    { a: 'pause', label: 'Ⅱ', side: 'L', x: 0.045, y: 0.25, r: 0.04 },
  ];
  I.buttons = {};
  I.buildTouch = function () {
    const root = document.getElementById('touch');
    root.innerHTML = '';
    for (const b of BTN) {
      const el = document.createElement('div');
      el.className = 'tb';
      el.dataset.a = b.a;
      el.innerHTML = b.label;
      root.appendChild(el);
      I.buttons[b.a] = { el, def: b };
      const start = (e) => {
        e.preventDefault();
        I.isTouch = true; I.lastDevice = 'touch';
        G.audio && G.audio.unlock();
        el.classList.add('down');
        let handled = false;
        for (let i = I.listeners.length - 1; i >= 0; i--) { if (I.listeners[i](b.a, e)) { handled = true; break; } }
        if (!handled) { if (!touchDown[b.a]) pressed[b.a] = true; touchDown[b.a] = true; }
      };
      const end = (e) => { e.preventDefault(); el.classList.remove('down'); if (touchDown[b.a]) released[b.a] = true; touchDown[b.a] = false; };
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
    }
    I.layoutTouch();
  };
  I.layoutTouch = function () {
    const r = G.screenRect;
    if (!r) return;
    const s = Math.min(r.w, r.h * 16 / 9);
    for (const k in I.buttons) {
      const { el, def } = I.buttons[k];
      const d = Math.max(44, def.r * 2 * s * 0.62);
      el.style.width = el.style.height = d + 'px';
      el.style.left = (r.x + def.x * r.w - d / 2) + 'px';
      el.style.top = (r.y + def.y * r.h - d / 2) + 'px';
      el.style.fontSize = Math.max(13, d * 0.3) + 'px';
    }
  };
  I.setTouchVisible = function (on) {
    document.getElementById('touch').classList.toggle('on', !!on && I.isTouch);
  };
  I.setTouchButton = function (a, visible, label) {
    const b = I.buttons[a];
    if (!b) return;
    b.el.classList.toggle('hidden', !visible);
    if (label) b.el.innerHTML = label;
  };
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { I.isTouch = true; } }, true);
  window.addEventListener('touchstart', () => { I.isTouch = true; }, { passive: true, capture: true });
})();
