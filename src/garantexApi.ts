import * as dotenv from 'dotenv'
dotenv.config();
import * as crypto from 'crypto'
import fetch from 'node-fetch'
import * as jwt from 'jsonwebtoken'

type TMarketId = 'btcrub' | 'btcusd' | 'btcusdt' | 'btcdai' | 'dairub' | 'daiuah' | 'daiusd' | 'ethbtc' | 'ethdai' | 'ethrub' | 'ethusd' | 'ethusdt' | 'usdtdai' | 'usdtrub' | 'usdtusd';

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
}

export default class GarantexApi {
    /**
     * API host address
     */
    private host: string = 'stage.garantex.biz';

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

    constructor(API_UID: string, credentials: {publicKey: string, privateKey: string}) {
        this.publicKey = credentials.publicKey;
        this.privateKey = Buffer.from(credentials.privateKey, 'base64').toString('utf8');
        this.API_UID = API_UID;
    }
    
    /**
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

    async trades(options: {
        market: TMarketId, 
        limit?: number, 
        timestamp?: number,
        from?: number,
        to?: number,
        order_by?: string
    }): Promise<ITrade[]> {
        let data = Object.entries(options).map((pair) => `${pair[0]}=${pair[1]}`).join('&');
        let response = await fetch(`https://${this.host}/api/v2/trades?${data}`, {
            method: 'GET',
        });
        return response.json();
    }

    // async fetchExchangeRates(): Promise<{btc_rub: number, eth_rub: number, usdt_rub: number}> {
    //     return null;
    // }
}


