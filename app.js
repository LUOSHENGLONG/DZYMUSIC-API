const express = require('express')   //引入express模块
const Parameter = require('parameter')
const session = require('express-session')
const md5 = require('blueimp-md5')
// const jwt = require('jwt-simple')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mysql = require('mysql');     //引入mysql模块
const NedbStore = require('nedb-session-store')( session );
const sessionMiddleware = session({
    secret: "fas fas",
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000   // e.g. 1 year
    },
    store: new NedbStore({
      filename: 'path_to_nedb_persistence_file.db'
    })
  })

const app = express();        //创建express的实例
const connection = require('./connection.js') //引入连接数据库模块
const bodyParser = require('body-parser')
app.use(sessionMiddleware);

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
                  expiresIn: 60*60*1  // 1小时过期
              });
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
// -----------注册---------------
app.post('/register',function (req,res) {
  let username = req.body.username
  let password = req.body.password
  const phoneConfirm = new RegExp("(^1[3,4,5,6,7,9,8][0-9]{9}$|14[0-9]{9}|15[0-9]{9}$|18[0-9]{9}$)")
  // 手机验证
  let sqlName = ""
  const emailConfirm = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/
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

// ------------synthesizer---------------
app.post('/synth',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query('SELECT count(id) FROM article where type = "synthesizer"',(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
    })
  }).then((count) => {
    connection.query(`SELECT id,type,title,content,look,issuer,releaseTime,img FROM article where type = "synthesizer" ORDER BY releaseTime,id desc limit ?,?`,
    [(req.body.currentPage-1)*10,9],
    (err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      if(result.length > 0) {
        res.send({
          count: count,
          data: result
        })
      }
    })
  }).catch(err => {
    console.log(err)
  })
})

// ------------effects---------------
app.post('/effects',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query('SELECT count(id) FROM article where type = "effects"',(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
    })
  }).then((count) => {
    connection.query(`SELECT id,type,title,content,look,issuer,releaseTime,img FROM article where type = "effects" ORDER BY releaseTime,id desc limit ?,?`,
    [(req.body.currentPage-1)*10,9],
    (err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      if(result.length > 0) {
        res.send({
          count: count,
          data: result
        })
      }
    })
  }).catch(err => {
    console.log(err)
  })
})

// ------------samplePack---------------
app.post('/samplePack',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query('SELECT count(id) FROM article where type = "samplePack"',(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
    })
  }).then((count) => {
    connection.query(`SELECT id,type,title,content,look,issuer,releaseTime,img FROM article where type = "samplePack" ORDER BY releaseTime,id desc limit ?,?`,
    [(req.body.currentPage-1)*10,9],
    (err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      if(result.length > 0) {
        res.send({
          count: count,
          data: result
        })
      }
    })
  }).catch(err => {
    console.log(err)
  })
})

// ------------tutorial---------------
app.post('/tutorial',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query('SELECT count(id) FROM article where type = "tutorial"',(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
    })
  }).then((count) => {
    connection.query(`SELECT id,type,title,content,look,issuer,releaseTime,img FROM article where type = "tutorial" ORDER BY releaseTime,id desc limit ?,?`,
    [(req.body.currentPage-1)*10,9],
    (err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      if(result.length > 0) {
        res.send({
          count: count,
          data: result
        })
      }
    })
  }).catch(err => {
    console.log(err)
  })
})

// ------------host---------------
app.post('/host',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query('SELECT count(id) FROM article where type = "host"',(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
    })
  }).then((count) => {
    connection.query(`SELECT id,type,title,content,look,issuer,releaseTime,img FROM article where type = "host" ORDER BY releaseTime,id desc limit ?,?`,
    [(req.body.currentPage-1)*10,9],
    (err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      if(result.length > 0) {
        res.send({
          count: count,
          data: result
        })
      }
    })
  }).catch(err => {
    console.log(err)
  })
})

// ------------info---------------
app.post('/info',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query(`SELECT * FROM article where id = ?`,[req.body.id],(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
      
    })
  })
  .then(result => {
    res.send({
      data: result
    })
  })
  .catch(err => {
    console.log(err)
  })
})

// ------------rightData1---------------
app.post('/rightData1',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query(`SELECT id,title FROM article order by releaseTime,id desc limit 0,9`,(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result)
      
    })
  })
  .then(result => {
    res.send({
      data: result
    })
  })
  .catch(err => {
    console.log(err)
  })
})

// ------------rightData2---------------
app.post('/rightData2',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query(`SELECT id,title FROM article order by "like",id desc limit 0,9`,(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result)
      
    })
  })
  .then(result => {
    res.send({
      data: result
    })
  })
  .catch(err => {
    console.log(err)
  })
})
// ------------search---------------
app.post('/search',function(req, res) {
  console.log(req.body)
  const keyword = `%` + req.body.keyword + `%`
  new Promise((resolve,reject) => {
    connection.query('SELECT count(id) FROM article where title like ?',[keyword],(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
    })
  }).then((count) => {
    connection.query(`SELECT id,type,title,content,look,issuer,releaseTime,img FROM article where title like ? ORDER BY releaseTime,id desc limit ?,?`,
    [keyword, (req.body.currentPage-1)*10,9],
    (err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      if(result.length > 0) {
        res.send({
          count: count,
          data: result
        })
      }
    })
  }).catch(err => {
    console.log(err)
  })
})
app.listen(3001,function () {    ////监听3000端口
    console.log('Server running at 3001 port');
});
