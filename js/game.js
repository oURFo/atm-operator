// ===== ATM人 主遊戲邏輯 =====
const $ = (id) => document.getElementById(id);
const GAME_TIME = 180, SPAWN_EVERY = 8, MAX_QUEUE = 3;
const SURNAMES = '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周'.split('');
// 名字依圖像：1 中年上班族男、2 年輕女生、3 阿嬤、4 刺青年輕男
const GIVEN = {
  1: ['志明', '建宏', '文雄', '國華', '俊雄', '振興', '明德', '清標'],
  2: ['雅婷', '怡君', '佳穎', '欣妤', '詩涵', '宜蓁', '筱涵', '品妍'],
  3: ['秀英', '阿桃', '玉蘭', '罔市', '金枝', '秀琴', '月娥', '阿滿'],
  4: ['家豪', '冠宇', '宗翰', '承恩', '柏翰', '俊傑', '浩宇', '子豪'],
};
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const fmt = (n) => n.toLocaleString('en-US');

const NEWS = {
  wrongPin: { head: 'ATM 形同虛設！錯誤密碼竟能領錢', body: '本報訊：昨日某銀行 ATM 未檢測出錯誤密碼，盜領者輕鬆提走現金。銀行坦承「機台內部人員疏失」，受害者欲哭無淚。' },
  noLock: { head: '車手猖獗！ATM 未起到保護作用', body: '本報訊：詐團車手持人頭卡連續試密碼，ATM 竟未鎖卡，任其得手。警方痛批金融防線失守，呼籲銀行全面檢討。' },
  bigLoss: { head: 'ATM 狂吐鈔！銀行單筆損失破五千', body: '本報訊：某銀行 ATM 疑似「出鈔異常」，民眾領錢竟拿到大把鈔票，目擊者笑稱「比中發票還爽」。銀行高層震怒，揚言徹查機台內部作業。' },
};
const BIG_LOSS = 5000; // 單筆損失達此金額即上新聞

let S; // game state

function newState() {
  return { running: false, time: GAME_TIME, nextSpawn: 0, queue: [], cur: null, done: 0, loss: 0, comp: 0, lost: 0, news: [], tray: [], buf: '', uid: 0, tickId: null };
}

// ---------- 顧客生成 ----------
function makeCustomer() {
  const elapsed = GAME_TIME - S.time;
  const f = elapsed < 30 ? 0 : Math.min(1, (elapsed - 30) / 90);
  const r = Math.random();
  let wrong = 0;
  if (r < 0.05 * f) wrong = 3;           // 事件 B
  else if (r < 0.20 * f) wrong = rnd(1, 2); // 事件 A
  const pin = String(rnd(0, 9999)).padStart(4, '0');
  const seq = [];
  for (let i = 0; i < wrong; i++) { let w; do { w = String(rnd(0, 9999)).padStart(4, '0'); } while (w === pin); seq.push(w); }
  if (wrong < 3) seq.push(pin);
  let amount;
  if (Math.random() < 0.3) amount = rnd(0, 19) * 1000 + rnd(1, 9) * 100; // 事件 C
  else amount = rnd(1, 20) * 1000;
  const balance = Math.random() < 0.15 ? Math.max(0, amount - rnd(1, 50) * 100) : amount + rnd(0, 300) * 100;
  const sprite = rnd(1, 4);
  return {
    id: ++S.uid, name: pick(SURNAMES) + pick(GIVEN[sprite]), sprite,
    card: String(rnd(100000, 999999)), pin, seq, try: 0, balance, amount,
    flipped: Math.random() < 0.25, phase: 'walk', auth: null, fraud: false,
  };
}

// ---------- 計時 ----------
function tick() {
  S.time--;
  S.nextSpawn--;
  if (S.nextSpawn <= 0) { spawn(); S.nextSpawn = SPAWN_EVERY; }
  renderHud();
  if (S.time <= 0) endGame();
}
function spawn() {
  if (S.queue.length >= MAX_QUEUE) { S.lost++; toast('隊伍滿了，一位顧客走掉了'); return; }
  S.queue.push(makeCustomer());
  if (!S.cur) nextCustomer(); else renderQueue();
}
function later(c, ms, fn) { setTimeout(() => { if (S.running && S.cur === c) fn(); }, ms); }

