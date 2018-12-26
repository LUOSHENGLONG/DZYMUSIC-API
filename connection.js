const mysql = require('mysql'); 

module.exports = mysql.createConnection({      //创建mysql实例
  host:'127.0.0.1',
  port:'3306',
  user:'root',
  password:'root',
  database:'dzymusic'
});