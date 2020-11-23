import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as mysql from 'mysql2';
import * as express from 'express';
import * as ws from 'ws';

import apiRouter from './apiRouter';
import defaultRouter from './defaultRouter';
import GarantexApi from './garantexApi';
import * as database from './database';

/* Getting environment variables from .env file */
dotenv.config();

/* Wrapping code into the async function to have an opportunity
 * to update garantex api jwt token with "await" statement
 */
async function main() {

const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

/* TODO: Implement function database.init(db) */
// database.init(db);

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

async function calculateExchangeRate(market: 'btcrub' | 'ethrub' | 'usdtrub'): Promise<number> {
    let depth = await garantexApi.getDepth({ market: market });
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
let updateExchangeRateWorker = (() => {
    async function updateExchangeRateWorker() {
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
    }
    updateExchangeRateWorker();
    return updateExchangeRateWorker;
})();

const exchangeProcessWSServer = new ws.Server({noServer: true});

exchangeProcessWSServer.on('connection', async (socket) => {
    updateExchangeRateWorker();
    try {
        let gatewayTypes = await garantexApi.getGatewayTypes({
            currency: 'rub',
            direction: 'withdraw'
        });
        socket.send(JSON.stringify({
            availableWithdrawTypes: {
                sber: !!gatewayTypes.find((gt) => gt.id == 8),
                tinkoff: !!gatewayTypes.find((gt) => gt.id == 16),
                anyCard: !!gatewayTypes.find((gt) => gt.id == 37),
                cash: process.env.CASH_WITHDRAW_AVAILABLE ? true : false
            }
        }));
    } catch {}
});

enum SessionStatus {
    waitingCurrency,
    waitingRequisites,
    checkingBalance,
    serverWorking,
    failed,
    succeed,
    banned
};

interface IExchageSessionData {
    id: string,
    lastAction: number,
    currency: 'btc' | 'eth' | 'usdt',
    address: string,
    card: string,
    withdrawMethod: 'sber' | 'tinkoff' | 'anyCard' | 'cash',
    withdrawMethodFee: number,
    depositAddressId: number,
    depositAddress: string,
    depositAmount: string,
    orderId: number,
    exchanged: boolean,
    fundsReceived: string,
    withdrawId: number,
    withdrawSucceed: boolean,
    status: SessionStatus
};

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

function testCard(card: string): boolean {
    if (card.length != 16) return false;
    if (!(/^\d+$/).test(card)) return false;
    return true;
}

async function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function dropRequisites(sessionData: IExchageSessionData) {
    sessionData.address = null;
    sessionData.card = null;
    sessionData.withdrawMethod = null;
    sessionData.withdrawMethodFee = null;
    sessionData.depositAddressId = null;
    sessionData.depositAddress = null;
    sessionData.depositAmount = null;
    sessionData.orderId = null;
    sessionData.exchanged = false;
    sessionData.fundsReceived = null;
    sessionData.withdrawId = null;
    sessionData.withdrawSucceed = false;
}

exchangeProcessWSServer.on('connection', (socket, req) => {
    let sessionData: IExchageSessionData = {
        id: crypto.randomBytes(+process.env.SESSION_ID_BYTES_LENGTH).toString('hex').toUpperCase(),
        lastAction: Date.now(),
        currency: null,
        address: null,
        card: null,
        withdrawMethod: null,
        withdrawMethodFee: null,
        depositAddressId: null,
        depositAddress: null,
        depositAmount: null,
        orderId: null,
        exchanged: false,
        fundsReceived: null,
        withdrawId: null,
        withdrawSucceed: false,
        status: SessionStatus.waitingCurrency
    };
    exchangeSessions.set(socket, sessionData);
    database.addSessionDataState(db, sessionData);
    successToSocket(socket, {
        sessionId: sessionData.id
    });

    socket.on('message', async (data) => {
        let parsedData: {
            action: 'setCurrency' | 'dropCurrency' | 'setRequisites',
            currency?: 'btc' | 'eth' | 'usdt',
            address?: string,
            card?: string,
            withdrawMethod?: 'sber' | 'tinkoff' | 'anyCard' | 'cash'
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
            sessionData.status = SessionStatus.banned;
            database.addSessionDataState(db, sessionData);
        } else if (parsedData.action == 'setCurrency') {
            let allowedCurrencies = ['btc', 'eth', 'usdt'];
            if (sessionData.status != SessionStatus.waitingCurrency) {
                goodbyeSocket(socket, 'Unexpected action (setCurrency)');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (!parsedData.currency) {
                goodbyeSocket(socket, 'No "currency" property on "setCurrency" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (!allowedCurrencies.includes(parsedData.currency)) {
                goodbyeSocket(socket, 'Not allowed currency on "setCurrency" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else {
                sessionData.currency = parsedData.currency;
                sessionData.status = SessionStatus.waitingRequisites;
                database.addSessionDataState(db, sessionData);
            }
        } else if (parsedData.action == 'dropCurrency') {
            if (sessionData.status > SessionStatus.waitingRequisites) {
                goodbyeSocket(socket, 'Unexpected action (dropCurrency)');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else {
                sessionData.currency = null;
                sessionData.status = SessionStatus.waitingCurrency;
                database.addSessionDataState(db, sessionData);
            }
        } else if (parsedData.action == 'setRequisites') {
            if (sessionData.status != SessionStatus.waitingRequisites) {
                goodbyeSocket(socket, 'Unexpected action (setRequisites)');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (!parsedData.card) {
                goodbyeSocket(socket, 'No "card" propery on "setRequisites" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (parsedData.withdrawMethod) {
                goodbyeSocket(socket, 'No "withdrawMethod" on "setRequisites" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (!testCard(parsedData.card)) {
                goodbyeSocket(socket, 'Incorrect "card" on "setRequisites" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else {
                /* Checking availablity of selected withdraw type (sber, tinkoff, anyCard or cash */
                let gatewayTypes = await garantexApi.getGatewayTypes({
                    currency: 'rub',
                    direction: 'withdraw'
                });
                let availableWithdrawMethodsFees = {
                    sber: gatewayTypes.find((gt) => gt.id == 8),
                    tinkoff: gatewayTypes.find((gt) => gt.id == 16),
                    anyCard: gatewayTypes.find((gt) => gt.id == 37),
                    cash: process.env.CASH_WITHDRAW_AVAILABLE ? 0 : 1
                }
                if (!availableWithdrawMethodsFees[parsedData.withdrawMethod]) {
                    console.log('<ERROR> This withdrawMethod is not available');
                    failToSocket(socket, 'This withdrawMethod is not available', {
                        completed: true,
                        newShowStatus: 'К сожалению, выбранный метод для вывода недоступен'
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }

                successToSocket(socket, {
                    completed: false,
                    newShowStatus: 'Создаётся кошелёк для приёма платежа',
                });
                sessionData.card = parsedData.card;
                sessionData.withdrawMethod = parsedData.withdrawMethod;
                // Fee in gateway object looks like 0.02 instead of percents, so I multiplied it by 100
                sessionData.withdrawMethodFee = +availableWithdrawMethods[parsedData.withdrawMethod].fee * 100; 
                sessionData.status = SessionStatus.serverWorking;
                database.addSessionDataState(db, sessionData);
                
                /* Request to create additional deposit address.
                 * It takes a bit of time to be created. This is the reason of next attempts to get address
                 */
                try {
                    let depositAddress = await garantexApi.createAdditionalDepositAddress({ currency: sessionData.currency });
                    if (!depositAddress || !depositAddress.id) throw new Error();
                    sessionData.depositAddressId = depositAddress.id;
                    if (depositAddress.address) sessionData.depositAddress = depositAddress.address;
                    database.addSessionDataState(db, sessionData);
                } catch {
                    console.log('<ERROR> No id field in resonse from additionalDepositAddress');
                    failToSocket(socket, 'No id field in response from additionalDepositAddress', {
                        completed: true,
                        newShowStatus: 'Произошла ошибка (#1) во время создания кошелька для приёма платежа'
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }

                /* 10 Attempts to get deposit address if was not ready on creating */
                if (!sessionData.depositAddress) {
                    for (let attempt = 0; attempt < 10; attempt++) {
                        console.log('Attempt to get deposit address #' + attempt);
                        try {
                            let depositAddressDetails = await garantexApi.getDepositAddressDetails({ id: sessionData.depositAddressId });
                            if (depositAddressDetails && depositAddressDetails.address) {
                                sessionData.depositAddress = depositAddressDetails.address;
                                break;
                            }
                        } catch {}
                        await delay(3000);
                    }
                }

                if (!sessionData.depositAddress) {
                    console.log('<ERROR> Failed to get deposit address');
                    failToSocket(socket, 'Failed to get deposit address', {
                        completed: true,
                        newShowStatus: 'Произошла ошибка (#2) во время создания кошелька для приёма платежа'
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                } 

                successToSocket(socket, {
                    completed: false,
                    newShowStatus: 'Ожидание платежа',
                    depositAddress: sessionData.depositAddress
                });
                database.addSessionDataState(db, sessionData);
                
                /* 60 Attempts with delay in 10 seconds to wait for user deposit */
                for (let attempt = 0; attempt < 60; attempt++) {
                    console.log('Waiting user deposit #' + attempt);
                    try {
                        let deposits = await garantexApi.getDeposits({
                            currency: sessionData.currency,
                            limit: 20
                        });
                        for (let deposit of deposits) {
                            if (deposit.address == sessionData.depositAddress) {
                                sessionData.depositAmount = deposit.amount || null;
                                console.log(sessionData);
                                break;
                            }
                        }
                        if (sessionData.depositAmount) break;
                    } catch {}
                    await delay(10000);
                }

                if (!sessionData.depositAmount) {
                    console.log('Did not get deposit in 10+ minutes');
                    failToSocket(socket, 'Did not get deposit in 10+ minutes', {
                        completed: true,
                        newShowStatus: 'Время ожидания перевода истекло'
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }

                database.addSessionDataState(db, sessionData);

                /* Place an order for exchange currency */
                enum markets {
                    btc = 'btcrub',
                    eth = 'ethrub',
                    usdt = 'usdtrub'
                };
                let market = markets[sessionData.currency];
                try {
                    let order = await garantexApi.createNewOrder({
                        market: market,
                        volume: sessionData.depositAmount,
                        side: 'sell'
                    });
                    if (!order || !order.id) throw new Error();
                    sessionData.orderId = order.id;
                    database.addSessionDataState(db, sessionData);
                } catch {
                    console.log('Error while placing exchange order');
                    failToSocket(socket, 'Error while placing exchange order', {
                        completed: true,
                        newShowStatus: 'Произошла ошибка (#3) во время обмена валюты'
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }

                successToSocket(socket, {
                    completed: false,
                    newShowStatus:
                        `Поступил платёж на сумму: ` +
                        `${sessionData.depositAmount} ${sessionData.currency.toUpperCase()}. ` +
                        `Ожидаем обмена валюты`
                });

                /* Waiting for exchange */
                let orderInfo;
                for (let attempt = 0; attempt < 30; attempt++) {
                    console.log('Waiting for exchange #' + attempt);
                    try {
                        orderInfo = await garantexApi.getOrder({
                            id: sessionData.orderId
                        });
                        if (orderInfo && orderInfo.state == 'done') {
                            sessionData.exchanged = true;
                            sessionData.fundsReceived = orderInfo.funds_received;
                            break;
                        }
                    } catch {}
                    await delay(7000);
                }

                if (!sessionData.exchanged || !sessionData.fundsReceived) {
                    console.log('Not exchanged');
                    failToSocket(socket, 'Not exchanged', {
                        completed: true,
                        newShowStatus: 'Не удалось совершить обмен'
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }

                /* TODO: Implement course calculations with withdraw fee*/
                successToSocket(socket, {
                    completed: false,
                    newShowStatus:
                        `Произошёл обмен по курсу ` +
                        `1 ${sessionData.currency.toUpperCase()} = ${+sessionData.fundsReceived / +sessionData.depositAmount} р.`
                });
                database.addSessionDataState(db, sessionData);
                
                try {
                    let withdrawData = await garantexApi.createWithdraw({
                        currency: 'rub',
                        amount: sessionData.fundsReceived,
                        rid: sessionData.card,
                        gateway_type_id:
                            sessionData.withdrawMethod == 'sber'    ? 8 :
                            sessionData.withdrawMethod == 'tinkoff' ? 16 :
                            sessionData.withdrawMethod == 'anyCard' ? 37 : 0 // 0 Is cash
                    });
                    sessionData.withdrawId = withdrawData.id;
                    database.addSessionDataState(db, sessionData);
                } catch {
                    console.log('<ERROR> Could not createWithdraw');
                    failToSocket(socket, 'Could not createWithdraw', {
                        completed: true,
                        newShowStatus: false
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                }

                /* Waiting withdraw to be completed */
                for (let attempt = 0; attempt < 30; attempt++) {
                    /* TODO: Not implemented yet */
                    try {
                        let withdraws = await garantexApi.getWithdraws({
                            limit: 50
                        });
                        for (let withdraw of withdraws) {
                            if (withdraw.id == sessionData.withdrawId) {
                                if (withdraw.state == 'succeed') {
                                    sessionData.withdrawSucceed = true;
                                    break;
                                }
                            }
                        }
                    } catch {}
                    await delay(10000);
                }

                if (!sessionData.withdrawSucceed) {
                    successToSocket(socket, {
                        completed: true,
                        newShowStatus:
                            `Перевод средств на карту скоро будет завершён. ` +
                            `Вы обменяли ${sessionData.depositAmount} ${sessionData.currency.toUpperCase()} на ${sessionData.fundsReceived} р.`
                    });
                    sessionData.status = SessionStatus.succeed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }
                
                successToSocket(socket, {
                    completed: true,
                    newShowStatus:
                        `Обмен успешно завершён. ` +
                        `${sessionData.depositAmount} ${sessionData.currency.toUpperCase()} = ${sessionData.fundsReceived} р.`
                });
                sessionData.status = SessionStatus.succeed;
                database.addSessionDataState(db, sessionData);

                exchangeSessions.delete(socket);
            }
        } else if (parsedData.action == 'dropRequisites') {
            if (sessionData.status != SessionStatus.failed)  {
                goodbyeSocket(socket, 'Unexpected action (dropRequisites)');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else {
                dropRequisites(sessionData);
                sessionData.status = SessionStatus.waitingRequisites;
                database.addSessionDataState(db, sessionData);
            }
        } else {
            goodbyeSocket(socket, `Action "${parsedData.action}" does not exist`);
            sessionData.status = SessionStatus.banned;
            database.addSessionDataState(db, sessionData);
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

}

main();
