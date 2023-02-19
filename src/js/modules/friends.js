/**
 * QQ空间好友模块导出API
 * @author https://lvshuncai.com
 */

/**
 * 导出QQ空间好友
 */
API.Friends.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Friends_Row_Infos');
    indicator.print();

    try {
        // 获取所有的QQ好友
        let friends = await API.Friends.getAllList();
        console.log('好友列表获取完成，共有好友%i个', friends.length);

        // 添加QQ好友的头像下载
        API.Common.downloadUserAvatars(_.filter(friends, API.Friends.isNewItem));

        // 根据分组名称（非分组ID）进行排序
        friends = API.Utils.sort(friends, 'groupSortNo');
        console.log('好友列表排序完成');

        // 根据导出类型导出数据
        await API.Friends.exportAllToFiles(friends);

    } catch (error) {
        console.error('好友导出异常', error);
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有好友列表
 */
API.Friends.getAllList = async() => {
    // 重置数据
    QZone.Friends.Data = [];

    // 进度更新器
    const indicator = new StatusIndicator('Friends');
    indicator.setIndex(1);
    indicator.print();

    // 接口
    const friendListRest = QZone_Config.Friends.SortType === 'QQ' ? API.Friends.getSortFriends : API.Friends.getFriends;

    await friendListRest().then(async(data) => {
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取所有好友列表异常：', data);
        }
        data = data.data || {};

        QZone.Friends.Data = data.items || data.list || [];

        QZone.Friends.total = QZone.Friends.Data.length || QZone.Friends.total || 0;
        indicator.setTotal(QZone.Friends.total);

        indicator.addSuccess(QZone.Friends.Data);

        // 初始化分组名称
        API.Friends.initGroupName(data, QZone.Friends.Data);

        // 获取好友成立时间
        QZone.Friends.Data = await API.Friends.getFriendsTime(data, QZone.Friends.Data);

        // 获取好友空间权限
        await API.Friends.getZoneAccessList(QZone.Friends.Data);

        // 获取特别关心好友
        await API.Friends.getCareFriendList(QZone.Friends.Data);

        return QZone.Friends.Data;
    }).catch((e) => {
        console.error("获取好友列表异常", e);
    })

    // 完成
    indicator.complete();

    // 根据QQ号去重合并
    if (QZone_Config.Friends.isIncrement) {

        // 最新数据没有，历史数据存在的，表示已删除
        const deleteItems = _.filter(QZone.Friends.OLD_Data, item => _.findIndex(QZone.Friends.Data, ['uin', item.uin]) < 0);

        // 合并数据，并去重
        QZone.Friends.Data = _.unionBy(_.concat(QZone.Friends.OLD_Data, QZone.Friends.Data), 'uin');

        // 全部修改为非删除
        _.forEach(QZone.Friends.Data, item => item.deleted = false);

        // 再把删除项改为删除
        _.forEach(_.filter(QZone.Friends.Data, item => _.findIndex(deleteItems, ['uin', item.uin]) > -1), item => item.deleted = true);

    }

    return QZone.Friends.Data;
}

/**
 * 基于分组信息初始化分组名称
 * @param {Object} data 好友信息，含分组信息
 * @param {Array} friends 好友列表，不含分组名称
 */
API.Friends.initGroupName = (data, friends) => {
    // 将QQ分组进行分组
    const groups = data.gpnames;
    const groupMap = new Map();
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        group.sortNo = i + 1;
        //group.gpname
        groupMap.set(group.gpid, group);
    }

    // 遍历好友
    for (const friend of friends) {
        const group = groupMap.get(friend.groupid);
        // 排序号
        friend.groupSortNo = group.sortNo || 0;
        // 分组名称
        friend.groupName = group.gpname || "默认分组";
    }
}

/**
 * 获取好友添加时间
 */
