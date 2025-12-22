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
  state.choices = Array.from(choices).sort(() => Math.random() - 0.5);
}

createQuestion();

// ====== 描画 ======
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // HP表示
  ctx.font = "24px sans-serif";
  ctx.fillText(`❤️ ${state.hp}`, 20, 40);

  // モンスター（簡易）
  ctx.font = "80px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("👾", canvas.width / 2, 150);

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

  state.choices.forEach((num, i) => {
    const x = i % 2 === 0 ? 20 : canvas.width / 2 + 20;
    const y = startY + Math.floor(i / 2) * (btnH + 20);

    ctx.fillStyle = "#d0eaff";
    ctx.fillRect(x, y, btnW, btnH);

    ctx.strokeStyle = "#333";
    ctx.strokeRect(x, y, btnW, btnH);

    ctx.fillStyle = "#000";
    ctx.font = "32px sans-serif";
    ctx.fillText(num, x + btnW / 2, y + 45);

    // ボタン情報を保存
    num._rect = { x, y, w: btnW, h: btnH };
  });
}

// ====== タップ判定 ======
canvas.addEventListener("touchstart", (e) => {
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  state.choices.forEach((num) => {
    const r = num._rect;
    if (
      x > r.x &&
      x < r.x + r.w &&
      y > r.y &&
      y < r.y + r.h
    ) {
      checkAnswer(num);
    }
  });
});

// ====== 正誤判定 ======
function checkAnswer(selected) {
  if (selected === state.question.answer) {
    createQuestion();
  } else {
    state.hp--;
    if (state.hp <= 0) {
      state.hp = 3; // ゲームオーバーなし
    }
  }
}

// ====== ループ ======
function loop() {
  draw();
  requestAnimationFrame(loop);
}
loop();