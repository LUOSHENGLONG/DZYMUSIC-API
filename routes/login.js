const express = require('express')   //引入express模块
const router = express.Router();
router.post('/login',function (req,res) {
    // console.log(req.session)
    let username = req.body.username
    let password = req.body.password
    const phoneConfirm = new RegExp("(^1[3,4,5,6,7,9,8][0-9]{9}$|14[0-9]{9}|15[0-9]{9}$|18[0-9]{9}$)")
    const emailConfirm = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/
    // 手机验证
    let sqlName = ""
    if( emailConfirm.test(username)){
      sqlName = `email`
      console.log("邮箱")
    }else if(phoneConfirm.test(username)){
      sqlName = `phone`
      console.log("手机")
    }else {
      return res.send({
              message: "邮箱或手机号码验证错误",
              status: 0,
            })
    }
    //密码加密 第一次
    password = md5(password)
    //密码加密 第二次
    password = md5(password)
    
    
    new Promise((resolve, reject) => {
      connection.query(
        `SELECT * FROM users where `+ sqlName +` = ? and password = ?`,
        [username, password] , 
        (err, result) => {
          if(err){
            console.log(err.message)
            reject(err)
          }
          if(result.length > 0 ) {
            let content ={name:req.body.name}; // 要生成token的主题信息
            let secretOrPrivateKey="dzymusic" // 这是加密的key（密钥） 
            let token = jwt.sign(content, secretOrPrivateKey, {
                    expiresIn: 60*30*1               // 1小时过期
                });
                console.log(token)
            result[0].token = token    //token写入数据库    
  
            connection.query(
              `UPDATE users SET token= ? WHERE id = ?`,
              [token,result[0].id],
              (err,result) => {
                if(err){
                  console.log(err.message)
                  reject(err)
                }
  
                resolve(result)
  
              }),
            
            resolve(result)
          }else {
            res.send({
              message: "登录失败",
              status: 0
            })
            reject("登录失败")
          }
        }
      )
    }).then((result) => {
      
      req.session.user = result[0]
      res.send({
        message: "登录成功 正在跳转",
        status: 1,
        user: result[0],
        
      })
    }).catch( err => {
      console.log(err)
    })
  });