const express = require('express');
const router = express.Router(); // 框架路由
const wechat = require('wechat');
const weChatApi =require('wechat-api');
const http = require('http');
const util = require('util');
const schedule = require('node-schedule');
const config = require('./config.json');

var  MenuGetFlag = 0;  // 统计菜单获取标识位 1: 已经获取  2: 尚未获取

// var config = { // 微信公众号配置信息
//     token: 'wechat',
//     appid: 'wx68b18f787f9878cd',
//     appsecret: '056b3b767a368f84fac584456111ad7f',
//     encodingAESKey: ''
// };

// 煮饭阿姨的openid
// var cookerId = 'oZ1891Z9gSJfAjfu9Eu7kJdYEwA8';

// 现有员工的集合
// var StaffNow = ["oZ1891bzhM_M8biCTUJatGwUj7sA","oZ1891R5kyrqBNtEDn00bYg3e77Y",
//             "oZ1891at7yq9I4Z5vYP0XEdX1PzQ"
// ];


var UserHandle = function () {
    // 最新关注者openid集合
    this.UserOpenid = new Array();
    // 煮饭阿姨的openid
    this.cookerId = 'oZ1891Z9gSJfAjfu9Eu7kJdYEwA8';
    // 目前员工数
    this.StaffNow = [];

    /**
     * 获取关注用户并更新
     *
     */
    this.updateUserList = function () {
        var that = this;
        return new Promise(function (resolve, reject) {
               // 这个回调是异步的 需要promiss来写，回调成功后才执行下面的。!!!
                api.getFollowers(function (err, result) {
                // 如果有新增成员添加到数组中
                console.log(result);
                if (result.data.openid.length >= that.UserOpenid.length) {
                    result.data.openid.forEach(userElement => {
                        if (that.UserOpenid.indexOf(userElement) == -1) {
                            that.UserOpenid.push(userElement);
                        }
                    });
                } 
                // 获取减少的成员openid
                else if (result.data.openid.length < that.UserOpenid.length) {
                    that.UserOpenid.forEach(userElement => {
                        if (result.data.openid.indexOf(userElement) == -1) {
                            let index = that.UserOpenid.indexOf(userElement);
                            if (index > -1) {
                                that.UserOpenid.splice(index,1);
                            }
                        }
                    });
                }
                resolve(that.UserOpenid);
                reject(err);
            });
        });
    };

    /**
     * 用于自动添加用户进分组
     * @param {Array} userId promise传递的获取的最新关注人员列表
     */
    this.addPerson2Group = function (userId) {
                var that = this;
                console.log('promiss回调结果:', userId);
                if (that.StaffNow.length < userId.length) {
                console.log("有新增成员");
                // 遍历比较，找出新增加成员
                userId.forEach(element => {
                    if (that.StaffNow.indexOf(element) == -1) {
                        console.log('新增了' + element);
                        // 将新增成员添加进吃货分组
                        api.moveUserToGroup(element, 100, function (err, result) {
                            console.log('移动成功:', result);
                        });
                        that.StaffNow.push(element);
                    }
                });
            } else if (that.StaffNow.length > userId.length) {
                // 如果成员相较之前减少
                that.StaffNow = '';
                that.StaffNow = [].concat(userId);
                console.log('减少后剩余的吃货数:', that.StaffNow, '\r\n');
                api.getGroups(function (err, result) { // 查询分组信息
                    console.log(result);
                });
            } else {
                console.log('没成员变化，不进行操作');
                return;
            }
    };
};

var UserEvent = new UserHandle();   // 实例化用户处理对象

var api = new weChatApi(config.appID, config.appSecret);

router.use(express.query());   

var dailyFoodMenu = new Array();    // 每日菜单
var foods = [];     // 订餐统计 {name: "", numbers: 0}

router.use('/', wechat(config, function (req, res, next) {
    console.log(req.weixin);
    var message = req.weixin;

    if(!message.Content) {  // 防止进入回调后内容为null
        return;
    } 
    else if(message.Content.split('=')[0] == "今日菜单") {   // 煮饭阿姨更新每日菜单

            let menu = (message.Content.split("=")[1]).split(" ");
            dailyFoodMenu = [].concat(menu);    // 将当日更新的菜单赋值到每日菜单数组中
            console.log(dailyFoodMenu);
            updateMenu();   // 将菜单更新到统计数组
            var sendMsg = send2EveryOne().toString();  // 将格式化好的待发送菜单数据传给字符串变量
            res.reply("今日菜单已更新并发送");
            // 群发给每个员工  
            try{
                api.massSendText(sendMsg, "100", function (err, result) { // 群发菜单给员工
        
                    console.log('err is:', err);
                    console.log('result is', result);
                });
            }
            catch(err){
                console.log(err);
            }
        }
    
    // cooker get Msg
    if(message.Content == "统计") {     // 获取统计后的信息 发送给煮饭阿姨
        var addUpOverStr = '';  
        addUpOverStr = send2Cooker();
        MenuGetFlag = 1;    // 标记今天已经获取过菜单
        res.reply(addUpOverStr);
    }

    // get staff select food
    addUp(message.Content,res);     // 菜品统计

    if (message.Content == "哈哈") {
        res.reply("嘻嘻");
    }
})); 

