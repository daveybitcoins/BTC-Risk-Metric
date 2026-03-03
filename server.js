const express = require('express');
<<<<<<< HEAD
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// This tells Express to serve your index.html and any other static files (like data.csv) in this folder
app.use(express.static(path.join(__dirname)));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});
=======
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
>>>>>>> 8a049eefc1a6a78ec05036b1386ecd5a66572d6c
