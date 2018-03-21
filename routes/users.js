

var express = require('express')
var User = require('../model/user')
var web3 = require('../comm/web3Wrapper')
var client = require('../comm/btcWrapper')
var router = express.Router()
var jwt = require('jwt-simple')
var url = require('url')
var jwtAuth = require('../comm/jwtAuth')
var jwtAuthEvent = require('../comm/jwtAuthEvent')
var moment = require('moment')
var config = require('config')

/* GET users listing. */
router.post('/register', function (req, res, next) {
  let username = req.body.username.replace(/^\s+|\s+$/g,"")
  let password = req.body.userpwd.replace(/^\s+|\s+$/g,"")

  if(username=='' || password==''){
      return res.json({ resultCode: "4003", resultMessage: "非法输入" })
  }

    User.findOne({username: username}, function (err, user) {
        if (user) {
            return res.json({resultCode: "4002", resultMessage: "用户已存在"})
        }
        //let account = web3.eth.accounts.create()
        let suser = new User({
            username: username,
            userpwd: password,
            accountBlance: 0
        })

        //创建BTC账户
        client.getnewaddress("mywallet",function(err,newaddress){
          if (err) return console.log(err)  
            suser.btcAddress = newaddress
          client.dumpprivkey(newaddress,function(err,privateKey){
            if (err) return console.log(err)
              console.log('privateKey:',privateKey)        
            suser.btcPrivateKey = privateKey
                //创建ETH账户
                web3.eth.personal.newAccount(password).then(function(newaddress){
                  suser.ethAddress = newaddress
                  suser.ethPassword = password
                  suser.save(function (error, result) {
                    if (error) {
                      res.json({resultCode: "4001", resultMessage: '注册失败'})
                    }
                    else {
                      res.json({resultCode: "1000", resultMessage: '注册成功'})
                    }
                  })
                })
              })
        })


    })
});

router.post('/login', function (req, res, next) {
  console.log(req.body)
  User.findOne({ username: req.body.username }, function (err, user) {
    if (err) {
      res.json({ resultCode: "4002", resultMessage: "登陆失败" })
    }
    else if (!user) {
      res.json({ resultCode: "4003", resultMessage: "用户名不存在" })
    }
    else {
      user.comparePassword(req.body.userpwd, function (err, isValid) {
        if (isValid) {
          var expires = moment().add(7, 'days').valueOf()
          var token = jwt.encode(
            {
              iss: user.id,
              exp: expires
            },
            config.get('appConfig.jwtConfig.jwtTokenSecret')
          );
          //获取BTC余额
          let btcAddress = user.btcAddress
          console.log('btcAddress:',btcAddress)
          client.listunspent(6,9999999,[btcAddress],function(err, array_unspent) {
            console.log(array_unspent)
            let sum_amount=0
            if(array_unspent){
              for(let uu=0;uu<array_unspent.length;uu++){
                let unspent_record=array_unspent[uu]
                if(unspent_record.amount>0){
                  sum_amount+=unspent_record.amount
                }
              }  
            }
            
            console.log(btcAddress ,'balance:', sum_amount)
            //获取ETH余额
            web3.eth.getBalance(user.ethAddress).then(function(result){
              res.json({
                token: token,
                expires: expires,
                resultCode: "1000",
                resultMessage: "登陆成功",
                user: {
                  username: user.username,
                  ethAddress: user.ethAddress,
                  ethBalance: web3.utils.fromWei(result),
                  btcAddress: user.btcAddress,
                  btcBalance: sum_amount+''
                }
              })
            })
          })

        }
        else {
          res.json({ resultCode: "4004", resultMessage: "密码错误" })
        }
      })
    }
  })

});

router.get('/userInfo', jwtAuth, jwtAuthEvent, function (req, res, next) {
  res.json(req.user)
});

router.post('/ethTransfer', jwtAuth, jwtAuthEvent, function (req, res, next) {
    console.log('transfer request is:', req.body)
    let username = req.user.username
    let pwd = ""
    let fromAddress = ""
    let toAddress = req.body.ethAddress
    let amt = req.body.ethValue


    User.findOne({username: username}).then(function (duser) {
        pwd = duser.ethPassword
        fromAddress = duser.ethAddress
        console.log('faddress:', fromAddress, 'pwd:', pwd)

        web3.eth.personal.unlockAccount(fromAddress, pwd, 5).then(function (result) {
            console.log('unlockAccount result:', result)
            if (result) {
                web3.eth.sendTransaction({
                    from: fromAddress,
                    to: toAddress,
                    value: amt
                }).on("error", function (e) {
                    res.json({resultCode: "4004", resultMessage: '请检查账户余额'})
                    console.log(e)
                }).on("receipt", function (r) {
                    console.log(r)
                }).then(function(receipt){
                    res.json({resultCode: "1000", resultMessage: '转账申请成功'})
                })
            } else {
                res.json({resultCode: "4003", resultMessage: '请检查账户密码'})
            }
        })
    }).catch(function (reason) {
        res.json({resultCode: "4001", resultMessage: '转账失败'})
        console.error(reason)
    })
})

