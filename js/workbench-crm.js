/**
 * WorkbenchCRM - 客户关系管理模块
 * 完整 CRUD 功能：增删改查
 * 版本: 2.0.0
 * 
 * 数据存储键: v5_erp_customers (与 WorkbenchConfig.STORAGE_KEYS.CUSTOMERS 对齐)
 */
const WorkbenchCRM = (function() {
    'use strict';

    // ==================== 配置常量 ====================
    const STORAGE_KEY = 'v5_erp_customers';
    const ID_PREFIX = 'CUST';

    // ==================== 内部工具函数 ====================
    const Utils = {
        $(id) {
            return document.getElementById(id);
        },

        loadData(key, defaultValue = []) {
            try {
                const data = localStorage.getItem(key);
                if (data === null || data === undefined || data === '') return defaultValue;
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : defaultValue;
            } catch (e) {
                console.warn('[WorkbenchCRM] 数据读取失败:', e.message);
                return defaultValue;
            }
        },

        saveData(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error('[WorkbenchCRM] 数据保存失败:', e.message);
                return false;
            }
        },

        escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        generateId(prefix = 'item') {
            return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        },

        toast(message, type = 'info') {
            // 尝试使用全局 Utils.toast，否则使用简单 alert
            if (window.Utils && typeof window.Utils.toast === 'function') {
                window.Utils.toast(message, type);
            } else if (window.app && window.app.toast) {
                window.app.toast(message, type);
            } else {
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        },

        formatDate(dateStr) {
            if (!dateStr) return '未知';
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return '未知';
                return date.toLocaleDateString('zh-CN');
            } catch { return '未知'; }
        }
    };

    // ==================== 状态管理 ====================
    let customers = [];
    let editingId = null; // 当前正在编辑的客户ID

    // ==================== Firebase 同步辅助 ====================
    function syncToFirebase(data) {
        if (window.FirebaseModule && window.FirebaseModule.syncEnabled) {
            window.FirebaseModule.syncToCloud('customers', data);
        }
    }

    // ==================== 公开 API ====================
    return {
        /**
         * 初始化模块
         */
        init() {
            customers = Utils.loadData(STORAGE_KEY, []);
            console.log('[WorkbenchCRM] ✅ 初始化完成，已加载', customers.length, '个客户');
            return true;
        },

        /**
         * 获取所有客户数据
         */
        getAll() {
            return Utils.loadData(STORAGE_KEY, []);
        },

        /**
         * 根据ID获取单个客户
         */
        getById(id) {
            const customers = this.getAll();
            return customers.find(c => c.id === id) || null;
        },

        /**
         * 打开新增客户模态框
         */
        openAddModal() {
            editingId = null;
            this.resetForm();
            this.updateModalTitle('录入客户档案');
            this.updateSaveButtonText('保存档案');
            Utils.$('customer-modal')?.classList.remove('hidden');
            Utils.$('crm-name')?.focus();
        },

        /**
         * 打开编辑客户模态框
         * @param {string} id - 客户ID
         */
        openEditModal(id) {
            const customer = this.getById(id);
            if (!customer) {
                Utils.toast('客户不存在', 'error');
                return;
            }

            editingId = id;
            this.fillForm(customer);
            this.updateModalTitle('编辑客户档案');
            this.updateSaveButtonText('更新档案');
            Utils.$('customer-modal')?.classList.remove('hidden');
            Utils.$('crm-name')?.focus();
        },

        /**
         * 关闭模态框
         */
        closeModal() {
            Utils.$('customer-modal')?.classList.add('hidden');
            editingId = null;
            this.resetForm();
        },

        /**
         * 重置表单
         */
        resetForm() {
            const fields = ['crm-name', 'crm-contact', 'crm-whatsapp', 'crm-address'];
            fields.forEach(id => {
                const el = Utils.$(id);
                if (el) el.value = '';
            });
            // 重置国家选择框为默认值
            const countryEl = Utils.$('crm-country');
            if (countryEl) countryEl.value = 'Other';
        },

        /**
         * 填充表单数据（用于编辑）
         * @param {Object} customer - 客户对象
         */
        fillForm(customer) {
            const nameEl = Utils.$('crm-name');
            const contactEl = Utils.$('crm-contact');
            const countryEl = Utils.$('crm-country');
            const whatsappEl = Utils.$('crm-whatsapp');
            const addressEl = Utils.$('crm-address');

            if (nameEl) nameEl.value = customer.company || '';
            if (contactEl) contactEl.value = customer.contact || '';
            if (countryEl) countryEl.value = customer.country || 'Other';
            if (whatsappEl) whatsappEl.value = customer.whatsapp || '';
            if (addressEl) addressEl.value = customer.address || '';
        },

        /**
         * 更新模态框标题
         * @param {string} title - 标题文本
         */
        updateModalTitle(title) {
            const titleEl = Utils.$('crm-modal-title');
            if (titleEl) titleEl.textContent = title;
        },

        /**
         * 更新保存按钮文本
         * @param {string} text - 按钮文本
         */
        updateSaveButtonText(text) {
            const btn = Utils.$('crm-save-btn');
            if (btn) btn.textContent = text;
        },

        /**
         * 保存客户（新增或更新）
         */
        save() {
            const name = Utils.$('crm-name')?.value?.trim();
            if (!name) {
                Utils.toast('请输入客户公司名', 'warning');
                return;
            }

            const customerData = {
                company: name,
                contact: Utils.$('crm-contact')?.value?.trim() || '',
                country: Utils.$('crm-country')?.value || 'Other',
                whatsapp: Utils.$('crm-whatsapp')?.value?.trim() || '',
                address: Utils.$('crm-address')?.value?.trim() || ''
            };

            let customers = this.getAll();

            if (editingId) {
                // 更新现有客户
                const index = customers.findIndex(c => c.id === editingId);
                if (index !== -1) {
                    customers[index] = {
                        ...customers[index],
                        ...customerData,
                        updatedAt: new Date().toISOString()
                    };
                    Utils.toast('客户档案已更新', 'success');
                } else {
                    Utils.toast('客户不存在', 'error');
                    return;
                }
            } else {
                // 新增客户
                const newCustomer = {
                    id: Utils.generateId(ID_PREFIX),
                    ...customerData,
                    createdAt: new Date().toISOString()
                };
                customers.unshift(newCustomer);
                Utils.toast('客户档案已保存', 'success');
            }

            Utils.saveData(STORAGE_KEY, customers);
            syncToFirebase(customers);

            this.closeModal();
            this.render();
        },

        /**
         * 删除客户
         * @param {string} id - 客户ID
         */
        delete(id) {
            if (!confirm('确定删除此客户档案吗？此操作不可撤销。')) return;

            let customers = this.getAll();
            const originalLength = customers.length;
            customers = customers.filter(c => c.id !== id);

            if (customers.length === originalLength) {
                Utils.toast('客户不存在', 'error');
                return;
            }

            Utils.saveData(STORAGE_KEY, customers);
            syncToFirebase(customers);
            this.render();
            Utils.toast('客户档案已删除', 'success');
        },

        /**
         * 渲染客户列表
         */
        render() {
            const container = Utils.$('customer-grid');
            if (!container) return;

            const customers = this.getAll();

            if (customers.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12 text-gray-500">
                        <i class="fas fa-users text-4xl mb-4 opacity-30"></i>
                        <p>暂无客户档案</p>
                        <p class="text-sm mt-2 text-gray-600">点击"录入客户"添加第一个客户</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = customers.map(c => `
                <div class="glass rounded-xl p-5 hover:border-green-500/30 transition group">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-white truncate">${Utils.escapeHtml(c.company)}</h3>
                            <span class="text-xs text-gray-500">${Utils.escapeHtml(c.country || 'Other')}</span>
                        </div>
                        <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition ml-2">
                            <button onclick="WorkbenchCRM.openEditModal('${c.id}')" 
                                    class="text-gray-500 hover:text-blue-400 transition p-1" 
                                    title="编辑">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="WorkbenchCRM.delete('${c.id}')" 
                                    class="text-gray-500 hover:text-red-500 transition p-1" 
                                    title="删除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${c.contact ? `
                        <div class="text-sm text-gray-400 mb-1 flex items-center">
                            <i class="fas fa-user mr-2 w-4 text-center text-gray-500"></i>
                            <span class="truncate">${Utils.escapeHtml(c.contact)}</span>
                        </div>
                    ` : ''}
                    ${c.whatsapp ? `
                        <div class="text-sm text-gray-400 mb-1 flex items-center">
                            <i class="fab fa-whatsapp mr-2 w-4 text-center text-green-500"></i>
                            <span class="truncate">${Utils.escapeHtml(c.whatsapp)}</span>
                        </div>
                    ` : ''}
                    ${c.address ? `
                        <div class="text-sm text-gray-400 mb-1 flex items-center">
                            <i class="fas fa-map-marker-alt mr-2 w-4 text-center text-gray-500"></i>
                            <span class="truncate">${Utils.escapeHtml(c.address)}</span>
                        </div>
                    ` : ''}
                    <div class="mt-3 pt-3 border-t border-dark-4/50 flex justify-between items-center text-xs text-gray-600">
                        <span><i class="fas fa-clock mr-1"></i>${Utils.formatDate(c.createdAt)}</span>
                        ${c.updatedAt ? `<span class="text-gray-500">更新于 ${Utils.formatDate(c.updatedAt)}</span>` : ''}
                    </div>
                </div>
            `).join('');
        },

        /**
         * 搜索客户
         * @param {string} keyword - 搜索关键词
         * @returns {Array} 匹配的客户列表
         */
        search(keyword) {
            if (!keyword || !keyword.trim()) {
                return this.getAll();
            }

            const lowerKeyword = keyword.toLowerCase().trim();
            const customers = this.getAll();

            return customers.filter(c => 
                (c.company && c.company.toLowerCase().includes(lowerKeyword)) ||
                (c.contact && c.contact.toLowerCase().includes(lowerKeyword)) ||
                (c.whatsapp && c.whatsapp.toLowerCase().includes(lowerKeyword)) ||
                (c.country && c.country.toLowerCase().includes(lowerKeyword)) ||
                (c.address && c.address.toLowerCase().includes(lowerKeyword))
            );
        },

        /**
         * 获取客户统计信息
         * @returns {Object} 统计信息
         */
        getStats() {
            const customers = this.getAll();
            const countryStats = {};

            customers.forEach(c => {
                const country = c.country || 'Other';
                countryStats[country] = (countryStats[country] || 0) + 1;
            });

            return {
                total: customers.length,
                byCountry: countryStats,
                recentCount: customers.filter(c => {
                    if (!c.createdAt) return false;
                    const created = new Date(c.createdAt);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return created >= weekAgo;
                }).length
            };
        },

        /**
         * 导出客户数据
         * @returns {Array} 客户数据数组
         */
        exportData() {
            return this.getAll();
        },

        /**
         * 导入客户数据
         * @param {Array} data - 要导入的客户数据
         * @param {boolean} merge - 是否合并（true）或替换（false）
         * @returns {Object} 导入结果
         */
        importData(data, merge = true) {
            if (!Array.isArray(data)) {
                return { success: false, message: '数据格式错误' };
            }

            let customers = merge ? this.getAll() : [];
            const existingIds = new Set(customers.map(c => c.id));
            let imported = 0;
            let skipped = 0;

            data.forEach(item => {
                if (!item.company) {
                    skipped++;
                    return;
                }

                if (existingIds.has(item.id)) {
                    if (merge) {
                        // 合并模式下更新已存在的记录
                        const index = customers.findIndex(c => c.id === item.id);
                        if (index !== -1) {
                            customers[index] = { ...customers[index], ...item };
                        }
                    }
                    skipped++;
                } else {
                    customers.unshift({
                        id: item.id || Utils.generateId(ID_PREFIX),
                        company: item.company,
                        contact: item.contact || '',
                        country: item.country || 'Other',
                        whatsapp: item.whatsapp || '',
                        address: item.address || '',
                        createdAt: item.createdAt || new Date().toISOString()
                    });
                    imported++;
                }
            });

            Utils.saveData(STORAGE_KEY, customers);
            syncToFirebase(customers);
            this.render();

            return {
                success: true,
                message: `成功导入 ${imported} 条记录，跳过 ${skipped} 条`,
                imported,
                skipped
            };
        }
    };
})();

// 注册到全局
window.WorkbenchCRM = WorkbenchCRM;

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WorkbenchCRM.init());
} else {
    WorkbenchCRM.init();
}

console.log('[WorkbenchCRM] 模块已加载 v2.0.0');
