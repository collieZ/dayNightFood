const express = require('express');
const router = express.Router(); // 框架路由
const wechat = require('wechat');
const weChatApi =require('wechat-api');
const http = require('http');
const util = require('util');
const schedule = require('node-schedule');
const config = require('./config.json');
var localData = require('./data.json');
var fs = require('fs');
var path = require('path');

var localPath = path.resolve(__dirname, './data.json'); // 本地json绝对路径

var  MenuGetFlag = 0;  // 统计菜单获取标识位 1: 已经获取  2: 尚未获取

// 统计消息时间限制值
var limitTS = null;

/**
 * 菜单处理事件
 */ 
var MenuHandle = function () {
    
    this.dailyFoodMenu = new Array();  

    this.foods = []; // 订餐统计   {name: "", numbers: 0}

    // 煮饭阿姨的openid
    this.cookerId = 'oZ1891Z9gSJfAjfu9Eu7kJdYEwA8';

    this.send2CookerFlag = 0;   // 缺省为0   表示阿姨没主动提示

    this.selectSatus = {
        eat: 0,
        noteat: 0,
        defaulteat: 0,
        defaultnoeat: 0
    };   // 人员选择情况

    // this.saveStatus = {
    //     "eat": [],
    //     "noeat": [],
    //     "defaulteat": [],
    //     "defaultnoeat": []
    // };  // 缺省情况存储

     /**
      *  煮饭阿姨推送，员工们收到回复
      *  @param {String}  msg   阿姨输入菜单信息对象
      */
     this.CreatTodayMenu = function (msg, res) {
         var welStr = "晚饭时间到啦～\n";
         var subStr = "1:要吃 2:不吃 3:默认要吃\r\n  请在规定时间内回复是否要吃晚饭，请不要多次发送!!\n"
         var sendUserStr = '';

         if (msg.Content == "晚餐" && msg.FromUserName == this.cookerId) {
        
            this.send2CookerFlag = 1;  // 阿姨主动提示了
            UserEvent.updateUserList().then(function (data) {
                console.log('更新列表成功!');
                UserEvent.addPerson2Group(data);
            });
            setTimeout(() => {
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
            }, 2000);
         }
         else if (msg.Content == "晚餐" && msg.FromUserName != this.cookerId) {
             res.reply("你不是煮饭阿姨的嘛");
         }
    };

    /**
     * 获取各个用户的订餐情况
     *  @param {String} msgobj 返回的微信对象
     */ 
    this.addUp = function (msgobj, res) {
        var selected = 0;
        var nowTime = new Date().getTime();

        selected = parseInt(msgobj.Content);    // 选择的编号
        if (selected > 0 && selected < 6) { // 员工回复操作
            console.log("统计结束时间:", limitTS, "目前时间:", nowTime);
            if (nowTime > limitTS && limitTS != null) {
                res.reply("今天的统计时间已经过了，下次早点哦～");
                return;
            }
            switch (selected) {
                case 1:
                    if (cmpLocalJson(0, msgobj.FromUserName) == 0) {
                        this.selectSatus.eat += 1;
                        res.reply("你已确认今天要吃晚饭");
                        console.log(this.selectSatus);
                    } else {
                        res.reply("你已经选择默认都要去吃哦");
                    }
                    break;
                case 2:
                    this.selectSatus.noteat += 1;
                    cmpLocalJson(1, msgobj.FromUserName);
                    res.reply("你已确认今天不吃晚饭");
                    console.log(this.selectSatus);
                    break;
                case 3:
                    this.selectSatus.defaulteat += 1;
                    // 本地更新记录 默认去
                    changeLocalJson(msgobj.FromUserName);
                    res.reply("默认后面都留下吃晚饭");
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
        var that = this;
        var headStr = "要吃晚饭的人数大约有\n";
        var numberCount = 0;
        var sendCookerStr = '';

        if (req.Content == "统计" && req.FromUserName == this.cookerId) {
            console.log('本地:', localData.total);
            numberCount = this.selectSatus.eat + localData.total; // 统计要吃的人数   默认+要去的
            console.log(numberCount);
            sendCookerStr = headStr + numberCount.toString() + "人";
            MenuGetFlag = 1; // 标记今天已经获取统计信息
            res.reply(sendCookerStr);
            // 统计发送完之后清空每天统计的值
            Object.keys(this.selectSatus).forEach(function (key) {
                that.selectSatus[key] = 0;
            });
        } 
        else if (req.Content == "统计" && req.FromUserName != this.cookerId) {
            res.reply("你不是煮饭阿姨");
        }
    };


    /** 
     *  设定未查询主动推送时间和事件
     *  @param  
     */
    this.sendOnTime = function () {
        var that = this;
        // 定时主动提示   17:00 提示
        var rulepr = new schedule.RecurrenceRule();
        rulepr.dayOfWeek = [0, new schedule.Range(1, 6)];
        rulepr.hour = 23;
        rulepr.minute = 33;
        // 主动统计好发送给阿姨  17:40
        var rule = new schedule.RecurrenceRule();
        rule.dayOfWeek = [0, new schedule.Range(1, 6)];
        rule.hour = 0;
        rule.minute = 28;

        schedule.scheduleJob(rulepr, function () {  
            // 用户关注更新
            UserEvent.updateUserList().then(function (data) {
                    console.log('更新列表成功!');
                    UserEvent.addPerson2Group(data);
                });
            setTimeout(() => {
                if (that.send2CookerFlag == 0) {
                    var welStr = "晚饭时间到啦～\n";
                    var subStr = "1:要吃 2:不吃 3:默认以后都要吃\r\n  请在规定时间内回复是否要吃晚饭，请不要多次发送!!\n"
                    var sendUserStr = '';
                    sendUserStr = welStr + '\r\n' + subStr;
                    sendUserStr = sendUserStr.toString();
                    try {
                        // api.massSendText(sendUserStr, "100", function (err, result) { // 群发提示消息给员工
        
                        //     console.log('err is:', err);
                        //     console.log('result is', result);
                        // });
                    } catch (err) {
                        console.log(err);
                    }
                }
                console.log("======已经主动提示了过了======\r\n");
                that.send2CookerFlag = 0;    // 初始化提示标志
            }, 2000);
        });
        schedule.scheduleJob(rule, function () {
            console.log("每天5:20执行");
            if (MenuGetFlag == 0) {
    
                var headStr = "统计就餐人数有:\n";
                var sendCookerStr = '';
                var numberCount = that.selectSatus.eat + localData.total; // 统计要吃的人数   默认+要去的
                console.log("统计的总人数为",numberCount, "选择要去的为:", that.selectSatus.eat, "默认要去的有:", localData.total);
                sendCookerStr = headStr + numberCount + "";
                api.sendText(that.cookerId, sendCookerStr, function (err, result) { // 发送客服消息
                    console.log(result);
                });
            }
            MenuGetFlag = 0; // 每天固定清除标识位
            // 统计发送完之后清空每天统计的值
            Object.keys(that.selectSatus).forEach(function (key) {
                that.selectSatus[key] = 0;
            });
            limitTS = new Date().getTime();
        });
    };
};

/**
 * 用户组处理对象
 *   
 */
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
                                that.UserOpenid.splice(index, 1);
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

var MenuEvent = new MenuHandle();   // 实例化菜单处理对象

var UserEvent = new UserHandle();   // 实例化用户处理对象

var api = new weChatApi(config.appID, config.appSecret);

MenuEvent.sendOnTime(); 

router.use(express.query());   

router.use('/', wechat(config, function (req, res, next) {
    // console.log(typeof req.weixin);
    var message = req.weixin;
    console.log(req.weixin.FromUserName);

    if (!message.Content) { // 防止进入回调后内容为null
        return;
    } else {
        MenuEvent.CreatTodayMenu(message, res); //  获取今日菜单并分发给每个用户
    }

    MenuEvent.send2Cooker(message, res); // 获取统计后的信息 发送给煮饭阿姨 
    
    // get staff select food
    MenuEvent.addUp(message, res); // 菜品统计

    if (message.Content == "哈哈") {
        res.reply("嘻嘻");
    }
})); 

/**
 * 获取默认吃用户的OpenId，存入本地json文件
 * @param {String} UserId 输入统计信息用户的userId
 */ 
function changeLocalJson(UserId) {
    fs.readFile(localPath, function (err, data) {
        if (data == null) {
            console.log('文件不存在');
            return;
        }
        if (err) {
            console.log(err);
        }
        var Idbuffer = data.toString();
        console.log(Idbuffer);
        Idbuffer = JSON.parse(Idbuffer);
        Idbuffer.defaultNoEatPeople.push(UserId);   // 更新UserId 默认要吃的
        Idbuffer.total = Idbuffer.defaultNoEatPeople.length;

        var str = JSON.stringify(Idbuffer);

        fs.writeFile(localPath, str, function (err) {
            console.log('======修改成功=======');
        });

        console.time();
        fs.readFile(localPath, function (err, data) {
            console.log("修改之后的", data.toString());
        });
        console.timeEnd();
    });
}

/**
 * @param {String} mode   判断模式
 * @param {String} UserId 传入的用户的openid
 */ 
function cmpLocalJson(mode, UserId) {
    
    let localData = fs.readFileSync(localPath, 'utf-8');

    if (mode == 0) {
        // 选择要去的比较检验
        console.log(localData);
        if (localData.indexOf(UserId) != -1) {
            // satiation one： someone select both go and defaultgo
            console.log("选了默认去之后又选了去，造成重复，忽略本次操作");
            return 1;
        } else {
            console.log("正常,添加进本地");
            return 0;
        }
    }
    else if (mode == 1) {
        // 选择不去的比较校验
        if (localData.indexOf(UserId) != -1) {
            // 之前默认去，现在不去，取消
            localData = JSON.parse(localData);
            var LocalArrID = localData.defaultNoEatPeople;
            LocalArrID.splice(LocalArrID.indexOf(UserId), 1);
            // 将对象幅给一个变量后，操作变量对象本身不变化???
            localData.total = LocalArrID.length;
            fixStr = JSON.stringify(localData);
            fs.writeFileSync(localPath, fixStr);
            return;
        }
    }
}

module.exports = router;


// api.getGroups(function (err, result) { // 查询分组信息
//     // for (let i = 0; i < result.groups.length; i++) {
//     //     console.log(result.groups[i].name);
//     // }
//     console.log('分组信息为:', result);
//     console.log(err);
// });