const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const info = document.getElementById("info");
const restartBtn = document.getElementById("restart");
const startBtn = document.getElementById("start");

const GAME_TIME = 30; // 秒
const PRESENT_INTERVAL = 1.0; // 落ちる間隔
const BOMB_RATE = 0.25; // 25%で爆弾
const PRESENT_POINTS = [1, 2, 3];
const BOMB_PENALTY = -5;
const keys = new Set();

let items = [];
let basket;
let score = 0;
let timeLeft = GAME_TIME;
let gameOver = false;
let lastTime = 0;
let spawnTimer = 0;
let effects = [];
let gameStarted = false;
let keyDir = 0; // キーボード
let touchDir = 0; // タッチ

const bgImage = new Image();
bgImage.src = "images/bg.jpg";

let bgLoaded = false;
bgImage.onload = () => {
  bgLoaded = true;
  canvas.width = bgImage.naturalWidth;
  canvas.height = bgImage.naturalHeight;
};

// カゴクラス
class Basket {
  constructor() {
    this.width = 80;
    this.height = 30;
    this.x = (canvas.width - this.width) / 2;
    this.y = canvas.height - this.height - 10;
    this.speed = 300;

    // 見た目に合わせた当たり判定サイズ
    this.hitWidth = 38;
    this.hitHeight = 28;
  }

  move(dir, delta) {
    this.x += dir * this.speed * delta;
    this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
  }

  draw() {
    ctx.save();
    this.y = canvas.height - this.height - 10;

    // ★ 光る影を追加
    ctx.shadowColor = "rgba(255, 255, 200, 0.9)";
    ctx.shadowBlur = 12;

    ctx.font = "32px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    ctx.fillText("🧺", this.x + this.width / 2, this.y + this.height);

    ctx.restore();

    // 判定矩形可視化（デバッグ用）
    // ctx.strokeStyle = "orange";
    // ctx.lineWidth = 2;
    // ctx.strokeRect(
    //   this.x + (this.width - this.hitWidth) / 2,
    //   this.y + (this.height - this.hitHeight) / 2,
    //   this.hitWidth,
    //   this.hitHeight
    // );

    // ctx.fillStyle = "rgba(255,165,0,0.2)";
    // ctx.fillRect(
    //   this.x + (this.width - this.hitWidth) / 2,
    //   this.y + (this.height - this.hitHeight) / 2,
    //   this.hitWidth,
    //   this.hitHeight
    // );
  }
}

// アイテムクラス
class Item {
  constructor() {
    this.size = 30;
    this.x = Math.random() * (canvas.width - this.size);
    this.y = -this.size;
    this.speed = 100 + Math.random() * 100;
    this.caught = false;

    if (Math.random() < BOMB_RATE) {
      this.type = "bomb";
      this.emoji = "💣";
      this.point = BOMB_PENALTY;
      this.hitSize = this.size * 0.6;
    } else {
      this.type = "present";
      this.emoji = "🎁";
      const idx = Math.floor(Math.random() * PRESENT_POINTS.length);
      this.point = PRESENT_POINTS[idx];
      this.hitSize = this.size;
    }
  }

  update(delta) {
    this.y += this.speed * delta;
  }