API.Friends.getFriendsTime = async(data, friends) => {
    if (!QZone_Config.Friends.Interactive) {
        // 不获取好友添加时间，则跳过不处理
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
        friend.isMe = friend.uin === QZone.Common.Owner.uin;
        if (friend.isMe || !API.Friends.isNewItem(friend)) {
            // 好友号为自己号或非新好友，跳过
            if (friend.isMe) {
                friend.addFriendTime = 0;
                friend.intimacyScore = 0;
                friend.common = {};
            }
            indicator.addSkip(friend);
            continue;
        }
        await API.Friends.getFriendshipTime(friend.uin).then((data) => {
            // JSON转换
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                console.warn('获取互动信息异常：', friend, data);
                indicator.addFailed(friend);
            }

            // 互动信息
            const infoData = data = data.data || {};

            // 添加时间
            friend.addFriendTime = infoData['addFriendTime'] || 0;
            // 好友类型
            friend.isFriend = infoData['isFriend'] || -1;
            // 亲密度
            friend.intimacyScore = infoData['intimacyScore'] || 0;

            // 共同信息(共同好友，共同群组)
            friend.common = infoData['common'] || {};

            // 成功
            indicator.addSuccess(friend);
        }).catch((e) => {
            // 失败
            indicator.addFailed(friend);
            console.error("获取好友添加时间异常", friend, e);
        })

        // 等待一下再请求
        const min = QZone_Config.Friends.randomSeconds.min;
        const max = QZone_Config.Friends.randomSeconds.max;
        const seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
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
    return _.isEmpty(QZone.Friends.OLD_Data) || _.findIndex(QZone.Friends.OLD_Data, ['uin', item.uin]) == -1;
}

/**
 * 导出好友
 * @param {Array} friends 好友列表
 */
