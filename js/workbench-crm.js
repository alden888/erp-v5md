/**
 * V15.2 CRM Module (Combat Survival Edition)
 * 生存优先级 > 美观
 * P0 客户 = 现金氧气
 */

const WorkbenchCRM = {
    init() {
        console.log('[CRM] Initializing Combat CRM V15.2...');
        this.render();
    },

    async render() {
        const container = document.getElementById('customer-grid');
        if (!container) return;

        const key = window.WorkbenchConfig.STORAGE_KEYS.CUSTOMERS;
        const customers = (await window.WorkbenchStorage.load(key, []))
            .sort((a, b) => {
                const pa = a.priority || 'P2';
                const pb = b.priority || 'P2';
                if (pa !== pb) return pa.localeCompare(pb);
                return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
            });

        if (customers.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-16 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                    <i class="fas fa-crosshairs text-4xl mb-4 opacity-30"></i>
                    <p class="mb-2">暂无作战目标</p>
                    <button onclick="WorkbenchCRM.openAddModal()" class="text-indigo-400 underline">
                        立即建立第一个生存目标
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = customers.map(c => {
            const priority = c.priority || 'P2';
            const isP0 = priority === 'P0';

            const lastUpdateHours = c.updatedAt
                ? Math.floor((Date.now() - new Date(c.updatedAt)) / 36e5)
                : null;

            const danger = isP0 && lastUpdateHours !== null && lastUpdateHours > 72;

            const borderClass = danger
                ? 'border-red-700 shadow-[0_0_20px_rgba(220,38,38,0.45)]'
                : isP0
                    ? 'border-red-600 shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                    : 'border-gray-800 hover:border-gray-600';

            const priorityBadge = isP0
                ? `<span class="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold animate-pulse">
                        P0 生死
                   </span>`
                : `<span class="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded">${priority}</span>`;

            return `
            <div class="bg-gray-900 border ${borderClass} p-5 rounded-xl transition relative group">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            ${priorityBadge}
                            <span class="text-[10px] text-blue-400 border border-blue-900 px-1 rounded">
                                ${c.legalEntity || 'V5'}
                            </span>
                        </div>
                        <h3 class="font-bold text-lg text-white">${this.escape(c.company)}</h3>
                        ${c.nextAction ? `
                            <div class="text-[11px] text-yellow-400 mt-1">
                                ▶ 下一步：${this.escape(c.nextAction)}
                            </div>` : ''}
                    </div>
                    <span class="text-xs text-gray-500">${c.country || ''}</span>
                </div>

                <div class="text-sm text-gray-400 space-y-1.5">
                    <div><i class="fas fa-user w-4 opacity-50"></i> ${this.escape(c.contact || '-')}</div>
                    <div><i class="fab fa-whatsapp w-4 text-green-500"></i> ${this.escape(c.whatsapp || '-')}</div>
                    ${c.expectedAmount ? `
                        <div class="text-green-400 font-mono">
                            💰 ${c.expectedAmount} ${c.currency || 'USD'}
                        </div>` : ''}
                </div>

                <div class="text-[10px] text-gray-500 mt-3">
                    ${lastUpdateHours !== null ? `⏱ ${lastUpdateHours}h 未更新` : '⏱ 新目标'}
                </div>

                <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button onclick="WorkbenchCRM.openEditModal('${c.id}')" class="text-gray-400 hover:text-white">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="WorkbenchCRM.delete('${c.id}')" class="text-gray-400 hover:text-red-500">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    },

    openAddModal() {
        this.resetForm();
        document.getElementById('modal-title').innerText = "录入作战目标";
        document.getElementById('customer-modal')?.classList.remove('hidden');
    },

    async openEditModal(id) {
        const key = window.WorkbenchConfig.STORAGE_KEYS.CUSTOMERS;
        const customers = await window.WorkbenchStorage.load(key, []);
        const c = customers.find(x => x.id === id);
        if (!c) return;

        const map = {
            'crm-id': c.id,
            'crm-name': c.company,
            'crm-contact': c.contact,
            'crm-country': c.country,
            'crm-whatsapp': c.whatsapp,
            'crm-address': c.address,
            'crm-priority': c.priority || 'P2',
            'crm-entity': c.legalEntity || 'V5 Medical (CN)',
            'crm-next': c.nextAction || '',
            'crm-amount': c.expectedAmount || '',
            'crm-currency': c.currency || 'USD'
        };

        Object.entries(map).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        });

        document.getElementById('modal-title').innerText = "编辑作战档案";
        document.getElementById('customer-modal')?.classList.remove('hidden');
    },

    resetForm() {
        ['crm-id','crm-name','crm-contact','crm-whatsapp','crm-address','crm-next','crm-amount']
            .forEach(id => document.getElementById(id).value = '');
        document.getElementById('crm-country').value = 'Philippines';
        document.getElementById('crm-priority').value = 'P2';
        document.getElementById('crm-entity').value = 'V5 Medical (CN)';
        document.getElementById('crm-currency').value = 'USD';
    },

    async save() {
        const name = document.getElementById('crm-name').value;
        if (!name) return alert('公司名称必填');

        const key = window.WorkbenchConfig.STORAGE_KEYS.CUSTOMERS;
        let customers = await window.WorkbenchStorage.load(key, []);

        const id = document.getElementById('crm-id').value || 'CUST-' + Date.now();

        const data = {
            id,
            company: name,
            contact: document.getElementById('crm-contact').value,
            country: document.getElementById('crm-country').value,
            whatsapp: document.getElementById('crm-whatsapp').value,
            address: document.getElementById('crm-address').value,
            priority: document.getElementById('crm-priority').value,
            legalEntity: document.getElementById('crm-entity').value,
            nextAction: document.getElementById('crm-next').value,
            expectedAmount: document.getElementById('crm-amount').value,
            currency: document.getElementById('crm-currency').value,
            updatedAt: new Date().toISOString(),
            createdAt: customers.find(c => c.id === id)?.createdAt || new Date().toISOString()
        };

        customers = customers.filter(c => c.id !== id);
        customers.push(data);

        await window.WorkbenchStorage.save(key, customers);
        this.closeModal();
        this.render();
        window.WorkbenchUtils?.toast('作战档案已更新', 'success');
    },

    async delete(id) {
        if (!confirm('删除该目标？')) return;
        const key = window.WorkbenchConfig.STORAGE_KEYS.CUSTOMERS;
        let list = await window.WorkbenchStorage.load(key, []);
        list = list.filter(c => c.id !== id);
        await window.WorkbenchStorage.save(key, list);
        this.render();
    },

    closeModal() {
        document.getElementById('customer-modal')?.classList.add('hidden');
    },

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
};

window.WorkbenchCRM = WorkbenchCRM;
