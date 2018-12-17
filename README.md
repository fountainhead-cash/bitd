## Installation

### Prerequisite
First you need to do the following:
1. Install Bitcoin ABC or equivilant node software on your server
2. Install the latest versions of NPM and Nodejs on your server
2. Install MongoDB

Before sync, set up your bitcoin.conf file to meet the requirements set by bitd. 

An example configuration file can be found below:
```
# location to store blockchain and other data.
datadir=/data/Bitcoin
dbcache=4000
# Must set txindex=1 so Bitcoin keeps the full index
txindex=1
​
# [rpc]
# Accept command line and JSON-RPC commands.
server=1
# Default Username and Password for JSON-RPC connections
# BitDB uses these values by default, but if you can change the settings
# By setting the config.json file in BitDB folder
rpcuser=root
rpcpassword=bitcoin
​
# If you want to allow remote JSON-RPC access
rpcallowip=0.0.0.0/0
# [wallet]
disablewallet=1
​
# [ZeroMQ]
# ZeroMQ messages power the realtime BitDB crawler
# so it's important to set the endpoint
zmqpubhashtx=tcp://127.0.0.1:28332
zmqpubhashblock=tcp://127.0.0.1:28332
​
# BitDB makes heavy use of JSON-RPC so it's set to a higher number
# But you can tweak this number as you want
rpcworkqueue=512
```

### Setting up Bitd

Clone this repository:
```
git clone https://github.com/fountainhead-cash/bitd.git
```

Install dependencies:
```
npm install
```

Start bitd:
```
npm start
```

### Running as a daemon

Install PM2 using NPM
```
npm install pm2 -g
```

CD to install location and run bitd
```
pm2 start index.js
```

### Troubleshooting

#### Shit keeps crashing on me (replace 20000 with however much memory in MB you have to spare)
```
pm2 start index.js --node-args="--max_old_space_size=20000"
```
