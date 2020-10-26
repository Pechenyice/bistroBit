document.addEventListener("DOMContentLoaded", () => {

    let switcher = document.getElementById('themeSwap');
    let theme = document.getElementById('themeText');

    let data = localStorage.getItem('light');
    
    let ws = new WebSocket('ws://localhost:3000/exchangeRatesWSServer');
    let wsPreload = new WebSocket('ws://localhost:3000/exchangeProcessWSServer');

    let rates = document.getElementsByClassName('navLogoRates');
    
    ws.onmessage = message => {
        data = JSON.parse(message.data);
        console.log(data);
        rates[0].innerHTML = data['rates']['btc_rub'];
        rates[1].innerHTML = data['rates']['eth_rub'];
        rates[2].innerHTML = data['rates']['usdt_rub'];
    };

    wsPreload.onmessage = message => {
        message = JSON.parse(message.data);
        console.log(message);

        if (message['status'] == 'goodbye') {
            session.card = "";
            session.currency = "";
            session.purse = "";
            console.log(message['errorMessage']);

            document.getElementById('preloaderBlock').style.opacity = 0;
            document.getElementById('failBlock').style.opacity = 0;
            document.getElementById('successBlock').style.opacity = 0;

            setTimeout(() => {
                document.getElementById('preloaderBlock').style.display = 'none';
                document.getElementById('failBlock').style.display = 'none';
                document.getElementById('successBlock').style.display = 'none';

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
        purse: "",
        card: ""
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
            switch (session.currency) {
                case "BTC" : {
                    document.getElementById('purseImage').src = "assets/logo/bitcoin.png";
                    break;
                }
                case "ETH" : {
                    document.getElementById('purseImage').src = "assets/logo/etherium.png";
                    break;
                }
                case "USDT" : {
                    document.getElementById('purseImage').src = "assets/logo/tether.png";
                    break;
                }
            }
            
            setTimeout(() => {
                document.getElementById('currencyBlock').style.display = 'none';
                document.getElementById('inputBlock').style.display = 'block';
                document.getElementById('inputBlock').style.opacity = 1;
            }, 300);
        }
    });

    document.getElementById('inputBack').addEventListener('click', () => {
        document.getElementById('purseInput').value = '';
        document.getElementById('cardInput').value = '';
        session.purse = "";
        session.card = "";
        document.getElementById('inputNext').classList.remove("active");

        document.getElementById('inputBlock').style.opacity = 0;

        setTimeout(() => {
            document.getElementById('inputBlock').style.display = 'none';
            document.getElementById('currencyBlock').style.display = 'block';
            document.getElementById('currencyBlock').style.opacity = 1;
        }, 300);

        // session.currency = "";
        session.purse = "";
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
                if (session.purse) document.getElementById('inputNext').classList.add('active');
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
                if (session.purse) document.getElementById('inputNext').classList.add('active');
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

    document.getElementById('purseInput').addEventListener('input', () => {
        let value = document.getElementById('purseInput').value;
        if (value) {
            session.purse = value;
            if (session.card) document.getElementById('inputNext').classList.add('active');
        } else {
            document.getElementById('inputNext').classList.remove('active');
            session.purse = "";
        }
    });

    document.getElementById('purseInput').addEventListener('blur', () => {
        let value = document.getElementById('purseInput').value;
        if (value) {
            session.purse = value;
            if (session.card) document.getElementById('inputNext').classList.add('active');
        } else {
            document.getElementById('inputNext').classList.remove('active');
            session.purse = "";
        }
    });

    document.getElementById('forCopy').addEventListener('click', () => {
        copyToClipboard(document.getElementById('forCopy'));
        document.getElementById('forCopy').style.animationName = 'scale';
    });

    document.getElementById('inputNext').addEventListener('click', () => {
        if (session.card && session.purse) {

            wsPreload.send(JSON.stringify({
                "action": "setRequisites",
                "address": session.purse.toLowerCase(),
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
        document.getElementById('purseInput').value = '';
        document.getElementById('cardInput').value = '';
        session.purse = "";
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

        document.getElementById('purseInput').value = '';
        document.getElementById('cardInput').value = '';
        session.currency = "";
        session.purse = "";
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
