// BI运营模块共享配置：仅保留登录、代理和Ultra查询仍使用的公共信息。
window.YejiConfig = {
    api: {
        url: 'https://bi.cfdaili.top'
    },
    headers: {
        'x-dom-id': 'Z3VhbmJp',
        'user-id': 'TFkxMTA0MTk=',
        'raw-backend-response': 'TRUE',
        'cache-control': 'no-cache'
    },
    page2: {
        selectors: {
            // BI登录后用于解析供应商归属。
            company: 'f7995f5fc0ebe4226aec9dc6'
        }
    }
};

// Ultra page, field, and filter configuration.
window.YejiConfig.ultra = {
    pageId: 'a71ab51244ebd4a9296aa4de',
    cardId: 'v37695c5612944a7baa0c6fa',
    cardName: '自助查询结果-每天9点前更新至昨天数据',
    dsId: 'ebc37edf77c8540cdad40b62',
    limit: 50,
    dateFilter: {
        name: '出库日期',
        fdId: 't4115ca5bb1574cb39287216',
        fdType: 'DATE',
        sourceCdId: 'm9783f8136104467aae363d3'
    },
    defaultRowKeys: [
        'PSDJsLbUyxFsFWMYBbnyQstm',
        'kpBvjBmOrPLRVOnrFluUjmWW',
        'DswHsZkXRxmIBTfEpcGGrXsT',
        'VlKWJbltPoDprCUbPQapqzTG'
    ],
    defaultMetricKeys: [
        'VGfVfarkNvRsSwAMIsYSqMSA',
        'dCXrTSwxSFgjuudIGvkrFpbL',
        'NeQtrSldSbFoGeUThoaGzANr',
        'KDPMilUbvhnnHNlxfDTUbpXt',
        'OIarCNLfRiLjFWUrCaXVZAfg'
    ],
    filterOrder: [
        'm9783f8136104467aae363d3',
        'd07a25ed6817d42a98f4747a',
        'ee97e898a34434fd0ba17be9',
        'u308da1e08a3843af8c17f8f',
        'd9e4ee1942f5747babcc7cee',
        'qdcc22aa399934e0b80209ff',
        'ra8865866e3f0420d84a3628',
        'o77289361d4514b42a6c73c9',
        'eda7d7112113e4879b4d6fdc',
        'oe30aa7b5f0424f8791873ce',
        'd0c349f33cf574513b2fd071',
        'c4b94d5e3cc3145ce8c905d1',
        'ff17ebcf885dd4f74aaf80dd',
        'cec3399458be84b7e870088b',
        'p0f0623b3d4494ab4b39753f',
        'h6ce185ff8f7e43bdb01efd9',
        'k4d71cbc2995e4c1aa6970c3',
        'pdfaa321c5e2c452fbe34c7b',
        'f8aa3c202c1794b76bfd3195',
        'nbe03890ec2f44aac88fbc08'
    ],
    columnFields: [
        { name: '度量名', metaType: 'MPH', key: 'uozZlpKtFkgCEzfBmCMTIPkE' }
    ],
    rowFields: [
        { key: 'nebZXyfTkXXEVuOZOzmokaMJ', fdId: 't4115ca5bb1574cb39287216', name: '出库日期', fdType: 'DATE', metaType: 'DIM', isAggregated: false, calculationType: 'normal', level: 'dataset', annotation: '' },
        { key: 'kpBvjBmOrPLRVOnrFluUjmWW', fdId: 'p3cac7f687a804497b74b98b', name: '省份', fdType: 'STRING', metaType: 'DIM', isAggregated: false, calculationType: 'normal', level: 'dataset', annotation: '' },
        { key: 'DswHsZkXRxmIBTfEpcGGrXsT', fdId: 'i1929f755ea9a4ad2942eb94', name: '客户名称', fdType: 'STRING', metaType: 'DIM', isAggregated: false, calculationType: 'normal', level: 'dataset', annotation: '' },
        { key: 'VlKWJbltPoDprCUbPQapqzTG', fdId: 'v03b35fb5461345fd8a900be', name: '客户类型', fdType: 'STRING', metaType: 'DIM', isAggregated: false, calculationType: 'normal', level: 'dataset', annotation: '' },
        { key: 'tmCLNLQCDhwqTJwZRfnESkEE', fdId: 'jdd2df11bcea94082bab3dfa', name: '商品名称', fdType: 'STRING', metaType: 'DIM', isAggregated: false, calculationType: 'normal', level: 'dataset', annotation: '' },
        { key: 'asTCfdSzyWvGkoEldnoneeQm', fdId: 'ma4ad10caafdb4342b9e5f5b', name: '商品规格', fdType: 'STRING', metaType: 'DIM', isAggregated: false, calculationType: 'normal', level: 'dataset', annotation: '' }
    ],
    metricFields: [
        { key: 'VGfVfarkNvRsSwAMIsYSqMSA', fdId: 'j0e16b46f641d4dfa9dd7a3c', name: '含税金额', fdType: 'DOUBLE', metaType: 'METRIC', aggrType: 'SUM', isAggregated: false, calculationType: 'normal', baseFdType: 'DOUBLE', level: 'dataset', annotation: '' },
        { key: 'WEqpSMNKbyJQVSDiTTwjWJaf', fdId: 'mc2f8b25eae18461288dd87b', name: '不含税金额', fdType: 'DOUBLE', metaType: 'METRIC', aggrType: 'SUM', isAggregated: false, calculationType: 'normal', baseFdType: 'DOUBLE', level: 'dataset', annotation: '', alias: '不含税金额' },
        { key: 'dCXrTSwxSFgjuudIGvkrFpbL', fdId: 'c0ba10fa8ddb44775aaa305e', name: '不含税边际利润', fdType: 'DOUBLE', metaType: 'METRIC', aggrType: 'SUM', isAggregated: false, calculationType: 'normal', baseFdType: 'DOUBLE', level: 'dataset', annotation: '' },
        { key: 'NeQtrSldSbFoGeUThoaGzANr', fdId: 'f1f06f56a7015406a821e343', name: '不含税边际利润率', fdType: 'DOUBLE', metaType: 'METRIC', isAggregated: true, calculationType: 'aggregation', baseFdType: 'DOUBLE', formula: 'sum([不含税边际利润])/sum([不含税金额])', level: 'dataset', annotation: '' },
        { key: 'OIarCNLfRiLjFWUrCaXVZAfg', fdId: 'nde764f4ca9fa498f8d0aafe', name: '不含税配送费率', fdType: 'DOUBLE', metaType: 'METRIC', isAggregated: true, calculationType: 'aggregation', baseFdType: 'DOUBLE', formula: 'sum([不含税配送费])/sum([不含税金额])', level: 'dataset', annotation: '' },
        { key: 'KDPMilUbvhnnHNlxfDTUbpXt', fdId: 'mb6f3f3f8785f4b2dab1acaa', name: '不含税人工费率', fdType: 'DOUBLE', metaType: 'METRIC', isAggregated: true, calculationType: 'aggregation', baseFdType: 'DOUBLE', formula: 'sum([不含税仓库人工费])/sum([不含税金额])', level: 'dataset', annotation: '' }
    ],
    selectors: [
        { cdId: 'm9783f8136104467aae363d3', name: '出库日期', selectorType: 'TIME_MACRO', filterType: 'BT', defaultValue: '本月到昨天', fields: [{ fdId: 't4115ca5bb1574cb39287216', name: '出库日期', fdType: 'DATE', metaType: 'DIM' }] },
        { cdId: 'd07a25ed6817d42a98f4747a', name: '支付日期', selectorType: 'TIME_MACRO', filterType: 'BT', fields: [{ fdId: 'h8052c3c2934345ac89563ab', name: '支付日期', fdType: 'DATE', metaType: 'DIM' }] },
        { cdId: 'oe30aa7b5f0424f8791873ce', name: '省份-城市-区', selectorType: 'TREE', filterType: 'IN', content: { withPath: true }, fields: [
            { fdId: 'p3cac7f687a804497b74b98b', name: '省份', fdType: 'STRING', metaType: 'DIM' },
            { fdId: 'becf6177142c2477fa93f47a', name: '城市', fdType: 'STRING', metaType: 'DIM' },
            { fdId: 'g51b25e2d622a4984b686aaf', name: '区', fdType: 'STRING', metaType: 'DIM' }
        ], settings: { asFilter: { columnMappings: [
            {
                sourceField: { fdId: 'p3cac7f687a804497b74b98b', name: '省份', dsId: 'ebc37edf77c8540cdad40b62' },
                targetFields: [{ fdId: 'p3cac7f687a804497b74b98b', name: '省份', dsId: 'ebc37edf77c8540cdad40b62', cdId: 'v37695c5612944a7baa0c6fa' }]
            },
            {
                sourceField: { fdId: 'becf6177142c2477fa93f47a', name: '城市', dsId: 'ebc37edf77c8540cdad40b62' },
                targetFields: [{ fdId: 'becf6177142c2477fa93f47a', name: '城市', dsId: 'ebc37edf77c8540cdad40b62', cdId: 'v37695c5612944a7baa0c6fa' }]
            },
            {
                sourceField: { fdId: 'g51b25e2d622a4984b686aaf', name: '区 ', dsId: 'ebc37edf77c8540cdad40b62' },
                targetFields: [{ fdId: 'xdd37bafd66dd4aa6962d12d', name: '区new', dsId: 'ebc37edf77c8540cdad40b62', cdId: 'v37695c5612944a7baa0c6fa' }]
            }
        ] } } },
        { cdId: 'u6359e3dc59334e7ca7db24d', name: '省内外', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'i5767918168f841918af08ec', name: '省内外', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'd9e4ee1942f5747babcc7cee', name: '客户类型', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'v03b35fb5461345fd8a900be', name: '客户类型', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'ee97e898a34434fd0ba17be9', name: '业务类型', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'sf0cca238e787449cad15b17', name: '业务类型', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'u308da1e08a3843af8c17f8f', name: '活动类型', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'pc31754e7fd7a40739f30521', name: '活动类型', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'uba63a7866c8748da8915ce0', name: '环数标签', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'c1ebaa172cc47477d80820ad', name: '环数标签', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'x73ba0e92f4f14e48ab8471b', name: '单据类型', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'wb6d6af5af1484268af905d2', name: '单据类型', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'l829dbf4a20044693ab88cc9', name: '子公司', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'od5ddc53f7c1f43cdbfbad4d', name: '子公司名称', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'qdcc22aa399934e0b80209ff', name: 'ERP商品编码', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'e2cf19230839641debd5516c', name: 'ERP商品编码', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'c92a864e61a1c4a0d8fa671d', name: '批次', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'jf0f485704d9546f0a06c154', name: '批次', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'ra8865866e3f0420d84a3628', name: 'spuid', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'v913152f850b44c0ca563192', name: 'spuid', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'r91aebc112bac4a30bb49813', name: '厂牌', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'j15ca66a3dde4417fac8af6e', name: '厂牌', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'o77289361d4514b42a6c73c9', name: '乐药编码', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 's63da26b1d9c640259217497', name: '乐药编码', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'dfca9dc1e9e0b4388ad28078', name: '仓库名称', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'u1934cedb5f94443a8d33ae3', name: '仓库名称', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'd0c349f33cf574513b2fd071', name: '商品名称', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'jdd2df11bcea94082bab3dfa', name: '商品名称', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'tb000c70893c04608b5a9a9a', name: '通用名', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'o68030b095bc74362b0838d0', name: '通用名', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'c4b94d5e3cc3145ce8c905d1', name: '药店id', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'e5f8c7f2d4dee47139e62902', name: '药店id', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'ff17ebcf885dd4f74aaf80dd', name: '客户编码', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'j0599925ad3024ff9bcadfdb', name: '客户编码', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'cec3399458be84b7e870088b', name: '客户名称', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'i1929f755ea9a4ad2942eb94', name: '客户名称', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'i9aee01e841f1466aaa0d8c9', name: '出库单号', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'f8bac224742f84cc88d6f260', name: '出库单号', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'p0f0623b3d4494ab4b39753f', name: '药师帮ID', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'r6a9b98caaff54edfb9ae4d3', name: '药师帮ID', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 't75b519e5998f4bc7bb4ea32', name: '活动id', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'hdfe2943a3bc943a2a70e026', name: '活动id', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 's9b1e01469fe04d9f92d8657', name: '星期几（支付日期）', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'qe8863e81ec634f6bae7cb03', name: '星期几（支付日期）', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'eda7d7112113e4879b4d6fdc', name: '省份', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'p3cac7f687a804497b74b98b', name: '省份', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'h6ce185ff8f7e43bdb01efd9', name: '是否3K', selectorType: 'DS_ELEMENTS', filterType: 'IN', multiSelect: false, fields: [{ fdId: 'h904257877f094e3caa1cd17', name: '是否3K', fdType: 'INT', metaType: 'METRIC' }] },
        { cdId: 'k4d71cbc2995e4c1aa6970c3', name: '是否5W', selectorType: 'DS_ELEMENTS', filterType: 'IN', multiSelect: false, fields: [{ fdId: 'd1985e29e8b23417cb49ebbd', name: '是否5W', fdType: 'INT', metaType: 'METRIC' }] },
        { cdId: 'pdfaa321c5e2c452fbe34c7b', name: 'l标签', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'qe7ee34400ec64713a829fef', name: 'l标签', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'f8aa3c202c1794b76bfd3195', name: '是否3K5W', selectorType: 'DS_ELEMENTS', filterType: 'IN', multiSelect: false, fields: [{ fdId: 'e77b68810201c4b299a0bd41', name: '是否3K5W', fdType: 'DOUBLE', metaType: 'METRIC' }] },
        { cdId: 'ce6e963438c7846598be0c90', name: '运单号', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'e3cd3d2c2a2b94b19bdf9b21', name: '快递单号', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'x8337edbee1cd4e6e9c40614', name: '快递公司', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'a0870ebde255e47e6a43b289', name: '快递公司', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'me777f798301d47098f5dc25', name: '销售开票单号', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'u7dbde1e10e1c409a8154c48', name: '销售开票单号', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'v422969979441400191de89d', name: '药师帮单号', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'p762160baf41342a6ae07f72', name: '药师帮单号', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'nbe03890ec2f44aac88fbc08', name: '自动化运营标签', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'kf6e72effaae7461b90fdd90', name: '自动化运营标签', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'a27ccf75ce54548eda95e5b1', name: '品种负责人', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'ifca606d9e98e4450920afea', name: '品种负责人', fdType: 'STRING', metaType: 'DIM' }] },
        { cdId: 'r17a48978432c4513b2f13a2', name: '运营负责人', selectorType: 'DS_ELEMENTS', filterType: 'IN', fields: [{ fdId: 'je5c9188fb5714cd09a0b42f', name: '运营负责人', fdType: 'STRING', metaType: 'DIM' }] }
    ]
};


