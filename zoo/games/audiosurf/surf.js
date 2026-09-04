/* Аудиосёрф: трасса строится из трека игрока прямо на устройстве.

   Файл не отправляется никуда и никогда. Он читается через FileReader,
   разбирается Web Audio и живёт только в памяти вкладки. Никаких запросов
   с содержимым файла в этом коде нет — и не должно появиться: чужая музыка
   на сервере это лицензии, а не техника. */
(() => {
  const $ = id => document.getElementById(id);
  const LANES = 3;
  const canvas = $('road'), ctx = canvas.getContext('2d');

  const COLORS = ['#c65e42', '#d39a3c', '#4f9d8a'];
  const GREY = '#6a746d';

  let audio = null, buffer = null, source = null, startedAt = 0, pausedAt = 0;
  let blocks = [], lane = 1, score = 0, combo = 0, picked = 0, running = false, raf = null;

  function fail(message) {
    const box = $('error');
    box.textContent = message;
    box.hidden = false;
  }

  /* Разбор трека: огибающая громкости, затем удары как локальные максимумы
     над скользящим средним. Точность здесь не нужна — нужна узнаваемость:
     чтобы на громких местах блоков было больше. */
  function analyse(decoded) {
    const data = decoded.getChannelData(0);
    const window = Math.max(1, Math.floor(decoded.sampleRate / 43)); // ~23 мс
    const frames = Math.floor(data.length / window);
    const energy = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let j = 0; j < window; j++) { const v = data[i * window + j]; sum += v * v; }
      energy[i] = Math.sqrt(sum / window);
    }
    const history = 43;                       // около секунды
    const beats = [];
    let running = 0;
    for (let i = 0; i < frames; i++) {
      const from = Math.max(0, i - history);
      let mean = 0;
      for (let j = from; j <= i; j++) mean += energy[j];
      mean /= (i - from + 1);
      const loud = energy[i] > mean * 1.35 && energy[i] > 0.02;
      if (loud && i - running > 6) {          // не чаще ~7 раз в секунду
        beats.push({ time: (i * window) / decoded.sampleRate, power: energy[i] / (mean || 1) });
        running = i;
      }
    }
    return beats;
  }

  function buildTrack(beats) {
    // Цветной блок — очко, серый — сбой. Чем сильнее удар, тем ценнее блок.
    return beats.map((beat, index) => ({
      time: beat.time,
      lane: Math.floor(Math.random() * LANES),
      grey: beat.power < 1.6 && index % 5 === 0,
      value: beat.power > 2.4 ? 3 : beat.power > 1.9 ? 2 : 1,
      hit: false,
    }));
  }

  function draw(now) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#12211f';
    ctx.fillRect(0, 0, w, h);

    const horizon = h * 0.18, laneW = w / LANES;
    // дорога сходится к горизонту
    for (let i = 0; i <= LANES; i++) {
      ctx.strokeStyle = 'rgba(217,209,195,.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(i * laneW, h);
      ctx.lineTo(w / 2 + (i - LANES / 2) * laneW * 0.18, horizon);
      ctx.stroke();
    }

    const AHEAD = 2.6;                        // сколько секунд трассы видно
    for (const block of blocks) {
      const dt = block.time - now;
      if (dt < -0.15 || dt > AHEAD) continue;
      const p = 1 - dt / AHEAD;               // 0 у горизонта, 1 у игрока
      const depth = p * p;                    // перспектива
      const y = horizon + (h - horizon) * depth;
      const spread = 0.18 + 0.82 * depth;
      const cx = w / 2 + (block.lane - (LANES - 1) / 2) * laneW * spread;
      const size = 10 + 54 * depth;
      ctx.fillStyle = block.hit ? 'rgba(255,250,240,.18)'
        : block.grey ? GREY : COLORS[block.lane % COLORS.length];
      ctx.fillRect(cx - size / 2, y - size / 2, size, size * 0.7);
    }

    // фишка игрока
    const px = w / 2 + (lane - (LANES - 1) / 2) * laneW;
    ctx.fillStyle = '#f5f0e6';
    ctx.beginPath();
    ctx.moveTo(px, h - 96);
    ctx.lineTo(px - 34, h - 30);
    ctx.lineTo(px + 34, h - 30);
    ctx.closePath();
    ctx.fill();
  }

  /* Разбираем все блоки, которые уже проехали, а не попавшие в узкое окно.
     Кадры проседают — на слабом телефоне, в фоновой вкладке, при подгрузке, —
     и окно в 80 мс просто перепрыгивалось: заезд шёл, а очки не начислялись. */
  function collide(now) {
    for (const block of blocks) {
      if (block.hit || block.time > now) continue;
      block.hit = true;
      if (block.lane !== lane) { if (!block.grey) combo = 0; continue; }
      if (block.grey) { combo = 0; score = Math.max(0, score - 2); }
      else { combo += 1; picked += 1; score += block.value * (1 + Math.floor(combo / 8)); }
      $('score').textContent = score;
      $('combo').textContent = combo;
    }
  }

  function loop() {
    if (!running) return;
    const now = audio.currentTime - startedAt;
    collide(now);
    draw(now);
    if (buffer && now > buffer.duration + 0.4) return finish();
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    try { source && source.stop(); } catch (error) { /* уже остановлен */ }
    ZooKarma.stop();
    $('stage').hidden = true;
    $('done').hidden = false;
    $('finalScore').textContent = score;
    $('finalPicked').textContent = picked;
    $('finalKarma').textContent = ZooKarma.gained;
  }

  async function play(file) {
    $('error').hidden = true;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      await audio.resume();
      const bytes = await file.arrayBuffer();          // файл остаётся здесь
      buffer = await audio.decodeAudioData(bytes);
    } catch (error) {
      return fail('Не удалось разобрать этот файл. Попробуйте другой формат — mp3, m4a, wav или ogg.');
    }
    blocks = buildTrack(analyse(buffer));
    if (!blocks.length) return fail('В треке не нашлось ритма, из которого можно построить трассу.');

    score = 0; combo = 0; picked = 0; lane = 1;
    $('score').textContent = '0'; $('combo').textContent = '0';
    $('trackName').textContent = file.name.replace(/\.[^.]+$/, '');
    $('intro').hidden = true; $('done').hidden = true; $('stage').hidden = false;

    source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    startedAt = audio.currentTime;
    source.start();
    running = true;
    ZooKarma.start('audiosurf');
    loop();
  }

  const move = delta => { lane = Math.min(LANES - 1, Math.max(0, lane + delta)); };
  $('left').onclick = () => move(-1);
  $('right').onclick = () => move(1);
  addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  });
  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    move(event.clientX - rect.left < rect.width / 2 ? -1 : 1);
  });
  $('pause').onclick = async () => {
    if (!audio) return;
    if (audio.state === 'running') { await audio.suspend(); $('pause').textContent = 'Дальше'; }
    else { await audio.resume(); $('pause').textContent = 'Пауза'; if (running) loop(); }
  };
  /* Ушёл со вкладки — заезд встаёт. Иначе музыка играет дальше, кадры
     останавливаются, и весь трек проезжает мимо: вернувшись, игрок обнаружит
     обнулённую серию и чужой результат. */
  document.addEventListener('visibilitychange', () => {
    if (!running || !audio) return;
    if (document.hidden && audio.state === 'running') {
      audio.suspend(); $('pause').textContent = 'Дальше';
    }
  });

  $('again').onclick = () => { $('done').hidden = true; $('intro').hidden = false; $('file').value = ''; };
  $('file').onchange = event => { const file = event.target.files[0]; if (file) void play(file); };

  ZooKarma.onGain(total => {
    $('karmaBadge').hidden = false;
    $('karmaGained').textContent = total;
  });
})();