  draw() {
    ctx.save();

    // ★ 光る影を追加
    ctx.shadowColor = "rgba(255, 255, 200, 0.9)";
    ctx.shadowBlur = 12;

    ctx.font = "28px serif";
    ctx.textAlign = "center";

    // 絵文字描画
    ctx.fillStyle = "black";
    ctx.fillText(this.emoji, this.x + this.size / 2, this.y + this.size);

    // 得点表示
    ctx.font = "14px sans-serif";
    if (this.type === "present") {
      switch (this.point) {
        case 1:
          ctx.fillStyle = "lime";
          break;
        case 2:
          ctx.fillStyle = "cyan";
          break;
        case 3:
          ctx.fillStyle = "gold";
          break;
        default:
          ctx.fillStyle = "black";
      }
      ctx.fillText(
        `+${this.point}`,
        this.x + this.size / 2,
        this.y + this.size + 12
      );
    } else if (this.type === "bomb") {
      ctx.fillStyle = "red";
      ctx.fillText(
        `${this.point}`,
        this.x + this.size / 2,
        this.y + this.size + 12
      );
    }

    ctx.restore();

    // hitSize 矩形可視化（デバッグ用）
    // const hs = this.hitSize;
    // const left = this.x + (this.size - hs) / 2;
    // const top = this.y + (this.size - hs) / 2;

    // ctx.strokeStyle = this.type === "bomb" ? "red" : "blue";
    // ctx.lineWidth = 2;
    // ctx.strokeRect(left, top, hs, hs);

    // ctx.fillStyle =
    //   this.type === "bomb" ? "rgba(255,0,0,0.2)" : "rgba(0,0,255,0.2)";
    // ctx.fillRect(left, top, hs, hs);
  }

  isCaught(basket) {
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    const half = this.hitSize / 2;

    const basketLeft = basket.x + (basket.width - basket.hitWidth) / 2;
    const basketTop = basket.y + (basket.height - basket.hitHeight) / 2;

    return (
      cx + half > basketLeft &&
      cx - half < basketLeft + basket.hitWidth &&
      cy + half > basketTop &&
      cy - half < basketTop + basket.hitHeight
    );
  }
}

