# V5 Medical ERPNext 部署指南

**版本**: v2.4 | **日期**: 2026-08-28
**域名**: https://erp.12888.de (已支付10年)

---

## 1. 系统架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Cloudflare    │────▶│   A机 (lima VM)   │────▶│   Docker 容器   │
│   Tunnel CDN    │     │   macOS ARM64     │     │   ERPNext 16.33 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   erp.12888.de           localhost:8080           MariaDB 11.8
                                                 Redis 7-alpine
```

## 2. 技术栈

| 组件 | 版本 | 说明 |
|------|------|------|
| ERPNext | 16.33.0 | 最新稳定版 |
| Frappe | 16.31.0 | ERPNext框架 |
| MariaDB | 11.8 | 数据库 |
| Redis | 7-alpine | 缓存/队列 |
| Docker | 29.5.2 | 容器化 |
| lima VM | vz虚拟化 | ARM64原生 |
| Cloudflare Tunnel | latest | 公网访问 |

## 3. 部署步骤

### 3.1 lima VM配置

```yaml
# ~/.lima/default/lima.yaml
cpus: 4
memory: "8GiB"
disk: "60GiB"
vmType: vz
arch: aarch64
portForwards:
  - guestPort: 8080
    hostPort: 8080
    hostIP: "0.0.0.0"
```

启动VM：
```bash
limactl start --name=default
```

### 3.2 Docker Compose配置

```yaml
# /tmp/frappe_docker/compose.yaml (ARM64版本)
services:
  backend:
    image: frappe/erpnext:v16.33.0
    platform: linux/arm64
    # ... 完整配置见仓库

  frontend:
    image: frappe/erpnext:v16.33.0
    platform: linux/arm64
    ports:
      - "8080:8080"

  mariadb:
    image: mariadb:11.8
    platform: linux/arm64

  redis:
    image: redis:7-alpine
```

### 3.3 站点创建

```bash
# 进入Docker容器
docker exec -it frappe_docker-backend-1 bash

# 创建站点
bench new-site v5.localhost \
  --mariadb-root-password [REDACTED] \
  --admin-password V5Admin2026! \
  --install-app erpnext

# 添加多站点域名
bench new-site 192.168.3.149 --mariadb-root-password [REDACTED]
bench new-site erp.12888.de --mariadb-root-password [REDACTED]

# 设置站点路由
bench set-site-hostname v5.localhost 192.168.3.149
bench set-site-hostname v5.localhost erp.12888.de
```

### 3.4 Cloudflare Tunnel

```bash
# 安装cloudflared
brew install cloudflared

# 登录
cloudflared tunnel login

# 创建隧道
cloudflared tunnel create v5-erp

# 配置DNS
cloudflared tunnel route dns v5-erp erp.12888.de

# 配置文件 ~/.cloudflared/config.yml
tunnel: 4c4f5f5d-f4fc-423a-8a34-989dc8cc42d1
credentials-file: /Users/apple/.cloudflared/4c4f5f5d-f4fc-423a-8a34-989dc8cc42d1.json

ingress:
  - hostname: erp.12888.de
    service: http://localhost:8080
  - service: http_status:404

# 启动隧道
cloudflared tunnel run v5-erp
```

### 3.5 launchd保活

```xml
<!-- ~/Library/LaunchAgents/com.v5medical.cloudflared.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.v5medical.cloudflared</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>run</string>
        <string>v5-erp</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

加载服务：
```bash
launchctl load ~/Library/LaunchAgents/com.v5medical.cloudflared.plist
```

## 4. 账号配置

### 4.1 全团Agent账号（2026-08-28已验证）

| Agent | 邮箱 | 角色 | 密码 | A2A端口 |
|-------|------|------|------|---------|
| CMD-Kellan | cmd@v5medical.ai | System Manager | V5CMDBOT2026! | 9900(A机) |
| CO-Ethan | co@v5medical.ai | Accounts Manager, Purchase Manager, Stock Manager | V5COBOT2026! | 9901(A机) |
| RC-Clara | rc@v5medical.ai | Accounts User, Accounts Manager, Sales User | V5RCBOT2026! | 9902(A机) |
| PO-Daniel | po@v5medical.ai | Projects Manager, Sales User, Sales Manager, Stock User | V5POBOT2026! | 9903(A机) |
| GO-Mia | go@v5medical.ai | Sales User | V5GOBOT2026! | 9900(B机) |
| IO-Sophia | io@v5medical.ai | Sales User | V5IOBOT2026! | 9901(B机) |
| NO-Leo | no@v5medical.ai | Sales Manager | V5NOBOT2026! | 9902(B机) |
| SC-Owen | sc@v5medical.ai | Stock Manager | V5SCBOT2026! | 9903(B机) |
| SA-David | sa@v5medical.ai | System Manager | V5SABOT2026! | 9904(B机) |
| DO-Rex | do@v5medical.ai | Sales User | V5DOBOT2026! | 9900(VPS1) |

