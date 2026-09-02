'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const {
  sendLogisticNotifyEmail,
} = require('../utils/sendLogisticNotifyEmail');

function parseTime(timeStr) {
  const raw = String(timeStr || '00:00:00');
  const [h, min] = raw.split(':');
  const hours = parseInt(h, 10);
  const minutes = parseInt(min || '0', 10);
  return {
    hours: Number.isNaN(hours) ? 0 : hours,
    minutes: Number.isNaN(minutes) ? 0 : minutes,
  };
}

function toMinutes({ hours, minutes }) {
  return hours * 60 + minutes;
}

function parisHoursMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(
    parts.find((p) => p.type === 'minute')?.value || '0',
    10
  );
  return {
    hours: Number.isNaN(hour) ? 0 : hour,
    minutes: Number.isNaN(minute) ? 0 : minute,
  };
}

function formatParisTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(date);
}

function isWithinWorkingHours(nowMinutes, workingFrom, workingTo) {
  const fromMinutes = toMinutes(parseTime(workingFrom));
  const toMinutesValue = toMinutes(parseTime(workingTo));

  if (fromMinutes <= toMinutesValue) {
    return nowMinutes >= fromMinutes && nowMinutes <= toMinutesValue;
  }

  return nowMinutes >= fromMinutes || nowMinutes <= toMinutesValue;
}

async function findOnDutyLogistics(strapi, now) {
  const nowTime = parisHoursMinutes(now);
  const nowMinutes = toMinutes(nowTime);

  const logistics = await strapi.db.query('api::logistic.logistic').findMany({
    where: {
      publishedAt: { $notNull: true },
    },
  });

  return logistics.filter((person) =>
    isWithinWorkingHours(nowMinutes, person.workingFrom, person.workingTo)
  );
}

async function notifyOnDutyLogistics(strapi, { labelCount, locale = 'en' } = {}) {
  const now = new Date();
  const onDuty = await findOnDutyLogistics(strapi, now);
  const time = formatParisTime(now);
  const labelCountStr = String(labelCount);

  const notified = [];

  for (const person of onDuty) {
    if (!person.email) continue;

    const sent = await sendLogisticNotifyEmail(strapi, {
      to: person.email,
      name: person.name || '',
      labelCount: labelCountStr,
      time,
      locale,
    });

    if (sent) {
      notified.push({
        name: person.name,
        email: person.email,
      });
    }
  }

  return {
    labelCount,
    currentTime: time,
    onDutyCount: onDuty.length,
    notified,
  };
}

module.exports = createCoreService('api::logistic.logistic', () => ({
  findOnDutyLogistics,
  notifyOnDutyLogistics,
}));
