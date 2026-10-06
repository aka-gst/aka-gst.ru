// 19.1 · DOM of the diver card, the ring (duel / storm / hack), the share
// code and the class mock (canon §19). Data and rules: diver-card.js,
// duel-tasks.js, duel.js, class-mock.js, profile-store.js. One overlay,
// one screen at a time, no page scroll at 1280×800 and 375×812, ≥14 px.

import { AREAS, AREA_IDS, AREA_QUESTS, AVATARS, diverCard, areaById, cleanNick, NICK_MAX } from './diver-card.js';
import { WAY_NAMES, STAGE_NAMES } from './mastery.js';
import { BUFFS, GHOSTS, ladder, nextGhost, createMatch, startRound, answerRound, practiceSummary, duelProofs, recordOutcome, meFromProfile, shareFromProfile, decodeShare, ghostFromShare, STORM_SITES, HACK_TARGET, DAILY_CAP, buffOfArea } from './duel.js';
import { SIGNS } from './duel-tasks.js';
import { sampleClass, classSummary, studentFromSnapshot, studentFromCard } from './class-mock.js';
import { badgeGrid, badgeCount, RARITY } from './achievements.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS_HREF = new URL('./duel.css?v=193', import.meta.url).href;
const pct = (v) => `${Math.round(v)}%`;
const BUFF_GLYPH = { attack: '⚔', double: '⚔⚔', shield: '⛨', heal: '✚', aura: '◎', auto: '⚙' };

