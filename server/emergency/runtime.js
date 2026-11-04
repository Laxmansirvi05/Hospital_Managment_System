import { getConfig } from '../config.js';
import { getStore } from '../db/index.js';
import { createEmergencyService } from './service.js';
import { createMapboxAdapter } from '../integrations/mapbox.js';
import { createSmsAdapter } from '../integrations/sms.js';

export function getEmergencyService() {
  const config = getConfig();
  return createEmergencyService({ store: getStore(), eta: config.store === 'memory' ? undefined : createMapboxAdapter({ token: config.mapboxToken }),
    sms: createSmsAdapter({ config: config.twilio, sampleMode: config.store === 'memory' }) });
}
