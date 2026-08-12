// THE DOOR — you do not wake up inside the world; you enter it.
//
// Failure F2: the first integration auto-mounted a default rig into a default
// place, and the threshold that makes entering MEAN something was gone. The
// parent's rule (hw005's HELLO, WORLD ritual): make yourself, see where you
// are, then cross. Here the ritual is small — name your rig, choose its colour,
// read the place's real name — but it is a real threshold: nothing mounts
// until you press ENTER, and that press is also the page's first user gesture,
// which is what lets the engine make sound at all. One click, three unlocks.
//
// The door remembers you (localStorage) and steps aside on return visits.

import { RIG } from '../sim/rig.js';

const KEY = 'terrarium.door';

const SWATCHES = [
  ['teal', [0.10, 0.88, 0.76]], ['ember', [1.00, 0.32, 0.20]],
  ['amber', [1.00, 0.80, 0.25]], ['violet', [0.66, 0.48, 0.92]],
  ['bone', [0.94, 0.95, 0.96]], ['coal', [0.12, 0.13, 0.16]],
];

export function mountDoor(S, enterWorld) {
  const waitThen = (fn) => {
    const t = setInterval(() => { if (S.world && S.world.place && S.cam) { clearInterval(t); fn(); } }, 250);
  };
  let remembered = null;
  try { remembered = localStorage.getItem(KEY); } catch (_) {}
  if (remembered) { waitThen(enterWorld); return null; }

  const veil = document.createElement('div');
  veil.id = 'terrarium-door';
  veil.style.cssText = 'position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(6,9,12,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';

  const card = document.createElement('div');
  card.style.cssText = 'width:min(430px,92vw);background:rgba(12,17,22,.97);border:1px solid rgba(151,187,213,.3);'
    + 'border-radius:16px;padding:26px 28px;color:#e8edf2;font:500 13px/1.5 system-ui,-apple-system,sans-serif;';
  card.innerHTML =
    '<div style="font:800 10px/1 ui-monospace,monospace;letter-spacing:.34em;color:#6fe0c0">HELLO, WORLD</div>'
    + '<div style="font:800 22px/1.2 ui-monospace,monospace;margin:10px 0 2px">TERRARIUM</div>'
    + '<div id="door-place" style="color:#8d9aa5;font:600 10px/1.4 ui-monospace,monospace;letter-spacing:.08em">finding the ground…</div>'
    + '<div style="margin:16px 0 6px;color:#8d9aa5;font-size:11px">Name your rig. It will carry your deeds.</div>';

  const nameInp = document.createElement('input');
  nameInp.placeholder = 'rig name';
  nameInp.value = 'WANDERER';
  nameInp.style.cssText = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);color:#e8edf2;'
    + 'border:1px solid rgba(151,187,213,.3);border-radius:9px;padding:9px 11px;outline:0;'
    + 'font:700 12px/1 ui-monospace,monospace;letter-spacing:.12em;';
  card.appendChild(nameInp);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin:12px 0 18px;';
  let chosen = SWATCHES[0][1];
  for (const [label, rgb] of SWATCHES) {
    const b = document.createElement('button');
    b.title = label;
    b.style.cssText = 'width:30px;height:30px;border-radius:50%;cursor:pointer;border:2px solid transparent;'
      + 'background:rgb(' + rgb.map((v) => Math.round(v * 255)).join(',') + ');';
    if (label === 'teal') b.style.borderColor = '#fff';
    b.addEventListener('click', () => {
      chosen = rgb;
      for (const o of row.children) o.style.borderColor = 'transparent';
      b.style.borderColor = '#fff';
    });
    row.appendChild(b);
  }
  card.appendChild(row);

  const go = document.createElement('button');
  go.textContent = 'ENTER THE TERRARIUM';
  go.style.cssText = 'width:100%;padding:12px;border:0;border-radius:10px;cursor:pointer;background:#df5a5d;'
    + 'color:#fff;font:800 11px/1 ui-monospace,monospace;letter-spacing:.22em;';
  card.appendChild(go);

  const fine = document.createElement('div');
  fine.style.cssText = 'margin-top:12px;color:#5d6b75;font-size:10px;line-height:1.5;';
  fine.textContent = 'Entering is a deed: the world will remember what you build, say and unsettle here.';
  card.appendChild(fine);

  veil.appendChild(card);
  document.body.appendChild(veil);

  // the place introduces itself as soon as it exists
  const intro = setInterval(() => {
    const nm = S.world?.place?.name;
    if (nm) { clearInterval(intro); card.querySelector('#door-place').textContent = 'you are at ' + nm.toUpperCase(); }
  }, 250);

  go.addEventListener('click', () => {
    RIG.color = chosen;
    RIG.name = (nameInp.value || 'WANDERER').trim().slice(0, 24);
    try { localStorage.setItem(KEY, JSON.stringify({ name: RIG.name, at: new Date().toISOString() })); } catch (_) {}
    clearInterval(intro);
    veil.remove();
    waitThen(enterWorld);           // the click was the gesture; sound may follow
  });

  return veil;
}
