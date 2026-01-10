/**
 * V14.2 PRO - 运营支出模块
 * 管理日常运营费用、报销、固定成本等
 * @namespace WorkbenchExpenses
 */
const WorkbenchExpenses = (() => {
    'use strict';

    // 支出分类
    const EXPENSE_CATEGORIES = {
        RENT: '租金',
        SALARY: '工资',
        UTILITIES: '水电',
        OFFICE: '办公',
        TRAVEL: '差旅',
        MARKETING: '营销',
        SUPPLIES: '耗材',
        SERVICE: '服务费',
        OTHER: '其他'
    };

    // 模块状态
    const state = {
        expenses: [],
        isInitialized: false
    };

    /**
     * 初始化支出模块
     * @returns {boolean} 是否成功
     */
    function init() {
        try {
            console.log('[Expenses] 支出模块初始化中...');
            loadExpenses();
            console.log('[Expenses] ✅ 支出模块已初始化');
            console.log('[Expenses] 支出记录:', state.expenses.length);
            state.isInitialized = true;
            return true;
        } catch (error) {
            console.error('[Expenses] ❌ 初始化失败:', error);
            return false;
        }
    }

    /**
     * 从存储加载支出数据
     */
    function loadExpenses() {
        try {
            if (window.WorkbenchStorage) {
                state.expenses = WorkbenchStorage.load('expenses') || [];
            } else {
                const key = window.WorkbenchConfig?.STORAGE_KEYS?.EXPENSES || 'v5_erp_expenses';
                const expensesJson = localStorage.getItem(key);
                state.expenses = expensesJson ? JSON.parse(expensesJson) : [];
            }
            console.log(`[Expenses] ✅ 已加载 ${state.expenses.length} 条支出记录`);
        } catch (error) {
            console.error('[Expenses] ❌ 加载支出数据失败:', error);
            state.expenses = [];
        }
    }

    /**
     * 保存支出数据
     * @returns {boolean} 是否成功
     */
    function saveExpenses() {
        try {
            if (window.WorkbenchStorage) {
                WorkbenchStorage.save('expenses', state.expenses);
            } else {
                const key = window.WorkbenchConfig?.STORAGE_KEYS?.EXPENSES || 'v5_erp_expenses';
                localStorage.setItem(key, JSON.stringify(state.expenses));
            }
            
            // 同步到WorkbenchState
            if (window.WorkbenchState) {
                WorkbenchState.set('data.expenses', state.expenses, false);
            }
            
            console.log(`[Expenses] ✅ 已保存 ${state.expenses.length} 条支出记录`);
            return true;
        } catch (error) {
            console.error('[Expenses] ❌ 保存支出数据失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('支出数据保存失败', 'error');
            }
            return false;
        }
    }

    /**
     * 渲染支出列表
     */
    function render() {
        try {
            const container = document.getElementById('expenses-list');
            if (!container) {
                console.warn('[Expenses] 容器未找到: #expenses-list');
                return;
            }

            if (state.expenses.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <i class="fas fa-receipt text-4xl mb-4 opacity-50"></i>
                        <p>暂无支出记录</p>
                        <p class="text-sm mt-2">点击"记录支出"开始添加</p>
                    </div>
                `;
                return;
            }

            // 按日期分组
            const groupedExpenses = groupByDate(state.expenses);
            
            container.innerHTML = Object.entries(groupedExpenses).map(([date, expenses]) => `
                <div class="bg-gray-900 rounded-xl p-6">
                    <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <i class="fas fa-calendar text-blue-500"></i>
                        ${date}
                        <span class="text-sm text-gray-500 ml-auto">
                            ${expenses.length} 条记录
                        </span>
                    </h3>
                    <div class="space-y-3">
                        ${expenses.map(exp => renderExpenseCard(exp)).join('')}
                    </div>
                </div>
            `).join('');

            console.log('[Expenses] ✅ 支出列表渲染完成');
        } catch (error) {
            console.error('[Expenses] ❌ 渲染支出列表失败:', error);
        }
    }

    /**
     * 按日期分组
     * @param {Array} expenses - 支出列表
     * @returns {Object} 分组后的支出
     */
    function groupByDate(expenses) {
        const grouped = {};
        expenses.forEach(exp => {
            const date = formatDate(exp.date || exp.createdAt);
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(exp);
        });
        return grouped;
    }

    /**
     * 渲染支出卡片
     * @param {Object} expense - 支出对象
     * @returns {string} HTML字符串
     */
    function renderExpenseCard(expense) {
        const categoryColor = getCategoryColor(expense.category);
        return `
            <div class="bg-gray-800 rounded-lg p-4 flex items-center justify-between hover:bg-gray-750 transition-colors">
                <div class="flex items-center gap-4 flex-1">
                    <div class="w-12 h-12 ${categoryColor} rounded-lg flex items-center justify-center">
                        <i class="fas ${getCategoryIcon(expense.category)} text-white text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <h4 class="font-medium text-white">${escapeHtml(expense.name)}</h4>
                        <p class="text-sm text-gray-400">${EXPENSE_CATEGORIES[expense.category] || expense.category}</p>
                        ${expense.remark ? `<p class="text-xs text-gray-500 mt-1">${escapeHtml(expense.remark)}</p>` : ''}
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-bold text-red-400">-¥${formatNumber(expense.amount)}</p>
                    <p class="text-xs text-gray-500">${formatTime(expense.createdAt)}</p>
                </div>
                <button onclick="WorkbenchExpenses.deleteExpense('${expense.id}')" 
                    class="ml-4 text-gray-600 hover:text-red-500 transition-colors">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    /**
     * 获取分类颜色
     * @param {string} category - 分类
     * @returns {string} CSS类名
     */
    function getCategoryColor(category) {
        const colors = {
            RENT: 'bg-purple-600',
            SALARY: 'bg-blue-600',
            UTILITIES: 'bg-yellow-600',
            OFFICE: 'bg-green-600',
            TRAVEL: 'bg-indigo-600',
            MARKETING: 'bg-pink-600',
            SUPPLIES: 'bg-orange-600',
            SERVICE: 'bg-teal-600',
            OTHER: 'bg-gray-600'
        };
        return colors[category] || colors.OTHER;
    }

    /**
     * 获取分类图标
     * @param {string} category - 分类
     * @returns {string} 图标类名
     */
    function getCategoryIcon(category) {
        const icons = {
            RENT: 'fa-building',
            SALARY: 'fa-users',
            UTILITIES: 'fa-bolt',
            OFFICE: 'fa-pen',
            TRAVEL: 'fa-plane',
            MARKETING: 'fa-bullhorn',
            SUPPLIES: 'fa-box',
            SERVICE: 'fa-cogs',
            OTHER: 'fa-ellipsis-h'
        };
        return icons[category] || icons.OTHER;
    }

    /**
     * 打开添加支出模态框
     */
    function openExpenseModal() {
        try {
            if (window.WorkbenchModal) {
                WorkbenchModal.open({
                    title: '记录运营支出',
                    content: generateExpenseForm(),
                    size: 'lg',
                    buttons: [
                        {
                            text: '取消',
                            className: 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded',
                            onClick: (modal) => WorkbenchModal.close(modal)
                        },
                        {
                            text: '保存',
                            className: 'bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded',
                            onClick: () => handleExpenseSubmit()
                        }
                    ]
                });
            } else {
                console.warn('[Expenses] 模态框管理器未加载');
            }
        } catch (error) {
            console.error('[Expenses] ❌ 打开支出模态框失败:', error);
        }
    }

    /**
     * 生成支出表单
     * @returns {string} HTML字符串
     */
    function generateExpenseForm() {
        return `
            <form id="expense-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">支出名称 *</label>
                    <input type="text" id="expense-name" required
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                           placeholder="例如：办公室租金">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">金额 *</label>
                        <input type="number" id="expense-amount" required step="0.01" min="0"
                               class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                               placeholder="0.00">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">分类 *</label>
                        <select id="expense-category"
                                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                            ${Object.entries(EXPENSE_CATEGORIES).map(([key, value]) => 
                                `<option value="${key}">${value}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">日期</label>
                    <input type="date" id="expense-date" 
                           value="${new Date().toISOString().split('T')[0]}"
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">备注</label>
                    <textarea id="expense-remark" rows="3"
                              class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="支出备注信息（可选）"></textarea>
                </div>
            </form>
        `;
    }

    /**
     * 处理支出提交
     */
    function handleExpenseSubmit() {
        try {
            const formData = {
                name: document.getElementById('expense-name')?.value?.trim(),
                amount: parseFloat(document.getElementById('expense-amount')?.value) || 0,
                category: document.getElementById('expense-category')?.value,
                date: document.getElementById('expense-date')?.value,
                remark: document.getElementById('expense-remark')?.value?.trim() || ''
            };

            if (!formData.name) {
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast('请输入支出名称', 'warning');
                }
                return;
            }

            if (formData.amount <= 0) {
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast('请输入有效的支出金额', 'warning');
                }
                return;
            }

            const expenseId = window.WorkbenchUtils ? 
                WorkbenchUtils.generateId('expense') : 
                `expense_${Date.now()}`;

            const newExpense = {
                id: expenseId,
                name: formData.name,
                amount: formData.amount,
                category: formData.category,
                date: formData.date || new Date().toISOString(),
                remark: formData.remark,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            state.expenses.unshift(newExpense);
            saveExpenses();
            render();

            if (window.WorkbenchModal) {
                WorkbenchModal.close();
            }

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('支出记录添加成功', 'success');
            }

            console.log('[Expenses] ✅ 支出记录添加成功:', newExpense);
        } catch (error) {
            console.error('[Expenses] ❌ 添加支出记录失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('添加支出记录失败，请重试', 'error');
            }
        }
    }

    /**
     * 删除支出记录
     * @param {string} expenseId - 支出ID
     */
    async function deleteExpense(expenseId) {
        try {
            const confirmed = window.WorkbenchModal ? 
                await WorkbenchModal.confirm('确定要删除这条支出记录吗？', {
                    title: '删除确认',
                    confirmText: '确认删除',
                    cancelText: '取消'
                }) :
                confirm('确定要删除这条支出记录吗？');

            if (!confirmed) return;

            const index = state.expenses.findIndex(exp => exp.id === expenseId);
            if (index === -1) {
                console.warn('[Expenses] 支出记录不存在:', expenseId);
                return;
            }

            state.expenses.splice(index, 1);
            saveExpenses();
            render();

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('支出记录已删除', 'success');
            }

            console.log('[Expenses] ✅ 支出记录已删除:', expenseId);
        } catch (error) {
            console.error('[Expenses] ❌ 删除支出记录失败:', error);
        }
    }

    /**
     * 获取所有支出记录
     * @returns {Array} 支出列表
     */
    function getAllExpenses() {
        return [...state.expenses];
    }

    /**
     * 获取支出统计
     * @returns {Object} 统计数据
     */
    function getStats() {
        const total = state.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const byCategory = {};
        
        state.expenses.forEach(exp => {
            const category = exp.category || 'OTHER';
            if (!byCategory[category]) {
                byCategory[category] = 0;
            }
            byCategory[category] += exp.amount || 0;
        });

        return {
            total: total.toFixed(2),
            count: state.expenses.length,
            byCategory
        };
    }

    // 工具函数
    function formatDate(dateStr) {
        if (!dateStr) return '未知日期';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('zh-CN');
        } catch {
            return '未知日期';
        }
    }

    function formatTime(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    }

    function formatNumber(num) {
        if (typeof num !== 'number') num = parseFloat(num) || 0;
        return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function escapeHtml(str) {
        if (!str) return '';
        if (window.WorkbenchUtils && WorkbenchUtils.escapeHtml) {
            return WorkbenchUtils.escapeHtml(str);
        }
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 公共API
    const api = {
        init,
        render,
        openExpenseModal,
        deleteExpense,
        getAllExpenses,
        getStats,
        EXPENSE_CATEGORIES
    };

    return api;
})();

// 挂载到全局
window.WorkbenchExpenses = WorkbenchExpenses;

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchExpenses;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchExpenses);
}

console.log('[Expenses] 运营支出模块已加载');