// --------------------------------------------------------------- drawing
export function drawDiver(ctx, x, y, s, avatarId = 0, { facing = 1, lunge = 0, hurt = 0, t = 0, ko = false } = {}) {
  const a = AVATARS[avatarId] ?? AVATARS[0];
  const bob = ko ? 0 : Math.sin(t * 3 + x) * s * 0.03;
  ctx.save();
  ctx.translate(x + lunge * facing * s * 0.5, y + bob);
  if (ko) ctx.rotate(-facing * 0.9);
  if (hurt > 0) ctx.translate((Math.random() - 0.5) * hurt * s * 0.12, 0);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.02, s * 0.32, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.fillStyle = a.trim;
  ctx.fillRect(-s * 0.16, -s * 0.32, s * 0.12, s * 0.32); ctx.fillRect(s * 0.04, -s * 0.32, s * 0.12, s * 0.32);
  // body
  ctx.fillStyle = hurt > 0.5 ? '#ffffff' : a.suit;
  roundRect(ctx, -s * 0.24, -s * 0.78, s * 0.48, s * 0.5, s * 0.1); ctx.fill();
  ctx.fillStyle = a.trim; ctx.fillRect(-s * 0.24, -s * 0.5, s * 0.48, s * 0.05);
  // arm (forward when lunging)
  ctx.save(); ctx.translate(facing * s * 0.2, -s * 0.66); ctx.rotate(facing * (0.3 + lunge * 1.1));
  ctx.fillStyle = a.suit; roundRect(ctx, -s * 0.05, 0, s * 0.1, s * 0.34, s * 0.05); ctx.fill(); ctx.restore();
  // helmet + visor
  ctx.fillStyle = a.suit; ctx.beginPath(); ctx.arc(0, -s * 0.94, s * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = a.visor; roundRect(ctx, facing > 0 ? -s * 0.04 : -s * 0.16, -s * 1.0, s * 0.2, s * 0.1, s * 0.04); ctx.fill();
  ctx.strokeStyle = a.trim; ctx.lineWidth = Math.max(1, s * 0.02); ctx.beginPath(); ctx.arc(0, -s * 0.94, s * 0.2, 0, Math.PI * 2); ctx.stroke();
  // antenna
  ctx.strokeStyle = a.visor; ctx.beginPath(); ctx.moveTo(-facing * s * 0.08, -s * 1.12); ctx.lineTo(-facing * s * 0.14, -s * 1.24); ctx.stroke();
  ctx.fillStyle = a.suit; ctx.beginPath(); ctx.arc(-facing * s * 0.14, -s * 1.25, s * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fitCanvas(c) {
  const r = c.getBoundingClientRect(); const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return { w, h, dpr };
}
function areaRing(ctx, x, y, R, t, alpha = 1) {
  // ПОЛЕ — a buff over an area: a hex grid of light on the floor, slowly breathing.
  ctx.save(); ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(t * 4)); ctx.translate(x, y); ctx.scale(1, 0.34);
  ctx.strokeStyle = '#64e9ff'; ctx.shadowColor = '#64e9ff'; ctx.shadowBlur = 10; ctx.lineWidth = 2.5;
  const hex = (cx, cy, r) => { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); };
  const r = R / 3.2;
  hex(0, 0, r);
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3 + t * 0.2; hex(Math.cos(a) * r * 1.75, Math.sin(a) * r * 1.75, r); }
  ctx.strokeStyle = '#ffc857'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, R, R, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// --------------------------------------------------------------- the view
export function createRing(root, { getProfile = () => ({}), onProfile = () => {}, onSound = () => {}, getPlayer = () => null, canDuel = () => ({ ok: true }), onClose = () => {}, store = null, decorate = () => {}, onDuelEnd = () => ({}), onForgedCode = () => {} } = {}) {
  if (!root) return { open() {}, close() {}, isOpen: () => false };
  const doc = root.ownerDocument;
  if (doc && !doc.querySelector('link[data-ring-css]')) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.ringCss = ''; doc.head.append(l); }
  let view = 'card', demo = false, open = false, fast = false;
  let selArea = null, picked = null, friend = null, shareError = '', classPick = 0, lastEnd = null;
  let match = null, phase = 'idle', taskAt = 0, answered = null, feedback = null, foeSaid = false, nextTimer = 0, raf = 0, fx = [], lastTick = -1;
  const now = () => performance.now();
  const sound = (n) => onSound(n);
  const player = () => { try { return getPlayer() ?? null; } catch { return null; } };
  // The in-game nick lives in the profile (editable here, also when signed in).
  const nick = () => { const pr = getProfile(); return pr.duel?.nick ? cleanNick(pr.duel.nick) : player()?.nick ? cleanNick(player().nick) : diverCard(pr).nick; };
  const account = () => store?.account ?? null;
  const liveClasses = () => Boolean(player() && account()?.hasClasses?.());
  const gate = () => (demo ? { ok: true } : canDuel());

  function shell(title, kicker, body, { back = true } = {}) {
    root.innerHTML = `<header class="ring__top"><div><small>${esc(kicker)}</small><h2 id="ringTitle">${esc(title)}</h2></div>
      <div class="ring__top-actions">${back && view !== 'card' ? '<button type="button" class="ring__back" data-ring="card" aria-label="К карточке">←<span class="ring-wide"> КАРТОЧКА</span></button>' : ''}<button type="button" class="ring__close" aria-label="Закрыть">×</button></div></header>
      <div class="ring__body" data-view="${view}">${body}</div>`;
    root.querySelector('.ring__close').addEventListener('click', close);
    try { decorate(root); } catch { /* the account pill is optional */ }
  }
  function wire() {
    for (const b of root.querySelectorAll('[data-ring]')) b.addEventListener('click', () => go(b.dataset.ring));
  }
  function go(where) {
    sound('ui-click');
    if (where === 'card') return render('card');
    if (where === 'ladder' || where === 'storm' || where === 'hack') { if (!gate().ok) { flash(gate().reason ?? 'Откроется после увольнения.'); return; } }
    if (where === 'storm-garage') return startMatch({ mode: 'storm', site: 'garage' });
    if (where === 'storm-server') return startMatch({ mode: 'storm', site: 'server' });
    if (where === 'hack') return startMatch({ mode: 'hack' });
    if (where === 'fight') return startMatch({ mode: 'duel', foe: picked === 'friend' && friend ? friend : classGhost(picked) ?? GHOSTS.find((g) => g.id === picked) ?? nextGhost(getProfile()) });
    if (where === 'again' && lastEnd) return startMatch(lastEnd.opts);
    if (where === 'next-ghost') { picked = nextGhost(getProfile()).id; return startMatch({ mode: 'duel', foe: GHOSTS.find((g) => g.id === picked) }); }
    render(where);
  }
  function flash(text) { const el = root.querySelector('.ring__flash'); if (el) { el.textContent = text; el.hidden = false; } sound('blocked'); }

  // ------------------------------------------------------------ КАРТОЧКА
  const narrow = () => (globalThis.innerWidth ?? 1280) <= 700;
  const pips = (floors) => `<span class="ring-pips" aria-label="этажи">${floors.map((st, i) => `<i data-on="${st > 0}" title="${WAY_NAMES[['tap', 'knobs', 'code', 'raw'][i]]}${st ? ` · ${STAGE_NAMES[st]}` : ''}"></i>`).join('')}</span>`;
  function areaDetail(a) {
    const ways = ['tap', 'knobs', 'code', 'raw'];
    return `<small>ОБЛАСТЬ · ${esc(a.word.toUpperCase())}</small><h3><i class="ring-ico">${esc(a.glyph)}</i> ${esc(a.name)} <b>${a.power}</b></h3>
      <ol class="ring-floors">${ways.map((w, i) => `<li data-on="${a.floors[i] > 0}"><b>${esc(WAY_NAMES[w])}</b><span>${a.floors[i] ? esc(STAGE_NAMES[a.floors[i]]) : '—'}</span></li>`).join('')}</ol>
      <ul class="ring-topics">${a.topics.map((tp) => `<li data-proof="${tp.proofs > 0}">${tp.proofs > 0 ? '✓' : '·'} ${esc(tp.name)}${tp.task ? '' : ' <em>(в большой игре)</em>'}</li>`).join('')}</ul>
      <p class="ring-detail__go">${a.proofs ? `${a.proofs} ${a.proofs === 1 ? 'доказательство' : a.proofs < 5 ? 'доказательства' : 'доказательств'}${a.confirmed ? ' · ✓ подтверждено' : ''}. ` : 'Доказательств пока нет. '}Где взять: ${esc(AREA_QUESTS[a.id])}.</p>
      <p class="ring-detail__buff">В бою эта область даёт: <b>${esc(BUFFS[a.buff].name)}</b> — ${esc(BUFFS[a.buff].line)}.</p>`;
  }
  function renderCard() {
    const c = diverCard(getProfile());
    if (!selArea) selArea = c.strongest?.id ?? 'say';
    const sel = c.areas.find((a) => a.id === selArea) ?? c.areas[0];
    const p = player();
    const g = gate();
    const rows = c.areas.map((a) => `<li><button type="button" class="ring-area" data-area="${a.id}" aria-pressed="${a.id === sel.id}" data-top="${a.id === c.strongest?.id}">
        <i class="ring-ico">${esc(a.glyph)}</i><span class="ring-area__name">${esc(a.name)}${a.confirmed ? ' <em class="ring-ok" title="подтверждено доказательствами">✓</em>' : ''}</span>${pips(a.floors)}<span class="ring-bar"><i style="width:${a.power}%"></i></span><b class="ring-area__pow">${a.power}</b><span class="ring-area__word">${esc(a.word)}</span></button></li>`).join('');
    const xpLine = c.next ? `${c.xp} XP · до «${esc(c.next)}» ещё ${c.toNext}` : `${c.xp} XP · высший ранг`;
    shell('Карточка дайвера', `ГЛУБИНА · ГРАЖДАНИН${demo ? ' · ПОКАЗ' : ''}`, `
      <aside class="ring-side">
        <button type="button" class="ring-side__avatar" data-avatar title="Сменить облик"><canvas id="ringAvatar" width="120" height="120" aria-label="Облик дайвера"></canvas></button>
        <div class="ring-side__who">
          <button type="button" class="ring-side__nick" data-ring="share" title="Сменить ник (виден в дуэлях и кодах)">${esc(nick())} ✎</button>
          <span class="akk-slot" data-akk-slot="card" hidden></span>
          <small class="ring-side__rank">${esc(c.rank)}</small>
          <span class="ring-bar ring-bar--xp"><i style="width:${Math.round(c.progress * 100)}%"></i></span>
          <small>${xpLine}</small>
          <small class="ring-side__more">Ринг: боёв ${c.ring.played} · побед ${c.ring.won}</small>
          <small class="ring-side__more">Призраки: ${c.ring.beaten.length} из ${GHOSTS.length}</small>
          <button type="button" class="ring-side__badges" data-ring="badges" title="Твои значки">✦ ЗНАЧКИ: ${badgeCount(getProfile())} из ${badgeGrid(getProfile()).total}</button>
        </div>
      </aside>
      <section class="ring-power">
        <h3 class="ring-power__title">НАСКОЛЬКО ТЫ МОЩНЫЙ <small>по доказательствам: этаж × уверенность, не по XP</small></h3>
        <ol class="ring-areas">${rows}</ol>
        <p class="ring-hint">${c.strongest ? `Сильнее всего: <b>${esc(c.strongest.name)}</b>. ` : ''}${c.suggest ? `Подтянуть: <b>${esc(areaById(c.suggest.area).name)}</b> → ${esc(c.suggest.quest)}.` : ''}</p>
      </section>
      <aside class="ring-detail">${areaDetail(sel)}</aside>
      <nav class="ring-actions">
        <button type="button" class="ring-go" data-ring="ladder" data-locked="${!g.ok}">⚔ <span class="ring-wide">ВЫЗВАТЬ НА </span>ДУЭЛЬ</button>
        <button type="button" data-ring="storm" data-locked="${!g.ok}">⛨ <span class="ring-wide">ТИСКИ-</span>ШТУРМ</button>
        <button type="button" data-ring="hack" data-locked="${!g.ok}">⚿ ВЗЛОМ<span class="ring-wide"> ЗАМКА</span></button>
        <button type="button" data-ring="share">⇄ КОД ДРУГУ</button>
        <button type="button" data-ring="class">▦ КЛАСС${liveClasses() ? '' : '<span class="ring-wide"> · пример</span>'}</button>
      </nav>
      <p class="ring__flash" role="status" ${g.ok ? 'hidden' : ''}>${g.ok ? '' : esc(g.reason ?? '')}</p>`);
    wire();
    for (const b of root.querySelectorAll('[data-area]')) b.addEventListener('click', () => { selArea = b.dataset.area; sound('ui-click'); if (narrow()) render('area'); else renderCard(); });
    root.querySelector('[data-avatar]')?.addEventListener('click', () => { const pr = getProfile(); const d = pr.duel ?? {}; onProfile({ ...pr, duel: { ...d, avatar: ((Number(d.avatar) || 0) + 1) % AVATARS.length } }); sound('switch'); renderCard(); });
    const av = root.querySelector('#ringAvatar'); if (av) { const ctx = av.getContext('2d'); ctx.clearRect(0, 0, 120, 120); drawDiver(ctx, 60, 112, 78, c.avatar, { t: 0 }); }
  }
  function renderArea() {
    const c = diverCard(getProfile());
    const a = c.areas.find((x) => x.id === selArea) ?? c.areas[0];
    shell(a.name, 'КАРТОЧКА ДАЙВЕРА · ОБЛАСТЬ', `<section class="ring-detail ring-detail--page">${areaDetail(a)}</section>`);
    wire();
  }

  // ------------------------------------------------------------ ЗНАЧКИ
  function renderBadges() {
    const g = badgeGrid(getProfile());
    const RW = { common: 'обычный', rare: 'редкий', epic: 'легендарный', secret: 'секретный' };
    const cells = g.rows.map((b) => `<li class="ring-badge" data-earned="${b.earned}" data-rarity="${b.rarity}">
        <i class="ring-badge__glyph">${esc(b.glyph)}</i>
        <b class="ring-badge__title">${esc(b.title)}</b>
        <small class="ring-badge__how">${esc(b.earned ? b.how : (b.secret ? '' : b.how))}</small>
        <em class="ring-badge__rar">${esc(RW[b.rarity])}</em>
      </li>`).join('');
    shell('Значки', 'ЗА ДЕЛА, НЕ ЗА ОЧКИ', `
      <section class="ring-badges-wrap">
        <p class="ring-badges-head">Открыто <b>${g.earned}</b> из ${g.total}${g.hiddenSecrets ? ` · ${g.hiddenSecrets} ${g.hiddenSecrets === 1 ? 'секрет ещё спрятан' : 'секретов ещё спрятано'}` : ''}. Значок даётся за поступок: помог человеку, прошёл ночь, нашёл шов.</p>
        <ul class="ring-badges">${cells}</ul>
      </section>`);
    wire();
  }

  // ------------------------------------------------------------ ТУРНИРЫ
  function renderLadder() {
    const l = ladder(getProfile());
    if (!picked || (picked !== 'friend' && !classGhost(picked) && !l.find((g) => g.id === picked && g.open))) picked = nextGhost(getProfile()).id;
    loadClassmates();
    const mates = classmates();
    const rows = l.map((g) => {
      const top = AREA_IDS.map((id, i) => ({ id, p: g.powers[i] })).sort((a, b) => b.p - a.p).slice(0, 2).map((x) => `${areaById(x.id).name} ${x.p}`).join(', ');
      return `<li><button type="button" data-ghost="${g.id}" aria-pressed="${picked === g.id}" ${g.open ? '' : 'disabled'}><canvas data-face="${g.avatar}" width="56" height="56" aria-hidden="true"></canvas><span><strong>${esc(g.name)}</strong><em>${g.open ? `сильнее всего: ${esc(top)}` : 'откроется после победы над предыдущим'}</em></span><b>${g.beaten ? '✓' : g.open ? '▶' : '🔒'}</b></button></li>`;
    }).join('');
    shell('Ринг «ТИСКОВ»', 'ДУЭЛЬ ЗАДАЧКАМИ · ПРИЗРАКИ', `
      <p class="ring-vitya"><b>Витя:</b> «У ТИСКОВ стажёры по вечерам меряются на ринге — задачками. Решил быстро — получил баф. Сходи, покажи им, кто тут дайвер».</p>
      <ol class="ring-ladder">${rows}${friend ? `<li><button type="button" data-ghost="friend" aria-pressed="${picked === 'friend'}"><canvas data-face="${friend.avatar}" width="56" height="56" aria-hidden="true"></canvas><span><strong>${esc(friend.name)} · призрак друга</strong><em>по коду друга</em></span><b>⇄</b></button></li>` : ''}${mates.length ? `<li class="ring-ladder__head"><small>ОДНОКЛАССНИКИ · карточки, которые они сами открыли классу</small></li>${mates.map((g) => `<li><button type="button" data-ghost="${esc(g.id)}" aria-pressed="${picked === g.id}"><canvas data-face="${g.avatar}" width="56" height="56" aria-hidden="true"></canvas><span><strong>${esc(g.name)} · одноклассник</strong><em>призрак по открытой карточке</em></span><b>▦</b></button></li>`).join('')}` : ''}</ol>
      <nav class="ring-actions ring-actions--two"><button type="button" class="ring-go" data-ring="fight">В БОЙ →</button><button type="button" data-ring="share">⇄ ДРУГ ПО КОДУ</button></nav>`);
    wire();
    for (const b of root.querySelectorAll('[data-ghost]')) b.addEventListener('click', () => { picked = b.dataset.ghost; sound('ui-click'); renderLadder(); });
    faces();
  }
  function faces() { for (const c of root.querySelectorAll('canvas[data-face]')) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); drawDiver(ctx, c.width / 2, c.height * 0.98, c.height * 0.72, Number(c.dataset.face), { t: 0 }); } }

  // ------------------------------------------------------------ ШТУРМ
  function renderStorm() {
    shell('ТИСКИ-штурм', 'ЗАЩИТА · ВОЛНЫ', `
      <p class="ring-vitya">Пять волн «ТИСКОВ». На щитке ворот загорается задачка — решил, и защита держит волну, а вокруг ворот встаёт поле. Ошибся — волна бьёт по воротам.</p>
      <ol class="ring-ladder">${Object.values(STORM_SITES).map((s) => `<li><button type="button" data-ring="storm-${s.id}"><span><strong>${esc(s.title)}</strong><em>${esc(s.line)}</em></span><b>▶</b></button></li>`).join('')}</ol>`);
    wire();
  }

  // ------------------------------------------------------------ КОД ДЛЯ ДРУГА
  function renderShare() {
    const code = shareFromProfile(getProfile(), nick());
    const p = player();
    shell('Код для друга', 'ДУЭЛЬ БЕЗ СЕРВЕРА', `
      <section class="ring-share">
        <label class="ring-share__nick">Твой ник в игре <small>виден в дуэлях и в кодах${p ? ' · хранится в аккаунте' : ''}</small><input id="ringNick" maxlength="${NICK_MAX}" value="${esc(nick())}" autocomplete="off"></label>
        <p class="ring-share__label">Твой код — это твоя карточка: ник, облик и силу по девяти областям. Друг вставит его и сразится с твоим призраком.</p>
        <code id="ringMyCode" class="ring-share__code">${esc(code)}</code>
        <div class="ring-share__row"><button type="button" class="ring-go" id="ringCopy">СКОПИРОВАТЬ КОД</button><button type="button" id="ringCopyLink" class="ring-link">ИЛИ ССЫЛКУ</button><span id="ringCopied" role="status"></span></div>
        <ol class="ring-share__how"><li>Скопируй код и отправь другу в мессенджер.</li><li>Друг открывает ссылку — или в QueQuest: Карточка → «Код другу» → вставить код.</li><li>Он бьётся с твоим призраком — призрак отвечает так, как умеешь ты.</li></ol>
        <label class="ring-share__label" for="ringFriendCode">Код друга</label>
        <div class="ring-share__row"><input id="ringFriendCode" placeholder="QQ1.…" autocomplete="off" spellcheck="false"><button type="button" class="ring-go" id="ringFriendGo">ДУЭЛЬ С ПРИЗРАКОМ ДРУГА →</button></div>
        <p class="ring__flash" id="ringShareError" role="status" ${shareError ? '' : 'hidden'}>${esc(shareError)}</p>
      </section>`);
    wire();
    root.querySelector('#ringNick')?.addEventListener('change', (e) => { const pr = getProfile(); onProfile({ ...pr, duel: { ...(pr.duel ?? {}), nick: cleanNick(e.target.value) } }); renderShare(); });
    const copy = async (text) => {
      let ok = false;
      try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 700))]); ok = true; } catch { /* no clipboard: select it */ }
      if (!ok) { const r = doc.createRange(); r.selectNodeContents(root.querySelector('#ringMyCode')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      const touch = globalThis.matchMedia?.('(pointer: coarse)').matches;
      root.querySelector('#ringCopied').textContent = ok ? '✓ Скопировано' : touch ? 'Код выделен — нажми «Копировать»' : 'Код выделен — нажми Ctrl+C';
      sound('reflex-save');
    };
    const code0 = root.querySelector('#ringMyCode').textContent;
    root.querySelector('#ringCopy').addEventListener('click', () => copy(code0));
    root.querySelector('#ringCopyLink').addEventListener('click', () => copy(`${location.origin}${location.pathname}?duel=${encodeURIComponent(code0)}`));
    root.querySelector('#ringFriendGo').addEventListener('click', () => {
      const d = decodeShare(root.querySelector('#ringFriendCode').value);
      if (!d.ok) { shareError = d.reason; sound('duel-wrong'); if (/контрольная сумма|изменён|повреждён/i.test(d.reason)) { try { onForgedCode(d.reason); } catch { /* optional */ } } renderShare(); return; }
      shareError = ''; friend = ghostFromShare(d.card); picked = 'friend';
      if (!gate().ok && !demo) { demo = true; }
      startMatch({ mode: 'duel', foe: friend });
    });
  }

  // ------------------------------------------------------------ КЛАСС
  // Without a class service: the made-up example class (макет). With the
  // site accounts + classes (feature-detected, docs/AKKAUNTY-CLASS.md): my
  // classes, the cards classmates chose to open, join by code, create one.
  let realClass = null, classes = null, classSel = null, classMsg = '', classCode = '';
  const CLASS_ERRORS = {
    no_classes: 'Классы на сайте ещё не включены.', offline: 'Нет связи — попробуй позже.', not_logged_in: 'Сначала войди в аккаунт.',
    bad_code: 'Код не похож на код класса — проверь у учителя.', not_found: 'Такого кода нет — проверь у учителя.', too_many_attempts: 'Слишком много неверных кодов. Подожди немного.',
    bad_nick: 'Ник в классе: 3–24 знака — буквы, цифры, пробел, _ . -', nick_taken: 'Такой ник в этом классе уже есть — возьми другой.',
    is_teacher: 'Это твой класс — ты в нём учитель.', class_full: 'Класс заполнен.', too_many_classes: 'Слишком много классов.', bad_name: 'Назови класс (до 40 знаков).',
    card_too_large: 'Сервер отклонил карточку: слишком большая. Сервер тоже не дурак — размер он считает сам.', bad_card: 'Сервер отклонил карточку: не прошла проверку. Сервер тоже не дурак — он проверяет сам, не веря браузеру.', card_too_complex: 'Сервер отклонил карточку: слишком сложная. Сервер тоже не дурак — проверяет сам.',
    forbidden: 'Это может только учитель класса.', bad_klass: 'Такого класса нет.', bad_origin: 'Классы работают только на сайте aka-gst.ru.', too_many_requests: 'Слишком много запросов — подожди немного.', too_many_games: 'Слишком много игр на аккаунте.', bad_max: 'Мест в классе: от 1 до 100.',
  };
  const classIdOf = (c) => String(c?.id ?? c?.klass ?? c?.class ?? '');
  function loadClasses() {
    if (!liveClasses() || classes !== null) return;
    classes = [];
    Promise.resolve(account().classMine()).then((r) => {
      const list = r?.klassy ?? [];
      classes = (Array.isArray(list) ? list : []).filter((c) => classIdOf(c));
      if (!classes.find((c) => classIdOf(c) === classSel)) classSel = classes[0] ? classIdOf(classes[0]) : null;
      realClass = null;
      if (view === 'class' || view === 'myclass' || view === 'ladder') render(view);
    }).catch(() => {});
  }
  function currentClassId() { return liveClasses() ? classSel : player()?.classId ?? null; }
  function loadClassmates() {
    loadClasses();
    const id = currentClassId();
    if (!id || !store || realClass !== null) return;
    realClass = [];
    Promise.resolve(store.listPlayers({ classId: id })).then((rows) => {
      realClass = (rows ?? []).filter((r) => r?.snapshot || r?.card).map((r) => (r.snapshot ? studentFromSnapshot(r) : { ...studentFromCard(r), me: Boolean(r.me) }));
      if (view === 'class' || view === 'ladder') render(view);
    }).catch(() => {});
  }
  const classmates = () => (realClass ?? []).filter((s) => s.ghost && !s.me).map((s) => s.ghost);
  const classGhost = (id) => classmates().find((g) => g.id === id) ?? null;
  function renderClass() {
    const pl = player();
    loadClassmates();
    const real = Boolean(realClass?.length);
    const list = real ? realClass : sampleClass();
    const sum = classSummary(list);
    const sel = list[classPick] ?? list[0];
    const live = liveClasses();
    const cname = live ? (classes ?? []).find((c) => classIdOf(c) === classSel)?.name ?? classSel : pl?.classId;
    const head = AREAS.map((a) => `<th title="${esc(a.name)}">${esc(a.glyph)}</th>`).join('');
    const rows = list.map((s, i) => `<tr data-student="${i}" aria-selected="${i === classPick}"><th><button type="button" data-pick="${i}">${esc(s.nick)}</button></th>${s.powers.map((p, k) => `<td style="--p:${p}" data-stuck="${s.stuck?.id === AREA_IDS[k]}">${p || '·'}</td>`).join('')}<td class="ring-class__lvl">${s.public ? '·' : s.card.proofs}</td><td class="ring-class__badges" data-seam="${Boolean(s.badges?.seam)}" title="значки${s.badges?.seam ? ' · нашёл шов' : ''}">${s.badges?.count ? `${s.badges.count}${s.badges.seam ? '⟊' : ''}` : '·'}</td></tr>`).join('');
    shell('Класс', real ? 'КЛАСС · ОТКРЫТЫЕ КАРТОЧКИ' : 'КАБИНЕТ УЧИТЕЛЯ · МАКЕТ', `
      <p class="ring-class__label">${real ? `КЛАСС «${esc(cname)}» · ${list.length} ${live ? 'открытых карточек (видно только то, что ученик сам открыл: облик, ранг, силы; ник — ник класса)' : 'учеников'}` : 'ПРИМЕР КЛАССА · имена и данные выдуманы. Так будет выглядеть кабинет учителя, когда появятся аккаунты.'}${live ? ' <button type="button" class="ring-link" data-ring="myclass">▦ МОЙ КЛАСС · вступить / создать</button>' : ''}</p>
      <div class="ring-class">
        <table class="ring-class__grid"><thead><tr><th>ученик</th>${head}<th title="доказательств">✓</th><th title="значки">✦</th></tr></thead><tbody>${rows}</tbody></table>
        <aside class="ring-class__detail">
          <h3>${esc(sel.nick)} · ${esc(sel.card.rank)}</h3>
          <p>${sel.public ? 'открытая карточка' : `${sel.card.proofs} доказательств`} · сильнее всего: ${esc(sel.card.strongest?.name ?? '—')} ${sel.card.strongest?.power ?? ''}</p>
          <p class="ring-class__badgeline">Значки: <b>${sel.badges?.count ?? 0}</b>${sel.badges?.seam ? ' · <em class="ring-class__seam">⟊ нашёл шов</em>' : ''}</p>
          ${sel.stuck ? `<p class="ring-class__stuck">${sel.public ? 'Слабее всего' : 'Застрял'}: <b>${esc(sel.stuck.name)}</b> — ${esc(sel.stuck.why)}</p><p>Дать: ${esc(sel.suggest)}</p>` : ''}
          <p class="ring-class__sum">Классу подтянуть: <b>${esc(sum.weakest.name)}</b> (в среднем ${sum.weakest.avg}) · значков всего: ${sum.badges}${sum.seams ? ` · «нашёл шов»: ${sum.seams}` : ''}</p>
        </aside>
      </div>`);
    wire();
    for (const b of root.querySelectorAll('[data-pick]')) b.addEventListener('click', () => { classPick = Number(b.dataset.pick); sound('ui-click'); renderClass(); });
  }
  function renderMyClass() {
    const acc = account();
    if (!liveClasses()) { render('class'); return; }
    loadClasses();
    const showing = acc.showCard();
    const mine = (classes ?? []).map((c) => `<button type="button" data-klass="${esc(classIdOf(c))}" aria-pressed="${classIdOf(c) === classSel}">${esc(c.name ?? classIdOf(c))}${c.teacher ? ' · ты учитель' : c.myNick ? ` · ты «${esc(c.myNick)}»` : ''}</button>${c.teacher && c.code ? `<small>код для учеников: <b class="ring-myclass__code">${esc(c.code)}</b>${c.members != null ? ` · учеников: ${c.members}` : ''}</small>` : ''}`).join('');
    shell('Мой класс', 'АККАУНТ · КЛАСС', `
      <div class="ring-myclass">
        <section><h3>МОИ КЛАССЫ</h3>${mine || '<p>Пока ни одного. Вступи по коду учителя — или создай класс, если ты учитель.</p>'}</section>
        <section><h3>ВСТУПИТЬ ПО КОДУ</h3>
          <input id="ringClassCode" placeholder="код от учителя" autocomplete="off" spellcheck="false" maxlength="24">
          <input id="ringClassNick" maxlength="24" value="${esc(nick())}" autocomplete="off" aria-label="ник в классе">
          <small>Ник в классе (3–24 знака) видят только этот класс и учитель. Почта и вход — никому.</small>
          <button type="button" class="ring-go" id="ringClassJoin">ВСТУПИТЬ</button></section>
        <section><h3>МОЯ КАРТОЧКА</h3>
          <label class="ring-toggle"><input type="checkbox" id="ringShowCard" ${showing ? 'checked' : ''}> Показывать мою карточку классу</label>
          <small>Только облик, ранг и 9 сил — для дуэлей с твоим призраком. В классе ты под ником класса. Без прогресса и истории. Выключил — карточка удаляется из всех классов.</small></section>
        <section><h3>Я УЧИТЕЛЬ</h3>
          <input id="ringClassName" placeholder="например, 7Б информатика" maxlength="40" autocomplete="off">
          <button type="button" id="ringClassCreate">СОЗДАТЬ КЛАСС</button>
          ${classCode ? `<p>Код для учеников: <b class="ring-myclass__code">${esc(classCode)}</b></p>` : ''}</section>
        <p class="ring__flash" role="status" ${classMsg ? '' : 'hidden'}>${esc(classMsg)}</p>
      </div>`);
    wire();
    const say = (r, ok) => { classMsg = r?.ok ? ok : (CLASS_ERRORS[r?.error] ?? `Не вышло (${String(r?.error ?? 'ошибка').slice(0, 30)}).`); sound(r?.ok ? 'reflex-save' : 'blocked'); classes = null; realClass = null; renderMyClass(); };
    for (const b of root.querySelectorAll('[data-klass]')) b.addEventListener('click', () => { classSel = b.dataset.klass; realClass = null; sound('ui-click'); renderMyClass(); });
    root.querySelector('#ringClassJoin').addEventListener('click', async () => say(await acc.classJoin(root.querySelector('#ringClassCode').value, root.querySelector('#ringClassNick').value), 'Ты в классе!'));
    root.querySelector('#ringClassCreate').addEventListener('click', async () => { const r = await acc.classCreate(root.querySelector('#ringClassName').value || 'Мой класс'); classCode = r?.ok ? String(r.klass?.code ?? '') : ''; if (r?.ok) classSel = String(r.klass?.id ?? classSel); say(r, 'Класс создан. Дай ученикам код.'); });
    root.querySelector('#ringShowCard').addEventListener('change', async (e) => { const c = diverCard(getProfile()); const r = await acc.setShowCard(e.target.checked, { avatar: c.avatar, rank: c.rank, rankIndex: c.rankIndex, powers: AREA_IDS.map((id) => c.areas.find((a) => a.id === id)?.power ?? 0) }); say(r, e.target.checked ? 'Карточка открыта классу.' : 'Карточка скрыта.'); });
  }

  // ------------------------------------------------------------ АРЕНА
  function startMatch(opts) {
    const g = gate();
    if (!g.ok) { render('card'); flash(g.reason ?? ''); return; }
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const me = meFromProfile(getProfile(), nick());
    match = createMatch({ ...opts, seed: opts.seed ?? seed, me });
    lastEnd = { opts: { ...opts, seed: undefined } };
    view = 'arena'; fx = [];
    renderArena();
    sound('duel-go');
    nextRoundSoon(fast ? 30 : match.mode === 'duel' ? 2000 : 3200);
  }
  function nextRoundSoon(ms) { clearTimeout(nextTimer); nextTimer = setTimeout(beginRound, ms); }
  function beginRound() {
    if (!match || match.over || view !== 'arena') return;
    match = startRound(match); phase = 'task'; taskAt = now(); answered = null; feedback = null; foeSaid = false; lastTick = -1;
    renderTask();
  }
  function arenaTitle() {
    if (match.mode === 'storm') return STORM_SITES[match.foe.site].title;
    if (match.mode === 'hack') return HACK_TARGET.title;
    return `${nick()} против: ${match.foe.name}`;
  }
  function renderArena() {
    const topicAreas = [...new Set(match.topics.map((t) => t.area))];
    const me = match.me;
    shell(arenaTitle(), match.mode === 'duel' ? 'РИНГ «ТИСКОВ» · ДУЭЛЬ ЗАДАЧКАМИ' : match.mode === 'storm' ? 'ТИСКИ-ШТУРМ · ЗАЩИТА' : 'ВЗЛОМ · ТРИ СЛОЯ', `
      <div class="ring-arena" data-mode="${match.mode}">
        <div class="ring-stage"><canvas id="ringStage" aria-label="Арена"></canvas>
          <div class="ring-hp ring-hp--me"><b>${esc(match.mode === 'duel' ? nick() : match.mode === 'storm' ? 'ВОРОТА' : 'ТРЕВОГА')}</b><span class="ring-hpbar"><i id="ringHpMe"></i></span><em id="ringHpMeText"></em></div>
          <div class="ring-hp ring-hp--foe"><b>${esc(match.mode === 'duel' ? match.foe.name : match.mode === 'storm' ? 'ВОЛНА' : 'ЗАМОК')}</b><span class="ring-hpbar"><i id="ringHpFoe"></i></span><em id="ringHpFoeText"></em></div>
          <p class="ring-round" id="ringRound"></p>
        </div>
        <ul class="ring-skills" aria-label="Темы этого боя">${topicAreas.map((id) => { const a = areaById(id); const p = me.powers[AREA_IDS.indexOf(id)]; return `<li data-area="${id}"><i class="ring-ico">${esc(a.glyph)}</i><span><small class="ring-wide">${esc(a.short)}</small> <b>${p}</b><span class="ring-bar ring-bar--thin"><i style="width:${p}%"></i></span></span></li>`; }).join('')}</ul>
        <section class="ring-task" id="ringTask"><p class="ring-task__wait">${match.mode === 'duel' && match.foe.hello ? `<b>${esc(match.foe.name)}:</b> «${esc(match.foe.hello)}»` : match.mode === 'storm' ? esc(STORM_SITES[match.foe.site].line) : match.mode === 'hack' ? esc(HACK_TARGET.line) : 'Сейчас вспыхнет первая задачка…'}</p></section>
      </div>`, { back: false });
    root.querySelector('.ring__close').replaceWith(Object.assign(doc.createElement('button'), { type: 'button', className: 'ring__close', ariaLabel: 'Сдаться и выйти', textContent: '×', onclick: () => { stopLoop(); match = null; render('card'); } }));
    updateBars();
    loop();
  }
  function frameText() {
    if (match.mode === 'storm') return `ЩИТОК ВОРОТ · ВОЛНА ${match.round + 1} ИЗ ${match.maxRounds}`;
    if (match.mode === 'hack') return `ПРИМЕР НА ЗАМКЕ · СЛОЙ ${Math.min(match.foe.layer + 1, match.foe.layers.length)} ИЗ ${match.foe.layers.length}`;
    return `РАУНД ${match.round + 1} ИЗ ${match.maxRounds}`;
  }
  function renderTask() {
    const t = match.task; const box = root.querySelector('#ringTask'); if (!box) return;
    const a = areaById(t.area); const buff = match.mode === 'duel' ? BUFFS[t.buff] : match.mode === 'storm' ? { name: 'ЗАЩИТА + ПОЛЕ' } : { name: 'УДАР ПО СЛОЮ' };
    const long = t.options.some((o) => (o.code ?? o.label).length > 18) || t.family === 'bug';
    const optsHtml = t.options.map((o, i) => {
      const signs = t.scene?.kind === 'reviews' ? `<span class="ring-signs">${t.scene.items[i].signs.map((s) => `<i>${esc(SIGNS[s])}</i>`).join('') || '<i>примет нет</i>'}</span>` : '';
      return `<button type="button" class="ring-opt" data-opt="${i}" ${o.code !== undefined || o.mono || t.mono ? 'data-mono="true"' : ''}><kbd>${i + 1}</kbd><span>${o.code !== undefined ? `<code>${esc(o.code.replace(/^ +/, (m) => '·'.repeat(m.length)))}</code>` : esc(o.label)}${signs}</span></button>`;
    }).join('');
    box.innerHTML = `
      <div class="ring-task__head"><i class="ring-ico">${esc(a.glyph)}</i><span><b>${esc(frameText())}</b><small>${esc(a.name)} ${match.me.powers[AREA_IDS.indexOf(t.area)]} · ${esc(t.title)}${t.stretch ? ' · НОВАЯ ТЕМА' : ''} → ${esc(buff.name)}</small></span><em id="ringFoeSaid"></em></div>
      <span class="ring-timer"><i id="ringTimer"></i></span>
      <p class="ring-task__prompt">${esc(t.prompt)}</p>
      ${t.code && t.family !== 'bug' ? `<pre class="ring-code"><code>${esc(t.code)}</code></pre>` : ''}
      ${scene(t)}
      <div class="ring-opts" data-long="${long}">${optsHtml}</div>
      <p class="ring-feedback" id="ringFeedback" role="status"></p>`;
    for (const b of box.querySelectorAll('[data-opt]')) b.addEventListener('click', () => choose(Number(b.dataset.opt)));
    root.querySelector('#ringRound').textContent = frameText();
    sound('scan');
  }
  function scene(t) {
    const s = t.scene; if (!s) return '';
    if (s.kind === 'boxes') return `<ul class="ring-scene ring-boxes">${s.items.map((b) => `<li data-color="${b.color}" data-take="${b.take}"><b>${b.take ? '✓' : ''}</b>${b.color === 'white' ? 'белый' : 'красный'} · ${b.weight} кг</li>`).join('')}</ul>`;
    if (s.kind === 'bits' && s.bits) return `<ul class="ring-scene ring-bits">${s.bits.map((b, i) => `<li data-on="${Boolean(b)}"><b>${[8, 4, 2, 1][i]}</b><i>${b ? 'ВКЛ' : 'выкл'}</i></li>`).join('')}</ul>`;
    if (s.kind === 'line') return `<ul class="ring-scene ring-line">${Array.from({ length: s.n }, (_, k) => `<li data-fault="${k + 1 === s.fault}">${k + 1 === s.fault ? '⚡' : '⌂'}<b>${k + 1}</b></li>${s.walls.includes(k + 1) ? '<li class="ring-wall">|</li>' : ''}`).join('')}</ul>`;
    return '';
  }
  function choose(i) {
    if (phase !== 'task' || !match?.task) return;
    resolve(i, now() - taskAt);
  }
  function resolve(choice, ms) {
    phase = 'resolve';
    const t = match.task;
    const { match: m2, events } = answerRound(match, { choice, ms });
    match = m2;
    const mine = events.find((e) => e.type === 'answer' && e.who === 'me');
    for (const b of root.querySelectorAll('[data-opt]')) { const k = Number(b.dataset.opt); b.disabled = true; if (k === t.answer) b.dataset.state = 'right'; else if (k === choice) b.dataset.state = 'wrong'; }
    const fb = root.querySelector('#ringFeedback');
    const buffEv = events.find((e) => e.type === 'buff' && e.who === 'me');
    if (mine.correct) {
      const what = match.mode === 'duel' ? `${BUFFS[buffEv.kind].name}${buffEv.kind === 'aura' ? '' : ` ${buffEv.value}`}${buffEv.aura ? ' (поле ×1.4)' : ''}` : match.mode === 'storm' ? `защита ${events.find((e) => e.type === 'wave').defense}` : `удар ${events.find((e) => e.type === 'crack').value}`;
      fb.innerHTML = `<b>✓ Верно за ${(ms / 1000).toFixed(1)} с → ${esc(what)}</b> <small class="ring-why">(${esc(areaById(t.area).name)} ${match.me.powers[AREA_IDS.indexOf(t.area)]} × скорость)</small>`;
      fb.dataset.ok = 'true'; sound('duel-buff');
    } else {
      fb.innerHTML = `<b>${mine.late ? '⏱ Время вышло.' : '✗ Не то.'}</b> ${esc(t.explain)}`;
      fb.dataset.ok = 'false'; sound('duel-wrong');
    }
    playEvents(events);
    const btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'ring-go ring-next'; btn.textContent = match.over ? 'ИТОГ →' : 'ДАЛЬШЕ →';
    btn.addEventListener('click', () => advance());
    fb.append(' ', btn);
    clearTimeout(nextTimer);
    nextTimer = setTimeout(advance, fast ? 60 : mine.correct ? 2300 : 5200);
  }
  function advance() {
    clearTimeout(nextTimer);
    if (!match || view !== 'arena' || phase !== 'resolve') return;
    if (match.over) return finish();
    phase = 'gap';
    const box = root.querySelector('#ringTask'); if (box) box.innerHTML = '<p class="ring-task__wait">Следующая задачка…</p>';
    nextRoundSoon(fast ? 20 : 500);
  }
  function playEvents(events) {
    const t0 = now();
    let k = 0;
    for (const e of events) {
      const at = t0 + (fast ? 0 : 180 * k);
      if (e.type === 'buff') { fx.push({ kind: e.kind === 'shield' ? 'shield' : e.kind === 'heal' ? 'heal' : e.kind === 'aura' ? 'ring' : 'charge', who: e.who, t0: at, dur: 900 }); fx.push({ kind: 'text', who: e.who, text: `${BUFF_GLYPH[e.kind]} ${BUFFS[e.kind].name}`, color: '#64e9ff', t0: at, dur: 1300 }); k++; }
      if (e.type === 'hit') { fx.push({ kind: 'bolt', who: e.from, t0: at, dur: 380, color: e.kind === 'auto' ? '#b28cff' : '#ff5a52' }); fx.push({ kind: 'hurt', who: e.to, t0: at + 330, dur: 350 }); fx.push({ kind: 'text', who: e.to, text: e.value ? `−${e.value}` : 'БЛОК', color: e.value ? '#ff5a52' : '#64e9ff', t0: at + 330, dur: 1100, big: true }); setTimeout(() => { sound(e.value ? 'duel-hit' : 'duel-shield'); updateBars(); }, Math.max(0, at + 330 - now())); k++; }
      if (e.type === 'heal') { fx.push({ kind: 'text', who: e.to, text: `+${e.value}`, color: '#4cffb0', t0: at, dur: 1100, big: true }); setTimeout(() => sound('duel-heal'), Math.max(0, at - now())); }
      if (e.type === 'answer' && e.who === 'foe' && match.mode === 'duel') fx.push({ kind: 'say', who: 'foe', text: e.correct ? 'Есть!' : 'Мимо…', t0: at, dur: 1100 });
      if (e.type === 'wave') { fx.push({ kind: 'wave', t0: at, dur: 1100, held: e.held, ring: e.field }); if (e.field) setTimeout(() => sound('duel-ring'), 50); setTimeout(() => { sound(e.held ? 'duel-shield' : 'duel-hit'); updateBars(); }, fast ? 0 : 700); if (e.value) fx.push({ kind: 'text', who: 'me', text: `−${e.value}`, color: '#ff5a52', t0: at + 700, dur: 1000, big: true }); }
      if (e.type === 'crack') { fx.push({ kind: 'crack', t0: at, dur: 900, broke: e.broke }); setTimeout(() => { sound(e.broke ? 'collapse' : 'duel-hit'); updateBars(); }, fast ? 0 : 300); }
      if (e.type === 'alarm') { fx.push({ kind: 'alarm', t0: at, dur: 1200 }); sound('alarm'); updateBars(); }
    }
    updateBars();
  }
  function updateBars() {
    if (!match) return;
    const set = (id, v, max, text) => { const el = root.querySelector(id); if (el) el.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`; const tx = root.querySelector(`${id}Text`); if (tx) tx.textContent = text; };
    if (match.mode === 'duel') { set('#ringHpMe', match.me.hp, match.me.maxHp, `${match.me.hp}${match.me.shield ? ` ⛨${match.me.shield}` : ''}`); set('#ringHpFoe', match.foe.hp, match.foe.maxHp, `${match.foe.hp}${match.foe.shield ? ` ⛨${match.foe.shield}` : ''}`); }
    else if (match.mode === 'storm') { set('#ringHpMe', match.me.hp, match.me.maxHp, `${match.me.hp}`); const w = match.foe.waves[Math.min(match.round, match.foe.waves.length - 1)]; set('#ringHpFoe', match.over ? 0 : w, 24, match.over ? '—' : `сила ${w}`); }
    else { const left = match.foe.layers.reduce((s, x) => s + x, 0); set('#ringHpMe', match.foe.alarm, 3, `${match.foe.alarm} из 3`); set('#ringHpFoe', left, 66, `${left}`); }
  }
  function finish() {
    stopLoop();
    const m = match;
    // 19.3 · hack awareness: the host inspects answer timings (inhuman →
    // doesn't count; honest sub-second → a badge). It may set profile flags
    // before we read getProfile() below, and ask us to skip the proofs.
    let verdict = {};
    try { verdict = onDuelEnd({ mode: m.mode, outcome: m.outcome, results: m.results, timings: m.results.map((r) => ({ ms: r.ms })), foe: m.foe }) ?? {}; } catch { verdict = {}; }
    let p = getProfile();
    const proofs = verdict.skipProofs ? { written: [], capped: false, left: DAILY_CAP } : duelProofs(p, m.results);
    p = recordOutcome(proofs.profile, m);
    onProfile(p);
    const sum = practiceSummary(m);
    const won = m.outcome === 'win';
    sound(won ? 'duel-win' : 'duel-lose');
    view = 'end';
    const head = m.mode === 'duel' ? (won ? 'ПОБЕДА' : m.outcome === 'draw' ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ') : m.mode === 'storm' ? (won ? 'ВОРОТА ВЫСТОЯЛИ' : 'ВОРОТА ПРОБИТЫ') : (won ? 'ЗАМОК ВСКРЫТ' : 'СРАБОТАЛА ТРЕВОГА');
    const line = m.mode === 'duel' ? (won ? m.foe.winLine : m.foe.loseLine) : m.mode === 'storm' ? (won ? `${STORM_SITES[m.foe.site].who}: «Держится! Пусть «ТИСКИ» поищут другую дверь».` : 'Волны прошли. Решай задачки быстрее — защита растёт от скорости и от твоего %.') : (won ? 'Прошивка с мастер-ключом у тебя. Саня отнесёт её людям — пусть знают, что у «ТИСКОВ» в замках.' : 'Три ошибки — охрана проснулась. Слои замка ждут: попробуй снова.');
    const next = m.mode === 'duel' && won && m.foe.ghostId ? nextGhost(p) : null;
    shell(head, m.mode === 'duel' ? 'РИНГ «ТИСКОВ»' : m.mode === 'storm' ? 'ТИСКИ-ШТУРМ' : 'ВЗЛОМ', `
      <section class="ring-end" data-outcome="${m.outcome}">
        <p class="ring-end__line">${esc(line)}</p>
        <h3>Что ты потренировал</h3>
        <ul class="ring-end__list">${sum.map((s) => `<li><i class="ring-ico">${esc(areaById(s.area).glyph)}</i>${esc(s.name)} <b>${s.right} из ${s.total}</b></li>`).join('')}</ul>
        <p class="ring-end__proofs">Сила бафа = твоя область на карточке (этаж × уверенность) × скорость ответа. Больше доказательств — сильнее в следующий раз.</p>
        <p class="ring-end__proofs">${proofs.written.length ? `+${proofs.written.length} ${proofs.written.length === 1 ? 'доказательство' : 'доказательства'} в карточку` : 'Новых доказательств нет'}${proofs.capped ? ' · на сегодня лимит, приходи завтра' : ` · на сегодня ещё ${proofs.left} из ${DAILY_CAP}`}.</p>
        <nav class="ring-actions ring-actions--two"><button type="button" class="ring-go" data-ring="again">ЕЩЁ РАЗ</button>${next && next.id !== m.foe.ghostId ? `<button type="button" class="ring-go" data-ring="next-ghost">СЛЕДУЮЩИЙ: ${esc(next.name)} →</button>` : ''}<button type="button" data-ring="card">КАРТОЧКА</button></nav>
      </section>`);
    wire();
  }

  // ------------------------------------------------------------ the loop
  function loop() { cancelAnimationFrame(raf); const tick = () => { if (view !== 'arena' || !open) return; drawStage(); timerTick(); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
  function stopLoop() { cancelAnimationFrame(raf); clearTimeout(nextTimer); }
  function timerTick() {
    if (phase !== 'task' || !match?.task) return;
    const el = root.querySelector('#ringTimer'); const lim = match.task.limit * 1000; const used = now() - taskAt;
    if (el) { el.style.width = `${Math.max(0, 100 - (used / lim) * 100)}%`; el.dataset.low = String(used > lim * 0.7); }
    const sec = Math.floor((lim - used) / 1000);
    if (sec <= 3 && sec >= 0 && sec !== lastTick) { lastTick = sec; sound('duel-tick'); }
    if (match.plan && !foeSaid && used >= match.plan.ms) { foeSaid = true; const s = root.querySelector('#ringFoeSaid'); if (s) s.textContent = `${match.foe.name} ответил`; sound('duel-foe'); }
    if (used >= lim) resolve(null, lim);
  }
  function drawStage() {
    const c = root.querySelector('#ringStage'); if (!c || !match) return;
    const { w, h } = fitCanvas(c); const ctx = c.getContext('2d'); const t = now() / 1000; const n = now();
    fx = fx.filter((f) => n < f.t0 + f.dur);
    const active = (kind, who) => fx.filter((f) => f.kind === kind && (!who || f.who === who) && n >= f.t0);
    // floor: the ТИСКИ training hall
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b141a'); g.addColorStop(1, '#05070b'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(100,233,255,.14)'; ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.08, h * 0.62); ctx.lineTo(w / 2 + i * w * 0.2, h); ctx.stroke(); }
    for (let k = 0; k < 5; k++) { const y = h * 0.62 + (h * 0.38) * (k / 5) ** 1.4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,200,87,.08)'; ctx.font = `900 ${Math.round(h * 0.16)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.fillText('«ТИСКИ»', w / 2, h * 0.3);
    const s = h * 0.5, gy = h * 0.9, xMe = w * 0.25, xFoe = w * 0.75;
    const pos = (who) => (who === 'me' ? xMe : xFoe);
    const life = (f) => Math.min(1, (n - f.t0) / f.dur);
    if (match.mode === 'duel') {
      if (match.me.aura > 0) areaRing(ctx, xMe, gy, s * 0.55, t, 0.8);
      if (match.foe.aura > 0) areaRing(ctx, xFoe, gy, s * 0.55, t, 0.8);
      for (const f of active('ring')) areaRing(ctx, pos(f.who), gy, s * (0.3 + 0.5 * life(f)), t, 1 - life(f) * 0.3);
      const lungeOf = (who) => { const b = active('bolt', who)[0]; return b ? Math.sin(life(b) * Math.PI) : 0; };
      const hurtOf = (who) => (active('hurt', who).length ? 1 : 0);
      drawDiver(ctx, xMe, gy, s, match.me.avatar, { facing: 1, lunge: lungeOf('me'), hurt: hurtOf('me'), t, ko: match.over && match.me.hp <= 0 });
      drawDiver(ctx, xFoe, gy, s, match.foe.avatar, { facing: -1, lunge: lungeOf('foe'), hurt: hurtOf('foe'), t, ko: match.over && match.foe.hp <= 0 });
      for (const who of ['me', 'foe']) {
        const side = match[who];
        if (side.shield > 0 || active('shield', who).length) { ctx.save(); ctx.strokeStyle = '#64e9ff'; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 6); ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; const r = s * 0.62; const px = pos(who) + Math.cos(a) * r * 0.7, py = gy - s * 0.6 + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); ctx.restore(); }
        if (side.autoLeft > 0) { const a = t * 3; const dx = pos(who) + Math.cos(a) * s * 0.45, dy = gy - s * 1.1 + Math.sin(a) * s * 0.12; ctx.fillStyle = '#b28cff'; ctx.fillRect(dx - 6, dy - 4, 12, 8); }
      }
      for (const f of active('heal')) { ctx.fillStyle = `rgba(76,255,176,${1 - life(f)})`; for (let i = 0; i < 8; i++) ctx.fillRect(pos(f.who) + Math.sin(i * 7 + t) * s * 0.3, gy - s * (0.2 + life(f) + i * 0.07), 5, 5); }
      for (const f of active('charge')) { ctx.strokeStyle = `rgba(95,242,255,${1 - life(f)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pos(f.who), gy - s * 0.6, s * (0.3 + 0.4 * life(f)), 0, Math.PI * 2); ctx.stroke(); }
      for (const f of active('bolt')) { const k = life(f); const x0 = pos(f.who), x1 = pos(f.who === 'me' ? 'foe' : 'me'); const x = x0 + (x1 - x0) * k; ctx.save(); ctx.shadowColor = f.color; ctx.shadowBlur = 18; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(x, gy - s * 0.66, s * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    } else if (match.mode === 'storm') {
      // the gate on the left, waves of red bots on the right
      const gx = w * 0.18;
      ctx.fillStyle = '#2a3140'; ctx.fillRect(gx - s * 0.4, gy - s * 1.1, s * 0.8, s * 1.1); ctx.fillStyle = '#3c4659'; for (let i = 0; i < 6; i++) ctx.fillRect(gx - s * 0.36, gy - s * 1.05 + i * s * 0.17, s * 0.72, s * 0.12);
      ctx.fillStyle = '#ffc857'; ctx.font = `800 ${Math.max(14, Math.round(s * 0.16))}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.fillText(match.foe.site === 'server' ? 'СЕРВЕР' : 'ГАРАЖ', gx, gy - s * 1.18);
      const ringOn = match.results.some((r) => r.correct) ? 0.55 : 0;
      if (ringOn) areaRing(ctx, gx, gy, s * 0.75, t, ringOn);
      const wv = active('wave')[0];
      const k = wv ? life(wv) : 0;
      const count = 3 + Math.min(match.round, 4);
      const front = wv ? w * 0.85 - (w * 0.85 - gx - s * 0.7) * Math.min(1, k * 1.4) : w * 0.85;
      for (let i = 0; i < count; i++) { const bx = front + (i % 3) * s * 0.35, by = gy - (i % 2) * s * 0.1; ctx.fillStyle = '#ff4d5a'; roundRect(ctx, bx - s * 0.12, by - s * 0.38, s * 0.24, s * 0.38, 6); ctx.fill(); ctx.fillStyle = '#ffe0e0'; ctx.fillRect(bx - s * 0.06, by - s * 0.3, s * 0.12, s * 0.05); }
      if (wv && wv.ring) areaRing(ctx, gx, gy, s * (0.5 + 0.5 * k), t, 1 - k * 0.4);
      if (wv && wv.held && k > 0.5) { ctx.strokeStyle = '#64e9ff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(gx + s * 0.6, gy); ctx.lineTo(gx + s * 0.6, gy - s * 1.2); ctx.stroke(); }
    } else {
      // the lock: three rings, the outer one is layer 1
      const cx = w / 2, cy = h * 0.52, R = h * 0.4;
      const crack = active('crack')[0];
      for (let i = 0; i < 3; i++) {
        const left = match.foe.layers[i], full = [18, 22, 26][i]; const r = R * (1 - i * 0.28);
        ctx.lineWidth = R * 0.14; ctx.strokeStyle = '#2a2f3a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = left > 0 ? (i === match.foe.layer ? '#ff5a52' : '#7a3a2a') : '#4cffb0'; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2 + t * (i % 2 ? -0.4 : 0.4), -Math.PI / 2 + t * (i % 2 ? -0.4 : 0.4) + (left > 0 ? (left / full) : 1) * Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#ffc857'; ctx.font = `900 ${Math.round(R * 0.4)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(match.foe.layer >= 3 ? '✓' : '⚿', cx, cy); ctx.textBaseline = 'alphabetic';
      if (crack) { ctx.strokeStyle = `rgba(255,255,255,${1 - life(crack)})`; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i * 1.1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * life(crack), cy + Math.sin(a) * R * life(crack)); ctx.stroke(); } }
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < match.foe.alarm ? (Math.sin(t * 10) > 0 ? '#ff4d5a' : '#7a1f26') : '#222833'; ctx.beginPath(); ctx.arc(w * 0.1 + i * h * 0.12, h * 0.2, h * 0.04, 0, Math.PI * 2); ctx.fill(); }
      if (active('alarm').length) { ctx.fillStyle = 'rgba(255,77,90,.15)'; ctx.fillRect(0, 0, w, h); }
      drawDiver(ctx, w * 0.12, h * 0.95, h * 0.45, match.me.avatar, { facing: 1, t, lunge: crack ? Math.sin(life(crack) * Math.PI) : 0 });
    }
    // floating words and speech
    for (const f of fx.filter((x) => (x.kind === 'text' || x.kind === 'say') && n >= x.t0)) {
      const k = life(f); const x = match.mode === 'duel' ? pos(f.who) : f.who === 'me' ? w * 0.2 : w * 0.75;
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.textAlign = 'center';
      if (f.kind === 'say') { ctx.font = `700 ${Math.max(14, Math.round(Math.min(h * 0.075, w * 0.035)))}px system-ui,sans-serif`; const tw = Math.min(w * 0.45, ctx.measureText(f.text).width + 16); ctx.fillStyle = 'rgba(10,12,18,.85)'; roundRect(ctx, x - tw / 2, h * 0.24, tw, h * 0.12, 8); ctx.fill(); ctx.fillStyle = '#e9e3d5'; ctx.fillText(f.text, x, h * 0.32, tw - 10); }
      else { ctx.font = `900 ${Math.max(15, Math.round(h * (f.big ? 0.13 : 0.08)))}px system-ui,sans-serif`; ctx.fillStyle = f.color; ctx.fillText(f.text, x, gy - s * (1.3 + k * 0.4)); }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ open / close
  function render(v = view) {
    if (v !== 'arena') { stopLoop(); if (view === 'arena' && match && !match.over) match = null; }
    view = v;
    if (v === 'card') renderCard(); else if (v === 'myclass') renderMyClass(); else if (v === 'ladder') renderLadder(); else if (v === 'storm') renderStorm(); else if (v === 'share') renderShare(); else if (v === 'class') renderClass(); else if (v === 'area') renderArea(); else if (v === 'badges') renderBadges(); else renderCard();
    root.dataset.view = view;
    root.querySelector('.ring-go, .ring__close')?.focus({ preventScroll: true });
  }
  function openRing(v = 'card', opts = {}) {
    demo = Boolean(opts.demo) || demo;
    open = true; root.hidden = false; render(v);
    if (opts.code) { const el = root.querySelector('#ringFriendCode'); if (el) el.value = opts.code; }
  }
  function close() { stopLoop(); open = false; match = null; root.hidden = true; onClose(); }
  root.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.target instanceof HTMLInputElement) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape') { e.preventDefault(); if (view === 'card') close(); else render('card'); return; }
    if (view === 'arena' && phase === 'task' && /^[1-6]$/.test(e.key)) { e.preventDefault(); const i = Number(e.key) - 1; if (match.task && i < match.task.options.length) choose(i); }
    else if (view === 'arena' && phase === 'resolve' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); advance(); }
  });
  globalThis.addEventListener?.('resize', () => { if (open && view === 'card') renderCard(); });

  return {
    open: openRing, close, isOpen: () => open,
    // the account changed (login / logout / sync): redraw what is on screen
    refresh() {
      classes = null; realClass = null;
      if (!open || view === 'arena') return;
      // Never redraw under the player's fingers: typing in a field → only the pill.
      const ae = doc?.activeElement;
      if (ae && root.contains(ae) && ae.tagName === 'INPUT') { try { decorate(root); } catch { /* optional */ } return; }
      render(view);
    },
    // tests and the admin panel
    fast(on = true) { fast = Boolean(on); },
    state: () => ({ view, demo, phase, mode: match?.mode ?? null, round: match?.round ?? 0, over: match?.over ?? false, outcome: match?.outcome ?? null, me: match ? { hp: match.me.hp } : null, foe: match ? { hp: match.foe.hp, layer: match.foe.layer, alarm: match.foe.alarm, name: match.foe.name } : null, task: match?.task ? { answer: match.task.answer, family: match.task.family, area: match.task.area, options: match.task.options.length, explain: match.task.explain } : null }),
    start: (opts) => startMatch(opts),
  };
}
