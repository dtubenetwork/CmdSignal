const Utils = require('elliptic').utils;
const EC = require('elliptic').ec;
var ec = new EC('ed25519');

class SignedObject {
    /**
     * 
     * @param {KeyPair} pair 
     * @returns {SignedObject}
     */
    sign(pair) {
        var obj = JSON.parse(JSON.stringify(this)); //Simple object copy!
        delete obj["_signature"]; delete obj["_publickey"];
        var derSign = pair.sign(Utils.toArray(JSON.stringify(obj))).toDER()
        obj["_signature"] = Buffer.from(derSign).toString('base64');
        obj["_publickey"] = pair.getPublic(true, 'hex');
        var SignedObject = new SignedObject();

        for (var prop in obj)
            SignedObject[prop] = obj[prop];
        return SignedObject;
    }
    /**
     * Checks whether object is valid
     * @param {*} publicKey 
     * @returns {Boolean}
     */
    validate(publicKey) {
        var obj = JSON.parse(JSON.stringify(this)); //Simple object copy!
        var sig = Buffer.from(obj["_signature"], 'base64');
        delete obj["_signature"]; delete obj["_publickey"]; //Remove data not important to signature
        let pub;
        if (publicKey === Buffer) {
            pub = ec.keyFromPublic(Utils.toArray(publicKey), 'bin')
            //ec.keyFromPublic
        } else if (typeof publicKey === "string") {
            pub = ec.keyFromPublic(publicKey, 'hex') //Assume using hex
        }
        return pub.verify(Utils.toArray(JSON.stringify(obj)), Utils.toArray(sig))
    }
}
SignedObject.is = (obj) =>{
    if(obj["_signature"] && obj["_publickey"]) {
        return true
    } else {
        return false;
    }
}
SignedObject.cast = (obj) => {
    var SignedObject = new SignedObject();

    for (var prop in obj)
        SignedObject[prop] = obj[prop];
    return SignedObject;
}
SignedObject.fromJSON = (json) => {
    let obj;
    if (typeof json === "string") {
        obj = JSON.parse(json);
    } else if (typeof json === "object") {
        obj = json;
    }
    var SignedObject = new SignedObject();

    for (var prop in obj)
        SignedObject[prop] = obj[prop];
    return SignedObject;
}
exports = module.exports = SignedObject;