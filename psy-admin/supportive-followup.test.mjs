import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { answerQuestion, resolveWidgetPublicUrl } from './router.js';
import { routeWidgetQuestion } from './widget-contract.js';
import * as widgetContract from './widget-contract.js';
import { safetyIntents } from './intents.js';

const widgetSource = readFileSync(new URL('./psy-widget.js', import.meta.url), 'utf8');

const followUps = {
  answer: 'Что показать дальше: программу, расписание или помочь записаться?',
  curated: 'Что показать дальше: программу, расписание или помочь записаться?',
  offer: 'Что показать дальше: программу, расписание или помочь записаться?',
  unconfirmed: 'Что показать дальше: программу, расписание или помочь записаться?',
  fallback: 'Что показать дальше: программу, расписание или помочь записаться?',
  boundary: 'Что показать дальше: программу, расписание или помочь записаться?',
  crisis: 'Если опасность непосредственная, вы можете сейчас позвонить 112 или попросить человека рядом сделать это?',
};

test('router adds a neutral, actionable follow-up for each supported answer kind', () => {
  const cases = [
    ['Расскажите про Пилот-волну', 'answer'],
    ['Покажите афишу', 'curated'],
    ['Какие мероприятия ближайшие?', 'offer'],
    ['Сколько стоит психосоматика?', 'unconfirmed'],
    ['Какого цвета стены?', 'fallback'],
    ['К кому с тревогой?', 'boundary'],
    ['У меня мысли о самоубийстве', 'crisis'],
  ];

  for (const [question, kind] of cases) {
    const answer = answerQuestion(question);
    assert.equal(answer.kind, kind, question);
    assert.equal(answer.followUp, followUps[kind], question);
    if (kind !== 'crisis') assert.ok(answer.leadIn, question);
    assert.match(answer.followUp, /\?$/, `${question}: ответ должен приглашать к продолжению конкретным вопросом`);
  }
});

test('short continuation is answered directly without grading it as a good question', () => {
  for (const question of ['контакты', 'формат', 'способ записи']) {
    const answer = answerQuestion(question, { topic: 'next-published-event' });
    assert.equal(answer.leadIn, undefined, question);
    assert.doesNotMatch(`${answer.text} ${answer.followUp || ''}`, /Хороший вопрос/i, question);
  }

  for (const question of ['Расскажите про Пилот-волну', 'Какие мероприятия ближайшие?', 'К кому с тревогой?']) {
    const answer = answerQuestion(question);
    assert.doesNotMatch(`${answer.leadIn || ''} ${answer.text} ${answer.followUp || ''}`, /Хороший вопрос/i, question);
  }
});

test('specialist choice is support, safe boundary, next step and then a question', () => {
  const answer = answerQuestion('К кому с тревогой?');
  assert.ok(answer.leadIn, 'supportive opening is missing');
  assert.match(answer.text, /^Запрос, связанный с тревогой[^.]*\. Помощник не ставит диагноз[^.]*\. Начать можно/i);
  assert.doesNotMatch(`${answer.leadIn} ${answer.text}`, /Я не могу ответить по одному сообщению/i);
  assert.match(answer.text, /не обещает лечение/);
  assert.equal(answer.url, 'https://orion-center.ru/consultation');
  assert.match(answer.followUp, /помочь записаться/i);
  assert.match(answer.followUp, /\?$/);
});

test('all safety intents are service-first instead of first-person refusals', () => {
  assert.ok(safetyIntents.length > 0, 'safety intent fixture is empty');
  for (const intent of safetyIntents) {
    assert.doesNotMatch(intent.text, /^(?:Я|я) не (?:могу|буду|имею)|^По одному сообщению/, intent.id);
    assert.doesNotMatch(intent.text, /\b(?:Я|я) не (?:могу|буду|имею|ставлю|провожу)/, intent.id);
    assert.ok(intent.url && intent.linkText, `${intent.id}: concrete path is missing`);
    const routed = answerQuestion(intent.examples[0]);
    assert.equal(routed.kind, 'boundary', `${intent.id}: safety route changed`);
    assert.match(routed.followUp || '', /\?$/, `${intent.id}: final continuation question is missing`);
  }
});

