"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
exports.__esModule = true;
var dotenv = require("dotenv");
var fs = require("fs");
var path = require("path");
var http = require("http");
var https = require("https");
var express = require("express");
var ws = require("ws");
var apiRouter_1 = require("./apiRouter");
var defaultRouter_1 = require("./defaultRouter");
var garantexApi_1 = require("./garantexApi");
dotenv.config();
var garantexApi = new garantexApi_1.GarantexApi();
var app = express();
app.use(express.static('content'));
app.use(function (req, res, next) {
    if (req.hostname == process.env.API_HOSTNAME) {
        apiRouter_1["default"](req, res, next);
    }
    else if (req.hostname == process.env.DEFAULT_HOSTNAME) {
        defaultRouter_1["default"](req, res, next);
    }
    else {
        res.status(404).send('<h1>404 Not Found</h1>');
    }
});
if (fs.readdirSync(path.join(__filename, '..')).includes('key.pem')) {
    https.createServer({
        key: fs.readFileSync(path.join(__filename, '../key.pem')),
        cert: fs.readFileSync(path.join(__filename, '../chain.pem'))
    }, app).listen(443, function () {
        console.log('HTTPS Server enabled');
    });
}
app.listen(80);
var exchangeRatesWSServer = new ws.Server({ noServer: true });
exchangeRatesWSServer.on('connection', function (socket, req) {
    socket.send(JSON.stringify({
        data: 'You\'ve connected to exchange rate\'s server'
    }));
});
(function updateExchangeRateWorker() {
    return __awaiter(this, void 0, void 0, function () {
        var rates, message, _a, _b, client;
        var e_1, _c;
        return __generator(this, function (_d) {
            try {
                // rates = await garantexApi.fetchExchangeRates();
                rates = {
                    btc_rub: (Math.random() * 10000).toFixed(2),
                    eth_rub: (Math.random() * 1000).toFixed(2),
                    usdt_rub: (Math.random() * 100).toFixed(2)
                };
            }
            catch (e) { }
            if (rates) {
                message = JSON.stringify({ data: rates });
            }
            else {
                message = JSON.stringify({
                    errorMessage: 'Can\'t resolve exchange rates from garantex API'
                });
            }
            try {
                for (_a = __values(exchangeRatesWSServer.clients), _b = _a.next(); !_b.done; _b = _a.next()) {
                    client = _b.value;
                    client.send(message);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a["return"])) _c.call(_a);
                }
                finally { if (e_1) throw e_1.error; }
            }
            setTimeout(updateExchangeRateWorker, 3000);
            return [2 /*return*/];
        });
    });
})();
var exchangeProcessWSServer = new ws.Server({ noServer: true });
var exchangeSessions = new Map();
exchangeProcessWSServer.on('connection', function (socket, req) {
    exchangeSessions.set(socket, {});
    var d;
    socket.on('message', function (data) {
        var parsedData;
        try {
            var parsedData_1 = JSON.parse(data.toString());
        }
        catch (e) {
            exchangeSessions["delete"](socket);
            socket.terminate();
            return;
        }
    });
});
var wsServer = http.createServer();
wsServer.on('upgrade', function (req, socket, head) {
    if (req.url == '/exchangeRatesWSServer') {
        exchangeRatesWSServer.handleUpgrade(req, socket, head, function (socket) {
            exchangeRatesWSServer.emit('connection', socket, req);
        });
    }
    else if (req.url == '/exchangeProcessWSServer') {
        exchangeProcessWSServer.handleUpgrade(req, socket, head, function (socket) {
            exchangeProcessWSServer.emit('connection', socket, req);
        });
    }
});
wsServer.listen(3000);
