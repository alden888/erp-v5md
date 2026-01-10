/**
 * V14.3 PRO - 财务模块（重构优化版）
 * 收入/支出管理 + 数据持久化 + 云端同步
 * 优化点：代码解耦、性能提升、错误处理增强、可扩展性优化
 * @namespace WorkbenchFinance
 * @version 14.3
 * @date 2026-01-08
 */
const WorkbenchFinance = (() => {
    'use strict';

    // ========================== 常量定义（统一维护）==========================
    const MODULE_CONFIG = {
        NAME: 'Finance',
        VERSION: '14.3',
        STORAGE_KEYS: {
            INCOMES: 'workbench_incomes',
            EXPENSES: 'workbench_expenses',
            REMOTE_INCOMES: 'user_incomes'
        },
        DEFAULT_TYPES: {
            INCOME: '其他',
            EXPENSE: '其他'
        },
        ERROR_MESSAGES: {
            INVALID_OBJECT: '%s数据必须为对象',
            EMPTY_NAME: '%s名称不能为空',
            INVALID_AMOUNT: '%s金额必须是大于0的有效数字',
            INVALID_ID: '%s记录ID必须为非空字符串',
            RECORD_NOT_FOUND: '%s记录 %s 不存在',
            INVALID_UPDATES: '更新内容必须为非数组对象'
        },
        TOAST_MESSAGES: {
            ADD_SUCCESS: '%s记录添加成功',
            UPDATE_SUCCESS: '%s记录已更新',
            DELETE_SUCCESS: '%s记录已删除',
            SAVE_FAILED: '数据保存失败',
            FETCH_FAILED: '获取%s记录失败'
        }
    };

    // ========================== 模块状态（私有化）==========================
    const state = {
        incomes: [],
        expenses: [],
        isInitialized: false,
        initLock: false // 防止重复初始化
    };

    // ========================== 通用工具函数（内部复用）==========================
    /**
     * 生成唯一ID
     * @param {string} prefix - ID前缀（income/expense）
     * @returns {string} 唯一ID
     */
    const generateId = (prefix) => {
        if (window.WorkbenchUtils?.generateId) {
            return WorkbenchUtils.generateId(prefix);
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    };

    /**
     * 统一错误处理
     * @param {Error} error - 错误对象
     * @param {string} type - 业务类型（income/expense）
     * @param {string} action - 操作类型（add/update/delete/fetch/save）
     * @returns {Error} 包装后的错误
     */
    const handleError = (error, type, action) => {
        const errorType = type === 'income' ? '收入' : '支出';
        const logPrefix = `[${MODULE_CONFIG.NAME}] ❌ ${action}${errorType}失败:`;
        console.error(logPrefix, error);

        // 统一提示
        if (window.WorkbenchUtils?.toast) {
            const toastMsg = action === 'save' 
                ? MODULE_CONFIG.TOAST_MESSAGES.SAVE_FAILED
                : `${MODULE_CONFIG.TOAST_MESSAGES.FETCH_FAILED.replace('%s', errorType)}: ${error.message}`;
            WorkbenchUtils.toast(toastMsg, 'error');
        }

        // 包装为自定义错误
        const financeError = new Error(error.message);
        financeError.type = type;
        financeError.action = action;
        financeError.original = error;
        return financeError;
    };

    /**
     * 校验金额有效性
     * @param {number|string} amount - 金额
     * @returns {number} 合法的金额（保留2位小数）
     * @throws {Error} 金额不合法时抛出错误
     */
    const validateAmount = (amount) => {
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error(MODULE_CONFIG.ERROR_MESSAGES.INVALID_AMOUNT);
        }
        return Number(numAmount.toFixed(2)); // 统一保留2位小数，避免精度问题
    };

    /**
     * 校验非空字符串
     * @param {string} value - 待校验值
     * @returns {string} 去除首尾空格的字符串
     * @throws {Error} 为空时抛出错误
     */
    const validateNonEmptyString = (value) => {
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(MODULE_CONFIG.ERROR_MESSAGES.EMPTY_NAME);
        }
        return value.trim();
    };

    /**
     * 通用日期范围过滤
     * @param {Array} list - 待过滤列表
     * @param {string} startDate - 开始日期
     * @param {string} endDate - 结束日期
     * @returns {Array} 过滤后的列表
     */
    const filterByDateRange = (list, startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // 日期无效时返回原列表
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return list;
        }

        return list.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= start && itemDate <= end;
        });
    };

    /**
     * 存储适配器（统一处理不同存储方式）
     */
    const storageAdapter = {
        /**
         * 加载数据
         * @param {string} key - 数据键名
         * @returns {Array} 加载的数据（深拷贝避免外部修改）
         */
        load: (key) => {
            try {
                let data = [];
                if (window.WorkbenchStorage) {
                    data = WorkbenchStorage.load(key) || [];
                } else {
                    const raw = localStorage.getItem(MODULE_CONFIG.STORAGE_KEYS[key.toUpperCase()]) || '[]';
                    data = JSON.parse(raw);
                }
                // 深拷贝防止外部修改内部状态
                return JSON.parse(JSON.stringify(data));
            } catch (error) {
                handleError(error, key, 'load');
                return [];
            }
        },

        /**
         * 保存数据
         * @param {string} key - 数据键名
         * @param {Array} data - 待保存数据
         * @returns {boolean} 是否保存成功
         */
        save: (key, data) => {
            try {
                if (window.WorkbenchStorage) {
                    WorkbenchStorage.save(key, data);
                } else {
                    localStorage.setItem(
                        MODULE_CONFIG.STORAGE_KEYS[key.toUpperCase()],
                        JSON.stringify(data)
                    );
                }
                return true;
            } catch (error) {
                handleError(error, key, 'save');
                return false;
            }
        }
    };

    // ========================== 核心业务逻辑 ==========================
    /**
     * 初始化财务模块（供loader调用）
     * @returns {boolean} 是否成功
     */
    function init() {
        // 防止重复初始化
        if (state.initLock || state.isInitialized) {
            console.log(`[${MODULE_CONFIG.NAME}] 已初始化，跳过重复执行`);
            return true;
        }

        state.initLock = true;
        try {
            console.log(`[${MODULE_CONFIG.NAME}] 财务模块初始化中...(v${MODULE_CONFIG.VERSION})`);
            
            // 加载数据
            loadData();
            
            // 绑定事件
            bindEvents();
            
            state.isInitialized = true;
            state.initLock = false;
            
            console.log(`[${MODULE_CONFIG.NAME}] ✅ 财务模块已初始化`);
            console.log(`[${MODULE_CONFIG.NAME}] 收入记录: ${state.incomes.length}`);
            console.log(`[${MODULE_CONFIG.NAME}] 支出记录: ${state.expenses.length}`);
            
            return true;
        } catch (error) {
            state.initLock = false;
            handleError(error, 'common', 'init');
            return false;
        }
    }

    /**
     * 从存储加载数据
     */
    function loadData() {
        try {
            state.incomes = storageAdapter.load('incomes');
            state.expenses = storageAdapter.load('expenses');
            console.log(`[${MODULE_CONFIG.NAME}] 数据已加载: 收入${state.incomes.length}条, 支出${state.expenses.length}条`);
        } catch (error) {
            handleError(error, 'common', 'load');
            state.incomes = [];
            state.expenses = [];
        }
    }

    /**
     * 保存数据（含云端同步）
     * @returns {boolean} 是否成功
     */
    function saveData() {
        try {
            // 本地存储保存
            const saveIncomes = storageAdapter.save('incomes', state.incomes);
            const saveExpenses = storageAdapter.save('expenses', state.expenses);
            
            // 同步到WorkbenchState
            if (window.WorkbenchState) {
                WorkbenchState.set('data.incomes', state.incomes, false);
                WorkbenchState.set('data.expenses', state.expenses, false);
            }
            
            // Firebase同步（非阻塞）
            if (window.WorkbenchFirebase?.isInitialized?.()) {
                Promise.allSettled([
                    WorkbenchFirebase.save('incomes', MODULE_CONFIG.STORAGE_KEYS.REMOTE_INCOMES, { data: state.incomes })
                ]).catch(err => {
                    console.warn(`[${MODULE_CONFIG.NAME}] Firebase同步失败:`, err);
                });
            }
            
            console.log(`[${MODULE_CONFIG.NAME}] ✅ 数据已保存`);
            return saveIncomes && saveExpenses;
        } catch (error) {
            handleError(error, 'common', 'save');
            return false;
        }
    }

    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        // 预留事件绑定扩展点
        console.log(`[${MODULE_CONFIG.NAME}] 事件绑定完成（预留扩展点）`);
    }

    // -------------------------- 收入相关操作 --------------------------
    /**
     * 校验收入数据
     * @param {Object} incomeData - 收入数据
     * @returns {Object} 校验后的干净数据
     * @throws {Error} 校验失败抛出错误
     */
    const validateIncomeData = (incomeData) => {
        if (!incomeData || typeof incomeData !== 'object' || Array.isArray(incomeData)) {
            throw new Error(MODULE_CONFIG.ERROR_MESSAGES.INVALID_OBJECT.replace('%s', '收入'));
        }

        return {
            name: validateNonEmptyString(incomeData.name),
            amount: validateAmount(incomeData.amount),
            type: incomeData.type || MODULE_CONFIG.DEFAULT_TYPES.INCOME,
            date: incomeData.date || new Date().toISOString(),
            remark: incomeData.remark || ''
        };
    };

    /**
     * 添加收入记录
     * @param {Object} incomeData - 收入数据
     * @returns {Promise<Object|null>} 添加的记录
     */
    async function addIncome(incomeData) {
        try {
            // 数据校验
            const validatedData = validateIncomeData(incomeData);

            // 构建收入记录
            const newIncome = {
                id: generateId('income'),
                ...validatedData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 添加到状态并保存
            state.incomes.push(newIncome);
            saveData();

            // 成功提示
            if (window.WorkbenchUtils?.toast) {
                WorkbenchUtils.toast(
                    MODULE_CONFIG.TOAST_MESSAGES.ADD_SUCCESS.replace('%s', '收入'),
                    'success'
                );
            }
            
            console.log(`[${MODULE_CONFIG.NAME}] ✅ 收入记录已添加:`, newIncome);
            return newIncome;
        } catch (error) {
            handleError(error, 'income', 'add');
            return null;
        }
    }

    /**
     * 更新收入记录
     * @param {string} id - 记录ID
     * @param {Object} updates - 更新内容
     * @returns {Promise<Object|null>} 更新后的记录
     */
    async function updateIncome(id, updates) {
        try {
            // 参数校验
            if (!id || typeof id !== 'string') {
                throw new Error(MODULE_CONFIG.ERROR_MESSAGES.INVALID_ID.replace('%s', '收入'));
            }
            if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
                throw new Error(MODULE_CONFIG.ERROR_MESSAGES.INVALID_UPDATES);
            }

            // 查找记录
            const index = state.incomes.findIndex(inc => inc.id === id);
            if (index === -1) {
                throw new Error(MODULE_CONFIG.ERROR_MESSAGES.RECORD_NOT_FOUND.replace('%s', '收入').replace('%s', id));
            }

            // 合并并校验更新数据
            const current = state.incomes[index];
            const updatedData = {
                ...current,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            // 重新校验关键字段（如果有更新）
            if (updates.name) updatedData.name = validateNonEmptyString(updates.name);
            if (updates.amount !== undefined) updatedData.amount = validateAmount(updates.amount);

            // 更新状态并保存
            state.incomes[index] = updatedData;
            saveData();

            // 成功提示
            if (window.WorkbenchUtils?.toast) {
                WorkbenchUtils.toast(
                    MODULE_CONFIG.TOAST_MESSAGES.UPDATE_SUCCESS.replace('%s', '收入'),
                    'success'
                );
            }
            
            console.log(`[${MODULE_CONFIG.NAME}] ✅ 收入记录已更新:`, updatedData);
            return updatedData;
        } catch (error) {
            handleError(error, 'income', 'update');
            return null;
        }
    }

    /**
     * 删除收入记录
     * @param {string} id - 记录ID
     * @returns {Promise<boolean>} 删除结果
     */
    async function deleteIncome(id) {
        try {
            if (!id || typeof id !== 'string') {
                throw new Error(MODULE_CONFIG.ERROR_MESSAGES.INVALID_ID.replace('%s', '收入'));
            }

            const initialLength = state.incomes.length;
            state.incomes = state.incomes.filter(inc => inc.id !== id);

            if (state.incomes.length === initialLength) {
                throw new Error(MODULE_CONFIG.ERROR_MESSAGES.RECORD_NOT_FOUND.replace('%s', '收入').replace('%s', id));
            }

            saveData();
            
            // 成功提示
            if (window.WorkbenchUtils?.toast) {
                WorkbenchUtils.toast(
                    MODULE_CONFIG.TOAST_MESSAGES.DELETE_SUCCESS.replace('%s', '收入'),
                    'success'
                );
            }
            
            console.log(`[${MODULE_CONFIG.NAME}] ✅ 收入记录已删除:`, id);
            return true;
        } catch (error) {
            handleError(error, 'income', 'delete');
            return false;
        }
    }

    /**
     * 获取收入记录列表（支持过滤）
     * @param {Object} filters - 过滤条件
     * @param {string} [filters.type] - 收入类型
     * @param {string} [filters.startDate] - 开始日期
     * @param {string} [filters.endDate] - 结束日期
     * @param {number} [filters.minAmount] - 最小金额
     * @param {number} [filters.maxAmount] - 最大金额
     * @returns {Array} 过滤后的收入记录
     */
    function getIncomes(filters = {}) {
        try {
            let result = [...state.incomes];

            // 按类型过滤（提前判断，减少遍历）
            if (filters.type && typeof filters.type === 'string') {
                result = result.filter(inc => inc.type === filters.type);
            }

            // 按日期范围过滤
            if (filters.startDate && filters.endDate) {
                result = filterByDateRange(result, filters.startDate, filters.endDate);
            }

            // 按金额范围过滤
            if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
                const min = Number(filters.minAmount) || 0;
                const max = Number(filters.maxAmount) || Infinity;
                result = result.filter(inc => inc.amount >= min && inc.amount <= max);
            }

            // 排序（默认按日期降序，优化排序逻辑）
            result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return result;
        } catch (error) {
            handleError(error, 'income', 'fetch');
            return [];
        }
    }

    // -------------------------- 支出相关操作 --------------------------
    /**
     * 校验支出数据
     * @param {Object} expenseData - 支出数据
     * @returns {Object} 校验后的干净数据
     * @throws {Error} 校验失败抛出错误
     */
    const validateExpenseData = (expenseData) => {
        if (!expenseData || typeof expenseData !== 'object' || Array.isArray(expenseData)) {
            throw new Error(MODULE_CONFIG.ERROR_MESSAGES.INVALID_OBJECT.replace('%s', '支出'));
        }

        return {
            name: validateNonEmptyString(expenseData.name),
            amount: validateAmount(expenseData.amount),
            category: expenseData.category || MODULE_CONFIG.DEFAULT_TYPES.EXPENSE,
            date: expenseData.date || new Date().toISOString(),
            remark: expenseData.remark || ''
        };
    };

    /**
     * 添加支出记录
     * @param {Object} expenseData - 支出数据
     * @returns {Promise<Object|null>} 添加的记录
     */
    async function addExpense(expenseData) {
        try {
            // 数据校验
            const validatedData = validateExpenseData(expenseData);

            // 构建支出记录
            const newExpense = {
                id: generateId('expense'),
                ...validatedData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 添加到状态并保存
            state.expenses.push(newExpense);
            saveData();

            // 成功提示
            if (window.WorkbenchUtils?.toast) {
                WorkbenchUtils.toast(
                    MODULE_CONFIG.TOAST_MESSAGES.ADD_SUCCESS.replace('%s', '支出'),
                    'success'
                );
            }
            
            console.log(`[${MODULE_CONFIG.NAME}] ✅ 支出记录已添加:`, newExpense);
            return newExpense;
        } catch (error) {
            handleError(error, 'expense', 'add');
            return null;
        }
    }

    /**
     * 删除支出记录
     * @param {string} id - 记录ID
     * @returns {Promise<boolean>} 删除结果
     */
    async function deleteExpense(id) {
        try {
            if (!id || typeof id !== 'string') {
                throw new Error(MODULE_CONFIG.ERROR_MESSAGES.INVALID_ID.replace('%s', '支出'));
            }

            const initialLength = state.expenses.length;
            state.expenses = state.expenses.filter(exp => exp.id !== id);

            if (state.expenses.length === initialLength) {
                throw new Error(MODULE_CONFIG.ERROR_MESSAGES.RECORD_NOT_FOUND.replace('%s', '支出').replace('%s', id));
            }

            saveData();
            
            // 成功提示
            if (window.WorkbenchUtils?.toast) {
                WorkbenchUtils.toast(
                    MODULE_CONFIG.TOAST_MESSAGES.DELETE_SUCCESS.replace('%s', '支出'),
                    'success'
                );
            }
            
            console.log(`[${MODULE_CONFIG.NAME}] ✅ 支出记录已删除:`, id);
            return true;
        } catch (error) {
            handleError(error, 'expense', 'delete');
            return false;
        }
    }

    /**
     * 获取支出记录列表
     * @param {Object} filters - 过滤条件
     * @param {string} [filters.category] - 支出类别
     * @param {string} [filters.startDate] - 开始日期
     * @param {string} [filters.endDate] - 结束日期
     * @returns {Array} 过滤后的支出记录
     */
    function getExpenses(filters = {}) {
        try {
            let result = [...state.expenses];

            // 按类别过滤
            if (filters.category && typeof filters.category === 'string') {
                result = result.filter(exp => exp.category === filters.category);
            }

            // 按日期范围过滤
            if (filters.startDate && filters.endDate) {
                result = filterByDateRange(result, filters.startDate, filters.endDate);
            }

            // 排序（默认按日期降序）
            result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return result;
        } catch (error) {
            handleError(error, 'expense', 'fetch');
            return [];
        }
    }

    // -------------------------- 统计相关操作 --------------------------
    /**
     * 获取当月的起始和结束时间戳（缓存优化）
     * @returns {Object} 当月起始/结束时间
     */
    const getCurrentMonthRange = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        // 当月第一天 00:00:00
        const start = new Date(year, month, 1).getTime();
        // 当月最后一天 23:59:59
        const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
        return { start, end };
    };

    /**
     * 计算财务统计
     * @param {Object} options - 统计选项
     * @returns {Object} 统计结果
     */
    function getFinanceStats(options = {}) {
        try {
            const { start: currentMonthStart, end: currentMonthEnd } = getCurrentMonthRange();

            // 优化：使用reduce时减少重复计算
            const calculateTotal = (list) => list.reduce((sum, item) => sum + item.amount, 0);
            const calculateMonthTotal = (list) => list.reduce((sum, item) => {
                const itemTime = new Date(item.date).getTime();
                return itemTime >= currentMonthStart && itemTime <= currentMonthEnd 
                    ? sum + item.amount 
                    : sum;
            }, 0);

            // 核心统计
            const totalIncome = calculateTotal(state.incomes);
            const monthIncome = calculateMonthTotal(state.incomes);
            const totalExpense = calculateTotal(state.expenses);
            const monthExpense = calculateMonthTotal(state.expenses);

            // 格式化结果（统一保留2位小数）
            return {
                totalIncome: totalIncome.toFixed(2),
                monthIncome: monthIncome.toFixed(2),
                totalExpense: totalExpense.toFixed(2),
                monthExpense: monthExpense.toFixed(2),
                netProfit: (totalIncome - totalExpense).toFixed(2),
                monthNetProfit: (monthIncome - monthExpense).toFixed(2),
                incomeCount: state.incomes.length,
                expenseCount: state.expenses.length
            };
        } catch (error) {
            handleError(error, 'common', 'stats');
            // 默认返回空统计
            return {
                totalIncome: '0.00',
                monthIncome: '0.00',
                totalExpense: '0.00',
                monthExpense: '0.00',
                netProfit: '0.00',
                monthNetProfit: '0.00',
                incomeCount: 0,
                expenseCount: 0
            };
        }
    }

    // ========================== 公共API（保持兼容）==========================
    const api = {
        // 初始化
        init,
        
        // 收入操作
        addIncome,
        updateIncome,
        deleteIncome,
        getIncomes,
        
        // 支出操作
        addExpense,
        deleteExpense,
        getExpenses,
        
        // 统计
        getFinanceStats,
        
        // 数据管理
        loadData,
        saveData
    };

    return api;
})();

// 挂载到全局
window.WorkbenchFinance = WorkbenchFinance;

// 模块导出（支持CommonJS和ES模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchFinance;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchFinance);
}

console.log(`[Finance] 财务模块已加载 (V${WorkbenchFinance.VERSION || 14.3} 优化版)`);
