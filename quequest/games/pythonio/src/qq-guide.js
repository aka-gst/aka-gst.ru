/* QueQuest 19.0 · a gentler first minute (local patch, see VERSION).
   Only inside QueQuest (html[data-host="quequest"], set by host-bridge.js on
   hello) and only on the very first order: the extra panels are hidden, the
   screen is dimmed except ONE thing to press, and a bubble says in plain
   words what it does. The steps follow the game's own state (Workshop.state),
   so the guide never decides anything — it only points. Standalone Pythonio
   never runs it. «Без подсказок» switches it off for good. */
(function () {
    'use strict';
    const OFF_KEY = 'pythonio.qqguide.off';
    const css = `
html[data-host="quequest"] body.qqg-on .topbar nav,html[data-host="quequest"] body.qqg-on #discoveriesButton,html[data-host="quequest"] body.qqg-on .scorebar,
html[data-host="quequest"] body.qqg-on .zoom,html[data-host="quequest"] body.qqg-on .sim-controls,html[data-host="quequest"] body.qqg-on #advancedTools,
html[data-host="quequest"] body.qqg-on #pythonConcept,html[data-host="quequest"] body.qqg-on #guideAction,html[data-host="quequest"] body.qqg-on .coach,
html[data-host="quequest"] body.qqg-on .left-panel .section-title,html[data-host="quequest"] body.qqg-on #pythonButton,html[data-host="quequest"] body.qqg-on .dock-note,
html[data-host="quequest"] body.qqg-on #wordBank,html[data-host="quequest"] body.qqg-on [data-mode="move"],html[data-host="quequest"] body.qqg-on #undo,
html[data-host="quequest"] body.qqg-on .machine-button.locked,html[data-host="quequest"] body.qqg-on footer,html[data-host="quequest"] body.qqg-on .right-panel .note,
html[data-host="quequest"] body.qqg-on #ruleRows,html[data-host="quequest"] body.qqg-on #clearRule,html[data-host="quequest"] body.qqg-on .status-card,
html[data-host="quequest"] body.qqg-on #pulseList,html[data-host="quequest"] body.qqg-on #machinePulse,html[data-host="quequest"] body.qqg-on #inspector,
html[data-host="quequest"] body.qqg-on .map-caption,html[data-host="quequest"] body.qqg-on #mapMessage,html[data-host="quequest"] body.qqg-on #unlockedCount{display:none!important}
.qqg-ring{position:fixed;z-index:50;pointer-events:none;border:3px solid #ffd36b;border-radius:12px;box-shadow:0 0 0 9999px #050c0899,0 0 24px #ffd36b;transition:left .2s,top .2s,width .2s,height .2s}
.qqg-ring[data-spot="true"]{border-radius:50%;animation:qqgPulse 1s ease-in-out infinite}
@keyframes qqgPulse{50%{transform:scale(1.18)}}
.qqg-bubble{position:fixed;z-index:51;max-width:min(360px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px;border:2px solid #ffd36b;border-radius:12px;background:#1c2b1f;color:#fff6dc;font:16px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px #000a}
.qqg-bubble{pointer-events:none}.qqg-bubble button{pointer-events:auto}
.qqg-bubble b{display:block;margin-bottom:4px;color:#ffd36b;font:800 14px ui-monospace,monospace;letter-spacing:.06em}
.qqg-bubble button{margin-top:8px;min-height:36px;padding:0 10px;border:1px solid #ffffff44;border-radius:8px;background:#0e1a12;color:#c9d6c0;font:600 14px system-ui,sans-serif;cursor:pointer}
@media(prefers-reduced-motion:reduce){.qqg-ring{transition:none;animation:none}}`;
    let ring = null, bubble = null, lastStep = '', on = false;

    function off() { try { return localStorage.getItem(OFF_KEY) === '1'; } catch (_) { return false; } }
    function active() {
        const W = globalThis.Workshop, S = W && W.state;
        if (!S || document.documentElement.dataset.host !== 'quequest' || off()) return false;
        if (!document.body.classList.contains('first-contract')) return false;
        if (document.getElementById('welcome')?.open || document.getElementById('modal')?.open) return false;
        return S.mode === 'campaign' && S.chapter === 0 && !S.claimed.includes(0);
    }
    const $ = (s) => document.querySelector(s);
    const visible = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
    function manualButton() { const a = $('#manual'), b = $('.quick-manual'); return visible(b) ? b : a; }

    // The one thing to press now, from the game's own state.
    function step() {
        const W = globalThis.Workshop, S = W.state, E = W.engine;
        const first = (t) => S.nodes.find((n) => n.type === t);
        const linked = (a, b) => a && b && S.links.some((l) => l.from === a.id && l.to === b.id);
        if (E.ready(S)) return { id: 'claim', el: $('#claim'), title: 'ГОТОВО', text: 'Все двенадцать фотографий Лиды сделаны. Нажми «Отдать заказ» — она ждёт.' };
        if (S.progress[0].manual < 3) return { id: 'manual', el: manualButton(), title: `ШАГ 1 · РУКАМИ (${S.progress[0].manual} из 3)`, text: 'Нажми «Сделать самому». Это ты сам обрабатываешь одну фотографию Лиды. Сделай так три раза — и почувствуешь, как это скучно.' };
        const tool = $('.machine-button.active')?.dataset.build;
        if (!first('router')) {
            if (tool === 'router') return { id: 'place-router', spot: [390, 410], title: 'ШАГ 2 · ПОСТАВЬ', text: 'Нажми на светящийся круг на полу — там встанет развилка.' };
            return { id: 'router', el: $('[data-build="router"]'), title: 'ШАГ 2 · РАЗВИЛКА', text: 'Хватит руками. Возьми «Развилку»: она смотрит на каждый файл и решает, куда его отправить.' };
        }
        const ruled = (S.program && S.program.table && S.program.table['image:0:0'] === 'photo') || S.rules.some((r) => r.condition === 'image' && r.action === 'photo');
        if (!ruled) return { id: 'rule', el: $('.rule-edit'), title: 'ШАГ 3 · ПРАВИЛО', text: 'Скажи развилке, что делать: в первом списке выбери «фото», во втором — «в фото». Получится: ЕСЛИ пришло фото → ТО отправить в фото-машину.' };
        if (!first('photo')) {
            if (tool === 'photo') return { id: 'place-photo', spot: [675, 325], title: 'ШАГ 4 · ПОСТАВЬ', text: 'Нажми на светящийся круг — там встанет фото-машина.' };
            return { id: 'photo', el: $('[data-build="photo"]'), title: 'ШАГ 4 · ФОТО-МАШИНА', text: 'Правило знает, куда слать фото, но там пока никого нет. Возьми «Фото → карточка».' };
        }
        const a = first('in'), r = first('router'), p = first('photo'), o = first('out');
        const missing = [[a, r], [r, p], [p, o]].find(([x, y]) => !linked(x, y));
        if (missing) {
            const linkOn = $('[data-mode="link"]')?.classList.contains('active');
            if (!linkOn) return { id: 'link', el: $('[data-mode="link"]'), title: 'ШАГ 5 · ПРОВОДА', text: 'Теперь соедини машины проводами. Нажми «Линия».' };
            const from = W.view.linkFrom, target = from === missing[0].id ? missing[1] : missing[0];
            const name = { in: 'Приём', router: 'Развилку', photo: 'Фото', out: 'Готово' }[target.type];
            return { id: `link-${missing[0].type}-${missing[1].type}-${from === missing[0].id}`, spot: [target.x, target.y], title: 'ШАГ 5 · ПРОВОДА', text: from === missing[0].id ? `Теперь нажми на «${name}» — провод протянется туда.` : `Нажми на «${name}» — отсюда пойдёт провод. Нужно: Приём → Развилка → Фото → Готово.` };
        }
        return { id: 'watch', el: $('#mapArea'), title: 'ШАГ 6 · УБЕРИ РУКИ', text: 'Линия собрана. Ничего не нажимай и смотри: оставшиеся фото проходят путь сами. Это и есть автоматизация.' };
    }

    function ensure() {
        if (ring) return;
        const st = document.createElement('style'); st.id = 'qqGuideStyle'; st.textContent = css; document.head.append(st);
        ring = document.createElement('div'); ring.className = 'qqg-ring'; ring.setAttribute('aria-hidden', 'true');
        bubble = document.createElement('div'); bubble.className = 'qqg-bubble'; bubble.setAttribute('role', 'status'); bubble.dataset.qqGuide = '';
        document.body.append(ring, bubble);
        bubble.addEventListener('click', (e) => { if (e.target.closest('[data-qqg-off]')) { try { localStorage.setItem(OFF_KEY, '1'); } catch (_) { /* ignore */ } hide(); } });
    }
    function hide() { on = false; document.body.classList.remove('qqg-on'); if (ring) ring.hidden = true; if (bubble) bubble.hidden = true; lastStep = ''; document.body.dataset.qqGuide = ''; }
    function place(s) {
        let r;
        if (s.spot) { const p = globalThis.Workshop.view.screen(s.spot[0], s.spot[1]); r = { left: p.x - 26, top: p.y - 26, width: 52, height: 52 }; }
        else if (s.el && visible(s.el)) { const b = s.el.getBoundingClientRect(); r = { left: b.left - 6, top: b.top - 6, width: b.width + 12, height: b.height + 12 }; }
        else { ring.hidden = true; return; }
        ring.hidden = false; ring.dataset.spot = String(Boolean(s.spot));
        Object.assign(ring.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
        // The bubble goes where there is room: below the target, else above.
        const bw = Math.min(360, innerWidth - 24), bh = bubble.offsetHeight || 120;
        let top = r.top + r.height + 10; if (top + bh > innerHeight - 8) top = Math.max(8, r.top - bh - 10);
        const left = Math.max(12, Math.min(innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
        Object.assign(bubble.style, { left: `${left}px`, top: `${top}px` });
    }
    function tick() {
        if (!active()) { if (on) hide(); return; }
        ensure();
        if (!on) { on = true; document.body.classList.add('qqg-on'); }
        const s = step();
        if (s.id !== lastStep) {
            lastStep = s.id; document.body.dataset.qqGuide = s.id;
            bubble.innerHTML = `<b>${s.title}</b><span>${s.text}</span><br><button type="button" data-qqg-off>Без подсказок</button>`;
            bubble.hidden = false;
            const target = s.spot ? document.getElementById('world') : s.el;
            try { target && target.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (_) { /* old browsers */ }
        }
        place(s);
    }
    function start() { if (!globalThis.Workshop) return; setInterval(tick, 150); addEventListener('resize', tick); }
    globalThis.PythonioQQGuide = { step: () => (active() ? step() : null), get on() { return on; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
