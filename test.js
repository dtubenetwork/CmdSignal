const libp2p = require('libp2p');
const TCP = require('libp2p-tcp');
const mplex = require('libp2p-mplex');
const SPDY = require('libp2p-spdy');
const SECIO = require('libp2p-secio');
const KadDHT = require('libp2p-kad-dht');
const PeerInfo = require('peer-info');
const defaultsDeep = require('@nodeutils/defaults-deep');
const multiaddr = require('multiaddr');

const Network = require('./Network')
const ProtocolHandler = require('./ProtocolHandler')


const DEFAULT_PROPS = {
    modules: {
        transport: [TCP],
        streamMuxer: [SPDY, mplex],
        connEncryption: [SECIO],
        dht: KadDHT
    },
    config: {
        dht: {
            enabled: true,
            kBucketSize: 20
        }
    }
};

class TestNode extends libp2p {
    constructor(_options) {
        super(defaultsDeep(_options, DEFAULT_PROPS));
    }
}

function createNode() {
    return new Promise((resolve, reject) => {
        let node;

        PeerInfo.create((err, peerInfo) => {
            peerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0');
            peerInfo.multiaddrs.add('/ip6/::/tcp/0');
            node = new TestNode({
                peerInfo: peerInfo
            });

            node.start(() => {
                resolve(node);
            });
        });
    });

}
//console.log(createNode())
/**
 * @type {libp2p[]}
*/
var nodes = [];
/**
 * @type {ProtocolHandler[]}
 */
var ProtoHandlers = [];

const max_nodes = 2;

/**
 * 
 * @param {libp2p} node 
 */
function getInfo(node) {
    node.peerInfo.multiaddrs.forEach(element => {
        console.log(element.toString());
    });
}
/**
 * 
 * @param {libp2p} node 
 * @returns {multiaddr}
 */
function getFirstMultiaddr(node) {
    return (node.peerInfo.multiaddrs.toArray()[0]);
}
(async () => {
    for (var x = 0; x < max_nodes; x++) {
        /**
         * @type {libp2p} 
         */
        var node = await createNode();
        nodes.push(node);
        //console.log(getFirstMultiaddr(node).toString())
        
        
        console.log("node " + x + " id is " + node.peerInfo.id.toB58String())

        var net = new Network(node);
        var proto = new ProtocolHandler("/cmdsignal/1.0.0", net)
        await net.start();
        proto.start()
        
        ProtoHandlers.push(proto)
        

    }
    var promise = ProtoHandlers[0].sendCommand(ProtoHandlers[1].Network.peerInfo, "commands", "test", 1)
    promise.then((result) => {
        //console.log(result)
        console.log("result " + result.args)
    }).catch((err) => {
        console.log(err)
    })

})();