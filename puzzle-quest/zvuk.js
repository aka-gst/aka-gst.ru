// Звук камушков — синтезом, без файлов. Файлы у нас пять раз не доезжали до человека.
export class Zvuk {
  // tiho — немой запуск (?тихо): цепь строится та же, но на выходе ноль.
  // Нужен проверкам и прогонам, чтобы не будить колонки владельца
  constructor(tiho = false) { this.ctx = null; this.obshchiy = null; this.tiho = tiho; }
  razbudit() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.obshchiy = this.ctx.createGain();
    this.obshchiy.gain.value = this.tiho ? 0 : 0.5;
    this.obshchiy.connect(this.ctx.destination);
    // измеритель на общем узле — им проверяем, что звук РЕАЛЬНО идёт
    this.analiz = this.ctx.createAnalyser();
    this.analiz.fftSize = 2048;
    this.obshchiy.connect(this.analiz);
  }
  // RMS на живой странице: в тишине ровно 0, после действия — выше
  rms() {
    if (!this.analiz) return 0;
    const b = new Float32Array(this.analiz.fftSize);
    this.analiz.getFloatTimeDomainData(b);
    let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    return Math.sqrt(s / b.length);
  }

  // камушек упал: короткий стук с резонансом. Высота зависит от того, с какой высоты падал
  kamen(vysota = 1, gromkost = 1) {
    this.razbudit();
    const t = this.ctx.currentTime;
    // тело удара — шумовой щелчок через фильтр
    const dl = 0.09;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dl, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const shum = this.ctx.createBufferSource(); shum.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 900 + vysota * 260;   // выше падал — звонче
    flt.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55 * gromkost, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dl);
    shum.connect(flt).connect(g).connect(this.obshchiy);
    shum.start(t); shum.stop(t + dl);
    // призвук — короткий тон, он и даёт «камушковость»
    const o = this.ctx.createOscillator(), og = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(320 + vysota * 90, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.07);
    og.gain.setValueAtTime(0.18 * gromkost, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(og).connect(this.obshchiy);
    o.start(t); o.stop(t + 0.08);
  }

  // совпадение: чем длиннее цепь и выше каскад, тем выше нота — награда на слух
  sovpadenie(dlina = 3, kaskad = 0) {
    this.razbudit();
    const t = this.ctx.currentTime;
    const nota = 440 * Math.pow(2, (Math.min(dlina - 3, 3) * 2 + Math.min(kaskad, 4) * 3) / 12);
    [0, 0.045].forEach((z, k) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = k ? 'sine' : 'triangle';
      o.frequency.value = nota * (k ? 2 : 1);
      g.gain.setValueAtTime(0, t + z);
      g.gain.linearRampToValueAtTime(k ? 0.10 : 0.20, t + z + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + z + 0.26);
      o.connect(g).connect(this.obshchiy);
      o.start(t + z); o.stop(t + z + 0.28);
    });
  }

  // взрыв: низкий шум, для особых фишек
  vzryv() {
    this.razbudit();
    const t = this.ctx.currentTime, dl = 0.34;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dl, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.7);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dl);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dl);
    s.connect(f).connect(g).connect(this.obshchiy);
    s.start(t); s.stop(t + dl);
  }
}
