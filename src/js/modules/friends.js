/**
 * QQ空间好友模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出QQ空间好友
 */
API.Friends.export = async () => {
    try {
        // 获取所有的QQ好友
        let friends = await API.Friends.getAllList();

        // 添加QQ好友的头像下载
        API.Common.downloadUserAvatars(friends);

        // 根据分组名称（非分组ID）进行排序
        friends = API.Utils.sort(friends, 'groupName');
        console.info('排序后', friends, QZone.Friends.Data)

        // 根据导出类型导出数据
        await API.Friends.exportAllToFiles(friends);

    } catch (error) {
        console.error('QQ好友导出异常', error);
    }
}

/**
 * 获取所有好友列表
 */
API.Friends.getAllList = async () => {
    // 重置数据
    QZone.Friends.Data = [];

    // 进度更新器
    const indicator = new StatusIndicator('Friends');

    // 开始
    indicator.print();

    await API.Friends.getFriends().then(async (data) => {
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data;

        QZone.Friends.Data = data.items || [];

        QZone.Friends.total = QZone.Friends.Data.length || QZone.Friends.total || 0;
        indicator.setTotal(QZone.Friends.total);

        indicator.addSuccess(QZone.Friends.Data);

        // 获取好友成立时间
        QZone.Friends.Data = await API.Friends.getFriendsTime(data, QZone.Friends.Data);

        return QZone.Friends.Data;
    }).catch((e) => {
        console.error("获取好友列表异常", e);
    })

    // 完成
    indicator.complete();

    // 根据QQ号去重合并
    if (QZone_Config.Friends.isIncrement) {
        QZone.Friends.Data = _.concat(QZone.Friends.OLD_Data, QZone.Friends.Data);
        QZone.Friends.Data = _.unionBy(QZone.Friends.Data, 'uin');
    }

    return QZone.Friends.Data;
}

/**
 * 获取好友添加时间
 */
