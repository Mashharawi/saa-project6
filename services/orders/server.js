const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'orders' }));
app.get('/orders', (req, res) => res.json({ orders: [{ id: 1, item: 'Widget' }], service: 'orders' }));

app.listen(PORT, () => console.log(`Orders service listening on ${PORT}`));