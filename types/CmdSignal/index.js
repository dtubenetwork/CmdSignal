const protons = require('protons')
const each = require('async/each')
const pbm = protons(require('./index.proto'))

/**
 * Command signal protocol.
 * A basic protocol to handle multiple commands, arguments and responses.
 */
class CmdSignal {
    constructor() {
        this.fragments = new Map()
    }
    /**
     * 
     * @param {String} cmd 
     * @param {Object} args 
     * @param {String} tid 
     * @returns {String}
     */
    addCommand(cmd, args, tid) {
        //Creates new tid, if non is specified
        if (!tid | tid === null) {
            tid = String(Math.random())
        } else {
            tid = tid.toString()
        }

        if (args) {
            // console.log('[addCommand] adding args to command ', args)
            this.fragments.set(tid, {
                type: 1,
                tid: Buffer.from(tid),
                cmd: Buffer.from(cmd),
                args: Buffer.from(args)
            })
        } else {
            this.fragments.set(tid, {
                type: 1,
                tid: Buffer.from(tid),
                cmd: Buffer.from(cmd)
            })
        }
        return tid; //Must return TID.
    }
    /**
     * 
     * @param {String} cmd 
     * @param {Object} args 
     * @param {String} tid 
     * @returns {String}
     */
    addResponse(cmd, args, tid) {
        if (!tid) {
            tid = String(Math.random())
        } else {
            tid = tid.toString()
        }

        if(args) {
            this.fragments.set(tid, {
                type: 2,
                tid: Buffer.from(tid),
                cmd: Buffer.from(cmd),
                args: Buffer.from(args)
            })
        } else {
            this.fragments.set(tid, {
                type: 2,
                tid: Buffer.from(tid),
                cmd: Buffer.from(cmd)
            })
        }
        return tid;
    }
    serialize() {
        const msg = {
            // hello: this.hello,
            // commands: Array.from(this.commands.values()),
            // responses: Array.from(this.responses.values())
            fragments: Array.from(this.fragments.values())
        }
        
        //console.log(this.fragments.values())
        return pbm.Message.encode(msg)
    }
}
CmdSignal.deserialize = (raw) => {
    return new Promise((resolve, reject) => {
        let decoded
        try {
            decoded = pbm.Message.decode(raw)
        } catch (err) {
            reject(err)
        }
        //console.log(decoded)
        // const isFull = (decoded.wantlist && decoded.wantlist.full) || false
        // const msg = new BitswapMessage(isFull)
        const msg = new CmdSignal();
        if (decoded.fragments.length > 0) {
            return each(decoded.fragments,
                (fragment, cb) => {
                    switch (fragment.type) {
                        case 1:
                            // command
                            
                            msg.addCommand(fragment.cmd, fragment.args, fragment.tid.toString())
                            break
                        case 2:
                            // response
                            msg.addResponse(fragment.cmd, fragment.args, fragment.tid.toString())
                            break
                        default:
                            throw new Error('unknown fragment type')
                    }
                    cb()
                }, (err) => {
                    if (err) throw err
                    resolve(msg)
                })
        }
    })
}
CmdSignal.deserializeCallback = (raw, cb) => {
    var promise = CmdSignal.deserialize(raw)
    promise.then((data) => {
        //console.log("test data: " + data)
        cb(null, data)
    })
}
exports = module.exports = CmdSignal