// 爆弾エフェクト
class Explosion {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.alpha = 1.0;
  }

  update(delta) {
    this.radius += 200 * delta;
    this.alpha -= 1.5 * delta;
  }

  draw() {
    if (this.alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,100,0,${this.alpha})`;
    ctx.fill();
  }

  isDone() {
    return this.alpha <= 0;
  }
}

// プレゼントキャッチエフェクト
class PresentEffect {
  constructor(x, y, color = "255,255,0") {
    this.x = x;
    this.y = y;
    this.radius = 3;
    this.alpha = 1.0;
    this.color = color;
  }

  update(delta) {
    this.radius += 70 * delta;
    this.alpha -= 3 * delta;
  }

  draw() {
    if (this.alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
    ctx.fill();
  }

  isDone() {
    return this.alpha <= 0;
  }
}

// 初期化
function init() {
  items = [];
  basket = new Basket();
  effects = [];
  score = 0;
  timeLeft = GAME_TIME;
  gameOver = false;
  lastTime = performance.now();
  spawnTimer = 0;

  startBtn.style.display = "inline-block";
  restartBtn.style.display = "none";
}

let moveDir = 0;

// 更新
function update(delta) {
  if (!gameStarted || gameOver) return;

  timeLeft -= delta;
  if (timeLeft <= 0) {
    timeLeft = 0;
    gameOver = true;

    // ★ ゲーム終了 → リスタート表示
    restartBtn.style.display = "inline-block";
  }

  updateInputFromKeyboard();
  // タッチがあればタッチ優先、なければキーボード
  const moveDir = touchDir !== 0 ? touchDir : keyDir;
  basket.move(moveDir, delta);
  // moveDir = 0;
  // if (keys.has("ArrowLeft")) moveDir -= 1;
  // if (keys.has("ArrowRight")) moveDir += 1;
  // basket.move(moveDir, delta);

  spawnTimer += delta;
  if (spawnTimer >= PRESENT_INTERVAL) {
    items.push(new Item());
    spawnTimer = 0;
  }

  items.forEach((item) => {
    item.update(delta);

    if (!item.caught && item.isCaught(basket)) {
      item.caught = true;
      score += item.point;
      if (score < 0) score = 0;

      const cx = item.x + item.size / 2;
      const cy = item.y + item.size / 2;

      if (item.type === "bomb") {
        effects.push(new Explosion(cx, cy));
      } else if (item.type === "present") {
        // const colors = ["255,255,0", "0,255,0", "0,0,255"];
        // const color = colors[Math.floor(Math.random() * colors.length)];
        // effects.push(new PresentEffect(cx, cy, color));
        effects.push(new PresentEffect(cx, cy));
      }
    }
  });

  // 画面外 or キャッチ済み削除
  items = items.filter((item) => item.y < canvas.height && !item.caught);

  // エフェクト更新
  effects.forEach((e) => e.update(delta));
  effects = effects.filter((e) => !e.isDone());
}

function drawStartScreen() {
  // 少し明るめのオーバーレイ
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ctx.fillStyle = "black";
  // ctx.font = "32px sans-serif";
  // ctx.textAlign = "center";
  // ctx.fillText(
  //   "🎄 プレゼントキャッチ 🎁",
  //   canvas.width / 2,
  //   canvas.height / 2 - 40
  // );

  // ctx.font = "20px sans-serif";
  // ctx.fillText(
  //   "スタートボタンを押してね",
  //   canvas.width / 2,
  //   canvas.height / 2 + 10
  // );
}

// 描画
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ★ 背景描画（必ず一番最初）
  // if (bgLoaded) {
  //   // ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  //   ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  //   ctx.fillStyle = "rgba(0,0,0,0.5)";
  //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  // } else {
  //   // 読み込み前の代替背景
  //   ctx.fillStyle = "#e0f7ff";
  //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  // }

  // 背景画像
  if (bgLoaded) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  }

  if (!gameStarted) {
    drawStartScreen();
    return;
  }

  // ★ ゲーム中は背景を暗くする
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  basket.draw();
  items.forEach((item) => item.draw());
  effects.forEach((e) => e.draw());

  info.textContent = `スコア：${score}　｜　のこり ${timeLeft.toFixed(1)} 秒`;

  if (gameOver) {
    ctx.fillStyle = "rgba(255,255,255)";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("おしまい！", canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillText(`スコア：${score}`, canvas.width / 2, canvas.height / 2 + 20);
  }
}

// ゲームループ
function gameLoop(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

// 入力
// document.addEventListener("keydown", (e) => {
//   if (e.key === "ArrowLeft") moveDir = -1;
//   if (e.key === "ArrowRight") moveDir = 1;
// });
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.key);
});

// document.addEventListener("keyup", () => (moveDir = 0));
document.addEventListener("keyup", (e) => {
  keys.delete(e.key);
});

function updateInputFromKeyboard() {
  keyDir = 0;
  if (keys.has("ArrowLeft")) keyDir -= 1;
  if (keys.has("ArrowRight")) keyDir += 1;
}

// canvas.addEventListener("touchmove", (e) => {
//   const rect = canvas.getBoundingClientRect();
//   const touch = e.touches[0];
//   basket.x = touch.clientX - rect.left - basket.width / 2;
//   basket.x = Math.max(0, Math.min(canvas.width - basket.width, basket.x));
// });
// タッチ操作（スマホ用）
canvas.addEventListener("touchstart", handleTouch, { passive: false });
canvas.addEventListener("touchmove", handleTouch, { passive: false });
canvas.addEventListener("touchend", () => {
  touchDir = 0;
});

function handleTouch(e) {
  e.preventDefault(); // スクロール防止

  const touch = e.touches[0];
  if (!touch) return;

  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;

  // if (x < rect.width / 2) {
  //   moveDir = -1; // 左
  // } else {
  //   moveDir = 1; // 右
  // }
  touchDir = x < rect.width / 2 ? -1 : 1;
}

// restartBtn.addEventListener("click", init);
restartBtn.addEventListener("click", () => {
  init();

  gameStarted = false;

  // ★ ボタン切り替え
  startBtn.style.display = "inline-block";
  restartBtn.style.display = "none";
});

startBtn.addEventListener("click", () => {
  if (gameStarted) return;

  gameStarted = true;
  lastTime = performance.now(); // ★ 時間ズレ防止

  // ★ 切り替え
  startBtn.style.display = "none";
  restartBtn.style.display = "none";
});

// 起動
init();
requestAnimationFrame(gameLoop);
