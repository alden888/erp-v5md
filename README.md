# V5 Medical ERP Pro

> 专业的医疗器械企业管理系统 - 订单、客户、财务一体化解决方案

[![Version](https://img.shields.io/badge/Version-2.0.0-blue)]()
[![Firebase](https://img.shields.io/badge/Firebase-Cloud%20Sync-orange)]()
[![License](https://img.shields.io/badge/License-Private-red)]()

---

## 🎉 V2.0 重大更新

**ERP Pro V2.0** 已发布！基于 V1.0 经典设计全面升级，带来更专业、更便捷、更可靠的企业管理体验。

### ✨ 新特性

- 🎨 **全新界面** - 浅色专业主题，KPI 卡片式仪表盘
- ☁️ **云同步** - Firebase Firestore 实时数据同步
- 💾 **数据管理** - JSON 导入导出，本地+云端双备份
- 🌍 **世界时钟** - 全球 6 个主要城市商机时间
- 📱 **响应式设计** - 完美适配桌面和移动设备

---

## 📂 文件说明

| 文件 | 说明 |
|------|------|
| `index.html` | **主入口** - ERP Pro V2.0 版本 |
| `index-v2.html` | V2.0 版本副本 |
| `index-old.html` | V14.7 SURVIVAL 原版备份 |
| `js/*.js` | 模块化后端组件 |

---

## 🚀 快速开始

### 在线访问
```
https://你的域名.com/erp-v5md/
```

### 本地开发
```bash
git clone https://github.com/alden888/erp-v5md.git
cd erp-v5md

# 使用 Python 启动本地服务器
python3 -m http.server 8000

# 访问 http://localhost:8000
```

---

## 📊 功能模块

### 1. 战报仪表盘
- 年度达成率实时显示
- 已回款金额（RMB/USD）
- 距离目标差额
- 待回款 Pipeline
- 每日需进账计算

### 2. 订单管理
- 订单列表（状态、筛选）
- 订单创建/编辑/删除
- 多币种支持
- PI 生成工具

### 3. 客户管理
- 客户信息维护
- 跟进记录
- 分级管理

### 4. 供应商管理
- 供应商档案
- 采购记录
- 价格追踪

### 5. 财务中心
- 收支明细
- 财务报表
- 汇率换算

### 6. 支出管理
- 日常支出记录
- 分类统计
- 预算控制

### 7. 报价工具
- FOB 价格计算
- 退税计算
- 利润率分析

---

## ☁️ 云同步配置

### Firebase 设置

1. 创建 Firebase 项目：https://console.firebase.google.com
2. 启用 Firestore 数据库
3. 复制配置到代码中：

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

4. 设置 Firestore 安全规则：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 💾 数据备份与恢复

### 导出数据
1. 点击侧边栏 "数据安全" → "导出备份"
2. 下载 JSON 格式备份文件
3. 备份包含：订单、客户、供应商、支出、设置

### 导入数据
1. 点击侧边栏 "数据安全" → "导入恢复"
2. 选择之前导出的 JSON 文件
3. 系统自动合并数据

### 自动同步
- 在线时自动同步到 Firebase
- 离线时保存到本地，恢复后自动同步
- 每 5 分钟自动检查同步

---

## 🔧 核心技术

### 前端技术栈
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Font Awesome** - 图标库
- **Chart.js** - 数据可视化
- **原生 JavaScript** - 无框架依赖

### 后端服务
- **Firebase Firestore** - NoSQL 云数据库
- **Firebase Auth** - 用户认证（预留）
- **LocalStorage** - 本地数据持久化

---

## 📋 系统需求

- 现代浏览器（Chrome、Firefox、Safari、Edge）
- 支持 localStorage
- 网络连接（用于云同步）

---

## 🛡️ 数据安全

1. **本地存储加密** - 敏感数据建议启用加密
2. **Firebase 安全规则** - 控制数据访问权限
3. **定期备份** - 建议每周导出备份
4. **HTTPS 传输** - 生产环境强制 HTTPS

---

## 🐛 故障排除

### 数据无法保存
1. 检查浏览器 localStorage 是否开启
2. 清除浏览器缓存后重试
3. 检查控制台错误信息

### 云同步失败
1. 检查网络连接
2. 验证 Firebase 配置是否正确
3. 查看 Firestore 安全规则

### 页面显示异常
1. 强制刷新页面（Ctrl+F5）
2. 检查浏览器控制台错误
3. 尝试隐身模式访问

---

## 📝 更新日志

### v2.0.0 (2025-03-23)
- ✨ 全新 UI 设计（基于 V1.0 优化）
- ☁️ Firebase 云同步功能
- 💾 数据导入导出功能
- 🌍 世界时钟功能
- 📱 响应式布局优化

### v1.x (历史版本)
- 原始 V14.7 SURVIVAL 版本功能
- 本地存储管理
- 基础订单/客户/财务管理

---

## 🤝 技术支持

- 项目地址：https://github.com/alden888/erp-v5md
- 问题反馈：https://github.com/alden888/erp-v5md/issues

---

**© 2025 V5 Medical. All Rights Reserved.**