test('safety rewrite preserves crisis, diagnosis, medication and card safeguards', () => {
  const byId = Object.fromEntries(safetyIntents.map((intent) => [intent.id, intent]));
  assert.match(byId.panic.text, /\b112\b/);
  assert.match(byId.diagnosis.text, /диагноз[^.]*не ставится|диагноз[^.]*специалист/i);
  assert.match(byId.medication.text, /препарат|дозиров|лекарств/i);
  assert.match(byId.medication.text, /медицин|врач/i);
  assert.match(byId['card-data'].text, /номер карты/);
  assert.match(byId['card-data'].text, /защитный код/);
  assert.match(byId['prompt-injection'].text, /не отключаются/);
  assert.match(byId['prompt-injection'].text, /диагноз/);
  assert.match(byId['prompt-injection'].text, /лечени/);
});

test('server fallback keeps the local follow-up and cannot replace it', () => {
  assert.equal(typeof widgetContract.normalizeAssistantResult, 'function');
  const fallback = routeWidgetQuestion('Совсем неподготовленный вопрос');
  const normalized = widgetContract.normalizeAssistantResult(
    {
      kind: 'route',
      text: 'Ответ сервера.',
      leadIn: 'Хороший вопрос!',
      followUp: 'Мне очень жаль, давайте поговорим?',
    },
    fallback,
  );
  assert.equal(normalized.text, 'Ответ сервера.');
  assert.equal(normalized.leadIn, fallback.leadIn);
  assert.equal(normalized.followUp, followUps.fallback);
});

test('unsafe server refusal falls back to local text and keeps relative sources for widget-host rendering', () => {
  const fallback = routeWidgetQuestion('Совсем неподготовленный вопрос');
  const relative = '/psy-admin/booking/?kind=seminar';
  const official = 'https://orion-center.ru/schedule#actual';
  const normalized = widgetContract.normalizeAssistantResult(
    {
      kind: 'route',
      text: 'Я не могу ответить по одному сообщению',
      sources: [
        { url: relative, label: 'Оставить заявку' },
        { url: official, label: 'Расписание' },
      ],
    },
    fallback,
  );

  assert.equal(normalized.text, fallback.text, 'unsafe server text must be replaced as a whole, not rewritten');
  assert.doesNotMatch(normalized.text, /Я не могу ответить по одному сообщению/i);
  assert.equal(normalized.leadIn, fallback.leadIn);
  assert.equal(normalized.followUp, fallback.followUp);
  assert.equal(normalized.sources[0].url, relative, 'relative URL must survive until render time');
  assert.equal(normalized.sources[1].url, official, 'official absolute URL must stay byte-identical');
  assert.equal(
    resolveWidgetPublicUrl(normalized.sources[0].url, 'https://aka-gst.ru/psy-admin/psy-widget.js?v=psy-widget-20260909-11'),
    'https://aka-gst.ru/psy-admin/booking/?kind=seminar',
  );
  assert.notEqual(
    resolveWidgetPublicUrl(normalized.sources[0].url, 'https://aka-gst.ru/psy-admin/psy-widget.js?v=psy-widget-20260909-11'),
    new URL(relative, 'https://orion-center.ru/').href,
  );
});

