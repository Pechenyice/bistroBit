import * as dotenv from 'dotenv'
dotenv.config();

// console.log(process.env);
import GarantexApi from './garantexApi'

const TEST = false;

let API_UID, PUBLIC_KEY, PRIVATE_KEY;

if (TEST) {
    API_UID = process.env.TEST_GARANTEX_API_UID;
    PUBLIC_KEY = process.env.TEST_GARANTEX_PUBLIC_KEY;
    PRIVATE_KEY = process.env.TEST_GARANTEX_PRIVATE_KEY;
} else {
    API_UID = process.env.GARANTEX_API_UID;
    PUBLIC_KEY = process.env.GARANTEX_PUBLIC_KEY;
    PRIVATE_KEY = process.env.GARANTEX_PRIVATE_KEY;
}

let garantexApi = new GarantexApi(API_UID, {
    publicKey: PUBLIC_KEY,
    privateKey: PRIVATE_KEY 
}, TEST);

void async function() {
    await garantexApi.updateJwt();
    console.log('Token generated');
    // console.log(garantexApi.JWT);
    
    // let gateways = await garantexApi.gatewayTypes({ currency: 'rub', direction: 'withdraw' });
    // console.log(gateways);
}();
