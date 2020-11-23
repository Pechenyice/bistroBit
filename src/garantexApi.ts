import * as dotenv from 'dotenv';
dotenv.config();
import * as qs from 'querystring';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import * as jwt from 'jsonwebtoken';

type TMarketId =
    'btcrub' | 'btcusd' | 'btcusdt' |
    'btcdai' | 'dairub' | 'daiuah' | 
    'daiusd' | 'ethbtc' | 'ethdai' |
    'ethrub' | 'ethusd' | 'ethusdt' |
    'usdtdai' | 'usdtrub' | 'usdtusd';

interface ITrade {
    id: string,
    order_id: string,
    market: string,
    currency: string,
    funds_currency: string,
    price: string,
    volume: string,
    funds: string,
    fee: string,
    fee_size: string,
    created_at: string,
    side: string
};

interface IGateway {
    id: number,
    direction: string,
    currency: 'rub',
    title: string,
    description: string,
    instructions: string,
    min_amount: string,
    max_amount: string,
    rounding: string,
    fee: string,
    fee_fixed: string,
    fee_limit: string
};

interface IDepth {
    price: string,
    volume: string,
    amount: string,
    factor: string,
    type: 'limit' | 'factor'
};

interface IDepositAddress {
    id: number,
    currency: 'btc', 'eth', 'usdt',
    address: string
};

interface IDepositAddressDetails {
    id: number,
    blockchain: 'btc', 'ethereum',
    address: string
};

interface IDepositInformation {
    id: number,
    currency: 'rub' | 'btc' | 'eth' | 'usdt',
    type: 'fiat' | 'coin',
    amount: string,
    fee: string,
    txid?: string,
    block_number?: number,
    confirmations?: number,
    state: 'pending' | 'canceled' | 'submitted' | 'accepted' | 'rejected',
    address: string,
    created_at: string,
    completed_at: string
};

interface IOrder {
    id: number,
    market: TMarketId,
    remaining_volume: string,
    executed_volume: string,
    volume: string,
    side: 'ask' | 'bid',
    ord_type: 'default' | 'market' | 'factor' | 'limit',
    state: 'wait' | 'done' | 'cancel',
    factor: string,
    fix_price: string,
    funds_received: string,
    funds_fee: string,
    trades_count: number,
    avg_price: number,
    executed_amount: string,
    quote_amount: string,
    created_at: string,
    updated_at: string
};

interface IWithdraw {
    id: number,
    currency: 'btc' | 'eth' | 'usdt',
    type: 'coin' | 'fiat',
    amount: string,
    fee: string,
    rid: string,
    state: 'submitted' | 'succeed',
    txid: string,
    block_number: number,
    confirmations: number,
    created_at: string,
    completed_at: string
};

export default class GarantexApi {
    /**
     * API host address - garantex.io
     * If enableTestServer = true on constructor then host = stage.garantex.biz
     */
    private host: string = 'garantex.io';

    /**
     * API UID
     */
    private API_UID: string;

    /**
     * Useless field. I do not know why should I keep it
     */
    private publicKey: string;

    /**
     * Key used to get JWT token in generateJwt method
     */
    private privateKey: string;

    /**
     * Property used to sign requests to API (Authorization: Bearer JWT)
     */
    JWT: string;

    constructor(API_UID: string, credentials: {publicKey: string, privateKey: string}, enableTestServer?: boolean) {
        this.publicKey = credentials.publicKey;
        this.privateKey = Buffer.from(credentials.privateKey, 'base64').toString('utf8');
        this.API_UID = API_UID;
        if (enableTestServer) {
            this.host = 'stage.garantex.biz';
        }
    }
    