API.Friends.exportAllToFiles = async(friends) => {
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
API.Friends.exportToExcel = async(friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('Excel');

    // Excel数据
    let ws_data = [
        ["QQ", "QQ昵称", "QQ备注", "QQ分组", "特别关心", "相识时间", "空间权限", "好友关系", "亲密度", "共同好友", "共同群组", "QQ空间", "QQ通讯"]
    ];

    for (const friend of friends) {
        // QQ空间超链接
        const user_qzone_url = { t: 's', v: "QQ空间", l: { Target: API.Common.getUserUrl(friend.uin), Tooltip: "QQ空间" } };
        // QQ聊天超链接
        const user_message_url = { t: 's', v: "QQ聊天", l: { Target: API.Common.getMessageUrl(friend.uin), Tooltip: "QQ聊天" } };

        // 行信息
        const rowData = [
            friend.uin,
            friend.name,
            friend.remark,
            friend.groupName,
            API.Friends.getShowCare(friend),
            API.Friends.getShowFriendTime(friend, 0),
            API.Friends.getShowAccessType(friend),
            API.Friends.getShowFriendType(friend),
            API.Friends.getShowIntimacyScore(friend),
            API.Friends.getShowCommonFriend(friend),
            API.Friends.getShowCommonGroup(friend, '\n'),
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
    await API.Utils.writeFile(xlsxArrayBuffer, API.Common.getModuleRoot('Friends') + "/QQ好友.xlsx").then(fileEntry => {
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
API.Friends.exportToHtml = async(friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Friends');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('friends', friends, moduleFolder + '/json/friends.js');

        // 基于模板生成HTML
        await API.Common.writeHtmlofTpl('friends', null, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出好友到HTML异常', error, favorites);
    }

    // 更新完成信息
    indicator.complete();
    return friends;
}


/**
 * 导出QQ好友到MarkDown
 * @param {Array} friends 好友列表
 */
API.Friends.exportToMarkDown = async(friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('Markdown');

    // 群组分组
    const groupMaps = API.Utils.groupedByField(friends, 'groupName');

    // MD内容
    const contents = [];
    for (const [groupName, groupItems] of groupMaps) {
        contents.push('###### ' + groupName + "(" + groupItems.length + ")");
        for (const item of groupItems) {
            let nickname = item.remark || item.name;
            // 备份/昵称
            contents.push('\r\n');
            contents.push('- {0}'.format(API.Common.getUserLink(item.uin, nickname, "MD")));
            contents.push('\r\n');

            // 其它信息
            if (QZone_Config.Friends.SpecialCare) {
                contents.push('\t- 特别关心：{0}\r\n'.format(API.Friends.getShowCare(item)));
            }
            if (QZone_Config.Friends.Interactive) {
                contents.push('\t- 相识时间：{0}\r\n'.format(API.Friends.getShowFriendTime(item, 0)));
            }
            if (QZone_Config.Friends.ZoneAccess) {
                contents.push('\t- 空间权限：{0}\r\n'.format(API.Friends.getShowAccessType(item)));
            }
            if (QZone_Config.Friends.Interactive) {
                contents.push('\t- 好友类型：{0}\r\n'.format(API.Friends.getShowFriendType(item)));
                contents.push('\t- 亲密度：{0}\r\n'.format(API.Friends.getShowIntimacyScore(item)));
                contents.push('\t- 共同好友：{0}\r\n'.format(API.Friends.getShowCommonFriend(item)));
                contents.push('\t- 共同群组：{0}\r\n'.format(API.Friends.getShowCommonGroup(item, ',')));
            }
        }
        contents.push('\r\n');
        contents.push('---');
        contents.push('\r\n');
    }
    let content = contents.join('');
    await API.Utils.writeText(content, API.Common.getModuleRoot('Friends') + '/QQ好友.md').then((fileEntry) => {
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
API.Friends.exportToJson = async(friends) => {
    // 状态更新器
    const indicator = new StatusIndicator('Friends_Export');
    indicator.setIndex('JSON');

    let json = JSON.stringify(friends);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Friends') + '/friends.json').then((fileEntry) => {
        console.info("导出QQ好友的JSON文件到FileSystem完成", fileEntry);
    }).catch((error) => {
        console.error("导出QQ好友的JSON文件到FileSystem异常", error);
    });

    // 完成
    indicator.complete();
    return friends;
}

/**
 * 获取好友空间访问权限
 * @param {Array} friends 好友列表
 * @returns 
 */
API.Friends.getZoneAccessList = async(friends) => {
    if (!QZone_Config.Friends.ZoneAccess) {
        // 不获取好友空间访问权限，则跳过不处理
        return friends;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Friends_Access');
    indicator.setTotal(friends.length);

    // 遍历
    for (const friend of friends) {
        if (friend.isMe || !API.Friends.isNewItem(friend)) {
            indicator.addSkip(friend);
            continue;
        }
        // 设置默认值
        await API.Friends.getZoneAccess(friend.uin).then((data) => {
            // 转换JSON
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0 && data.code != -4009) {
                // 获取异常
                console.warn('获取好友空间访问权限异常：', friend, data);
            }

            // 状态码慰-4009表示无权限
            friend.access = data.code !== -4009;

            // 成功
            indicator.addSuccess(friend);
        }).catch((e) => {
            // 失败
            indicator.addFailed(friend);
            console.error("获取好友空间权限异常", friend, e);
        })
    }
    // 完成
    indicator.complete();
    return friends;
}

/**
 * 获取特别关心好友列表
 * @param {Array} friends 好友列表
 * @returns 
 */
API.Friends.getCareFriendList = async(friends) => {
    if (!QZone_Config.Friends.SpecialCare) {
        // 不获取特别关心的好友，则跳过
        return;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Friends_Care');

    // 查询
    await API.Friends.getSpecialCare().then((data) => {
        // 转换JSON
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取特别关心好友列表异常：', data);
        }
        data = data.data || {};

        // 关心的好友列表
        const items = data.items_special || [];

        // 总数
        indicator.setTotal(items.length);

        for (const item of items) {
            const friend = _.find(friends, (friend) => friend.uin === item.uin);
            friend.care = friend !== undefined;
        }

        // 成功
        indicator.addSuccess(items);
    }).catch((e) => {
        // 失败
        console.error("获取特别关心好友列表异常：", e);
    })

    // 完成
    indicator.complete();
}