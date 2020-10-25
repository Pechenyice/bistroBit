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
        message = JSON.stringify({data: rates});
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

const exchangeProcessWSServer = new ws.Server({noServer: true});

interface IExcahgeSessionData {
    currency: 'btc' | 'eth' | 'usdt',
    address: string,
    card: string,
    status: 'waitingCurrency' | 'waitingRequisites' | 'checkingRequisites' | 'checkingBalance'
}
let exchangeSessions: Map<ws, IExcahgeSessionData> = new Map();

exchangeProcessWSServer.on('connection', (socket, req) => {
    exchangeSessions.set(socket, {
        currency: null,
        address: null,
        card: null,
        status: null
    });
    let d: ws.Data;
    socket.on('message', (data) => {
        let parsedData: {
            action: 'setCurrency' | 'dropCurrency'
        } = null;
        try {
            let parsedData = JSON.parse(data.toString());
        } catch (e) {
            let hz = socket.send(JSON.stringify({
                errorMessage: 'Goodbye'
            }));
            exchangeSessions.delete(socket);
            socket.terminate();
            return;
        }

        if (parsedData.action == 'setCurrency') {
            
        } else if (parsedData.action == 'dropCurrency') {
            
        } else {
            socket.send(JSON.stringify({
                errorMessage: 'Goodbye'
            }));
            exchangeSessions.delete(socket);
            socket.terminate();
            return;
        }

    });
    socket.on('close', () => {
        exchangeSessions.delete(socket)
    });
});

const wsServer = http.createServer();

wsServer.on('upgrade', (req, socket, head) => {
    if (req.url == '/exchangeRatesWSServer') {
        exchangeRatesWSServer.handleUpgrade(req, socket, head, (socket) => {
            exchangeRatesWSServer.emit('connection', socket, req);
        });
    } else if (req.url == '/exchangeProcessWSServer') {
        exchangeProcessWSServer.handleUpgrade(req, socket, head, (socket) => {
            exchangeProcessWSServer.emit('connection', socket, req);
        });
    }
});

wsServer.listen(3000);
