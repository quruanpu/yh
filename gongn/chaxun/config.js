// 商品查询模块配置
window.ChaxunConfig = {
    api: {
        // 商品查询云函数地址
        url: 'https://1317825751-lqnvz24xzp.ap-guangzhou.tencentscf.com',
        timeout: 30000
    },
    pagination: {
        pageSize: 50,
        fetchPages: 1
    },
    display: {
        initialDisplay: 20
    },
    // 活动类型映射（用于复选框）
    wholesaleTypes: {
        1: '一口价',
        4: '特价',
        5: '限时特价',
        10: '特价不可用券',
        8: '赠品',
        7: '普通拼团',
        71: '批购包邮',
        11: '诊所拼团'
    },
    // 商品状态映射（用于下拉框）
    statusTypes: {
        '0': '进行中',
        '1': '待开始',
        '3': '未上架',
        '2': '缺货下架',
        '8': '未动销下架',
        '4': '已下架',
        '5': '资质待审核',
        '7': '已结束',
        '6': '资质不通过'
    }
};
