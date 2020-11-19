import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import * as https from 'https'
import * as express from 'express'
import * as ws from 'ws'

import apiRouter from './apiRouter'
import defaultRouter from './defaultRouter'
import GarantexApi from './garantexApi'

/* Getting environment variables from .env file */
dotenv.config();

/* Wrapping code into the async function to have an opportunity
 * to update garantex api jwt token with "await" statement
 */
async function main() {

const garantexApi = new GarantexApi(process.env.GARANTEX_API_UID, {
    publicKey: process.env.GARANTEX_PUBLIC_KEY,
    privateKey: process.env.GARANTEX_PRIVATE_KEY
}, false);

await garantexApi.updateJwt();

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

async function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function calculateExchangeRate(market: 'btcrub' | 'ethrub' | 'usdtrub'): Promise<number> {
    let depth = await garantexApi.depth({ market: market });
    if (!depth.bids) throw depth;
    else {
        let totalVolume = 0;
        let totalPrice = 0;
        let admittedBidsCount = 0;
        for (let bid of depth.bids) {
            totalVolume += parseFloat(bid.volume);
            totalPrice += parseFloat(bid.price);
            ++admittedBidsCount;
            if (totalVolume >= 20) break;
        }
        let exchangeRate = totalPrice / admittedBidsCount;
        return exchangeRate;
    }
}

/**
 * Sending updated information about exchange rates to websocket clients
 */
(async function updateExchangeRateWorker() {
    /* If no clients on websocket server - don't work */
    if (exchangeRatesWSServer.clients.size) {
        let rates;
        let message;
        /* Placed here this console.log because once I got error
         * that crashed process while request to /depth api endpoint
         */
        console.log('Trying to get rates');
        try {
            let btcrubExchangeRate = calculateExchangeRate('btcrub');
            let ethrubExchangeRate = calculateExchangeRate('ethrub');
            let usdtrubExchangeRate = calculateExchangeRate('usdtrub');
            rates = {
                btc_rub: await btcrubExchangeRate,
                eth_rub: await ethrubExchangeRate,
                usdt_rub: await usdtrubExchangeRate
            };
        } catch {}

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
    }

    /* Repeat sending data after specified time */
    setTimeout(updateExchangeRateWorker, parseInt(process.env.UPDATE_EXCHANGE_RATES_INTERVAL) * 1000 || 10000);
})();

const exchangeProcessWSServer = new ws.Server({noServer: true});

enum SessionStatus {
    waitingCurrency,
    waitingRequisites,
    checkingBalance,
    serverWorking,
    failed
};

interface IExchageSessionData {
    lastAction: number,
    currency: 'btc' | 'eth' | 'usdt',
    address: string,
    card: string,
    depositAddressId: number,
    depositAddress: string,
    status: SessionStatus
    // status: 'waitingCurrency' | 'waitingRequisites' | 'checkingRequisites' | 'checkingBalance'
}
let exchangeSessions: Map<ws, IExchageSessionData> = new Map();

type anyObject = {
    [key: string]: string | number | boolean | anyObject
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
        depositAddressId: null,
        depositAddress: null,
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
            parsedData = JSON.parse(data.toString());
        } catch (e) {
            goodbyeSocket(socket, 'Can\'t parse data (Most likely, it is not JSON format)');
            return;
        }
        let sessionData = exchangeSessions.get(socket);
        
        console.log(parsedData);
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
            // } else if (!parsedData.address) {
            //     goodbyeSocket(socket, 'No "address" propery on "setRequisites" action');
            } else if (!parsedData.card) {
                goodbyeSocket(socket, 'No "card" propery on "setRequisites" action');
            // } else if (!testAddress(parsedData.currency, parsedData.address)) {
            //     goodbyeSocket(socket, 'Incorrect "address" on "setRequisites" action');
            } else if (!testCard(parsedData.card)) {
                goodbyeSocket(socket, 'Incorrect "card" on "setRequisites" action');
            } else {
                // sessionData.address = parsedData.address;
                successToSocket(socket, {
                    completed: false,
                    newShowStatus: 'Создание кошелька для приёма платежа',
                });
                sessionData.card = parsedData.card;
                sessionData.status = SessionStatus.serverWorking;

                let depositAddress = await garantexApi.additionalDepositAddress({ currency: sessionData.currency });
                if (!depositAddress.id) {
                    failToSocket(socket, 'No id field in response from additionalDepositAddress', {
                        completed: true,
                        newShowStatus: 'Произошла ошибка во время создания кошелька для приёма платежа'
                    });
                } else {
                    sessionData.depositAddressId = depositAddress.id;
                    
                    /* 10 Attempts to get deposit address */
                    for (let i = 0; i < 10; i++) {
                        let { address } = await garantexApi.depositAddressDetails({ id: sessionData.depositAddressId });
                        if (address) {
                            sessionData.depositAddress = address;
                            break;
                        }
                        await wait(1000);
                    }

                    if (!sessionData.depositAddress) {
                        failToSocket(socket, 'Failed to get deposit address', {
                            completed: true,
                            newShowStatus: 'Произошла ошибка во время создания кошелька для приёма платежа'
                        });
                    } else {
                        successToSocket(socket, {
                            completed: false,
                            newShowStatus: 'Ожидание платежа',
                            depositAddress: sessionData.depositAddress
                        });
                    }
                }
                // await delay(5000);
                // let sum = Math.random().toFixed(6);
                // let course = 990854.13;
                // successToSocket(socket, {
                //     completed: false,
                //     newShowStatus: 'Поступил платёж на ' + sum + ' ' + sessionData.currency.toUpperCase()
                // });
                // await delay(3000);
                // successToSocket(socket, {
                //     completed: false,
                //     newShowStatus: 'Произошёл обмен по курсу 1 ' + sessionData.currency.toUpperCase() + ' = 990845.13 р.'
                // });
                // await delay(3000);
                // if (sessionData.card[15] != '4') {
                //     successToSocket(socket, {
                //         completed: true,
                //         newShowStatus: 'Перевод на карту успешно выполнен. ' + sum + sessionData.currency.toUpperCase() + ' = ' + (parseFloat(sum) * course).toFixed(6) + ' р.'
                //     });
                //     exchangeSessions.delete(socket);
                //     socket.terminate();
                // } else {
                //     failToSocket(socket, 'Error during transaction', {
                //         completed: true,
                //         newShowStatus: 'Ошибка при совершении перевода'
                //     });
                //     sessionData.status = SessionStatus.failed;
                // }
            }
        } else if (parsedData.action == 'dropRequisites') {
            if (sessionData.status != SessionStatus.failed)  {
                goodbyeSocket(socket, 'Unexpected action (dropRequisites)');
            } else {
                sessionData.address = null;
                sessionData.card = null;
                sessionData.status = SessionStatus.waitingRequisites;
            }
        } else {
            goodbyeSocket(socket, 'Action ' + parsedData.action + ' does not exist' );
        }
    });
    socket.on('close', () => {
        console.log('fuck you lether man');
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

}

main();
