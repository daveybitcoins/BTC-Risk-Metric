const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// A simple route that responds to requests at the root URL
app.get('/', (req, res) => {
    res.send('Hello from your new Node.js Web App!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
