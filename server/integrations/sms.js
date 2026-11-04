const demoNotice = 'Demo: no real ambulance is sent.';

export function createFakeSmsAdapter() {
  const sent = [];
  return { sent,
    async sendTracking({ to, trackingUrl }) {
      const message = `CareRoute demo tracking link: ${trackingUrl} ${demoNotice}`;
      if (/cardiac|accident|breathing|stroke|pregnancy|medical|patient|diagnosis/i.test(message)) throw new Error('SMS template contains restricted content');
      sent.push({ to, trackingUrl, message });
      return { accepted: true, fake: true };
    },
  };
}

/** Twilio REST adapter. It exposes only a safe failure and never logs request details. */
export function createSmsAdapter({ config, fetchImpl = fetch, sampleMode = false } = {}) {
  if (sampleMode) return createFakeSmsAdapter();
  if (!config) return { async sendTracking() { throw new Error('SMS is not configured'); } };
  return {
    async sendTracking({ to, trackingUrl }) {
      if (!config.accountSid || !config.authToken || !config.from) throw new Error('SMS provider is not configured');
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
      const body = new URLSearchParams({ To: to, From: config.from, Body: `CareRoute demo tracking link: ${trackingUrl} ${demoNotice}` });
      try {
        const response = await fetchImpl(endpoint, { method: 'POST', headers: { authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(5_000) });
        if (!response.ok) throw new Error('SMS provider rejected the message');
        return { accepted: true, fake: false };
      } catch (error) {
        if (error?.message === 'SMS provider rejected the message') throw error;
        throw new Error('SMS provider request failed');
      }
    },
  };
}
