/*
 * Обезличенный счётчик прохождения.
 *
 * Тот же Umami, что уже стоит на главной сайта: без кук, без профилей, без
 * идентификаторов человека. Отправляется только то, что нужно, чтобы понять,
 * где люди застревают: какой урок, какая задача, какая ошибка Python.
 *
 * Ни кода ученика, ни его ника, ни почты сюда не попадает. Если счётчик
 * заблокирован расширением или не загрузился — все вызовы просто ничего
 * не делают, на уроки это не влияет.
 */

function send(event, data) {
  try {
    if (typeof window.umami?.track === 'function') window.umami.track(event, data);
  } catch (_) { /* счётчик не должен ломать урок */ }
}

export const track = {
  lessonOpened(lesson) {
    send('lesson-open', { lesson: lesson.id, tier: lesson.tier, kind: lesson.kind });
  },

  /** Главное число: сколько людей доходит до каждого урока и с какой попытки. */
  taskSolved(lesson, task, { firstTry }) {
    send('task-solved', { lesson: lesson.id, task: task.id, tier: lesson.tier, firstTry });
  },

  /** Тип ошибки важнее факта ошибки: по нему видно, обо что именно спотыкаются. */
  taskFailed(lesson, task, result) {
    send('task-failed', {
      lesson: lesson.id,
      task: task.id,
      error: result.error ? result.error.type : 'checks-failed',
    });
  },

  /** Прямая обратная связь: человек сам говорит, где ему непонятно. */
  stuck(lesson, task) {
    send('stuck', { lesson: lesson.id, task: task.id, tier: lesson.tier });
  },

  pythonReady(source) {
    send('python-ready', { source });
  },
};