// ---------- 顧客流程 ----------
function nextCustomer() {
  S.cur = S.queue.shift() || null;
  renderQueue();
  resetTerminalForNew();
  const el = $('customer');
  if (!S.cur) { el.classList.add('hidden'); setMirror('待機中', '----'); hideCard(); return; }
  const c = S.cur;
  el.className = 'sprite enter';
  el.style.backgroundImage = `url(assets/cust${c.sprite}.jpg)`;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter')));
  setMirror('請插入金融卡', '');
  later(c, 800, insertCard);
}
function insertCard() {
  const c = S.cur; c.phase = 'card';
  setMirror('讀卡中…', '');
  showCard(c);
  if (!c.flipped) later(c, 900, () => startPin());
  else say('…怎麼沒反應？', 'neutral');
}
function startPin() {
  const c = S.cur; c.phase = 'typingPin';
  typeOut(c, '請輸入密碼', c.seq[c.try], () => { c.phase = 'pinShown'; setMirror('密碼輸入完成', c.seq[c.try]); });
}
function startAmount() {
  const c = S.cur; c.phase = 'typingAmt';
  typeOut(c, '請輸入提款金額', String(c.amount), () => { c.phase = 'amtShown'; setMirror('提款金額', '$' + fmt(c.amount)); });
}
function typeOut(c, label, str, done) {
  let i = 0; setMirror(label, '');
  const step = () => {
    if (!S.running || S.cur !== c) return;
    i++; setMirror(label, str.slice(0, i)); SFX.beep();
    if (i < str.length) setTimeout(step, 220); else setTimeout(() => { if (S.cur === c) done(); }, 200);
  };
  setTimeout(step, 400);
}
function leave(mood, style = 'leave') {
  const c = S.cur; if (!c) return;
  c.phase = 'leaving';
  setFace(mood);
  hideCard();
  const el = $('customer');
  setTimeout(() => { el.classList.add(style); }, style === 'run' ? 300 : 900);
  setTimeout(() => { $('bubble').classList.add('hidden'); if (S.running && S.cur === c) nextCustomer(); }, style === 'run' ? 900 : 1700);
}
function rage(text) {
  say(text, 'angry'); SFX.thud();
  $('customer').classList.add('shake'); $('monitor').classList.add('shake');
  setTimeout(() => { $('customer').classList.remove('shake'); $('monitor').classList.remove('shake'); }, 700);
}
function addComp() { S.comp++; renderHud(); }
function addLoss(n) { S.loss += n; renderHud(); }
function addNews(key) { S.news.push(NEWS[key]); toast('📰 這件事上新聞了…'); }

// ---------- 玩家動作 ----------
function busy() { toast('顧客操作中，請稍候'); }

