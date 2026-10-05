/* Original Canvas artwork and hit testing. All geometry stays in world space. */
(function (g) {
    'use strict';
    const D = g.WorkshopData;
    class WorkshopView {
        constructor(canvas, callbacks) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cb = callbacks; this.w = 0; this.h = 0; this.zoom = 1; this.pan = { x: 0, y: 0 }; this.hits = []; this.mouse = null; this.drag = null; this.tab = 'factory'; this.tool = 'select'; this.selected = null; this.linkFrom = null; this.held = null; this.hover = null; this.lastSize = ''; this.heat = false; this.pulse = []; new ResizeObserver(() => this.resize()).observe(canvas.parentElement); this.bind(); this.resize(); }
        resize() { const r = this.canvas.getBoundingClientRect(); this.w = r.width; this.h = r.height; const d = Math.min(2, devicePixelRatio || 1); this.dpr = d; this.canvas.width = Math.round(this.w * d); this.canvas.height = Math.round(this.h * d); this.fitScale = Math.min(this.w / 1380, this.h / 810); }
        origin() { return { x: (this.w - 1380 * this.scale()) / 2 + this.pan.x, y: (this.h - 810 * this.scale()) / 2 + this.pan.y }; }
        scale() { return this.fitScale * this.zoom; }
        point(e) { const r = this.canvas.getBoundingClientRect(), o = this.origin(), z = this.scale(); return { x: (e.clientX - r.left - o.x) / z, y: (e.clientY - r.top - o.y) / z }; }
        screen(x, y) { const o = this.origin(), r = this.canvas.getBoundingClientRect(); return { x: r.left + o.x + x * this.scale(), y: r.top + o.y + y * this.scale() }; }
        fit() { this.zoom = 1; this.pan = { x: 0, y: 0 }; }
        zoomBy(f) { this.zoom = Math.max(.65, Math.min(3.5, this.zoom * f)); }
        hit(p) { return [...this.hits].reverse().find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h); }
        bind() { const c = this.canvas; c.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false }); c.addEventListener('pointerdown', e => { if (e.button > 1)
            return; const p = this.point(e), h = this.hit(p); this.drag = { start: p, screen: { x: e.clientX, y: e.clientY }, pan: { ...this.pan }, hit: h, moved: false }; c.setPointerCapture(e.pointerId); }); c.addEventListener('pointermove', e => { const p = this.point(e); this.mouse = p; this.hover = this.hit(p); if (this.drag) {
            const d = this.drag, dx = e.clientX - d.screen.x, dy = e.clientY - d.screen.y;
            if (Math.hypot(dx, dy) > 6)
                d.moved = true;
            if (d.moved && (!d.hit || this.tool === 'pan')) {
                this.pan = { x: d.pan.x + dx, y: d.pan.y + dy };
            }
            else if (d.moved && d.hit?.kind === 'node' && this.tool === 'move') {
                this.moveGhost = { id: d.hit.id, x: p.x, y: p.y };
            }
            else if (d.moved && d.hit?.kind === 'node' && this.tool === 'select') {
                this.linkDrag = { from: d.hit.id };
                this.linkFrom = d.hit.id;
            }
            else if (d.moved && d.hit?.kind === 'rule') {
                this.dragWord = d.hit;
            }
        } c.style.cursor = this.tool === 'link' ? 'crosshair' : this.hover ? 'pointer' : this.tool === 'move' ? 'grab' : 'default'; }); c.addEventListener('pointerup', e => { const d = this.drag; if (!d)
            return; this.drag = null; const p = this.point(e); if (d.moved) {
            if (this.moveGhost)
                this.cb.move(this.moveGhost);
            else if (this.linkDrag) {
                const target = this.hit(p);
                if (target?.kind === 'node' && target.id !== this.linkDrag.from) this.cb.connect?.(this.linkDrag.from, target.id);
            }
            else if (this.dragWord) {
                const target = this.hit(p);
                if (target?.kind === 'rule' && target.part === this.dragWord.part)
                    this.cb.swap(this.dragWord, target);
            }
        }
        else
            this.cb.click(this.hit(p), p, e); this.moveGhost = null; this.dragWord = null; this.linkDrag = null; if (this.tool === 'select') this.linkFrom = null; }); c.addEventListener('pointercancel', () => { this.drag = null; this.moveGhost = null; this.dragWord = null; this.linkDrag = null; if (this.tool === 'select') this.linkFrom = null; }); c.addEventListener('dragover', e => e.preventDefault()); c.addEventListener('drop', e => { e.preventDefault(); try {
            const word = JSON.parse(e.dataTransfer.getData('text/plain'));
            this.cb.drop(word, this.hit(this.point(e)));
        }
        catch (_) { } }); }
        rect(x, y, w, h, fill, r = 0, stroke = null) { const c = this.ctx; c.beginPath(); if (r)
            c.roundRect(x, y, w, h, r);
        else
            c.rect(x, y, w, h); c.fillStyle = fill; c.fill(); if (stroke) {
            c.strokeStyle = stroke;
            c.lineWidth = 1.5;
            c.stroke();
        } }
        text(text, x, y, size = 16, color = '#e4dec2', weight = 500, align = 'left') { const c = this.ctx; c.font = `${weight} ${size}px system-ui,sans-serif`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(text, x, y); }
        circle(x, y, r, color) { const c = this.ctx; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
        line(points, color, width = 2, dash = []) { const c = this.ctx; c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.stroke(); c.setLineDash([]); }
        tree(x, y, scale = 1) { this.rect(x - 4 * scale, y - 4 * scale, 8 * scale, 28 * scale, '#5b5137', 2); this.circle(x + 5 * scale, y + 7 * scale, 25 * scale, '#152e23'); this.circle(x, y - 10 * scale, 25 * scale, '#3d603b'); this.circle(x - 10 * scale, y - 18 * scale, 18 * scale, '#577345'); this.circle(x + 9 * scale, y - 24 * scale, 20 * scale, '#496c3d'); this.circle(x - 7 * scale, y - 30 * scale, 10 * scale, '#66834c'); }
        pot(x, y) { this.rect(x - 11, y, 22, 20, '#ad7952', 4); this.rect(x - 14, y - 3, 28, 8, '#c59263', 2); this.circle(x, y - 12, 12, '#7d9a60'); this.circle(x - 10, y - 7, 9, '#516e43'); this.circle(x + 7, y - 18, 8, '#abc47a'); }
        packet(p, x, y, big = false) { const c = this.ctx, k = big ? 1.6 : 1; c.save(); c.translate(x, y); c.scale(k, k); this.rect(-7, -9, 14, 18, p.type === 'image' ? '#8fc9c4' : '#d3aed6', 3, '#213b2b'); if (p.type === 'image') {
            this.line([[-4, 3], [0, -2], [5, 3]], '#325d53', 1.5);
            this.circle(-3, -4, 1.5, '#e8f3d7');
        }
        else {
            this.line([[-4, -3], [4, -3]], '#754880', 1.4);
            this.line([[-4, 1], [3, 1]], '#754880', 1.4);
        } if (p.prepared)
            this.circle(7, 7, 4, p.checked ? '#e9d783' : '#c3e598'); c.restore(); }
        machineIcon(type, x, y, active, time) {
            const c = this.ctx;
            c.save();
            c.translate(x, y);
            if (type === 'photo' || type === 'writer') {
                this.rect(-23, -25, 46, 31, '#d4cfb3', 4, '#e6dfc7');
                this.rect(-18, -21, 36, 22, type === 'photo' ? '#426a62' : '#675978', 2);
                if (type === 'photo') {
                    this.line([[-13, -4], [-4, -14], [5, -5], [11, -10], [16, -4]], '#9ccdc1', 2);
                    this.circle(10, -16, 3, '#e7d17e');
                }
                else
                    for (let i = 0; i < 3; i++)
                        this.line([[-12, -16 + i * 6], [12 - i * 4, -16 + i * 6]], '#d1badd', 2);
                this.rect(-4, 6, 8, 8, '#8f947b', 2);
                this.rect(-18, 12, 36, 5, '#b9b79d', 2);
                this.rect(29, -22, 21, 40, '#3a5848', 4, '#67816b');
                for (let j = 0; j < 3; j++)
                    this.rect(33, -15 + j * 10, 13, 3, '#94ae8c');
                this.circle(44, 13, 2, active ? '#d9dd83' : '#638a69');
            }
            else if (type === 'router') {
                this.rect(-28, -21, 58, 41, '#766a40', 5, '#b7a264');
                for (let i = 0; i < 3; i++)
                    this.rect(-19, -13 + i * 10, 39, 5, ['#e8cb7c', '#92c9b4', '#d2aed8'][i], 2);
                this.line([[-39, 0], [-29, 0]], '#d9c588', 3);
                this.line([[29, 0], [38, -12], [49, -12]], '#d9c588', 3);
                this.line([[29, 0], [38, 12], [49, 12]], '#d9c588', 3);
            }
            else if (type === 'buffer' || type === 'cache') {
                for (let i = 2; i >= 0; i--) {
                    this.rect(-27, -20 + i * 13, 56, 15, type === 'cache' ? '#aa7a58' : '#6a7692', 4, '#b9b496');
                    this.circle(20, -12 + i * 13, 2, i === 0 && active ? '#f2db7d' : '#d8debd');
                }
                if (type === 'cache')
                    this.text('↻', 0, -7, 24, '#f4dec1', 800, 'center');
            }
            else if (type === 'check') {
                this.rect(-24, -22, 50, 42, '#758458', 5, '#b4c17b');
                this.line([[-12, 0], [-3, 9], [16, -11]], '#e3edc6', 5);
            }
            else {
                for (let i = 0; i < 3; i++)
                    this.rect(-25 + i * 5, -20 + i * 7, 44, 29, i % 2 ? '#b4935e' : '#ccb078', 3, '#f0d397');
                this.text(type === 'in' ? '↓' : '✓', 0, 3, 26, '#44533b', 850, 'center');
            }
            if (active) {
                c.save();
                c.translate(42, 28);
                c.rotate(time * 2);
                for (let i = 0; i < 4; i++) {
                    c.rotate(Math.PI / 2);
                    this.rect(-2, -10, 4, 20, '#bec495', 1);
                }
                this.circle(0, 0, 6, '#324c3a');
                c.restore();
            }
            c.restore();
        }
        drawRuleBoard(s) {
            if(s.program){
                this.rect(198,36,950,231,'#4b6955',12,'#a2b794');this.rect(209,46,928,210,'#172f24',6);
                this.text('ПРОГРАММА СОРТИРОВЩИКА',235,68,14,'#d6e5ba',750);
                this.text('нажми, чтобы открыть редактор',1105,68,12,'#b7c99a',450,'right');
                const lines=s.program.source.split('\n').filter(l=>!l.trimStart().startsWith('#')).slice(0,7);
                lines.forEach((l,i)=>{this.text(String(i+1).padStart(2,'0'),234,97+i*21,11,'#8eab89',500);this.text(l.slice(0,85),273,97+i*21,13,'#d7e4b4',550);});
                this.hits.push({kind:'codeOpen',x:198,y:36,w:950,h:231});return;
            }
 this.rect(205, 45, 950, 231, '#13271dcc', 16); this.rect(198, 36, 950, 231, '#6b6242', 12, '#9a8b5b'); this.rect(209, 46, 928, 210, '#314330', 6, '#475f3e'); this.text('ДОСКА ПРАВИЛ', 235, 68, 14, '#d3d4a6', 750); this.text('слова меняют работу сортировщика', 1105, 68, 12, '#9eb18a', 450, 'right'); s.rules.forEach((r, i) => { const y = 97 + i * 38; this.text(String(i + 1).padStart(2, '0'), 239, y + 12, 12, '#839477', 600); this.text('ЕСЛИ', 291, y + 12, 12, '#b7c49c', 700); this.text('ТО', 564, y + 12, 12, '#b7c49c', 700); this.ruleSlot(i, 'condition', r.condition, 337, y, 195, 30); this.ruleSlot(i, 'action', r.action, 596, y, 245, 30); const enabled = r.condition && r.action; this.circle(881, y + 12, 4, enabled ? '#cad989' : '#6c7a55'); this.text(enabled ? 'ДЕЙСТВУЕТ' : 'нужны два слова', 896, y + 12, 12, enabled ? '#d8dfb4' : '#8ea381', 500); }); this.circle(218, 49, 3, '#c8b582'); this.circle(1125, 49, 3, '#c8b582'); }
        ruleSlot(row, part, value, x, y, w, h) { const selected = this.hover?.kind === 'rule' && this.hover.row === row && this.hover.part === part; this.rect(x, y + 3, w, h, '#13251a', 4); this.rect(x, y, w, h, value ? (part === 'condition' ? '#8b7850' : '#527b58') : '#283e2b', 4, selected ? '#f4d599' : value ? '#b3a66d' : '#617250'); this.text(value ? (part === 'condition' ? D.conditions[value] : D.actions[value]) : 'положи слово', x + w / 2, y + h / 2, 13, value ? '#f4eccb' : '#8fa57f', 650, 'center'); this.hits.push({ kind: 'rule', row, part, value, x, y, w, h }); }
        curve(a, b) { return [{ x: a.x + 72, y: a.y + 6 }, { x: a.x + 130, y: a.y + 6 }, { x: b.x - 130, y: b.y + 6 }, { x: b.x - 72, y: b.y + 6 }]; }
        bez(points, t) { const u = 1 - t; return { x: u * u * u * points[0].x + 3 * u * u * t * points[1].x + 3 * u * t * t * points[2].x + t * t * t * points[3].x, y: u * u * u * points[0].y + 3 * u * u * t * points[1].y + 3 * u * t * t * points[2].y + t * t * t * points[3].y }; }
        drawFactory(s) {
            const c = this.ctx;
            this.rect(60, 296, 1260, 443, '#12271c', 15);
            this.rect(53, 282, 1268, 441, '#3c4b36', 15, '#8b855b');
            c.save();
            c.beginPath();
            c.roundRect(58, 287, 1258, 430, 12);
            c.clip();
            for (let y = 295; y < 730; y += 47) {
                this.line([[60, y], [1320, y]], '#526049', 1);
                for (let x = 60 + (y % 3) * 50; x < 1320; x += 140)
                    this.line([[x, y], [x, y + 47]], '#44573d', 1);
            }
            c.restore();
            this.rect(56, 722, 1262, 13, '#776748', 4);
            this.text('ПОСТРОЙ НЕ БОЛЬШЕ МАШИН. ПОСТРОЙ ЛУЧШИЕ СВЯЗИ.', 690, 775, 13, '#7c9371', 600, 'center');
            this.tree(42, 168, 1.25);
            this.tree(1333, 179, 1.1);
            this.tree(104, seventy(), .8);
            this.pot(93, 752);
            this.pot(1293, 752);
            this.drawRuleBoard(s);
            for (const l of s.links) {
                const a = s.nodes.find(n => n.id === l.from), b = s.nodes.find(n => n.id === l.to);
                if (!a || !b)
                    continue;
                const p = this.curve(a, b);
                const draw = (col, w, d = []) => { c.strokeStyle = col; c.lineWidth = w; c.setLineDash(d); c.beginPath(); c.moveTo(p[0].x, p[0].y); c.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y); c.stroke(); c.setLineDash([]); };
                draw('#172b20', 17);
                draw('#777655', 11);
                draw('#313e2b', 7, [7, 9]);
                const q = this.bez(p, .52);
                const q2 = this.bez(p, .53);
                c.save();
                c.translate(q.x, q.y);
                c.rotate(Math.atan2(q2.y - q.y, q2.x - q.x));
                this.line([[-6, -5], [1, 0], [-6, 5]], '#d7c58c', 2);
                c.restore();
            }
            for (const n of s.nodes)
                this.drawNode(n, s);
            for (const t of s.transit) {
                const a = s.nodes.find(n => n.id === t.from), b = s.nodes.find(n => n.id === t.to);
                if (!a || !b)
                    continue;
                const p = this.bez(this.curve(a, b), 1 - t.left / t.duration);
                this.packet(t.job, p.x, p.y);
            }
            if (this.linkFrom && this.mouse) {
                const a = s.nodes.find(n => n.id === this.linkFrom);
                if (a)
                    this.line([[a.x + 72, a.y], [this.mouse.x, this.mouse.y]], '#f3d28a', 3, [7, 6]);
            }
            if (this.moveGhost) {
                const n = s.nodes.find(n => n.id === this.moveGhost.id);
                if (n) {
                    c.globalAlpha = .5;
                    this.drawNode({ ...n, x: this.moveGhost.x, y: this.moveGhost.y }, s);
                    c.globalAlpha = 1;
                }
            }
            if ((this.tool.startsWith('build:') || this.tool.startsWith('copy:')) && this.mouse) {
                c.globalAlpha = .55;
                this.rect(this.mouse.x - 72, this.mouse.y - 58, 144, 117, '#72986c', 9, '#e6d095');
                this.machineIcon(this.tool.startsWith('copy:') ? s.nodes.find(n => n.id === this.tool.slice(5))?.type || 'photo' : this.tool.slice(6), this.mouse.x, this.mouse.y, false, s.time);
                c.globalAlpha = 1;
            }
        }
        drawNode(n, s) { const m = D.machines[n.type], x = n.x, y = n.y, busy = !!n.active, blocked = busy && n.active.finished && n.type !== 'out'; this.rect(x - 74, y - 46, 150, 118, '#102819a0', 10); this.rect(x - 76, y - 60, 152, 118, '#263f30', 10, this.selected === n.id ? '#f6d693' : blocked ? '#dcaa77' : '#738163'); this.rect(x - 71, y - 55, 142, 79, '#344c39', 7); this.rect(x - 69, y + 24, 138, 29, '#233a2a', 5); this.text(m.short, x, y + 38, 13, m.color, 750, 'center'); this.machineIcon(n.type, x - 8, y - 16, busy && !blocked, s.time); const pct = n.active ? 1 - n.active.left / n.active.duration : 0; this.rect(x - 62, y + 56, 124, 4, '#182e20', 2); this.rect(x - 62, y + 56, 124 * pct, 4, blocked ? '#d6a377' : m.color, 2); this.circle(x - 77, y + 7, 5, '#bea675'); this.circle(x + 77, y + 7, 5, '#bea675'); this.text('' + n.queue.length, x + 61, y - 46, 12, n.queue.length >= D.machines[n.type].capacity - 1 ? '#f1b580' : '#e5dec2', 750, 'center'); this.text('ур. ' + n.level, x - 57, y - 44, 10, '#afbea0', 500); if (blocked)
            this.text('!', x + 61, y - 26, 18, '#eeb38a', 850, 'center'); for (let i = 0; i < Math.min(5, n.queue.length); i++) {
            const p = n.queue[i];
            this.packet(p, x - 50 + i * 19, y + 79);
        } if (n.queue.length > 5)
            this.text('+' + (n.queue.length - 5), x + 50, y + 81, 10, '#d2d7b1'); if (this.heat) {
            const d = this.pulse.find(v => v.id === n.id);
            if (d) {
                const colors = { busy: '#e8c775', blocked: '#e5a090', downstream: '#dfa77d', disconnected: '#aaa99a', working: '#a7d3ad', idle: '#829f9b' }, labels = { busy: 'ЗАНЯТ', blocked: 'СТОП', downstream: 'ЖДЁТ ВЫХОД', disconnected: 'НЕТ ПУТИ', working: 'РАБОТАЕТ', idle: 'ЖДЁТ' };
                const color = colors[d.kind];
                this.rect(x - 76, y - 81, 152, 19, '#10271bee', 5, color);
                this.text(labels[d.kind] + ' · ' + (d.utilization === null ? '—' : d.utilization + '%'), x, y - 71, 10, color, 750, 'center');
            }
        } this.hits.push({ kind: 'node', id: n.id, x: x - 79, y: y - 64, w: 158, h: 154 }); }
        house(x, y, w, h, roof, name, open = true) { this.rect(x + 8, y + 15, w, h, '#12271c77', 6); this.rect(x, y, w, h, '#ac9162', 5, '#dec08b'); this.rect(x + 6, y + 5, w - 12, h - 6, '#d3ba86', 4); for (let yy = y + 18; yy < y + h; yy += 14)
            this.line([[x + 6, yy], [x + w - 6, yy]], '#bca274', 1); const c = this.ctx; c.beginPath(); c.moveTo(x - 12, y + 5); c.lineTo(x + w / 2, y - 60); c.lineTo(x + w + 12, y + 5); c.closePath(); c.fillStyle = roof; c.fill(); for (let i = 0; i < 4; i++)
            this.line([[x + 13 + i * 20, y - 8 - i * 10], [x + w - 13 - i * 20, y - 8 - i * 10]], '#ffffff18', 2); this.rect(x + w * .42, y + h - 60, w * .18, 60, '#435944', 3); this.circle(x + w * .55, y + h - 27, 2, '#f1d180'); for (const dx of [w * .12, w * .71]) {
            this.rect(x + dx, y + 23, w * .16, 32, '#546f60', 3);
            this.rect(x + dx + 3, y + 26, w * .16 - 6, 26, open ? '#e4ca88' : '#819185', 1);
            this.line([[x + dx + w * .08, y + 24], [x + dx + w * .08, y + 53]], '#6d7656', 2);
        } this.rect(x + w / 2 - 95, y + h + 12, 190, 28, '#243f2be8', 7); this.text(name, x + w / 2, y + h + 26, 13, '#e0e4c0', 650, 'center'); }
        drawYard(s) { this.rect(0, 0, 1380, 810, '#344e35'); for (let i = 0; i < 40; i++) {
            this.circle((i * 317 + 71) % 1380, (i * 83 + 127) % 810, 1 + (i % 3), '#557047');
        } this.rect(655, 180, 83, 630, '#857957', 8); this.rect(225, 564, 930, 66, '#887c58', 9); for (let i = 0; i < 20; i++)
            this.rect(670 + (i % 3) * 20, 210 + i * 28, 14, 14, '#9b8c62', 3); for (const [x, y] of [[80, 170], [130, 280], [1180, 160], [1250, 245], [105, 705], [1170, 719], [320, 124], [1000, 110]])
            this.tree(x, y, 1.3); this.house(245, 280, 350, 240, '#546c54', 'ТВОЯ МАСТЕРСКАЯ'); this.house(857, 339, 227, 165, '#7b7251', 'ХОЗЯЙСТВЕННЫЙ БЛОК', s.claimed.length > 1); this.text('ДОМ, К КОТОРОМУ ХОЧЕТСЯ ВЕРНУТЬСЯ', 690, seventy(), 20, '#d5ddb1', 700, 'center'); if (s.decor.includes('garden')) {
            for (let i = 0; i < 18; i++) {
                const x = 275 + (i % 9) * 33, y = 653 + Math.floor(i / 9) * 35;
                this.circle(x, y, 6, ['#e3ba74', '#c5a5c3', '#a9d085'][i % 3]);
                this.line([[x, y + 4], [x, y + 16]], '#a3bb73', 2);
            }
            this.rect(250, 714, 287, 9, '#bb9564', 3);
        } if (s.decor.includes('terrace')) {
            for (const x of [801, 953]) {
                this.circle(x, 678, 39, '#997e57');
                this.circle(x, 674, 36, '#bea071');
                this.rect(x - 32, 723, 64, 10, '#ba9364', 2);
                this.pot(x, 665);
            }
        } if (s.decor.includes('sign')) {
            this.rect(640, 224, 90, 53, '#1f3828', 5, '#c5b57b');
            this.text('ЖИВОЙ', 685, 243, 15, '#e9d198', 800, 'center');
            this.text('ЦЕХ', 685, 260, 13, '#d5e0b0', 600, 'center');
        } this.rect(1020, 592, 130, 55, '#243e2b', 7, '#8c9a67'); this.text('Погладить кота', 1085, 619, 12, '#d1ddb3', 600, 'center'); this.hits.push({ kind: 'cat', x: 1015, y: 574, w: 142, h: 88 }); this.cat(1198, 597); }
        cat(x, y) { this.rect(x - 21, y - 11, 43, 22, '#c7b07e', 10); this.circle(x - 22, y - 9, 12, '#d9bf8b'); this.line([[x - 31, y - 15], [x - 33, y - 27], [x - 23, y - 18]], '#d9bf8b', 5); this.line([[x - 18, y - 18], [x - 11, y - 26], [x - 13, y - 12]], '#d9bf8b', 5); this.line([[x - 28, y - 8], [x - 24, y - 7]], '#4e5236', 2); this.line([[x + 16, y], [x + 32, y - 7], [x + 31, y - 19]], '#b99e6c', 6); }
        drawTown(s) { this.rect(0, 0, 1380, 810, '#384f38'); this.rect(0, 492, 1380, 93, '#897b58', 3); this.rect(650, 60, 93, 750, '#897b58', 3); for (let i = 0; i < 28; i++)
            this.tree((i * 187 + 30) % 1380, 40 + (i % 2) * 40, .6); const sites = [{ x: 150, y: 230, w: 257, h: 178, roof: '#88645c', name: 'ФОТОАТЕЛЬЕ ЛИДЫ', ch: 0 }, { x: 890, y: 219, w: 285, h: 184, roof: '#8f7a50', name: 'ЛАВКА МАРКА', ch: 1 }, { x: 189, y: 666, w: 295, h: 100, roof: '#718658', name: 'ЯРМАРКА АСИ', ch: 2 }, { x: 878, y: 662, w: 302, h: 111, roof: '#63787e', name: 'БИБЛИОТЕКА ВЕРЫ', ch: 3 }]; sites.forEach(a => { const done = s.claimed.includes(a.ch); this.house(a.x, a.y, a.w, a.h, a.roof, a.name, done); if (done) {
            this.circle(a.x + a.w - 5, a.y - 30, 18, '#c9d99a');
            this.text('✓', a.x + a.w - 5, a.y - 28, 21, '#425339', 800, 'center');
            for (let i = 0; i < 4; i++)
                this.pot(a.x + 20 + i * 62, a.y + a.h + 50);
        } this.hits.push({ kind: 'neighbor', chapter: a.ch, x: a.x - 10, y: a.y - 65, w: a.w + 20, h: a.h + 110 }); }); this.text('ГОРОД ПОМНИТ ТВОИ РЕШЕНИЯ', 695, 140, 20, '#e6e4bd', 750, 'center'); this.text(s.claimed.length + ' из '+D.contracts.length+' добрых дел', 696, 174, 16, '#cad6aa', 500, 'center');
            if(s.ending){
                this.line([[90,469],[355,492],[690,471],[1020,496],[1310,469]],'#d2b67d',3);
                for(let i=0;i<19;i++){const x=112+i*65,y=474+Math.sin(i*.75)*12;this.line([[x,y],[x,y+15]],'#b2a876',1);this.circle(x,y+21,6,i%2?'#edcd88':'#bfd695');}
                this.rect(498,499,389,72,'#233e2cea',12,'#c1ae74');
                this.text('ВСЕ НА ПЛОЩАДИ',691,521,18,'#e9d69e',750,'center');
                this.text('Нажми, чтобы вспомнить этот вечер',691,549,12,'#bdcdaa',450,'center');
                for(let i=0;i<5;i++){const x=535+i*76;this.circle(x,613,12,['#d3ae80','#aeccb1','#e0ba92','#bba1c3','#cfbc91'][i]);this.rect(x-12,625,24,32,['#915c51','#728660','#b1975b','#768598','#9ca473'][i],6);}
                this.hits.push({kind:'ending',x:498,y:499,w:389,h:72});
            }
 }
        draw(s) { if (!this.w || !s)
            return; this.state = s; const c = this.ctx; this.hits = []; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h); c.fillStyle = '#263e2b'; c.fillRect(0, 0, this.w, this.h); const o = this.origin(); c.save(); c.translate(o.x, o.y); c.scale(this.scale(), this.scale()); if (this.tab === 'yard')
            this.drawYard(s);
        else if (this.tab === 'town')
            this.drawTown(s);
        else
            this.drawFactory(s); if (this.dragWord && this.mouse) {
            const word = this.dragWord;
            this.rect(this.mouse.x - 85, this.mouse.y - 18, 170, 36, '#b89f64', 5, '#eed8a5');
            this.text(word.part === 'condition' ? D.conditions[word.value] : D.actions[word.value], this.mouse.x, this.mouse.y, 13, '#26391e', 750, 'center');
        } c.restore(); }
    }
    function seventy() { return 94; }
    g.WorkshopView = WorkshopView;
})(globalThis);
