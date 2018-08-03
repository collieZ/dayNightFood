var express = require('express');
var http = require('http');
var fs = require('fs');
var mysql = require('mysql');

var app = express();


var sql = 'SELECT * FROM food_manage';
var addSql = 'INSERT INTO food_manage(id,food,numbers,time) VALUES(0,?,?,?)';
var addSqlParams = ['青椒肉丝', 0, '2018-8-1 12:59'];

var foods = [
    {name:'青椒肉丝', numbers:0}, 
    {name:'红烧牛肉', numbers:0},
    {name:'黄焖鸡', numbers:0},
    {name:'蛋炒饭', numbers:0},
    {name:'麻婆豆腐', numbers:0},
    {name:'泡椒肉丝', numbers:0},
];

// 数据库操作函数
function queryAndChangeDb() {
    var connection = mysql.createConnection({
        host: '111.231.90.29',
        user: 'root',
        password: 'LL960220',
        port: '3306',
        database: 'test',
        charset: 'utf8'
    });

    connection.connect();
    connection.query(sql, function (err, result) {
        if (err) {
            console.log("err:", err.message);
            return;
        }
        console.log(result);
        console.log('-----------------------------');
    });

    connection.query(addSql, addSqlParams, function (err, result) {
        // 插入数据
        if(err) {
            console.log('err:' + err.message);
            return;
        }
        // console.log("Insert: " + result);
        console.log('insert success!');
        console.log('-----------------------------');
    });

    connection.end();
}

var counter = 0;

var server = http.createServer(function (req, res) {
    req.on('data', function (data) {
        var recData;
        var myDate = new Date(); // 日期对象
        console.log("接收到的客户端的数据为：" + decodeURIComponent(data));
        recData = decodeURIComponent(data).split('=');
        console.log(recData[1]);    // 前端表单传来的数据
        
        if (timeCheck() == 1) {     // 如果是午餐时间
            console.log('午餐统计菜品时间，请点餐!!!');
            for (let i = 0; i < foods.length; i++) {
                if(foods[i].name == recData[1]) {      // 收到的菜品名进行比对  ??
                    foods[i].numbers++;
                }
            } 
            var dateNow = myDate.toLocaleString();  // 获取本地时间
            addSqlParams[0] = recData[1];
            addSqlParams[2] = dateNow.toString();
            console.log(dateNow);
            queryAndChangeDb(); // 查询、增添数据到数据库
        }
        else if(timeCheck() == 2) {     // 如果是晚餐时间
            counter++;
            
            console.log('晚餐统计菜品时间，请点餐~~~');
            for (let i = 0; i < foods.length; i++) {
                console.log(foods[i].name);
                if (foods[i].name == recData[i]) {
                    foods[i].numbers++;
                    console.log(foods);
                }
            }
            var dateNow = myDate.toLocaleString(); // 获取本地时间
            addSqlParams[0] = recData[1];
            addSqlParams[2] = dateNow.toString();
            console.log(dateNow);
            if (counter >= 3) {
                console.log(foods);
            }
            // queryAndChangeDb(); // 查询、增添数据到数据库
        }
        // console.log(foods);
    });
    req.on('end', function() {      // 监听事件 'end'
        console.log('接收数据完毕');
    });
    res.end('over!');   // 结束处理事件
}).listen(3000, "localhost", function () {
    console.log("is Listening port 3000.....");
});

function timeCheck() {
    var time = new Date();
    var year = time.getFullYear();
    var month = time.getMonth();
    var day = time.getDate();
    var house = time.getHours();
    var minutes = time.getMinutes();
    var setlunchTimeS = new Date(year, month, day, 11, 30);  // 设定的午餐统计时间 中午11:30 开始时间
    var setDinnerTimeS = new Date(year, month, day, 14, 5); // 设定的晚餐统计时间 晚餐4:30  开始时间

    var setlunchTimeE = new Date(year, month, day, 13, 0);     // 设定午餐统计时间 1:00 结束时间
    var setDinnerTimeE = new Date(year, month, day, 18, 30);    // 设定晚餐统计时间 6:30 结束时间

    var setSplitTime = new Date(year, month, day, 14, 0);   // 设置2点为上午，下午分割时间

    // 将获取到的时间转换为标准格式字符   
    let lunchTimeS = setlunchTimeS.getTime();
    let lunchTimeE = setlunchTimeE.getTime();
    let dinnerTimeS = setDinnerTimeS.getTime();
    let dinnerTimeE = setDinnerTimeE.getTime();

    // console.log(lunchTimeS , lunchTimeE, dinnerTimeS, dinnerTimeE);

    // console.log(lunchTimeS.toString());
    if (time < setSplitTime) {      // 午餐和晚餐分割时间点
        if (time > lunchTimeS && time < lunchTimeE) {   // 午餐统计时间段
    
            return 1;
        } else {
            console.log('不在午餐统计时间内,请稍后提交');
            return 0;
        }
    } else {
        if (time > dinnerTimeS && time < dinnerTimeE) {     // 晚餐统计时间段
            
            return 2;
        } else {
            console.log('不在晚餐统计时间内，请稍后提交');
            return 0;
        }
    }
}

// timeCheck();
// app.get('/',  function (req, res) {

//     var recData = req.query;
//     console.log(recData);
//     req.on('data', function (data) {

//         console.log("接收到的数据是：" + decodeURIComponent(data));
//     });
//     res.end('over!');
// });

// app.listen(3000,function () {
//     console.log("LIstening port 3000.....");
// });

