//引入express模块
const express = require('express')   

const Parameter = require('parameter')

const session = require('express-session')

const md5 = require('blueimp-md5')

const path = require('path')

const svgCaptcha = require('svg-captcha');
// 发送邮件模块
const nodemailer = require('nodemailer');

// const jwt = require('jwt-simple')
const jwt = require('jsonwebtoken')

const moment = require('moment')

// 引入uuid
const uuid = require('node-uuid');

//引入mysql模块
const mysql = require('mysql');

//引入fs模块
const fs = require('fs')

//引入multer模块
const multer = require('multer')
// var upload = multer({dest:'uploads/'});
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

// 限制api请求次数
const rateLimit = require("express-rate-limit");
 
app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
 
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 5
});
 
// only apply to requests that begin with /api/
app.use("/login", apiLimiter);

app.use(sessionMiddleware);

// var upload = require('./routes/upload');
const login = require('./routes/login')


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


// -----------------发送邮件配置 -----------------
let transporter = nodemailer.createTransport({
  // host: 'smtp.ethereal.email',
  service: 'qq', // 使用了内置传输发送邮件 查看支持列表：https://nodemailer.com/smtp/well-known/
  port: 465, // SMTP 端口
  secureConnection: true, // 使用了 SSL
  auth: {
    user: 'music1788@qq.com',
    // 这里密码不是qq密码，是你设置的smtp授权码
    pass: 'pvilpkuuwbcyehdd',
  }
});






app.use(express.static(path.join(__dirname, './public/uploads')));
// app.use('/upload', upload);
// app.use(multer({dest:"./uploads"}).array("file"));

connection.connect();
// const formidable = require('formidable')
// const uuid = require('uuid')
// const mkdirs = require('mkdirs')

let storage = multer.diskStorage({
  // destination:'public/uploads/'+new Date().getFullYear() + (new Date().getMonth()+1) + new Date().getDate(),
  destination(req,res,cb){
    cb(null,'public/uploads/avatar');
  },
  filename(req,file,cb){
    let filenameArr = file.originalname.split('.');
    cb(null,Date.now() + '-' + uuid.v4() + file.originalname.substring(0,file.originalname.indexOf('.')) + '.' + filenameArr[filenameArr.length-1]);
  }
});

let upload = multer({storage});
// 多文件上传
// app.use(upload.array("file"));
// 单文件上传
// app.use(upload.single("file"));

// app.post('/',upload.single('file'),(req,res)=>{
//   console.log(req.body);
//   console.log(req.file);
//   res.send(req.file);
// });

app.post('/fileUpload', upload.single("file"), function(req, res) {
  let filePath = path.join(`./public/uploads/avatar/`+req.file.filename)
  fs.readFile(filePath, (err, result) => {
    if( err ) {
      console.log(err)
      return
    }
    new Promise((resolve, reject) => {
      connection.query('UPDATE users SET avatar = ? WHERE id = ?',
        [`/avatar/`+req.file.filename, req.body.id], (err, result) => {
          if( err ) {
            return console.log(err)
          }
          // 更新头像成功 删除原头像文件
          res.send({avatar: `/avatar/`+req.file.filename})
          fs.unlink(path.join(`./public/uploads/avatar`+req.body.avatar),(err) => {
            if(err) {
              return console.log(err)
            }
            console.log("头像更新成功且已删除原头像文件")
          })
          console.log(result)
        })
    })
  })
})