// setInterval(function () {
//     UserEvent.updateUserList().then(function (data) {
//         console.log('更新列表成功!');
//         UserEvent.addPerson2Group(data);
//     });
// }, 10000);

function updateMenu() {     // 统计更新每日菜单
    
    for(let i = 0; i < dailyFoodMenu.length; i++) {
        let foodObj = {name: "", numbers: 0};   // 块级作用域变量
        foodObj.name = dailyFoodMenu[i];
        foods.push(foodObj);
    }
    console.log(foods);
}

function send2EveryOne() { // 将统计好的菜单发给每个人
    var welStr = "今天的菜单\n";
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
 *  统计员工发来的订餐编号并更新到当日订餐统计对象中
 *  @param {String} content  客户端发来的字符串
 *  
 */
function addUp(content, res) {   // 发送菜单后，员工回复的统计
    
    var selectFood = 0;
    selectFood = parseInt(content);
    if(selectFood > 0 && selectFood <= foods.length) {   // 员工回复操作
        foods[selectFood-1].numbers++;
        console.log(foods);
        res.reply("你已订餐完成");
    } 
    else if(selectFood > foods.length) {
        res.reply("请输入正确的订餐编号!");
    } 
}

/** 
 *  将统计好的菜品数量规划好格式发送给煮饭阿姨
 *  @param {String}  sendCookerStr  返回值  格式化好的统计之后的菜单
 */
function send2Cooker() {
    var headStr = "统计菜品数量如下\n";
    var foodStr = new Array();    
    var sendCookerStr = '';
    for(let i = 0; i < foods.length; i++) {
        let tempStr = (i+1).toString() + '. ' + foods[i].name + '数量 :' + foods[i].numbers + '\n';
        foodStr.push(tempStr);
    }
    sendCookerStr = headStr + foodStr.join('');
    console.log(foods);
    return sendCookerStr;
}

// 获取所有关注用户的openid
function getUserOpenid() {
    var UserNumbers = 0;
    var UserOpenid = new Array();
    api.getFollowers(function (err, result) {
        // console.log(err);
        console.log(result);
        for (let i = 0; i < result.data.openid.length; i++) {

            UserOpenid.push(result.data.openid[i]);
            // UserNumbers++;
        }
        // console.log(UserOpenid, UserNumbers);
        addPerson2Group(UserOpenid);
    });
}

/** 
 * 每天饭点遍历关注人数，将新关注人员添加在分组中（排除煮饭阿姨）
 * @param {String} openidUnifo 关注人员列表
 */
function addPerson2Group(openidUnifo) {
    var openIdNow = openidUnifo;
    if (StaffNow.length < openIdNow.length) {
        console.log("有新增成员");
        // 遍历比较，找出新增加成员
        openIdNow.forEach(element => {
            if (StaffNow.indexOf(element) == -1) {
                console.log('新增了' + element);
                // 将新增成员添加进吃货分组
                api.moveUserToGroup(element, 100, function (err, result) {
                    console.log(err);
                    console.log(result);
                });
                StaffNow.push(element);
            }
        });
    } else if (StaffNow.length > openIdNow.length) {
        // 如果成员相较之前减少
        StaffNow = '';
        StaffNow = [].concat(openIdNow);
        console.log('减少之后的吃货数:', StaffNow);
    } else {
        console.log('没成员变化，不进行操作');
        return;
    }
}

/** 
 *  如到规定时间煮饭阿姨没主动查询统计好之后的值，则到时间主动推送给她
 *  
 */
var send2CookerOnTIme = function () { // 固定时间发送统计之后的信息给煮饭阿姨

    if (MenuGetFlag == 0) {
        var addUpOverStr = '';
        addUpOverStr = send2Cooker();
        api.sendText(cookerId, addUpOverStr, function (err, result) { // 发送客服消息
            console.log(err);
            console.log(result);
        });
    }
};

/** 
 *  设定未查询主动推送时间和事件
 *  @param {Fuction} obj  函数对象参数，主动推送事件 
 */
(function setTimePlan(obj) {     // 固定时间执行某件事

    var rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = [0, new schedule.Range(1,6)];
    rule.hour = 17;
    rule.minute = 30;

    schedule.scheduleJob(rule, function () {
        // 用户关注更新
        UserEvent.updateUserList().then(function (data) {
            console.log('更新列表成功!');
            UserEvent.addPerson2Group(data);
        });

        console.log("每天5:30执行");
        obj();
        MenuGetFlag = 0; // 每天固定清除标识位
    });
})(send2CookerOnTIme);

module.exports = router;