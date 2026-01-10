/**
 * V14.2 PRO - 全局状态管理器
 * 统一管理应用状态，解决数据同步问题
 * 优化版本 - 2026-01-03 (修复版)
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
            lastSyncTime: null,
            isInitialized: false // 新增：标记是否已初始化
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
            survivalModeEnabled: true,
            autoSaveInterval: 30000 // 新增：可配置自动保存间隔
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

    // 私有变量 - 新增：存储定时器和事件句柄（用于清理）
    const timers = {
        autoSave: null
    };
    const eventHandlers = {
        beforeunload: null
    };

    /**
     * 私有工具：深拷贝
     * 修复：原get方法仅浅拷贝，深层对象仍会被外部修改
     */
    function deepClone(value) {
        if (value === null || typeof value !== 'object') return value;
        if (value instanceof Date) return new Date(value);
        if (value instanceof Array) return value.map(item => deepClone(item));
        if (typeof value === 'object') {
            const cloned = {};
            Object.keys(value).forEach(key => {
                cloned[key] = deepClone(value[key]);
            });
            return cloned;
        }
        return value;
    }

    /**
     * 私有工具：检查LocalStorage容量
     */
    function checkStorageQuota() {
        try {
            const testKey = 'workbench_quota_test';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 私有工具：通用错误提示
     */
    function showErrorToast(message) {
        if (window.WorkbenchUtils && typeof WorkbenchUtils.toast === 'function') {
            WorkbenchUtils.toast(message, 'error');
        } else {
            console.error(`[State] 错误提示: ${message}`);
        }
    }

    /**
     * 初始化状态管理器（供loader调用）
     * 修复：防重复初始化、统一错误处理
     * @returns {boolean} 是否成功
     */
    function init() {
        // 防重复初始化
        if (state.system.isInitialized) {
            console.log('[State] ⚠️ 状态管理器已初始化，跳过重复执行');
            return true;
        }

        try {
            console.log('[State] 状态管理器初始化中...');
            
            // 检查存储可用性
            if (!checkStorageQuota()) {
                throw new Error('LocalStorage 存储空间不足或不可用');
            }
            
            // 从存储加载状态
            loadStateFromStorage();
            
            // 设置自动保存（先清理旧定时器）
            setupAutoSave();
            
            // 绑定页面卸载事件（先清理旧事件）
            bindBeforeUnloadEvent();
            
            state.system.isReady = true;
            state.system.isInitialized = true; // 标记初始化完成
            
            console.log('[State] ✅ 状态管理器已初始化');
            console.log('[State] 存储键名:', Object.keys(STORAGE_KEYS).join(', '));
            
            return true;
        } catch (error) {
            console.error('[State] ❌ 初始化失败:', error);
            showErrorToast(`状态管理器初始化失败：${error.message}`);
            return false;
        }
    }

    /**
     * 从存储加载状态
     * 修复：统一错误处理、优化日志
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
                    console.warn('[State] 设置解析失败，使用默认值:', error);
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
                        console.error(`[State] ❌ 加载${key}失败，使用空数组:`, error);
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
                    console.warn('[State] 今日行动解析失败，使用空数组:', error);
                    state.data.todayActions = [];
                }
            }

            console.log('[State] ✅ 状态已从存储加载');
        } catch (error) {
            console.error('[State] ❌ 加载状态失败:', error);
            showErrorToast(`加载本地数据失败：${error.message}`);
        }
    }

    /**
     * 设置自动保存
     * 修复：清理旧定时器、可配置间隔、防止内存泄漏
     */
    function setupAutoSave() {
        // 清理旧定时器
        if (timers.autoSave) {
            clearInterval(timers.autoSave);
        }

        // 从配置读取间隔（默认30秒）
        const interval = state.settings.autoSaveInterval || 30000;
        
        // 新设定时器
        timers.autoSave = setInterval(() => {
            saveStateToStorage();
        }, interval);

        console.log(`[State] ✅ 自动保存已启用（间隔：${interval/1000}秒）`);
    }

    /**
     * 绑定页面卸载事件
     * 修复：防止重复绑定、可清理
     */
    function bindBeforeUnloadEvent() {
        // 清理旧事件
        if (eventHandlers.beforeunload) {
            window.removeEventListener('beforeunload', eventHandlers.beforeunload);
        }

        // 新绑定事件
        eventHandlers.beforeunload = () => {
            saveStateToStorage();
        };
        window.addEventListener('beforeunload', eventHandlers.beforeunload);
    }

    /**
     * 保存状态到存储
     * 修复：处理QuotaExceededError、优化错误提示
     */
    function saveStateToStorage() {
        try {
            // 检查存储可用性
            if (!checkStorageQuota()) {
                throw new Error('LocalStorage 存储空间不足');
            }

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
            // 处理存储容量超限错误
            if (error.name === 'QuotaExceededError') {
                console.error('[State] ❌ 保存失败：存储空间不足');
                showErrorToast('数据保存失败：浏览器存储空间不足，请清理缓存');
            } else {
                console.error('[State] ❌ 保存状态失败:', error);
                showErrorToast(`数据保存失败：${error.message}`);
            }
        }
    }

    /**
     * 同步到Firebase
     * 修复：增加重试机制、防抖、错误处理
     */
    let firebaseSyncDebounce = null;
    function syncToFirebase() {
        // 防抖：避免短时间多次同步
        clearTimeout(firebaseSyncDebounce);
        firebaseSyncDebounce = setTimeout(async () => {
            try {
                // 检查Firebase是否启用
                if (!state.settings.firebaseEnabled) {
                    return;
                }

                if (typeof WorkbenchFirebase === 'undefined' || !WorkbenchFirebase.isInitialized()) {
                    console.warn('[State] Firebase未初始化，跳过同步');
                    return;
                }

                // 重试逻辑：最多3次
                const retrySync = async (fn, maxRetries = 3) => {
                    let retries = 0;
                    while (retries < maxRetries) {
                        try {
                            return await fn();
                        } catch (err) {
                            retries++;
                            console.warn(`[State] Firebase同步失败（重试${retries}/${maxRetries}）:`, err);
                            if (retries >= maxRetries) throw err;
                            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 指数退避
                        }
                    }
                };

                // 同步今日行动
                if (state.data.todayActions && state.data.todayActions.length > 0) {
                    await retrySync(() => WorkbenchFirebase.syncTodayActions(state.data.todayActions));
                }

                // 同步订单
                if (state.data.orders && state.data.orders.length > 0) {
                    await retrySync(() => WorkbenchFirebase.syncOrders(state.data.orders));
                }

                // 同步供应商
                if (state.data.suppliers && state.data.suppliers.length > 0) {
                    await retrySync(() => WorkbenchFirebase.syncSuppliers(state.data.suppliers));
                }

            } catch (error) {
                console.warn('[State] Firebase同步最终失败:', error);
                showErrorToast('云端同步失败：' + error.message);
            }
        }, 500); // 防抖延迟500ms
    }

    /**
     * 获取状态
     * 修复：深拷贝返回值，防止外部修改内部状态
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
            
            // 修复：深拷贝返回，彻底隔离外部修改
            return deepClone(value);
        } catch (error) {
            console.error('[State] ❌ 获取状态失败:', error);
            showErrorToast(`获取状态失败：${error.message}`);
            return undefined;
        }
    }

    /**
     * 设置状态
     * 修复：处理中间键为数组的情况、优化路径导航
     * @param {string} path - 状态路径
     * @param {*} value - 新值
     * @param {boolean} notify - 是否通知监听器
     */
    function set(path, value, notify = true) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = state;
            
            // 修复：导航到目标对象时，区分数组/对象
            for (const key of keys) {
                // 如果目标不存在，判断是否为数组索引
                if (!target[key]) {
                    // 数字索引则创建数组，否则创建对象
                    target[key] = /^\d+$/.test(keys[0]) ? [] : {};
                }
                target = target[key];
            }
            
            // 设置值
            const oldValue = deepClone(target[lastKey]); // 深拷贝旧值
            target[lastKey] = deepClone(value); // 深拷贝新值，防止外部引用污染
            
            // 通知监听器
            if (notify) {
                notifyListeners(path, target[lastKey], oldValue);
            }
            
            // 自动保存（防抖）
            debounceSave();
            
            console.log(`[State] 状态已更新: ${path}`);
        } catch (error) {
            console.error('[State] ❌ 设置状态失败:', error);
            showErrorToast(`设置状态失败：${error.message}`);
        }
    }

    /**
     * 更新状态（合并）
     * 优化：支持数组项更新、更严格的类型检查
     * @param {string} path - 状态路径
     * @param {Object} updates - 更新内容
     * @param {boolean} notify - 是否通知监听器
     */
    function update(path, updates, notify = true) {
        try {
            const current = get(path);
            if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
                set(path, { ...current, ...updates }, notify);
            } else if (Array.isArray(current)) {
                console.warn('[State] 数组类型状态请使用push/remove方法更新');
            } else {
                console.warn('[State] 只能更新对象类型的状态');
            }
        } catch (error) {
            console.error('[State] ❌ 更新状态失败:', error);
            showErrorToast(`更新状态失败：${error.message}`);
        }
    }

    /**
     * 添加到数组状态
     * 优化：重复项检查、类型验证
     * @param {string} path - 状态路径
     * @param {*} item - 要添加的项
     * @param {boolean} notify - 是否通知监听器
     */
    function push(path, item, notify = true) {
        try {
            const current = get(path);
            if (Array.isArray(current)) {
                // 可选：重复项检查（根据业务需求可关闭）
                const isDuplicate = current.some(existing => 
                    JSON.stringify(existing) === JSON.stringify(item)
                );
                if (isDuplicate) {
                    console.warn(`[State] 跳过重复项添加: ${path}`);
                    return;
                }
                set(path, [...current, deepClone(item)], notify);
            } else {
                console.warn('[State] 只能向数组状态添加项');
            }
        } catch (error) {
            console.error('[State] ❌ 添加项失败:', error);
            showErrorToast(`添加数据失败：${error.message}`);
        }
    }

    /**
     * 从数组状态移除
     * 优化：更健壮的过滤逻辑
     * @param {string} path - 状态路径
     * @param {Function} predicate - 过滤函数
     * @param {boolean} notify - 是否通知监听器
     */
    function remove(path, predicate, notify = true) {
        try {
            const current = get(path);
            if (Array.isArray(current)) {
                const newArray = current.filter(item => !predicate(item));
                set(path, newArray, notify);
                console.log(`[State] 从${path}移除${current.length - newArray.length}项`);
            } else {
                console.warn('[State] 只能从数组状态移除项');
            }
        } catch (error) {
            console.error('[State] ❌ 移除项失败:', error);
            showErrorToast(`移除数据失败：${error.message}`);
        }
    }

    /**
     * 监听状态变化
     * 修复：支持层级通配符（如data.*）
     * @param {string} path - 状态路径（支持通配符 * 和层级通配符如data.*）
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
     * 优化：返回更明确的结果、清理空路径
     * @param {number} listenerId - 监听器ID
     * @returns {boolean} 是否成功取消
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
        console.warn(`[State] 未找到监听器 ID: ${listenerId}`);
        return false;
    }

    /**
     * 通知监听器
     * 修复：支持层级通配符匹配（如data.orders变化时通知data.*）
     * @param {string} path - 状态路径
     * @param {*} newValue - 新值
     * @param {*} oldValue - 旧值
     */
    function notifyListeners(path, newValue, oldValue) {
        try {
            // 1. 精确匹配的监听器
            if (listeners.has(path)) {
                listeners.get(path).forEach(callback => {
                    try {
                        callback(deepClone(newValue), deepClone(oldValue), path);
                    } catch (error) {
                        console.error('[State] 监听器执行失败:', error);
                    }
                });
            }

            // 2. 层级通配符匹配（如data.orders → 匹配data.*）
            const pathSegments = path.split('.');
            for (let i = pathSegments.length - 1; i > 0; i--) {
                const wildcardPath = [...pathSegments.slice(0, i), '*'].join('.');
                if (listeners.has(wildcardPath)) {
                    listeners.get(wildcardPath).forEach(callback => {
                        try {
                            callback(deepClone(newValue), deepClone(oldValue), path);
                        } catch (error) {
                            console.error(`[State] 层级通配符监听器(${wildcardPath})执行失败:`, error);
                        }
                    });
                }
            }
            
            // 3. 全局通配符监听器
            if (listeners.has('*')) {
                listeners.get('*').forEach(callback => {
                    try {
                        callback(deepClone(newValue), deepClone(oldValue), path);
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
     * 修复：支持重置所有状态（包括system/user/ui）、更精准的默认值
     * @param {string} path - 状态路径（可选，不提供则重置所有）
     */
    function reset(path = null) {
        try {
            if (path) {
                const defaultValue = getDefaultValue(path);
                set(path, defaultValue, true);
                console.log(`[State] 状态已重置: ${path}`);
            } else {
                // 重置所有状态为初始值
                const defaultState = {
                    system: {
                        isReady: false,
                        currentTab: 'dashboard',
                        isLoading: false,
                        lastSyncTime: null,
                        isInitialized: true // 保留初始化标记
                    },
                    user: {
                        isAuthenticated: false,
                        currentUser: null,
                        permissions: []
                    },
                    data: {
                        orders: [],
                        customers: [],
                        suppliers: [],
                        expenses: [],
                        incomes: [],
                        todayActions: []
                    },
                    settings: getDefaultValue('settings'),
                    ui: {
                        modals: [],
                        notifications: [],
                        activeFilters: {}
                    }
                };

                // 深拷贝默认状态到当前状态
                Object.assign(state, deepClone(defaultState));
                
                saveStateToStorage();
                console.log('[State] 所有状态已重置为默认值');
            }
        } catch (error) {
            console.error('[State] ❌ 重置状态失败:', error);
            showErrorToast(`重置状态失败：${error.message}`);
        }
    }

    /**
     * 获取默认值
     * 修复：覆盖所有状态路径、更完整的默认值
     * @param {string} path - 状态路径
     * @returns {*} 默认值
     */
    function getDefaultValue(path) {
        const defaults = {
            'system': {
                isReady: false,
                currentTab: 'dashboard',
                isLoading: false,
                lastSyncTime: null,
                isInitialized: false
            },
            'user': {
                isAuthenticated: false,
                currentUser: null,
                permissions: []
            },
            'data.orders': [],
            'data.customers': [],
            'data.suppliers': [],
            'data.expenses': [],
            'data.incomes': [],
            'data.todayActions': [],
            'settings': {
                target: 5000000,
                exchangeRate: 7.25,
                feishuWebhook: '',
                firebaseEnabled: false,
                survivalModeEnabled: true,
                autoSaveInterval: 30000
            },
            'settings.target': 5000000,
            'settings.exchangeRate': 7.25,
            'settings.feishuWebhook': '',
            'settings.firebaseEnabled': false,
            'settings.survivalModeEnabled': true,
            'settings.autoSaveInterval': 30000,
            'ui': {
                modals: [],
                notifications: [],
                activeFilters: {}
            }
        };

        // 支持层级路径（如'settings'返回完整设置默认值）
        return defaults[path] !== undefined ? deepClone(defaults[path]) : null;
    }

    /**
     * 获取完整状态快照（用于调试）
     * 修复：返回深拷贝，防止修改原始状态
     * @returns {Object} 状态快照
     */
    function getSnapshot() {
        return deepClone(state);
    }

    /**
     * 获取存储键名配置
     * @returns {Object} 存储键名
     */
    function getStorageKeys() {
        return { ...STORAGE_KEYS };
    }

    /**
     * 新增：清理资源（定时器、事件监听）
     * 修复：内存泄漏问题
     */
    function cleanup() {
        // 清理自动保存定时器
        if (timers.autoSave) {
            clearInterval(timers.autoSave);
            timers.autoSave = null;
        }

        // 清理页面卸载事件
        if (eventHandlers.beforeunload) {
            window.removeEventListener('beforeunload', eventHandlers.beforeunload);
            eventHandlers.beforeunload = null;
        }

        // 清理Firebase同步防抖定时器
        if (firebaseSyncDebounce) {
            clearTimeout(firebaseSyncDebounce);
            firebaseSyncDebounce = null;
        }

        // 清理保存防抖定时器
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }

        // 清空监听器
        listeners.clear();
        listenerIdCounter = 0;

        // 重置初始化标记
        state.system.isInitialized = false;
        state.system.isReady = false;

        console.log('[State] ✅ 资源已清理完成');
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
        loadStateFromStorage,
        cleanup // 新增：暴露清理方法
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

console.log('[State] 状态管理器模块已加载（修复版）');
