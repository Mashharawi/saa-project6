const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notifications' }));
app.post('/notify', (req, res) => res.json({ sent: true, service: 'notifications' }));

app.listen(PORT, () => console.log(`Notifications service listening on ${PORT}`));