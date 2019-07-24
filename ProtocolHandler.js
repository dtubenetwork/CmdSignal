const PeerInfo = require('peer-info')
const pull = require('pull-stream');
const lp = require('pull-length-prefixed')
const each = require('async/each')

const CmdSignal = require('./types/CmdSignal')
const Network = require('./Network')

/**
 * Standard issue ProtocolHandler, redirects data to CommandHandler.
 * This class does stream handling, serialization and response handling.
 * This ProtocolHandler is designed to use Command Signal serialization/protocol.
 * Register commands with this class... 
 */
class ProtocolHandler {
    /**
     * 
     * @param {ProtocolName} ProtocolName
     * @param {Network} Network
     */
    constructor(ProtocolName, Network) {
        this.protocolName = ProtocolName;
        this.Network = Network;
        this.commandHandlers = {};
        this.callBacks = {};
    }
    get availableCommands() {
        return Object.keys(this.commandHandlers)
    }
    /**
     * 
     * @param {String} cmdName 
     * @param {function} handler 
     */
    registerCommand(cmdName, handler) {
        this.commandHandlers[cmdName] = handler;
    }
    registerCommandList(Map) {
        var Keys = Object.keys(this.protocolHandlers)
        for (var CmdName in Keys) {
            var Command = Map[protocol];
            this.commandHandlers[CmdName] = Command;
        }
    }
    /**
     * 
     * @param {String} cmdName 
     */
    unregisterCommand(cmdName) {
        delete this.commandHandlers[cmdName];
    }
    /**
     * 
     * @param {String[]} List 
     */
    unregisterCommandList(List) {
        for(var cmdName in List) {
            delete this.commandHandlers[cmdName];
        }
    }
    start() {
        this._running = true;

        this._onPeerConnected = this._onPeerConnected.bind(this);
        this._onPeerDisconnected = this._onPeerDisconnected.bind(this);

        this._onConnection = this._onConnection.bind(this);

        this.Network.registerProtocol(this.protocolName, this)
    }
    stop() {
        if (this._running = false)
        this.Network.unregisterProtocol(this.protocolName)
        delete this.commandHandlers;
    }
    /**
     * Simple way to send command and receive response.
     * @param {PeerInfo} cmd
     * @param {String} cmd
     * @param {Object} args //Anything you want it to be... Should pass this to command handler.
     * @param {Number} type //1 is request, 2 is response. handle accordingly.
     * @param {String} tid
     */
    sendCommand(peerId, cmd, args, type, tid) {
        return new Promise((resolve, reject) => {
            var Signal = new CmdSignal();

            let rtid;
            if (type === 1 || type === undefined || type === null) {
                rtid = Signal.addCommand(cmd, args);
            } else {
                rtid = Signal.addResponse(cmd, args, tid);
            }
            if (type === 1 || type === undefined || type === null) {
                this.callBacks[rtid] = (err, response) => {
                    if (err) reject(err);
                    resolve(response); //Response *should* be a fragment object
                };
            } else {
                resolve()
            }
            this.Network.sendMessage(peerId, Signal, this.protocolName);
        });
    }
    /**
     * Simple way to send command and receive response.
     * This is meant to dial custom protocols.
     * @param {String} protoName
     * @param {PeerInfo} cmd
     * @param {String} cmd
     * @param {Object} args //Anything you want it to be... Should pass this to command handler.
     * @param {Number} type //1 is request, 2 is response. handle accordingly.
     * @param {String} tid
     */
    sendCommandProtocol(protoName, peerId, cmd, args, type, tid) {
        return new Promise((resolve, reject) => {
            var Signal = new CmdSignal();

            let rtid;
            if (type === 1 || type === undefined || type === null) {
                rtid = Signal.addCommand(cmd, args);
            } else {
                rtid = Signal.addResponse(cmd, args, tid);
            }
            if (type === 1 || type === undefined || type === null) {
                this.callBacks[rtid] = (err, response) => {
                    if (err) reject(err);
                    resolve(response); //Response *should* be a fragment object
                };
            } else {
                resolve()
            }
            this.Network.sendMessage(peerId, Signal, protoName);
        });
    }
    /**
     * Meant to send multiple commands.. This function is experimental
     * @param {PeerInfo} peerId 
     * @param {CmdSignal} cmd
     * @returns {Promise[]}
     */
    sendCommandObj(peerId, cmd) {
        var out = []
        const fragments = Array.from(cmd.fragments.values())
        each(fragments, (fragment) => {
            var promise = new Promise((resolve, reject) => {
                if (fragment.type === 1) {
                    this.callBacks[fragment.tid] = (err, response) => {
                        if (err) reject(err);
                        resolve(response); //Response *should* be a fragment object
                    };
                } else {
                    resolve()
                }
            });
            out.push(promise);
        })

        this.Network.sendMessage(peerId, cmd, this.protocolName);
        return out;
    }
    /* ######## only for internal use ######## */
    _processCommand(peerId, fragment) {
        (async () => {
            let msg = new CmdSignal({})

            var cmdName = fragment.cmd.toString()
            switch (cmdName) {
                case 'test':
                    console.log('sending ok #', fragment.tid.toString())
                    msg.addResponse(cmdName, 'OK', fragment.tid.toString())
                    break
                case 'example':
                    var ret = await this._exampleCommand(peerId, fragment.cmd, fragment.args, fragment.tid);
                    msg.addResponse(cmdName, ret + " Success! this example works", fragment.tid);


                    break;
                case 'commands':
                    //Give a updated list of commands.
                    var cmds = [];
                    cmds.push("commands");
                    cmds.push.apply(cmds, this.availableCommands);
                    msg.addResponse(cmdName, JSON.stringify(cmds), fragment.tid);
                    break;
                default:
                    if (this.commandHandlers[cmdName]) {
                        //console.log("command '" + cmdName + "' exists");

                        /**
                         * @type {Promise}
                         */
                        var result = await this.commandHandlers[cmdName](peerId, fragment.cmd, fragment.args, fragment.tid);
                        msg.addResponse(cmdName, JSON.stringify(result), fragment.tid);
                        

                    } else {
                        //Command does not exist.
                        msg.addResponse(cmdName, "501", fragment.tid);
                    }
                //console.log('received command, args: ' + JSON.stringify(command))
                //this.notifications.receivedCommand(peerId, command)
                // throw new Error('unknown command')
            }
            this.sendCommandObj(peerId, msg)
        })();
    }
    _processResponse(peerId, response) {
        //this.callBacks
        console.log("tid is " + response.tid)
        if (this.callBacks[response.tid]) {
            this.callBacks[response.tid](null, response);
            delete this.callBacks[response.tid]; //Clean up old callbacks.
        }
    }
    // handle errors on the receiving channel
    _receiveError(err) {
        console.error('ReceiveError: %s', err.message)
    }