function actPush() { // 上滑推回卡片
  const c = S.cur; if (!c || c.phase === 'leaving') return;
  SFX.swipe(); animateCardOut();
  switch (c.phase) {
    case 'card':
      if (c.flipped) {
        c.phase = 'flipping'; say('嘖！', 'annoyed');
        later(c, 1500, () => { c.flipped = false; c.phase = 'card'; say('', 'neutral'); showCard(c); setMirror('讀卡中…', ''); later(c, 900, startPin); });
      } else { addComp(); rage('卡片明明插對了！'); leave('angry'); }
      break;
    case 'pinShown':
      if (c.seq[c.try] !== c.pin) pinRetry(true);
      else { addComp(); rage('密碼是對的啊！'); leave('angry'); }
      break;
    case 'mustLock':
      addNews('noLock'); say('嘿嘿，換一台試', 'smirk'); leave('smirk', 'run'); break;
    case 'amtShown':
      if (c.amount > c.balance) { S.done++; renderHud(); say('…錢不夠喔', 'annoyed'); leave('annoyed'); }
      else { addComp(); rage('我戶頭明明有錢！'); leave('angry'); }
      break;
    default: busy(); showCard(c);
  }
}
function pinRetry(viaPush) {
  const c = S.cur; c.try++;
  if (c.try >= 3) { c.phase = 'mustLock'; setMirror('密碼錯誤 3 次', '!!!'); say('怎麼又錯！', 'annoyed'); if (!viaPush) return; return; }
  c.phase = 'retry'; say(pick(['蛤？又錯？', '唉…', '再試一次啦']), 'annoyed');
  setMirror('密碼錯誤', 'XXXX');
  if (viaPush) later(c, 600, () => showCard(c));
  later(c, 1500, () => { say('', 'annoyed'); startPin(); });
}
function actV() {
  const c = S.cur; if (!c || c.phase === 'leaving') return;
  if (c.phase === 'card' && c.flipped) { SFX.err(); addComp(); rage('卡卡住了啦！'); return; }
  if (c.phase === 'mustLock') { SFX.ok(); c.fraud = true; addNews('noLock'); say('嘿嘿…', 'smirk'); startAmount(); return; }
  if (c.phase !== 'pinShown') return busy();
  SFX.ok();
  if (c.seq[c.try] !== c.pin) { c.fraud = true; addNews('wrongPin'); say('（竟然過了？）', 'smirk'); }
  startAmount();
}
function actX() {
  const c = S.cur; if (!c || c.phase === 'leaving') return;
  if (c.phase === 'card' && c.flipped) return actPush();
  if (c.phase !== 'pinShown') return busy();
  SFX.err();
  if (c.seq[c.try] !== c.pin) pinRetry(false);
  else { addComp(); rage('我密碼打對的！'); c.phase = 'retry'; later(c, 1500, () => { say('', 'annoyed'); startPin(); }); }
}
function actLock() {
  SFX.beep();
  const c = S.cur; if (!c || c.phase === 'leaving') return;
  const third = c.phase === 'mustLock' || (c.phase === 'pinShown' && c.try === 2 && c.seq.length === 3 && c.seq[2] !== c.pin);
  if (third) { crt(`*** 卡號 ${c.card} 已鎖定 ***`); addComp(); rage('幹！鎖我卡！'); setTimeout(() => SFX.thud(), 300); leave('angry'); }
  else { crt('*** 錯誤鎖卡！ ***'); addComp(); rage('憑什麼鎖我的卡！'); leave('angry'); }
}
function actDispense() {
  const c = S.cur; const given = trayTotal();
  if (!c || c.phase !== 'amtShown') return toast('目前沒有可出鈔的交易');
  SFX.cash();
  const req = c.amount, lossBefore = S.loss;
  if (c.auth !== given) addLoss(Math.abs((c.auth || 0) - given)); // 帳目不平
  if (c.fraud) { addLoss(given); say('謝啦～', 'smirk'); leave('smirk', 'run'); }
  else if (req > c.balance) { addLoss(given); say('（透支也能領？）', 'smirk'); leave('smirk', 'run'); }
  else if (given > req) { addLoss(given - req); say('（賺到了！快跑）', 'smirk'); leave('smirk', 'run'); }
  else if (given < req) { addLoss(req - given); addComp(); rage('錢不對啦！！'); leave('angry'); }
  else { S.done++; renderHud(); say('', 'neutral'); leave('neutral'); }
  if (S.loss - lossBefore >= BIG_LOSS) addNews('bigLoss');
  clearTray();
}

// ---------- 終端機 ----------
function resetTerminalForNew() { S.buf = ''; renderBuf(); crt('BANK TERMINAL v1.0\n請輸入卡號後按【查詢卡號】'); }
function crt(t) { $('crtText').textContent = t; }
function renderBuf() { $('inputBuf').textContent = S.buf; }
function actQuery() {
  SFX.beep();
  const c = S.cur;
  if (c && S.buf === c.card) crt(`== 查詢結果 ==\n姓名：${c.name}\n卡號：${c.card}\n密碼：${c.pin}\n餘額：$${fmt(c.balance)}`);
  else crt(`查無此卡：${S.buf || '(空白)'}`);
  S.buf = ''; renderBuf();
}
function actAuth() {
  SFX.beep();
  const c = S.cur; const v = parseInt(S.buf || '0', 10);
  if (c) c.auth = v;
  const prev = $('crtText').textContent.split('\n>>')[0];
  crt(`${prev}\n>> 已授權提款 $${fmt(v)}`);
  S.buf = ''; renderBuf();
}

