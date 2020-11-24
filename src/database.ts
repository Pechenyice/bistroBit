import { Connection as sqlConnection } from 'mysql2';

/*
 sessionStates:
 datetime, id, status, currency, card, withdrawMethod, withdrawMethodFee, depositAddressId, depositAddress, depositAmount, orderId, exchanged, fundsReceived, withdrawId, withdrawSucceed
 */

function convert(value, /* type: 'number' | 'string' */): string {
    if (typeof(value) === 'boolean') {
        if (value) return '1';
        return '0';
    }
    // if (type == 'number' && value == null) return 'null';
    // if (value) return value.toString();
    return value;
    // return '';
}

export function init(db: sqlConnection) {
    return new Promise((resolve, reject) => {
        let query =
            'CREATE TABLE IF NOT EXISTS `sessionStates` (' +
                '`timestamp` DATETIME,' +
                '`id` VARCHAR(16),' +
                '`status` INT,' +
                '`currency` VARCHAR(4),' +
                '`card` VARCHAR(32),' +
                '`withdrawMethod` VARCHAR(16),' +
                '`withdrawMethodFee` FLOAT,' +
                '`depositAddressId` INT,' +
                '`depositAddress` varchar(128),' +
                '`depositAmount` VARCHAR(32),' +
                '`orderId` INT,' +
                '`exchanged` INT,' +
                '`fundsReceived` VARCHAR(32),' +
                '`withdrawId` INT,' +
                '`withdrawSucceed` INT,' +
                '`codeA` BIGINT,' +
                '`codeB` BIGINT,' +
                '`codeC` BIGINT' +
            ')';
        db.query(query, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

export function addSessionDataState(db: sqlConnection, data) {
    return new Promise((resolve, reject) => {
        console.log(data.id, ' - ' + convert(data.id));
        console.log(data.status, ' - ' + convert(data.status));
        console.log(data.currency, ' - ' + convert(data.currency));
        console.log(data.card, ' - ' + convert(data.card));
        console.log(data.withdrawMethod, ' - ' + convert(data.withdrawMethod));
        console.log(data.withdrawMethodFee, ' - ' + convert(data.withdrawMethodFee));
        console.log(data.depositAddressId, ' - ' + convert(data.depositAddressId));
        console.log(data.depositAddress, ' - ' + convert(data.depositAddress));
        console.log(data.depositAmount, ' - ' + convert(data.depositAmount));
        console.log(data.orderId, ' - ' + convert(data.orderId));
        console.log(data.exchanged, ' - ' + convert(data.exchanged));
        console.log(data.fundsReceived, ' - ' + convert(data.fundsReceived));
        console.log(data.withdrawId, ' - ' + convert(data.withdrawId));
        console.log(data.withdrawSucceed, ' - ' + convert(data.withdrawSucceed));
        console.log(data.codeA, ' - ' + convert(data.codeA));
        console.log(data.codeB, ' - ' + convert(data.codeB));
        console.log(data.codeC, ' - ' + convert(data.codeC));
        let query = 'INSERT INTO `sessionStates` VALUES (now(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        db.query(query, [
            convert(data.id),
            convert(data.status),
            convert(data.currency),
            convert(data.card),
            convert(data.withdrawMethod),
            convert(data.withdrawMethodFee),
            convert(data.depositAddressId),
            convert(data.depositAddress),
            convert(data.depositAmount),
            convert(data.orderId),
            convert(data.exchanged),
            convert(data.fundsReceived),
            convert(data.withdrawId),
            convert(data.withdrawSucceed),
            convert(data.codeA),
            convert(data.codeB),
            convert(data.codeC)
        ], (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

export function getSessionDataStates(db: sqlConnection, sessionId: string) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * from `sessionStates`';
        db.query(query, (err, result: any) => {
            if (err) reject(err);
            else {let states = [];
                for (let state of result) {
                    states.push({
                        timestamp: state.timestamp,
                        id: state.id,
                        status: state.status,
                        currency: state.currency,
                        card: state.card,
                        withdrawMethod: state.withdrawMethod,
                        withdrawMethodFee: state.withdrawMethodFee,
                        depositAddressId: state.depositAddressId,
                        depositAddress: state.depositAddress,
                        depositAmount: state.depositAmount,
                        orderId: state.orderId,
                        exchanged: state.exchanged,
                        fundsReceived: state.fundsReceived,
                        withdrawId: state.withdrawId,
                        withdrawSucceed: state.withdrawSucceed,
                        codeA: state.codeA,
                        codeB: state.codeB,
                        codeC: state.codeC
                    });
                }
                resolve(states);
            }
        });
    });
}
