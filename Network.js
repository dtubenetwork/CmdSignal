//const Libp2p = require('libp2p')
const pull = require('pull-stream');
const lp = require('pull-length-prefixed')

const ProtocolHandler = require("./ProtocolHandler")
/**
 * Standard issue ProtocolMuxer, redirects data based off protocol to proper handler. 
 * Manages Libp2p.
 */
class Network {
    /**
     * 
     * @param {Libp2p} libp2p 
     * 
     */
    constructor(libp2p) {
        this.libp2p = libp2p;
        this.protocolHandlers = {};

        this._running = false;
    }
    get peerInfo() {
        return this.libp2p.peerInfo;
    }
    /**
     * 
     * @param {String} ProtocolName 
     * @param {ProtocolHandler} handler 
     */
    registerProtocol(ProtocolName, handler) {
        if (this._running) {
            this.libp2p.handle(ProtocolName, handler._onConnection);
            this.libp2p.on('peer:connect', handler._onPeerConnected);
            this.libp2p.on('peer:disconnect', handler._onPeerDisconnected);

            this.libp2p.peerBook
                .getAllArray()
                .filter((peer) => peer.isConnected())
                .forEach((peer) => handler._onPeerConnected((peer)));
        }

        this.protocolHandlers[ProtocolName] = handler;
    }
    /**
     * 
     * @param {String} ProtocolName 
     */
    unregisterProtocol(ProtocolName) {
        var handler = this.protocolHandlers[ProtocolName];
        if (this._running) {
            this.libp2p.unhandle(ProtocolName);
            this.libp2p.removeListener('peer:connect', handler._onPeerConnected);
            this.libp2p.removeListener('peer:disconnect', handler._onPeerDisconnected);
        }

        delete this.protocolHandlers[ProtocolName];
    }
    /**
     * 
     * @param {PeerInfo} peer 
     * @param {Message} msg 
     * @param {String} protocol
     */
    sendMessage(peer, msg, protocol) {
        return new Promise((resolve, reject) => {
            if (!this._running) { return reject(new Error(`network isn't running`)) }

            //const stringId = peer.id.toB58String()
            //console.log('sendMessage to %s', stringId, msg)
            this._dialPeer(peer, protocol).catch((err) => reject(err))
                .then((result) => {
                    var conn = result[0]
                    var protocolName = result[1]
                    
                    let serialized;
                    switch (protocolName) {
                        case protocol:
                            serialized = msg.serialize()
                            //console.log(protocol)
                            break
                        default:
                            return reject(new Error('Unkown protocol: ' + protocol))
                    }
                    //console.log(serialized)
                    // TODO: why doesn't the error get propageted back??
                    writeMessage(conn, serialized, (err, val) => {
                        if (err) {
                            console.error(err)
                        }

                    })
                    resolve()
                })

            /*this._dialPeer(peer, (err, conn, protocol) => {
                if (err) {
                    return reject(err)
                }

                
            })*/
        });

    }
    /**
     * 
     * @param {PeerInfo} peer 
     * @returns {Promise}
     */
    connectTo(peer) {
        return new Promise((resolve, reject) => {
            if (!this._running) { return reject(new Error(`network isn't running`)); }

            this.libp2p.dial(peer, (err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    }
    /** 
     * Dial using supplied protocol
     * @param {PeerInfo} peer
     * @param {String} Protocol
     * @returns {Promise}
     */
    _dialPeer(peer, Protocol) {
        return new Promise((resolve, reject) => {
            // Attempt dtube 0.0.1
            this.libp2p.dialProtocol(peer, Protocol, (err, conn) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve([conn, Protocol]);
            });
        });
    }
    /**
     * @returns {Promise}
     */
    start() {
        return new Promise((resolve, reject) => {
            this._running = true;
            var protocols = Object.keys(this.protocolHandlers)
            for (var protocol in protocols) {
                var handler = this.protocolHandlers[protocol];
                this.libp2p.handle(ProtocolName, handler._onConnection);
                this.libp2p.on('peer:connect', handler._onPeerConnect);
                this.libp2p.on('peer:disconnect', handler._onPeerDisconnect);

                this.libp2p.peerBook
                    .getAllArray()
                    .filter((peer) => peer.isConnected())
                    .forEach((peer) => handler._onPeerConnect((peer)));


            }
            resolve();
        })
    }
    /**
     * @returns {Promise}
     */
    stop() {
        return new Promise((resolve, reject) => {
            this._running = false;

            var protocols = Object.keys(this.protocolHandlers)
            for (var protocol in protocols) {
                var handler = this.protocolHandlers[protocol];
                this.libp2p.unhandle(protocol);
                this.libp2p.removeListener('peer:connect', handler._onPeerConnect);
                this.libp2p.removeListener('peer:disconnect', handler._onPeerDisconnect);
            }

            resolve();
        });

    }
}
function writeMessage(conn, msg, callback) {
    pull(
        pull.values([msg]),
        lp.encode(),
        conn,
        pull.onEnd(callback)
    )
}

exports = module.exports = Network;