"use strict";
exports.__esModule = true;
var express = require("express");
var path = require("path");
var defaultRouter = express.Router();
defaultRouter.use(express.static(path.join(__dirname, 'content')));
exports["default"] = defaultRouter;