    /**
     * POST /sessions/generate_jwt API Endpoint.
     * Method used to get new JWT, but not update it in API instance
     */
    async generateJwt() {
        let unixTimestamp = Math.round(Date.now() / 1000);
        let payload = {
            iat: unixTimestamp - 10,
            exp: unixTimestamp + 60 * 60 * 23,
            sub: 'api_key_jwt',
            iss: 'external',
            jti: crypto.randomBytes(12).toString('hex').toUpperCase()
        };
        let jwtTokenToSend = jwt.sign(payload, this.privateKey, {
            algorithm: 'RS256'
        });
        let response = await fetch(`https://dauth.${this.host}/api/v1/sessions/generate_jwt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                kid: this.API_UID,
                jwt_token: jwtTokenToSend
            })
        });
        let parsedResponse = await response.json();
        if (parsedResponse.error) throw parsedResponse;
        let { token } = parsedResponse;
        if (!token) throw 'No token in answer';
        return token;
    }
    
    /**
     * This method used to update API instance JWT token
     */
    updateJwt(jwt: string): null;
    updateJwt(): Promise<boolean>;
    async updateJwt(jwt?: string) {
        if (jwt) {
            this.JWT = jwt;
        } else {
            return new Promise(async (resolve, reject) => {
                try {
                    this.JWT = await this.generateJwt();
                    resolve(true);
                } catch (e) {
                    resolve(false);
                }
            });
        }
    }

    /**
     * GET /trades API Endpoint.
     * Returns account-trades
     */
    async getTrades(options: {
        market: TMarketId, 
        limit?: number, 
        timestamp?: number,
        from?: number,
        to?: number,
        order_by?: string
    }): Promise<ITrade[]> {
        let data = qs.encode(options);
        let response = await fetch(`https://${this.host}/api/v2/trades?${data}`, {
            method: 'GET'
        });
        return await response.json();
    }

    /**
     * GET /depth API Endpoint.
     * Returns market depth for selected market
     */
    async getDepth(options: {
        market: TMarketId
    }): Promise<{
        timestamp: number,
        asks: IDepth[],
        bids: IDepth[]
    }> {
        let data = qs.encode(options);
        let response = await fetch(`https://${this.host}/api/v2/depth?${data}`, {
            method: 'GET'
        });
        return await response.json();
    }

    /**
     * GET /deposit_address?currency=cur API Endpoint.
     * Returns actual deposit address to deposits for selected currency
     */
    async getActualDepositAddress(options: {
        currency: 'btc' | 'eth' | 'usdt'
    }): Promise<IDepositAddress> {
        let queryWithData = qs.encode(options);
        let response = await fetch(`https://${this.host}/api/v2/deposit_address?${queryWithData}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.JWT}`
            }
        });
        return await response.json();
    }

    /**
     * POST /depoist_address API Endpoint.
     * Creates and returns new address to get deposits for selected currency
     */
    async createAdditionalDepositAddress(options: {
        currency: 'btc' | 'eth' | 'usdt'
    }): Promise<IDepositAddress> {
        let response = await fetch(`https://${this.host}/api/v2/deposit_address`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.JWT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        });
        return await response.json();
    }

    /**
     * GET /deposit_address/details API Endpoint.
     * Returns information about specified deposit address
     */
    async getDepositAddressDetails(options: {
        id: number | string
    }): Promise<IDepositAddressDetails> {
        let queryWithData = qs.encode(options);
        let response = await fetch(`https://${this.host}/api/v2/deposit_address/details?${queryWithData}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.JWT}`
            }
        });
        return await response.json();
    }

    /**
     * GET /deposits API Endpoint.
     * Returns deposits history
     */
    async getDeposits(options?: {
        currency?: 'rub' | 'btc' | 'eth' | 'usdt',
        limit?: number,
        state?: 'pending' | 'canceled' | 'submitted' | 'accepted' | 'rejected'
    }): Promise<IDepositInformation[]> {
        let queryWithData = qs.encode(options);
        let response = await fetch(`https://${this.host}/api/v2/deposits?${queryWithData}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.JWT}`
            }
        });
        return await response.json();
    }

    /**
     * POST /orders API Endpoint.
     * Place an order to financial exchange
     */
    async createNewOrder(options: {
        market: TMarketId,
        volume: number | string,
        side: 'buy' | 'sell',
        ord_type?: 'default' | 'limit' | 'factor' | 'market',
        fix_price?: number | string,
        factor?: number | string
    }): Promise<IOrder> {
        let response = await fetch(`https://${this.host}/api/v2/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.JWT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        });
        return await response.json();
    }

    /**
     * GET /orders API Endpoint
     * Returns order information
     */
    async getOrder(options: {
        id: number | string
    }): Promise<IOrder> {
        let queryWithData = qs.encode(options);
        let response = await fetch(`https://${this.host}/api/v2/orders${queryWithData}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.JWT}`,
            }
        });
        return await response.json();
    }

    /**
     * POST /withdraws/create API Endpoint.
     * Creates withdraw ticket and returns information about it
     */
    async createWithdraw(options: {
        currency: 'rub' | 'btc' | 'eth' | 'usdt',
        amount: string | number,
        rid: string,
        gateway_type_id?: string | number,
        data?: string
    }): Promise<IWithdraw> {
        let response = await fetch(`https://${this.host}/api/v2/withdraws/create`, {
            method: 'POST', 
            headers: {
                'Authorization': `Bearer ${this.JWT}`,
            },
            body: JSON.stringify(options)
        });
        return await response.json();
    }

    /**
     * GET /wtihdraws API Endpoint.
     * Returns list with withdraws information
     */
    async getWithdraws(options?: {
        currency?: 'rub' | 'btc' | 'eth' | 'usdt',
        page?: number,
        limit?: number
    }): Promise<IWithdraw[]> {
        let queryWithData = qs.encode(options);
        let response = fetch(`https://${this.host}/api/v2/withdraws?${queryWithData}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.JWT}`
            }
        });
        return response.json();
    }

    /**
     * GET /gateway_types API Endpoint.
     * Returns deposit and withdraw ways
     */
    async getGatewayTypes(options: {
        currency: 'rub',
        direction?: 'deposit' | 'withdraw'
    }): Promise<IGateway[]> {
        let queryWithData = qs.encode(options);
        let response = await fetch(`https://${this.host}/api/v2/gateway_types?${queryWithData}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.JWT}`
            }
        });
        return await response.json();
    }
}

