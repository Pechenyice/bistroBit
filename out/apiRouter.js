"use strict";
exports.__esModule = true;
var express = require("express");
var apiRouter = express.Router();
apiRouter.get('/', function (req, res) {
    res.send('This is api');
});
exports["default"] = apiRouter;