// ---------- 鈔票 ----------
function trayTotal() { return S.tray.reduce((a, b) => a + b, 0); }
function addBill(v, srcEl) {
  SFX.cash(); S.tray.push(v);
  const r = srcEl.getBoundingClientRect(), t = $('tray').getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'fly ' + (v === 1000 ? 'b1000' : 'b100');
  fly.style.left = r.left + r.width / 2 - 30 + 'px'; fly.style.top = r.top + r.height / 2 - 14 + 'px';
  document.body.appendChild(fly);
  requestAnimationFrame(() => { fly.style.left = t.left + rnd(10, Math.max(10, t.width - 70)) + 'px'; fly.style.top = t.top + rnd(5, Math.max(5, t.height - 40)) + 'px'; fly.style.transform = `rotate(${rnd(-30, 30)}deg) scale(.8)`; });
  setTimeout(() => { fly.remove(); renderTray(); }, 360);
}
function clearTray() { S.tray = []; renderTray(); }
function renderTray() {
  const box = $('trayBills'); box.innerHTML = '';
  S.tray.slice(-40).forEach((v, i) => {
    const m = document.createElement('div');
    m.className = 'mini ' + (v === 1000 ? 'b1000' : 'b100');
    m.textContent = v;
    m.style.left = (8 + (i * 37) % 120) + 'px'; m.style.top = (6 + (i * 13) % 50) + 'px';
    m.style.transform = `rotate(${(i * 47) % 40 - 20}deg)`;
    box.appendChild(m);
  });
  $('trayTotal').textContent = '$' + fmt(trayTotal());
}

