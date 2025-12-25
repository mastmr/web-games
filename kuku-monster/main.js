const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ====== 画面サイズ ======
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// ====== ゲーム状態 ======
let state = {
  hp: 3,
  level: 1,
  question: null,
  choices: [],
  score: 0,
  gameOver: false,
  time: 60,
  lastTime: null,

  effect: null, // "correct" | "wrong" | null
  effectTime: 0, // 残り時間（秒）
};

// ====== 九九問題生成 ======
function createQuestion() {
  const a = 2 + Math.floor(Math.random() * 3); // 2〜4の段（最初は簡単）
  const b = 1 + Math.floor(Math.random() * 9);
  const answer = a * b;

  let choices = new Set();
  choices.add(answer);

  while (choices.size < 4) {
    const diff = Math.floor(Math.random() * 5) - 2; // -2〜+2
    const wrong = answer + diff;
    if (wrong > 0) choices.add(wrong);
  }

  state.question = { a, b, answer };
  state.choices = Array.from(choices)
    .map(v => ({ value: v, rect: null }))
    .sort(() => Math.random() - 0.5);
}

createQuestion();
state.lastTime = performance.now();

// ====== 描画 ======
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.gameOver) {
    drawGameOver();
    return;
  }

  // HP
  ctx.textAlign = "left";
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "#000";
  ctx.fillText(`❤️ ${state.hp}`, 20, 40);

  // スコア
  ctx.textAlign = "center";
  ctx.fillText(`といたかず ${state.score}`, canvas.width / 2, 40);

  // 残り時間
  ctx.textAlign = "right";
  ctx.fillText(
    `⏱ ${Math.ceil(state.time)}`,
    canvas.width - 20,
    40
  );

  // モンスター（簡易）
  ctx.font = "80px sans-serif";
  ctx.textAlign = "center";
  let shakeX = 0;
  if (state.effect === "correct") {
    shakeX = Math.sin(Date.now() / 50) * 10;
  }
  ctx.fillText("👾", canvas.width / 2 + shakeX, 150);

  // 問題
  ctx.font = "40px sans-serif";
  ctx.fillStyle = "#000";
  ctx.fillText(
    `${state.question.a} × ${state.question.b} = ?`,
    canvas.width / 2,
    260
  );

  // 選択肢
  const btnW = canvas.width / 2 - 40;
  const btnH = 70;
  const startY = 320;

  // ボタン情報を保存
  state.choices.forEach((choice, i) => {
    const x = i % 2 === 0 ? 20 : canvas.width / 2 + 20;
    const y = startY + Math.floor(i / 2) * (btnH + 20);

    ctx.fillStyle = "#d0eaff";
    ctx.fillRect(x, y, btnW, btnH);
    ctx.strokeRect(x, y, btnW, btnH);

    ctx.fillStyle = "#000";
    ctx.fillText(choice.value, x + btnW / 2, y + 45);

    // ← rect を保存
    choice.rect = { x, y, w: btnW, h: btnH };
  });

  // エフェクト描画
  if (state.effect === "correct") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state.effect === "wrong") {
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawGameOver() {
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";

  ctx.font = "48px sans-serif";
  ctx.fillText("おしまい", canvas.width / 2, canvas.height / 2 - 80);

  ctx.font = "32px sans-serif";
  ctx.fillText(
    `といたかず：${state.score}`,
    canvas.width / 2,
    canvas.height / 2 - 20
  );

  // もう一回ボタン
  const btnW = 220;
  const btnH = 60;
  const x = canvas.width / 2 - btnW / 2;
  const y = canvas.height / 2 + 40;

  ctx.fillStyle = "#a0e7a0";
  ctx.fillRect(x, y, btnW, btnH);

  ctx.strokeStyle = "#333";
  ctx.strokeRect(x, y, btnW, btnH);

  ctx.fillStyle = "#000";
  ctx.font = "28px sans-serif";
  ctx.fillText("もういっかい", canvas.width / 2, y + 40);

  // ボタン判定用
  state.retryButton = { x, y, w: btnW, h: btnH };
}

// ====== タップ判定 ======
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  // ゲームオーバー中
  if (state.gameOver) {
    const r = state.retryButton;
    if (
      x > r.x && x < r.x + r.w &&
      y > r.y && y < r.y + r.h
    ) {
      restartGame();
    }
    return;
  }

  // 通常時
  state.choices.forEach((choice) => {
    const r = choice.rect;
    if (
      x > r.x && x < r.x + r.w &&
      y > r.y && y < r.y + r.h
    ) {
      checkAnswer(choice.value);
    }
  });
}, { passive: false });

// ====== 正誤判定 ======
function checkAnswer(selected) {
  if (state.gameOver) return;

  if (selected === state.question.answer) {
    state.score++;
    startEffect("correct");
    createQuestion();
  } else {
    state.hp--;
    startEffect("wrong");

    if (state.hp <= 0) {
      state.hp = 0;
      state.gameOver = true;
    }
  }
}

function startEffect(type) {
  state.effect = type;
  state.effectTime = 0.2; // 0.2秒
}

function restartGame() {
  state.hp = 3;
  state.score = 0;
  state.time = 60;
  state.gameOver = false;
  state.lastTime = performance.now();
  createQuestion();
}

function updateTime(now) {
  if (state.gameOver) return;

  if (!state.lastTime) {
    state.lastTime = now;
    return;
  }

  const delta = (now - state.lastTime) / 1000;
  state.lastTime = now;
  state.time -= delta;

  if (state.time <= 0) {
    state.time = 0;
    state.gameOver = true;
  }

  // エフェクト時間更新
  if (state.effectTime > 0) {
    state.effectTime -= delta;
    if (state.effectTime <= 0) {
      state.effect = null;
    }
  }
}

// ====== ループ ======
function loop(now) {
  updateTime(now);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);