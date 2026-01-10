#!/bin/bash

# V14.2 PRO - 部署检查脚本
# 用于验证文件完整性和配置正确性

echo "========================================="
echo "V14.2 PRO - 部署检查工具"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASS=0
FAIL=0
WARN=0

# 检查函数
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌${NC} $1 - 文件不存在"
        ((FAIL++))
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} $1/"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌${NC} $1/ - 目录不存在"
        ((FAIL++))
        return 1
    fi
}

# 1. 检查目录结构
echo "📁 检查目录结构..."
echo "-------------------"
check_dir "workbench"
check_dir "workbench/css"
check_dir "workbench/js"
echo ""

# 2. 检查核心文件
echo "📄 检查核心文件..."
echo "-------------------"
cd workbench 2>/dev/null || { echo "错误: workbench 目录不存在"; exit 1; }

check_file "index.html"
check_file "diagnostic.html"
check_file "_headers"
check_file "_redirects"
echo ""

# 3. 检查 CSS 文件
echo "🎨 检查 CSS 文件..."
echo "-------------------"
check_file "css/workbench-v14.css"
echo ""

# 4. 检查 JS 模块
echo "⚙️ 检查 JS 模块..."
echo "-------------------"
check_file "js/workbench-app.js"
check_file "js/workbench-config.js"
check_file "js/workbench-utils.js"
check_file "js/workbench-modal.js"
check_file "js/workbench-state.js"
check_file "js/workbench-storage.js"
check_file "js/workbench-auth.js"
check_file "js/workbench-firebase.js"
check_file "js/workbench-dashboard.js"
check_file "js/workbench-orders.js"
check_file "js/workbench-suppliers.js"
check_file "js/workbench-finance.js"
check_file "js/workbench-expenses.js"
check_file "js/workbench-crm.js"
echo ""

# 5. 检查文件语法
echo "🔍 检查文件内容..."
echo "-------------------"

# 检查 index.html 是否包含关键标记
if grep -q "workbench-app.js" index.html; then
    echo -e "${GREEN}✅${NC} index.html - 包含 workbench-app.js 引用"
    ((PASS++))
else
    echo -e "${RED}❌${NC} index.html - 缺少 workbench-app.js 引用"
    ((FAIL++))
fi

# 检查 _headers 文件格式
if grep -q "Content-Type: application/javascript" _headers; then
    echo -e "${GREEN}✅${NC} _headers - MIME 类型配置正确"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️${NC} _headers - MIME 类型配置可能不正确"
    ((WARN++))
fi

# 检查 Firebase 配置
if grep -q "v5merp" js/workbench-firebase.js; then
    echo -e "${GREEN}✅${NC} Firebase - 配置已更新"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️${NC} Firebase - 使用默认配置（需要更新）"
    ((WARN++))
fi

echo ""

# 6. 文件大小检查
echo "📊 文件大小统计..."
echo "-------------------"
if command -v du &> /dev/null; then
    total_size=$(du -sh . | cut -f1)
    js_size=$(du -sh js/ 2>/dev/null | cut -f1)
    css_size=$(du -sh css/ 2>/dev/null | cut -f1)
    
    echo "总大小: $total_size"
    echo "JS 文件: $js_size"
    echo "CSS 文件: $css_size"
fi
echo ""

# 7. 生成报告
echo "========================================="
echo "检查报告"
echo "========================================="
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${YELLOW}警告: $WARN${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ 所有关键检查通过！可以部署到 Cloudflare Pages。${NC}"
    echo ""
    echo "下一步操作:"
    echo "1. git add ."
    echo "2. git commit -m '部署 V14.2 PRO'"
    echo "3. git push origin main"
    echo "4. 在 Cloudflare Pages 中检查部署状态"
    exit 0
else
    echo -e "${RED}❌ 发现 $FAIL 个问题，请修复后再部署。${NC}"
    echo ""
    echo "建议操作:"
    echo "1. 检查缺失的文件"
    echo "2. 确保所有 JS 模块都已复制到 js/ 文件夹"
    echo "3. 再次运行此脚本验证"
    exit 1
fi
