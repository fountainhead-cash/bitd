const MongoClient = require('mongodb').MongoClient
var db
var mongo
var config
var init = function(_config) {
  config = _config
  return new Promise(function(resolve) {
    MongoClient.connect(_config.url, {useNewUrlParser: true}, function(err, client) {
      if (err) console.log(err)
      db = client.db(_config.name)
      mongo = client
      resolve()
    })
  })
}
var exit = function() {
  return new Promise(function(resolve) {
    mongo.close()
    resolve()
  })
}
var mempool =  {
  insert: function(item) {
    return db.collection('unconfirmed').insertMany([item])
  },
  reset: async function() {
    await db.collection('unconfirmed').deleteMany({}).catch(function(err) {
      console.log('## ERR ', err)
      process.exit()
    })
  },
  sync: async function(items) {
    await db.collection('unconfirmed').deleteMany({}).catch(function(err) {
      console.log('## ERR ', err)
    })
    let index = 0
    while (true) {
      let chunk = items.splice(0, 1000)
      if (chunk.length > 0) {
        await db.collection('unconfirmed').insertMany(chunk, { ordered: false }).catch(function(err) {
          // duplicates are ok because they will be ignored
          if (err.code !== 11000) {
            console.log('## ERR ', err, items)
            process.exit()
          }
        })
        console.log('..chunk ' + index + ' processed ...', new Date().toString())
        index++
      } else {
        break
      }
    }
    console.log('Mempool synchronized with ' + items.length + ' items')
  }
}
var block = {
  reset: async function() {
    await db.collection('confirmed').deleteMany({}).catch(function(err) {
      console.log('## ERR ', err)
      process.exit()
    })
  },
  replace: async function(items, block_index) {
    console.log('Deleting all blocks greater than or equal to', block_index)
    await db.collection('confirmed').deleteMany({
      'blk.i': {
        $gte: block_index
      }
    }).catch(function(err) {
      console.log('## ERR ', err)
      process.exit()
    })
    console.log('Updating block', block_index, 'with', items.length, 'items')
    let index = 0
    while (true) {
      let chunk = items.slice(index, index+1000)
      if (chunk.length > 0) {
        await db.collection('confirmed').insertMany(chunk, { ordered: false }).catch(function(err) {
          // duplicates are ok because they will be ignored
          if (err.code !== 11000) {
            console.log('## ERR ', err, items)
            process.exit()
          }
        })
        console.log('\tchunk ' + index + ' processed ...')
        index+=1000
      } else {
        break
      }
    }
  },
  insert: async function(items, block_index) {
    let index = 0
    while (true) {
      let chunk = items.slice(index, index+1000)
      if (chunk.length > 0) {
        try {
          await db.collection('confirmed').insertMany(chunk, { ordered: false })
          console.log('..chunk ' + index + ' processed ...')
        } catch (e) {
          // duplicates are ok because they will be ignored
          if (e.code !== 11000) {
            console.log('## ERR ', e, items, block_index)
            process.exit()
          }
        }
        index+=1000
      } else {
        break
      }
    }
    console.log('Block ' + block_index + ' inserted ')
  },
  index: async function() {
    console.log('* Indexing MongoDB...')
    console.time('TotalIndex')

    if (config.index) {
      let collectionNames = Object.keys(config.index)
      for(let j=0; j<collectionNames.length; j++) {
        let collectionName = collectionNames[j]
        let keys = config.index[collectionName].keys
        let fulltext = config.index[collectionName].fulltext

        console.log('Indexing tx.h');
        console.time('Unique Index: tx.h')
        try {
          await db.collection(collectionName).createIndex({'tx.h': 1}, { unique: true })
        } catch (e) {
          console.log(e)
          process.exit()
        }
        console.timeEnd('Unique Index: tx.h')
        console.log('* Created unique index for ', 'tx.h')

        if (keys) {
          console.log('Indexing keys... [' + keys.join(',') + ']')
          console.time('Indexing');
          try {
            const keyPatterns = keys.map(k => ({ 'key': { [k]: 1 } }));
            console.log(keyPatterns);
            await db.collection(collectionName).createIndexes(keyPatterns);
          } catch (e) {
            console.log(e)
            process.exit()
          }
          console.timeEnd('Indexing');
        }

        if (fulltext) {
          console.log('Creating full text index...')
          let o = {}
          fulltext.forEach(function(key) {
            o[key] = 'text'
          })
          console.time('Fulltext search for ' + collectionName, o)
          try {
            await db.collection(collectionName).createIndex(o, { name: 'fulltext' })
          } catch (e) {
            console.log(e)
            process.exit()
          }
          console.timeEnd('Fulltext search for ' + collectionName)
        }
      }
    }

    console.log('* Finished indexing MongoDB...')
    console.timeEnd('TotalIndex')

    try {
      let result = await db.collection('confirmed').indexInformation({full: true})
      console.log('* Confirmed Index = ', result)
      result = await db.collection('unconfirmed').indexInformation({full: true})
      console.log('* Unconfirmed Index = ', result)
    } catch (e) {
      console.log('* Error fetching index info ', e)
      process.exit()
    }
  },
  dropindexes: async function() {
    console.log('* Dropping all MongoDB Indexes...')
    console.time('TotalDropIndex')

    try {
      console.time('Drop Indexes: confirmed')
      await db.collection('confirmed').dropIndexes();
      console.timeEnd('Drop Indexes: confirmed')
    } catch (e) {
      console.log('* Error dropping indexes', e)
      process.exit()
    }

    try {
      console.time('Drop Indexes: unconfirmed')
      await db.collection('unconfirmed').dropIndexes();
      console.timeEnd('Drop Indexes: unconfirmed')
    } catch (e) {
      console.log('* Error dropping indexes', e)
      process.exit()
    }

    console.log('* Finished dropping all MongoDB Indexes...')
    console.timeEnd('TotalDropIndex')
  }
}
module.exports = {
  init: init, exit: exit, block: block, mempool: mempool
}
