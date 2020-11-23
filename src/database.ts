import { Connection as sqlConnection } from 'mysql2';

/*
 sessionStates:
 datetime, id, status, currency, card, withdrawMethod, withdrawMethodFee, depositAddressId, depositAddress, depositAmount, orderId, exchanged, fundsReceived, withdrawId, withdrawSucceed
 */

function convert(value): string {
    if (typeof(value) === 'boolean') {
        if (value) return '1';
        return '0';
    }
    if (value) return value.toString();
    return '';
}

export function addSessionDataState(db: sqlConnection, data) {
    return new Promise((resolve, reject) => {
        let query = 'INERT INTO `sessionStates` VALUES (now(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
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
            convert(data.withdrawSucceed)
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
                    });
                }
                resolve(states);
            }
        });
    });
}
