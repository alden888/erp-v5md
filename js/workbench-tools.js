/**
 * V14.6 PRO - 外贸工具箱模块
 * CBM计算器、汇率转换、运费估算、报价计算器
 * @namespace WorkbenchTools
 */
const WorkbenchTools = (() => {
    'use strict';

    // 默认汇率配置
    const DEFAULT_RATES = {
        USD: 6.89,
        EUR: 7.96,
        GBP: 9.18,
        JPY: 0.0432,
        AED: 1.86,
        TRY: 0.145
    };

    // 体积重系数
    const VOL_WEIGHT_FACTORS = {
        express: 5000,    // 快递 (DHL/FedEx/UPS)
        airCargo: 6000,   // 空运
        seaLCL: 1000,     // 海运拼箱 (per CBM)
        seaFCL: 1          // 海运整柜 (per container)
    };

    /**
     * 初始化工具箱模块
     */
    function init() {
        console.log('[Tools] 外贸工具箱模块初始化中...');
        bindEvents();
        loadSavedRates();
        console.log('[Tools] ✅ 外贸工具箱已初始化');
        return true;
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        // CBM 计算器
        const cbmBtn = document.getElementById('btn-calc-cbm');
        if (cbmBtn) {
            cbmBtn.addEventListener('click', calcCBM);
        }

        // 汇率计算器
        const rateBtn = document.getElementById('btn-calc-rate');
        if (rateBtn) {
            rateBtn.addEventListener('click', calcExchange);
        }

        // 报价计算器
        const quoteBtn = document.getElementById('btn-calc-quote');
        if (quoteBtn) {
            quoteBtn.addEventListener('click', calcQuote);
        }

        // 运费计算器
        const freightBtn = document.getElementById('btn-calc-freight');
        if (freightBtn) {
            freightBtn.addEventListener('click', calcFreight);
        }
    }

    /**
     * 加载保存的汇率
     */
    function loadSavedRates() {
        try {
            const settings = JSON.parse(localStorage.getItem('v5_erp_settings') || '{}');
            if (settings.rates) {
                Object.assign(DEFAULT_RATES, settings.rates);
            }
            // 更新汇率输入框
            const rateInput = document.getElementById('calc-rate');
            if (rateInput) {
                rateInput.value = settings.rate || DEFAULT_RATES.USD;
            }
        } catch (e) {
            console.warn('[Tools] 加载汇率失败:', e);
        }
    }

    /**
     * 📦 CBM 体积计算器
     */
    function calcCBM() {
        const l = parseFloat(document.getElementById('cbm-l')?.value) || 0;
        const w = parseFloat(document.getElementById('cbm-w')?.value) || 0;
        const h = parseFloat(document.getElementById('cbm-h')?.value) || 0;
        const qty = parseInt(document.getElementById('cbm-qty')?.value) || 1;

        if (l === 0 || w === 0 || h === 0) {
            showToast('请输入完整的长宽高尺寸', 'error');
            return;
        }

        // 单箱体积 (m³) = (cm * cm * cm) / 1,000,000
        const volOne = (l * w * h) / 1000000;
        const volTotal = volOne * qty;
        
        // 材积重 (快递标准 / 5000)
        const volWeightExpress = (l * w * h * qty) / VOL_WEIGHT_FACTORS.express;
        const volWeightAir = (l * w * h * qty) / VOL_WEIGHT_FACTORS.airCargo;

        // 显示结果
        const resultEl = document.getElementById('cbm-result');
        if (resultEl) {
            resultEl.classList.remove('hidden');
            document.getElementById('res-vol-one').textContent = volOne.toFixed(4) + ' m³';
            document.getElementById('res-vol-total').textContent = volTotal.toFixed(3) + ' m³';
            document.getElementById('res-weight-express').textContent = volWeightExpress.toFixed(2) + ' kg';
            document.getElementById('res-weight-air').textContent = volWeightAir.toFixed(2) + ' kg';
        }

        // 同时更新简洁显示
        const simpleResult = document.getElementById('cbm-simple-result');
        if (simpleResult) {
            simpleResult.innerHTML = `
                <div class="text-center">
                    <div class="text-3xl font-bold text-green-400 font-mono">${volTotal.toFixed(3)}</div>
                    <div class="text-xs text-gray-500 mt-1">Total CBM (m³)</div>
                </div>
            `;
        }

        console.log('[Tools] CBM计算:', { l, w, h, qty, volOne, volTotal, volWeightExpress });
        return { volOne, volTotal, volWeightExpress, volWeightAir };
    }

    /**
     * 💱 汇率转换计算器
     */
    function calcExchange() {
        const amount = parseFloat(document.getElementById('exchange-amount')?.value) || 0;
        const fromCurrency = document.getElementById('exchange-from')?.value || 'USD';
        const toCurrency = document.getElementById('exchange-to')?.value || 'CNY';
        const customRate = parseFloat(document.getElementById('exchange-rate')?.value) || 0;

        if (amount === 0) {
            showToast('请输入金额', 'error');
            return;
        }

        let result;
        let rateUsed;

        if (toCurrency === 'CNY') {
            // 外币转人民币
            rateUsed = customRate || DEFAULT_RATES[fromCurrency] || 1;
            result = amount * rateUsed;
        } else if (fromCurrency === 'CNY') {
            // 人民币转外币
            rateUsed = customRate || DEFAULT_RATES[toCurrency] || 1;
            result = amount / rateUsed;
        } else {
            // 外币对外币 (通过CNY中转)
            const fromRate = DEFAULT_RATES[fromCurrency] || 1;
            const toRate = DEFAULT_RATES[toCurrency] || 1;
            result = (amount * fromRate) / toRate;
            rateUsed = fromRate / toRate;
        }

        // 显示结果
        const resultEl = document.getElementById('exchange-result');
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `
                <div class="text-center p-4 bg-dark-2 rounded-lg">
                    <div class="text-sm text-gray-400 mb-2">${amount.toLocaleString()} ${fromCurrency} =</div>
                    <div class="text-3xl font-bold text-blue-400 font-mono">
                        ${toCurrency === 'CNY' ? '¥' : ''}${result.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        ${toCurrency !== 'CNY' ? toCurrency : ''}
                    </div>
                    <div class="text-xs text-gray-500 mt-2">汇率: ${rateUsed.toFixed(4)}</div>
                </div>
            `;
        }

        console.log('[Tools] 汇率转换:', { amount, fromCurrency, toCurrency, result, rateUsed });
        return { result, rateUsed };
    }

    /**
     * 📝 报价计算器 (成本 + 利润率)
     */
    function calcQuote() {
        const cost = parseFloat(document.getElementById('quote-cost')?.value) || 0;
        const margin = parseFloat(document.getElementById('quote-margin')?.value) || 30;
        const qty = parseInt(document.getElementById('quote-qty')?.value) || 1;
        const exchangeRate = parseFloat(document.getElementById('quote-rate')?.value) || DEFAULT_RATES.USD;

        if (cost === 0) {
            showToast('请输入成本价', 'error');
            return;
        }

        // 计算
        const unitPriceCNY = cost * (1 + margin / 100);
        const unitPriceUSD = unitPriceCNY / exchangeRate;
        const totalCNY = unitPriceCNY * qty;
        const totalUSD = unitPriceUSD * qty;
        const profit = totalCNY - (cost * qty);

        // 显示结果
        const resultEl = document.getElementById('quote-result');
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div class="p-3 bg-dark-2 rounded-lg">
                        <div class="text-gray-500 text-xs mb-1">单价 (CNY)</div>
                        <div class="text-xl font-bold text-yellow-400">¥${unitPriceCNY.toFixed(2)}</div>
                    </div>
                    <div class="p-3 bg-dark-2 rounded-lg">
                        <div class="text-gray-500 text-xs mb-1">单价 (USD)</div>
                        <div class="text-xl font-bold text-green-400">$${unitPriceUSD.toFixed(2)}</div>
                    </div>
                    <div class="p-3 bg-dark-2 rounded-lg">
                        <div class="text-gray-500 text-xs mb-1">总价 (${qty}件)</div>
                        <div class="text-lg font-bold text-blue-400">$${totalUSD.toFixed(2)}</div>
                    </div>
                    <div class="p-3 bg-dark-2 rounded-lg">
                        <div class="text-gray-500 text-xs mb-1">预计利润</div>
                        <div class="text-lg font-bold text-purple-400">¥${profit.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }

        console.log('[Tools] 报价计算:', { cost, margin, unitPriceCNY, unitPriceUSD, totalUSD, profit });
        return { unitPriceCNY, unitPriceUSD, totalCNY, totalUSD, profit };
    }

    /**
     * 🚢 运费估算计算器
     */
    function calcFreight() {
        const cbm = parseFloat(document.getElementById('freight-cbm')?.value) || 0;
        const weight = parseFloat(document.getElementById('freight-weight')?.value) || 0;
        const mode = document.getElementById('freight-mode')?.value || 'seaLCL';

        if (cbm === 0 && weight === 0) {
            showToast('请输入体积或重量', 'error');
            return;
        }

        // 运费估算 (简化版，实际需要查询实时运价)
        const rates = {
            express: { perKg: 45, min: 21 },      // 快递 ¥/kg
            airCargo: { perKg: 28, min: 45 },     // 空运 ¥/kg
            seaLCL: { perCBM: 350, min: 1 },      // 海运拼箱 ¥/CBM
            seaFCL20: { flat: 8500 },             // 20尺柜 ¥
            seaFCL40: { flat: 12000 },            // 40尺柜 ¥
            seaFCL40HQ: { flat: 13500 }           // 40尺高柜 ¥
        };

        let estimate = 0;
        let chargeWeight = weight;

        switch (mode) {
            case 'express':
                // 取实重和体积重的大者
                const volWeightExp = cbm * 1000000 / VOL_WEIGHT_FACTORS.express;
                chargeWeight = Math.max(weight, volWeightExp);
                estimate = Math.max(chargeWeight * rates.express.perKg, rates.express.min * rates.express.perKg);
                break;
            case 'airCargo':
                const volWeightAir = cbm * 1000000 / VOL_WEIGHT_FACTORS.airCargo;
                chargeWeight = Math.max(weight, volWeightAir);
                estimate = Math.max(chargeWeight * rates.airCargo.perKg, rates.airCargo.min * rates.airCargo.perKg);
                break;
            case 'seaLCL':
                estimate = Math.max(cbm * rates.seaLCL.perCBM, rates.seaLCL.min * rates.seaLCL.perCBM);
                break;
            case 'seaFCL20':
                estimate = rates.seaFCL20.flat;
                break;
            case 'seaFCL40':
                estimate = rates.seaFCL40.flat;
                break;
            case 'seaFCL40HQ':
                estimate = rates.seaFCL40HQ.flat;
                break;
        }

        // 显示结果
        const resultEl = document.getElementById('freight-result');
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `
                <div class="p-4 bg-dark-2 rounded-lg text-center">
                    <div class="text-sm text-gray-400 mb-2">运费估算</div>
                    <div class="text-3xl font-bold text-orange-400 font-mono">¥${estimate.toFixed(0)}</div>
                    ${['express', 'airCargo'].includes(mode) ? 
                        `<div class="text-xs text-gray-500 mt-2">计费重: ${chargeWeight.toFixed(1)} kg</div>` : 
                        `<div class="text-xs text-gray-500 mt-2">体积: ${cbm.toFixed(3)} CBM</div>`
                    }
                    <div class="text-[10px] text-gray-600 mt-1">* 仅供参考，实际以货代报价为准</div>
                </div>
            `;
        }

        console.log('[Tools] 运费估算:', { cbm, weight, mode, chargeWeight, estimate });
        return { estimate, chargeWeight };
    }

    /**
     * 快速计算 FOB/CIF 价格
     */
    function calcFOB(exwPrice, inlandFreight = 500) {
        return exwPrice + inlandFreight;
    }

    function calcCIF(fobPrice, oceanFreight, insurance = 0) {
        const ins = insurance || fobPrice * 0.003; // 默认0.3%保险
        return fobPrice + oceanFreight + ins;
    }

    /**
     * 显示提示
     */
    function showToast(message, type = 'info') {
        if (window.WorkbenchUtils && WorkbenchUtils.toast) {
            WorkbenchUtils.toast(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * 重置所有计算器
     */
    function resetAll() {
        // 重置CBM
        ['cbm-l', 'cbm-w', 'cbm-h'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const cbmQty = document.getElementById('cbm-qty');
        if (cbmQty) cbmQty.value = '1';
        
        // 隐藏结果
        ['cbm-result', 'exchange-result', 'quote-result', 'freight-result'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        showToast('已重置所有计算器', 'success');
    }

    /**
     * 导出计算结果
     */
    function exportResults() {
        // 收集所有计算结果
        const results = {
            timestamp: new Date().toISOString(),
            cbm: calcCBM(),
            exchange: calcExchange(),
            quote: calcQuote(),
            freight: calcFreight()
        };

        // 复制到剪贴板
        const text = JSON.stringify(results, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            showToast('计算结果已复制到剪贴板', 'success');
        }).catch(() => {
            console.log(text);
            showToast('请查看控制台获取结果', 'info');
        });

        return results;
    }

    // 公共API
    return {
        init,
        calcCBM,
        calcExchange,
        calcQuote,
        calcFreight,
        calcFOB,
        calcCIF,
        resetAll,
        exportResults,
        // 暴露配置
        rates: DEFAULT_RATES,
        volWeightFactors: VOL_WEIGHT_FACTORS
    };
})();

// 挂载到全局
window.WorkbenchTools = WorkbenchTools;

console.log('[Tools] 外贸工具箱模块已加载 (V14.6)');
