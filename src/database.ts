import { Connection as sqlConnection } from 'mysql2';

/*
 sessionStates:
 datetime, id, currency, card, depositAddressId, depositAddress, depositAmount, orderId, exchanged, fundsReceived
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
        let query = 'INERT INTO `sessionStates` VALUES (now(), ?, ?, ?, ?, ?, ?, ?, ?)';
        db.query(query, [
            convert(data.id),
            convert(data.currency),
            convert(data.card),
            convert(data.depositAddressId),
            convert(data.depositAddress),
            convert(data.depositAmount),
            convert(data.orderId),
            convert(data.exchanged),
            convert(data.fundsRecieved)
        ], (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

