document.addEventListener("DOMContentLoaded", () => {

    let switcher = document.getElementById('themeSwap');
    let theme = document.getElementById('themeText');

    let data = localStorage.getItem('light');

    const hostName = 'c90d5587e6ab.ngrok.io';
    
    let ws = new WebSocket('ws://' + hostName + '/exchangeRatesWSServer');
    let wsPreload = new WebSocket('ws://' + hostName + '/exchangeProcessWSServer');

    let rates = document.getElementsByClassName('navLogoRates');

    let withdrawMethods = document.getElementsByClassName('withdrawMethods');
    
    ws.onmessage = message => {
        data = JSON.parse(message.data);
        console.log(data);
        if (data['errorMessage']) {
            rates[0].innerHTML = "X";
            rates[1].innerHTML = "X";
            rates[2].innerHTML = "X";
            return;
        }
        rates[0].innerHTML = Math.floor(Number(data['rates']['btc_rub'])*100)/100;
        rates[1].innerHTML = Math.floor(Number(data['rates']['eth_rub'])*100)/100;
        rates[2].innerHTML = Math.floor(Number(data['rates']['usdt_rub'])*100)/100;
    };

    wsPreload.onmessage = message => {
        message = JSON.parse(message.data);
        console.log(message);

        if (message['data'] && message['data']['sessionId']) {
            document.getElementById('sessionIDBlock').getElementsByTagName('span')[0].innerHTML = message['data']['sessionId'];
        }

        if (message['availableWithdrawTypes']) {
            if (message['availableWithdrawTypes']['sber']) {
                withdrawMethods[0].removeAttribute('disabled');
                document.getElementsByClassName('container')[0].classList.remove('fakeContainer');
            }
            if (message['availableWithdrawTypes']['tinkoff']) {
                withdrawMethods[1].removeAttribute('disabled');
                document.getElementsByClassName('container')[1].classList.remove('fakeContainer');
            }
            if (message['availableWithdrawTypes']['anyCard']) {
                withdrawMethods[2].removeAttribute('disabled');
                document.getElementsByClassName('container')[2].classList.remove('fakeContainer');
            }
            if (message['availableWithdrawTypes']['cash']) {
                withdrawMethods[3].removeAttribute('disabled');
                document.getElementsByClassName('container')[3].classList.remove('fakeContainer');
            }

            document.getElementById('sessionIDBlock').getElementsByTagName('span')[0].innerHTML = message['data']['sessionId'];
        }

        if (message['data'] && message['data']['depositAddress']) {
            document.getElementById('forCopy').innerHTML = message['data']['depositAddress'] + '&nbsp; <i class="far fa-copy"></i>';
            document.getElementById('forCopy').classList.remove('noDisplay');
            document.getElementById('preQR').classList.add('noDisplay');

            var typeNumber = 4;
            var errorCorrectionLevel = 'L';
            var qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData('Hi!');
            qr.make();
            // document.getElementById('placeHolder').innerHTML = qr.createImgTag();
            let tmp = document.createElement('div');
            tmp.classList.add('tmpQR');

            let size = 4;

            if (document.body.clientWidth < 1000) size = 2;

            tmp.innerHTML = qr.createImgTag(size);
            document.getElementById('qrMainBlock').insertBefore(tmp, document.getElementById('forCopy'));
        }

        if (message['status'] == 'goodbye') {
            session.card = "";
            session.currency = "";
            session.withdrawMethod = "";
            console.log(message['errorMessage']);

            document.getElementById('preloaderBlock').style.opacity = 0;
            document.getElementById('failBlock').style.opacity = 0;
            document.getElementById('successBlock').style.opacity = 0;
            document.getElementById('inputBlock').style.opacity = 0;

            wsPreload = new WebSocket('ws://' + hostName + '/exchangeProcessWSServer');

            setTimeout(() => {
                document.getElementById('preloaderBlock').style.display = 'none';
                document.getElementById('failBlock').style.display = 'none';
                document.getElementById('successBlock').style.display = 'none';
                document.getElementById('inputBlock').style.display = 'none';

                document.getElementById('currencyBlock').style.opacity = 1;
                document.getElementById('currencyBlock').style.display = 'block';
            }, 300);
          
            return;
        }

        if (!(message['data']['completed'])) {
            document.getElementById('preloaderServerText').innerHTML = message['data']['newShowStatus'];
        } else if (message['status'] == 'fail') {
            document.getElementById('preloaderBlock').style.opacity = 0;

            setTimeout(() => {
                    document.getElementById('preloaderBlock').style.display = 'none';
                    document.getElementById('failBlock').style.opacity = 1;
                    document.getElementById('failBlock').style.display = 'block';
            }, 300);

            document.getElementById('errorServerText').innerHTML = message['data']['newShowStatus'];

        } else {
            document.getElementById('preloaderBlock').style.opacity = 0;

            setTimeout(() => {
                    document.getElementById('preloaderBlock').style.display = 'none';
                    document.getElementById('successBlock').style.opacity = 1;
                    document.getElementById('successBlock').style.display = 'block';
            }, 300);

            document.getElementById('successServerText').innerHTML = message['data']['newShowStatus'];
        }

    };

    if (data == 1) {
        switcher.checked = true;
        document.body.classList.remove('night');
        document.body.classList.add('day');
        theme.innerHTML = "Светлая тема";
    } else {
        switcher.checked = false;
        document.body.classList.remove('day');
        document.body.classList.add('night');
        theme.innerHTML = "Тёмная тема";
    }

    let session = {
        currency: "",
        card: "",
        withdrawMethod: "sber"
    }   

    switcher.addEventListener('change', () => {
        if (switcher.checked) {
            document.body.classList.remove('night');
            document.body.classList.add('day');
            theme.innerHTML = "Светлая тема";
            localStorage.setItem('light', 1);
        } else {
            document.body.classList.remove('day');
            document.body.classList.add('night');
            theme.innerHTML = "Тёмная тема";
            localStorage.setItem('light', 0);
        }
    });

    let currencyBlocks = document.getElementsByClassName("contentBlockMainBlock");
    let currencyLogos = document.getElementsByClassName('navLogo');
    let currencyNext = document.getElementById('currencyNext');

    currencyBlocks[0].addEventListener('click', () => {
        if (session.currency == "ETH") {
            currencyBlocks[1].classList.toggle("active");
            currencyLogos[0].classList.toggle("passive");
            currencyLogos[2].classList.toggle("passive");
            currencyNext.classList.toggle("active");
        }
        if (session.currency == "USDT") {
            currencyBlocks[2].classList.toggle("active");
            currencyLogos[0].classList.toggle("passive");
            currencyLogos[1].classList.toggle("passive");
            currencyNext.classList.toggle("active");
        }
        if (session.currency != "BTC") session.currency = "BTC"; else session.currency = "";
        currencyBlocks[0].classList.toggle("active");
        currencyLogos[1].classList.toggle("passive");
        currencyLogos[2].classList.toggle("passive");
        currencyNext.classList.toggle("active");

    });

    currencyBlocks[1].addEventListener('click', () => {
        if (session.currency == "BTC") {
            currencyBlocks[0].classList.toggle("active");
            currencyLogos[1].classList.toggle("passive");
            currencyLogos[2].classList.toggle("passive");
            currencyNext.classList.toggle("active");
        }
        if (session.currency == "USDT") {
            currencyBlocks[2].classList.toggle("active");
            currencyLogos[0].classList.toggle("passive");
            currencyLogos[1].classList.toggle("passive");
            currencyNext.classList.toggle("active");
        }
        if (session.currency != "ETH") session.currency = "ETH"; else session.currency = "";
        currencyBlocks[1].classList.toggle("active");
        currencyLogos[0].classList.toggle("passive");
        currencyLogos[2].classList.toggle("passive");
        currencyNext.classList.toggle("active");

    });

    currencyBlocks[2].addEventListener('click', () => {
        if (session.currency == "BTC") {
            currencyBlocks[0].classList.toggle("active");
            currencyLogos[1].classList.toggle("passive");
            currencyLogos[2].classList.toggle("passive");
            currencyNext.classList.toggle("active");
        }
        if (session.currency == "ETH") {
            currencyBlocks[1].classList.toggle("active");
            currencyLogos[0].classList.toggle("passive");
            currencyLogos[2].classList.toggle("passive");
            currencyNext.classList.toggle("active");
        }
        if (session.currency != "USDT") session.currency = "USDT"; else session.currency = "";
        currencyBlocks[2].classList.toggle("active");
        currencyLogos[0].classList.toggle("passive");
        currencyLogos[1].classList.toggle("passive");
        currencyNext.classList.toggle("active");
    });

    currencyNext.addEventListener('click', () => {
        if (session.currency) {
            wsPreload.send(JSON.stringify({
                "action": "setCurrency",
                "currency": session.currency.toLowerCase()
            }));

            document.getElementById('currencyBlock').style.opacity = 0;
            // switch (session.currency) {
            //     case "BTC" : {
            //         document.getElementById('purseImage').src = "assets/logo/bitcoin.png";
            //         break;
            //     }
            //     case "ETH" : {
            //         document.getElementById('purseImage').src = "assets/logo/etherium.png";
            //         break;
            //     }
            //     case "USDT" : {
            //         document.getElementById('purseImage').src = "assets/logo/tether.png";
            //         break;
            //     }
            // }
            
            setTimeout(() => {
                document.getElementById('currencyBlock').style.display = 'none';
                document.getElementById('inputBlock').style.display = 'block';
                document.getElementById('inputBlock').style.opacity = 1;
            }, 300);
        }
    });

    document.getElementById('inputBack').addEventListener('click', () => {
        wsPreload.send(JSON.stringify({"action": "dropCurrency"}));
        // document.getElementById('purseInput').value = '';
        document.getElementById('cardInput').value = '';
        session.withdrawMethod = "sber";
        withdrawMethods[0].checked = true;
        session.card = "";
        document.getElementById('inputNext').classList.remove("active");

        document.getElementById('inputBlock').style.opacity = 0;

        setTimeout(() => {
            document.getElementById('inputBlock').style.display = 'none';
            document.getElementById('currencyBlock').style.display = 'block';
            document.getElementById('currencyBlock').style.opacity = 1;
        }, 300);

        // session.currency = "";
        // session.withdrawMethod = "";
        session.card = "";
    });

    document.getElementById('cardInput').addEventListener('input', () => {
        document.getElementById('cardInput').classList.remove('wrong');
        let value = document.getElementById('cardInput').value;
        if (!value[0]) {
            document.getElementById('cardImage').src = "";
        }
        if (value[0] == 4) {
            document.getElementById('cardImage').src = "assets/logo/visa.png";
        }
        if (value[0] == 5) {
            document.getElementById('cardImage').src = "assets/logo/master.png";
        }
        value = value.replace(/\s/g, '');
        if (value.length == 16) {
            if(/^[0-9]+$/.test(value)){
                session.card = value;
                // if (session.withdrawMethod) 
                document.getElementById('inputNext').classList.add('active');
            } else {
            }
        } else {
            document.getElementById('inputNext').classList.remove('active');
        }
    });

    document.getElementById('cardInput').addEventListener('blur', () => {
        let value = document.getElementById('cardInput').value;
        value = value.replace(/\s/g, '');
        if (value.length == 16) {
            if(/^[0-9]+$/.test(value)){
                let tmp = "";
                for (let i = 3; i < 16; i+=4) {
                    let beforeSubStr = value.substring(i-3,i + 1);
                    tmp += beforeSubStr + " ";
                }
                document.getElementById('cardInput').value = tmp;
                session.card = value;
                // if (session.withdrawMethod) 
                document.getElementById('inputNext').classList.add('active');
            } else {
                document.getElementById('cardInput').classList.add('wrong');
                document.getElementById('inputNext').classList.remove('active');
                session.card = "";
            }
        } else {
            document.getElementById('cardInput').classList.add('wrong');
            document.getElementById('inputNext').classList.remove('active');
            session.card = "";
        }
    });

    document.getElementById('cardInput').addEventListener('focus', () => {
        document.getElementById('cardInput').value = document.getElementById('cardInput').value.replace(/\s/g, '');
    });

    

    for (let i = 0; i < withdrawMethods.length; i++) {
        withdrawMethods[i].addEventListener('change', () => {
            session.withdrawMethod = withdrawMethods[i].value;
            console.log(session.withdrawMethod)
        });
    }

    // document.getElementById('purseInput').addEventListener('input', () => {
    //     let value = document.getElementById('purseInput').value;
    //     if (value) {
    //         session.withdrawMethod = value;
    //         if (session.card) document.getElementById('inputNext').classList.add('active');
    //     } else {
    //         document.getElementById('inputNext').classList.remove('active');
    //         session.withdrawMethod = "";
    //     }
    // });

    // document.getElementById('purseInput').addEventListener('blur', () => {
    //     let value = document.getElementById('purseInput').value;
    //     if (value) {
    //         session.withdrawMethod = value;
    //         if (session.card) document.getElementById('inputNext').classList.add('active');
    //     } else {
    //         document.getElementById('inputNext').classList.remove('active');
    //         session.withdrawMethod = "";
    //     }
    // });

    document.getElementById('forCopy').addEventListener('click', () => {
        copyToClipboard(document.getElementById('forCopy'));
        document.getElementById('forCopy').style.animationName = 'scale';
    });

    document.getElementById('inputNext').addEventListener('click', () => {
        if (session.card 
            // && session.withdrawMethod
            ) {


            wsPreload.send(JSON.stringify({
                "action": "setRequisites",
                "withdrawMethod": session.withdrawMethod.toLowerCase(),
                "card": session.card.toLowerCase()
            }));

            document.getElementById('inputBlock').style.opacity = 0;
            setTimeout(() => {
                document.getElementById('inputBlock').style.display = 'none';
                document.getElementById('preloaderBlock').style.display = 'block';
                document.getElementById('preloaderBlock').style.opacity = 1;
            }, 300);
        }
    });

    document.getElementById('failNext').addEventListener('click', () => {

        wsPreload.send(JSON.stringify({"action": "dropRequisites"}));

        // wsPreload = new WebSocket('ws://' + hostName + '/exchangeProcessWSServer');
        // document.getElementById('purseInput').value = '';
        document.getElementById('cardInput').value = '';
        session.withdrawMethod = "sber";
        withdrawMethods[0].checked = true;
        session.card = "";
        document.getElementById('inputNext').classList.remove("active");
        document.getElementById('failBlock').style.opacity = 0;
            setTimeout(() => {
                document.getElementById('failBlock').style.display = 'none';
                document.getElementById('inputBlock').style.display = 'block';
                document.getElementById('inputBlock').style.opacity = 1;
            }, 300);
    });

    document.getElementById('successNext').addEventListener('click', () => {

        wsPreload = new WebSocket('ws://' + hostName + '/exchangeProcessWSServer');

        switch (session.currency) {
            case "BTC" : {
                currencyBlocks[0].click();
                break;
            }
            case "ETH" : {
                currencyBlocks[1].click();
                break;
            }
            case "USDT" : {
                currencyBlocks[2].click();
                break;
            }
        }

        // document.getElementById('purseInput').value = '';
        document.getElementById('cardInput').value = '';
        session.currency = "";
        session.withdrawMethod = "sber";
        withdrawMethods[0].checked = true;
        session.card = "";
        document.getElementById('inputNext').classList.remove('active');
        document.getElementById('successBlock').style.opacity = 0;
            setTimeout(() => {
                document.getElementById('successBlock').style.display = 'none';
                document.getElementById('currencyBlock').style.display = 'block';
                document.getElementById('currencyBlock').style.opacity = 1;
            }, 300);
    });

});