> ⚠️ 密码由CMD统一管理，Agent不得自行修改。如需重置请联系CMD。

### 4.2 API Key生成

```python
# 在bench console中执行
import secrets
for email in ['cmd@v5medical.ai', 'co@v5medical.ai', ...]:
    user = frappe.get_doc('User', email)
    api_key = secrets.token_hex(16)
    api_secret = secrets.token_hex(16)
    user.api_key = api_key
    user.api_secret = api_secret
    user.save(ignore_permissions=True)
frappe.db.commit()
```

## 5. 模块配置

### 5.1 P0核心模块（已完成）

1. **CRM客户/线索管理**
   - 客户分组：Commercial/Others/Southeast Asia/Middle East/Europe/Africa
   - 自定义字段(11个)：风控评级/付款条件/信用额度/OFAC状态/制裁检查/Agent负责人/公司背景/财务状况/市场位置/审核备注/最后审核日期

2. **产品管理**
   - 198个产品（多肽类为主）
   - 价格表：V5 Export(USD)/V5 Export-EUR/V5 Export-TRY
   - ⚠️ 待办：184个产品standard_rate=0，需CO导入

3. **报价单/PI**
   - 自定义字段：PI编号/有效期/付款方式/贸易方式/利润率
   - 信头模板：V5 Medical

4. **采购订单**
   - 供应商管理：等级/MOQ/交期/付款方式/质量评分
   - 自定义字段：生产状态/预计交期/Agent负责人

5. **库存管理**
   - 仓库：V5 Main Warehouse/V5 Transit Warehouse
   - 自定义字段：物流类型/跟踪号/批次号/保质期
   - 库存预警：最低1000单位，补货5000单位

6. **多币种支持**
   - 8个汇率：USD→CNY/EUR/TRY/SAR/AED/NGN/EGP/ALL
   - 3个价格表：USD/EUR/TRY
   - System default_currency: CNY

7. **REST API**
   - 登录：POST /api/method/login
   - 查询：GET /api/resource/{DocType}
   - 创建：POST /api/resource/{DocType}

### 5.2 P1增强模块（已完成）

1. **应收应付管理**
   - 账户：AR-Domestic/AR-Export/AP-Domestic/AP-Export
   - 自定义字段：PI编号/到期状态/Agent负责人
   - 银行账户：V5 Medical Main Account - Bank of China (CNY)

2. **物流单号跟踪**
   - 承运商：DHL/FedEx/UPS/EMS/Sea Freight
   - 自定义字段：承运商/单号/ETD/ETA/物流状态

3. **风控评级工作流**
   - 状态：Pending Review/Approved/Rejected/Under Investigation
   - 商机自定义字段：风控标记/背调状态

4. **邮件通知集成**
   - 模板：Overdue Invoice/New Lead
   - Auto Email Report配置

### 5.3 P2高级模块（已完成）

1. **背调档案管理**
   - 客户自定义字段：公司背景/财务状况/市场地位/制裁检查/OFAC状态

