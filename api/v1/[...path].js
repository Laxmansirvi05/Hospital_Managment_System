// The only serverless entry point. Every /api/v1 route is registered in server/app.js.
import { createApp } from '../../server/app.js';

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
