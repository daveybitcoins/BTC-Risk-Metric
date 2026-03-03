const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// This tells Express to serve your index.html and any other static files (like data.csv) in this folder
app.use(express.static(path.join(__dirname)));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});