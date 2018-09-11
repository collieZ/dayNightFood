const express = require('express');
const router = express.Router(); // 框架路由
const wechat = require('wechat');
const weChatApi =require('wechat-api');
const http = require('http');
const util = require('util');
const schedule = require('node-schedule');
const config = require('./config.json');

var  MenuGetFlag = 0;  // 统计菜单获取标识位 1: 已经获取  2: 尚未获取
var UserHandle = function () {
    // 最新关注者openid集合
    this.UserOpenid = new Array();
    // 目前员工数
    this.StaffNow = [];

    /**
     * 获取关注用户并更新
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
                // var that = this;
                var StaffUnion = this.StaffNow;
                console.log('promiss回调结果:', userId);
                if (StaffUnion.length < userId.length) {
                console.log("有新增成员");
                // 遍历比较，找出新增加成员
                userId.forEach(element => {
                    if (StaffUnion.indexOf(element) == -1) {
                        // 不将cooker添加进发送分组
                        if (element != MenuEvent.cookerId) {
                            console.log('新增了' + element);
                            // 将新增成员添加进吃货分组
                            api.moveUserToGroup(element, 100, function (err, result) {
                                console.log('移动成功:', result);
                            });
                            StaffUnion.push(element);
                        }
                    }
                });
            } else if (StaffUnion.length > userId.length) {
                // 如果成员相较之前减少
                StaffUnion = '';
                StaffUnion = [].concat(userId);
                console.log('减少后剩余的吃货数:', StaffUnion, '\r\n');
                api.getGroups(function (err, result) { // 查询分组信息
                    console.log(result);
                });
            } else {
                console.log('没成员变化，不进行操作');
                return;
            }
    };
};


var MenuHandle = function () {
    
    this.dailyFoodMenu = new Array();  

    this.foods = []; // 订餐统计   {name: "", numbers: 0}

    // 煮饭阿姨的openid
    this.cookerId = 'oZ1891Z9gSJfAjfu9Eu7kJdYEwA8';

    this.send2CookerFlag = 0;   // 缺省为0   表示阿姨没主动提示

    this.selectSatus = {
        "eat": 0,
        "noteat": 0,
        "defaulteat": 0,
        "defaultnoeat": 0
    };   // 人员选择情况


     /**
      *  煮饭阿姨推送，员工们收到回复
      *  @param {String}  msg   阿姨输入菜单信息
      */
     this.CreatTodayMenu = function (msg, res) {
         var foodStr = new Array();
         var welStr = "晚饭时间到啦～\n";
         var subStr = "1:要吃 2:不吃 3:缺省要吃 4:缺省不吃\r\n  请在规定时间内回复是否要吃晚饭，请不要多次发送!!\n"
         var sendUserStr = '';
         if (msg == "晚餐") {
            
            //  this.dailyFoodMenu = [];
            //  this.foods = [];   // 清空数组
            //  var menu = (msg.split('=')[1]).split(" ");
            //  this.dailyFoodMenu = [].concat(menu);
            //  for(let i = 0; i < this.dailyFoodMenu.length; i++) {
    
            //     let foodObj = {name: "", numbers: 0};   // 块级作用域变量
            //     foodObj.name = this.dailyFoodMenu[i];
            //     this.foods.push(foodObj);
            // }
    
            // for (let i = 0; i < this.foods.length; i++) {
            //     let tempStr = (i + 1).toString() + '. ' + this.foods[i].name + '\n';
            //     foodStr.push(tempStr);
            // }
            send2CookerFlag = 1;  // 阿姨主动提示了
            UserEvent.updateUserList().then(function (data) {
                console.log('更新列表成功!');
                UserEvent.addPerson2Group(data);
            });

            sendUserStr = welStr + '\r\n' + subStr;
            sendUserStr = sendUserStr.toString();
            res.reply("统计信息已发送");
            try {
                api.massSendText(sendUserStr, "100", function (err, result) { // 群发提示消息给员工
       
                    console.log('err is:', err);
                    console.log('result is', result);
                });
            } catch (err) {
                console.log(err);
            }
         }
    };

    /**
     * 获取各个用户的订餐情况
     *  @param {String} content 选择的菜品编号
     */ 
    this.addUp = function (content, res) {
        var selected = 0;
        selected = parseInt(content);
        if (selected > 0 && selected < 6) { // 员工回复操作
            // this.foods[selected - 1].numbers++;
            // console.log(this.foods);
            switch (selected) {
                case 1:
                    this.selectSatus.eat += 1;
                    res.reply("你已确认今天要吃晚饭");
                    console.log(this.selectSatus);
                    break;
                case 2:
                    this.selectSatus.noteat += 1;
                    res.reply("你已确认今天不吃晚饭");
                    console.log(this.selectSatus);
                    break;
                case 3:
                    this.selectSatus.defaulteat += 1;
                    res.reply("默认后面都留下吃晚饭");
                    console.log(this.selectSatus);
                    break;
                case 4:
                    this.selectSatus.defaultnoeat += 1;
                    res.reply("默认后面不留下吃晚饭");
                    console.log(this.selectSatus);
                    break;
            
                default:
                    res.reply("请回复正确的编号");
                    console.log(this.selectSatus);
                    break;
            }
        }
    };

    /**
     * 将统计好的菜单信息发送给厨师
     * @param {String} req
     */ 
    this.send2Cooker = function (req, res) {
        var headStr = "要吃晚饭的人数有\n";
        // var foodStr = new Array();
        var numberCount = 0;
        var sendCookerStr = '';
        if (req == "统计") {
            // console.log('统计:', this.foods);
            // for (let i = 0; i < this.foods.length; i++) {
            //     let tempStr = (i + 1).toString() + '. ' + this.foods[i].name + '数量 :' + this.foods[i].numbers + '\n';
            //     foodStr.push(tempStr);
            // }
            numberCount = this.selectSatus.eat + this.selectSatus.defaulteat; // 统计要吃的人数   默认+要去的
            sendCookerStr = headStr + numberCount.toString() + "人";
            MenuGetFlag = 1; // 标记今天已经获取统计信息
            res.reply(sendCookerStr);
        }
    };


    /** 
     *  设定未查询主动推送时间和事件
     *  @param  
     */
    this.sendOnTime = function () {
        var that = this;
        // 定时主动提示   17:20 提示
        var rulepr = new schedule.RecurrenceRule();
        rulepr.dayOfWeek = [0, new schedule.Range(1, 6)];
        rulepr.hour = 15;
        rulepr.minute = 05;
        // 主动发送给阿姨  17:40
        var rule = new schedule.RecurrenceRule();
        rule.dayOfWeek = [0, new schedule.Range(1, 6)];
        rule.hour = 15;
        rule.minute = 07;


        schedule.scheduleJob(rulepr, function () {  
            
            if (send2CookerFlag == 0) {
                var welStr = "晚饭时间到啦～\n";
                var subStr = "1:要吃 2:不吃 3:缺省要吃 4:缺省不吃\r\n  请在规定时间内回复是否要吃晚饭，请不要多次发送!!\n"
                var sendUserStr = '';
                sendUserStr = welStr + '\r\n' + subStr;
                sendUserStr = sendUserStr.toString();
                try {
                    api.massSendText(sendUserStr, "100", function (err, result) { // 群发提示消息给员工
    
                        console.log('err is:', err);
                        console.log('result is', result);
                    });
                } catch (err) {
                    console.log(err);
                }
            }
            console1.log("======已经主动提示了过了======\r\n");
            send2CookerFlag = 0;    // 初始化提示标志
        });

        schedule.scheduleJob(rule, function () {
        // 用户关注更新
        UserEvent.updateUserList().then(function (data) {
                console.log('更新列表成功!');
                UserEvent.addPerson2Group(data);
            });

            console.log("每天5:20执行");
            if (MenuGetFlag == 0) {
    
                var headStr = "统计就餐人数有:\n";
                // var foodStr = new Array();
                var sendCookerStr = '';
                // for (let i = 0; i < that.foods.length; i++) {
                //     let tempStr = (i + 1).toString() + '. ' + that.foods[i].name + '数量 :' + that.foods[i].numbers + '\n';
                //     foodStr.push(tempStr);
                // }
                // var peopleChange = 
                var numberCount = that.selectSatus.eat + that.selectSatus.defaulteat; // 统计要吃的人数   默认+要去的
                sendCookerStr = headStr + numberCount + "";
                api.sendText(that.cookerId, sendCookerStr, function (err, result) { // 发送客服消息
                    console.log(result);
                });
            }
            MenuGetFlag = 0; // 每天固定清除标识位
        });
    };


};


var MenuEvent = new MenuHandle();   // 实例化菜单处理对象

var UserEvent = new UserHandle();   // 实例化用户处理对象

var api = new weChatApi(config.appID, config.appSecret);

MenuEvent.sendOnTime(); 

router.use(express.query());   

router.use('/', wechat(config, function (req, res, next) {
    // console.log(typeof req.weixin);
    console.log(req.weixin.FromUserName);
    var message = req.weixin;

    if(!message.Content) {  // 防止进入回调后内容为null
        return;
    } else {
        MenuEvent.CreatTodayMenu(message.Content, res);     //  获取今日菜单并分发给每个用户
    }
    // get staff select food
    MenuEvent.addUp(message.Content, res); // 菜品统计    

    MenuEvent.send2Cooker(message.Content, res); // 获取统计后的信息 发送给煮饭阿姨
    
    if (message.Content == "哈哈") {
        res.reply("嘻嘻");
    }
})); 

module.exports = router;