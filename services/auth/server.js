const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth' }));
app.post('/login', (req, res) => res.json({ token: 'fake-jwt-token', service: 'auth' }));

app.listen(PORT, () => console.log(`Auth service listening on ${PORT}`));