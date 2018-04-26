var url;
var wsUrl;

url = "https://unichatproject.de/";
wsUrl = "wss://unichatproject.de:3000/";
var path = window.location.pathname;

const beginPrivate = "-----BEGIN RSA PRIVATE KEY-----$";
const endPrivate = "$-----END RSA PRIVATE KEY-----$";

function keyToPassw(key) {
    if (key == null) return null;
    return key.split("\r\n").join("$").replace(beginPrivate, "").replace(endPrivate, "");
}

function passwToKey(password) {
    if (password == null) return null;
    return (beginPrivate + password + endPrivate).split("$").join("\r\n");
}