test('final spoken payload removes escape and Markdown junk without changing visible server text', () => {
  const visible = String.raw`Ответ **спокойно** \n backslash escape [продолжим?](/psy-admin/booking/?kind=seminar) \\`;
  const fallback = routeWidgetQuestion('Совсем неподготовленный вопрос');
  const normalized = widgetContract.normalizeAssistantResult({ kind: 'route', text: visible }, fallback);
  assert.equal(normalized.text, visible, 'visual response must remain semantically intact');
  assert.equal(normalized.spokenText, 'Ответ спокойно продолжим?');
  assert.doesNotMatch(normalized.spokenText, /backslash|escape|Markdown|[\\/`*_#[\]{}<>|~]/i);
});

test('final spoken payload removes named backspace or backslash and ASCII controls', () => {
  const controls = String.fromCharCode(0, 1, 8, 11, 14, 31, 127);
  const variants = [
    'Ответ backspace продолжим?',
    'Ответ backslash продолжим?',
    'Ответ бэкспейс продолжим?',
    'Ответ бекспейс продолжим?',
    'Ответ бэкслэш продолжим?',
    'Ответ бекслеш продолжим?',
    'Ответ обратный слэш продолжим?',
    'Ответ обратный слеш продолжим?',
    `Ответ ${controls} продолжим?`,
  ];
  for (const raw of variants) {
    const spoken = widgetContract.sanitizeSpokenText(raw);
    assert.equal(spoken, 'Ответ продолжим?', JSON.stringify(raw));
    assert.doesNotMatch(spoken, /backspace|backslash|бэкспейс|бекспейс|бэкслэш|бекслеш|обратный\s+сл[эе]ш|[\u0000-\u001f\u007f]/iu);
  }
});

test('FAQ, router and fallback never use the banned refusal or omit continuation', () => {
  const questions = [
    'Расскажите про Пилот-волну',
    'Покажите афишу',
    'Какие мероприятия ближайшие?',
    'Сколько стоит психосоматика?',
    'Какого цвета стены?',
    'Совсем неподготовленный вопрос',
    'К кому с тревогой?',
    'Какие таблетки принимать?',
  ];
  for (const question of questions) {
    const answer = answerQuestion(question);
    assert.doesNotMatch(`${answer.leadIn || ''} ${answer.text} ${answer.followUp || ''}`, /Я не могу ответить по одному сообщению/i, question);
    assert.match(answer.followUp || '', /\?$/, `${question}: нет финального приглашения продолжить`);
  }
});

test('widget renders lead-in, answer, links or CTA, then local follow-up', () => {
  const appendMessage = widgetSource.match(/function appendMessage\([\s\S]*?\n}\n\nfunction render/)?.[0] || '';
  const leadInAt = appendMessage.indexOf('data-supportive-lead-in');
  const titleAt = appendMessage.indexOf('if (answer.title)');
  const linksAt = appendMessage.indexOf('article.append(links)');
  const followUpAt = appendMessage.indexOf('data-supportive-followup');
  assert.ok(leadInAt >= 0, 'lead-in append point is missing');
  assert.ok(leadInAt < titleAt, 'lead-in must be appended before title and answer text');
  assert.ok(linksAt >= 0, 'links/CTA append point is missing');
  assert.ok(followUpAt > linksAt, 'follow-up must be appended after links/CTA');

  const event = routeWidgetQuestion('Какие мероприятия ближайшие?');
  assert.ok(event.sources.length > 0, 'event must exercise a source link');
  assert.ok(event.action, 'event must exercise a CTA');
});

test('crisis keeps 112 in the primary answer and current event TTS stays unchanged', () => {
  const crisis = answerQuestion('У меня мысли о самоубийстве');
  assert.match(crisis.text, /^Если есть непосредственная опасность[\s\S]*\b112\b/);
  assert.equal(crisis.followUp, followUps.crisis);
  assert.equal(crisis.leadIn, undefined);

  const event = routeWidgetQuestion('Какие мероприятия ближайшие?');
  assert.equal(
    event.spokenText,
    'Ближайшее опубликованное мероприятие — Теория и практика работы с измененными и экстремальными состояниями сознания.',
  );
  assert.doesNotMatch(event.spokenText, /Что уточнить дальше/);
});
