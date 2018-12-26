const express = require('express');   //引入express模块
const Parameter = require('parameter')
const session = require('express-session')
const md5 = require('blueimp-md5')
const jwt = require('jwt-simple')
const moment = require('moment')
const mysql = require('mysql');     //引入mysql模块
const app = express();        //创建express的实例
const connection = require('./connection.js') //引入连接数据库模块
const bodyParser = require('body-parser')
// 解析 application/json
app.use(bodyParser.json()); 
// 解析 application/x-www-form-urlencoded
app.use(bodyParser.urlencoded());
//解决跨域问题
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization,\'Origin\',Accept,X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('X-Powered-By', ' 3.2.1');
  res.header('Content-Type', 'application/json;charset=utf-8');
  if (req.method === 'OPTIONS') {
      res.sendStatus(200);
  } else {
      next();
  }
});

connection.connect();


// -----------登录---------------
app.post('/login',function (req,res) {
  let username = req.body.username
  let password = req.body.password
  //密码加密 第一次
  password = md5(password)
  //密码加密 第二次
  password = md5(password)
  console.log(password)
  const loginSql = 'SELECT * FROM users where phone = "'+username+`" and password = "` + password + `"`;
  console.log(loginSql)

  
  new Promise((resolve, reject) => {
    connection.query(
      'SELECT * FROM users where phone = ? and password = ?',
      [username, password] , 
      (err, result) => {
        if(err){
          console.log(err.message)
          reject(err)
        }
        if(result.length > 0 ) {
          res.send({
            message: "登录成功",
            status: 1,
            user: result[0]
          })
          resolve(result)
        }else {
          res.send({
            message: "登录失败",
            status: 0
          })
          reject(err)
        }
      }
    )
  }).then(() => {
    console.log(123)
  })
  
  

});
// -----------注册---------------
app.post('/register',function (req,res) {
  let username = req.body.username
  let password = req.body.password
  const emailConfirm = new RegExp("(^1[3,4,5,6,7,9,8][0-9]{9}$|14[0-9]{9}|15[0-9]{9}$|18[0-9]{9}$)")
  // 手机验证
  let sqlName = ""
  const phoneConfirm = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/
  if( phoneConfirm.test(username)){
    sqlName = `email`
    console.log("邮箱")
  }else if(emailConfirm.test(username)){
    sqlName = `phone`
    console.log("手机")
  }
  //密码加密 第一次
  password = md5(password)
  //密码加密 第二次
  password = md5(password)
  console.log(password)
  //邮箱验证
  
  new Promise((resolve, reject) => {
    connection.query(`SELECT * FROM users where `+ sqlName + ` = ?`,[username] , 
    (err, result) => {
      //如果err reject
        if(err){
          console.log(err.message)
          reject(err)
        }
        // 邮箱或手机号码存在 reject
        if(result.length > 0 ) {
          res.send({
            message: "邮箱或手机号码已注册",
            status: 0,
          })
          reject("邮箱或手机号码已注册")
        }else {
          
          // 邮箱或手机号码未注册 继续注册
          resolve("邮箱或手机号码可注册")
        }
      }
    )
  }).then(() => {
    function getId() {
      return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    }
    const selectSql = ``
    connection.query(`INSERT users(id,user_id,`+sqlName+`,PASSWORD) VALUES(?,?,?,?)`,
      [getId(),"user6",username,password] , 
      (err, result) => {
        if(err){
          console.log("注册出错")
          res.send({
            message: "服务器出错",
            status: 0,
          })
          return
        }
        res.send({
          message: "注册成功",
          status: 1,
        })
        console.log(result)
        console.log("注册成功")
      }
    )
  })
  
  

});


app.listen(3001,function () {    ////监听3000端口
    console.log('Server running at 3001 port');
});
