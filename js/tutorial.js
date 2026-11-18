// ===== 新手教學 =====
const TUT = { on: false, i: 0, loop: null, hl: [] };
const cur = () => S.cur;
const tabActive = (id) => $(id).classList.contains('active');
const crtHas = (s) => $('crtText').textContent.includes(s);

function tutCustomers() {
  const base = { try: 0, phase: 'walk', auth: null, fraud: false, flipped: false };
  return [
    { ...base, id: ++S.uid, name: '陳志明', sprite: 1, card: '520131', pin: '1688', seq: ['1688'], balance: 50000, amount: 3500 },
    { ...base, id: ++S.uid, name: '林雅婷', sprite: 2, card: '777888', pin: '0000', seq: ['0000'], balance: 2000, amount: 5000 },
  ];
}

// allow：允許點擊的元素選擇器；wait：自動前進條件；next：顯示「下一步」按鈕
const TUT_STEPS = [
  // ---- 第一位：正確提款 ----
  { text: '歡迎上工！你是藏在 ATM 裡的人。<br>第一位顧客 <b>陳志明</b> 來了，稍等他插卡…', wait: () => cur()?.phase !== 'walk' && $('card').className.includes('front') },
  { text: '卡片是<b>藍色正面</b>＝方向正確。<br>記下卡號 <b>520 131</b>。<br>（若是灰色背面，要把卡片<b>往上滑</b>推回）', hl: ['#card'], next: true },
  { text: '切換到【終端機】查詢這張卡。', hl: ['.tab[data-tab=term]'], allow: ['.tab[data-tab=term]'], wait: () => tabActive('term') },
  { text: '用數字鍵輸入卡號 <b>520131</b>。', hl: ['#numpad'], allow: ['#numpad'], wait: () => S.buf === '520131' },
  { text: '按【查詢卡號】。', hl: ['#btnQuery'], allow: ['#btnQuery', '#numpad'], wait: () => crtHas('520131') && crtHas('查詢結果') },
  { text: '查到了！正確密碼 <b>1688</b>、餘額 <b>$50,000</b>。<br>請看上方監視器右下角的 <b>ATM 螢幕</b>，等顧客輸入密碼…', hl: ['#crt', '#mirror'], wait: () => cur()?.phase === 'pinShown' },
  { text: '顧客輸入 <b>1688</b>，和終端機相符。<br>監視器的輸入框下方出現了 <b>V / X</b>，密碼正確請按 <b>V</b>！', hl: ['#mirror'], allow: ['#btnV'], wait: () => ['typingAmt', 'amtShown'].includes(cur()?.phase) },
  { text: '等顧客輸入提款金額…', hl: ['#mirror'], wait: () => cur()?.phase === 'amtShown' },
  { text: '顧客要領 <b>$3,500</b>，餘額 $50,000 足夠。<br>先到【終端機】授權。', hl: ['#mirror', '.tab[data-tab=term]'], allow: ['.tab[data-tab=term]'], wait: () => tabActive('term') },
  { text: '輸入 <b>3500</b> 後按【提款授權】。', hl: ['#numpad', '#btnAuth'], allow: ['#numpad', '#btnAuth'], wait: () => cur()?.auth === 3500, onTick: () => { const c = cur(); if (c && c.auth !== null && c.auth !== 3500) { c.auth = null; toast('金額不對，請重新輸入 3500'); } } },
  { text: '授權完成！切回【內部機房】點鈔。', hl: ['.tab[data-tab=room]'], allow: ['.tab[data-tab=room]'], wait: () => tabActive('room') },
  { text: '點 <b>3 張千元</b> + <b>5 張百元</b>，讓退幣槽剛好 <b>$3,500</b>。<br>點錯可按【清空】重來。', hl: ['#stacks', '#tray'], allow: ['.bill', '#btnReset'], wait: () => trayTotal() === 3500 },
  { text: '金額正確，按【確認出鈔】！', hl: ['#btnDispense'], allow: ['#btnDispense', '#btnReset', '.bill'], wait: () => S.done >= 1, onTick: () => {} },
  // ---- 第二位：餘額不足 ----
  { text: '🎉 完美！顧客拿錢離開了。<br>接著是第二位 <b>林雅婷</b>，等她插卡…', wait: () => cur()?.id && cur().name === '林雅婷' && cur().phase !== 'walk' },
  { text: '卡號 <b>777 888</b>。到【終端機】輸入並查詢。', hl: ['.tab[data-tab=term]', '#numpad', '#btnQuery'], allow: ['.tab', '#numpad', '#btnQuery'], wait: () => crtHas('777888') && crtHas('查詢結果') },
  { text: '密碼 <b>0000</b>、餘額只有 <b>$2,000</b>。<br>等她輸入密碼…', hl: ['#crt', '#mirror'], wait: () => cur()?.phase === 'pinShown' },
  { text: '密碼正確！按監視器上的 <b>V</b>。', hl: ['#mirror'], allow: ['.tab', '#btnV'], wait: () => ['typingAmt', 'amtShown'].includes(cur()?.phase) },
  { text: '等她輸入金額…（順便切回【內部機房】）', hl: ['#mirror', '.tab[data-tab=room]'], allow: ['.tab'], wait: () => cur()?.phase === 'amtShown' && tabActive('room') },
  { text: '她要領 <b>$5,000</b>，但餘額只有 <b>$2,000</b>！<br>不能出鈔 → 把卡片<b>往上滑</b>推回退客。', hl: ['#card'], allow: ['#card', '.tab'], wait: () => S.done >= 2 },
  { text: '✅ 教學完成！<br>記住：<b>V/X</b> 判密碼、錯 3 次要<b>鎖卡</b>、出鈔前先<b>授權</b>。<br>沒有防呆，祝你不被開除！', next: true, last: true },
];