// ---------- 卡片 ----------
function showCard(c) {
  const el = $('card');
  el.className = 'in ' + (c.flipped ? 'back' : 'front');
  el.style.transform = '';
  el.innerHTML = c.flipped
    ? '<div class="stripe"></div><div class="sig"></div><div class="backtxt">本卡為本行財產</div>'
    : `<div class="bankname">🏦 ATM人銀行 DEBIT</div><div class="chip"></div><div class="cardno">${c.card.replace(/(\d{3})(\d{3})/, '$1 $2')}</div>`;
  $('swipeHint').classList.remove('hidden'); $('noCard').classList.add('hidden');
}
function hideCard() { $('card').className = 'hidden'; $('swipeHint').classList.add('hidden'); $('noCard').classList.remove('hidden'); }
function animateCardOut() { const el = $('card'); el.classList.add('out'); setTimeout(() => { if (el.classList.contains('out')) hideCard(); }, 300); }
function setupSwipe() {
  const el = $('card'); let y0 = null;
  el.addEventListener('pointerdown', (e) => { y0 = e.clientY; el.classList.add('dragging'); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (y0 === null) return; const dy = Math.min(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
  const end = (e) => {
    if (y0 === null) return; const dy = e.clientY - y0; y0 = null; el.classList.remove('dragging');
    if (dy < -50) actPush(); else el.style.transform = '';
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

// ---------- 畫面 ----------
function setMirror(label, val) { $('mirrorLabel').textContent = label; $('mirrorValue').textContent = val; }
function setFace(mood) { const el = $('customer'); ['smirk', 'annoyed', 'angry'].forEach((m) => el.classList.remove(m)); if (mood && mood !== 'neutral') el.classList.add(mood); }
function say(text, mood) {
  if (mood) setFace(mood);
  const b = $('bubble');
  if (!text) { b.classList.add('hidden'); return; }
  b.textContent = text; b.classList.remove('hidden');
  b.style.animation = 'none'; b.offsetHeight; b.style.animation = '';
}
function renderQueue() {
  const q = $('queue'); q.innerHTML = '';
  S.queue.forEach((c) => { const d = document.createElement('div'); d.className = 'q sprite'; d.style.backgroundImage = `url(assets/cust${c.sprite}.jpg)`; q.appendChild(d); });
}
function renderHud() {
  const t = Math.max(0, S.time);
  $('timer').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('timer').style.color = t <= 30 ? '#ff5252' : '';
  $('hudDone').textContent = S.done; $('hudLoss').textContent = fmt(S.loss); $('hudComp').textContent = S.comp;
}
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 1400); }

// ---------- 開始 / 結束 ----------
function startGame() {
  SFX.unlock();
  S = newState(); S.running = true;
  $('startScreen').classList.add('hidden'); $('endScreen').classList.add('hidden');
  clearTray(); hideCard(); renderHud(); resetTerminalForNew(); say('');
  $('customer').classList.add('hidden');
  spawn(); S.nextSpawn = SPAWN_EVERY;
  S.tickId = setInterval(tick, 1000);
}
function endGame() {
  S.running = false; clearInterval(S.tickId);
  let rank, title;
  const fireReasons = [];
  if (S.loss >= 10000) fireReasons.push(`營業損失高達 NTD ${fmt(S.loss)}`);
  if (S.comp >= 6) fireReasons.push(`客訴累積 ${S.comp} 次`);
  if (S.done < 5) fireReasons.push(`整班只完成 ${S.done} 位顧客`);
  const fired = fireReasons.length > 0;
  if (fired) [rank, title] = ['💀', '解雇！明天不用來了'];
  else if (S.comp === 0 && S.loss === 0 && S.done >= 15) [rank, title] = ['S', '零失誤機器人'];
  else if (S.comp <= 2 && S.loss <= 2000) [rank, title] = ['A', '優秀櫃員'];
  else if (S.comp <= 5) [rank, title] = ['B', '血汗勞工'];
  else [rank, title] = ['C', '賠錢貨，準備開除'];
  $('rank').textContent = rank; $('rankTitle').textContent = title;
  $('fired').classList.toggle('hidden', !fired);
  if (fired) $('fired').innerHTML = `<div class="fh">解 僱 通 知 書</div>
    <div>ATM 機台內部作業員 台端：</div>
    <ul>${fireReasons.map((r) => `<li>${r}</li>`).join('')}</ul>
    <div>經本行審議，自即日起終止僱傭關係。請於今日內交還機房鑰匙並清空置物櫃。</div>
    <div class="fs">ATM人銀行 人資部 <span class="stamp">解僱</span></div>`;
  $('stats').innerHTML = `<tr><td>✅ 完成客戶數</td><td>${S.done} 人</td></tr>
    <tr><td>💸 營業損失總額</td><td>NTD ${fmt(S.loss)}</td></tr>
    <tr><td>😡 客訴總次數</td><td>${S.comp} 次</td></tr>
    <tr><td>🚶 流失顧客</td><td>${S.lost} 人</td></tr>`;
  const np = $('newspaper');
  if (S.news.length) {
    const uniq = [...new Map(S.news.map((n) => [n.head, n])).values()];
    np.innerHTML = '<div class="mast">社 會 日 報</div>' + uniq.map((n) => `<div class="head">${n.head}</div><div class="body">${n.body}</div>`).join('') + `<div class="body" style="margin-top:6px">（本日共 ${S.news.length} 起相關事件）</div>`;
    np.classList.remove('hidden');
  } else np.classList.add('hidden');
  $('endScreen').classList.remove('hidden');
}

// ---------- 綁定 ----------
function init() {
  S = newState();
  const pad = $('numpad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '清除', '0', '⌫'].forEach((k) => {
    const b = document.createElement('button'); b.textContent = k;
    if (k === '清除' || k === '⌫') b.className = 'clr';
    b.onclick = () => { SFX.beep(); if (k === '清除') S.buf = ''; else if (k === '⌫') S.buf = S.buf.slice(0, -1); else if (S.buf.length < 8) S.buf += k; renderBuf(); };
    pad.appendChild(b);
  });
  document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === t.dataset.tab));
  });
  document.querySelectorAll('.bill').forEach((b) => b.onclick = () => S.running && addBill(+b.dataset.v, b));
  $('btnV').onclick = () => S.running && actV();
  $('btnX').onclick = () => S.running && actX();
  $('btnReset').onclick = () => { SFX.beep(); clearTray(); };
  $('btnDispense').onclick = () => S.running && actDispense();
  $('btnQuery').onclick = () => S.running && actQuery();
  $('btnLock').onclick = () => S.running && actLock();
  $('btnAuth').onclick = () => S.running && actAuth();
  $('btnStart').onclick = startGame;
  $('btnRestart').onclick = startGame;
  setupSwipe();
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}
init();
