"use strict";
const $ = (id) => document.getElementById(id);
const stages = [
  {
    kind: "turn",
    goalTurn: 1, // 0 = はじめの形、1 = 90度回して行と列を入れかえた形
    rows: 7,
    cols: 4,
    label: "ならべかえ",
    mission: "ねこを <em>4行 × 7列</em> に ならべかえよう！",
    instruction: "黄色のハンドルを右へ。ねこたちの向きを、くるっとかえよう。",
    hint: "黄色の ↔ を右へ、いっぱいひっぱってみよう。たてと よこの数は、どうなるかな？",
    discovery: "かける数を 入れかえても…",
    lesson:
      "形がかわっても、ねこは 28ひき。<br>かける数を 入れかえても、答えは おなじ！",
  },
  {
    kind: "split",
    rows: 7,
    cols: 4,
    goal: 3,
    label: "ふたつに分ける",
    mission: "<em>3行と4行</em> の グループに 分けよう！",
    instruction: "緑のハンドルを上下に。分ける場所を さがしてみよう。",
    hint: "上から 3行ぶんを 数えてみよう。その下で分けると、のこりは 何行かな？",
    discovery: "ふたつに 分けて、たしても…",
    lesson:
      "分けた ねこを ぜんぶたすと、もとの数。<br>かけ算は、分けて 計算できるね！",
  },
  {
    kind: "split",
    rows: 12,
    cols: 4,
    goal: 10,
    label: "くふうして計算",
    mission: "12 × 4 を <em>10 × 4 と 2 × 4</em> に 分けよう！",
    instruction: "計算しやすい 10行と、のこりの 2行に 分けてみよう。",
    hint: "上のグループが 10行になるまで、緑の ↕ を下へ。10が 4つなら、いくつかな？",
    discovery: "大きな数も、分ければ かんたん！",
    lesson:
      "10行の 40ひきと、2行の 8ひき。<br>計算しやすい数に 分けると、べんりだね！",
  },
];
const svgNS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs, content = "") => {
  const n = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.innerHTML = content;
  return n;
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
let current = 0,
  turn = 0,
  visibleTurn = 0,
  split = 1,
  drag = null,
  won = false,
  pending = false,
  cats = [],
  targets = [],
  sound = false,
  audio,
  raf = 0,
  lastTime = 0;
const completed = new Set(),
  timers = new Set(),
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
function later(fn, ms) {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
}
function tone(type) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const notes =
      type === "win"
        ? [523, 659, 784, 1046]
        : type === "snap"
          ? [440, 587]
          : [330];
    notes.forEach((f, i) => {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        t = audio.currentTime + i * 0.09;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.065, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.17);
    });
  } catch {
    sound = false;
    updateSound();
  }
}
function updateSound() {
  $("sound").setAttribute("aria-pressed", String(sound));
  $("sound").setAttribute(
    "aria-label",
    sound ? "音をオフにする" : "音をオンにする",
  );
  $("sound").innerHTML = `♪<span>${sound ? "ON" : "OFF"}</span>`;
}
function reset(i = current) {
  timers.forEach(clearTimeout);
  timers.clear();
  cancelAnimationFrame(raf);
  raf = 0;
  lastTime = 0;
  if (drag) finishDrag(null, true);
  $("clear-dialog").close();
  current = i;
  turn = 0;
  visibleTurn = 0;
  split = 1;
  drag = null;
  won = false;
  pending = false;
  const s = stages[i];
  $("board").parentElement.classList.remove("dragging", "celebrating");
  $("board").parentElement.classList.add("entering");
  later(() => $("board").parentElement.classList.remove("entering"), 800);
  $("continue").hidden = true;
  $("proof").style.fontSize = "";
  $("mission").innerHTML = s.mission;
  $("instruction").textContent = s.instruction;
  $("stage-label").textContent = `STAGE 0${i + 1} ・ ${s.label}`;
  $("page-count").textContent = `0${i + 1} / 03`;
  $("total").textContent = s.rows * s.cols;
  $("hint-text").hidden = true;
  $("hint").textContent = "☀ ヒントをみる";
  $("feedback").textContent = "ねこの数は、そのまま。";
  $("confetti").replaceChildren();
  document.querySelectorAll("[data-stage]").forEach((b, j) => {
    b.classList.toggle("active", j === i);
    b.classList.toggle("done", completed.has(j));
    b.setAttribute("aria-current", j === i ? "step" : "false");
  });
  const handle = $("handle");
  handle.classList.toggle("split", s.kind === "split");
  handle.innerHTML = `<span>${s.kind === "split" ? "↕" : "↔"}</span>`;
  handle.setAttribute(
    "aria-label",
    s.kind === "split"
      ? "グループを分ける線。上下の矢印キーでもうごかせます"
      : "隊列を回す。左右の矢印キーでもうごかせます",
  );
  handle.setAttribute("aria-valuemax", s.kind === "split" ? s.rows - 1 : 100);
  handle.setAttribute("aria-valuemin", s.kind === "split" ? 1 : 0);
  $("cats").replaceChildren();
  cats = [];
  for (let n = 0; n < s.rows * s.cols; n++) {
    const node = svg(
      "g",
      {
        "data-cat": n,
        "aria-hidden": "true",
        style: `--delay:${(n % 12) * 0.018}s`,
      },
      catArt(n),
    );
    $("cats").append(node);
    cats.push({ node, x: 380, y: -40 });
  }
  layout(true);
}
function geometry() {
  const s = stages[current];
  return {
    pitch: s.rows === 12 ? 33 : 48,
    top: s.rows === 12 ? 32 : 62,
    gap: 34,
  };
}
function layout(initial = false) {
  const s = stages[current],
    { pitch, top, gap } = geometry();
  targets = [];
  $("backdrop").replaceChildren();
  $("labels").replaceChildren();
  let hx, hy;
  if (s.kind === "turn") {
    const angle = (-turn * Math.PI) / 2,
      p = 48,
      cx = 380,
      cy = 239;
    for (let n = 0; n < cats.length; n++) {
      const col = n % 4,
        row = Math.floor(n / 4),
        x = (col - 1.5) * p,
        y = (row - 3) * p;
      targets.push({
        x: cx + x * Math.cos(angle) - y * Math.sin(angle),
        y: cy + x * Math.sin(angle) + y * Math.cos(angle),
        size: 43,
      });
    }
    $("backdrop").append(
      svg("rect", {
        id: "turn-frame",
        x: cx - 103,
        y: cy - 175,
        width: 206,
        height: 350,
        rx: 25,
        fill: "#edf0dd",
        stroke: "#d0d7b5",
        "stroke-width": 2,
        "stroke-dasharray": "5 7",
        transform: `rotate(${-turn * 90} ${cx} ${cy})`,
      }),
    );
    $("backdrop").append(
      svg("path", {
        d: "M450 470 H600",
        stroke: "#dfdfbf",
        "stroke-width": 5,
        "stroke-linecap": "round",
      }),
    );
    hx = 450 + turn * 150;
    hy = 470;
    $("arrangement").textContent =
      turn === 0
        ? "たて 7行 × よこ 4列"
        : turn === 1
          ? "たて 4行 × よこ 7列"
          : "くるっと ならべかえ中…";
    $("formula").innerHTML =
      turn > 0 && turn < 1
        ? '<span class="factor">7 × 4</span><span>↔</span><span class="factor">4 × 7</span><span>＝ 28</span>'
        : `<span class="factor">${turn === 1 ? "4 × 7" : "7 × 4"}</span><span>＝</span><span class="answer">28</span>`;
    $("group-counts").replaceChildren();
    $("drag-tip").hidden = false;
    $("handle").setAttribute("aria-valuenow", Math.round(turn * 100));
    $("handle").setAttribute(
      "aria-valuetext",
      turn === 1 ? "4行、7列" : turn === 0 ? "7行、4列" : "ならべかえ中",
    );
  } else {
    const left = 380 - 2 * pitch,
      line = top + split * pitch + gap / 2;
    $("backdrop").append(
      svg("rect", {
        x: left - 13,
        y: top - 7,
        width: 4 * pitch + 26,
        height: split * pitch + 9,
        rx: 18,
        fill: "#f6e6c9",
        stroke: "#e2c794",
        "stroke-width": 1.4,
      }),
    );
    $("backdrop").append(
      svg("rect", {
        x: left - 13,
        y: top + split * pitch + gap - 2,
        width: 4 * pitch + 26,
        height: (s.rows - split) * pitch + 9,
        rx: 18,
        fill: "#deeeea",
        stroke: "#b3d4ce",
        "stroke-width": 1.4,
      }),
    );
    for (let n = 0; n < cats.length; n++) {
      let row = Math.floor(n / 4);
      targets.push({
        x: left + ((n % 4) + 0.5) * pitch,
        y: top + (row + 0.5) * pitch + (row >= split ? gap : 0),
        size: pitch * 0.88,
      });
    }
    $("labels").append(
      svg("path", {
        d: `M${left - 30} ${line} H${left + 4 * pitch + 115}`,
        stroke: "#69998f",
        "stroke-width": 3,
        "stroke-dasharray": "6 5",
        "stroke-linecap": "round",
      }),
    );
    for (const [rows, y, color, amount] of [
      [split, top + (split * pitch) / 2, "#b6803c", split * 4],
      [
        s.rows - split,
        top + split * pitch + gap + ((s.rows - split) * pitch) / 2,
        "#498d86",
        (s.rows - split) * 4,
      ],
    ]) {
      $("labels").append(
        svg(
          "text",
          {
            x: left - 31,
            y: y + 6,
            "text-anchor": "end",
            fill: color,
            "font-size": 19,
            "font-weight": 800,
          },
          `${rows}行`,
        ),
      );
      $("labels").append(
        svg(
          "text",
          {
            x: left + 4 * pitch + 42,
            "text-anchor": "middle",
            y: y + 6,
            fill: color,
            "font-size": 19,
            "font-weight": 800,
          },
          `${amount}ひき`,
        ),
      );
    }
    const hit = svg("path", {
      d: `M${left - 30} ${line} H${left + 4 * pitch + 115}`,
      stroke: "transparent",
      "stroke-width": 44,
      "data-divider": "true",
      style: "cursor:ns-resize;touch-action:none",
    });
    $("labels").append(hit);
    hx = left + 4 * pitch + 125;
    hy = line;
    $("drag-tip").hidden = true;
    $("arrangement").textContent =
      `たて ${s.rows}行 × よこ 4列 → ${split}行 と ${s.rows - split}行`;
    $("formula").innerHTML =
      `<span class="a">${split} × 4</span><span>＋</span><span class="b">${s.rows - split} × 4</span><span>＝</span><span class="answer">${s.rows * 4}</span>`;
    $("group-counts").innerHTML =
      `<span class="a">● 上の ${split}行：${split * 4}ひき</span><span class="b">● 下の ${s.rows - split}行：${(s.rows - split) * 4}ひき</span>`;
    $("handle").setAttribute("aria-valuenow", split);
    $("handle").setAttribute(
      "aria-valuetext",
      `上${split}行、下${s.rows - split}行`,
    );
  }
  $("board").dataset.rows = s.kind === "turn" ? (turn === 1 ? 4 : 7) : s.rows;
  $("board").dataset.cols = s.kind === "turn" ? (turn === 1 ? 7 : 4) : 4;
  $("board").dataset.split = s.kind === "split" ? split : "";
  $("handle").dataset.x = hx;
  $("handle").dataset.y = hy;
  positionHandle();
  if (initial)
    cats.forEach((c, n) => {
      c.x = targets[n].x;
      c.y = targets[n].y;
    });
  if (!raf) raf = requestAnimationFrame(animate);
}
function positionHandle() {
  const m = $("board").getScreenCTM();
  if (!m) return;
  const p = new DOMPoint(
      +$("handle").dataset.x,
      +$("handle").dataset.y,
    ).matrixTransform(m),
    r = $("board").parentElement.getBoundingClientRect();
  $("handle").style.left = `${p.x - r.left}px`;
  $("handle").style.top = `${p.y - r.top}px`;
}
function animate(time) {
  const dt = lastTime ? Math.min(time - lastTime, 50) : 16;
  lastTime = time;
  let moving = false;
  const blend = reduced ? 1 : 1 - Math.exp(-dt / (drag ? 48 : 75));
  visibleTurn += (turn - visibleTurn) * blend;
  if (Math.abs(turn - visibleTurn) > 0.0001) moving = true;
  const angle = (-visibleTurn * Math.PI) / 2;
  if (stages[current].kind === "turn")
    $("turn-frame").setAttribute(
      "transform",
      `rotate(${-visibleTurn * 90} 380 239)`,
    );
  cats.forEach((c, i) => {
    const t = targets[i];
    if (stages[current].kind === "turn") {
      const x = ((i % 4) - 1.5) * 48,
        y = (Math.floor(i / 4) - 3) * 48;
      c.x = 380 + x * Math.cos(angle) - y * Math.sin(angle);
      c.y = 239 + x * Math.sin(angle) + y * Math.cos(angle);
    } else {
      c.x += (t.x - c.x) * blend;
      c.y += (t.y - c.y) * blend;
    }
    if (Math.abs(t.x - c.x) + Math.abs(t.y - c.y) > 0.1) moving = true;
    const bob = drag && !reduced ? Math.sin(time * 0.024 + i * 0.7) * 1.1 : 0;
    c.node.setAttribute(
      "transform",
      `translate(${c.x - t.size / 2} ${c.y - t.size / 2 + bob}) scale(${t.size / 48})`,
    );
  });
  if (moving || drag) raf = requestAnimationFrame(animate);
  else {
    raf = 0;
    lastTime = 0;
  }
}
function local(e) {
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(
    $("board").getScreenCTM().inverse(),
  );
}
function startDrag(e) {
  if (e.button !== 0 || drag || pending) return;
  e.preventDefault();
  const p = local(e);
  drag = { id: e.pointerId, x: p.x, y: p.y, turn, split };
  $("handle").setPointerCapture(e.pointerId);
  $("board").parentElement.classList.add("dragging");
  tone("start");
  if (!raf) raf = requestAnimationFrame(animate);
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  e.preventDefault();
  const p = local(e),
    s = stages[current];
  if (s.kind === "turn") turn = clamp(drag.turn + (p.x - drag.x) / 150, 0, 1);
  else {
    const g = geometry();
    split = clamp(
      drag.split + Math.round((p.y - drag.y) / g.pitch),
      1,
      s.rows - 1,
    );
  }
  layout();
}
function finishDrag(e, cancel = false) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const old = drag;
  drag = null;
  $("board").parentElement.classList.remove("dragging");
  if ($("handle").hasPointerCapture(old.id))
    $("handle").releasePointerCapture(old.id);
  if (cancel) {
    turn = old.turn;
    split = old.split;
  } else if (stages[current].kind === "turn") turn = turn >= 0.5 ? 1 : 0;
  layout();
  if (!cancel) {
    tone("snap");
    check();
  }
}
function check() {
  const s = stages[current],
    correct = s.kind === "turn" ? turn === s.goalTurn : split === s.goal;
  if (!correct) {
    $("feedback").textContent =
      s.kind === "turn"
        ? "右へ ひっぱってみよう！"
        : "いいね！ 分ける場所を かえてみよう。";
    return;
  }
  if (won || pending) return;
  won = true;
  pending = true;
  completed.add(current);
  $("continue").hidden = false;
  document.querySelector(`[data-stage="${current}"]`).classList.add("done");
  $("feedback").textContent = "✦ できた！ ねこの数は かわらないね。";
  $("board").parentElement.classList.add("celebrating");
  tone("win");
  sparkles();
  later(() => {
    pending = false;
    showClear();
  }, 850);
}
function sparkles() {
  if (reduced) return;
  for (let i = 0; i < 32; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.left = `${5 + Math.random() * 90}%`;
    p.style.background = ["#edc477", "#91b4a0", "#dca494", "#d8dca2"][i % 4];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    $("confetti").append(p);
  }
  later(() => $("confetti").replaceChildren(), 2200);
}
function showClear() {
  const s = stages[current];
  $("clear-kicker").textContent = "MISSION CLEAR!";
  $("clear-title").textContent = "できたにゃ！";
  $("discovery").textContent = s.discovery;
  $("lesson").innerHTML = s.lesson;
  $("proof").innerHTML =
    current === 0
      ? "<div>7 × 4 ＝ 28</div><div>4 × 7 ＝ 28</div>"
      : current === 1
        ? '<div>7 × 4</div><div>＝ <span class="a">3 × 4</span> ＋ <span class="b">4 × 4</span></div><div>＝ 28</div>'
        : '<div class="step" style="--delay:0s">12 × 4</div><div class="step" style="--delay:.4s">＝ <span class="a">10 × 4</span> ＋ <span class="b">2 × 4</span></div><div class="step" style="--delay:.9s">＝ <span class="a">40</span> ＋ <span class="b">8</span></div><div class="step" style="--delay:1.4s">＝ 48</div>';
  $("next").innerHTML =
    current === 2
      ? "けっかを見る <span>→</span>"
      : "つぎのステージへ <span>→</span>";
  $("look").textContent = "ねこたちを もういちど見る";
  $("clear-dialog").showModal();
}
let result = false;
$("continue").addEventListener("click", () => {
  result = false;
  $("proof").style.fontSize = "";
  showClear();
});
$("board").addEventListener("pointerdown", (e) => {
  if (e.target.hasAttribute("data-divider")) startDrag(e);
});
$("next").addEventListener("click", () => {
  if (result) {
    result = false;
    completed.clear();
    reset(0);
    return;
  }
  if (current < 2) {
    reset(current + 1);
    $("handle").focus({ preventScroll: true });
    return;
  }
  result = true;
  $("clear-kicker").textContent =
    completed.size === 3 ? "ALL STAGES CLEAR!" : "NICE PLAY!";
  $("clear-title").textContent =
    completed.size === 3 ? "かけ算の ねこ名人！" : "よく がんばったね！";
  $("discovery").textContent =
    `3つのステージのうち ${completed.size}つ クリア！`;
  $("proof").innerHTML =
    "<div>✦ かける数を 入れかえる</div><div>✦ 分けて たす</div><div>✦ 計算しやすい数にする</div>";
  $("proof").style.fontSize = "17px";
  $("lesson").textContent = "ねこを うごかして、かけ算のきまりを みつけたね。";
  $("next").innerHTML = "もういちど あそぶ <span>↻</span>";
  $("look").textContent = "ひろばに もどる";
  tone("win");
  sparkles();
});
$("look").addEventListener("click", () => {
  $("clear-dialog").close();
  $("handle").focus({ preventScroll: true });
});
$("handle").addEventListener("pointerdown", startDrag);
$("handle").addEventListener("pointermove", moveDrag);
$("handle").addEventListener("pointerup", (e) => finishDrag(e));
$("handle").addEventListener("pointercancel", (e) => finishDrag(e, true));
$("handle").addEventListener("lostpointercapture", (e) => {
  if (drag) finishDrag(e, true);
});
$("handle").addEventListener("keydown", (e) => {
  if (pending || drag) return;
  const s = stages[current];
  if (
    s.kind === "turn" &&
    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
  ) {
    e.preventDefault();
    turn = ["ArrowRight", "End"].includes(e.key) ? 1 : 0;
  } else if (
    s.kind === "split" &&
    ["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)
  ) {
    e.preventDefault();
    split =
      e.key === "Home"
        ? 1
        : e.key === "End"
          ? s.rows - 1
          : clamp(split + (e.key === "ArrowDown" ? 1 : -1), 1, s.rows - 1);
  } else return;
  layout();
  tone("snap");
  check();
});
$("reset").addEventListener("click", () => {
  result = false;
  reset();
});
document.querySelectorAll("[data-stage]").forEach((b) =>
  b.addEventListener("click", () => {
    result = false;
    reset(+b.dataset.stage);
  }),
);
$("hint").addEventListener("click", () => {
  $("hint-text").hidden = !$("hint-text").hidden;
  $("hint-text").textContent = stages[current].hint;
  $("hint").textContent = $("hint-text").hidden
    ? "☀ ヒントをみる"
    : "☀ ヒントをとじる";
});
$("sound").addEventListener("click", () => {
  sound = !sound;
  updateSound();
  if (sound) tone("snap");
});
function updateViewport() {
  const view = innerWidth <= 600 ? "100 0 560 540" : "0 0 760 540";
  if ($("board").getAttribute("viewBox") !== view)
    $("board").setAttribute("viewBox", view);
  positionHandle();
}
new ResizeObserver(updateViewport).observe($("board"));
updateViewport();
window.addEventListener("blur", () => {
  if (drag) finishDrag(null, true);
});
reset(0);
