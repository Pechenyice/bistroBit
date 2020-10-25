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
        message = JSON.stringify({rates: rates});
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

enum SessionStatus {
    waitingCurrency,
    waitingRequisites,
    checkingBalance
}

interface IExcahgeSessionData {
    lastAction: number,
    currency: 'btc' | 'eth' | 'usdt',
    address: string,
    card: string,
    status: SessionStatus
    // status: 'waitingCurrency' | 'waitingRequisites' | 'checkingRequisites' | 'checkingBalance'
}
let exchangeSessions: Map<ws, IExcahgeSessionData> = new Map();

type anyObject = {
    [key: string]: string | number | boolean
};

function sendSocket(socket: ws, status: string, errorMessage?: string, data?: anyObject | string) {
    let dataToSend: {
        status: string,
        errorMessage?: string,
        data?: any
    } = { status };
    if (errorMessage) dataToSend.errorMessage = errorMessage;
    if (data) dataToSend.data = data;
    socket.send(JSON.stringify(dataToSend));
}

function goodbyeSocket(socket: ws, errorMessage?: string) {
    sendSocket(socket, 'goodbye', errorMessage || 'Goodbye');
    exchangeSessions.delete(socket);
    socket.terminate();
}

function failToSocket(socket: ws, errorMessage: string, data?: anyObject | string) {
    sendSocket(socket, 'fail', errorMessage || '', data || null);
}

function successToSocket(socket: ws, data: anyObject | string) {
    sendSocket(socket, 'success', null, data);
}

function testAddress(currency: 'btc' | 'eth' | 'usdt', address: string): boolean {
    /* TODO: This function has no implementation */
    return true;
}

function testCard(card: string): boolean {
    if (card.length != 16) return false;
    if (!(/^\d+$/).test(card)) return false;
    // if (card[0] != '4' && card[0] != '5') return false;
    /* TODO: No BIN codes checking here yet */
    return true;
}

/* TODO: Remove this function used for test */
async function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

exchangeProcessWSServer.on('connection', (socket, req) => {
    exchangeSessions.set(socket, {
        lastAction: Date.now(),
        currency: null,
        address: null,
        card: null,
        status: SessionStatus.waitingCurrency
    });

    socket.on('message', async (data) => {
        let parsedData: {
            action: 'setCurrency' | 'dropCurrency' | 'setRequisites',
            currency?: 'btc' | 'eth' | 'usdt',
            address?: string,
            card?: string
        } = null;
        try {
            let parsedData = JSON.parse(data.toString());
        } catch (e) {
            goodbyeSocket(socket, 'Can\'t parse data (Most likely, it is not JSON format)');
            return;
        }
        let sessionData = exchangeSessions.get(socket);

        if (!parsedData.action) {
            goodbyeSocket(socket, 'No "action" property in recieved data');
        } else if (parsedData.action == 'setCurrency') {
            let allowedCurrencies = ['btc', 'eth', 'usdt'];
            if (sessionData.status != SessionStatus.waitingCurrency) {
                goodbyeSocket(socket, 'Unexpected action (setCurrency)');
            } else if (!parsedData.currency) {
                goodbyeSocket(socket, 'No "currency" property on "setCurrency" action');
            } else if (!allowedCurrencies.includes(parsedData.currency)) {
                goodbyeSocket(socket, 'Not allowed currency on "setCurrency" action');
            } else {
                sessionData.currency = parsedData.currency;
                sessionData.status = SessionStatus.waitingRequisites;
            }
        } else if (parsedData.action == 'dropCurrency') {
            if (sessionData.status > SessionStatus.waitingRequisites) {
                goodbyeSocket(socket, 'Unexpected action (dropCurrency)');
            } else {
                sessionData.currency = null;
                sessionData.status = SessionStatus.waitingCurrency;
            }
        } else if (parsedData.action == 'setRequisites') {
            if (sessionData.status != SessionStatus.waitingRequisites) {
                goodbyeSocket(socket, 'Unexpected action (setRequisites)');
            } else if (!parsedData.address) {
                goodbyeSocket(socket, 'No "address" propery on "setRequisites" action');
            } else if (!parsedData.card) {
                goodbyeSocket(socket, 'No "card" propery on "setRequisites" action');
            } else if (!testAddress(parsedData.currency, parsedData.address)) {
                failToSocket(socket, 'Incorrect "address" on "setRequisites" action', {
                    showError: 'Указанный адрес недействителен'
                });
            } else if (!testCard(parsedData.card)) {
                failToSocket(socket, 'Incorrect "card" propery on "setRequisites" action', {
                    showError: 'Указанная карта недействительна'
                });
            } else {
                successToSocket(socket, {
                    completed: false,
                    newShowStatus: 'Ожидание платежа'
                });
                await delay(5000);
                let sum = Math.random().toFixed(6);
                let course = 990854.13;
                successToSocket(socket, {
                    completed: false,
                    newShowStatus: 'Поступил платёж на ' + sum + ' ' + sessionData.currency.toUpperCase()
                });
                await delay(3000);
                successToSocket(socket, {
                    completed: false,
                    newShowStatus: 'Произошёл обмен по курсу 1 ' + sessionData.currency.toUpperCase() + ' = 990845.13 р.'
                });
                await delay(3000);
                if (sessionData.card[15] != '4') {
                    successToSocket(socket, {
                        completed: true,
                        newShowStatus: 'Перевод на карту успешно выполнен. ' + sum + sessionData.currency.toUpperCase() + ' = ' + (parseFloat(sum) * course).toFixed(6) + ' р.'
                    });
                } else {
                    failToSocket(socket, 'Ошибка при совершении перевода', {
                        completed: true,
                        newShowStatus: 'Ошибка при совершении перевода'
                    });
                }
                goodbyeSocket(socket);
            }
        } else {
            goodbyeSocket(socket, 'Action ' + parsedData.action + ' does not exist' );
        }
    });
    socket.on('close', () => {
        exchangeSessions.delete(socket);
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
