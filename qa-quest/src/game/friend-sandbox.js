// Narrative-only sandbox. No network, real messages, user IDs or credentials.
export function routePracticePacket(channel) {
  return channel === 'friends'
    ? { ok: true, text: 'ПАКЕТ ДОШЁЛ ДО ДРУЗЕЙ' }
    : { ok: false, text: 'Это общий канал. Наш закрытый чат в другом месте — поменяй адресата.' };
}

export function createFriendSandbox(root, { onComplete, onSound }) {
  const stage = root.querySelector('#chatStage');
  const output = root.querySelector('#chatOutput');
  function reset() {
    root.hidden = true;
    stage.dataset.step = 'intercept';
    output.textContent = 'ДРУГ: «Лови тестовый пакет. Сможешь добраться до нашего чата?»';
    root.querySelector('#packetCode').textContent = 'to = "public"';
  }
  root.querySelector('#interceptPacket').addEventListener('click', () => {
    stage.dataset.step = 'route';
    output.textContent = 'Пакет пойман. Адресат — public: общий канал. Куда отправишь?';
    onSound('pickup');
  });
  for (const button of root.querySelectorAll('[data-channel]')) {
    button.addEventListener('click', () => {
      const channel = button.dataset.channel;
      root.querySelector('#packetCode').textContent = `to = "${channel}"`;
      const result = routePracticePacket(channel);
      output.textContent = result.text;
      if (result.ok) {
        stage.dataset.step = 'joined';
        output.textContent += '\nДРУГ: «Опа, нашёл! Ты изменил одну вещь — и сообщение пошло другим путём».\nНЕИЗВЕСТНЫЙ: «Ты уже помог мне заговорить. Теперь помоги появиться».\nДРУГ: «Стоп. Это не я писал». ';
        onSound('wake');
      } else onSound('pickup');
    });
  }
  root.querySelector('#chatContinue').addEventListener('click', () => { root.hidden = true; onComplete(); });
  reset();
  return { open() { reset(); root.hidden = false; }, reset };
}
