const express = require('express');
var router = express.Router(); // 框架路由
const wechat = require('wechat');
const weChatApi =require('wechat-api');
const http = require('http');
const util = require('util');
const schedule = require('node-schedule');

var  MenuGetFlag = 0;  // 统计菜单获取标识位 1: 已经获取  2: 尚未获取

var config = { // 微信公众号配置信息
    token: 'wechat',
    appid: 'wx8ce9edb506275298',
    appsecret: '4dc1650daa6c8a510e2af91521accd01',
    encodingAESKey: ''
};

var Staff = ["oDfg30pvv-0lPXBTORbyC0ZI8d7w",
             "oDfg30l59kYZ1Kx8PPa3ZfRReK6Q",
             "oDfg30kMMkRdttoa0KsSOMLP2Ct0"
];

// var app = express();    // 实例化express框架

var api = new weChatApi(config.appid, config.appsecret);

// 获取所有关注用户的openid
function getUserOpenid() {
    var UserNumbers = 0;
    var UserOpenid = new Array(); 
    api.getFollowers(function (err, result) {
        console.log(err);
        console.log(result);
        for(let i = 0; i < result.data.openid.length; i++) {
            
            UserOpenid.push(result.data.openid[i]);
            UserNumbers++;
        }
        console.log(UserOpenid, UserNumbers);
    });
}

getUserOpenid();

api.getGroups(function (err, result) {      // 查询分组信息
    // for (let i = 0; i < result.groups.length; i++) {
    //     console.log(result.groups[i].name);
    // }
    console.log(result);
    // console.log(err);
});

api.getWhichGroup("oDfg30l59kYZ1Kx8PPa3ZfRReK6Q", function (err, result) {  // 查询openid用户在哪个分组
    console.log(result);
    // console.log(err);
});


router.use(express.query());    // ??后面了解

var dailyFoodMenu = new Array();    // 每日菜单
var foods = [];     // 订餐统计 {name: "", numbers: 0}

router.use('/', wechat(config, function (req, res, next) {
    console.log(req.weixin);
    var message = req.weixin;
    if (message.Content == "哈哈") {
        res.reply("你发送的是哈哈");
    }

    if(message.Content.split('=')[0] == "今日菜单") {   // 煮饭阿姨更新每日菜单

        let menu = message.Content.split("=")[1].split(" ");
        dailyFoodMenu = [].concat(menu);    // 将当日更新的菜单赋值到每日菜单数组中
        console.log(dailyFoodMenu);
        updateMenu();   // 将菜单更新到统计数组
        var sendMsg = send2EveryOne();  // 将格式化好的待发送菜单数据传给字符串变量
        // 群发给每个员工
         api.massSendText(sendMsg, Staff, function (result, err) {      // 群发菜单给员工

             console.log(result);
             console.log(err);
         });
        res.reply("今日菜单已更新并发送");
    }

    if(message.Content == "统计") {     // 获取统计后的信息 发送给煮饭阿姨
        var addUpOverStr = '';  
        addUpOverStr = send2Cooker();
        MenuGetFlag = 1;    // 标记今天已经获取过菜单
        res.reply(addUpOverStr);
    }

    // if(MenuGetFlag == 0 && )

    addUp(message.Content,res);     // 菜品统计
})); 


function updateMenu() {     // 统计更新每日菜单
    
    for(let i = 0; i < dailyFoodMenu.length; i++) {
        let foodObj = {name: "", numbers: 0};   // 块级作用域变量
        foodObj.name = dailyFoodMenu[i];
        foods.push(foodObj);
    }
    console.log(foods);
}

function send2EveryOne() { // 将统计好的菜单发给每个人
    var welStr = "今日菜单\n";
    var foodStr = new Array();
    var subStr = "请在规定时间内回复对应数字预定相应的菜品，请不要多次发送!!\n"
    var sendUserStr = '';
    for (let i = 0; i < foods.length; i++) {
        let tempStr = (i + 1).toString() + '. ' + foods[i].name + '\n';
        foodStr.push(tempStr);
    }
    sendUserStr = welStr + foodStr.join('') + '\r\n' + subStr;
    console.log(sendUserStr);
    return sendUserStr;
}


