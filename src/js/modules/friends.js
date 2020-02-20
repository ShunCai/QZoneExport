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
    let indicator = new StatusIndicator('Friends');

    // 开始
    indicator.print();

    let friends = await API.Friends.getFriends().then(async (data) => {
        data = API.Utils.toJson(data, /^_Callback\(/);
        data = data.data;

        let friends = data.items || [];

        QZone.Friends.total = friends.length;
        indicator.setTotal(friends.length);

        QZone.Friends.Data = data.items;
        indicator.addSuccess(friends);

        // 获取好友成立时间
        friends = await API.Friends.getFriendsTime(data, friends);

        return friends;
    }).catch((e) => {
        console.error("获取好友列表异常", e);
    })

    // 完成
    indicator.complete();

    return friends || [];
}

/**
 * 获取好友添加时间
 */
API.Friends.getFriendsTime = async (data, friends) => {
    // 进度更新器
    let indicator = new StatusIndicator('Friends_Time');
    // 将QQ分组进行分组
    let groups = data.gpnames;
    let groupMap = new Map();
    for (const group of groups) {
        groupMap.set(group.gpid, group.gpname);
    }
    indicator.setTotal(friends.length);
    for (const friend of friends) {
        friend.groupName = groupMap.get(friend.groupid) || "默认分组";
        if (!Qzone_Config.Friends.hasAddTime || Qzone_Config.Friends.exportType === 'MarkDown') {
            // 不获取好友添加时间则跳过
            continue;
        }
        let addFriendTime = await API.Friends.getFriendshipTime(friend.uin).then((time_data) => {
            indicator.addSuccess(1);
            time_data = API.Utils.toJson(time_data, /^_Callback\(/);
            time_data = time_data.data;
            let addTime = time_data.addFriendTime || 0;
            addTime = addTime == 0 ? "老朋友啦" : API.Utils.formatDate(addTime);
            return addTime;
        }).catch((e) => {
            indicator.addFailed(1);
            console.error("获取好友添加时间异常", friend, e);
        })
        friend.addFriendTime = addFriendTime;
    }
    indicator.complete();
    return friends;
}

/**
 * 导出好友
 * @param {Array} friends 好友列表
 */
API.Friends.exportAllToFiles = async (friends) => {
    // 获取用户配置
    let exportType = Qzone_Config.Friends.exportType;
    switch (exportType) {
        case 'Excel':
            await API.Friends.exportToExcel(friends);
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
    let indicator = new StatusIndicator('Friends_Export');
    indicator.setTotal(friends.length);
    // Excel数据
    let ws_data = [
        ["QQ号", "备注名称", "QQ昵称", "所在分组", "添加时间", "用户主页", "即时消息"]
    ];

    for (const friend of friends) {
        // QQ空间超链接
        const user_qzone_url = { t: 's', v: "QQ空间", l: { Target: API.Common.getUserUrl(friend.uin), Tooltip: "QQ空间" } };
        // QQ聊天超链接
        const user_message_url = { t: 's', v: "QQ聊天", l: { Target: API.Common.getMessageUrl(friend.uin), Tooltip: "QQ聊天" } };
        let rowData = [friend.uin, friend.remark, friend.name, friend.groupName, friend.addFriendTime, user_qzone_url, user_message_url];
        ws_data.push(rowData);
    }

    // 更新下载中数量
    indicator.addDownload(friends);

    // 创建WorkBook
    let workbook = XLSX.utils.book_new();

    let worksheet = XLSX.utils.aoa_to_sheet(ws_data);

    XLSX.utils.book_append_sheet(workbook, worksheet, "QQ好友");

    // 写入XLSX到HTML5的FileSystem
    let xlsxArrayBuffer = API.Utils.toArrayBuffer(XLSX.write(workbook, { bookType: 'xlsx', bookSST: false, type: 'binary' }));
    await API.Utils.writeExcel(xlsxArrayBuffer, QZone.Friends.ROOT + "/QQ好友.xlsx").then(fileEntry => {
        indicator.addSuccess(friends);
        console.debug('导出QQ好友到Excel成功', friends, fileEntry);
    }).catch(error => {
        console.error('导出QQ好友到Excel失败', friends, error);
        indicator.addFailed(friends);
    });
    indicator.complete();
    return friends;
}



/**
 * 导出QQ好友到MarkDown
 * @param {Array} friends 好友列表
 */
API.Friends.exportToMarkDown = async (friends) => {
    let indicator = new StatusIndicator('Friends_Export');
    indicator.setTotal(friends.length);

    let groupMap = new Map();
    for (const friend of friends) {
        let groupName = friend.groupName;
        let groupItems = groupMap.get(groupName) || [];
        groupItems.push(friend);
        groupMap.set(groupName, groupItems);
    }

    let contents = [];
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
        indicator.addSuccess(friends);
    }).catch((error) => {
        console.error("导出QQ好友的MarkDown文件到FileSystem异常", error);
        indicator.addFailed(friends);
    });
    indicator.complete();
    return friends;
}


/**
 * 导出QQ好友到JSON
 * @param {Array} friends 好友列表
 */
API.Friends.exportToJson = async (friends) => {
    let indicator = new StatusIndicator('Friends_Export');
    indicator.setTotal(friends.length);
    let json = JSON.stringify(friends);
    await API.Utils.writeText(json, QZone.Friends.ROOT + '/QQ好友.json').then((fileEntry) => {
        console.error("导出QQ好友的JSON文件到FileSystem完成", fileEntry);
        indicator.addSuccess(friends);
    }).catch((error) => {
        console.error("导出QQ好友的JSON文件到FileSystem异常", error);
        indicator.addFailed(friends);
    });
    indicator.complete();
    return friends;
}