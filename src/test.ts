import * as dotenv from 'dotenv'
dotenv.config();

console.log(process.env);
import GarantexApi from './garantexApi'

let garantexApi = new GarantexApi(process.env.GARANTEX_API_UID, {
    publicKey: process.env.GARANTEX_PUBLIC_KEY,
    privateKey: process.env.GARANTEX_PRIVATE_KEY
});

console.log(garantexApi);

void async function() {
    let newJwt;
    try {
    newJwt = await garantexApi.generateJwt();
    } catch (e) { console.log(e) }
    console.log(newJwt);
    if (newJwt) {
        garantexApi.JWT = newJwt;
        console.log(await garantexApi.trades({ market: 'btcrub' }));
    }
}();
