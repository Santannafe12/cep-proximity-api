process.env.AWESOME_API_KEY = 'fixture';
// Read once, when the app module loads. One allowed call lets the suite cross the limit.
process.env.INBOUND_RATE_LIMIT_MAX = '1';
process.env.INBOUND_RATE_LIMIT_WINDOW_MS = '60000';