2. **社媒运营数据**
   - Lead自定义字段(12个)：渠道/首次联系/响应状态/活动名称/Agent负责人/目标产品/来源详情/国家风险/外联渠道/风险评级/**来源URL**/**采集时间**/**Lead Source**

3. **高级报表/仪表盘**
   - Dashboard：V5 Sales Dashboard
   - 自定义报表：Agent Performance Summary

4. **飞书数据迁移**
   - 迁移脚本：scripts/feishu_to_erp_migration.py
   - 支持：客户/线索/产品批量导入

### 5.4 自定义DocType

| DocType | 字段数 | 用途 | 创建日期 |
|---------|--------|------|----------|
| Backcheck Task | 14 | 客户核实流程(背景核查/PI确认/支付凭证/出货确认/交付确认) | 2026-08-28 |

Backcheck Task字段：task_title / customer / task_type / status / priority / assigned_to / due_date / notes / result / lead / sales_order / quotation

## 6. 数据迁移

### 6.1 飞书→ERPNext迁移

```bash
# 导出飞书数据
python3 scripts/feishu_export.py

# 导入ERPNext
python3 scripts/feishu_to_erp_migration.py cmd@v5medical.ai [password] customers /tmp/feishu_customers.csv
python3 scripts/feishu_to_erp_migration.py cmd@v5medical.ai [password] leads /tmp/feishu_leads.csv
python3 scripts/feishu_to_erp_migration.py cmd@v5medical.ai [password] items /tmp/feishu_suppliers.csv
```

### 6.2 台账导入（2026-08-28完成）

2026年收款明细台账已导入ERP：
- 16笔Sales Invoice + 16笔 Payment Entry
- 总营收：¥640,635
- 5个客户：Mikki Healthcare Trading / Turhan Medical / Aram Medical Supply / ULTRA ENERGY (Andy) / Hector - Mexico Dental
- 14个通用Item已创建

### 6.3 当前数据量（2026-08-28实测）

| 数据类型 | 数量 | 说明 |
|----------|------|------|
| 客户 | 39 | 含台账新增2个 |
| 线索 | 1205+ | 含迁移数据 |
| 产品 | 198 | 多肽类为主 |
| 供应商 | 3 | |
| 报价单 | 1 | SAL-QTN-2026-00002 ($116K) |
| 采购订单 | 1 | |
| Sales Invoice | 16 | 台账导入(¥640,635) |
| Payment Entry | 16 | 台账导入 |
| 库存 | 4种产品 | |
| 价格表 | 5 | USD/EUR/TRY/CNY等 |
| 汇率 | 8 | |
| 会计科目 | 100 | |

## 7. 安全配置

### 7.1 Cloudflare WAF规则

1. API路径bypass：
   ```
   (http.request.uri.path contains "/api/")
   → Action: Skip (all managed rules)
   ```

2. VPS1 IP skip：
   ```
   (ip.src eq 47.77.218.55)
   → Action: Skip (http_request_firewall_managed)
   ```

### 7.2 密码策略

- Administrator：V5Admin2026!
- Agent密码：CMD统一设置（见4.1节）
- API Key/Secret：存ERPNext User表

### 7.3 权限矩阵

| DocType | System Manager | Sales Manager | Sales User | Stock Manager | Accounts Manager | Projects Manager |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Customer | RWD | RWD | RWC | - | RW | RWC |
| Lead | RWD | RWD | RW | - | - | RW |
| Item | RWD | RWCDS | R | RWD | - | - |
| Quotation | RWD | RWCDSA | RWCDSA | - | - | RWC |
| Sales Order | RWD | RWCDS | RWCDS | - | - | RWC |
| Sales Invoice | RWD | RWCDSA | RWCS | - | - | RW |
| Purchase Order | RWD | - | - | RWD | - | - |
| Work Order | RWD | RWCS | R | - | - | RWC |
| Backcheck Task | RWD | RWD | RWC | - | RWC | RWC |

## 8. 访问方式

| 方式 | 地址 | 用途 |
|------|------|------|
| 公网 | https://erp.12888.de | 浏览器/API |
| 局域网 | http://192.168.3.149:8080 | A机直接访问 |
| lima内部 | http://v5.localhost:8080 | 容器内API（需limactl shell） |

## 9. 维护命令

```bash
# 检查Docker状态
docker compose ps

# 查看日志
docker logs frappe_docker-backend-1 --tail=100

# 重启服务
docker compose restart

# 更新ERPNext
docker exec frappe_docker-backend-1 bench update

# 备份数据库
docker exec frappe_docker-backend-1 bench --site v5.localhost backup

# 检查隧道状态
launchctl list | grep cloudflared
```

## 10. 故障排除

### 10.1 隧道断开

```bash
# 检查进程
ps aux | grep cloudflared

# 重启隧道
launchctl unload ~/Library/LaunchAgents/com.v5medical.cloudflared.plist
launchctl load ~/Library/LaunchAgents/com.v5medical.cloudflared.plist
```

### 10.2 数据库连接失败

```bash
# 检查MariaDB
docker exec frappe_docker-mariadb-1 mysql -u root -p -e "SHOW DATABASES;"

# 修复权限
docker exec frappe_docker-mariadb-1 mysql -u root -p -e "
GRANT ALL PRIVILEGES ON \`_9221c07a4cd780d6\`.* TO '_9221c07a4cd780d6'@'%';
FLUSH PRIVILEGES;
"
```

### 10.3 API权限错误

```python
# 在bench console中添加权限
import frappe
for role in ['System Manager', 'Sales Manager']:
    for doctype in ['Customer', 'Lead', 'Item', 'Quotation']:
        if not frappe.db.exists('Custom DocPerm', {'parent': doctype, 'role': role}):
            perm = frappe.new_doc('Custom DocPerm')
            perm.parent = doctype
            perm.role = role
            perm.read = 1
            perm.write = 1
            perm.create = 1
            perm.insert(ignore_permissions=True)
frappe.db.commit()
```

### 10.4 Agent账号登录失败

```bash
# 用curl测试（不要用Python urllib，v5.localhost在容器内DNS不解析）
limactl shell default bash -c '
curl -s -X POST http://v5.localhost:8080/api/method/login \
  -d "usr=AGENT_EMAIL&pwd=AGENT_PASSWORD"
'

# 重置密码（Admin操作）
limactl shell default bash -c '
COOKIES=$(mktemp)
curl -s -c "$COOKIES" -b "$COOKIES" -X POST http://v5.localhost:8080/api/method/login \
  -d "usr=Administrator&pwd=V5Admin2026!" > /dev/null
curl -s -b "$COOKIES" -c "$COOKIES" \
  -X PUT "http://v5.localhost:8080/api/resource/User/ENCODED_EMAIL" \
  -H "Content-Type: application/json" \
  -d "{\"new_password\": \"NEW_PASSWORD\", \"logout_all_sessions\": 1}"
rm -f "$COOKIES"
'
```

> ⚠️ **关键教训**：容器内Python urllib无法解析`v5.localhost`（DNS问题），但curl可以。测试登录务必用curl。

### 10.5 Sales Invoice创建失败："Due Date cannot be before Posting Date"

ERPNext对历史日期的SI创建有校验。**解决方案**：设置`due_date`为年末日期（如"2026-12-31"），不要设为与posting_date相同。

---

## 11. 三轮测试整改记录（2026-08-28）

### Round 1 → Round 2 评分：70 → 78 (+8)

### 已完成整改项

| 问题 | 修复人 | 状态 |
|------|--------|------|
| RC账号登录失败 | CMD | ✅ 密码重置 |
| RC角色不足(仅Accounts User) | CMD | ✅ 升级Accounts Manager+Sales User |
| Company无default_bank_account | CMD | ✅ 创建Bank of China GL+Bank Account |
| System default_currency未设置 | CMD | ✅ CNY |
| Backcheck Task DocType不存在 | CMD | ✅ 创建(14字段) |
| source字段权限被禁 | CMD | ✅ 创建Select字段+开放权限 |
| v5_source_url/v5_collected_at缺失 | CMD | ✅ 创建 |
| Lead权限重复(12个→4个) | CMD | ✅ 清理 |
| 2026年台账未导入ERP | CMD | ✅ 16笔SI+PE导入(¥640,635) |
| 6个Agent账号密码失效 | CMD | ✅ 全部重置 |

### 待整改项（Round 3+）

| 优先级 | 问题 | 负责 |
|--------|------|------|
| 🔴 P0 | 184产品standard_rate=0 | CO |
| 🔴 P0 | Server Script红线校验=0 | DO |
| 🔴 P0 | 3个Workflow审批流 | DO |
| 🔴 P0 | 客户背调字段95%空白 | IO |
| 🟡 P1 | Lead Owner分配不均(DO:701/NO:1/GO:1) | CMD |
| 🟡 P1 | 34%Lead标记为China(应为供应商) | CEO决策 |
| 🟡 P1 | 43%无email/98%无电话 | IO/DO |
| 🟡 P1 | 产品标准价批量导入 | CO |

---

**维护人**: V5CMD-Kellan
**最后更新**: 2026-08-28 v2.4
**GitHub**: https://github.com/alden888/erp-v5md
