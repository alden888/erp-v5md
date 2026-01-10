/**
 * V14.2 Suppliers Module (Optimized)
 * 供应商管理 - 适配 v5_erp_ 键名与静态 DOM 结构
 */
const WorkbenchSuppliers = {
    // 初始化
    init() {
        console.log('[Suppliers] Initializing module...');
        this.render();
    },

    // 渲染供应商列表
    async render() {
        // 1. 获取容器 (对应 index.html 中的 ID)
        const container = document.getElementById('supplierList');
        if (!container) {
            console.warn('[Suppliers] Container #supplierList not found');
            return;
        }

        // 2. 读取数据 (使用统一配置键名 v5_erp_suppliers)
        const key = window.WorkbenchConfig.STORAGE_KEYS.SUPPLIERS;
        const suppliers = await window.WorkbenchStorage.load(key, []);

        // 3. 空状态处理
        if (!suppliers || suppliers.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                    <i class="fas fa-industry text-4xl mb-4 opacity-30"></i>
                    <p>暂无供应商档案</p>
                    <button onclick="WorkbenchSuppliers.openAddModal()" class="mt-2 text-indigo-400 hover:text-indigo-300 underline text-sm">
                        立即添加
                    </button>
                </div>`;
            return;
        }

        // 4. 渲染卡片
        container.innerHTML = suppliers.map(s => `
            <div class="bg-gray-900 border border-gray-800 p-5 rounded-xl hover:border-indigo-500 transition group relative">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-bold text-lg text-white">${this.escape(s.name)}</h3>
                        <span class="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 mt-1 inline-block">
                            ${this.escape(s.product || '综合类')}
                        </span>
                    </div>
                </div>
                
                <div class="text-sm text-gray-400 space-y-2">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-user w-4 text-center opacity-50"></i>
                        <span>${this.escape(s.contact || '-')}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <i class="fas fa-phone w-4 text-center opacity-50"></i>
                        <span class="font-mono">${this.escape(s.phone || '-')}</span>
                    </div>
                </div>

                <button onclick="WorkbenchSuppliers.delete('${s.id}')" 
                    class="absolute top-4 right-4 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-2">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    // 打开模态框 (直接操作 index.html 里的静态弹窗)
    openAddModal() {
        const modal = document.getElementById('supplier-modal');
        if (modal) modal.classList.remove('hidden');
        // 聚焦输入框
        setTimeout(() => document.getElementById('supp-name')?.focus(), 100);
    },

    // 关闭模态框
    closeModal() {
        const modal = document.getElementById('supplier-modal');
        if (modal) modal.classList.add('hidden');
    },

    // 保存供应商
    async save() {
        // 1. 获取 DOM 元素 (适配 index.html 里的 ID)
        const nameInput = document.getElementById('supp-name');
        const productInput = document.getElementById('supp-product');
        const contactInput = document.getElementById('supp-contact');

        // 2. 验证
        if (!nameInput || !nameInput.value.trim()) {
            alert('请输入供应商名称');
            return;
        }

        // 3. 构建对象
        const newSupplier = {
            id: 'SUP-' + Date.now(),
            name: nameInput.value.trim(),
            product: productInput ? productInput.value.trim() : '',
            contact: contactInput ? contactInput.value.trim() : '',
            createdAt: new Date().toISOString()
        };

        // 4. 读取旧数据 -> 追加 -> 保存
        const key = window.WorkbenchConfig.STORAGE_KEYS.SUPPLIERS;
        const suppliers = await window.WorkbenchStorage.load(key, []);
        suppliers.unshift(newSupplier); // 新增的排最前
        await window.WorkbenchStorage.save(key, suppliers);

        // 5. 清理现场
        nameInput.value = '';
        if(productInput) productInput.value = '';
        if(contactInput) contactInput.value = '';
        
        this.closeModal();
        this.render();
        
        // 6. 提示
        if(window.WorkbenchUtils) window.WorkbenchUtils.toast('供应商已添加', 'success');
    },

    // 删除供应商
    async delete(id) {
        if(!confirm('确定删除该供应商档案吗？')) return;
        
        const key = window.WorkbenchConfig.STORAGE_KEYS.SUPPLIERS;
        let suppliers = await window.WorkbenchStorage.load(key, []);
        suppliers = suppliers.filter(s => s.id !== id);
        
        await window.WorkbenchStorage.save(key, suppliers);
        this.render();
        
        if(window.WorkbenchUtils) window.WorkbenchUtils.toast('已删除', 'success');
    },

    // XSS 防护辅助函数
    escape(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }
};

// 🔥 核心：挂载到全局 Window 对象
window.WorkbenchSuppliers = WorkbenchSuppliers;
