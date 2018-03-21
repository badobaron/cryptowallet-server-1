
var client = require('./comm/btcWrapper')
var User = require('./model/user')

//var username = req.user.username
var username = 'bb2'
var fromAddress = ""
var toAddress = "0x7cc2b37cf53fdb8aae4cab1acd1fd106316dbab2"
//var amt = req.body.ethValue
var amt = "3000"

var dbConnect = require('./comm/dbConnect');
dbConnect();

User.findOne({username: 'bb2'}).then(function (duser) {
    let pwd = duser.ethPassword
    fromAddress = duser.ethAddress
    console.log('faddress:',fromAddress,'pwd:',pwd)
    //web3.eth.personal.unlockAccount(fromAddress,pwd,200)

}).then(function (result) {

})


let suser = new User({
            username: "bb1",
            userpwd: "",
            accountBlance: 0
        })


function createBtcUser(){
client.getnewaddress("mywallet",function(err,newaddress){
            if (err) return console.log(err)
            console.log('newaddress:',newaddress)    
            suser.btcAddress = newaddress
            client.dumpprivkey(newaddress,function(err,privateKey){
                if (err) return console.log(err)
                console.log('privateKey:',privateKey)        
                suser.btcPrivateKey = privateKey
                suser.save(function (error, result) {
                if (error) {
                    console.log(error)
                    //res.json({resultCode: "4001", resultMessage: '注册失败'})
                }
                else {
                    console.log(result)
                    //res.json({resultCode: "1000", resultMessage: '注册成功'})
                }
            })
            })
        })
}

function getBalance(taddress){
client.listunspent(6,9999999,[taddress],function(err, array_unspent) {
    console.log(array_unspent)
    var sum_amount=0
      for(var uu=0;uu<array_unspent.length;uu++){
          var unspent_record=array_unspent[uu]
          if(unspent_record.amount>0){
              sum_amount+=unspent_record.amount
          }
      }
      console.log(taddress ,'balance:', sum_amount)
      return sum_amount
});
}


function transfer(fromAddress,toAddress,amt){

    let MIN_TRANSACTION_FEE=10000; //矿工费用的最小金额，单位satoshi
    amt = amt*100000000;


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
      if (sum_amount<amt+MIN_TRANSACTION_FEE) return console.log('Invalid unspent amount:',sum_amount);

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
                  
                  client.listaccounts(function(err, account_list) {
                      if (err) return console.log(err);
                      console.log("Accounts list:\n", account_list); //发送新交易成功后，可以核对下账户余额变动情况
                    });
              });
          });
      });
    });
}

//transfer('mkdViLDWCwFFyVRCgfUgy5RxdwJgeTH8uY','mnooaoNeUdGtBNxFdspSVaoRd8GeSbXrdN',1)
getBalance('n2JsFoxjVZGf9aAvXnjGJDHiYGYZJaE49j')	
