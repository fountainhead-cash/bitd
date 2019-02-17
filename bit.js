const bch = require('bitcore-lib-cash')
const zmq = require('zeromq')
const RpcClient = require('bitcoind-rpc')
const TNA = require('fountainhead-tna')
const pLimit = require('p-limit')
const pQueue = require('p-queue')
const Config = require('./config.js')
const queue = new pQueue({concurrency: Config.rpc.limit})

var Db
var Info
var rpc
var processor

const init = function(db, info) {
  return new Promise(function(resolve) {
    Db = db
    Info = info

    rpc = new RpcClient(Config.rpc)
    resolve()
  })
}
const request = {
  block: function(block_index) {
    return new Promise(function(resolve) {
      rpc.getBlockHash(block_index, function(err, res) {
        if (err) {
          console.log('Err = ', err)
          throw new Error(err)
        } else {
          rpc.getBlock(res.result, 0, function(err, block) {
            resolve(bch.Block.fromString(block.result))
          })
        }
      })
    })
  },
  /**
  * Return the current blockchain height
  */
  height: function() {
    return new Promise(function(resolve) {
      rpc.getBlockCount(function(err, res) {
        if (err) {
          console.log('Err = ', err)
          throw new Error(err)
        } else {
          resolve(res.result)
        }
      })
    })
  },
  tx: async function(hash) {
    let content = await TNA.fromHash(hash, Config.rpc)
    return content
  },
  mempool: function() {
    return new Promise(function(resolve) {
      rpc.getRawMemPool(async function(err, ret) {
        if (err) {
          console.log('Err', err)
        } else {
          let tasks = []
          const limit = pLimit(Config.rpc.limit)
          let txs = ret.result
          console.log('txs = ', txs.length)
          for(let i=0; i<txs.length; i++) {
            tasks.push(limit(async function() {
              let content = await request.tx(txs[i]).catch(function(e) {
                console.log('Error = ', e)
              })
              return content
            }))
          }
          let btxs = await Promise.all(tasks)
          resolve(btxs)
        }
      })
    })
  }
}
const crawl = async function(block_index) {
  let block = await request.block(block_index)

  let btxs = []
  for (let tx of block.transactions) {
    let tna = await TNA.fromGene(tx)
    tna.blk = {
      i: block_index,
      h: block.header.hash,
      t: block.header.time
    }

    btxs.push(tna)
  }

  console.log('Block ' + block_index + ' : ' + btxs.length + 'txs')
  return btxs
}

const outsock = zmq.socket('pub')
const listen = function() {
  let sock = zmq.socket('sub')
  sock.connect('tcp://' + Config.zmq.incoming.host + ':' + Config.zmq.incoming.port)
  sock.subscribe('rawtx')
  sock.subscribe('hashblock')
  console.log('Subscriber connected to port ' + Config.zmq.incoming.port)

  outsock.bindSync('tcp://' + Config.zmq.outgoing.host + ':' + Config.zmq.outgoing.port)
  console.log('Started publishing to ' + Config.zmq.outgoing.host + ':' + Config.zmq.outgoing.port)

  // Listen to ZMQ
  sock.on('message', async function(topic, message) {
    if (topic.toString() === 'rawtx') {
      let rawtx = message.toString('hex')
      console.log('New transaction from ZMQ')
      await handle_zmq_tx(rawtx)
    } else if (topic.toString() === 'hashblock') {
      let hash = message.toString('hex')
      console.log('New block hash from ZMQ = ', hash)
      await handle_zmq_block()
    }
  })

  // Don't trust ZMQ. Try synchronizing every 1 minute in case ZMQ didn't fire
  setInterval(async function() {
    await handle_zmq_block()
  }, 60000)
}

const handle_zmq_block = async function() {
  try {
    const lastSynchronized = await Info.checkpoint()
    const currentHeight = await request.height()
    console.log('Last Synchronized = ', lastSynchronized)
    console.log('Current Height = ', currentHeight)

    for(let index=lastSynchronized+1; index<=currentHeight; index++) {
      console.log('RPC BEGIN ' + index, new Date().toString())
      console.time('RPC END ' + index)
      let content = await crawl(index)
      console.timeEnd('RPC END ' + index)
      console.log(new Date().toString())
      console.log('DB BEGIN ' + index, new Date().toString())
      console.time('DB Insert ' + index)

      await Db.block.insert(content, index)

      await Info.updateTip(index)
      console.timeEnd('DB Insert ' + index)
      console.log('------------------------------------------')
      console.log('\n')

      // zmq broadcast
      let b = { i: index, txs: content }
      if (Config.core.verbose) {
        console.log('Zmq block = ', JSON.stringify(b, null, 2))
      }
      outsock.send(['block', JSON.stringify(b)])
    }

    // clear mempool and synchronize
    if (lastSynchronized < currentHeight) {
      console.log('Clear mempool and repopulate')
      let items = await request.mempool()
      await Db.mempool.sync(items)
    }

    if (lastSynchronized === currentHeight) {
      console.log('no update')
      return null
    } else {
      console.log('[finished]')
      return currentHeight
    }
  } catch (e) {
    console.log('Error', e)
    console.log('Shutting down Bitdb...', new Date().toString())
    await Db.exit()
    process.exit()
  }
}

const handle_zmq_tx = async function(rawtx) {
  queue.add(async function() {
    let tx = new bch.Transaction(rawtx);
    let tna = await TNA.fromGene(tx);
    try {
      await Db.mempool.insert(tna)
      console.log('# Q inserted [size: ' + queue.size + ']',  tna.tx.h)
      if (Config.core.verbose) {
        console.log(tna)
      }
      outsock.send(['mempool', JSON.stringify(tna)])
    } catch (e) {
      // duplicates are ok because they will be ignored
      if (e.code == 11000) {
        console.log('Duplicate mempool item: ', tna.tx.h)
      } else {
        console.log('## ERR ', e, tna)
        process.exit()
      }
    }
  })
}
const run = async function() {

  // initial block sync
  await handle_zmq_block()

  // initial mempool sync
  console.log('Clear mempool and repopulate')
  let items = await request.mempool()
  await Db.mempool.sync(items)
}
module.exports = {
  init: init, crawl: crawl, listen: listen, run: run
}
