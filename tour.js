/*
  tour.js — пошаговое обучение поверх готового интерфейса.

  Гасит страницу, подсвечивает настоящий элемент и объясняет его. Клик по
  подсвеченному двигает дальше, поэтому человек учится делая, а не читая.

  Без зависимостей, стили свои, ничего не требует от вёрстки, кроме селекторов.

      Tour.start([
        {sel:'#throw', text:'Это кубик. Брось его.'},
        {sel:'#board', text:'Здесь считаются очки.'},
      ]);

  Один раз при первом заходе, дальше по кнопке «как играть»:

      Tour.once('my-game', STEPS);      // покажет, если ещё не показывали
      helpButton.onclick = () => Tour.start(STEPS);

  Если цель лежит в скрытой вкладке или свёрнутой панели — открой её сам:

      Tour.start(STEPS, {before: step => openTabContaining(step.sel)});

  Всегда есть «ДАЛЬШЕ» и «пропустить»: шаг, который ждёт действия, не должен
  запирать того, кто это действие сейчас совершить не может.
*/
(function (global) {
  'use strict';

  var CSS = [
    '.tour-dim{position:fixed;inset:0;z-index:2147483000;background:rgba(8,10,16,.78)}',
    '.tour-spot{position:relative;z-index:2147483001;outline:3px solid #7fd98a;outline-offset:3px}',
    '.tour-box{position:fixed;z-index:2147483002;left:50%;transform:translateX(-50%);',
    '  width:min(440px,92vw);padding:16px 18px;border:1px solid #7fd98a;background:#141b26;',
    '  color:#dfe7f0;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;',
    '  box-shadow:0 10px 40px rgba(0,0,0,.6);box-sizing:border-box}',
    '.tour-box p{margin:0 0 12px}',
    '.tour-row{display:flex;align-items:center;gap:10px}',
    '.tour-row span{flex:1;text-align:center;color:#8ea0b5;font-size:11px}',
    '.tour-box button{font:inherit;font-size:12px;cursor:pointer;border:1px solid #35455a;',
    '  background:#1a2432;color:#8ea0b5;padding:8px 13px;touch-action:manipulation}',
    '.tour-box button.tour-next{border:2px solid #7fd98a;background:#1d4a30;color:#fff;font-weight:700}'
  ].join('');

  var styled = false;
  function injectCss() {
    if (styled) return;
    styled = true;
    var el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  var active = null;

  function Session(steps, opts) {
    this.steps = steps || [];
    this.opts = opts || {};
    this.i = -1;
    this.spot = null;
    this.build();
  }

  Session.prototype.build = function () {
    injectCss();
    var self = this;
    var labels = this.opts.labels || {};

    this.dim = document.createElement('div');
    this.dim.className = 'tour-dim';

    this.box = document.createElement('div');
    this.box.className = 'tour-box';

    this.text = document.createElement('p');

    this.skip = document.createElement('button');
    this.skip.textContent = labels.skip || 'пропустить';
    this.skip.onclick = function () { self.stop(); };

    this.count = document.createElement('span');

    this.next = document.createElement('button');
    this.next.className = 'tour-next';
    this.next.onclick = function () { self.go(self.i + 1); };

    var row = document.createElement('div');
    row.className = 'tour-row';
    row.appendChild(this.skip);
    row.appendChild(this.count);
    row.appendChild(this.next);

    this.box.appendChild(this.text);
    this.box.appendChild(row);

    // Клик по подсвеченному элементу — тоже шаг вперёд: учимся делая.
    this.onClick = function (e) {
      if (!self.spot || !self.spot.contains(e.target)) return;
      setTimeout(function () { self.go(self.i + 1); }, 260);
    };
    this.onKey = function (e) {
      if (e.key === 'Escape') self.stop();
      else if (e.key === 'Enter' || e.key === 'ArrowRight') self.go(self.i + 1);
    };
  };

  Session.prototype.clearSpot = function () {
    if (this.spot) this.spot.classList.remove('tour-spot');
    this.spot = null;
  };

  Session.prototype.go = function (i) {
    if (i < 0 || i >= this.steps.length) return this.stop();
    this.clearSpot();
    this.i = i;

    var step = this.steps[i];
    var labels = this.opts.labels || {};
    // Игра может открыть вкладку или развернуть панель, где лежит цель.
    if (typeof this.opts.before === 'function') {
      try { this.opts.before(step, i); } catch (err) { /* обучение важнее сбоя в хуке */ }
    }

    // Текст только через textContent: он может прийти из чужих данных.
    this.text.textContent = step.text;
    this.count.textContent = (i + 1) + (labels.of || ' из ') + this.steps.length;
    this.next.textContent = i === this.steps.length - 1
      ? (labels.done || 'ИГРАТЬ') : (labels.next || 'ДАЛЬШЕ');

    var target = step.sel ? document.querySelector(step.sel) : null;
    var visible = !!(target && target.offsetParent !== null);
    var box = this.box.style;

    if (visible) {
      target.classList.add('tour-spot');
      this.spot = target;
      if (target.scrollIntoView) target.scrollIntoView({block: 'center', behavior: 'smooth'});
      var rect = target.getBoundingClientRect();
      var lower = rect.top + rect.height / 2 > innerHeight / 2;
      // Карточка уходит в противоположную половину экрана, чтобы не закрывать цель.
      box.top = lower ? '16px' : 'auto';
      box.bottom = lower ? 'auto' : '16px';
      box.transform = 'translateX(-50%)';
    } else {
      // Цели нет или она скрыта — говорим по центру, без подсветки.
      box.top = '50%';
      box.bottom = 'auto';
      box.transform = 'translate(-50%,-50%)';
    }
    this.next.focus();
  };

  Session.prototype.start = function () {
    document.body.appendChild(this.dim);
    document.body.appendChild(this.box);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('keydown', this.onKey);
    this.go(0);
  };

  Session.prototype.stop = function () {
    this.clearSpot();
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('keydown', this.onKey);
    if (this.dim.parentNode) this.dim.parentNode.removeChild(this.dim);
    if (this.box.parentNode) this.box.parentNode.removeChild(this.box);
    if (active === this) active = null;
    if (this.opts.key) { try { localStorage.setItem('tour-seen:' + this.opts.key, '1'); } catch (e) {} }
    if (typeof this.opts.onEnd === 'function') this.opts.onEnd();
  };

  var Tour = {
    /* Показать обучение. Повторный вызов прерывает предыдущее. */
    start: function (steps, opts) {
      if (active) active.stop();
      if (!steps || !steps.length) return null;
      active = new Session(steps, opts);
      active.start();
      return active;
    },

    /* Показать один раз на устройство. key — имя игры. */
    once: function (key, steps, opts) {
      if (Tour.seen(key)) return null;
      opts = opts || {};
      opts.key = key;
      return Tour.start(steps, opts);
    },

    seen: function (key) {
      try { return !!localStorage.getItem('tour-seen:' + key); } catch (e) { return true; }
    },

    /* Забыть, что обучение показывали — для кнопки «пройти заново». */
    reset: function (key) {
      try { localStorage.removeItem('tour-seen:' + key); } catch (e) {}
    },

    stop: function () { if (active) active.stop(); }
  };

  global.Tour = Tour;
})(window);