function copyToClipboard(elem) {
    // create hidden text element, if it doesn't already exist
  var targetId = "_hiddenCopyText_";
  var isInput = elem.tagName === "INPUT" || elem.tagName === "TEXTAREA";
  var origSelectionStart, origSelectionEnd;
  if (isInput) {
      // can just use the original source element for the selection and copy
      target = elem;
      origSelectionStart = elem.selectionStart;
      origSelectionEnd = elem.selectionEnd;
  } else {
      // must use a temporary form element for the selection and copy
      target = document.getElementById(targetId);
      if (!target) {
          var target = document.createElement("textarea");
          target.style.position = "absolute";
          target.style.left = "-9999px";
          target.style.top = "0";
          target.id = targetId;
          document.body.appendChild(target);
      }
      target.textContent = elem.textContent;
  }
  // select the content
  var currentFocus = document.activeElement;
  target.focus();
  target.setSelectionRange(0, target.value.length);
   
  // copy the selection
  var succeed;
  try {
        succeed = document.execCommand("copy");
  } catch(e) {
      succeed = false;
  }
  // restore original focus
  if (currentFocus && typeof currentFocus.focus === "function") {
      currentFocus.focus();
  }
   
  if (isInput) {
      // restore prior selection
      elem.setSelectionRange(origSelectionStart, origSelectionEnd);
  } else {
      // clear temporary content
      target.textContent = "";
  }
  return succeed;
}
