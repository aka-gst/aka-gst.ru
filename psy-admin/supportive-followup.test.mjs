import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { answerQuestion } from './router.js';
import { routeWidgetQuestion } from './widget-contract.js';
import * as widgetContract from './widget-contract.js';

const widgetSource = readFileSync(new URL('./psy-widget.js', import.meta.url), 'utf8');

const followUps = {
  answer: 'Что уточнить дальше: содержание программы, формат участия или контакты?',
  curated: 'Что показать дальше: программу, расписание или контакты?',
  offer: 'Что уточнить дальше: формат, программу или способ записи?',
  unconfirmed: 'Что открыть дальше: официальные контакты или другие программы центра?',
  fallback: 'Что вас интересует: консультации, мероприятия, обучение или аренда?',
  boundary: 'Что показать дальше: профили специалистов или официальные контакты центра?',
  crisis: 'Если опасность непосредственная, вы можете сейчас позвонить 112 или попросить человека рядом сделать это?',
};

const leadIns = {
  answer: 'Хороший вопрос — вот что удалось подтвердить по материалам центра.',
  curated: 'Хороший вопрос — вот подтверждённая информация центра.',
  offer: 'Интерес к актуальным возможностям понятен — вот что сейчас подтверждено.',
  unconfirmed: 'Здесь особенно важно сверить актуальные данные.',
  fallback: 'Давайте уточним тему — так получится найти нужный раздел.',
  boundary: 'Здесь особенно важно дать безопасный и точный ориентир.',
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
    assert.equal(answer.leadIn, leadIns[kind], question);
  }
});

test('anxiety answer starts with a useful route and keeps explicit medical boundaries', () => {
  const answer = answerQuestion('К кому с тревогой?');
  assert.equal(
    answer.text,
    'Для запроса, связанного с тревогой, можно посмотреть направления работы психологов и уточнить у администратора, кто принимает с такими обращениями. Помощник не ставит диагноз, не выбирает специалиста по одному сообщению и не обещает лечение.',
  );
  assert.doesNotMatch(answer.text, /^Я не могу|только по одному сообщению/i);
  assert.match(answer.text, /не ставит диагноз/);
  assert.match(answer.text, /не обещает лечение/);
  assert.equal(answer.url, 'https://orion-center.ru/consultation');
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
  assert.equal(normalized.leadIn, leadIns.fallback);
  assert.equal(normalized.followUp, followUps.fallback);
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
    'Ближайшее опубликованное мероприятие — «Теория и практика работы с измененными и экстремальными состояниями сознания».',
  );
  assert.doesNotMatch(event.spokenText, /Что уточнить дальше/);
});
