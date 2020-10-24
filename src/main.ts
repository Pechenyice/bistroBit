import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import * as https from 'https'
import * as express from 'express'
import * as ws from 'ws'

import apiRouter from './apiRouter'
import defaultRouter from './defaultRouter'
import { GarantexApi } from './garantexApi'

dotenv.config();

const garantexApi = new GarantexApi();

const app = express();

app.use(express.static('content'));

app.use((req, res, next) => {
    if (req.hostname == process.env.API_HOSTNAME) {
        apiRouter(req, res, next);
    } else if (req.hostname == process.env.DEFAULT_HOSTNAME) {
        defaultRouter(req, res, next);
    } else {
        res.status(404).send('<h1>404 Not Found</h1>')
    }
});

if (fs.readdirSync(path.join(__filename, '..')).includes('key.pem')) {
    https.createServer({
        key: fs.readFileSync(path.join(__filename, '../key.pem')),
        cert: fs.readFileSync(path.join(__filename, '../chain.pem'))
    }, app).listen(443, () => {
        console.log('HTTPS Server enabled');
    });
}
app.listen(80);

const exchangeRatesWSServer = new ws.Server({noServer: true});

exchangeRatesWSServer.on('connection', (socket, req) => {
    socket.send(JSON.stringify({
        data: 'You\'ve connected to exchange rate\'s server'
    }));
});

(async function updateExchangeRateWorker() {
    let rates;
    let message;
    try {
        // rates = await garantexApi.fetchExchangeRates();
        rates = {
            btc_rub: (Math.random() * 10000).toFixed(2),
            eth_rub: (Math.random() * 1000).toFixed(2),
            usdt_rub: (Math.random() * 100).toFixed(2)
        };
    } catch (e) {}

    if (rates) {
        message = JSON.stringify(rates);
    } else {
        message = JSON.stringify({
            errorMessage: 'Can\'t resolve exchange rates from garantex API'
        });
    }

    for (let client of exchangeRatesWSServer.clients) {
        client.send(message);
    }

    setTimeout(updateExchangeRateWorker, 3000);
})();

const wsServer = http.createServer();

wsServer.on('upgrade', (req, socket, head) => {
    if (req.url == '/exchangeRatesWSServer') {
        exchangeRatesWSServer.handleUpgrade(req, socket, head, (client) => {
            exchangeRatesWSServer.emit('connection', client, req);
        });
    }
});

wsServer.listen(3000)
