/**
 * V14.2 PRO - CRM客户关系管理模块
 * 客户档案管理、联系记录、销售跟进
 * @namespace WorkbenchCRM
 */
const WorkbenchCRM = (() => {
    'use strict';

    // 客户字段配置
    const CUSTOMER_FIELDS = ['name', 'phone', 'email', 'company', 'address', 'remark'];

    // 表单验证规则
    const VALIDATION_RULES = {
        name: { required: true, message: '客户名称不能为空' },
        phone: { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
        email: { pattern: /^[\w.-]+@[\w.-]+\.\w+$/, message: '邮箱格式不正确' }
    };

    // 模块状态
    const state = {
        customers: [],
        isInitialized: false
    };

    /**
     * 初始化CRM模块
     * @returns {boolean} 是否成功
     */
    function init() {
        try {
            console.log('[CRM] CRM模块初始化中...');
            loadCustomers();
            console.log('[CRM] ✅ CRM模块已初始化');
            console.log('[CRM] 客户数量:', state.customers.length);
            state.isInitialized = true;
            return true;
        } catch (error) {
            console.error('[CRM] ❌ 初始化失败:', error);
            return false;
        }
    }

    /**
     * 从存储加载客户数据
     */
    function loadCustomers() {
        try {
            if (window.WorkbenchStorage) {
                state.customers = WorkbenchStorage.load('customers') || [];
            } else {
                const key = window.WorkbenchConfig?.STORAGE_KEYS?.CUSTOMERS || 'v5_erp_customers';
                const customersJson = localStorage.getItem(key);
                state.customers = customersJson ? JSON.parse(customersJson) : [];
            }
            console.log(`[CRM] ✅ 已加载 ${state.customers.length} 个客户`);
        } catch (error) {
            console.error('[CRM] ❌ 加载客户数据失败:', error);
            state.customers = [];
        }
    }

    /**
     * 保存客户数据
     * @returns {boolean} 是否成功
     */
    function saveCustomers() {
        try {
            if (window.WorkbenchStorage) {
                WorkbenchStorage.save('customers', state.customers);
            } else {
                const key = window.WorkbenchConfig?.STORAGE_KEYS?.CUSTOMERS || 'v5_erp_customers';
                localStorage.setItem(key, JSON.stringify(state.customers));
            }
            
            // 同步到WorkbenchState
            if (window.WorkbenchState) {
                WorkbenchState.set('data.customers', state.customers, false);
            }
            
            console.log(`[CRM] ✅ 已保存 ${state.customers.length} 个客户`);
            return true;
        } catch (error) {
            console.error('[CRM] ❌ 保存客户数据失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('客户数据保存失败', 'error');
            }
            return false;
        }
    }

    /**
     * 渲染客户列表
     */
    function renderCustomers() {
        try {
            const container = document.getElementById('crm-customers');
            if (!container) {
                console.warn('[CRM] 容器未找到: #crm-customers');
                return;
            }

            if (state.customers.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12 text-gray-500">
                        <i class="fas fa-users text-4xl mb-4 opacity-50"></i>
                        <p>暂无客户数据</p>
                        <p class="text-sm mt-2">点击"新增客户"开始添加</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = state.customers.map(customer => renderCustomerCard(customer)).join('');
            console.log('[CRM] ✅ 客户列表渲染完成');
        } catch (error) {
            console.error('[CRM] ❌ 渲染客户列表失败:', error);
        }
    }

    /**
     * 渲染客户卡片
     * @param {Object} customer - 客户对象
     * @returns {string} HTML字符串
     */
    function renderCustomerCard(customer) {
        return `
            <div class="bg-gray-900 rounded-xl p-6 hover:bg-gray-850 transition-colors border border-gray-800 hover:border-purple-500">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                            ${getInitials(customer.name)}
                        </div>
                        <div>
                            <h3 class="font-bold text-white text-lg">${escapeHtml(customer.name)}</h3>
                            ${customer.company ? `<p class="text-sm text-gray-400">${escapeHtml(customer.company)}</p>` : ''}
                        </div>
                    </div>
                    <button onclick="WorkbenchCRM.deleteCustomer('${customer.id}')" 
                        class="text-gray-600 hover:text-red-500 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                
                <div class="space-y-2 text-sm">
                    ${customer.phone ? `
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-phone w-4"></i>
                            <span class="font-mono">${escapeHtml(customer.phone)}</span>
                        </div>
                    ` : ''}
                    ${customer.email ? `
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-envelope w-4"></i>
                            <span>${escapeHtml(customer.email)}</span>
                        </div>
                    ` : ''}
                    ${customer.address ? `
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-map-marker-alt w-4"></i>
                            <span class="line-clamp-1">${escapeHtml(customer.address)}</span>
                        </div>
                    ` : ''}
                </div>
                
                ${customer.remark ? `
                    <div class="mt-3 pt-3 border-t border-gray-800">
                        <p class="text-xs text-gray-500 line-clamp-2">${escapeHtml(customer.remark)}</p>
                    </div>
                ` : ''}
                
                <div class="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                    <span>创建时间: ${formatDate(customer.createTime)}</span>
                    <button onclick="WorkbenchCRM.openCustomerModal('${customer.id}')" 
                        class="text-purple-400 hover:text-purple-300 transition-colors">
                        <i class="fas fa-edit mr-1"></i>编辑
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 打开客户模态框
     * @param {string} customerId - 客户ID（编辑时传入）
     */
    function openCustomerModal(customerId = null) {
        try {
            const customer = customerId ? state.customers.find(c => c.id === customerId) : null;
            
            if (window.WorkbenchModal) {
                WorkbenchModal.open({
                    title: customer ? '编辑客户' : '新增客户',
                    size: 'lg',
                    content: generateCustomerForm(customer),
                    buttons: [
                        {
                            text: '取消',
                            className: 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded',
                            onClick: (modal) => WorkbenchModal.close(modal)
                        },
                        {
                            text: '保存',
                            className: 'bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded',
                            onClick: () => handleCustomerSubmit(customerId)
                        }
                    ]
                });
            } else {
                console.warn('[CRM] 模态框管理器未加载');
            }
        } catch (error) {
            console.error('[CRM] ❌ 打开客户模态框失败:', error);
        }
    }

    /**
     * 生成客户表单
     * @param {Object} customer - 客户对象（编辑时）
     * @returns {string} HTML字符串
     */
    function generateCustomerForm(customer = null) {
        return `
            <form id="customer-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">客户名称 *</label>
                    <input type="text" id="customer-name" value="${customer?.name || ''}" required
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                           placeholder="请输入客户名称">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">联系电话</label>
                        <input type="tel" id="customer-phone" value="${customer?.phone || ''}"
                               class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                               placeholder="手机号码">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">邮箱地址</label>
                        <input type="email" id="customer-email" value="${customer?.email || ''}"
                               class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                               placeholder="email@example.com">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">公司名称</label>
                    <input type="text" id="customer-company" value="${customer?.company || ''}"
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                           placeholder="公司名称（可选）">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">地址</label>
                    <textarea id="customer-address" rows="2"
                              class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="客户地址（可选）">${customer?.address || ''}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">备注</label>
                    <textarea id="customer-remark" rows="3"
                              class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="备注信息（可选）">${customer?.remark || ''}</textarea>
                </div>
            </form>
        `;
    }

    /**
     * 处理客户提交
     * @param {string} customerId - 客户ID（编辑时）
     */
    function handleCustomerSubmit(customerId = null) {
        try {
            const formData = {
                name: document.getElementById('customer-name')?.value?.trim(),
                phone: document.getElementById('customer-phone')?.value?.trim(),
                email: document.getElementById('customer-email')?.value?.trim(),
                company: document.getElementById('customer-company')?.value?.trim(),
                address: document.getElementById('customer-address')?.value?.trim(),
                remark: document.getElementById('customer-remark')?.value?.trim()
            };

            // 验证必填项
            if (!formData.name) {
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast('请输入客户名称', 'warning');
                }
                return;
            }

            // 验证手机号（如果填写）
            if (formData.phone && !VALIDATION_RULES.phone.pattern.test(formData.phone)) {
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast(VALIDATION_RULES.phone.message, 'warning');
                }
                return;
            }

            // 验证邮箱（如果填写）
            if (formData.email && !VALIDATION_RULES.email.pattern.test(formData.email)) {
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast(VALIDATION_RULES.email.message, 'warning');
                }
                return;
            }

            if (customerId) {
                // 编辑现有客户
                const index = state.customers.findIndex(c => c.id === customerId);
                if (index !== -1) {
                    state.customers[index] = {
                        ...state.customers[index],
                        ...formData,
                        updateTime: new Date().toISOString()
                    };
                }
            } else {
                // 新增客户
                const newCustomer = {
                    id: window.WorkbenchUtils ? 
                        WorkbenchUtils.generateId('customer') : 
                        `customer_${Date.now()}`,
                    ...formData,
                    createTime: new Date().toISOString(),
                    updateTime: new Date().toISOString()
                };
                state.customers.push(newCustomer);
            }

            saveCustomers();
            renderCustomers();

            if (window.WorkbenchModal) {
                WorkbenchModal.close();
            }

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(customerId ? '客户信息已更新' : '客户添加成功', 'success');
            }

            console.log('[CRM] ✅ 客户信息保存成功');
        } catch (error) {
            console.error('[CRM] ❌ 保存客户信息失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('保存客户信息失败，请重试', 'error');
            }
        }
    }

    /**
     * 删除客户
     * @param {string} customerId - 客户ID
     */
    async function deleteCustomer(customerId) {
        try {
            const confirmed = window.WorkbenchModal ? 
                await WorkbenchModal.confirm('确定要删除这个客户吗？', {
                    title: '删除确认',
                    confirmText: '确认删除',
                    cancelText: '取消'
                }) :
                confirm('确定要删除这个客户吗？');

            if (!confirmed) return;

            const index = state.customers.findIndex(c => c.id === customerId);
            if (index === -1) {
                console.warn('[CRM] 客户不存在:', customerId);
                return;
            }

            state.customers.splice(index, 1);
            saveCustomers();
            renderCustomers();

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('客户已删除', 'success');
            }

            console.log('[CRM] ✅ 客户已删除:', customerId);
        } catch (error) {
            console.error('[CRM] ❌ 删除客户失败:', error);
        }
    }

    /**
     * 获取所有客户
     * @returns {Array} 客户列表
     */
    function getAllCustomers() {
        return [...state.customers];
    }

    /**
     * 根据ID获取客户
     * @param {string} customerId - 客户ID
     * @returns {Object|null} 客户对象
     */
    function getCustomerById(customerId) {
        return state.customers.find(c => c.id === customerId) || null;
    }

    // 工具函数
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '未知';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('zh-CN');
        } catch {
            return '未知';
        }
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
        renderCustomers,
        openCustomerModal,
        deleteCustomer,
        getAllCustomers,
        getCustomerById,
        CUSTOMER_FIELDS,
        VALIDATION_RULES
    };

    return api;
})();

// 挂载到全局
window.WorkbenchCRM = WorkbenchCRM;

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchCRM;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchCRM);
}

console.log('[CRM] CRM客户关系管理模块已加载');