// -----------登录---------------
app.post('/login',function (req,res) {
  // console.log(req.session)
  console.log("-----------------")
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

  console.log("password:----" + password)
  
  
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
          let token = {}
          if(req.body.toggle) {
            token = jwt.sign(content, secretOrPrivateKey, {
              expiresIn: 60*30*1*24*15                // 1小时过期
            });
          console.log("1hours")
        }else {
            token = jwt.sign(content, secretOrPrivateKey, {
              expiresIn: 60*30*1              // 1小时过期
            });
          console.log("24*15hours")
        }
         
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

// -----------登录验证---------------
app.post('/confirmLogin',(req, res) => {
  let token = req.body.token
  // 验证token 是否失效
  jwt.verify(token, 'dzymusic', (error, decoded) => {
    // token失效
    if (error) {
      res.send({
        isLogin: false
      })
      return
    }
    // token 有效
    new Promise((resolve, reject) => {
      connection.query('SELECT * FROM users WHERE token = ?',[token],(err, result) => {
        if (err) return console.log(err)
        if( result.length > 0 ) {
          res.send({
            isLogin: true,
            user: result[0]
          })
          console.log("sssssssssssssss")
        }else {
          res.send({
            isLogin: false
          })
        }
      })
    })

    
  })
})


// -----------注册---------------
app.post('/register',function (req,res) {
  let username = req.body.username
  let password = req.body.password
  const phoneConfirm = new RegExp("(^1[3,4,5,6,7,9,8][0-9]{9}$|14[0-9]{9}|15[0-9]{9}$|18[0-9]{9}$)")
  // 手机验证
  let sqlName = ""
  let nickname = ""
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
    function randomWord(randomFlag, min, max){
      var str = "",
          range = min,
          arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
      // 随机产生
      if(randomFlag){
          range = Math.round(Math.random() * (max-min)) + min;
      }
      for(var i=0; i<range; i++){
          pos = Math.round(Math.random() * (arr.length-1));
          str += arr[pos];
      }
      return str;
    }
    nickname = randomWord(true,6,8)

    function formatDateTime() {
      const date = new Date()  
      var y = date.getFullYear();  
      var m = date.getMonth() + 1;  
      m = m < 10 ? ('0' + m) : m;  
      var d = date.getDate();  
      d = d < 10 ? ('0' + d) : d;  
      var h = date.getHours();  
      h=h < 10 ? ('0' + h) : h;  
      var minute = date.getMinutes();  
      minute = minute < 10 ? ('0' + minute) : minute;  
      var second=date.getSeconds();  
      second=second < 10 ? ('0' + second) : second;  
      return y + '-' + m + '-' + d+' '+h+':'+minute+':'+second;  
    };
    const selectSql = ``
    connection.query(`INSERT users(id,user_id,`+sqlName+`,PASSWORD,nickname,createTime) VALUES(?,?,?,?,?,?)`,
      [uuid.v4(),nickname,username,password,nickname,formatDateTime()], 
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



app.post('/classify', (req, res) => {
  let type = req.body.type
  let currentPage = req.body.currentPage
  function getData(type, currentPage) {
    console.log(type)
    console.log(currentPage)
    new Promise((resolve,reject) => {
      connection.query('SELECT count(id) FROM article where type = ?', [type], (err, result) => {
        if(err){
          console.log(err)
          reject(err)
          return
        }
        resolve(result[0])
      })
    }).then((count) => {
      connection.query(`SELECT a.content,a.img,a.type,a.description,a.id,a.size,a.releaseTime,a.title,u.nickname as nickname FROM article a LEFT JOIN users u ON a.issuer = u.id where a.type = ? ORDER BY a.releaseTime desc limit ?,?`,
      [type,(currentPage-1)*10,10],
      (err, result) => {
        if(err){
          console.log(err)
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
  }
  getData(type, currentPage)
})



// ------------last---------------
app.post('/last',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query('SELECT count(id) FROM article',(err, result) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0])
    })
  }).then((count) => {
    connection.query(`SELECT a.*,u.nickname as nickname FROM article a LEFT JOIN users u ON a.issuer = u.id ORDER BY releaseTime desc limit ?,?`,
    [(req.body.currentPage-1)*10,10],
    (err, result) => {
      if(err){
        console.log(err)
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
    connection.query(`SELECT a.*,u.nickname as nickname FROM article a LEFT JOIN users u ON a.issuer = u.id WHERE a.id = ?`,[req.body.id],(err, result) => {
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

// ------------search----------SELECT a.content,a.img,a.type,a.description,a.id,a.size,a.releaseTime,a.title,u.nickname as nickname FROM article a LEFT JOIN users u ON a.issuer = u.id where a.type = ? ORDER BY a.releaseTime desc limit ?,?-----
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
    connection.query(
    `SELECT a.content,a.img,a.type,a.description,a.id,a.size,a.releaseTime,a.title,u.nickname as nickname FROM article a LEFT JOIN users u ON a.issuer = u.id where a.title like ? ORDER BY a.releaseTime desc limit ?,?`,
    [keyword, (req.body.currentPage-1)*10,10],
    (err, result) => {
      if(err){
        console.log(err)
        return
      }
      if(result.length > 0) {
        res.send({
          count: count,
          data: result
        })
      }else {
        res.send({
          count: 1,
          data: 0
        })
      }
    })
  }).catch(err => {
    console.log(err)
  })
})

// ------------rightData1---------------
app.post('/rightData1',function(req, res) {
  console.log(req.body)
  new Promise((resolve,reject) => {
    connection.query(`SELECT id,title,type FROM article order by releaseTime desc limit 0,10`,(err, result) => {
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
    connection.query(`SELECT id,title,type FROM article order by "like" desc limit 0,10`,(err, result) => {
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

// ------------homeData---------------
app.post('/homeData',function(req, res) {
  let homeData = []
  console.log(req.body)
  // 0
  getHomeData("synthesizer")
  .then(synthesizer => {
    homeData.push(synthesizer)
  })
  // 1
  getHomeData("effects")
  .then(effects => {
    homeData.push(effects)
  })
  // 2
  getHomeData("samplePack")
  .then(samplePack => {
    homeData.push(samplePack)
  })
  // 3
  getHomeData("tutorial")
  .then(tutorial => {
    homeData.push(tutorial)
  })
  // 4
  getHomeData("host")
  .then(host => {
    homeData.push(host) 
  })
  // 5
  getHomeData("project")
  .then(project => {
    homeData.push(project) 
  })
  // 6
  getHomeData("kontakt")
  .then(kontakt => {
    homeData.push(kontakt) 
  })
  // 7
  getHomeData("preset")
  .then(preset => {
    homeData.push(preset) 
  })
  // 8
  getHomeData("midi")
  .then(midi => {
    homeData.push(midi)
    console.log(11111111111)
    res.send({data: homeData})
  })

})

function getHomeData(type){
  return new Promise((resolve,reject) => {
    connection.query(`SELECT id,title,content,img,releaseTime,type FROM article where type = "${type}" order by releaseTime desc limit 0,10`,(err, type) => {
      if(err){
        console.log(err)
        reject(err)
        return
      }
      resolve(type)
    })
  })
}

// ------------avatar---------------
app.post('/avatar',function(req, res) {
  const userId = req.body.userId
  const blob = req.body.blob
  new Promise((resolve,reject) => {
    connection.query(`INSERT INTO my values(?,?) `,
      [userId,blob],
      (err, result) => {
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

// ------------favorite---------------
app.post('/favorite',function(req, res) {
  const id = uuid.v4()
  const articleId = req.body.articleId
  const nickname = req.body.nickname
  const createTime = new Date().getTime()
  new Promise((resolve,reject) => {
    connection.query(`INSERT INTO favorite VALUES(?,?,?,?)`,
      [id, articleId, nickname, createTime],
      (err, result) => {
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

// ------------getFavorite---------------
app.post('/getFavorite',function(req, res) {
  const articleId = req.body.articleId
  const nickname = req.body.nickname
  new Promise((resolve,reject) => {
    connection.query(`SELECT COUNT(id) as count FROM favorite WHERE articleId = ? and nickname = ?`,
      [articleId, nickname],
      (err, result) => {
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
      isFavorite: result[0].count
    })
  })
  .catch(err => {
    console.log(err)
  })
})

// ------------cancelFavorite---------------
app.post('/cancelFavorite',function(req, res) {
  const articleId = req.body.articleId
  const nickname = req.body.nickname
  new Promise((resolve,reject) => {
    connection.query(`DELETE FROM favorite WHERE articleId = ? and nickname = ?`,
      [articleId, nickname],
      (err, result) => {
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
      cancelFavorite: result
    })
  })
  .catch(err => {
    console.log(err)
  })
})

// ------------sendComment---------------
app.post('/sendComment',function(req, res) {
  const id = uuid.v4()
  const topicId = req.body.topicId
  const topicType = req.body.topicType
  const content = req.body.content
  const fromUid = req.body.fromUid
  const createTime = new Date().getTime()
  const like = req.body.like


  new Promise((resolve,reject) => {
    connection.query(`INSERT INTO comments VALUES(?,?,?,?,?,?,?)`,
      [id, topicId, topicType, content, fromUid, createTime, like],
      (err, result) => {
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

// ------------sendReply---------------
app.post('/sendReply',function(req, res) {
  const id = uuid.v4()
  const commentId = req.body.commentId
  const replyId = req.body.replyId
  const replyType = req.body.replyType
  const content = req.body.content
  const fromUid = req.body.fromUid
  const fromNickname = req.body.fromNickname
  const fromAvatar = req.body.fromAvatar
  const toUid = req.body.toUid
  const createTime = new Date().getTime()


  new Promise((resolve,reject) => {
    connection.query(`INSERT INTO replys VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [id, commentId, replyId, replyType, content, fromUid, fromNickname, fromAvatar, toUid, createTime],
      (err, result) => {
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

// ------------getComment---------------
app.post('/getComment',function(req, res) {
  const id = req.body.id

  new Promise((resolve,reject) => {
    connection.query(
      `SELECT c.id,c.topic_id,c.content,c.createTime,c.from_uid,u.avatar,u.nickname FROM comments c LEFT JOIN users u ON c.from_uid = u.id WHERE c.topic_id = ? ORDER BY c.createTime DESC`,
      [id],
      (err, comments) => {
        if(err){
          console.log(err)
          reject(err)
          return
        }
        resolve(comments)
      }
    )
  })
  //`SELECT r.comment_id,r.content,r.createTime,r.from_uid,r.fromNickname,r.fromAvatar,r.reply_id,r.reply_type,r.to_uid,u.nickname,u.avatar FROM replys r LEFT JOIN users u ON r.to_uid = u.id WHERE r.comment_id = ? ORDER BY r.createTime DESC

  .then(comments => {
    connection.query(
      `SELECT r.comment_id,r.content,r.createTime,r.from_uid,r.fromNickname,r.fromAvatar,r.reply_id,r.reply_type,r.to_uid,u.nickname,u.avatar FROM replys r LEFT JOIN users u ON r.to_uid = u.id WHERE r.comment_id = ? ORDER BY r.createTime DESC
      `,
      [id],
      (err, replys) => {
        if(err){
          console.log(err)
          reject(err)
          return
        }
        res.send({
          comments,
          replys
        })
      }
    )
  })
  .catch(err => {
    console.log(err)
  })
})

app.post('/toUidFormat', function(req, res) {
  new Promise((resolve,reject) => {
    connection.query(
      `SELECT nickname FROM users where id = ? limit 1`,
      [req.body.userId],
      (err, nickname) => {
        if(err){
          console.log(err)
          reject(err)
          return
        }
        resolve(nickname[0])
      }
    )
  })
  .then(nickname => {
    res.send({
      nickname
    })
  })
  .catch(err => {
    console.log(err)
  })
})

// ------------likeData-----------------
app.post('/likeData', function(req, res) {
  const nickname = req.body.nickname
  const currentPage = req.body.currentPage
  console.log(currentPage)
  new Promise((resolve, reject) => {
    connection.query('SELECT count(id) as count FROM favorite  WHERE nickname = ?',
      [nickname],
      (err, count) => {
        if(err) {
          console.log(err)
          reject(err)
          return 
        }
        resolve(count)
      })
  })
  .then( count => {
    connection.query('SELECT a.*,f.nickname FROM favorite f LEFT JOIN article a ON f.articleId = a.id WHERE f.nickname = ? ORDER BY f.createTime DESC limit ?,6',
      [nickname, (currentPage-1)*6],
      (err, data) => {
        if(err) {
          console.log(err)
          reject(err)
          return 
        }
        res.send({
          likeData: data,
          count: count[0]
        })
      })
    
  })
})

// -------------updateNickname ----------------
app.post('/updateNickname',function(req, res) {
  // 查询昵称是否存在
  new Promise((resolve, reject) => {
    connection.query('SELECT count(id) as count FROM users where nickname = ? limit 1',
    [req.body.nickname],(err, result) => {
      if(err) {
        console.log(err)
        reject(err)
        return
      }
      resolve(result[0].count)
    })
  })
  .then( result => {
    console.log(result)
    // 查询昵称是否已存在 不存在result为 0 同时更新到数据库
    if( result === 0) {
      new Promise((resolve, reject) => {
        connection.query('UPDATE users SET nickname = ? where id = ?',
          [req.body.nickname,req.body.userId],(err, result) => {
            if( err ) {
              console.log(err)
              reject(err)
              return
            }
            resolve({code: 0,success: "更新成功"})
          })
      })
      .then( resolve => {
        console.log(resolve.code)
        // 数据库更新成功同时查询数据库并返回结果
        if( resolve.code === 0) {
          connection.query('UPDATE replys SET fromNickname = ? where from_uid = ?',[req.body.nickname,req.body.userId],(err, result) => {
            if(err) {
              console.log(err)
              return
            }
          })
          resolve.nickname = req.body.nickname
          res.send(resolve)
        }
      })
    } else {
      res.send({code: 1,error: "已占用"})
    }
  })
  
})

// ---------------- getCAPTCHA ------------
app.post('/getCAPTCHA', function(req, res) {
  let codeConfig = {
    size: 4, // 验证码长度
    ignoreChars: '0o1i', // 验证码字符中排除0o1i
    noise: 2, // 干扰线条的数量
  }
  const captcha = svgCaptcha.create(codeConfig);
  console.log(captcha.text)
  const text = md5(`music` + captcha.text.toLowerCase())
  console.log(text)
	res.type('svg');
	res.status(200).send({text: text, data: captcha.data});
})

// ------------------ 获取用户投稿 ---------
app.post('/getMyContribute', function(req, res) {
  console.log("resultresu=========ltresult")
  console.log(req.body.userId)
  connection.query('SELECT COUNT(id) as count FROM contribute where userId = ?', [req.body.userId], (err, count) => {
    if(err) {
      console.log(err)
      return 
    }
    connection.query('SELECT * FROM contribute where userId = ? ORDER BY contributeTime DESC limit ?,10',[req.body.userId,(req.body.currentPage-1)*10], (err, pageData) => {
      if(err) {
        console.log(err)
        return 
      }

      res.send({count,pageData})
    } )
  })
  
})

// ------------------ 删除用户投稿 ---------
app.post('/deleteMyContribute', function(req, res) {
  console.log(req.body.id)
  connection.query('DELETE FROM contribute WHERE id = ?',[req.body.id],(err, result) => {
    if(err) {
      console.log(err)
      return 
    }
    res.send(result)
  })
  
})

// app.post('/getContribute', function(req, res) {
//   connection.query("SELECT * FROM contribute ORDER BY contributeTime DESC",(err, result) => {
//     if(err) {
//       console.log(err)
//       return err
//     }
//     console.log(result[0])
//     res.send({result})
//   })
// })
// ------------- 获取投稿 ----------------
app.post('/getContribute', function(req, res) {
  connection.query('SELECT COUNT(id) as count FROM contribute', (err, count) => {
    if(err) {
      console.log(err)
      return 
    }
    connection.query('SELECT * FROM contribute ORDER BY contributeTime DESC limit ?,10',[(req.body.currentPage-1)*10], (err, pageData) => {
      if(err) {
        console.log(err)
        return 
      }

      res.send({count,pageData})
    } )
  })
  
})

// ------------- 批量驳回投稿 ----------------
app.post('/batchReject', function(req, res) {
  console.log(req.body.batchId)
  
  connection.query('UPDATE contribute SET isRelease = -1  WHERE id in (?)',[req.body.batchId], (err, result) => {
    if(err) {
      console.log(err)
      return 
    }
    // res.send({message: "批量驳回投稿成功"})
  })
  
})


// ------------- 批量发布投稿 ----------------
app.post('/batchRelease', function(req, res) {
  connection.query('UPDATE contribute SET isRelease = 1  WHERE id in (?)',[req.body.batchId], (err, result) => {
    if(err) {
      console.log(err)
      return 
    }
    // res.send({message: "批量发布投稿成功"})
  })
  
})

// ------------- 发布所有投稿 ----------------
app.post('/allRelease', function(req, res) {
  connection.query('UPDATE contribute SET isRelease = 1  WHERE isRelease = 0', (err, result) => {
    if(err) {
      console.log(err)
      return 
    }
    // res.send({message: "发布所有投稿成功"})
  })
  
})

// ------------- 驳回所有投稿 ----------------
app.post('/allReject', function(req, res) {
  connection.query('UPDATE contribute SET isRelease = -1  WHERE isRelease = 0', (err, result) => {
    if(err) {
      console.log(err)
      return 
    }
    // res.send({message: "发布所有投稿成功"})
  })
  
})

// ------------- 根据投稿ID 获取 ----------------
app.post('/getArticleById', function(req, res) {
  connection.query('SELECT * FROM contribute WHERE id = ? limit 1', [req.body.id], (err, Article) => {
    if(err) {
      console.log(err)
      return 
    }
    res.send({Article})
  })
  
})


// --------------发布投稿 ------------------
app.post('/releaseSingleArticle', function(req, res) {
  let article  = req.body.article
  const id = article.id
  const title = article.title
  const type = article.type
  const img = article.img
  const content = article.content
  const description = article.description
  const videoLink = article.videoLink
  const downloadLink = article.downloadLink
  const downloadPassword = article.downloadPassword
  const downloadUnzip = article.downloadUnzip
  const issuer = article.userId
  const size = article.size
  const releaseTime = new Date().getTime()
  connection.query('INSERT INTO article VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', 
  [id,title,type,content,description,videoLink,downloadLink,size,downloadPassword,downloadUnzip,0,0,issuer,releaseTime,img], (err, Article) => {
    if(err) {
      console.log(err)
      return 
    }
    connection.query('UPDATE contribute SET isRelease = 1  WHERE id = ?', [id], (err, result) => {
      if(err) {
        console.log(err)
        return 
      }
    })
  })


})





// ------------- submitContribute ---------------

storage = multer.diskStorage({
  // destination:'public/uploads/'+new Date().getFullYear() + (new Date().getMonth()+1) + new Date().getDate(),
  destination(req,res,cb){
    cb(null,'public/uploads/contribute');
  },
  filename(req,file,cb){
    let filenameArr = file.originalname.split('.');
    cb(null,Date.now() + '-' + uuid.v4() + file.originalname.substring(0,file.originalname.indexOf('.')) + '.' + filenameArr[filenameArr.length-1]);
  }
});

upload = multer({storage});
// 提交投稿
app.post('/submitContribute', upload.array("file"), function(req, res) {
  console.log(req.files)
  let imgSrc = []
  req.files.forEach( file => {
    imgSrc.push('/contribute/' + file.filename)
  })
  console.log(req.body.title)
  console.log(imgSrc)
  if( imgSrc.length > 0) {
    imgSrc = JSON.stringify(imgSrc)
  } else {
    imgSrc = null
  }
  
  const id = uuid.v4()
  const userId = req.body.userId 
  const title = req.body.title 
  const type = req.body.type 
  const content = req.body.content 
  const description = req.body.description 
  const videoLink = req.body.videoLink 
  const downloadLink = req.body.downloadLink 
  const downloadPassword = req.body.downloadPassword 
  const downloadUnzip = req.body.downloadUnzip 
  const size = req.body.size 
  // const isRelease = req.body.isRelease 
  // const contributeTime = req.body.contributeTime 
  const contributeTime = new Date().getTime()
  new Promise((resolve, reject) => {
    connection.query('INSERT INTO contribute VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id,userId,title,type,content,description,videoLink,imgSrc,downloadLink,size,downloadPassword,downloadUnzip,0,contributeTime],
      (err, result) => {
        if(err) return console.log(err)
        console.log(result)
        res.send(result)
      }
    )
  })
})

// 查询密保问题
app.post("/getQuestion",(req, res) => {
  connection.query('SELECT * FROM encrypted',
    (err, result) => {
      if(err) return console.log(err)
      res.send(result)
    }
  )
})

// 设置密保问题
app.post("/settingProtect",(req, res) => {
  connection.query('INSERT INTO safe VALUES(?,?,?,?)',
    [uuid.v4(),req.body.userId,req.body.question,md5(req.body.answer)],
    (err, result) => {
      if(err) return console.log(err)
      res.send({code: 1 ,message: "设置密保成功"})
    }
  )
})
// 查询是否设置密保
app.post("/getProtect",(req, res) => {
  connection.query('SELECT count(id) as count FROM safe WHERE userId = ? limit 1',
    [req.body.userId],
    (err, result) => {
      if(err) return console.log(err)
      result = result[0]
      res.send({count: result})
    }
  )
})

// 验证密保
app.post("/verifyProtect",(req, res) => {
  connection.query('SELECT count(id) as count FROM safe WHERE userId = ? and question = ? and answer = ? limit 1',
  [req.body.userId,req.body.question,md5(req.body.answer)],
    (err, result) => {
      if(err) {
        res.send({count: result})
        console.log(err)
        return
      }
      result = result[0]
      console.log(result)
      res.send({count: result})

    }
  )
})

// 更新密保
app.post("/updataProtect",(req, res) => {
  connection.query('UPDATE safe SET question = ? , answer = ? where userId = ?',
  [req.body.question,md5(req.body.answer),req.body.userId],
    (err, result) => {
      if(err) return console.log(err)
      result = result.affectedRows
      res.send({count: result})

    }
  )
})

// 通过邮箱找回密码
app.post("/findPasswordByEmail",(req, res) => {
  const emailOrPhone = req.body.emailOrPhone
  const account = req.body.account
  const question = req.body.question
  const answer = req.body.answer
  connection.query(`SELECT id  FROM users WHERE email = ? limit 1`,
  [account],
    (err, result) => {
      if(err) {
        res.send({code: 0, message:"服务器错误"})
        console.log(err)
        return
      }
      if(result.length < 1) {
        res.send({code: 0, message:"验证失败"})
      } else {
        let id = result[0].id
        connection.query('SELECT * FROM safe WHERE userId = ? and question = ? and answer = ? limit 1',
        [id, question, md5(answer)],
        (err, count) => {
          if(err) {
            res.send({code: 0, message:"服务器错误"})
            console.log(err)
            return
          }
          console.log(question)
          console.log(md5(answer))
          if(count.length < 1) {
            res.send({code: 0, message:"验证失败"})
          } else {
            res.send({code: 1, message:"验证成功"})
          }
        })
      }
    }
  )
})



app.post("/sendEmail",(req, res) => {
  // 发送到的邮箱地址
  let email = req.body.email

  connection.query(`SELECT * FROM users WHERE email = ? limit 1`,[email],(err, result) => {
    if(err) {
      res.send({code: 0,message: "邮箱不存在"})
      console.log(err)
      return
    }
    console.log(result)
    if( result.length > 0) {
      // 发送验证码生成
      let codeConfig = {
        size: 6, // 验证码长度
        ignoreChars: 'QWERTYUIOPLKJHGFDSAZXCVBNMzxcvbnmlkjhgfdsaqwertyuiop', // 验证码字符中排除0o1i
        noise: 2, // 干扰线条的数量
      }
      const captcha = svgCaptcha.create(codeConfig);
      // text是验证码
      const text = captcha.text.toLowerCase()
      console.log(text)

      let mailOptions = {
        from: '"1788MUSIC" <music1788@qq.com>', // sender address
        to: email, // list of receivers
        subject: '1788MUSIC 验证码', // Subject line
        // 发送text或者html格式
        // text: 'Hello world?', // plain text body
        html: `<div style="text-align: center;font-size:20px">你的验证码是<h1 style="display: inline-block;color: #6495ED;">${text}</h1></div>` // html body
      };
      
      // send mail with defined transport object
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
        // Message sent: <04ec7731-cc68-1ef6-303c-61b0f796b78f@qq.com>
      });
      res.send({code: 1,message: "验证码已发送",captcha: md5(md5(text))})
    } else {
      res.send({code: 0,message: "邮箱不存在"})
    }
  })
})


// 更新密码
app.post("/updatePassword",(req, res) => {
  const emailOrPhone = req.body.emailOrPhone
  const account = req.body.account
  let password = req.body.password
  password = md5(password)
  password = md5(password)
  connection.query(`UPDATE users SET password = ? WHERE ${emailOrPhone} = ? limit 1`,
  [password, account],
    (err, result) => {
      if(err) {
        res.send({code: 0, message:"服务器错误"})
        console.log(err)
        return
      }
      console.log(result.affectedRows)
      if(result.affectedRows > 0) {
        res.send({code: 1, message: "修改成功"})
      } else {
        res.send({code: 0, message: "修改失败"})
      }
    }
  )
})

// 反馈
app.post("/submitFeedback", (req, res) => {
  const id = uuid.v4()
  const userId = req.body.userId
  const title = req.body.title
  const content = req.body.content
  let createTime = new Date().getTime()
  connection.query("INSERT INTO feedback VALUES(?,?,?,?,?)",
    [id,userId,title,content,createTime],
    (err, result) => {
      if(err) {
        res.send({code: 0, message: "发送反馈失败"})
        console.log(err)
        return
      }
      res.send({code: 1, message: "发送反馈成功"})
    })
})

// 订阅者
app.post("/submitsubscription",(req, res) => {
  const email = req.body.email
  connection.query("SELECT * FROM subscription WHERE email = ? limit 1",[email],(err,result) => {
    if(err) {
      res.send({code: 0,message: "服务器出错,订阅失败"})
      console.log(err)
      return
    }
    if(result.length < 1) {
      // 未订阅
      connection.query("INSERT INTO subscription Values(?,?,?)",[uuid.v4(),email,new Date().getTime()],(err,data) => {
        if(err) {
          res.send({code: 0,message: "服务器出错,订阅失败"})
          console.log(err)
          return
        }
        res.send({code: 1,message: "订阅成功"})

      })
    } else {
      //  已订阅
      res.send({code: 1,message: "邮箱已订阅"})
    }
  })
})
// 查询是否设置密保
app.post("/isSetProtect",(req, res) => {
  connection.query(`SELECT count(id) as count FROM safe WHERE userId = ?`,[req.body.id],(err, result) => {
    if(err) {
      res.send({code: 0, message: "服务器错误"})
      console.log(err)
      return
    }
    const count = result[0].count
    if( count === 0 ) {
      res.send({code: 1, message: "未设置"})
    }
    if( count > 0 ) {
      res.send({code: 2, message: "已设置"})
    }
  })
})

// ------- 获取站内图片
app.post("/imagesData",(req, res) => {
  connection.query(`SELECT * FROM images ORDER BY createTime DESC`,(err, result) => {
    if(err) {
      res.send({code: 0, message: "服务器错误"})
      console.log(err)
      return
    }
    res.send({code: 1, imagesData: result})
  })
})


// ----------- 删除图片
app.post("/deleteImage",(req, res) => {
  connection.query(`SELECT img FROM images WHERE id = ?`,[req.body.id],(err, result) => {
    if(err) {
      res.send({code: 0, message: "服务器错误"})
      console.log(err)
      return
    }
    fs.unlink(path.join(`./public/uploads`+result[0].img),(err) => {
      if(err) {
        return console.log(err)
      }
    })
    connection.query(`DELETE FROM images WHERE id = ?`,[req.body.id],(err, data) => {
      if(err) {
        res.send({code: 0, message: "服务器错误"})
        console.log(err)
        return
      }
      res.send({code: 1, message: "删除成功"})
    })
  })
  
})

// ------------- 提交图片 ---------------

storage = multer.diskStorage({
  // destination:'public/uploads/'+new Date().getFullYear() + (new Date().getMonth()+1) + new Date().getDate(),
  destination(req,res,cb){
    cb(null,'public/uploads/images');
  },
  filename(req,file,cb){
    let filenameArr = file.originalname.split('.');
    cb(null,Date.now() + '-' + uuid.v4() + file.originalname.substring(0,file.originalname.indexOf('.')) + '.' + filenameArr[filenameArr.length-1]);
  }
});

upload = multer({storage});

app.post('/addImg', upload.single("file"), function(req, res) {
  let imgSrc = `/images/` + req.file.filename
  
  const id = uuid.v4()
  const type = req.body.type
  const time = new Date().getTime()
  new Promise((resolve, reject) => {
    connection.query('INSERT INTO images VALUES(?,?,?,?)',
      [id,imgSrc,type,time],
      (err, result) => {
        if(err) {
          res.send({code: 0, message: "服务器错误"})
          console.log(err)
          return
        }
        res.send({code: 1, message: "上传成功"})
      }
    )
  })
})
// 获取评论数据
app.post("/getCommentData",(req, res) => {
  new Promise( (resovle, reject) => {
    connection.query(`SELECT count(id) as count FROM comments`,(err, result) => {
      if(err) {
        res.send({code: 0, message: "获取评论失败"})
        console.log(err)
        return
      }
      resovle(result[0])
    })
  }).then( count => {
    connection.query(`SELECT c.*,u.nickname,a.title title FROM comments c LEFT JOIN users u ON c.from_uid = u.id LEFT JOIN article a ON c.topic_id = a.id ORDER BY c.createTime DESC LIMIT ?,10`
    ,[(req.body.currentPage - 1)*10],(err, result) => {
      if(err) {
        res.send({code: 0, message: "获取评论失败"})
        console.log(err)
        return
      }
      res.send({code: 1, message: "获取评论成功",totalCount: count,comments: result})
    })
  })
})
// 删除评论
app.post("/deleteComment",(req, res) => {
  connection.query(`DELETE FROM comments WHERE id in (?)`,[req.body.id],(err, result) => {
    if(err) {
      res.send({code: 0, message: "删除评论失败"})
      console.log(err)
      return
    }
    res.send({code: 1, message: "删除评论成功"})
  })
})
//dac27c8e7534098909bb93af3eb
app.listen(3001,function () {    ////监听3000端口
    console.log('Server running at 3001 port');
     
});
