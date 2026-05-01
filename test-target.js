const express = require('express');
const app = express();
app.all('*', (req, res) => {
  console.log('Received path:', req.path);
  res.send('Path: ' + req.path);
});
app.listen(8001, () => console.log('Target on 8001'));
