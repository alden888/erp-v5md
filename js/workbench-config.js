// ============================================
// V14.2 PRO ERP - CONFIGURATION MODULE (FINAL)
// 核心配置文件：融合了 v5_erp_ 标准与 Firebase 高级功能
// ============================================

const WorkbenchConfig = Object.freeze({
    // 系统基础信息
    SYSTEM: {
        VERSION: 'V14.2-PRO-ERP',
        APP_NAME: 'V5 Medical 战时指挥台',
        CASH_RED_LINE_HOURS: 72, // 现金红线预警小时数
        STORAGE_PREFIX: 'v5_erp_' // 🔥 核心：确认为 v5_erp_
    },

    // 🔥 核心：统一存储键名 (必须用 v5_erp_)
    STORAGE_KEYS: {
        ORDERS: 'v5_erp_orders',
        CUSTOMERS: 'v5_erp_customers',
        SUPPLIERS: 'v5_erp_suppliers',
        EXPENSES: 'v5_erp_expenses',
        TARGET: 'v5_erp_target',
        SETTINGS: 'v5_erp_settings',
        TODAY_ACTIONS: 'v5_erp_today_actions',
        UNLOCK_TIME: 'v5_erp_unlock_time',
        
        // 辅助键
        USD_RATE: 'v5_erp_usd_rate',
        AUTH_TOKEN: 'v5_erp_auth_token',
        FIREBASE_CONFIG: 'v5_erp_firebase_config'
    },

    // ☁️ Firebase 集合名称 (保留！用于云同步)
    // 这些是云端数据库里的“文件夹”名字，不需要加前缀
    FIREBASE_COLLECTIONS: {
        ORDERS: 'orders',
        SUPPLIERS: 'suppliers',
        CUSTOMERS: 'customers',
        EXPENSES: 'expenses',
        TODAY_ACTIONS: 'today_actions',
        SETTINGS: 'settings'
    },

    // 💰 货币配置 (保留)
    CURRENCY: {
        DEFAULT: 'USD',
        DEFAULT_RATE: 7.10, 
        LIST: {
            'USD': { symbol: '$', name: '美元', rate: 7.10 },
            'EUR': { symbol: '€', name: '欧元', rate: 7.80 },
            'GBP': { symbol: '£', name: '英镑', rate: 9.10 },
            'CNY': { symbol: '¥', name: '人民币', rate: 1.00 },
            'PHP': { symbol: '₱', name: '菲律宾比索', rate: 0.12 }, 
            'TRY': { symbol: '₺', name: '土耳其里拉', rate: 0.22 }  
        }
    },

    // 🌍 国家/地区配置 (保留，CRM模块需要)
    COUNTRIES: [
        { code: 'CN', name: 'China', flag: '🇨🇳', currency: 'CNY' },
        { code: 'PH', name: 'Philippines', flag: '🇵🇭', currency: 'PHP' },
        { code: 'TR', name: 'Turkey', flag: '🇹🇷', currency: 'TRY' },
        { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: 'EUR' },
        { code: 'GB', name: 'UK', flag: '🇬🇧', currency: 'GBP' },
        { code: 'US', name: 'USA', flag: '🇺🇸', currency: 'USD' },
        { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR' }
    ],

    // 🔄 数据迁移 (帮您把 workbench_ 或 v14_ 的旧数据搬过来)
    MIGRATION: {
        ENABLED: true,
        MAPPINGS: [
            // 把 Claude 之前生成的 workbench_ 数据迁移到 v5_erp_
            { from: 'workbench_orders', to: 'v5_erp_orders' },
            { from: 'workbench_customers', to: 'v5_erp_customers' },
            { from: 'workbench_suppliers', to: 'v5_erp_suppliers' },
            { from: 'workbench_expenses', to: 'v5_erp_expenses' },
            // 把 V13/V14 的旧数据迁移过来
            { from: 'v14_today_actions', to: 'v5_erp_today_actions' },
            { from: 'v14_unlock_time', to: 'v5_erp_unlock_time' }
        ]
    },

    // 初始化方法
    init: function() {
        console.log(`[Config] ${this.SYSTEM.VERSION} Loaded. Prefix: ${this.SYSTEM.STORAGE_PREFIX}`);
        if (this.MIGRATION.ENABLED) this.migrateData();
        return true;
    },

    // 迁移执行逻辑
    migrateData: function() {
        this.MIGRATION.MAPPINGS.forEach(({ from, to }) => {
            const oldData = localStorage.getItem(from);
            const newData = localStorage.getItem(to);
            // 只有当“旧的有”且“新的没有”时才迁移，防止覆盖新数据
            if (oldData && !newData) {
                localStorage.setItem(to, oldData);
                console.log(`[Migration] ✅ Data moved: ${from} -> ${to}`);
            }
        });
    }
});

// 挂载到全局
window.WorkbenchConfig = WorkbenchConfig;
