import * as dotenv from 'dotenv'
dotenv.config();

// console.log(process.env);
import GarantexApi from './garantexApi'

let garantexApi = new GarantexApi(process.env.GARANTEX_API_UID, {
    publicKey: process.env.GARANTEX_PUBLIC_KEY,
    privateKey: process.env.GARANTEX_PRIVATE_KEY
}, false);

// console.log(garantexApi);
async function calculateExchangeRate(): Promise<number> {
    let { bids } = await garantexApi.depth({ market: 'usdtrub' });
    if (bids) {
        let totalVolume = 0;
        let totalPrice = 0;
        let admittedBidsCount = 0;
        for (let bid of bids) {
            totalVolume += parseFloat(bid.volume);
            totalPrice += parseFloat(bid.price);
            ++admittedBidsCount;
            if (totalVolume >= 20) break;
        }
        let exchangeRate = totalPrice / admittedBidsCount;
        return exchangeRate;
    } else throw 'Mne puhui';
}

void async function() {
    let newJwt = await garantexApi.generateJwt();
    console.log('Token generated');
    console.log(newJwt);
    if (newJwt) {
        garantexApi.JWT = newJwt;
        // console.log(await garantexApi.trades({ market: 'btcrub' }));
        // console.log(await garantexApi.depth({ market: 'btcrub' }));
        // console.log(await garantexApi.getActualDepositAddress({ currency: 'eth' }));
        // console.log(await garantexApi.getAdditionalDepositAddress({ currency: 'eth' }));
        // console.log(await garantexApi.depositAddressDetails({ id: 27488 }));
        // console.log(await garantexApi.gatewayTypes({ currency: 'rub' }));
        
        // let additionalDepositAddressBtc = await garantexApi.additionalDepositAddress({ currency: 'btc' });
        // console.log(additionalDepositAddressBtc);
        let depositAddressBtc = await garantexApi.actualDepositAddress({ currency: 'btc' });
        console.log(depositAddressBtc);
        let depositAddressDetailsBtc = await garantexApi.depositAddressDetails({ id: depositAddressBtc.id });
        console.log(depositAddressDetailsBtc, '\n');

        // let additionalDepositAddressEth = await garantexApi.additionalDepositAddress({ currency: 'eth' });
        // console.log(additionalDepositAddressEth);
        let depositAddressEth = await garantexApi.actualDepositAddress({ currency: 'eth' });
        console.log(depositAddressEth);
        let depositAddressDetailsEth = await garantexApi.depositAddressDetails({ id: depositAddressEth.id });
        console.log(depositAddressDetailsEth, '\n');

        // let additionalDepositAddressUsdt = await garantexApi.additionalDepositAddress({ currency: 'usdt' });
        // console.log(additionalDepositAddressUsdt);
        let depositAddressUsdt = await garantexApi.actualDepositAddress({ currency: 'usdt' });
        console.log(depositAddressUsdt);
        let depositAddressDetailsUsdt = await garantexApi.depositAddressDetails({ id: depositAddressUsdt.id });
        console.log(depositAddressDetailsUsdt);
    }
}();