router.post('/btcTransfer', jwtAuth, jwtAuthEvent, function (req, res, next) {
    console.log('transfer request is:', req.body)
    let username = req.user.username
    let pwd = ""
    let fromAddress = ""
    let toAddress = req.body.address
    let amt = req.body.value

    User.findOne({username: username}).then(function (duser) {
        //pwd = duser.ethPassword
        fromAddress = duser.btcAddress
        console.log('from address is:', fromAddress)

        btcTransfer(fromAddress,toAddress,amt,res)
        
      })
})


function btcTransfer(fromAddress,toAddress,amt,res){
  let MIN_TRANSACTION_FEE=10000; //矿工费用的最小金额，单位satoshi
  //amt = amt*100000000;
  //获取未使用的交易(UTXO)用于构建新交易的输入数据块
  client.listunspent(6,9999999,[fromAddress],function(err, array_unspent) {
    if (err) return console.log('ERROR[listunspent]:',err);
        //console.log('Unspent:', array_unspent);
        var array_transaction_in=[];
        var sum_amount=0;
        //var sum_amount = new BigNumber('0');
        for(var uu=0;uu<array_unspent.length;uu++){
          var unspent_record=array_unspent[uu];
          if(unspent_record.amount>0){
                sum_amount+=unspent_record.amount*100000000; //注意:因为JS语言缺省不支持64位整数，此处示例程序简单采用32位整数，只能处理交易涉及金额数值不大于0xFFFFFFF即4294967295 satoshi = 42.94967295 BTC。 实际应用程序需留意完善能处理64位整数
                //sum_amount.plus(unspent_record.amount*100000000).toString(10);
                array_transaction_in[array_transaction_in.length]={"txid":unspent_record.txid,"vout":unspent_record.vout};
                if( sum_amount > (amt+MIN_TRANSACTION_FEE) )
                  break;
              }
            }

        //确保新交易的输入金额满足最小交易条件
        if (sum_amount<amt+MIN_TRANSACTION_FEE) return console.log('valid fail. sum_amount:', sum_amount,'amt:',amt,'MIN_TRANSACTION_FEE:',MIN_TRANSACTION_FEE)  

        console.log('Transaction_in:', array_transaction_in);

        //生成测试新交易的输出数据块，此处示例是给指定目标测试钱包地址转账一小笔测试比特币
        //注意：输入总金额与给目标转账加找零金额间的差额即MIN_TRANSACTION_FEE，就是支付给比特币矿工的交易成本费用
        var obj_transaction_out={
            [toAddress]:amt/100000000,   //目标转账地址和金额
            [fromAddress]:(sum_amount-amt-MIN_TRANSACTION_FEE)/100000000  //找零地址和金额，默认用发送者地址
          }

          console.log('Transaction_out:', obj_transaction_out);

        //生成交易原始数据包
        client.createrawtransaction(array_transaction_in,obj_transaction_out,function(err2, rawtransaction) {
          if (err2) return console.log('ERROR[createrawtransaction]:',err2);
          console.log('Rawtransaction:', rawtransaction);

            //签名交易原始数据包
            client.signrawtransaction(rawtransaction,function(err3, signedtransaction) {
              if (err3) return console.log('ERROR[signrawtransaction]:',err3);
              console.log('Signedtransaction:', signedtransaction);

              var signedtransaction_hex_str=signedtransaction.hex;
              console.log('signedtransaction_hex_str:', signedtransaction_hex_str);

                //广播已签名的交易数据包
                client.sendrawtransaction(signedtransaction_hex_str,false,function(err4, sended) { 
                  if (err4) return console.log('ERROR[sendrawtransaction]:',err4);
                  console.log('Sended TX:', sended);

                  res.json({resultCode: "1000", resultMessage: '转账申请成功'})
                });
              });
          });
      });
}


module.exports = router;
