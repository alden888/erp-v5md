/**
 * V14.2 PRO - 全局状态管理器
 * 统一管理应用状态，解决数据同步问题
 * 优化版本 - 2026-01-03
 * @namespace WorkbenchState
 */
const WorkbenchState = (() => {
    'use strict';

    // 全局状态存储
    const state = {
        // 系统状态
        system: {
            isReady: false,
            currentTab: 'dashboard',
            isLoading: false,
            lastSyncTime: null
        },
        
        // 用户状态
        user: {
            isAuthenticated: false,
            currentUser: null,
            permissions: []
        },
        
        // 业务数据
        data: {
            orders: [],
            customers: [],
            suppliers: [],
            expenses: [],
            incomes: [],
            todayActions: []
        },
        
        // 设置
        settings: {
            target: 5000000,
            exchangeRate: 7.25,
            feishuWebhook: '',
            firebaseEnabled: false,
            survivalModeEnabled: true
        },
        
        // UI状态
        ui: {
            modals: [],
            notifications: [],
            activeFilters: {}
        }
    };

    // 状态监听器
    const listeners = new Map();
    let listenerIdCounter = 0;

    // 存储键名配置（统一workbench_前缀）
    const STORAGE_KEYS = {
        SETTINGS: 'workbench_settings',
        ORDERS: 'workbench_orders',
        CUSTOMERS: 'workbench_customers',
        SUPPLIERS: 'workbench_suppliers',
        EXPENSES: 'workbench_expenses',
        INCOMES: 'workbench_incomes',
        TODAY_ACTIONS: 'workbench_today_actions'
    };

    /**
     * 初始化状态管理器（供loader调用）
     * @returns {boolean} 是否成功
     */
    function init() {
        try {
            console.log('[State] 状态管理器初始化中...');
            
            // 从存储加载状态
            loadStateFromStorage();
            
            // 设置自动保存
            setupAutoSave();
            
            state.system.isReady = true;
            
            console.log('[State] ✅ 状态管理器已初始化');
            console.log('[State] 存储键名:', Object.keys(STORAGE_KEYS).join(', '));
            
            return true;
        } catch (error) {
            console.error('[State] ❌ 初始化失败:', error);
            return false;
        }
    }

    /**
     * 从存储加载状态
     */
    function loadStateFromStorage() {
        try {
            // 加载系统设置
            const settingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (settingsStr) {
                try {
                    const settings = JSON.parse(settingsStr);
                    state.settings = { ...state.settings, ...settings };
                    console.log('[State] 设置已加载');
                } catch (error) {
                    console.warn('[State] 设置解析失败:', error);
                }
            }

            // 加载业务数据
            const dataKeys = {
                orders: STORAGE_KEYS.ORDERS,
                customers: STORAGE_KEYS.CUSTOMERS,
                suppliers: STORAGE_KEYS.SUPPLIERS,
                expenses: STORAGE_KEYS.EXPENSES,
                incomes: STORAGE_KEYS.INCOMES
            };

            Object.entries(dataKeys).forEach(([key, storageKey]) => {
                const dataStr = localStorage.getItem(storageKey);
                if (dataStr) {
                    try {
                        state.data[key] = JSON.parse(dataStr);
                        console.log(`[State] ${key}已加载: ${state.data[key].length}项`);
                    } catch (error) {
                        console.error(`[State] ❌ 加载${key}失败:`, error);
                        state.data[key] = [];
                    }
                } else {
                    state.data[key] = [];
                }
            });

            // 加载今日三件事
            const actionsStr = localStorage.getItem(STORAGE_KEYS.TODAY_ACTIONS);
            if (actionsStr) {
                try {
                    state.data.todayActions = JSON.parse(actionsStr);
                    console.log('[State] 今日行动已加载');
                } catch (error) {
                    console.warn('[State] 今日行动解析失败:', error);
                    state.data.todayActions = [];
                }
            }

            console.log('[State] ✅ 状态已从存储加载');
        } catch (error) {
            console.error('[State] ❌ 加载状态失败:', error);
        }
    }

    /**
     * 设置自动保存
     */
    function setupAutoSave() {
        // 每30秒自动保存一次
        setInterval(() => {
            saveStateToStorage();
        }, 30000);

        // 页面卸载时保存
        window.addEventListener('beforeunload', () => {
            saveStateToStorage();
        });

        console.log('[State] ✅ 自动保存已启用');
    }

    /**
     * 保存状态到存储
     */
    function saveStateToStorage() {
        try {
            // 保存设置
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));

            // 保存业务数据
            const dataKeys = {
                orders: STORAGE_KEYS.ORDERS,
                customers: STORAGE_KEYS.CUSTOMERS,
                suppliers: STORAGE_KEYS.SUPPLIERS,
                expenses: STORAGE_KEYS.EXPENSES,
                incomes: STORAGE_KEYS.INCOMES
            };

            Object.entries(dataKeys).forEach(([key, storageKey]) => {
                localStorage.setItem(storageKey, JSON.stringify(state.data[key]));
            });

            // 保存今日三件事
            localStorage.setItem(STORAGE_KEYS.TODAY_ACTIONS, JSON.stringify(state.data.todayActions));

            state.system.lastSyncTime = new Date().toISOString();
            
            // 同步到Firebase（如果启用）
            syncToFirebase();
            
            console.log('[State] ✅ 状态已保存到存储');
        } catch (error) {
            console.error('[State] ❌ 保存状态失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('数据保存失败，请检查存储空间', 'error');
            }
        }
    }

    /**
     * 同步到Firebase
     */
    function syncToFirebase() {
        try {
            // 检查Firebase是否启用
            if (!state.settings.firebaseEnabled) {
                return;
            }

            if (typeof WorkbenchFirebase === 'undefined' || !WorkbenchFirebase.isInitialized()) {
                return;
            }

            // 同步今日行动
            if (state.data.todayActions && state.data.todayActions.length > 0) {
                WorkbenchFirebase.syncTodayActions(state.data.todayActions).catch(err => {
                    console.warn('[State] Firebase同步失败:', err);
                });
            }

            // 同步订单
            if (state.data.orders && state.data.orders.length > 0) {
                WorkbenchFirebase.syncOrders(state.data.orders).catch(err => {
                    console.warn('[State] 订单同步失败:', err);
                });
            }

            // 同步供应商
            if (state.data.suppliers && state.data.suppliers.length > 0) {
                WorkbenchFirebase.syncSuppliers(state.data.suppliers).catch(err => {
                    console.warn('[State] 供应商同步失败:', err);
                });
            }
        } catch (error) {
            console.warn('[State] Firebase同步出错:', error);
        }
    }

    /**
     * 获取状态
     * @param {string} path - 状态路径（如 'data.orders'）
     * @returns {*} 状态值
     */
    function get(path) {
        try {
            const keys = path.split('.');
            let value = state;
            
            for (const key of keys) {
                if (value === undefined || value === null) {
                    return undefined;
                }
                value = value[key];
            }
            
            // 返回副本，防止外部修改
            return Array.isArray(value) ? [...value] : 
                   typeof value === 'object' && value !== null ? { ...value } : 
                   value;
        } catch (error) {
            console.error('[State] ❌ 获取状态失败:', error);
            return undefined;
        }
    }

    /**
     * 设置状态
     * @param {string} path - 状态路径
     * @param {*} value - 新值
     * @param {boolean} notify - 是否通知监听器
     */
    function set(path, value, notify = true) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = state;
            
            // 导航到目标对象
            for (const key of keys) {
                if (!target[key]) {
                    target[key] = {};
                }
                target = target[key];
            }
            
            // 设置值
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // 通知监听器
            if (notify) {
                notifyListeners(path, value, oldValue);
            }
            
            // 自动保存（防抖）
            debounceSave();
            
            console.log(`[State] 状态已更新: ${path}`);
        } catch (error) {
            console.error('[State] ❌ 设置状态失败:', error);
        }
    }

    /**
     * 更新状态（合并）
     * @param {string} path - 状态路径
     * @param {Object} updates - 更新内容
     * @param {boolean} notify - 是否通知监听器
     */
    function update(path, updates, notify = true) {
        try {
            const current = get(path);
            if (typeof current === 'object' && !Array.isArray(current)) {
                set(path, { ...current, ...updates }, notify);
            } else {
                console.warn('[State] 只能更新对象类型的状态');
            }
        } catch (error) {
            console.error('[State] ❌ 更新状态失败:', error);
        }
    }

    /**
     * 添加到数组状态
     * @param {string} path - 状态路径
     * @param {*} item - 要添加的项
     * @param {boolean} notify - 是否通知监听器
     */
    function push(path, item, notify = true) {
        try {
            const current = get(path);
            if (Array.isArray(current)) {
                set(path, [...current, item], notify);
            } else {
                console.warn('[State] 只能向数组状态添加项');
            }
        } catch (error) {
            console.error('[State] ❌ 添加项失败:', error);
        }
    }

    /**
     * 从数组状态移除
     * @param {string} path - 状态路径
     * @param {Function} predicate - 过滤函数
     * @param {boolean} notify - 是否通知监听器
     */
    function remove(path, predicate, notify = true) {
        try {
            const current = get(path);
            if (Array.isArray(current)) {
                set(path, current.filter(item => !predicate(item)), notify);
            } else {
                console.warn('[State] 只能从数组状态移除项');
            }
        } catch (error) {
            console.error('[State] ❌ 移除项失败:', error);
        }
    }

    /**
     * 监听状态变化
     * @param {string} path - 状态路径（支持通配符 *）
     * @param {Function} callback - 回调函数
     * @returns {number} 监听器ID
     */
    function watch(path, callback) {
        const listenerId = listenerIdCounter++;
        
        if (!listeners.has(path)) {
            listeners.set(path, new Map());
        }
        
        listeners.get(path).set(listenerId, callback);
        
        console.log(`[State] 已添加监听器: ${path} (ID: ${listenerId})`);
        return listenerId;
    }

    /**
     * 取消监听
     * @param {number} listenerId - 监听器ID
     */
    function unwatch(listenerId) {
        for (const [path, pathListeners] of listeners.entries()) {
            if (pathListeners.delete(listenerId)) {
                console.log(`[State] 已移除监听器 ID: ${listenerId}`);
                
                // 如果该路径没有监听器了，删除路径
                if (pathListeners.size === 0) {
                    listeners.delete(path);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * 通知监听器
     * @param {string} path - 状态路径
     * @param {*} newValue - 新值
     * @param {*} oldValue - 旧值
     */
    function notifyListeners(path, newValue, oldValue) {
        try {
            // 精确匹配的监听器
            if (listeners.has(path)) {
                listeners.get(path).forEach(callback => {
                    try {
                        callback(newValue, oldValue, path);
                    } catch (error) {
                        console.error('[State] 监听器执行失败:', error);
                    }
                });
            }
            
            // 通配符监听器
            if (listeners.has('*')) {
                listeners.get('*').forEach(callback => {
                    try {
                        callback(newValue, oldValue, path);
                    } catch (error) {
                        console.error('[State] 通配符监听器执行失败:', error);
                    }
                });
            }
        } catch (error) {
            console.error('[State] ❌ 通知监听器失败:', error);
        }
    }

    // 防抖保存
    let saveTimer = null;
    function debounceSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveStateToStorage();
        }, 1000);
    }

    /**
     * 重置状态
     * @param {string} path - 状态路径（可选，不提供则重置所有）
     */
    function reset(path = null) {
        if (path) {
            const defaultValue = getDefaultValue(path);
            set(path, defaultValue, true);
        } else {
            // 重置所有状态
            Object.keys(state.data).forEach(key => {
                state.data[key] = [];
            });
            state.settings = {
                target: 5000000,
                exchangeRate: 7.25,
                feishuWebhook: '',
                firebaseEnabled: false,
                survivalModeEnabled: true
            };
            saveStateToStorage();
        }
        console.log('[State] 状态已重置');
    }

    /**
     * 获取默认值
     * @param {string} path - 状态路径
     * @returns {*} 默认值
     */
    function getDefaultValue(path) {
        const defaults = {
            'data.orders': [],
            'data.customers': [],
            'data.suppliers': [],
            'data.expenses': [],
            'data.incomes': [],
            'data.todayActions': [],
            'settings.target': 5000000,
            'settings.exchangeRate': 7.25,
            'settings.feishuWebhook': '',
            'settings.firebaseEnabled': false,
            'settings.survivalModeEnabled': true
        };
        return defaults[path] !== undefined ? defaults[path] : null;
    }

    /**
     * 获取完整状态快照（用于调试）
     * @returns {Object} 状态快照
     */
    function getSnapshot() {
        return JSON.parse(JSON.stringify(state));
    }

    /**
     * 获取存储键名配置
     * @returns {Object} 存储键名
     */
    function getStorageKeys() {
        return { ...STORAGE_KEYS };
    }

    // 公共API
    const api = {
        init,
        get,
        set,
        update,
        push,
        remove,
        watch,
        unwatch,
        reset,
        getSnapshot,
        getStorageKeys,
        saveStateToStorage,
        loadStateFromStorage
    };

    return api;
})();

// 挂载到全局
window.WorkbenchState = WorkbenchState;

// 模块导出（支持CommonJS和ES模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchState;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchState);
}

console.log('[State] 状态管理器模块已加载');
