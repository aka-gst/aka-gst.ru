/* Общий вход aka-gst. Самодостаточный виджет: своя разметка, свои стили, свои
   запросы к /api/auth/*. Подключается тем же файлом в любом проекте сайта —
   аккаунт один на Лилу, QA Quest и лидерборд. */
(() => {
  const API = '/api/auth';
  const MESSAGES = {
    invalid_nickname: 'Ник: от 3 до 24 знаков — буквы, цифры, пробел, дефис или подчёркивание.',
    invalid_email: 'Проверьте адрес почты.',
    invalid_password: 'Пароль должен быть не короче 12 знаков.',
    invalid_registration: 'Проверьте ник и пароль.',
    nickname_or_email_taken: 'Этот ник или почта уже заняты.',
    invalid_credentials: 'Неверный ник или пароль.',
    invalid_recovery_code: 'Код восстановления не подошёл.',
    too_many_attempts: 'Слишком много попыток. Попробуйте через 15 минут.',
    unauthorized: 'Сначала войдите в аккаунт.',
    forbidden_origin: 'Запрос отклонён. Обновите страницу и попробуйте снова.',
    auth_unavailable: 'Сервис входа сейчас недоступен.',
  };

  const listeners = new Set();
  let current = null;
  let available = true;

  const style = document.createElement('style');
  style.textContent = `
    .zk-account{display:inline-flex;align-items:center;gap:.5rem}
    .zk-button{font:inherit;cursor:pointer;border-radius:999px;border:1px solid currentColor;
      background:transparent;color:inherit;padding:.35rem .9rem;opacity:.85}
    .zk-button:hover{opacity:1}
    .zk-dialog{border:none;border-radius:16px;padding:0;max-width:min(26rem,92vw);width:100%;
      color:#12211f;background:#f6f3ec;box-shadow:0 24px 60px rgba(0,0,0,.35)}
    .zk-dialog::backdrop{background:rgba(6,18,17,.6)}
    .zk-body{padding:1.4rem 1.4rem 1.2rem;display:grid;gap:.85rem}
    .zk-tabs{display:flex;gap:.4rem}
    .zk-tab{flex:1;font:inherit;cursor:pointer;padding:.45rem;border-radius:10px;
      border:1px solid rgba(18,33,31,.2);background:transparent;color:inherit}
    .zk-tab[aria-selected="true"]{background:#12211f;color:#f6f3ec;border-color:#12211f}
    .zk-dialog h2{margin:0;font-size:1.1rem}
    .zk-dialog label{display:grid;gap:.25rem;font-size:.85rem}
    .zk-dialog input{font:inherit;padding:.5rem .6rem;border-radius:10px;
      border:1px solid rgba(18,33,31,.28);background:#fff;color:inherit}
    .zk-submit{font:inherit;cursor:pointer;padding:.6rem;border-radius:12px;border:none;
      background:#12211f;color:#f6f3ec}
    .zk-submit[disabled]{opacity:.6;cursor:progress}
    .zk-note{font-size:.8rem;line-height:1.45;opacity:.75;margin:0}
    .zk-error{font-size:.85rem;color:#8d2f2f;margin:0;min-height:1.1em}
    .zk-codes{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9rem;
      background:#fff;border:1px dashed rgba(18,33,31,.35);border-radius:12px;padding:.7rem;
      display:grid;gap:.2rem;margin:0}
    .zk-link{background:none;border:none;padding:0;font:inherit;color:#2f6d63;
      cursor:pointer;text-decoration:underline;justify-self:start}
    .zk-row{display:flex;gap:.5rem;justify-content:space-between;align-items:center}
    .zk-divider{border:none;border-top:1px solid rgba(18,33,31,.15);margin:1.1rem 0 .2rem}
    .zk-subhead{font-size:.95rem;font-weight:600;margin:0}
    .zk-danger{color:#8d2f2f}
    .zk-link[disabled]{opacity:.5;cursor:progress;text-decoration:none}
  `;

  const dialog = document.createElement('dialog');
  dialog.className = 'zk-dialog';
  dialog.innerHTML = `
    <div class="zk-body">
      <div class="zk-tabs" role="tablist">
        <button class="zk-tab" type="button" role="tab" data-tab="login" aria-selected="true">Вход</button>
        <button class="zk-tab" type="button" role="tab" data-tab="register" aria-selected="false">Регистрация</button>
      </div>
      <form data-view="login">
        <h2>Вход</h2>
        <label>Ник или почта<input name="nickname" autocomplete="username" required></label>
        <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="zk-error" data-error></p>
        <button class="zk-submit" type="submit">Войти</button>
        <button class="zk-link" type="button" data-goto="recover">Забыли пароль? Есть код восстановления</button>
      </form>
      <form data-view="register" hidden>
        <h2>Регистрация</h2>
        <label>Ник<input name="nickname" autocomplete="username" required></label>
        <label>Пароль<input name="password" type="password" autocomplete="new-password" required minlength="12"></label>
        <label>Почта — по желанию<input name="email" type="email" autocomplete="email"></label>
        <p class="zk-note">Почта нужна только на будущее, для восстановления письмом. Пока писем нет,
          поэтому сразу после регистрации сохраните коды восстановления — другого пути назад в аккаунт нет.</p>
        <p class="zk-error" data-error></p>
        <button class="zk-submit" type="submit">Создать аккаунт</button>
      </form>
      <form data-view="recover" hidden>
        <h2>Восстановление</h2>
        <label>Ник<input name="nickname" autocomplete="username" required></label>
        <label>Код восстановления<input name="recovery_code" placeholder="0000-0000-0000" required></label>
        <label>Новый пароль<input name="new_password" type="password" autocomplete="new-password" required minlength="12"></label>
        <p class="zk-error" data-error></p>
        <button class="zk-submit" type="submit">Задать новый пароль</button>
        <button class="zk-link" type="button" data-goto="login">Вернуться ко входу</button>
      </form>
      <div data-view="account" hidden>
        <h2 data-account-name>Аккаунт</h2>
        <p class="zk-note">Прогресс сохраняется на сервере, поэтому игру можно продолжить с телефона
          или другого браузера — достаточно войти тем же ником.</p>
        <p class="zk-error" data-error></p>
        <div class="zk-row">
          <button class="zk-link" type="button" data-action="new-codes">Новые коды восстановления</button>
          <button class="zk-submit" type="button" data-action="logout">Выйти</button>
        </div>
        <hr class="zk-divider">
        <h3 class="zk-subhead">Ваши данные</h3>
        <p class="zk-note">Скачивается всё, что хранит сервер: партия, записи дневника и
          опубликованные размышления — одним файлом. Удаление стирает записи дневника;
          сама партия и её положение на поле остаются.</p>
        <div class="zk-row">
          <button class="zk-link" type="button" data-action="export-history">Скачать мою историю</button>
          <button class="zk-link zk-danger" type="button" data-action="wipe-history">Удалить историю</button>
        </div>
      </div>
      <div data-view="codes" hidden>
        <h2>Коды восстановления</h2>
        <p class="zk-note">Сохраните их сейчас: они показываются один раз. Каждый код срабатывает
          однократно и позволяет задать новый пароль, если старый забыт.</p>
        <pre class="zk-codes" data-codes></pre>
        <button class="zk-submit" type="button" data-action="close">Сохранил, закрыть</button>
      </div>
    </div>`;

  const view = name => {
    dialog.querySelectorAll('[data-view]').forEach(node => { node.hidden = node.dataset.view !== name; });
    dialog.querySelectorAll('.zk-tab').forEach(tab => {
      tab.hidden = name === 'account' || name === 'codes';
      tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    });
    dialog.querySelectorAll('[data-error]').forEach(node => { node.textContent = ''; });
  };
  const say = (name, text) => {
    const node = dialog.querySelector(`[data-view="${name}"] [data-error]`);
    if (node) node.textContent = text;
  };
  const showCodes = codes => {
    dialog.querySelector('[data-codes]').textContent = codes.join('\n');
    view('codes');
  };

  async function call(path, body) {
    const options = { credentials: 'same-origin' };
    if (body !== undefined) {
      options.method = 'POST';
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(API + path, options);
    } catch (networkError) {
      available = false;
      throw new Error('auth_unavailable');
    }
    let payload = null;
    try { payload = await response.json(); } catch (parseError) { payload = null; }
    available = response.status !== 503;
    if (!response.ok) throw new Error((payload && payload.error) || 'auth_unavailable');
    return payload || {};
  }

  function publish(account) {
    current = account && { ...account, account_id: account.account_id || account.id };
    listeners.forEach(listener => { try { listener(account, available); } catch (error) { /* виджет не должен ронять страницу */ } });
    document.querySelectorAll('[data-zk-account-button]').forEach(button => {
      button.textContent = account ? account.nickname : 'Войти';
      button.setAttribute('aria-label', account ? `Аккаунт ${account.nickname}` : 'Войти в аккаунт');
    });
  }

  dialog.querySelectorAll('.zk-tab').forEach(tab => { tab.onclick = () => view(tab.dataset.tab); });
  dialog.querySelectorAll('[data-goto]').forEach(button => { button.onclick = () => view(button.dataset.goto); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  dialog.querySelector('form[data-view="login"]').onsubmit = async event => {
    event.preventDefault();
    const form = event.target, submit = form.querySelector('.zk-submit');
    submit.disabled = true;
    try {
      const account = await call('/login', {
        nickname: form.nickname.value,
        password: form.password.value,
      });
      form.reset();
      publish(account);
      dialog.close();
    } catch (error) {
      say('login', MESSAGES[error.message] || 'Не удалось войти.');
    } finally {
      submit.disabled = false;
    }
  };

  dialog.querySelector('form[data-view="register"]').onsubmit = async event => {
    event.preventDefault();
    const form = event.target, submit = form.querySelector('.zk-submit');
    submit.disabled = true;
    try {
      const account = await call('/register', {
        nickname: form.nickname.value,
        password: form.password.value,
        email: form.email.value.trim() || null,
      });
      form.reset();
      publish(account);
      showCodes(account.recovery_codes || []);
    } catch (error) {
      say('register', MESSAGES[error.message] || 'Не удалось создать аккаунт.');
    } finally {
      submit.disabled = false;
    }
  };

  dialog.querySelector('form[data-view="recover"]').onsubmit = async event => {
    event.preventDefault();
    const form = event.target, submit = form.querySelector('.zk-submit');
    submit.disabled = true;
    try {
      const account = await call('/recover', {
        nickname: form.nickname.value,
        recovery_code: form.recovery_code.value,
        new_password: form.new_password.value,
      });
      form.reset();
      publish(account);
      dialog.close();
    } catch (error) {
      say('recover', MESSAGES[error.message] || 'Не удалось восстановить доступ.');
    } finally {
      submit.disabled = false;
    }
  };

  dialog.querySelector('[data-action="logout"]').onclick = async () => {
    try {
      await call('/logout', {});
      publish(null);
      dialog.close();
    } catch (error) {
      say('account', MESSAGES[error.message] || 'Не удалось выйти.');
    }
  };

  dialog.querySelector('[data-action="new-codes"]').onclick = async () => {
    const password = prompt('Для новых кодов подтвердите пароль:');
    if (!password) return;
    try {
      const result = await call('/recovery-codes', { password });
      showCodes(result.recovery_codes || []);
    } catch (error) {
      say('account', MESSAGES[error.message] || 'Не удалось выпустить коды.');
    }
  };

  // Accounts live at the site root, but the journal belongs to this game, so its
  // API is resolved against the page — /leela/api/..., not /api/...
  const gameUrl = path => new URL(path, new URL('.', location.href)).href;

  dialog.querySelector('[data-action="export-history"]').onclick = async () => {
    const button = dialog.querySelector('[data-action="export-history"]');
    button.disabled = true;
    try {
      const response = await fetch(gameUrl('api/progress/export'), { credentials: 'same-origin' });
      if (!response.ok) throw new Error('export_failed');
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'leela-history.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      say('account', '');
    } catch (error) {
      say('account', 'Не удалось скачать историю. Попробуйте ещё раз.');
    } finally {
      button.disabled = false;
    }
  };

  dialog.querySelector('[data-action="wipe-history"]').onclick = async () => {
    if (!confirm('Удалить все записи дневника? Это необратимо.\n\nЕсли хотите сохранить их себе — сначала нажмите «Скачать мою историю».')) return;
    const button = dialog.querySelector('[data-action="wipe-history"]');
    button.disabled = true;
    try {
      const response = await fetch(gameUrl('api/progress/history'), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('wipe_failed');
      say('account', 'Записи дневника удалены.');
      document.dispatchEvent(new CustomEvent('leela:history-wiped'));
    } catch (error) {
      say('account', 'Не удалось удалить историю. Попробуйте ещё раз.');
    } finally {
      button.disabled = false;
    }
  };

  dialog.querySelector('[data-action="close"]').onclick = () => dialog.close();

  function open() {
    if (current) {
      dialog.querySelector('[data-account-name]').textContent = current.nickname;
      view('account');
    } else {
      view('login');
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  async function refresh() {
    try {
      const result = await call('/me');
      publish(result.authenticated ? result : null);
    } catch (error) {
      available = false;
      publish(null);
    }
    return current;
  }

  function mount(button) {
    button.setAttribute('data-zk-account-button', '');
    button.onclick = open;
    publish(current);
  }

  document.head.append(style);
  document.body.append(dialog);

  window.ZakrivaAccount = {
    mount,
    open,
    refresh,
    subscribe(listener) { listeners.add(listener); listener(current, available); return () => listeners.delete(listener); },
    get current() { return current; },
    get available() { return available; },
  };
})();
