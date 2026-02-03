// 商品查询模块配置
window.ChaxunConfig = {
    api: {
        url: 'https://1317825751-lqnvz24xzp.ap-guangzhou.tencentscf.com',
        pmsUrl: 'https://1317825751-h10r9y169r.ap-guangzhou.tencentscf.com'
    },
    pagination: {
        pageSize: 50,
        fetchPages: 1
    },
    wholesaleTypes: {
        1: '一口价',
        4: '特价',
        5: '限时特价',
        10: '赠品',
        7: '普通拼团',
        8: '批购包邮',
        71: '诊所拼团',
        11: '未知'
    },
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
