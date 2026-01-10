/**
 * V14.2 PRO - 仪表盘模块（优化版）
 * 数据统计、可视化、趋势分析
 * @namespace WorkbenchDashboard
 * @author 优化版
 * @version 14.2.1
 */
const WorkbenchDashboard = (() => {
    'use strict';

    // ============================ 常量定义（统一维护，便于修改） ============================
    const CONSTANTS = {
        // 存储键名配置
        STORAGE_KEYS: {
            ORDERS: 'v5_erp_orders',
            INCOMES: 'v5_erp_incomes',
            SUPPLIERS: 'v5_erp_suppliers',
            EXPENSES: 'v5_erp_expenses',
            SETTINGS: 'v5_erp_settings'
        },
        // 默认配置
        DEFAULT_SETTINGS: {
            target: 5000000,
            exchangeRate: 7.25,
            firebaseEnabled: false
        },
        // 日期格式化选项
        DATE_FORMATS: {
            TIME: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
            SHORT_TIME: { hour: '2-digit', minute: '2-digit', hour12: false }
        },
        // 订单状态枚举（语义化）
        ORDER_STATUS: {
            PENDING: ['New', 'Processing'],
            COMPLETED: ['Paid', 'Shipped', 'Completed']
        }
    };

    // ============================ 私有状态管理 ============================
    let refreshTimer = null;
    let clockTimer = null;
    let clockElement = null; // 缓存时钟DOM元素，避免重复查询
    let lastSyncElement = null; // 缓存同步时间DOM元素

    // ============================ 工具函数（封装重复逻辑） ============================
    /**
     * 安全加载存储数据（兼容WorkbenchStorage和localStorage）
     * @param {string} key - 存储键名
     * @returns {Array} 解析后的数据数组（兜底空数组）
     */
    const safeLoadStorageData = (key) => {
        try {
            // 优先使用WorkbenchStorage
            if (window.WorkbenchStorage) {
                return WorkbenchStorage.load(key) || [];
            }

            // 降级到localStorage，兼容配置的键名
            const configKey = window.WorkbenchConfig?.STORAGE_KEYS?.[key.toUpperCase()] || CONSTANTS.STORAGE_KEYS[key.toUpperCase()];
            const rawData = localStorage.getItem(configKey);
            return rawData ? JSON.parse(rawData) : [];
        } catch (error) {
            console.error(`[Dashboard] 加载${key}数据失败:`, error);
            return [];
        }
    };

    /**
     * 安全格式化数字（保留两位小数，避免NaN）
     * @param {any} num - 待格式化的数字
     * @returns {string} 格式化后的字符串（如"0.00"）
     */
    const safeFormatNumber = (num) => {
        const parsed = Number(num);
        return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
    };

    /**
     * 校验是否为当月数据（容错日期解析）
     * @param {Object} item - 包含日期的条目（createTime/createdAt/date）
     * @returns {boolean} 是否为当月
     */
    const isCurrentMonth = (item) => {
        try {
            const now = new Date();
            const dateStr = item.createTime || item.createdAt || item.date;
            const transactionDate = new Date(dateStr);

            // 日期解析失败则返回false
            if (transactionDate.toString() === 'Invalid Date') return false;

            return transactionDate.getMonth() === now.getMonth() &&
                   transactionDate.getFullYear() === now.getFullYear();
        } catch (error) {
            return false;
        }
    };

    /**
     * 计算数组金额总和（安全求和）
     * @param {Array} list - 包含amount的条目数组
     * @returns {number} 总和
     */
    const calculateTotalAmount = (list) => {
        return list.reduce((sum, item) => {
            const amount = Number(item.amount);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
    };

    // ============================ 核心业务函数 ============================
    /**
     * 初始化仪表盘模块
     * @returns {boolean} 是否成功
     */
    const init = () => {
        try {
            console.log('[Dashboard] 仪表盘模块初始化中...');
            
            // 预缓存常用DOM元素，减少重复查询
            clockElement = document.getElementById('current-time');
            lastSyncElement = document.getElementById('last-sync');
            
            renderDashboard();
            bindEvents();
            startClock(); // 初始化时自动启动时钟
            
            console.log('[Dashboard] ✅ 仪表盘模块已初始化');
            return true;
        } catch (error) {
            console.error('[Dashboard] ❌ 初始化失败:', error);
            return false;
        }
    };

    /**
     * 绑定事件监听器（防抖处理，避免重复绑定）
     */
    const bindEvents = () => {
        try {
            const refreshBtn = document.getElementById('dashboard-refresh');
            if (refreshBtn) {
                // 先移除旧监听，避免重复绑定
                refreshBtn.removeEventListener('click', refreshDashboard);
                refreshBtn.addEventListener('click', refreshDashboard);
            }
        } catch (error) {
            console.warn('[Dashboard] 绑定事件失败:', error);
        }
    };

    /**
     * 更新元素文本（增强容错，简化逻辑）
     * @param {string} id - 元素ID
     * @param {string|number} text - 文本内容
     */
    const updateElementText = (id, text) => {
        if (!id || typeof id !== 'string') {
            console.warn('[Dashboard] 元素ID必须为非空字符串');
            return;
        }

        try {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`[Dashboard] 元素未找到：${id}`);
                return;
            }
            
            // 统一格式化文本内容
            const textContent = (typeof text === 'string' || typeof text === 'number') 
                ? text.toString() 
                : '';
            element.textContent = textContent;
        } catch (error) {
            console.error(`[Dashboard] ❌ 更新元素${id}文本失败:`, error);
        }
    };

    /**
     * 统计仪表盘核心数据（拆分逻辑，降低圈复杂度）
     * @returns {Object} 统计数据
     */
    const getDashboardStats = () => {
        try {
            // 批量加载存储数据
            const orders = safeLoadStorageData('orders');
            const incomes = safeLoadStorageData('incomes');
            const suppliers = safeLoadStorageData('suppliers');
            const expenses = safeLoadStorageData('expenses');

            // 订单统计
            const totalOrders = orders.length;
            const pendingOrders = orders.filter(o => CONSTANTS.ORDER_STATUS.PENDING.includes(o.kanbanStatus)).length;
            const completedOrders = orders.filter(o => CONSTANTS.ORDER_STATUS.COMPLETED.includes(o.kanbanStatus)).length;

            // 收入统计
            const totalIncome = calculateTotalAmount(incomes);
            const monthIncome = calculateTotalAmount(incomes.filter(isCurrentMonth));
            
            // 支出统计
            const monthExpense = calculateTotalAmount(expenses.filter(isCurrentMonth));

            // 供应商统计
            const totalSuppliers = suppliers.length;

            // 统一格式化数字，避免NaN
            return {
                totalOrders,
                pendingOrders,
                completedOrders,
                totalIncome: safeFormatNumber(totalIncome),
                monthIncome: safeFormatNumber(monthIncome),
                monthExpense: safeFormatNumber(monthExpense),
                netProfit: safeFormatNumber(monthIncome - monthExpense),
                totalSuppliers
            };
        } catch (error) {
            console.error('[Dashboard] ❌ 统计数据失败:', error);
            // 兜底默认值（统一格式化）
            return {
                totalOrders: 0,
                pendingOrders: 0,
                completedOrders: 0,
                totalIncome: '0.00',
                monthIncome: '0.00',
                monthExpense: '0.00',
                netProfit: '0.00',
                totalSuppliers: 0
            };
        }
    };

    /**
     * 渲染仪表盘（核心入口，简化逻辑）
     */
    const renderDashboard = () => {
        try {
            const stats = getDashboardStats();

            // 批量更新核心指标
            const textUpdates = [
                ['dashboard-total-orders', stats.totalOrders],
                ['dashboard-pending-orders', stats.pendingOrders],
                ['dashboard-completed-orders', stats.completedOrders],
                ['dashboard-total-income', `¥${stats.totalIncome}`],
                ['dashboard-month-income', `¥${stats.monthIncome}`],
                ['dashboard-total-suppliers', stats.totalSuppliers],
                ['dashboard-net-profit', `¥${stats.netProfit}`]
            ];
            
            // 批量执行更新，减少重复代码
            textUpdates.forEach(([id, text]) => updateElementText(id, text));

            console.log('[Dashboard] ✅ 仪表盘渲染完成');
            console.log('[Dashboard] 统计数据:', stats);
        } catch (error) {
            console.error('[Dashboard] ❌ 渲染仪表盘失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`仪表盘渲染失败：${error.message}`, 'error');
            }
        }
    };

    /**
     * 刷新仪表盘数据（支持防抖，避免频繁执行）
     * @param {number} interval - 刷新间隔（毫秒，0为仅刷新一次）
     */
    const refreshDashboard = (interval = 0) => {
        try {
            // 立即刷新
            renderDashboard();
            
            // 设置自动刷新（先清后设，避免多个定时器）
            if (interval > 0) {
                stopAutoRefresh();
                refreshTimer = setInterval(renderDashboard, interval);
                console.log(`[Dashboard] ✅ 已设置自动刷新，间隔${interval}ms`);
            } else {
                console.log('[Dashboard] ✅ 仪表盘已刷新');
            }
        } catch (error) {
            console.error('[Dashboard] ❌ 刷新失败:', error);
        }
    };

    /**
     * 停止自动刷新（增强容错）
     */
    const stopAutoRefresh = () => {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
            console.log('[Dashboard] ✅ 已停止自动刷新');
        }
    };

    /**
     * 启动实时时钟（缓存DOM元素，提升性能）
     */
    const startClock = () => {
        try {
            if (!clockElement) {
                clockElement = document.getElementById('current-time');
                if (!clockElement) throw new Error('时钟元素未找到');
            }

            // 时钟更新函数（独立封装）
            const updateClock = () => {
                const timeString = new Date().toLocaleTimeString('zh-CN', CONSTANTS.DATE_FORMATS.TIME);
                clockElement.textContent = timeString;
            };

            // 立即更新 + 定时更新（先清后设）
            updateClock();
            stopClock();
            clockTimer = setInterval(updateClock, 1000);
            
            console.log('[Dashboard] ✅ 实时时钟已启动');
        } catch (error) {
            console.error('[Dashboard] ❌ 启动时钟失败:', error);
        }
    };

    /**
     * 停止实时时钟（增强容错）
     */
    const stopClock = () => {
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
            console.log('[Dashboard] ✅ 实时时钟已停止');
        }
    };

    /**
     * 更新同步时间显示（缓存DOM元素，提升性能）
     * @param {Date} syncTime - 同步时间
     */
    const updateLastSyncTime = (syncTime = new Date()) => {
        try {
            if (!lastSyncElement) {
                lastSyncElement = document.getElementById('last-sync');
                if (!lastSyncElement) return;
            }

            const timeString = syncTime.toLocaleTimeString('zh-CN', CONSTANTS.DATE_FORMATS.SHORT_TIME);
            lastSyncElement.textContent = `上次同步: ${timeString}`;
        } catch (error) {
            console.error('[Dashboard] ❌ 更新同步时间失败:', error);
        }
    };

    /**
     * 保存设置到存储（封装重复逻辑）
     * @param {Object} newSettings - 新设置
     */
    const saveSettings = (newSettings) => {
        try {
            const configKey = window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || CONSTANTS.STORAGE_KEYS.SETTINGS;
            const currentSettings = JSON.parse(localStorage.getItem(configKey) || '{}');
            const mergedSettings = { ...currentSettings, ...newSettings };
            
            localStorage.setItem(configKey, JSON.stringify(mergedSettings));
            return true;
        } catch (error) {
            console.error('[Dashboard] ❌ 保存设置失败:', error);
            return false;
        }
    };

    /**
     * 设置目标金额（复用保存逻辑）
     * @param {number} target - 目标金额
     */
    const setTarget = (target) => {
        try {
            if (typeof target !== 'number' || target <= 0) {
                throw new Error('目标金额必须是大于0的数字');
            }
            
            if (saveSettings({ target })) {
                console.log('[Dashboard] ✅ 目标金额已设置:', target);
                renderDashboard();
            }
        } catch (error) {
            console.error('[Dashboard] ❌ 设置目标金额失败:', error);
        }
    };

    /**
     * 设置汇率（复用保存逻辑）
     * @param {number} rate - 汇率
     */
    const setExchangeRate = (rate) => {
        try {
            if (typeof rate !== 'number' || rate <= 0) {
                throw new Error('汇率必须是大于0的数字');
            }
            
            if (saveSettings({ rate })) {
                console.log('[Dashboard] ✅ 汇率已设置:', rate);
                renderDashboard();
            }
        } catch (error) {
            console.error('[Dashboard] ❌ 设置汇率失败:', error);
        }
    };

    /**
     * 获取当前设置（增强容错）
     * @returns {Object} 设置对象
     */
    const getSettings = () => {
        try {
            const configKey = window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || CONSTANTS.STORAGE_KEYS.SETTINGS;
            const storedSettings = JSON.parse(localStorage.getItem(configKey) || '{}');
            // 合并默认设置，避免缺失字段
            return { ...CONSTANTS.DEFAULT_SETTINGS, ...storedSettings };
        } catch (error) {
            console.error('[Dashboard] ❌ 获取设置失败:', error);
            return { ...CONSTANTS.DEFAULT_SETTINGS };
        }
    };

    /**
     * 清理资源（统一管理，避免内存泄漏）
     */
    const cleanup = () => {
        stopAutoRefresh();
        stopClock();
        
        // 移除事件监听（避免内存泄漏）
        const refreshBtn = document.getElementById('dashboard-refresh');
        if (refreshBtn) {
            refreshBtn.removeEventListener('click', refreshDashboard);
        }
        
        // 清空缓存的DOM引用
        clockElement = null;
        lastSyncElement = null;
        
        console.log('[Dashboard] ✅ 已清理所有资源');
    };

    // ============================ 全局事件监听 ============================
    if (typeof window !== 'undefined') {
        // 页面卸载前清理资源
        window.addEventListener('beforeunload', cleanup);
        
        // 页面隐藏时暂停定时器，显示时恢复（性能优化）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoRefresh();
                stopClock();
            } else {
                startClock();
                // 如果有自动刷新配置，恢复刷新（这里简化处理，仅恢复时钟）
            }
        });
    }

    // ============================ 暴露公共API ============================
    return {
        // 初始化
        init,
        
        // 渲染操作
        renderDashboard,
        refreshDashboard,
        stopAutoRefresh,
        
        // 时钟操作
        startClock,
        stopClock,
        
        // 数据统计
        getDashboardStats,
        
        // 设置管理
        setTarget,
        setExchangeRate,
        getSettings,
        
        // 同步时间
        updateLastSyncTime,
        
        // 工具方法
        updateElementText,
        
        // 清理
        cleanup
    };
})();

// 挂载到全局
window.WorkbenchDashboard = WorkbenchDashboard;

// 模块化导出（兼容CommonJS/AMD）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchDashboard;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchDashboard);
}

console.log('[Dashboard] 仪表盘模块已加载（优化版 v14.2.1）');
