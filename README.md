## What is Bitd?

Bitd is a scraper for Bitcoin Cash that fetches transaction data from the blockchain and stores it in a MongoDB database. You need to install this to set up bitserve and run a bitdb node. This scraper is currently very unoptimized, so expect a long initial sync time.

## Installation

### Prerequisite
First you need to do the following:
1. Install Bitcoin ABC or equivilant node software on your server
2. Install the latest versions of NPM and Nodejs on your server
2. Install MongoDB on your server

Before sync, set up your bitcoin.conf file to meet the requirements set by bitd. 

An example configuration file can be found below:
```
# location to store blockchain and other data.
datadir=/data/Bitcoin
dbcache=4000
# Must set txindex=1 so Bitcoin keeps the full index
txindex=1

# [rpc]
# Accept command line and JSON-RPC commands.
server=1
# Choose a strong password here
rpcuser=root
rpcpassword=bitcoin

# If you want to allow remote JSON-RPC access
rpcallowip=0.0.0.0/0
# [wallet]
disablewallet=1

# [ZeroMQ]
# ZeroMQ messages power the realtime BitDB crawler
# so it's important to set the endpoint
zmqpubrawtx=tcp://127.0.0.1:28332
zmqpubhashblock=tcp://127.0.0.1:28332

# BitDB makes heavy use of JSON-RPC so it's set to a higher number
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

Configure bitd:
```
cp .env.example .env
$(EDITOR) .env
# note, you should only have to change rpc_user and rpc_pass normally
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

#### BitD keeps crashing on bigger blocks
```
pm2 start index.js --node-args="--max_old_space_size=8192"
```

#### This is taking ages

The current version of BitD takes heavy use of json-rpc, which is very unoptimized for this particular workload. We are working on possible workarounds for this issue, but for now try increasing rpcworkqueue in your bitcoin.conf file should make the process slightly faster.


## Credits

2018 Unwriter

2018-Current Fountainhead-Cash Developers
