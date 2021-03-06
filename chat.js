// https://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
function getQueryParams(qs) {
    qs = qs.split('+').join(' ');

    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }

    return params;
}

// Get the chat room URL & nick name from HTML params
var thisUrl = window.location.href.split("?");
var params = getQueryParams(thisUrl[thisUrl.length - 1]);
var roomId = params["id"];
var username = params["username"];

$("#img-upload").attr("action", url + "imgupload");

// The web socket with which we connect to the server
var webSocket;


const pki = forge.pki;
const rsa = pki.rsa;

var privateKeyPem = passwToKey(sessionStorage.getItem("privateKey"));
var privateKey = null;
var publicKey = null;
doLogin = false;
if (privateKeyPem != null) {
    doLogin = true;
    privateKey = pki.privateKeyFromPem(privateKeyPem);
    publicKey = rsa.setPublicKey(privateKey.n, privateKey.e);
    getBuddyList();
}


function publicKeyToBase64() {
    return pki.publicKeyToPem(publicKey)
        .replace(/[\n\r]/g, "");
}


// Open web socket to server
function setupWebSocket() {
    webSocket = new WebSocket(wsUrl);
    webSocket.onopen = function (ev) {
        // Send the login message to the server
        if (doLogin) {
            webSocket.send(JSON.stringify({
                type: "challenge",
                "user-id": publicKeyToBase64()
            }));
        }
        else {
            webSocket.send(JSON.stringify({
                type: "login",
                room: roomId,
                username: username
            }));
        }
    };
    webSocket.onmessage = function (ev) {
        var data = JSON.parse(ev.data);
        for (var p in data) {
            if (data.hasOwnProperty(p) && (typeof data[p]) === "string") {
                data[p] = escapeHtml(data[p]);
            }
        }
        switch (data.type) {
            case "challenge":
                const challenge = data["challenge"];
                const bytes = convertBase64ToBinary(challenge);
                const decrypted = privateKey.decrypt(bytes);
                const solution = forge.util.encode64(decrypted);
                webSocket.send(JSON.stringify({
                    type: "login",
                    room: roomId,
                    username: username,
                    "user-id": publicKeyToBase64(),
                    "challenge-response": decrypted
                }));
                break;
            case "error":
                addChatAlert("Error: " + data.reason);
                break;
            case "message":
                addChatMessage(data.username, data.message, data.username === username, msToTime(data.time), data["user-id"]);
                break;
            case "image":
                addImage(data.username, url + "image/" + data.image, data.username === username, msToTime(data.time), data["user-id"]);
                break;
            case "info-login":
                addChatAlert(data.username + " logged in!");
                break;
            case "info-logout":
                addChatAlert(data.username + " logged out!");
                break;

        }
    };

    webSocket.onclose = function (ev) {
        setTimeout(setupWebSocket, 100)
    }

}

setTimeout(setupWebSocket, 100);

function msToTime(ms) {
    return new Date(ms).toISOString().slice(11, 16);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, function (m) {
        return map[m];
    });
}

function addChatAlert(message) {
    const chatDiv = $("#chat-window");
    const alert = $(
        "<div class='col-sm chat-alert'>" +
        "    <span><b>" + message + "</b></span>" +
        "</div>"
    );
    chatDiv.append(alert);

    scrollDown();
}

function isScrolledDown() {
    const obj = $("#chat-window")[0];
    return (obj.scrollTop === Math.max((obj.scrollHeight - obj.offsetHeight) - 100, obj.scrollTop));
}

function scrollDown() {
    $(function () {
        $("#chat-window").scrollTop(1E10);
    });
}


function addChatMessage(username, message, self, time, id) {
    add("message", username, message, self, time, id)
}

function add(thing, username, message, self, time, id) {
    const chatDiv = $("#chat-window");
    const c = self ? thing + "-y" : thing + "-o";
    const isBuddy = buddyList.hasOwnProperty(id);
    const chatMessage = $(
        "<div class='row-lg' style='clear: both'>" +
        "<div class='" + c + "'>\n" +
        "    <span></span>\n" +
        "    <span class='time'>" + time + "</span>" + (self ? "\xa0\xa0" : "") +
        "    <span class='name'><b " + (isBuddy ? "style='color:#0A690A;'" : "") + ">"
            + username + (isBuddy ? " [BUDDY]" : "") + "</b> " +
        ((self || !doLogin || id === "anonymous:" + username) ? "" :
            "    <a href='javascript:void(0);' onclick=\"buddyListAction('" + id + "', '" + username + "')\">" +
            (isBuddy ? "[-]" : "[+]") + "</a>") +
        "    </span>\n" + (!self ? "\xa0\xa0" : "") +
        "    <br>\n" +
        (thing === "message" ?
                "    <span class='message'>" + message + "</span>\n" :
                "    <img src=" + message + (isScrolledDown() ? " onload='scrollDown();'" : "") + ">"
        ) +
        "</div>\n" +
        "</div>" +
        "<div class='row-md form-group' style='clear: both;'></div>"
    );

    var scrolledDown = isScrolledDown();
    chatDiv.append(chatMessage);
    if (thing === "message" && scrolledDown) {
        scrollDown();
    }
}

function buddyListAction(id, username) {
    if (buddyList.hasOwnProperty(id)) {
        buddyListRemove(id);
        addChatAlert(username + " was removed from your buddy list. <a href='buddies.html'>Configure buddy list</a>")
    } else {
        buddyListAdd(id, username);
        addChatAlert(username + " was added to your buddy list. <a href='buddies.html'>Configure buddy list</a>")
    }
    saveBuddyList();
}

function addImage(username, image, self, time, id) {
    add("image", username, image, self, time, id)
}

// On resize (i.e. on-screen-keyboard open), scroll down
$(window).on("resize", function () {
    scrollDown()
});


// Enter press in text input
$('#chat-text').keypress(function (event) {
    var keycode = (event.keyCode ? event.keyCode : event.which);
    if (keycode === 13) {
        onSendClick();
    }
});

// Sends message that is in chat-text
function onSendClick() {
    var chatTextField = $("#chat-text");
    var text = chatTextField.val().trim();
    if (text === "") return;
    webSocket.send(JSON.stringify({
        type: "message",
        message: text
    }));

    chatTextField.val("");
}

const imageUpload = $("#image-upload");

imageUpload.on('click touchstart', function () {
    $(this).val('');
});

imageUpload.change(sendImage);

function sendImage(ev) {
    var file = ev.target.files[0];
    var formData = new FormData();
    formData.append("uploaded_file", file, file.name);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url + 'imgupload', true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            var imageId = xhr.responseText;
            $('#image-select').slideToggle();
            webSocket.send(JSON.stringify({
                type: "image",
                "image": imageId
            }));
        } else {
            console.log(xhr.responseText);
        }
    };
    xhr.send(formData);
}

function convertBase64ToBinary(base64) {
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8Array(new ArrayBuffer(rawLength));
    for (i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}
