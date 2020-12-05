import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as mysql from 'mysql2';
import * as express from 'express';
import * as ws from 'ws';
import * as fetch from 'node-fetch';

import defaultRouter from './defaultRouter';
import GarantexApi from './garantexApi';
import * as database from './database';

async function bintableTest(bin: string) {
    let response = await fetch(`https://api.bintable.com/v1/${bin}?api_key=${process.env.BINTABLE_API_KEY}`);
    try {
        let text = await response.text();
        console.log(text);
        return JSON.parse(text);
    } catch (e) {
        console.log(e);
        return null;
    }
}

/* Getting environment variables from .env file */
dotenv.config();

/* Wrapping code into the async function to have an opportunity
 * to update garantex api jwt token ant initialize database with "await" statement
 */
async function main() {

const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

await database.init(db);

// console.log(await database.getSessionDataStates(db, '306D'));

const garantexApi = new GarantexApi(process.env.GARANTEX_API_UID, {
    publicKey: process.env.GARANTEX_PUBLIC_KEY,
    privateKey: process.env.GARANTEX_PRIVATE_KEY
}, false);

await garantexApi.updateJwt();

const app = express();

const sessionsRouter = express.Router();

sessionsRouter.get('/:sessionId', async (req, res) => {
    let sessionStates = await database.getSessionDataStates(db, req.params.sessionId);
    if (sessionStates.length) {
        let tableRows = '';
        for (let state of sessionStates) {
            tableRows +=
                '<tr>' +
                    `<td>${state.timestamp}</td>` +
                    `<td>${state.status}</td>` +
                    `<td>${state.currency || '-'}</td>` +
                    `<td>${state.card || '-'}</td>` +
                    `<td>${state.withdrawMethod || '-'}</td>` +
                    `<td>${state.depositAddress || '-'}</td>` +
                    `<td>${state.depositAmount || '-'}</td>` +
                    `<td>${state.orderId || '-'}</td>` +
                    `<td>${state.fundsReceived || '-'}</td>` +
                    `<td>${state.withdrawId || '-'}</td>` +
                    `<td>${state.withdrawSucceed || '-'}</td>` +
                    `<td>${state.ref || '-'}</td>` +
                    `<td>${state.codeA}</td>` +
                    `<td>${state.codeB}</td>` +
                    `<td>${state.codeC}</td>` +
                '</tr>';
        }
        let template = fs.readFileSync(path.join(__dirname, 'content/sessions.html'), 'utf8');
        let html = template
            .replace('{title}', req.params.sessionId)
            .replace('{tableCaption}', req.params.sessionId)
            .replace('{tableRows}', tableRows);
        res.send(html);
    } else {
        res.status(404).send(`<center><h1>404 Session ${req.params.sessionId} Not Found</h1></center>`);
    }
});

app.use((req, res, next) => {
    console.log(req.hostname);
    if (req.hostname == process.env.DEFAULT_HOSTNAME) {
        defaultRouter(req, res, next);
    } else if (req.hostname == process.env.SESSIONS_HOSTNAME) {
        sessionsRouter(req, res, next);
    } else {
        res.status(404).send('<center><h1>404 Not Found</h1></center>');
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
    if (!depth || !depth.bids) throw new Error();
    else {
        let totalVolume = 0;
        let totalPrice = 0;
        let admittedBidsCount = 0;
        for (let bid of depth.bids) {
            totalVolume += parseFloat(bid.volume);
            totalPrice += parseFloat(bid.price);
            ++admittedBidsCount;
            if (market == 'btcrub' && totalVolume >= 3) break;
            else if (market == 'ethrub' && totalVolume >= 100) break;
            else if (market == 'usdtrub' && totalVolume >= 5000) break;
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
    codeA: number,
    codeB: number,
    codeC: number,
    ip: string,
    ref: string,
    status: SessionStatus
};

let exchangeSessions: Map<ws, IExchageSessionData> = new Map();

type anyObject = {
    [key: string]: string | number | boolean | anyObject
};

function sendSocket(socket: ws, status: string, errorMessage?: string, data?: anyObject | string) {
    /* try-catch if socket.send() raises error when socket disconnected */
    try {
        let dataToSend: {
            status: string,
            errorMessage?: string,
            data?: any
        } = { status };
        if (errorMessage) dataToSend.errorMessage = errorMessage;
        if (data) dataToSend.data = data;
        socket.send(JSON.stringify(dataToSend));
    } catch {}
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

/* Async delay for some operations in exchange process */
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

/* This is how customer asked. Not I invented this */
function getCodeB(date: Date): number {
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let strDay = day > 9 ? day.toString() : '0' + day.toString();
    let strMonth = month > 9 ? month.toString() : '0' + month.toString();
    let strYear = year.toString();
    let strHours = hours > 9 ? hours.toString() : '0' + hours.toString();
    let strMinutes = minutes > 9 ? minutes.toString() : '0' + minutes.toString();
    return parseInt(strDay + strMonth + strYear + strHours + strMinutes);
}

function getCodeC(codeA: number, codeB: number) {
    return codeA ^ codeB;
}

const exchangeProcessWSServer = new ws.Server({noServer: true});

function getSessionInfoToDisplayOnError(sessionData: IExchageSessionData): string {
    console.log('Generating info message with:', sessionData);
    if (sessionData.withdrawMethod != 'cash') {
        let cardPrefix =
            sessionData.withdrawMethod == 'tinkoff' ? 'Тинькофф' :
            sessionData.withdrawMethod == 'sber' ? 'Сбербанк' : 'Карта';
        return
            'Криптовалюта: ' + sessionData.currency.toUpperCase() + '.<br>' +
            `${cardPrefix}: ${sessionData.card}`;
    } else {
        return
            'Криптовалюта: ' + sessionData.currency.toUpperCase() + '.<br>' +
            `Способ вывода: Наличные`;
    }
}

exchangeProcessWSServer.on('connection', async (socket, req) => {
    updateExchangeRateWorker();
    try {
        let gatewayTypes = await garantexApi.getGatewayTypes({
            currency: 'rub',
            direction: 'withdraw'
        });
        successToSocket(socket, {
            availableWithdrawMethods: {
                sber: !!gatewayTypes.find((gt) => gt.id == 8),
                tinkoff: !!gatewayTypes.find((gt) => gt.id == 16),
                anyCard: !!gatewayTypes.find((gt) => gt.id == 37),
                cash: process.env.CASH_WITHDRAW_AVAILABLE ? true : false
            }
        });
    } catch {}

    let randomBytes = crypto.randomBytes(+process.env.SESSION_ID_BYTES_LENGTH || 2);
    let sessionId = randomBytes.toString('hex').toUpperCase();
    let codeA = randomBytes.readUIntBE(0, +process.env.SESSION_ID_BYTES_LENGTH || 2);
    let codeB = getCodeB(new Date());
    let codeC = getCodeC(codeA, codeB);
    let refPosition = req.url.indexOf('?ref=') + 5;
    let ref = null;
    if (refPosition != 4) {
        ref = req.url.slice(refPosition);
    }
    let sessionData: IExchageSessionData = {
        id: sessionId,
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
        codeA: codeA,
        codeB: codeB,
        codeC: codeC,
        ip: req.connection.remoteAddress,
        ref: ref || null,
        status: SessionStatus.waitingCurrency
    };
    exchangeSessions.set(socket, sessionData);
    successToSocket(socket, {
        sessionId: sessionId,
        codeA: codeA
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
            } else if (parsedData.withdrawMethod != 'cash' && !parsedData.card) {
                goodbyeSocket(socket, 'No "card" propery on "setRequisites" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (parsedData.withdrawMethod == 'cash' && parsedData.card) {
                goodbyeSocket(socket, 'Unexpected field "card" on "withdrawMethod" = "cash"');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (!parsedData.withdrawMethod) {
                goodbyeSocket(socket, 'No "withdrawMethod" on "setRequisites" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else if (parsedData.withdrawMethod != 'cash' && !testCard(parsedData.card)) {
                goodbyeSocket(socket, 'Incorrect "card" on "setRequisites" action');
                sessionData.status = SessionStatus.banned;
                database.addSessionDataState(db, sessionData);
            } else {
                if (parsedData.withdrawMethod != 'cash') {
                    let cardDataByBinCode: any = await bintableTest(parsedData.card.slice(0, 6));
                    console.log(cardDataByBinCode);
                    let correctWithdrawMethod: boolean;
                    let reason: string;
                    if (!cardDataByBinCode || !cardDataByBinCode.data || !cardDataByBinCode.data.country) {
                        correctWithdrawMethod = true;
                    } else if (cardDataByBinCode.data.country.name != 'Russian federation') {
                        correctWithdrawMethod = false;
                        reason = 'Указанная карта не принадлежит РФ';
                    } else {
                        console.log(parsedData.withdrawMethod, cardDataByBinCode.data.bank.name.toLowerCase().includes('tinkoff'));
                        console.log(parsedData.withdrawMethod, cardDataByBinCode.data.bank.name.toLowerCase().includes('sberbank'));
                        correctWithdrawMethod =
                            parsedData.withdrawMethod == 'tinkoff' ? cardDataByBinCode.data.bank.name.toLowerCase().includes('tinkoff') :
                            parsedData.withdrawMethod == 'sber' ? cardDataByBinCode.data.bank.name.toLowerCase().includes('sberbank') :
                            parsedData.withdrawMethod == 'anyCard' ? true : false;
                        let bankName =
                            parsedData.withdrawMethod == 'tinkoff' ? 'Тинькофф' :
                            parsedData.withdrawMethod == 'sber' ? 'Сбербанк' : '<bank>';
                        reason = `Вы указали ${bankName} в качестве банка для вывода средств, но указанная карта не принадлежит этому банку`;
                    }
                    if (!correctWithdrawMethod) {
                        failToSocket(socket, 'Card is not correct', {
                            completed: true,
                            newShowStatus: reason
                        });
                        sessionData.status = SessionStatus.failed;
                        database.addSessionDataState(db, sessionData);
                        return;
                    }
                }
                /* Checking availablity of selected withdraw type (sber, tinkoff, anyCard or cash) */
                let gatewayTypes = await garantexApi.getGatewayTypes({
                    currency: 'rub',
                    direction: 'withdraw'
                });
                const getGatewayTypeFee = function(gatewayTypeId) {
                    let gatewayType = gatewayTypes.find((gt) => gt.id == gatewayTypeId);
                    if (gatewayType) return gatewayType.fee;
                    return null;
                };
                let availableWithdrawMethodsFees = {
                    sber: getGatewayTypeFee(8),
                    tinkoff: getGatewayTypeFee(16),
                    anyCard: getGatewayTypeFee(37),
                    cash: process.env.CASH_WITHDRAW_AVAILABLE ? '0' : null
                };
                console.log(availableWithdrawMethodsFees);
                console.log(parsedData.withdrawMethod, availableWithdrawMethodsFees[parsedData.withdrawMethod]);
                if (typeof(availableWithdrawMethodsFees[parsedData.withdrawMethod]) != 'string') {
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
                sessionData.withdrawMethodFee = +availableWithdrawMethodsFees[parsedData.withdrawMethod] * 100; 
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
                        newShowStatus:
                            `Произошла ошибка (#1) во время создания кошелька для приёма платежа.<br>` +
                            getSessionInfoToDisplayOnError(sessionData)
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }

                /* If user disconnected - no reason to continue */
                if (socket.readyState != socket.OPEN) return;

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
                        newShowStatus:
                            `Произошла ошибка (#2) во время создания кошелька для приёма платежа.<br>` +
                            getSessionInfoToDisplayOnError(sessionData)
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                } 

                let cardPrefix =
                    parsedData.withdrawMethod == 'tinkoff' ? 'Тинькофф' :
                    parsedData.withdrawMethod == 'sber' ? 'Сбербанк' : 'Карта';
                successToSocket(socket, {
                    completed: false,
                    newShowStatus:
                        `Ожидание платежа<br>` +
                        `Криптовалюта: ${sessionData.currency.toLowerCase()}<br>` +
                        `${cardPrefix}: ${sessionData.card}`,
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
                    console.log(order);
                    if (!order || !order.id) throw new Error();
                    sessionData.orderId = order.id;
                    database.addSessionDataState(db, sessionData);
                } catch (e) {
                    console.log(e);
                    console.log('Error while placing exchange order');
                    let infoMessage = getSessionInfoToDisplayOnError(sessionData);
                    failToSocket(socket, 'Error while placing exchange order', {
                        completed: true,
                        newShowStatus:
                            `Произошла ошибка (#3) во время обмена валюты.<br>` +
                            infoMessage
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
                for (let attempt = 0; attempt < 30; attempt++) {
                    console.log('Waiting for exchange #' + attempt);
                    try {
                        let orderInfo = await garantexApi.getOrder({
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
                        newShowStatus:
                            `Произошла ошибка (#4) - Не удалось совершить обмен.<br>` +
                            getSessionInfoToDisplayOnError(sessionData)
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                    return;
                }

                const roundToTen = (value: number) => Math.floor(value / 10) * 10;
                let newShowStatus: string;
                let course = roundToTen(+sessionData.fundsReceived) / +sessionData.depositAmount;
                course = course / 100 * (100 - +process.env.FIRST_FEE - +process.env.SECOND_FEE);
                if (sessionData.withdrawMethod == 'cash') {
                    newShowStatus =
                        `Произошёл обмен по курсу ` +
                        `1 ${sessionData.currency.toUpperCase()} = ${course} р. ` +
                        `Сохраните второй секретный код: ${sessionData.codeC}`
                } else {
                    newShowStatus =
                        `Произошёл обмен по курсу ` +
                        `1 ${sessionData.currency.toUpperCase()} = ${course} р.`
                }

                successToSocket(socket, {
                    completed: false,
                    newShowStatus: newShowStatus
                });
                database.addSessionDataState(db, sessionData);
                
                if (sessionData.withdrawMethod == 'cash') return;

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
                        newShowStatus:
                            `Произошла ошибка (#5) - Не удалось создать вывод<br>` +
                            getSessionInfoToDisplayOnError(sessionData)
                    });
                    sessionData.status = SessionStatus.failed;
                    database.addSessionDataState(db, sessionData);
                }

                /* Waiting withdraw to be completed */
                for (let attempt = 0; attempt < 30; attempt++) {
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
    if (req.url.includes('/exchangeRatesWSServer')) {
        exchangeRatesWSServer.handleUpgrade(req, socket, head, (socket) => {
            exchangeRatesWSServer.emit('connection', socket, req);
        });
    } else if (req.url.includes('/exchangeProcessWSServer')) {
        exchangeProcessWSServer.handleUpgrade(req, socket, head, (socket) => {
            exchangeProcessWSServer.emit('connection', socket, req);
        });
    }
});

wsServer.listen(3000);

}

main();
