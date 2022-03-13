const path = require("path");
const express = require("express");
const cookieParser = require('cookie-parser');
const app = express(); // create express app

// app.use(cookieParser);

app.get("/api/memories", (req, res) => {
    console.log(req.header('Cookie'))
})

// add middlewares
app.use(express.static(path.join(__dirname, "..", "build")));
app.use(express.static("public"));

app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, "..", "build", "index.html"));
});

// start express server on port 5000
app.listen(80, () => {
    console.log("server started on port 5000");
});
