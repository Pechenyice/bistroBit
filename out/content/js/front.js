document.addEventListener("DOMContentLoaded", () => {

    let switcher = document.getElementById('themeSwap');
    let theme = document.getElementById('themeText');

    let data = localStorage.getItem('light');

    let isCash = false;
    let preloadReady = 0;

    const hostName = '62.113.113.183:3000';
    
    let ws = new WebSocket('ws://' + hostName + '/exchangeRatesWSServer');

    // window.location.hash = '#1234';

    // console.log(window.location.hash);

    let wsPreload = new WebSocket('ws://' + hostName + '/exchangeProcessWSServer?ref=' + window.location.hash.slice(1));

    let rates = document.getElementsByClassName('navLogoRates');

    let withdrawMethods = document.getElementsByClassName('withdrawMethods');

    let cashCode;
    
    ws.onmessage = message => {
        data = JSON.parse(message.data);
        // console.log(data);
        if (data['errorMessage']) {
            rates[0].classList.add('courseRotationState')
            rates[1].classList.add('courseRotationState')
            rates[2].classList.add('courseRotationState')
            rates[0].innerHTML = '<i class="fas fa-spinner"></i>';
            rates[1].innerHTML = '<i class="fas fa-spinner"></i>';
            rates[2].innerHTML = '<i class="fas fa-spinner"></i>';
            return;
        }

        // data['rates']['usdt_rub'] = 74.02;

        rates[0].classList.remove('courseRotationState')
        rates[1].classList.remove('courseRotationState')
        rates[2].classList.remove('courseRotationState')
        rates[0].innerHTML = (Math.floor(Number(data['rates']['btc_rub'])*100)/100).toFixed(2);
        rates[0].innerHTML = (Number(rates[0].innerHTML)).toLocaleString('ru-RU');
        let fixCheck = rates[0].innerHTML.split(',');
        if (fixCheck[1].length < 2) rates[0].innerHTML += '0';
        rates[1].innerHTML = (Math.floor(Number(data['rates']['eth_rub'])*100)/100).toFixed(2);
        rates[1].innerHTML = (Number(rates[1].innerHTML)).toLocaleString('ru-RU');
        fixCheck = rates[1].innerHTML.split(',');
        if (fixCheck[1].length < 2) rates[1].innerHTML += '0';
        rates[2].innerHTML = (Math.floor(Number(data['rates']['usdt_rub'])*100)/100).toFixed(2);

        // console.log(rates[2].innerHTML)

        rates[2].innerHTML = (Number(rates[2].innerHTML)).toLocaleString('ru-RU');
        // console.log(rates[2].innerHTML)

        fixCheck = rates[2].innerHTML.split(',');
        if (fixCheck[1] && fixCheck[1].length < 2) rates[2].innerHTML += '0';
        if (!fixCheck[1]) rates[2].innerHTML += ',00';
    };

    wsPreload.onmessage = message => {
        message = JSON.parse(message.data);
        console.log(message);

        

        if (message['data'] && message['data']['sessionId']) {
            document.getElementById('sessionIDBlock').getElementsByTagName('span')[0].innerHTML = message['data']['sessionId'];
            
            if (preloadReady) {
                document.getElementById('preloaderBlockMainOnStart').style.opacity = '0';
                setTimeout( () => {
                    document.getElementById('preloaderBlockMainOnStart').style.display = 'none';
                }, 300);
            }
            if (!preloadReady) preloadReady = 1;
        }

        if (message['data'] && message['data']['codeA']) {
            cashCode = message['data']['codeA'];
        }

        if (message['data'] && message['data']['availableWithdrawMethods']) {
            if (message['data']['availableWithdrawMethods']['anyCard']) {
                withdrawMethods[2].checked = true;
                withdrawMethods[2].removeAttribute('disabled');
                document.getElementsByClassName('container')[2].classList.remove('fakeContainer');
            } else {
                withdrawMethods[0].checked = true;
            }

            if (message['data']['availableWithdrawMethods']['sber']) {
                withdrawMethods[0].removeAttribute('disabled');
                document.getElementsByClassName('container')[0].classList.remove('fakeContainer');
            } else {
                withdrawMethods[1].checked = true;
            }

            if (message['data']['availableWithdrawMethods']['tinkoff']) {
                withdrawMethods[1].removeAttribute('disabled');
                document.getElementsByClassName('container')[1].classList.remove('fakeContainer');
            } else {
                withdrawMethods[3].checked = true;
            }
            
            if (message['data']['availableWithdrawMethods']['cash']) {
                withdrawMethods[3].removeAttribute('disabled');
                document.getElementsByClassName('container')[3].classList.remove('fakeContainer');
            } else {
                withdrawMethods[0].checked = false;
                withdrawMethods[1].checked = false;
                withdrawMethods[2].checked = false;
                withdrawMethods[3].checked = false;
            }

            if (preloadReady) {
                document.getElementById('preloaderBlockMainOnStart').style.opacity = '0';
                setTimeout( () => {
                    document.getElementById('preloaderBlockMainOnStart').style.display = 'none';
                }, 300);
            }
            if (!preloadReady) preloadReady = 1;

        }

        if (message['data'] && message['data']['depositAddress']) {
            document.getElementById('forCopy').innerHTML = '<span id="forCopyContent">' + message['data']['depositAddress'] + '</span>&nbsp; <i class="far fa-copy"></i>';
            document.getElementById('forCopy').classList.remove('noDisplay');
            document.getElementById('preQR').classList.add('noDisplay');

            var typeNumber = 4;
            var errorCorrectionLevel = 'L';
            var qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(message['data']['depositAddress']);
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
            // session.card = "";
            // session.currency = "";
            // session.withdrawMethod = "";
            // console.log(message['errorMessage']);

            // document.getElementById('preloaderBlock').style.opacity = 0;
            // document.getElementById('failBlock').style.opacity = 0;
            // document.getElementById('successBlock').style.opacity = 0;
            // document.getElementById('inputBlock').style.opacity = 0;

            // wsPreload = new WebSocket('ws://' + hostName + '/exchangeProcessWSServer');

            // setTimeout(() => {
            //     document.getElementById('preloaderBlock').style.display = 'none';
            //     document.getElementById('failBlock').style.display = 'none';
            //     document.getElementById('successBlock').style.display = 'none';
            //     document.getElementById('inputBlock').style.display = 'none';

            //     document.getElementById('currencyBlock').style.opacity = 1;
            //     document.getElementById('currencyBlock').style.display = 'block';
            // }, 300);
          
            document.location.reload();
            alert('Что-то пошло не так! Начните заново!')
            return;
        }

        if (message['data'] && !(message['data']['completed'])) {
            document.getElementById('preloaderServerText').innerHTML = message['data']['newShowStatus'];
            if (document.getElementById('preloaderServerText').innerHTML == "undefined") document.getElementById('preloaderServerText').innerHTML = "Отправка реквизитов";
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

    document.getElementById('preloaderBack').addEventListener('click', () => {
        // wsPreload.send(JSON.stringify({"action": "dropCurrency"}));
        wsPreload = new WebSocket('ws://' + hostName + '/exchangeProcessWSServer');
        // document.getElementById('purseInput').value = '';
        document.getElementById('cardInput').value = '';
        session.withdrawMethod = "sber";
        withdrawMethods[0].checked = true;
        session.card = "";
        document.getElementById('inputNext').classList.remove("active");

        document.getElementById('preloaderBlock').style.opacity = 0;

        setTimeout(() => {
            document.getElementById('preloaderBlock').style.display = 'none';
            document.getElementById('currencyBlock').style.display = 'block';
            document.getElementById('currencyBlock').style.opacity = 1;
        }, 300);

        // session.currency = "";
        // session.withdrawMethod = "";
        session.card = "";
    });

    document.getElementById('cardInput').addEventListener('keyup', function() {
        let tmp = this.value.split(" ").join("");
        if (tmp.length > 0) {
          tmp = tmp.match(new RegExp('.{1,4}', 'g')).join(" ");
        }
        this.value = tmp;
      });

    document.getElementById('cardInput').addEventListener('input', () => {

        if (!isCash) {
            document.getElementById('cardInput').classList.remove('wrong');
            let value = document.getElementById('cardInput').value;
            // if (!value[0]) {
            //     document.getElementById('cardImage').src = "";
            // }
            
            // if (value[0] == 4) {
            //     document.getElementById('cardImage').src = "assets/logo/visa.png";
            // }
            // if (value[0] == 5) {
            //     document.getElementById('cardImage').src = "assets/logo/master.png";
            // }
            // if (value[0] == 1 || value[0] == 7 || value[0] == 8 || value[0] == 9) {
            //     document.getElementById('cardInput').classList.add('wrong');
            //     document.getElementById('inputNext').classList.remove('active');
            //     session.card = "";
            // }
            value = value.replace(/\s/g, '');
            if (value.length <= 23 && value.length >= 16) {
                if(/^[0-9]+$/.test(value)){
                    session.card = value;
                    // if (session.withdrawMethod) 
                    document.getElementById('inputNext').classList.add('active');

                    if (!algLune(value)) {
                        document.getElementById('inputNext').classList.remove('active');
                        document.getElementById('cardInput').classList.add('wrong');
                    }

                    // if (value[0] == 1 || value[0] == 7 || value[0] == 8 || value[0] == 9) {
                    //     document.getElementById('cardInput').classList.add('wrong');
                    //     document.getElementById('inputNext').classList.remove('active');
                    //     session.card = "";
                    // }
                } else {
                }
            } else {
                document.getElementById('inputNext').classList.remove('active');
            }
        }

    });

    document.getElementById('cardInput').addEventListener('blur', () => {
        if (!isCash) {
            let value = document.getElementById('cardInput').value;
            value = value.replace(/\s/g, '');
            if (value.length <= 23 && value.length >= 16) {
                if(/^[0-9]+$/.test(value)){
                    // let tmp = "";
                    // for (let i = 3; i < value.length; i+=4) {
                    //     let beforeSubStr = value.substring(i-3,i + 1);
                    //     tmp += beforeSubStr + " ";
                    // }
                    // for (let i = 0; i < value.length; i++) {
                        // let beforeSubStr = value.substring(i-3,i + 1);
                        // tmp += value[i];
                        // if (i % 4 == 3) tmp += " ";
                    // }
                    // document.getElementById('cardInput').value = tmp;
                    session.card = value;
                    // if (session.withdrawMethod) 
                    document.getElementById('inputNext').classList.add('active');

                    // if (value[0] == 1 || value[0] == 7 || value[0] == 8 || value[0] == 9) {
                    //     document.getElementById('cardInput').classList.add('wrong');
                    //     document.getElementById('inputNext').classList.remove('active');
                    //     session.card = "";
                    // }

                    if (!algLune(value)) {
                        document.getElementById('inputNext').classList.remove('active');
                        document.getElementById('cardInput').classList.add('wrong');
                    }
                    
                } else {
                    if (value) {
                        document.getElementById('cardInput').classList.add('wrong');
                        document.getElementById('inputNext').classList.remove('active');
                        session.card = "";
                    }
                }
            } else {
                if (value) {
                    document.getElementById('cardInput').classList.add('wrong');
                    document.getElementById('inputNext').classList.remove('active');
                    session.card = "";
                }
            }
        }
    });

    document.getElementById('cardInput').addEventListener('focus', () => {
        document.getElementById('cardInput').classList.remove('wrong');
        // if (!isCash) {
        //     document.getElementById('cardInput').value = document.getElementById('cardInput').value.replace(/\s/g, '');
        // }
    });

    let cardMemory = "";

    

    for (let i = 0; i < withdrawMethods.length; i++) {
        withdrawMethods[i].addEventListener('change', () => {
            session.withdrawMethod = withdrawMethods[i].value;
            console.log(session.withdrawMethod)

            if (withdrawMethods[i].value == 'cash') {
                cardMemory = document.getElementById('cardInput').value;
                document.getElementById('forCashLabel').innerHTML = "Сохраните этот код:";
                document.getElementById('cardInput').setAttribute('readonly', true);
                document.getElementById('cardInput').value = cashCode;
                document.getElementById('inputNext').classList.add('active');
                isCash = 1;
                document.getElementById('cardInput').classList.remove('wrong');
                // document.getElementById('cardInput').setAttribute('placeholder', "1234к");
            } else {
                isCash = 0;
                document.getElementById('forCashLabel').innerHTML = "Номер карты:";
                document.getElementById('cardInput').value = cardMemory;
                document.getElementById('cardInput').focus();
                document.getElementById('cardInput').blur();
                // document.getElementById('inputNext').classList.remove('active');
                document.getElementById('cardInput').removeAttribute('readonly');
                document.getElementById('cardInput').setAttribute('placeholder', "____ ____ ____ ____");
                
                
                // document.getElementById('cardInput').value = "";
            }
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
        copyToClipboard(document.getElementById('forCopyContent'));
        document.getElementById('forCopy').classList.add('copyAnimationClass');
        setTimeout(()=>{document.getElementById('forCopy').classList.remove('copyAnimationClass');}, 400);
    });

    document.getElementById('sessionIDBlock').addEventListener('click', () => {
        copyToClipboard(document.getElementById('sessionForCopy'));
        document.getElementById('sessionIDBlock').classList.add('copyAnimationClass');
        setTimeout(()=>{document.getElementById('sessionIDBlock').classList.remove('copyAnimationClass');}, 400);
    });

    document.getElementById('inputNext').addEventListener('click', () => {
        if ((session.card && !isCash) || isCash
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

// console.log(algLune("4561261212345464"))

// console.log(algLune("4561261212345467"))

// console.log(algLune("12345678903"))

function algLune(str) {
    let data = str.split('');

    let odd = (data.length - 1) % 2;

    if (odd) {
        for (let i = 0; i < data.length - 1; i += 2) {
            data[i] = Number(data[i]) * 2;
            if (Number(data[i]) > 9) data[i] -= 9;
        }

        let sum = 0;

        for (let i = 0; i < data.length; i++) {
            sum += Number(data[i]);
        }

        return !(sum % 10);
    } else {
        for (let i = 1; i < data.length - 1; i += 2) {
            data[i] = Number(data[i]) * 2;
            if (Number(data[i]) > 9) data[i] -= 9;
        }

        let sum = 0;

        for (let i = 0; i < data.length; i++) {
            sum += Number(data[i]);
        }

        return !(sum % 10);
    }
}
