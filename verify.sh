#!/bin/bash
# V14.7 SURVIVAL 部署验证脚本

echo "🔍 V14.7 SURVIVAL 部署验证"
echo "=========================="

# 检查必要文件
files=(
    "index.html"
    "js/workbench-dashboard.js"
    "js/workbench-crm.js"
)

all_ok=true

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file 缺失!"
        all_ok=false
    fi
done

echo ""

# 检查 index.html 中的脚本引用
if grep -q 'src="js/workbench-dashboard.js"' index.html; then
    echo "✅ index.html 已引用 workbench-dashboard.js"
else
    echo "❌ index.html 未引用 workbench-dashboard.js"
    all_ok=false
fi

if grep -q 'src="js/workbench-crm.js"' index.html; then
    echo "✅ index.html 已引用 workbench-crm.js"
else
    echo "❌ index.html 未引用 workbench-crm.js"
    all_ok=false
fi

# 检查版本
if grep -q "V14.7" index.html; then
    echo "✅ 版本号已更新为 V14.7"
else
    echo "⚠️  版本号未更新"
fi

# 检查 P0 指标 HTML
if grep -q "kpi-p0-count" index.html; then
    echo "✅ P0 生存指标 HTML 已添加"
else
    echo "❌ P0 生存指标 HTML 缺失"
    all_ok=false
fi

# 检查作战字段
if grep -q "crm-priority" index.html; then
    echo "✅ CRM 作战字段 HTML 已添加"
else
    echo "❌ CRM 作战字段 HTML 缺失"
    all_ok=false
fi

echo ""
echo "=========================="
if [ "$all_ok" = true ]; then
    echo "🎉 所有检查通过！可以部署到 Cloudflare"
else
    echo "⚠️  存在问题，请检查上述错误"
fi
