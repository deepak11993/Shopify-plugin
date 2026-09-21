const crypto = require('crypto');

const payload = $json;
const apiKey = $env.SHOPIFY_PUBLISHER_API_KEY;
const secret = $env.SHOPIFY_PUBLISHER_SIGNING_SECRET;
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', secret).update(timestamp).update('.').update(body).digest('hex');

return [{ json: { body, headers: { 'content-type': 'application/json', 'x-publisher-key': apiKey, 'x-timestamp': timestamp, 'x-signature': signature } } }];