/** 
 *  @param {String} content  客户端发来的字符串
 *  
 */
function addUp(content, res) {   // 发送菜单后，员工回复的统计
    
    var selectFood = 0;
    selectFood = parseInt(content);
    if(selectFood > 0 && selectFood < foods.length) {   // 员工回复操作
        foods[selectFood-1].numbers++;
        console.log(foods);
        res.reply("你已订餐完成");
    } 
    else if(selectFood > foods.length) {
        res.reply("请输入正确的订餐编号!");
    } 
}

function send2Cooker() {
    var headStr = "统计菜品数量如下\n";
    var foodStr = new Array();    // 
    var sendCookerStr = '';
    for(let i = 0; i < foods.length; i++) {
        let tempStr = (i+1).toString() + '. ' + foods[i].name + '数量 :' + foods[i].numbers + '\n';
        foodStr.push(tempStr);
    }
    sendCookerStr = headStr + foodStr.join('');
    console.log(foods);
    return sendCookerStr;
}

var send2CookerOnTIme = function () { // 固定时间发送统计之后的信息给煮饭阿姨

    if (MenuGetFlag == 0) {
        var addUpOverStr = '';
        addUpOverStr = send2Cooker();
        api.sendText('oDfg30l59kYZ1Kx8PPa3ZfRReK6Q', addUpOverStr, function (err, result) { // 发送客服消息
            console.log(err);
            console.log(result);
        });
    }
};

function setTimePlan(obj) {     // 固定时间执行某件事

    var rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = [0, new schedule.Range(1,6)];
    rule.hour = 17;
    rule.minute = 30;

    schedule.scheduleJob(rule, function () {
        console.log("每天6:30执行");
        obj();
        MenuGetFlag = 0; // 每天固定清除标识位
    });
}

setTimePlan(send2CookerOnTIme);     // 每日阿姨没主动查询时的定时推送

module.exports = router;



// api.massSendText("群发测试hehe", Staff, function (result, err) {

//     console.log(result);
//     console.log(err);
// });

// api.massSendText("群发测试hehe", "oDfg30l59kYZ1Kx8PPa3ZfRReK6Q", function (result, err) {

//     console.log(result);
//     console.log(err);
// });

// api.deleteMass("1000000001", function (result, err) {
//     console.log(result);
//     console.log(err);
// });

// api.createGroup('员工分组', function (result, err) {    // id：100
//     console.log(result);
//     console.log(err);
// });

// api.createGroup('做饭阿姨', function (result, err) {    // id： 101
//     console.log(result);
//     console.log(err);
// });

// (function creatGroups() {
//     api.getGroups(function (err, result) {      // 查询分组信息
//         console.log(result);
//         console.log(err);
//         for (let i = 0; i < result.groups.length; i++) {
//             if (result.groups[i].name != '员工分组') {
//                 api.createGroup('员工分组', function (result, err) {    // id：100
//                     console.log(result);
//                     console.log(err);
//                 });
//             }
//             else if(result.groups[i].name != '做饭阿姨') {
//                 api.createGroup('做饭阿姨', function (result, err) {    // id： 101
//                     console.log(result);
//                     console.log(err);
//                 });
//             }
//             console.log("分组已存在！");
//         }
//     });
// })();

// function moveUser2Groups() {

// }

// api.getFollowers(function (err, result) {
//     console.log(err);
//     console.log(result);
// });

// api.removeGroup(107, function (result, err) {

//     console.log(result);
//     console.log(err);
// });


// api.sendText('oDfg30pvv-0lPXBTORbyC0ZI8d7w', '哈哈哈 嘻嘻嘻嘻', function (err, result) {     // 发送客服消息
//     console.log(err);
//     console.log(result);
// });

// api.removeMenu(function (err, result) {      // 删除自定义菜单

//     console.log(err);
//     console.log(result);
// });