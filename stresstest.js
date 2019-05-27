const Config = require('./config.js')
const zmq = require('zeromq')

function start() {
  const outsock = zmq.socket('pub')
  outsock.bindSync('tcp://' + Config.zmq.outgoing_test.host + ':' + Config.zmq.outgoing_test.port)
  console.log('Started publishing test data to ' + Config.zmq.outgoing_test.host + ':' + Config.zmq.outgoing_test.port)
  
  const lineReader = require('readline').createInterface({
    input: require('fs').createReadStream('scripts/raw_tx_data.dat')
  });
  
  lineReader.on('line', function (line) {
    console.log('Line from file:', line);
    outsock.send(['rawtx', line])
  });

}


module.exports = { start: start };
