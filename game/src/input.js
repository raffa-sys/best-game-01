// SPDX-License-Identifier: MIT
// Nova Harvest — keyboard and mouse, read once a frame. Movement keys give a
// normalised direction; the mouse aims; actions are edge-triggered so one press
// is one confirm, pause, nova or restart, however long the key is held.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOVA = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 640;
  let mouseY = 300;
  let mouseDown = false;
  let mouseClicked = false;
  let rightClicked = false;

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS.has(event.code) || event.code === 'Space') event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = toField(event);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toField(event);
    mouseX = p.x;
    mouseY = p.y;
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    } else if (event.button === 2) {
      rightClicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  return {
    /** Normalised WASD / arrow movement, {x, y} in [-1, 1]. */
    direction,
    /** Where the mouse points, in field coordinates. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    /** True while the left button or Space is held: the fire button. */
    firing() {
      return mouseDown || keys.has('Space');
    },
    /** Edge-triggered actions since the last call; each bit fires once. */
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('Space') || mouseClicked) actions |= ACTION_CONFIRM;
      if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyE') || rightClicked) actions |= ACTION_NOVA;
      if (pressed.has('KeyR')) actions |= ACTION_RESTART;
      if (pressed.has('KeyM')) actions |= ACTION_MUTE;
      pressed.clear();
      mouseClicked = false;
      rightClicked = false;
      return actions;
    },
  };
}