API.Friends.getFriendsTime = async (data, friends) => {
    if (!QZone_Config.Friends.hasAddTime || QZone_Config.Friends.exportType === 'MarkDown') {
        // 不获取好友添加时间或导出类型为Markdown，则跳过不处理
        return friends;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Friends_Time');
    indicator.setTotal(friends.length);

    // 将QQ分组进行分组
    let groups = data.gpnames;
    let groupMap = new Map();
    for (const group of groups) {
        groupMap.set(group.gpid, group.gpname);
    }
    // 遍历
    for (const friend of friends) {
        // 设置默认值
        friend.groupName = groupMap.get(friend.groupid) || "默认分组";
        const isMe = friend.uin === QZone.Common.Owner.uin;
        if (isMe || !API.Friends.isNewItem(friend)) {
            // 好友号为自己号或非新好友，跳过
            if (isMe) {
                friend.addFriendTime = "自己啦";
                friend.intimacyScore = "这要看您多爱护自己啦";
                friend.common = {};
            }
            indicator.addSkip(friend);
            continue;
        }
        await API.Friends.getFriendshipTime(friend.uin).then((time_data) => {
            time_data = API.Utils.toJson(time_data, /^_Callback\(/);
            time_data = time_data.data;

            // 添加时间
            let addTime = time_data.addFriendTime || 0;
            addTime = addTime == 0 ? "老朋友啦" : API.Utils.formatDate(addTime);
            friend.addFriendTime = addTime;

            // 亲密度
            friend.intimacyScore = time_data.intimacyScore || 0;

            // 共同信息(共同好友，共同群组)
            friend.common = time_data.common || {};

            // 成功
            indicator.addSuccess(friend);
        }).catch((e) => {
            // 失败
            indicator.addFailed(friend);
            console.error("获取好友添加时间异常", friend, e);
        })
    }
    // 完成
    indicator.complete();
    return friends;
}

/**
 * 是否为新好友
 * @param {object} item 好友
 */
API.Friends.isNewItem = (item) => {
    if (!QZone_Config.Friends.isIncrement) {
        return true;
    }
    return QZone.Friends.OLD_Data.getIndex(item.uin, 'uin') == -1;
}

/**
 * 导出好友
 * @param {Array} friends 好友列表
 */
API.Friends.exportAllToFiles = async (friends) => {
    // 获取用户配置
    let exportType = QZone_Config.Friends.exportType;
    switch (exportType) {
        case 'Excel':
            await API.Friends.exportToExcel(friends);
            break;
        case 'HTML':
            await API.Friends.exportToHtml(friends);
            break;
        case 'MarkDown':
            await API.Friends.exportToMarkDown(friends);
            break;
        case 'JSON':
            await API.Friends.exportToJson(friends);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出QQ好友到Excel
 * @param {Array} friends 好友列表
 */
API.Friends.exportToExcel = async (friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('Excel');

    // Excel数据
    let ws_data = [
        ["QQ号", "备注名称", "QQ昵称", "所在分组", "相识时间", "亲密度", "共同好友", "共同群组", "用户主页", "即时消息"]
    ];

    for (const friend of friends) {
        // QQ空间超链接
        const user_qzone_url = { t: 's', v: "QQ空间", l: { Target: API.Common.getUserUrl(friend.uin), Tooltip: "QQ空间" } };
        // QQ聊天超链接
        const user_message_url = { t: 's', v: "QQ聊天", l: { Target: API.Common.getMessageUrl(friend.uin), Tooltip: "QQ聊天" } };

        // 共同信息
        friend.common = friend.common || {};
        friend.common.friend = friend.common.friend || [];
        friend.common.group = friend.common.group || [];
        const groups = [];
        for (const group of friend.common.group) {
            groups.push(group.name);
        }
        const rowData = [
            friend.uin, 
            friend.remark, 
            friend.name, 
            friend.groupName, 
            friend.addFriendTime, 
            friend.intimacyScore, 
            friend.common.friend.length, 
            groups.join('\n'), 
            user_qzone_url, 
            user_message_url
        ];
        ws_data.push(rowData);
    }

    // 创建WorkBook
    let workbook = XLSX.utils.book_new();

    let worksheet = XLSX.utils.aoa_to_sheet(ws_data);

    XLSX.utils.book_append_sheet(workbook, worksheet, "QQ好友");

    // 写入XLSX到HTML5的FileSystem
    let xlsxArrayBuffer = API.Utils.toArrayBuffer(XLSX.write(workbook, { bookType: 'xlsx', bookSST: false, type: 'binary' }));
    await API.Utils.writeFile(xlsxArrayBuffer, QZone.Friends.ROOT + "/QQ好友.xlsx").then(fileEntry => {
        console.info('导出QQ好友到Excel成功', friends, fileEntry);
    }).catch(error => {
        console.error('导出QQ好友到Excel失败', friends, error);
    });
    // 完成
    indicator.complete();
    return friends;
}

/**
 * 导出QQ好友到HTML
 * @param {Array} friends 好友列表
 */
API.Friends.exportToHtml = async (friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('HTML');

    // 基于JSON生成JS
    console.info('生成好友JSON开始', friends);
    await API.Utils.createFolder(QZone.Common.ROOT + '/json');
    const jsonFile = await API.Common.writeJsonToJs('friends', friends, QZone.Common.ROOT + '/json/friends.js');
    console.info('生成好友JSON结束', jsonFile, friends);

    // 基于模板生成HTML
    console.info('生成好友列表HTML开始', friends);
    const listFile = await API.Common.writeHtmlofTpl('friends', null, QZone.Friends.ROOT + "/index.html");
    console.info('生成好友列表HTML结束', listFile, friends);

    // 更新完成信息
    indicator.complete();
    return friends;
}


/**
 * 导出QQ好友到MarkDown
 * @param {Array} friends 好友列表
 */
API.Friends.exportToMarkDown = async (friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('Markdown');

    let groupMap = new Map();
    for (const friend of friends) {
        let groupName = friend.groupName;
        let groupItems = groupMap.get(groupName) || [];
        groupItems.push(friend);
        groupMap.set(groupName, groupItems);
    }

    const contents = [];
    for (const groupEntry of groupMap) {
        let groupName = groupEntry[0];
        let groupItems = groupEntry[1];
        contents.push('###### ' + groupName);
        for (const item of groupItems) {
            let nickname = item.remark || item.name;
            contents.push('\r\n');
            contents.push('- {0}'.format(API.Common.getUserLink(item.uin, nickname, "MD")));
            contents.push('\r\n');
        }
        contents.push('\r\n');
        contents.push('---');
        contents.push('\r\n');
    }
    let content = contents.join('');
    await API.Utils.writeText(content, QZone.Friends.ROOT + '/QQ好友.md').then((fileEntry) => {
        console.info("导出QQ好友的MarkDown文件到FileSystem完成", fileEntry);
    }).catch((error) => {
        console.error("导出QQ好友的MarkDown文件到FileSystem异常", error);
    });
    // 完成
    indicator.complete();
    return friends;
}


/**
 * 导出QQ好友到JSON
 * @param {Array} friends 好友列表
 */
API.Friends.exportToJson = async (friends) => {
    // 状态更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('JSON');

    let json = JSON.stringify(friends);
    await API.Utils.writeText(json, QZone.Friends.ROOT + '/friends.json').then((fileEntry) => {
        console.info("导出QQ好友的JSON文件到FileSystem完成", fileEntry);
    }).catch((error) => {
        console.error("导出QQ好友的JSON文件到FileSystem异常", error);
    });

    // 完成
    indicator.complete();
    return friends;
}