    // handle new peers
    _onPeerConnected(peerInfo) {
        //console.log('_onPeerConnected ' + peerId.id.toB58String())
    }

    // handle peers being disconnected
    _onPeerDisconnected(peerInfo) {
        // this.engine.peerDisconnected(peerId)
        //console.log('_onPeerDisconnected ', peerId.id.toB58String())
    }
    _receiveMessage(peerId, incoming) {
        return new Promise((resolve, reject) => {
            //console.log(`received MSG from ${PeerId.toB58String()}`)

            if (incoming.fragments.size === 0) {
                return reject();
            }

            const fragments = Array.from(incoming.fragments.values())
            each(fragments, (fragment) => {
                //console.log("fragments: " + fragment)
                // TODO  process commands here.
                switch (fragment.type) {
                    case 1:
                        // command
                        console.log(`received Command : ${fragment.cmd.toString()}`)
                        this._processCommand(peerId, fragment)
                        break
                    case 2:
                        // response
                        console.log(`received response ${fragment.tid.toString()} : ${fragment.cmd.toString()}`)
                        this._processResponse(peerId, fragment)
                        break
                    default:
                        reject(new Error('unknown fragment type'))
                }
            })
        });
    }
    /**
     * @param {String} protocol
     * @param {*} conn 
     */
    _onConnection(protocol, conn) {
        if (!this._running) { return; }
        //console.log("Incoming message")
        pull(
            conn,
            lp.decode(),
            pull.asyncMap((data, cb) => CmdSignal.deserializeCallback(data, cb)), //Convert logic to promise
            pull.asyncMap((msg, cb) => {
                conn.getPeerInfo((err, peerInfo) => {
                    if (err) { return cb(err); }
                    //console.log("getting message")
                    this._receiveMessage(peerInfo.id, msg);
                });
            }),
            pull.onEnd((err) => {
                console.log('ending connection');
                if (err) {
                    this._receiveError(err);
                }
            })
        );
    }
    /**
     * Copy this function to create your own command.
     * Type = 1 is request; Type = 2 is response.
     * Use promise to respond to any requests.
     * If response, return no value on promise
     * 
     * @param {PeerId} PeerId 
     * @param {String} cmd 
     * @param {Object} args 
     * @param {String} tid
     * @returns {Promise} 
     */
    _exampleCommand(PeerId, cmd, args, tid) {
        console.log(cmd)
        return new Promise((resolve, reject) => {
            //Do something here!
            resolve("This is example command.")
        });
    }
}
exports = module.exports = ProtocolHandler;