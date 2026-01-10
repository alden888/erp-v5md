#!/bin/bash
# V14.0 ERP Modular Refactoring - Verification Script

echo "========================================="
echo "V14.0 ERP - 模块化重构验证"
echo "========================================="
echo ""

# Check file structure
echo "📁 文件结构检查:"
echo "-------------------"

files=(
    "index.html"
    "css/workbench-v14.css"
    "js/workbench-config.js"
    "js/workbench-storage.js"
    "js/workbench-auth.js"
    "js/workbench-dashboard.js"
    "js/workbench-orders.js"
    "js/workbench-suppliers.js"
    "js/workbench-finance.js"
    "js/workbench-utils.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        size=$(du -h "$file" | cut -f1)
        echo "✅ $file ($lines lines, $size)"
    else
        echo "❌ $file - NOT FOUND!"
    fi
done

echo ""
echo "📊 代码统计:"
echo "-------------------"
total_html=$(wc -l < index.html)
total_css=$(wc -l < css/workbench-v14.css)
total_js=$(cat js/*.js | wc -l)
total_all=$((total_html + total_css + total_js))

echo "HTML: $total_html lines"
echo "CSS: $total_css lines"
echo "JavaScript: $total_js lines (across 8 modules)"
echo "Total: $total_all lines"
echo ""
echo "📉 Token优化:"
original=2773
optimized=$total_html
reduction=$(( (original - optimized) * 100 / original ))
echo "原始HTML: $original lines"
echo "优化后HTML: $optimized lines"
echo "减少: ${reduction}% ✅"
echo ""

# Check critical fixes
echo "🔥 关键修复验证:"
echo "-------------------"

# Check survival mode fix
if grep -q "survival-hidden" css/workbench-v14.css; then
    echo "✅ 生存模式解锁修复: .survival-hidden CSS类已在CSS文件中定义"
else
    echo "❌ 生存模式解锁修复: .survival-hidden CSS类缺失"
fi

if grep -q "deactivateCriticalMode" js/workbench-dashboard.js; then
    echo "✅ deactivateCriticalMode函数存在"
else
    echo "❌ deactivateCriticalMode函数缺失"
fi

if grep -q "classList.remove('survival-hidden')" js/workbench-dashboard.js; then
    echo "✅ 解锁逻辑: 正确移除.survival-hidden类"
else
    echo "⚠️  解锁逻辑: 未找到移除.survival-hidden类的代码"
fi

# Check suppliers fix
if grep -q "showSuppliers" js/workbench-suppliers.js; then
    echo "✅ 供应商Tab修复: showSuppliers函数存在"
else
    echo "❌ 供应商Tab修复: showSuppliers函数缺失"
fi

# Check config
if grep -q "China" js/workbench-config.js; then
    echo "✅ 国家列表配置: China已包含"
else
    echo "❌ 国家列表配置: China缺失"
fi

if grep -q "Turkey" js/workbench-config.js; then
    echo "✅ 国家列表配置: Turkey已包含"
else
    echo "❌ 国家列表配置: Turkey缺失"
fi

if grep -q "Philippines" js/workbench-config.js; then
    echo "✅ 国家列表配置: Philippines已包含"
else
    echo "❌ 国家列表配置: Philippines缺失"
fi

if grep -q "Netherlands" js/workbench-config.js; then
    echo "✅ 国家列表配置: Netherlands已包含"
else
    echo "❌ 国家列表配置: Netherlands缺失"
fi

if grep -q "USA" js/workbench-config.js; then
    echo "✅ 国家列表配置: USA已包含"
else
    echo "❌ 国家列表配置: USA缺失"
fi

if grep -q "UK" js/workbench-config.js; then
    echo "✅ 国家列表配置: UK已包含"
else
    echo "❌ 国家列表配置: UK缺失"
fi

if grep -q "Germany" js/workbench-config.js; then
    echo "✅ 国家列表配置: Germany已包含"
else
    echo "❌ 国家列表配置: Germany缺失"
fi

if grep -q "USE_CLOUD: true" js/workbench-storage.js; then
    echo "✅ 云端存储配置: USE_CLOUD默认为true"
else
    echo "❌ 云端存储配置: USE_CLOUD未正确设置"
fi

if grep -q "WORKER_URL" js/workbench-storage.js; then
    echo "✅ 云端存储配置: WORKER_URL可配置"
else
    echo "❌ 云端存储配置: WORKER_URL缺失"
fi

echo ""
echo "========================================="
echo "验证完成! V14.0 ERP Modular Refactoring"
echo "========================================="