function tutStart() {
  SFX.unlock();
  document.querySelector('.tab[data-tab=room]').click();
  S = newState(); S.running = true; S.tutorial = true;
  TUT.on = true; TUT.i = 0;
  $('startScreen').classList.add('hidden'); $('endScreen').classList.add('hidden');
  clearTray(); hideCard(); renderHud(); resetTerminalForNew(); say('');
  $('timer').textContent = '教學';
  S.queue = tutCustomers();
  nextCustomer();
  $('guide').classList.remove('hidden');
  tutShow();
  TUT.loop = setInterval(tutTick, 150);
}
function tutShow() {
  const st = TUT_STEPS[TUT.i];
  $('guideStep').textContent = `新手教學 ${TUT.i + 1} / ${TUT_STEPS.length}`;
  $('guideText').innerHTML = st.text;
  $('guideNext').classList.toggle('hidden', !st.next);
  $('guideNext').textContent = st.last ? '回主畫面' : '下一步 ▶';
  TUT.hl.forEach((e) => e.classList.remove('tut-hl'));
  TUT.hl = (st.hl || []).flatMap((s) => [...document.querySelectorAll(s)]);
  TUT.hl.forEach((e) => e.classList.add('tut-hl'));
}
function tutAdvance() {
  if (TUT_STEPS[TUT.i].last) return tutExit();
  TUT.i++; SFX.ok(); tutShow();
}
function tutTick() {
  if (!TUT.on) return;
  const st = TUT_STEPS[TUT.i];
  st.onTick?.();
  if (st.wait && st.wait()) tutAdvance();
}
function tutExit() {
  TUT.on = false; clearInterval(TUT.loop);
  TUT.hl.forEach((e) => e.classList.remove('tut-hl'));
  S.running = false;
  $('guide').classList.add('hidden');
  $('bubble').classList.add('hidden');
  $('startScreen').classList.remove('hidden');
}
// 教學中只允許點擊指定元素，避免玩家誤觸導致流程中斷
function tutBlock(e) {
  if (!TUT.on || e.target.closest('#guide')) return;
  const allow = TUT_STEPS[TUT.i].allow || [];
  if (allow.some((s) => e.target.closest(s))) return;
  e.stopPropagation(); e.preventDefault();
}
['click', 'pointerdown'].forEach((t) => document.addEventListener(t, tutBlock, true));
$('btnTutorial').onclick = tutStart;
$('guideNext').onclick = tutAdvance;
$('guideExit').onclick = tutExit;
