// 优惠券模块配置
window.YhquanConfig = {
    api: {
        url: 'https://1317825751-14tsfynz25.ap-guangzhou.tencentscf.com',
        timeout: 30000
    },
    pagination: {
        pageSize: 48
    },
    share: {
        // 主系统复用独立优惠券站共享页，数据仍来自同一套 Firebase 共享节点。
        collectionUrl: 'https://yhq.cqytyy.top/zhiliao/gongxiang?pid=',
        // 默认：未配置完整链接时，基于当前页面地址动态生成分享链接
        collectionPath: 'zhiliao/gongxiang.html'
    }
};
