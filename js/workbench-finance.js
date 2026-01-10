/**
 * V14.2 PRO - 财务模块（完全重构版）
 * 收入/支出管理 + 数据持久化 + 云端同步
 * 优化版本 - 2026-01-05
 * @namespace WorkbenchFinance
 */
const WorkbenchFinance = (() => {
    'use strict';

    // 模块状态
    const state = {
        incomes: [],
        expenses: [],
        isInitialized: false
    };

    /**
     * 初始化财务模块（供loader调用）
     * @returns {boolean} 是否成功
     */
    function init() {
        try {
            console.log('[Finance] 财务模块初始化中...');
            
            // 加载数据
            loadData();
            
            // 绑定事件
            bindEvents();
            
            state.isInitialized = true;
            
            console.log('[Finance] ✅ 财务模块已初始化');
            console.log('[Finance] 收入记录:', state.incomes.length);
            console.log('[Finance] 支出记录:', state.expenses.length);
            
            return true;
        } catch (error) {
            console.error('[Finance] ❌ 初始化失败:', error);
            return false;
        }
    }

    /**
     * 从存储加载数据
     */
    function loadData() {
        try {
            if (window.WorkbenchStorage) {
                state.incomes = WorkbenchStorage.load('incomes') || [];
                state.expenses = WorkbenchStorage.load('expenses') || [];
            } else {
                state.incomes = JSON.parse(localStorage.getItem('workbench_incomes') || '[]');
                state.expenses = JSON.parse(localStorage.getItem('workbench_expenses') || '[]');
            }
            
            console.log(`[Finance] 数据已加载: 收入${state.incomes.length}条, 支出${state.expenses.length}条`);
        } catch (error) {
            console.error('[Finance] ❌ 加载数据失败:', error);
            state.incomes = [];
            state.expenses = [];
        }
    }

    /**
     * 保存数据
     * @returns {boolean} 是否成功
     */
    function saveData() {
        try {
            if (window.WorkbenchStorage) {
                WorkbenchStorage.save('incomes', state.incomes);
                WorkbenchStorage.save('expenses', state.expenses);
            } else {
                localStorage.setItem('workbench_incomes', JSON.stringify(state.incomes));
                localStorage.setItem('workbench_expenses', JSON.stringify(state.expenses));
            }
            
            // 同步到WorkbenchState
            if (window.WorkbenchState) {
                WorkbenchState.set('data.incomes', state.incomes, false);
                WorkbenchState.set('data.expenses', state.expenses, false);
            }
            
            // 同步到Firebase（如果启用）
            if (window.WorkbenchFirebase && WorkbenchFirebase.isInitialized && WorkbenchFirebase.isInitialized()) {
                WorkbenchFirebase.save('incomes', 'user_incomes', { data: state.incomes }).catch(err => {
                    console.warn('[Finance] Firebase同步失败:', err);
                });
            }
            
            console.log('[Finance] ✅ 数据已保存');
            return true;
        } catch (error) {
            console.error('[Finance] ❌ 保存数据失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('数据保存失败', 'error');
            }
            return false;
        }
    }

    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        // 财务模块暂无需要绑定的全局事件
        console.log('[Finance] 事件绑定完成');
    }

    /**
     * 添加收入记录
     * @param {Object} incomeData - 收入数据
     * @returns {Promise<Object|null>} 添加的记录
     */
    async function addIncome(incomeData) {
        try {
            // 校验必填项
            if (!incomeData || typeof incomeData !== 'object') {
                throw new Error('收入数据必须为对象');
            }
            if (!incomeData.name || typeof incomeData.name !== 'string' || !incomeData.name.trim()) {
                throw new Error('收入名称不能为空');
            }
            const amount = Number(incomeData.amount);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('收入金额必须是大于0的有效数字');
            }

            // 构建收入记录
            const newIncome = {
                id: window.WorkbenchUtils ? 
                    WorkbenchUtils.generateId('income') : 
                    `income_${Date.now()}`,
                name: incomeData.name.trim(),
                amount: amount,
                type: incomeData.type || '其他',
                date: incomeData.date || new Date().toISOString(),
                remark: incomeData.remark || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 添加到状态并保存
            state.incomes.push(newIncome);
            saveData();

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('收入记录添加成功', 'success');
            }
            
            console.log('[Finance] ✅ 收入记录已添加:', newIncome);
            return newIncome;
        } catch (error) {
            console.error('[Finance] ❌ 添加收入失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`添加收入失败: ${error.message}`, 'error');
            }
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
                throw new Error('收入记录ID必须为非空字符串');
            }
            if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
                throw new Error('更新内容必须为非数组对象');
            }

            // 查找记录
            const index = state.incomes.findIndex(inc => inc.id === id);
            if (index === -1) {
                throw new Error(`收入记录 ${id} 不存在`);
            }

            // 合并更新数据
            const updatedIncome = {
                ...state.incomes[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            // 金额验证
            if (updatedIncome.amount !== undefined) {
                const amount = Number(updatedIncome.amount);
                if (isNaN(amount) || amount <= 0) {
                    throw new Error('收入金额必须是大于0的有效数字');
                }
                updatedIncome.amount = amount;
            }

            // 更新状态并保存
            state.incomes[index] = updatedIncome;
            saveData();

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('收入记录已更新', 'success');
            }
            
            console.log('[Finance] ✅ 收入记录已更新:', updatedIncome);
            return updatedIncome;
        } catch (error) {
            console.error('[Finance] ❌ 更新收入失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`更新收入失败: ${error.message}`, 'error');
            }
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
                throw new Error('收入记录ID必须为非空字符串');
            }

            const initialLength = state.incomes.length;
            state.incomes = state.incomes.filter(inc => inc.id !== id);

            if (state.incomes.length === initialLength) {
                throw new Error(`收入记录 ${id} 不存在`);
            }

            saveData();
            
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('收入记录已删除', 'success');
            }
            
            console.log('[Finance] ✅ 收入记录已删除:', id);
            return true;
        } catch (error) {
            console.error('[Finance] ❌ 删除收入失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`删除收入失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 获取收入记录列表（支持过滤）
     * @param {Object} filters - 过滤条件
     * @returns {Array} 过滤后的收入记录
     */
    function getIncomes(filters = {}) {
        try {
            let result = [...state.incomes];

            // 按类型过滤
            if (filters.type && typeof filters.type === 'string') {
                result = result.filter(inc => inc.type === filters.type);
            }

            // 按日期范围过滤
            if (filters.startDate && filters.endDate) {
                const start = new Date(filters.startDate);
                const end = new Date(filters.endDate);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    result = result.filter(inc => {
                        const date = new Date(inc.date);
                        return date >= start && date <= end;
                    });
                }
            }

            // 按金额范围过滤
            if (filters.minAmount || filters.maxAmount) {
                const min = Number(filters.minAmount) || 0;
                const max = Number(filters.maxAmount) || Infinity;
                result = result.filter(inc => inc.amount >= min && inc.amount <= max);
            }

            // 排序（默认按日期降序）
            result.sort((a, b) => new Date(b.date) - new Date(a.date));

            return result;
        } catch (error) {
            console.error('[Finance] ❌ 获取收入记录失败:', error);
            return [];
        }
    }

    /**
     * 添加支出记录
     * @param {Object} expenseData - 支出数据
     * @returns {Promise<Object|null>} 添加的记录
     */
    async function addExpense(expenseData) {
        try {
            // 校验必填项
            if (!expenseData || typeof expenseData !== 'object') {
                throw new Error('支出数据必须为对象');
            }
            if (!expenseData.name || typeof expenseData.name !== 'string' || !expenseData.name.trim()) {
                throw new Error('支出名称不能为空');
            }
            const amount = Number(expenseData.amount);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('支出金额必须是大于0的有效数字');
            }

            // 构建支出记录
            const newExpense = {
                id: window.WorkbenchUtils ? 
                    WorkbenchUtils.generateId('expense') : 
                    `expense_${Date.now()}`,
                name: expenseData.name.trim(),
                amount: amount,
                category: expenseData.category || '其他',
                date: expenseData.date || new Date().toISOString(),
                remark: expenseData.remark || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 添加到状态并保存
            state.expenses.push(newExpense);
            saveData();

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('支出记录添加成功', 'success');
            }
            
            console.log('[Finance] ✅ 支出记录已添加:', newExpense);
            return newExpense;
        } catch (error) {
            console.error('[Finance] ❌ 添加支出失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`添加支出失败: ${error.message}`, 'error');
            }
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
                throw new Error('支出记录ID必须为非空字符串');
            }

            const initialLength = state.expenses.length;
            state.expenses = state.expenses.filter(exp => exp.id !== id);

            if (state.expenses.length === initialLength) {
                throw new Error(`支出记录 ${id} 不存在`);
            }

            saveData();
            
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('支出记录已删除', 'success');
            }
            
            console.log('[Finance] ✅ 支出记录已删除:', id);
            return true;
        } catch (error) {
            console.error('[Finance] ❌ 删除支出失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`删除支出失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 获取支出记录列表
     * @param {Object} filters - 过滤条件
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
                const start = new Date(filters.startDate);
                const end = new Date(filters.endDate);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    result = result.filter(exp => {
                        const date = new Date(exp.date);
                        return date >= start && date <= end;
                    });
                }
            }

            // 排序（默认按日期降序）
            result.sort((a, b) => new Date(b.date) - new Date(a.date));

            return result;
        } catch (error) {
            console.error('[Finance] ❌ 获取支出记录失败:', error);
            return [];
        }
    }

    /**
     * 计算财务统计
     * @param {Object} options - 统计选项
     * @returns {Object} 统计结果
     */
    function getFinanceStats(options = {}) {
        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // 总收入
            const totalIncome = state.incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            // 本月收入
            const monthIncome = state.incomes
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate.getMonth() === currentMonth && 
                           itemDate.getFullYear() === currentYear;
                })
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            // 总支出
            const totalExpense = state.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            // 本月支出
            const monthExpense = state.expenses
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate.getMonth() === currentMonth && 
                           itemDate.getFullYear() === currentYear;
                })
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            // 净利润
            const netProfit = totalIncome - totalExpense;
            const monthNetProfit = monthIncome - monthExpense;

            return {
                totalIncome: totalIncome.toFixed(2),
                monthIncome: monthIncome.toFixed(2),
                totalExpense: totalExpense.toFixed(2),
                monthExpense: monthExpense.toFixed(2),
                netProfit: netProfit.toFixed(2),
                monthNetProfit: monthNetProfit.toFixed(2),
                incomeCount: state.incomes.length,
                expenseCount: state.expenses.length
            };
        } catch (error) {
            console.error('[Finance] ❌ 计算财务统计失败:', error);
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

    // 公共API
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

console.log('[Finance] 财务模块已加载 (V14.2 重构版)');
