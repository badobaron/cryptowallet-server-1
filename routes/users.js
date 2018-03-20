

var express = require('express')
var User = require('../model/user')
var web3 = require('../comm/web3Wrapper')
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
      res.json({ resultCode: "4003", resultMessage: "非法输入" });
      return;
  }

    User.findOne({username: username}, function (err, user) {
        if (user) {
            res.json({resultCode: "4002", resultMessage: "用户已存在"})
            return
        }

        //let account = web3.eth.accounts.create()
        let suser = new User({
            username: username,
            userpwd: password,
            accountBlance: 0
        })


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
          web3.eth.getBalance(user.ethAddress).then(function(result){
            res.json({
            token: token,
            expires: expires,
            resultCode: "1000",
            resultMessage: "登陆成功",
            user: {
                username: user.username,
                ethAddress: user.ethAddress,
                ethBalance: result
            }
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

router.post('/transfer', jwtAuth, jwtAuthEvent, function (req, res, next) {
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



module.exports = router;
