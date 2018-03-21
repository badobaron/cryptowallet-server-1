

import Kapitalize from 'kapitalize'

var config = require('config')
const host = config.get("appConfig.btc.host")
const port = config.get("appConfig.btc.port")
const username = config.get("appConfig.btc.username")
const pwd = config.get("appConfig.btc.password")


let kapitalize = new Kapitalize()

kapitalize
    .auth(username, pwd)
    .set('host', host)
    .set({
        port:port
    });

//显示当前连接的比特币测试网络信息
kapitalize.getblockcount(function(err,result) {
	if (err) return console.log(err);
	console.log('btc chain block number is:', result)
});

module.exports = kapitalize